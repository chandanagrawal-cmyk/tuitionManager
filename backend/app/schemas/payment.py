from pydantic import BaseModel
from datetime import date
from app.models.payment import PaymentStatus

class PaymentUpdate(BaseModel):
    amount: float | None = None
    status: PaymentStatus | None = None
    received_date: date | None = None
    notes: str | None = None

class PaymentOut(BaseModel):
    id: int
    session_id: int
    amount: float
    status: PaymentStatus
    received_date: date | None = None
    notes: str | None = None
    model_config = {"from_attributes": True}
