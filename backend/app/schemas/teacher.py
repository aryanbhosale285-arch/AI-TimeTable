from pydantic import BaseModel
from typing import Optional, List, Any


class TeacherCreate(BaseModel):
    name: str
    email: Optional[str] = None
    availability: Optional[Any] = None
    max_periods_per_day: int = 8
    min_periods_per_week: int = 0


class TeacherOut(TeacherCreate):
    id: int
    school_id: int
    model_config = {"from_attributes": True}


class AssignmentCreate(BaseModel):
    teacher_id: int
    subject_id: int
    section_id: int
    lectures_per_week: int
    lectures_per_week_max: Optional[int] = None
    preferred_time: Optional[str] = None


class AssignmentOut(AssignmentCreate):
    id: int
    school_id: int
    model_config = {"from_attributes": True}


class CSVRow(BaseModel):
    teacher_name: str
    subject: str
    standard: str
    section: str
    lectures_per_week: str  # could be "4-5" or "6"
    preferred_time: Optional[str] = None
    special_room: Optional[str] = None
