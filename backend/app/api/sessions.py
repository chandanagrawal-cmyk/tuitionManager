from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.session import Session, SessionStatus
from app.models.session_series import SessionSeries
from app.models.payment import Payment
from app.models.student import Student
from app.models.user import User
from app.schemas.session import SessionCreate, SessionUpdate, SessionOut, SeriesCreate, SeriesUpdate, SeriesOut
from app.schemas.payment import PaymentOut
from app.services import calendar_sync
from typing import List, Optional
from datetime import date as Date, timedelta

router = APIRouter(prefix="/api/sessions", tags=["sessions"], dependencies=[Depends(get_current_user)])

DAYS_AHEAD = 365


def _teacher(user: User) -> str:
    return user.full_name or user.username


def _teacher_name_for_session(session, current_user: User, db: DBSession) -> str:
    if session.teacher_id:
        u = db.query(User).get(session.teacher_id)
        if u: return u.full_name or u.username
    return _teacher(current_user)


def _generate_series_dates(series: SessionSeries, from_date: Date = None):
    start = from_date or series.start_date
    end = series.end_date or (Date.today() + timedelta(days=DAYS_AHEAD))
    current = start
    while current.weekday() != series.day_of_week:
        current += timedelta(days=1)
    while current <= end:
        yield current
        current += timedelta(weeks=1)


# ── Series routes MUST come before /{session_id} ──

@router.get("/series/all", response_model=List[SeriesOut])
def list_series(student_id: Optional[int] = None, db: DBSession = Depends(get_db)):
    q = db.query(SessionSeries)
    if student_id:
        q = q.filter(SessionSeries.student_id == student_id)
    return q.all()


