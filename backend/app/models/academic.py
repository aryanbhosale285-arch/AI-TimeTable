from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class RoomType(str, enum.Enum):
    CLASSROOM = "CLASSROOM"
    LAB = "LAB"
    LIBRARY = "LIBRARY"
    HALL = "HALL"
    OTHER = "OTHER"


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String)
    requires_room_type = Column(Enum(RoomType), default=RoomType.CLASSROOM)
    color = Column(String, default="#6366f1")  # hex color for UI

    school = relationship("School", back_populates="subjects")
    assignments = relationship("TeacherAssignment", back_populates="subject", cascade="all, delete-orphan")


class Standard(Base):
    """A grade/year level e.g. '10th', 'Class 5'."""
    __tablename__ = "standards"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)  # "10th", "Class 5"
    order = Column(Integer, default=0)

    school = relationship("School", back_populates="standards")
    sections = relationship("Section", back_populates="standard", cascade="all, delete-orphan")


class Section(Base):
    """A class/division e.g. '10th A'."""
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    standard_id = Column(Integer, ForeignKey("standards.id"), nullable=False)
    name = Column(String, nullable=False)  # "A", "B", "C"
    strength = Column(Integer, default=40)

    standard = relationship("Standard", back_populates="sections")
    assignments = relationship("TeacherAssignment", back_populates="section", cascade="all, delete-orphan")
    timetable_slots = relationship("TimetableSlot", back_populates="section", cascade="all, delete-orphan")
    fixed_slots = relationship("FixedSlot", back_populates="section", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)
    room_type = Column(Enum(RoomType), default=RoomType.CLASSROOM)
    capacity = Column(Integer, default=40)
    is_available = Column(Boolean, default=True)

    school = relationship("School", back_populates="rooms")
    timetable_slots = relationship("TimetableSlot", back_populates="room")
