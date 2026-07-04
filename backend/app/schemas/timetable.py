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


class GenerationJobOut(BaseModel):
    id: int
    school_id: int
    timetable_name: str
    status: str
    stage: Optional[str] = None
    errors: List[str] = []
    timetable_id: Optional[int] = None
    created_at: datetime
    finished_at: Optional[datetime] = None


class ShareLinkOut(BaseModel):
    id: int
    token: str
    timetable_id: int
    revoked: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class ParentSlotOut(BaseModel):
    """A timetable cell as parents see it — no staff details."""
    section_id: int
    subject_id: Optional[int] = None
    day_index: int
    period_index: int
    is_free: bool
    is_fixed: bool
    conflict: bool
    subject_name: Optional[str] = None
    subject_color: Optional[str] = None
