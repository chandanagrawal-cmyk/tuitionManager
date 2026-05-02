from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.payment import Payment, PaymentStatus
from app.models.session import Session as SessionModel, SessionStatus
from app.models.student import Student
from app.schemas.payment import PaymentUpdate, PaymentOut
from app.services.email_service import send_email
from app.core.config import settings
from typing import List
import datetime

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


def _primary_parent_email(student: Student):
    """Return (email, name) for the primary guardian, or (None, None)."""
    for link in student.guardians:
        if link.is_primary:
            return link.parent.email, link.parent.name
    # Fall back to any guardian with an email
    for link in student.guardians:
        if link.parent.email:
            return link.parent.email, link.parent.name
    return None, None


@router.post("/send-reminder/{student_id}")
def send_payment_reminder(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).get(student_id)
    if not student:
        raise HTTPException(404, "Student not found")

    pending = (
        db.query(Payment)
        .join(SessionModel)
        .filter(SessionModel.student_id == student_id, Payment.status == PaymentStatus.pending)
        .order_by(SessionModel.date)
        .all()
    )
    if not pending:
        raise HTTPException(400, "No pending payments for this student")

    email, parent_name = _primary_parent_email(student)
    if not email:
        raise HTTPException(400, "No email address found for this student's guardian")

    total = sum(p.amount for p in pending)
    parent_name = parent_name or "Parent"

    rows = "".join(
        f"<tr><td style='padding:8px 12px;border-bottom:1px solid #f3f4f6;'>"
        f"{p.session.date.strftime('%A, %d %B %Y')}</td>"
        f"<td style='padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;color:#0d9488;'>"
        f"£{p.amount:.2f}</td></tr>"
        for p in pending
    )

    html = f"""
    <html><body style="font-family:sans-serif;color:#1f2937;">
      <h2 style="color:#7c3aed;">Payment Reminder</h2>
      <p>Dear {parent_name},</p>
      <p>This is a friendly reminder that the following tuition sessions for <strong>{student.name}</strong> are outstanding:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:0.85rem;color:#6b7280;">Session Date</th>
            <th style="padding:8px 12px;text-align:right;font-size:0.85rem;color:#6b7280;">Amount</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
        <tfoot>
          <tr style="background:#f9fafb;">
            <td style="padding:10px 12px;font-weight:900;">Total Outstanding</td>
            <td style="padding:10px 12px;text-align:right;font-weight:900;font-size:1.1rem;color:#f59e0b;">£{total:.2f}</td>
          </tr>
        </tfoot>
      </table>
      <p>Please arrange payment at your earliest convenience. If you have any questions, don't hesitate to get in touch.</p>
      <p style="margin-top:24px;">Kind regards</p>
      <p style="font-size:0.8rem;color:#9ca3af;"><i>Tuition Manager</i></p>
    </body></html>
    """

    ok = send_email(email, f"Payment Reminder — {student.name}", html, from_override=settings.SMTP_NOREPLY_FROM or settings.SMTP_FROM)
    if not ok:
        raise HTTPException(500, "Failed to send email")
    return {"sent": True, "to": email, "total": total, "sessions": len(pending)}


@router.post("/{payment_id}/send-receipt")
def send_payment_receipt(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).get(payment_id)
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment.status != PaymentStatus.received:
        raise HTTPException(400, "Payment has not been marked as received yet")

    session = payment.session
    student = session.student
    email, parent_name = _primary_parent_email(student)
    if not email:
        raise HTTPException(400, "No email address found for this student's guardian")

    parent_name = parent_name or "Parent"
    received_date = (payment.received_date or datetime.date.today()).strftime("%A, %d %B %Y")
    session_date = session.date.strftime("%A, %d %B %Y")

    html = f"""
    <html><body style="font-family:sans-serif;color:#1f2937;">
      <h2 style="color:#10b981;">✅ Payment Receipt</h2>
      <p>Dear {parent_name},</p>
      <p>Thank you — we have received your payment for <strong>{student.name}</strong>'s tuition session.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:20px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#6b7280;">Session Date</td><td style="padding:6px 0;font-weight:700;text-align:right;">{session_date}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Subject</td><td style="padding:6px 0;font-weight:700;text-align:right;">{student.subject or 'Tuition'}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Amount Paid</td><td style="padding:6px 0;font-weight:900;font-size:1.1rem;color:#10b981;text-align:right;">£{payment.amount:.2f}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Payment Received</td><td style="padding:6px 0;font-weight:700;text-align:right;">{received_date}</td></tr>
        </table>
      </div>
      <p>Thank you for your prompt payment!</p>
      <p style="margin-top:24px;">Kind regards</p>
      <p style="font-size:0.8rem;color:#9ca3af;"><i>Tuition Manager</i></p>
    </body></html>
    """

    ok = send_email(email, f"Payment Receipt — {student.name} ({session_date})", html, from_override=settings.SMTP_NOREPLY_FROM or settings.SMTP_FROM)
    if not ok:
        raise HTTPException(500, "Failed to send email")
    return {"sent": True, "to": email}


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
