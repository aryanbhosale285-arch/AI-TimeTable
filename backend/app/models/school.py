from sqlalchemy import Column, Integer, String, Boolean, Time, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class BoardTemplate(str, enum.Enum):
    CBSE = "CBSE"
    ICSE = "ICSE"
    STATE = "STATE"
    IB = "IB"
    CUSTOM = "CUSTOM"


class School(Base):
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    board = Column(Enum(BoardTemplate), default=BoardTemplate.CBSE)
    periods_per_day = Column(Integer, default=8)
    # Number of periods on half-days (e.g. Saturday). Null => same as a full day.
    half_day_periods = Column(Integer, nullable=True)
    academic_year = Column(String, default="2025-26")

    working_days = relationship("WorkingDay", back_populates="school", cascade="all, delete-orphan")
    periods = relationship("Period", back_populates="school", cascade="all, delete-orphan", order_by="Period.period_number")
    breaks = relationship("Break", back_populates="school", cascade="all, delete-orphan")
    subjects = relationship("Subject", back_populates="school", cascade="all, delete-orphan")
    standards = relationship("Standard", back_populates="school", cascade="all, delete-orphan")
    rooms = relationship("Room", back_populates="school", cascade="all, delete-orphan")
    teachers = relationship("Teacher", back_populates="school", cascade="all, delete-orphan")
    timetables = relationship("Timetable", back_populates="school", cascade="all, delete-orphan")


class WorkingDay(Base):
    __tablename__ = "working_days"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    day_name = Column(String, nullable=False)  # Monday, Tuesday, ...
    is_half_day = Column(Boolean, default=False)
    day_order = Column(Integer, nullable=False)

    school = relationship("School", back_populates="working_days")


class Period(Base):
    __tablename__ = "periods"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    period_number = Column(Integer, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    label = Column(String)  # e.g. "Period 1", "Assembly"

    school = relationship("School", back_populates="periods")


class Break(Base):
    __tablename__ = "breaks"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)  # Lunch, Short Break
    after_period = Column(Integer, nullable=False)
    duration_minutes = Column(Integer, nullable=False)

    school = relationship("School", back_populates="breaks")
