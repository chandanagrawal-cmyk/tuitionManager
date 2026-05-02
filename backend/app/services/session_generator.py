from datetime import date, timedelta
from sqlalchemy.orm import Session
from app.models.session import Session as SessionModel
from app.models.student import Student
from app.core.config import settings

def generate_sessions_for_student(db: Session, student: Student):
    today = date.today()
    days_ahead = student.default_day - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    first_session = today + timedelta(days=days_ahead)

    for week in range(settings.SESSION_LOOKAHEAD_WEEKS):
        session_date = first_session + timedelta(weeks=week)
        exists = db.query(SessionModel).filter(
            SessionModel.student_id == student.id,
            SessionModel.date == session_date
        ).first()
        if not exists:
            db.add(SessionModel(student_id=student.id, date=session_date, time=student.default_time))
    db.commit()
