from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, Enum, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class TimetableStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    GENERATING = "GENERATING"
    GENERATED = "GENERATED"
    FAILED = "FAILED"
    APPROVED = "APPROVED"
    PUBLISHED = "PUBLISHED"


class Timetable(Base):
    __tablename__ = "timetables"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)
    status = Column(Enum(TimetableStatus), default=TimetableStatus.DRAFT)
    created_at = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)
    generation_log = Column(String, nullable=True)  # JSON string of preflight + solve log

    school = relationship("School", back_populates="timetables")
    slots = relationship("TimetableSlot", back_populates="timetable", cascade="all, delete-orphan")


class TimetableSlot(Base):
    """One filled cell in the master grid: day × period × section → subject + teacher + room."""
    __tablename__ = "timetable_slots"

    id = Column(Integer, primary_key=True, index=True)
    timetable_id = Column(Integer, ForeignKey("timetables.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True)
    day_index = Column(Integer, nullable=False)    # 0 = first working day
    period_index = Column(Integer, nullable=False)  # 0 = first period
    is_free = Column(Boolean, default=False)
    is_fixed = Column(Boolean, default=False)  # set by FixedSlot, never overwritten
    conflict = Column(Boolean, default=False)   # solver couldn't fill this cell

    timetable = relationship("Timetable", back_populates="slots")
    section = relationship("Section", back_populates="timetable_slots")
    teacher = relationship("Teacher", back_populates="timetable_slots")
    subject = relationship("Subject")
    room = relationship("Room", back_populates="timetable_slots")


class FixedSlot(Base):
    """Admin-locked slots (assembly, library) that the solver never touches."""
    __tablename__ = "fixed_slots"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    label = Column(String, nullable=False)  # "Assembly", "Library"
    day_index = Column(Integer, nullable=False)
    period_index = Column(Integer, nullable=False)

    section = relationship("Section", back_populates="fixed_slots")
