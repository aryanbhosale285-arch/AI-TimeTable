import json
import secrets
import threading
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.school import School
from app.models.academic import Subject, Room
from app.models.teacher import Teacher
from app.models.timetable import (
    Timetable, TimetableSlot, FixedSlot, TimetableStatus, GenerationJob, ShareLink,
)
from app.schemas.timetable import (
    TimetableCreate, TimetableOut, TimetableDetail, TimetableSlotOut, PreflightResult,
    GenerationJobOut, ShareLinkOut,
)
from app.services.generation import (
    GenerationError, generate_timetable, run_generation_job,
    MAX_SYNC_SOLVE_SECONDS,
)
from app.services.preflight import run_preflight

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


def _persist_fixed_slots(school_id: int, payload: TimetableCreate, db: Session) -> None:
    for fs in payload.fixed_slots:
        db.add(FixedSlot(school_id=school_id, **fs.model_dump()))
    db.flush()


@router.post("/generate", response_model=TimetableDetail)
def generate(school_id: int, payload: TimetableCreate, db: Session = Depends(get_db)):
    """Synchronous generation — kept for compatibility; capped so proxies don't
    drop the connection. Prefer POST /generate-async + job polling."""
    school = _get_school(school_id, db)
    _persist_fixed_slots(school_id, payload, db)
    try:
        tt = generate_timetable(
            db, school, payload.name, time_cap_seconds=MAX_SYNC_SOLVE_SECONDS
        )
    except GenerationError as e:
        raise HTTPException(
            status_code=422, detail={"message": e.message, "errors": e.errors}
        )
    return _detail(tt, db)


@router.post("/generate-async", response_model=GenerationJobOut, status_code=202)
def generate_async(school_id: int, payload: TimetableCreate, db: Session = Depends(get_db)):
    """Start generation in the background and return a pollable job."""
    _get_school(school_id, db)
    _persist_fixed_slots(school_id, payload, db)

    job = GenerationJob(school_id=school_id, timetable_name=payload.name, status="QUEUED")
    db.add(job)
    db.commit()
    db.refresh(job)

    threading.Thread(target=run_generation_job, args=(job.id,), daemon=True).start()
    return _job_out(job)


@router.get("/jobs/{job_id}", response_model=GenerationJobOut)
def get_job(school_id: int, job_id: int, db: Session = Depends(get_db)):
    job = db.query(GenerationJob).filter(
        GenerationJob.id == job_id, GenerationJob.school_id == school_id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_out(job)


def _job_out(job: GenerationJob) -> GenerationJobOut:
    errors: List[str] = []
    if job.error:
        try:
            errors = json.loads(job.error)
        except ValueError:
            errors = [job.error]
    return GenerationJobOut(
        id=job.id,
        school_id=job.school_id,
        timetable_name=job.timetable_name,
        status=job.status,
        stage=job.stage,
        errors=errors,
        timetable_id=job.timetable_id,
        created_at=job.created_at,
        finished_at=job.finished_at,
    )


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

    section_labels = {s["id"]: s["label"] for s in sections}
    slots_by_section: dict = defaultdict(dict)
    slots_by_teacher: dict = defaultdict(dict)
    for s in tt.slots:
        subj = subjects.get(s.subject_id)
        cell = {
            "subject": subj.name if subj else None,
            "teacher": teachers.get(s.teacher_id),
            "color": subj.color if subj else None,
        }
        slots_by_section[s.section_id][(s.day_index, s.period_index)] = cell
        if s.teacher_id:
            # On a teacher's own sheet the second line shows the class, not the teacher.
            slots_by_teacher[s.teacher_id][(s.day_index, s.period_index)] = {
                **cell, "teacher": section_labels.get(s.section_id),
            }

    data = build_timetable_xlsx(
        days=days,
        periods=school.periods_per_day,
        sections=sections,
        period_labels=period_labels,
        slots_by_section=slots_by_section,
        title=tt.name,
        teachers=[{"id": tid, "label": tname} for tid, tname in sorted(teachers.items(), key=lambda kv: kv[1])],
        slots_by_teacher=slots_by_teacher,
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


# ---- Parent share links ----

def _get_timetable(school_id: int, timetable_id: int, db: Session) -> Timetable:
    tt = db.query(Timetable).filter(
        Timetable.id == timetable_id, Timetable.school_id == school_id
    ).first()
    if not tt:
        raise HTTPException(status_code=404, detail="Timetable not found")
    return tt


@router.post("/{timetable_id}/share-links", response_model=ShareLinkOut, status_code=201)
def create_share_link(school_id: int, timetable_id: int, db: Session = Depends(get_db)):
    _get_timetable(school_id, timetable_id, db)
    link = ShareLink(
        token=secrets.token_urlsafe(16),
        school_id=school_id,
        timetable_id=timetable_id,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.get("/{timetable_id}/share-links", response_model=List[ShareLinkOut])
def list_share_links(school_id: int, timetable_id: int, db: Session = Depends(get_db)):
    _get_timetable(school_id, timetable_id, db)
    return (
        db.query(ShareLink)
        .filter(ShareLink.timetable_id == timetable_id, ShareLink.revoked.is_(False))
        .order_by(ShareLink.id.desc())
        .all()
    )


@router.delete("/{timetable_id}/share-links/{link_id}", status_code=204)
def revoke_share_link(school_id: int, timetable_id: int, link_id: int, db: Session = Depends(get_db)):
    link = db.query(ShareLink).filter(
        ShareLink.id == link_id,
        ShareLink.timetable_id == timetable_id,
        ShareLink.school_id == school_id,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    link.revoked = True
    db.commit()


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
