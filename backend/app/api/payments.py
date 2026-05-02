from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.payment import Payment
from app.models.session import Session as SessionModel
from app.models.student import Student
from app.schemas.payment import PaymentUpdate, PaymentOut
from typing import List

router = APIRouter(prefix="/api/payments", tags=["payments"], dependencies=[Depends(get_current_user)])

@router.post("/charge-cancelled/{session_id}", response_model=PaymentOut, status_code=201)
def charge_cancelled_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(SessionModel).get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.payment:
        raise HTTPException(400, "Payment already exists for this session")
    student = db.query(Student).get(session.student_id)
    payment = Payment(session_id=session.id, amount=student.fee_per_session)
    db.add(payment)
    session.charge_status = 'charged'
    db.commit()
    db.refresh(payment)
    return payment


@router.post("/waive/{session_id}", status_code=200)
def waive_charge(session_id: int, db: Session = Depends(get_db)):
    """Mark a cancelled session as waived — no charge."""
    session = db.query(SessionModel).get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.payment:
        db.delete(session.payment)
    session.charge_status = 'waived'
    db.commit()
    return {"status": "waived"}

@router.get("", response_model=List[PaymentOut])
def list_payments(status: str = None, db: Session = Depends(get_db)):
    q = db.query(Payment)
    if status:
        q = q.filter(Payment.status == status)
    return q.all()

@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).get(payment_id)
    if not payment:
        raise HTTPException(404, "Payment not found")
    return payment

@router.put("/{payment_id}", response_model=PaymentOut)
def update_payment(payment_id: int, data: PaymentUpdate, db: Session = Depends(get_db)):
    payment = db.query(Payment).get(payment_id)
    if not payment:
        raise HTTPException(404, "Payment not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(payment, k, v)
    db.commit()
    db.refresh(payment)
    return payment
