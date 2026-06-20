from sqlalchemy import Column, Integer, String, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)
    email = Column(String)
    # availability[day_index][period_index] = True/False
    # None means fully available (default)
    availability = Column(JSON, nullable=True)
    max_periods_per_day = Column(Integer, default=8)
    min_periods_per_week = Column(Integer, default=0)

    school = relationship("School", back_populates="teachers")
    assignments = relationship("TeacherAssignment", back_populates="teacher", cascade="all, delete-orphan")
    timetable_slots = relationship("TimetableSlot", back_populates="teacher")


class TeacherAssignment(Base):
    """One row of the CSV: teacher teaches subject to section N times/week."""
    __tablename__ = "teacher_assignments"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    lectures_per_week = Column(Integer, nullable=False)
    lectures_per_week_max = Column(Integer, nullable=True)  # for ranges like "4-5"
    preferred_time = Column(String, nullable=True)  # "Morning", "Afternoon"

    teacher = relationship("Teacher", back_populates="assignments")
    subject = relationship("Subject", back_populates="assignments")
    section = relationship("Section", back_populates="assignments")
