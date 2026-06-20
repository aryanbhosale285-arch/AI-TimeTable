from datetime import time as dt_time

from pydantic import BaseModel, field_validator
from typing import Optional, List
from app.models.school import BoardTemplate


class WorkingDayBase(BaseModel):
    day_name: str
    is_half_day: bool = False
    day_order: int


class WorkingDayCreate(WorkingDayBase):
    pass


class WorkingDayOut(WorkingDayBase):
    id: int
    model_config = {"from_attributes": True}


class PeriodBase(BaseModel):
    period_number: int
    start_time: str  # "HH:MM"
    end_time: str
    label: Optional[str] = None

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def coerce_time_to_str(cls, v):
        """SQLAlchemy returns datetime.time objects; convert them to 'HH:MM' strings."""
        if isinstance(v, dt_time):
            return v.strftime("%H:%M")
        return v


class PeriodCreate(PeriodBase):
    pass


class PeriodOut(PeriodBase):
    id: int
    model_config = {"from_attributes": True}


class BreakBase(BaseModel):
    name: str
    after_period: int
    duration_minutes: int


class BreakCreate(BreakBase):
    pass


class BreakOut(BreakBase):
    id: int
    model_config = {"from_attributes": True}


class SchoolCreate(BaseModel):
    name: str
    board: BoardTemplate = BoardTemplate.CBSE
    periods_per_day: int = 8
    half_day_periods: Optional[int] = None
    academic_year: str = "2025-26"
    working_days: List[WorkingDayCreate] = []
    periods: List[PeriodCreate] = []
    breaks: List[BreakCreate] = []


class SchoolOut(BaseModel):
    id: int
    name: str
    board: BoardTemplate
    periods_per_day: int
    half_day_periods: Optional[int] = None
    academic_year: str
    working_days: List[WorkingDayOut] = []
    periods: List[PeriodOut] = []
    breaks: List[BreakOut] = []
    model_config = {"from_attributes": True}


class SchoolUpdate(BaseModel):
    name: Optional[str] = None
    board: Optional[BoardTemplate] = None
    periods_per_day: Optional[int] = None
    half_day_periods: Optional[int] = None
    academic_year: Optional[str] = None
