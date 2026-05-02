from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.lump_sum_payment import LumpSumPayment
from app.schemas.lump_sum_payment import LumpSumCreate, LumpSumUpdate, LumpSumOut
from typing import List

router = APIRouter(prefix="/api/lump-sum-payments", tags=["lump-sum-payments"], dependencies=[Depends(get_current_user)])

@router.get("", response_model=List[LumpSumOut])
def list_lump_sums(db: Session = Depends(get_db)):
    return db.query(LumpSumPayment).order_by(LumpSumPayment.payment_date.desc()).all()

@router.post("", response_model=LumpSumOut)
def create_lump_sum(data: LumpSumCreate, db: Session = Depends(get_db)):
    payment = LumpSumPayment(**data.model_dump())
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment

@router.put("/{payment_id}", response_model=LumpSumOut)
def update_lump_sum(payment_id: int, data: LumpSumUpdate, db: Session = Depends(get_db)):
    payment = db.query(LumpSumPayment).get(payment_id)
    if not payment:
        raise HTTPException(404, "Payment not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(payment, k, v)
    db.commit()
    db.refresh(payment)
    return payment

@router.delete("/{payment_id}")
def delete_lump_sum(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(LumpSumPayment).get(payment_id)
    if not payment:
        raise HTTPException(404, "Payment not found")
    db.delete(payment)
    db.commit()
    return {"ok": True}
