from datetime import datetime, time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.school import School, WorkingDay, Period, Break
from app.schemas.school import SchoolCreate, SchoolOut, SchoolUpdate

router = APIRouter(prefix="/schools", tags=["schools"])


def _parse_time(value) -> time:
    """Accept 'HH:MM' (or 'HH:MM:SS') strings and return a datetime.time."""
    if isinstance(value, time):
        return value
    text = str(value).strip()
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).time()
        except ValueError:
            continue
    raise HTTPException(status_code=400, detail=f"Invalid time format: {value!r}")


@router.post("", response_model=SchoolOut)
def create_school(payload: SchoolCreate, db: Session = Depends(get_db)):
    school = School(
        name=payload.name,
        board=payload.board,
        periods_per_day=payload.periods_per_day,
        half_day_periods=payload.half_day_periods,
        academic_year=payload.academic_year,
    )
    db.add(school)
    db.flush()

    for d in payload.working_days:
        db.add(WorkingDay(school_id=school.id, **d.model_dump()))
    for p in payload.periods:
        data = p.model_dump()
        data["start_time"] = _parse_time(data["start_time"])
        data["end_time"] = _parse_time(data["end_time"])
        db.add(Period(school_id=school.id, **data))
    for b in payload.breaks:
        db.add(Break(school_id=school.id, **b.model_dump()))

    db.commit()
    db.refresh(school)
    return school


@router.get("", response_model=List[SchoolOut])
def list_schools(db: Session = Depends(get_db)):
    return db.query(School).all()


@router.get("/{school_id}", response_model=SchoolOut)
def get_school(school_id: int, db: Session = Depends(get_db)):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return school


@router.patch("/{school_id}", response_model=SchoolOut)
def update_school(school_id: int, payload: SchoolUpdate, db: Session = Depends(get_db)):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(school, field, value)
    db.commit()
    db.refresh(school)
    return school


@router.delete("/{school_id}", status_code=204)
def delete_school(school_id: int, db: Session = Depends(get_db)):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    db.delete(school)
    db.commit()
