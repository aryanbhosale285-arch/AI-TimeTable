from pydantic import BaseModel
from typing import Optional, List
from app.models.academic import RoomType


class SubjectCreate(BaseModel):
    name: str
    code: Optional[str] = None
    requires_room_type: RoomType = RoomType.CLASSROOM
    color: str = "#6366f1"


class SubjectOut(SubjectCreate):
    id: int
    school_id: int
    model_config = {"from_attributes": True}


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    requires_room_type: Optional[RoomType] = None
    color: Optional[str] = None


class SectionCreate(BaseModel):
    name: str
    strength: int = 40


class SectionOut(SectionCreate):
    id: int
    standard_id: int
    model_config = {"from_attributes": True}


class StandardCreate(BaseModel):
    name: str
    order: int = 0
    sections: List[SectionCreate] = []


class StandardOut(BaseModel):
    id: int
    school_id: int
    name: str
    order: int
    sections: List[SectionOut] = []
    model_config = {"from_attributes": True}


class RoomCreate(BaseModel):
    name: str
    room_type: RoomType = RoomType.CLASSROOM
    capacity: int = 40
    is_available: bool = True


class RoomOut(RoomCreate):
    id: int
    school_id: int
    model_config = {"from_attributes": True}


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    room_type: Optional[RoomType] = None
    capacity: Optional[int] = None
    is_available: Optional[bool] = None
