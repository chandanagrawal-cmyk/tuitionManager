from sqlalchemy import Column, Integer, String, Date, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class SessionStatus(str, enum.Enum):
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"

class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    series_id = Column(Integer, ForeignKey("session_series.id"), nullable=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    charge_status = Column(String, nullable=True)  # None | 'charged' | 'waived'
    rsvp_status = Column(String, nullable=True)    # None | 'accepted' | 'declined' | 'tentative' | 'needsAction'
    date = Column(Date, nullable=False)
    time = Column(String, nullable=False)
    status = Column(Enum(SessionStatus), default=SessionStatus.scheduled)
    notes = Column(String)
    google_event_id = Column(String, nullable=True)
    student = relationship("Student", back_populates="sessions")
    series = relationship("SessionSeries", back_populates="sessions")
    teacher = relationship("User", foreign_keys=[teacher_id])
    payment = relationship("Payment", back_populates="session", uselist=False, cascade="all, delete-orphan")
