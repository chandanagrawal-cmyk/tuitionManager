from sqlalchemy import Column, Integer, Float, String, Date, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.payment import PaymentStatus

class LumpSumPayment(Base):
    __tablename__ = "lump_sum_payments"
    id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payment_date = Column(Date, nullable=False)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.received)
    notes = Column(String)
    student = relationship("Student")
