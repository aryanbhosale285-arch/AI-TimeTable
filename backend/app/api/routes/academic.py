from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.academic import Subject, Standard, Section, Room
from app.models.school import School
from app.schemas.academic import (
    SubjectCreate, SubjectOut, SubjectUpdate,
    StandardCreate, StandardOut,
    RoomCreate, RoomOut, RoomUpdate,
)

router = APIRouter(prefix="/schools/{school_id}", tags=["academic"])


def _get_school(school_id: int, db: Session) -> School:
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return school


# ---------- Subjects ----------

@router.post("/subjects", response_model=SubjectOut)
def create_subject(school_id: int, payload: SubjectCreate, db: Session = Depends(get_db)):
    _get_school(school_id, db)
    subject = Subject(school_id=school_id, **payload.model_dump())
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.get("/subjects", response_model=List[SubjectOut])
def list_subjects(school_id: int, db: Session = Depends(get_db)):
    return db.query(Subject).filter(Subject.school_id == school_id).all()


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
def update_subject(school_id: int, subject_id: int, payload: SubjectUpdate, db: Session = Depends(get_db)):
    subject = db.query(Subject).filter(Subject.id == subject_id, Subject.school_id == school_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(subject, field, value)
    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/subjects/{subject_id}", status_code=204)
def delete_subject(school_id: int, subject_id: int, db: Session = Depends(get_db)):
    subject = db.query(Subject).filter(Subject.id == subject_id, Subject.school_id == school_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    db.delete(subject)
    db.commit()


# ---------- Standards & Sections ----------

@router.post("/standards", response_model=StandardOut)
def create_standard(school_id: int, payload: StandardCreate, db: Session = Depends(get_db)):
    _get_school(school_id, db)
    standard = Standard(school_id=school_id, name=payload.name, order=payload.order)
    db.add(standard)
    db.flush()
    for s in payload.sections:
        db.add(Section(standard_id=standard.id, **s.model_dump()))
    db.commit()
    db.refresh(standard)
    return standard


@router.get("/standards", response_model=List[StandardOut])
def list_standards(school_id: int, db: Session = Depends(get_db)):
    return db.query(Standard).filter(Standard.school_id == school_id).order_by(Standard.order).all()


# ---------- Rooms ----------

@router.post("/rooms", response_model=RoomOut)
def create_room(school_id: int, payload: RoomCreate, db: Session = Depends(get_db)):
    _get_school(school_id, db)
    room = Room(school_id=school_id, **payload.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.get("/rooms", response_model=List[RoomOut])
def list_rooms(school_id: int, db: Session = Depends(get_db)):
    return db.query(Room).filter(Room.school_id == school_id).all()


@router.patch("/rooms/{room_id}", response_model=RoomOut)
def update_room(school_id: int, room_id: int, payload: RoomUpdate, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == room_id, Room.school_id == school_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(room, field, value)
    db.commit()
    db.refresh(room)
    return room


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(school_id: int, room_id: int, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == room_id, Room.school_id == school_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    db.delete(room)
    db.commit()
