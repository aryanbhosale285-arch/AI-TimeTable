import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.school import School
from app.models.academic import Subject, Room
from app.models.teacher import Teacher
from app.models.timetable import Timetable, TimetableSlot, FixedSlot, TimetableStatus
from app.schemas.timetable import (
    TimetableCreate, TimetableOut, TimetableDetail, TimetableSlotOut, PreflightResult,
)
from app.services.preflight import run_preflight
from app.services.solver import TimetableSolver

router = APIRouter(prefix="/schools/{school_id}/timetables", tags=["timetables"])


def _get_school(school_id: int, db: Session) -> School:
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return school


@router.post("/preflight", response_model=PreflightResult)
def preflight(school_id: int, db: Session = Depends(get_db)):
    school = _get_school(school_id, db)
    fixed = db.query(FixedSlot).filter(FixedSlot.school_id == school_id).all()
    report = run_preflight(school, fixed)
    return PreflightResult(
        feasible=report.feasible,
        errors=report.errors,
        warnings=report.warnings,
        stats=report.stats,
    )


@router.post("/generate", response_model=TimetableDetail)
def generate(school_id: int, payload: TimetableCreate, db: Session = Depends(get_db)):
    print(f"!!! STARTING TIMETABLE GENERATION for school {school_id} !!!", flush=True)
    school = _get_school(school_id, db)

    # Persist any fixed slots passed in
    fixed_models = []
    for fs in payload.fixed_slots:
        m = FixedSlot(school_id=school_id, **fs.model_dump())
        db.add(m)
        fixed_models.append(m)
    db.flush()

    all_fixed = db.query(FixedSlot).filter(FixedSlot.school_id == school_id).all()

    # Pre-flight gate
    report = run_preflight(school, all_fixed)
    if not report.feasible:
        raise HTTPException(
            status_code=422,
            detail={"message": "Pre-flight failed", "errors": report.errors},
        )

    # Solve — honour the admin-configured rules.
    from app.api.routes.rule import get_or_create
    from app.models.rule import CustomRule
    cfg = get_or_create(db)
    rules = {
        "keep_key_periods_filled": cfg.keep_key_periods_filled,
        "teacher_rest_after_two": cfg.teacher_rest_after_two,
        "avoid_back_to_back_free": cfg.avoid_back_to_back_free,
        "spread_subjects": cfg.spread_subjects,
        "morning_hard_subjects": cfg.morning_hard_subjects,
        "max_doubles_per_week": cfg.max_doubles_per_week,
    }
    custom_rules = [
        {
            "rule_type": r.rule_type,
            "subject_name": r.subject_name,
            "param_text": r.param_text,
            "param_int": r.param_int,
            "enabled": r.enabled,
        }
        for r in db.query(CustomRule).filter(CustomRule.enabled.is_(True))
    ]
    # Cap solving to 25s so the Next.js 30s proxy timeout doesn't drop the connection
    time_limit = min(cfg.solve_time_limit, 25)

    solver = TimetableSolver(
        school, all_fixed, time_limit_seconds=time_limit,
        rules=rules, custom_rules=custom_rules,
    )
    result = solver.solve()

    if result.status == "INFEASIBLE":
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Solver could not find a valid timetable.",
                "log": result.log,
            },
        )

    tt = Timetable(
        school_id=school_id,
        name=payload.name,
        status=TimetableStatus.GENERATED,
        generation_log=json.dumps(
            {"status": result.status, "objective": result.objective, "log": result.log}
        ),
    )
    db.add(tt)
    db.flush()

    # Assign a concrete room to each lecture (greedy, no double-booking per slot).
    _assign_rooms(school, result.slots)

    # Write all cells in ONE bulk insert instead of ~800 individual INSERTs —
    # over a remote DB that one change cuts the write from ~15s to ~1s.
    mappings = [{"timetable_id": tt.id, **cell} for cell in result.slots]
    mappings += [
        {
            "timetable_id": tt.id,
            "section_id": fs.section_id,
            "subject_id": fs.subject_id,
            "day_index": fs.day_index,
            "period_index": fs.period_index,
            "is_fixed": True,
        }
        for fs in all_fixed
    ]
    if mappings:
        db.bulk_insert_mappings(TimetableSlot, mappings)

    db.commit()
    db.refresh(tt)
    return _detail(tt, db)


@router.get("", response_model=List[TimetableOut])
def list_timetables(school_id: int, db: Session = Depends(get_db)):
    return db.query(Timetable).filter(Timetable.school_id == school_id).all()


@router.get("/{timetable_id}", response_model=TimetableDetail)
def get_timetable(school_id: int, timetable_id: int, db: Session = Depends(get_db)):
    tt = db.query(Timetable).filter(
        Timetable.id == timetable_id, Timetable.school_id == school_id
    ).first()
    if not tt:
        raise HTTPException(status_code=404, detail="Timetable not found")
    return _detail(tt, db)


