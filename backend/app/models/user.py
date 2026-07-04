from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class User(Base):
    """An admin account. Every school belongs to the user who created it."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="ADMIN", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    schools = relationship("School", back_populates="owner")
