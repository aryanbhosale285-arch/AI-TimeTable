from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.timetable import TimetableStatus


class FixedSlotCreate(BaseModel):
    section_id: int
    subject_id: Optional[int] = None
    label: str
    day_index: int
    period_index: int


class FixedSlotOut(FixedSlotCreate):
    id: int
    school_id: int
    model_config = {"from_attributes": True}


class TimetableSlotOut(BaseModel):
    id: int
    section_id: int
    teacher_id: Optional[int]
    subject_id: Optional[int]
    room_id: Optional[int]
    day_index: int
    period_index: int
    is_free: bool
    is_fixed: bool
    conflict: bool
    teacher_name: Optional[str] = None
    subject_name: Optional[str] = None
    subject_color: Optional[str] = None
    room_name: Optional[str] = None
    model_config = {"from_attributes": True}


class TimetableCreate(BaseModel):
    name: str
    fixed_slots: List[FixedSlotCreate] = []


class TimetableOut(BaseModel):
    id: int
    school_id: int
    name: str
    status: TimetableStatus
    created_at: datetime
    published_at: Optional[datetime]
    generation_log: Optional[str]
    model_config = {"from_attributes": True}


class TimetableDetail(TimetableOut):
    slots: List[TimetableSlotOut] = []


class PreflightResult(BaseModel):
    feasible: bool
    errors: List[str]
    warnings: List[str]
    stats: dict
