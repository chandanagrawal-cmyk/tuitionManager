from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class Parent(Base):
    __tablename__ = "parents"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    phone = Column(String)
    email = Column(String)
    notes = Column(String)
    receive_calendar_invites = Column(Boolean, default=False, nullable=False)
    avatar = Column(String, nullable=True)
    student_links = relationship("StudentParent", back_populates="parent", cascade="all, delete-orphan")
