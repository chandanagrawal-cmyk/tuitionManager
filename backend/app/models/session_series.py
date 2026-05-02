from sqlalchemy import Column, Integer, String, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class SessionSeries(Base):
    __tablename__ = "session_series"
    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)   # 0=Mon … 6=Sun
    time = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    notes = Column(String)
    student = relationship("Student", back_populates="series")
    sessions = relationship("Session", back_populates="series", cascade="all, delete-orphan")
