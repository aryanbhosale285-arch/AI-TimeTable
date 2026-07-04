"""Public, unauthenticated resolution of parent share links.

A share token maps to exactly one timetable and returns everything the parent
view needs in one call — school shape, class list, and slots with staff
details stripped out.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.academic import Standard, Subject
from app.models.school import School
from app.models.timetable import ShareLink, Timetable
from app.schemas.academic import StandardOut
from app.schemas.school import SchoolOut
from app.schemas.timetable import ParentSlotOut, TimetableOut

router = APIRouter(prefix="/share", tags=["share"])


class ShareViewOut(BaseModel):
    school: SchoolOut
    timetable: TimetableOut
    standards: List[StandardOut]
    slots: List[ParentSlotOut]


@router.get("/{token}", response_model=ShareViewOut)
def resolve_share_link(token: str, db: Session = Depends(get_db)):
    link = db.query(ShareLink).filter(
        ShareLink.token == token, ShareLink.revoked.is_(False)
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="This link is invalid or has been revoked")

    tt = db.query(Timetable).filter(Timetable.id == link.timetable_id).first()
    school = db.query(School).filter(School.id == link.school_id).first()
    if not tt or not school:
        raise HTTPException(status_code=404, detail="This timetable no longer exists")

    subjects = {s.id: s for s in db.query(Subject).filter(Subject.school_id == school.id)}
    standards = (
        db.query(Standard)
        .filter(Standard.school_id == school.id)
        .order_by(Standard.order)
        .all()
    )

    slots = []
    for s in tt.slots:
        subj = subjects.get(s.subject_id)
        slots.append(
            ParentSlotOut(
                section_id=s.section_id,
                subject_id=s.subject_id,
                day_index=s.day_index,
                period_index=s.period_index,
                is_free=s.is_free,
                is_fixed=s.is_fixed,
                conflict=s.conflict,
                subject_name=subj.name if subj else None,
                subject_color=subj.color if subj else None,
            )
        )

    # generation_log is internal — don't ship the solver log to parents.
    tt_out = TimetableOut.model_validate(tt)
    tt_out.generation_log = None

    return ShareViewOut(
        school=SchoolOut.model_validate(school),
        timetable=tt_out,
        standards=[StandardOut.model_validate(st) for st in standards],
        slots=slots,
    )
