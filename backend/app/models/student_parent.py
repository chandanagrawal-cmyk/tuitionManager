from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

RELATIONSHIPS = ["Mother", "Father", "Sister", "Brother", "Guardian", "Other"]

class StudentParent(Base):
    __tablename__ = "student_parents"
    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("parents.id"), nullable=False)
    relationship_type = Column(String, nullable=False, default="Guardian")
    is_primary = Column(Boolean, default=False, nullable=False)

    student = relationship("Student", back_populates="guardians")
    parent = relationship("Parent", back_populates="student_links")