@router.post("/series", response_model=SeriesOut, status_code=201)
def create_series(data: SeriesCreate, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    student = db.query(Student).get(data.student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    series = SessionSeries(**data.model_dump(exclude={'teacher_id'}))
    db.add(series)
    db.flush()
    for d in _generate_series_dates(series):
        db.add(Session(student_id=student.id, series_id=series.id, date=d, time=series.time, notes=series.notes, teacher_id=data.teacher_id))
    db.commit()
    # Send a single recurring calendar invite instead of one per session
    try:
        teacher_name = _teacher_name_for_session(
            db.query(Session).filter(Session.series_id == series.id).first(),
            current_user, db
        )
        recurring_event_id, _ = calendar_sync.create_recurring_event(
            student, series.start_date, series.time,
            series.day_of_week, series.end_date, teacher_name, series.notes
        )
        if recurring_event_id:
            first = db.query(Session).filter(Session.series_id == series.id).order_by(Session.date).first()
            if first:
                first.google_event_id = recurring_event_id
            db.commit()
    except Exception:
        pass
    db.refresh(series)
    return series


@router.put("/series/{series_id}/update-from", status_code=200)
def update_from(series_id: int, from_date: Date, data: SessionUpdate, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update time, notes and teacher on all scheduled sessions in a series from a given date onwards."""
    sessions = db.query(Session).filter(
        Session.series_id == series_id,
        Session.date >= from_date,
        Session.status == SessionStatus.scheduled,
    ).all()
    for s in sessions:
        if data.time is not None: s.time = data.time
        if data.notes is not None: s.notes = data.notes
        if data.teacher_id is not None: s.teacher_id = data.teacher_id
    db.commit()
    return {"updated": len(sessions)}


@router.put("/series/{series_id}", response_model=SeriesOut)
def update_series(series_id: int, data: SeriesUpdate, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    series = db.query(SessionSeries).get(series_id)
    if not series:
        raise HTTPException(404, "Series not found")
    student = db.query(Student).get(series.student_id)
    today = Date.today()
    for s in db.query(Session).filter(Session.series_id == series_id, Session.date >= today).all():
        calendar_sync.delete_event(s.google_event_id)
        db.delete(s)
    db.flush()
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(series, k, v)
    db.flush()
    for d in _generate_series_dates(series, from_date=Date.today()):
        db.add(Session(student_id=student.id, series_id=series.id, date=d, time=series.time, notes=series.notes))
    db.commit()
    try:
        for s in db.query(Session).filter(Session.series_id == series.id, Session.date >= today).all():
            event_id, _ = calendar_sync.create_event(student, s.date, s.time, _teacher(current_user), s.notes)
            if event_id:
                s.google_event_id = event_id
        db.commit()
    except Exception:
        pass
    db.refresh(series)
    return series


@router.delete("/series/{series_id}", status_code=204)
def delete_series(series_id: int, future_only: bool = True, db: DBSession = Depends(get_db)):
    series = db.query(SessionSeries).get(series_id)
    if not series:
        raise HTTPException(404, "Series not found")
    today = Date.today()
    q = db.query(Session).filter(Session.series_id == series_id)
    if future_only:
        q = q.filter(Session.date >= today)
    for s in q.all():
        calendar_sync.delete_event(s.google_event_id)
        db.delete(s)
    db.flush()
    if not future_only:
        db.delete(series)
    db.commit()


@router.post("/series/{series_id}/cancel-from", status_code=200)
def cancel_from(series_id: int, from_date: Date, db: DBSession = Depends(get_db)):
    sessions = db.query(Session).filter(
        Session.series_id == series_id,
        Session.date >= from_date,
        Session.status == SessionStatus.scheduled,
    ).all()
    for s in sessions:
        s.status = SessionStatus.cancelled
    db.commit()
    return {"cancelled": len(sessions)}


@router.post("/backfill-payments", status_code=200)
def backfill_payments(db: DBSession = Depends(get_db)):
    completed = db.query(Session).filter(Session.status == SessionStatus.completed).all()
    created = 0
    for session in completed:
        if not session.payment:
            student = db.query(Student).get(session.student_id)
            db.add(Payment(session_id=session.id, amount=student.fee_per_session))
            created += 1
    db.commit()
    return {"created": created}


@router.post("/sync-rsvp", status_code=200)
def trigger_rsvp_sync(_: User = Depends(get_current_user)):
    """Synchronously sync RSVP from Google Calendar."""
    from app.services.rsvp_sync import sync_rsvp
    sync_rsvp()
    return {"ok": True}


@router.delete("/all", status_code=200)
def delete_all_sessions(student_id: int, db: DBSession = Depends(get_db)):
    """Delete ALL sessions and series for a specific student."""
    sessions = db.query(Session).filter(Session.student_id == student_id).all()
    count = len(sessions)
    for s in sessions:
        try: calendar_sync.delete_event(s.google_event_id)
        except Exception: pass
        db.delete(s)
    db.query(SessionSeries).filter(SessionSeries.student_id == student_id).delete(synchronize_session=False)
    db.commit()
    return {"deleted": count}


# ── Individual Sessions ──

@router.get("", response_model=List[SessionOut])
def list_sessions(student_id: Optional[int] = None, start_date: Optional[Date] = None, end_date: Optional[Date] = None, db: DBSession = Depends(get_db)):
    q = db.query(Session)
    if student_id:
        q = q.filter(Session.student_id == student_id)
    if start_date:
        q = q.filter(Session.date >= start_date)
    if end_date:
        q = q.filter(Session.date <= end_date)
    sessions = q.order_by(Session.date, Session.time).all()
    result = []
    for s in sessions:
        d = SessionOut.model_validate(s)
        if s.payment:
            d.payment_status = s.payment.status
            d.payment_id = s.payment.id
        d.charge_status = s.charge_status
        d.rsvp_status = s.rsvp_status
        result.append(d)
    return result


@router.post("", response_model=SessionOut, status_code=201)
def create_session(data: SessionCreate, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    student = db.query(Student).get(data.student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    session = Session(**data.model_dump())
    if not session.teacher_id:
        session.teacher_id = current_user.id
    db.add(session)
    db.flush()
    event_id, _ = calendar_sync.create_event(student, session.date, session.time, _teacher_name_for_session(session, current_user, db), session.notes)
    session.google_event_id = event_id
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: int, db: DBSession = Depends(get_db)):
    session = db.query(Session).get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@router.put("/{session_id}", response_model=SessionOut)
def update_session(session_id: int, data: SessionUpdate, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(Session).get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(session, k, v)
    db.flush()
    if session.status == SessionStatus.completed and not session.payment:
        student = db.query(Student).get(session.student_id)
        db.add(Payment(session_id=session.id, amount=student.fee_per_session))
    db.commit()
    db.refresh(session)
    try:
        calendar_sync.update_event(session.google_event_id, session.student, session.date, session.time, _teacher_name_for_session(session, current_user, db), session.notes)
    except Exception:
        pass
    return session


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: int, db: DBSession = Depends(get_db)):
    session = db.query(Session).get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    try:
        calendar_sync.delete_event(session.google_event_id)
    except Exception:
        pass
    db.delete(session)
    db.commit()


@router.get("/{session_id}/payment", response_model=PaymentOut)
def get_session_payment(session_id: int, db: DBSession = Depends(get_db)):
    session = db.query(Session).get(session_id)
    if not session or not session.payment:
        raise HTTPException(404, "No payment record for this session")
    return session.payment
