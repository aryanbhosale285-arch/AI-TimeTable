"""Timetable generation pipeline shared by the sync endpoint and background jobs.

Runs preflight → solve → room assignment → bulk save, optionally reporting
progress into a GenerationJob row so the UI can poll a stage string.
"""
import json
from collections import defaultdict
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.rule import CustomRule
from app.models.school import School
from app.models.timetable import (
    FixedSlot, GenerationJob, Timetable, TimetableSlot, TimetableStatus,
)
from app.services.preflight import run_preflight
from app.services.solver import TimetableSolver

# Background jobs aren't racing a proxy timeout, so give the solver more room.
MAX_BACKGROUND_SOLVE_SECONDS = 180
# The sync endpoint must answer before Vercel's ~30s proxy limit.
MAX_SYNC_SOLVE_SECONDS = 25


class GenerationError(Exception):
    def __init__(self, message: str, errors: List[str]):
        super().__init__(message)
        self.message = message
        self.errors = errors


def _set_stage(db: Session, job: Optional[GenerationJob], stage: str) -> None:
    if job is not None:
        job.stage = stage
        db.commit()


def generate_timetable(
    db: Session,
    school: School,
    name: str,
    *,
    time_cap_seconds: int,
    job: Optional[GenerationJob] = None,
) -> Timetable:
    """Run the full pipeline and persist the result. Raises GenerationError."""
    school_id = school.id
    all_fixed = db.query(FixedSlot).filter(FixedSlot.school_id == school_id).all()

    _set_stage(db, job, "preflight")
    report = run_preflight(school, all_fixed)
    if not report.feasible:
        raise GenerationError("Pre-flight failed", report.errors)

    from app.api.routes.rule import get_or_create
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

    _set_stage(db, job, "solving")
    solver = TimetableSolver(
        school, all_fixed,
        time_limit_seconds=min(cfg.solve_time_limit, time_cap_seconds),
        rules=rules, custom_rules=custom_rules,
    )
    result = solver.solve()

    if result.status == "INFEASIBLE":
        raise GenerationError("Solver could not find a valid timetable.", result.log)

    _set_stage(db, job, "saving")
    tt = Timetable(
        school_id=school_id,
        name=name,
        status=TimetableStatus.GENERATED,
        generation_log=json.dumps(
            {"status": result.status, "objective": result.objective, "log": result.log}
        ),
    )
    db.add(tt)
    db.flush()

    _assign_rooms(school, result.slots)

    # One bulk insert instead of ~800 single INSERTs — matters on a remote DB.
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
    return tt


def run_generation_job(job_id: int) -> None:
    """Thread entrypoint for a background generation. Owns its own session."""
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
        if not job:
            return
        job.status = "RUNNING"
        db.commit()

        school = db.query(School).filter(School.id == job.school_id).first()
        if not school:
            raise GenerationError("School not found", ["School was deleted before the job ran."])

        tt = generate_timetable(
            db, school, job.timetable_name,
            time_cap_seconds=MAX_BACKGROUND_SOLVE_SECONDS, job=job,
        )
        job.timetable_id = tt.id
        job.status = "SUCCEEDED"
    except GenerationError as e:
        db.rollback()
        job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
        if job:
            job.status = "FAILED"
            job.error = json.dumps([e.message, *e.errors])
    except Exception as e:  # noqa: BLE001 — a crashed thread must still mark the job failed
        db.rollback()
        job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
        if job:
            job.status = "FAILED"
            job.error = json.dumps([f"Unexpected error: {e}"])
    finally:
        job = db.query(GenerationJob).filter(GenerationJob.id == job_id).first()
        if job:
            job.finished_at = datetime.utcnow()
            job.stage = None
            db.commit()
        db.close()


def _assign_rooms(school: School, cells: list) -> None:
    """Greedily assign a room to each solved cell (in place, adds 'room_id').

    Picks an available room whose type matches the subject's requirement, never
    double-booking a room within the same day+period. If not enough rooms exist
    for a slot, that cell simply gets no room (room_id stays null).
    """
    subj_type = {s.id: s.requires_room_type.value for s in school.subjects}
    rooms_by_type = defaultdict(list)
    for r in school.rooms:
        if r.is_available:
            rooms_by_type[r.room_type.value].append(r.id)

    used = defaultdict(set)  # (day, period) -> room_ids already taken
    for c in cells:
        rtype = subj_type.get(c.get("subject_id"), "CLASSROOM")
        key = (c["day_index"], c["period_index"])
        for rid in rooms_by_type.get(rtype, []):
            if rid not in used[key]:
                c["room_id"] = rid
                used[key].add(rid)
                break