@router.get("/{timetable_id}/export.xlsx")
def export_xlsx(school_id: int, timetable_id: int, db: Session = Depends(get_db)):
    from fastapi.responses import StreamingResponse
    from io import BytesIO
    from collections import defaultdict
    from app.models.academic import Standard, Section
    from app.services.excel_export import build_timetable_xlsx

    school = _get_school(school_id, db)
    tt = db.query(Timetable).filter(
        Timetable.id == timetable_id, Timetable.school_id == school_id
    ).first()
    if not tt:
        raise HTTPException(status_code=404, detail="Timetable not found")

    teachers = {t.id: t.name for t in db.query(Teacher).filter(Teacher.school_id == school_id)}
    subjects = {s.id: s for s in db.query(Subject).filter(Subject.school_id == school_id)}
    sections = [
        {"id": sec.id, "label": f"{std.name} {sec.name}"}
        for std in db.query(Standard).filter(Standard.school_id == school_id).order_by(Standard.order)
        for sec in std.sections
    ]
    days = [d.day_name for d in sorted(school.working_days, key=lambda d: d.day_order)]
    period_labels = {
        p.period_number - 1: f"{p.start_time.strftime('%H:%M')}-{p.end_time.strftime('%H:%M')}"
        for p in school.periods
    }

    slots_by_section: dict = defaultdict(dict)
    for s in tt.slots:
        subj = subjects.get(s.subject_id)
        slots_by_section[s.section_id][(s.day_index, s.period_index)] = {
            "subject": subj.name if subj else None,
            "teacher": teachers.get(s.teacher_id),
            "color": subj.color if subj else None,
        }

    data = build_timetable_xlsx(
        days=days,
        periods=school.periods_per_day,
        sections=sections,
        period_labels=period_labels,
        slots_by_section=slots_by_section,
        title=tt.name,
    )
    filename = f"{tt.name}.xlsx".replace(" ", "_").replace("/", "-")
    return StreamingResponse(
        BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{timetable_id}/publish", response_model=TimetableOut)
def publish(school_id: int, timetable_id: int, db: Session = Depends(get_db)):
    from datetime import datetime
    tt = db.query(Timetable).filter(
        Timetable.id == timetable_id, Timetable.school_id == school_id
    ).first()
    if not tt:
        raise HTTPException(status_code=404, detail="Timetable not found")
    tt.status = TimetableStatus.PUBLISHED
    tt.published_at = datetime.utcnow()
    db.commit()
    db.refresh(tt)
    return tt


@router.delete("/{timetable_id}", status_code=204)
def revoke_timetable(school_id: int, timetable_id: int, db: Session = Depends(get_db)):
    """Discard a timetable (and its slots) so the admin can generate a fresh one.

    Slots are deleted explicitly first to satisfy foreign keys on Postgres.
    """
    tt = db.query(Timetable).filter(
        Timetable.id == timetable_id, Timetable.school_id == school_id
    ).first()
    if not tt:
        raise HTTPException(status_code=404, detail="Timetable not found")
    db.query(TimetableSlot).filter(TimetableSlot.timetable_id == tt.id).delete(
        synchronize_session=False
    )
    db.delete(tt)
    db.commit()


def _assign_rooms(school: School, cells: list) -> None:
    """Greedily assign a room to each solved cell (in place, adds 'room_id').

    Picks an available room whose type matches the subject's requirement, never
    double-booking a room within the same day+period. If not enough rooms exist
    for a slot, that cell simply gets no room (room_id stays null).
    """
    from collections import defaultdict
    subj_type = {s.id: s.requires_room_type.value for s in school.subjects}
    rooms_by_type = defaultdict(list)
    for r in school.rooms:
        if r.is_available:
            rooms_by_type[r.room_type.value].append(r.id)

    used = defaultdict(set)  # (day, period) -> set of room_ids already taken
    for c in cells:
        rtype = subj_type.get(c.get("subject_id"), "CLASSROOM")
        key = (c["day_index"], c["period_index"])
        for rid in rooms_by_type.get(rtype, []):
            if rid not in used[key]:
                c["room_id"] = rid
                used[key].add(rid)
                break


def _detail(tt: Timetable, db: Session) -> TimetableDetail:
    """Enrich slots with teacher/subject/room names for the UI.

    Bulk-load the lookups once instead of lazy-loading per slot — a 20-class
    timetable has ~800 slots, and per-slot loading meant thousands of queries.
    """
    teachers = {t.id: t for t in db.query(Teacher).filter(Teacher.school_id == tt.school_id)}
    subjects = {s.id: s for s in db.query(Subject).filter(Subject.school_id == tt.school_id)}
    rooms = {r.id: r for r in db.query(Room).filter(Room.school_id == tt.school_id)}

    slots_out: List[TimetableSlotOut] = []
    for s in tt.slots:
        teacher = teachers.get(s.teacher_id)
        subject = subjects.get(s.subject_id)
        room = rooms.get(s.room_id)
        slots_out.append(
            TimetableSlotOut(
                id=s.id,
                section_id=s.section_id,
                teacher_id=s.teacher_id,
                subject_id=s.subject_id,
                room_id=s.room_id,
                day_index=s.day_index,
                period_index=s.period_index,
                is_free=s.is_free,
                is_fixed=s.is_fixed,
                conflict=s.conflict,
                teacher_name=teacher.name if teacher else None,
                subject_name=subject.name if subject else None,
                subject_color=subject.color if subject else None,
                room_name=room.name if room else None,
            )
        )
    return TimetableDetail(
        id=tt.id,
        school_id=tt.school_id,
        name=tt.name,
        status=tt.status,
        created_at=tt.created_at,
        published_at=tt.published_at,
        generation_log=tt.generation_log,
        slots=slots_out,
    )
