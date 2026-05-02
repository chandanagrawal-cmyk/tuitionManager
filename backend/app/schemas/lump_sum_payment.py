from pydantic import BaseModel
from datetime import date
from app.models.payment import PaymentStatus

class LumpSumCreate(BaseModel):
    student_id: int
    amount: float
    payment_date: date
    notes: str | None = None

class LumpSumUpdate(BaseModel):
    amount: float | None = None
    payment_date: date | None = None
    status: PaymentStatus | None = None
    notes: str | None = None

class LumpSumOut(BaseModel):
    id: int
    student_id: int
    amount: float
    allocated_amount: float
    payment_date: date
    status: PaymentStatus
    notes: str | None = None
    model_config = {"from_attributes": True}
