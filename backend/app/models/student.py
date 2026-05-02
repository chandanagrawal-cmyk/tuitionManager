from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.orm import relationship
from app.core.database import Base

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    subject = Column(String)
    default_day = Column(Integer, nullable=False)
    default_time = Column(String, nullable=False)
    fee_per_session = Column(Float, default=35.00)
    phone = Column(String)
    email = Column(String)
    birth_month = Column(Integer)   # 1-12
    birth_year = Column(Integer)
    school_year = Column(String)    # e.g. "Year 6", "Year 10"
    avatar = Column(String, nullable=True)
    guardians = relationship("StudentParent", back_populates="student", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="student", cascade="all, delete-orphan")
    series = relationship("SessionSeries", back_populates="student", cascade="all, delete-orphan")
