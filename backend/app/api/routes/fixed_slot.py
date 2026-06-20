from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.school import School
from app.models.timetable import FixedSlot
from app.schemas.timetable import FixedSlotCreate, FixedSlotOut

router = APIRouter(prefix="/schools/{school_id}/fixed-slots", tags=["fixed-slots"])


def _get_school(school_id: int, db: Session) -> School:
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return school


@router.get("", response_model=List[FixedSlotOut])
def list_fixed_slots(school_id: int, db: Session = Depends(get_db)):
    return db.query(FixedSlot).filter(FixedSlot.school_id == school_id).all()


@router.post("", response_model=FixedSlotOut)
def create_fixed_slot(school_id: int, payload: FixedSlotCreate, db: Session = Depends(get_db)):
    _get_school(school_id, db)
    slot = FixedSlot(school_id=school_id, **payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.delete("/{slot_id}", status_code=204)
def delete_fixed_slot(school_id: int, slot_id: int, db: Session = Depends(get_db)):
    slot = db.query(FixedSlot).filter(
        FixedSlot.id == slot_id, FixedSlot.school_id == school_id
    ).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Fixed slot not found")
    db.delete(slot)
    db.commit()
