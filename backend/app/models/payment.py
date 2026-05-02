from sqlalchemy import Column, Integer, Float, String, Date, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class PaymentStatus(str, enum.Enum):
    pending = "pending"
    received = "received"

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False, unique=True)
    amount = Column(Float, nullable=False)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.pending)
    received_date = Column(Date, nullable=True)
    notes = Column(String)
    lump_sum_id = Column(Integer, ForeignKey("lump_sum_payments.id", ondelete="SET NULL"), nullable=True)
    session = relationship("Session", back_populates="payment")
