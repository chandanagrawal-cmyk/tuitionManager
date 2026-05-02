from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.lump_sum_payment import LumpSumPayment
from app.models.payment import Payment, PaymentStatus
from app.models.student import Student
from app.schemas.lump_sum_payment import LumpSumCreate, LumpSumUpdate, LumpSumOut
from typing import List
import datetime

router = APIRouter(prefix="/api/lump-sum-payments", tags=["lump-sum-payments"], dependencies=[Depends(get_current_user)])


class AllocateRequest(BaseModel):
    payment_ids: List[int]


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


@router.post("/allocate/student/{student_id}")
def allocate_for_student(student_id: int, data: AllocateRequest, db: Session = Depends(get_db)):
    payments = db.query(Payment).filter(Payment.id.in_(data.payment_ids)).all()
    if len(payments) != len(data.payment_ids):
        raise HTTPException(400, "One or more payment IDs not found")
    for p in payments:
        if p.session.student_id != student_id:
            raise HTTPException(400, "All payments must belong to this student")
        if p.status != PaymentStatus.pending:
            raise HTTPException(400, f"Payment {p.id} is not pending")

    total_needed = sum(p.amount for p in payments)

    # Available lump sums oldest-first
    lumps = (
        db.query(LumpSumPayment)
        .filter(LumpSumPayment.student_id == student_id)
        .order_by(LumpSumPayment.payment_date)
        .all()
    )
    available_lumps = [l for l in lumps if (l.amount - l.allocated_amount) > 0]
    total_available = sum(l.amount - l.allocated_amount for l in available_lumps)
    if total_needed > total_available:
        raise HTTPException(400, f"Selected sessions total £{total_needed:.2f} but only £{total_available:.2f} is available across all lump sums")

    # Drain lump sums oldest-first, spilling across as needed
    today = datetime.date.today()
    payments_sorted = sorted(payments, key=lambda p: p.session.date)
    used_lumps = {}  # lump_id -> amount_used
    lump_buckets = [[l, l.amount - l.allocated_amount] for l in available_lumps]  # mutable
    bucket_idx = 0

    for p in payments_sorted:
        p.status = PaymentStatus.received
        p.received_date = today
        cost = p.amount
        p.lump_sum_id = lump_buckets[bucket_idx][0].id  # link to whichever lump starts covering it
        while cost > 0 and bucket_idx < len(lump_buckets):
            lump, remaining = lump_buckets[bucket_idx]
            use = min(remaining, cost)
            lump_buckets[bucket_idx][1] -= use
            lump.allocated_amount += use  # persist directly
            used_lumps[lump.id] = used_lumps.get(lump.id, 0) + use
            cost -= use
            if lump_buckets[bucket_idx][1] == 0:
                bucket_idx += 1

    db.commit()

    overall_leftover = sum(r for _, r in lump_buckets)
    return {
        "allocated": len(payments),
        "total_applied": total_needed,
        "leftover": overall_leftover,
    }


@router.post("/{lump_sum_id}/allocate")
def allocate_lump_sum(lump_sum_id: int, data: AllocateRequest, db: Session = Depends(get_db)):
    """Legacy single-lump-sum allocate — kept for compatibility."""
    lump = db.query(LumpSumPayment).get(lump_sum_id)
    if not lump:
        raise HTTPException(404, "Lump sum not found")
    return allocate_for_student(lump.student_id, data, db)
