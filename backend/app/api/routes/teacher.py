from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.school import School
from app.models.teacher import Teacher, TeacherAssignment
from app.schemas.teacher import (
    TeacherCreate, TeacherOut, AssignmentCreate, AssignmentOut,
)
from app.services import csv_import

router = APIRouter(prefix="/schools/{school_id}", tags=["teachers"])


def _get_school(school_id: int, db: Session) -> School:
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return school


@router.post("/teachers", response_model=TeacherOut)
def create_teacher(school_id: int, payload: TeacherCreate, db: Session = Depends(get_db)):
    _get_school(school_id, db)
    teacher = Teacher(school_id=school_id, **payload.model_dump())
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return teacher


@router.get("/teachers", response_model=List[TeacherOut])
def list_teachers(school_id: int, db: Session = Depends(get_db)):
    return db.query(Teacher).filter(Teacher.school_id == school_id).all()


@router.patch("/teachers/{teacher_id}", response_model=TeacherOut)
def update_teacher(school_id: int, teacher_id: int, payload: TeacherCreate, db: Session = Depends(get_db)):
    teacher = db.query(Teacher).filter(
        Teacher.id == teacher_id, Teacher.school_id == school_id
    ).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(teacher, field, value)
    db.commit()
    db.refresh(teacher)
    return teacher


@router.post("/assignments", response_model=AssignmentOut)
def create_assignment(school_id: int, payload: AssignmentCreate, db: Session = Depends(get_db)):
    _get_school(school_id, db)
    assignment = TeacherAssignment(school_id=school_id, **payload.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("/assignments", response_model=List[AssignmentOut])
def list_assignments(school_id: int, db: Session = Depends(get_db)):
    return db.query(TeacherAssignment).filter(
        TeacherAssignment.school_id == school_id
    ).all()


@router.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(school_id: int, assignment_id: int, db: Session = Depends(get_db)):
    a = db.query(TeacherAssignment).filter(
        TeacherAssignment.id == assignment_id,
        TeacherAssignment.school_id == school_id,
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(a)
    db.commit()


@router.post("/import")
async def import_csv(school_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    school = _get_school(school_id, db)
    content = await file.read()
    try:
        df = csv_import.parse_file(content, file.filename or "upload.csv")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    imported, warnings = csv_import.import_assignments(db, school, df)
    return {"imported": imported, "warnings": warnings}
