from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api import auth, parents, students, sessions, payments, lump_sum_payments, calendar, whatsapp
from app.services.scheduler import start_scheduler
import threading, time

import app.models.whatsapp_session
import app.models.oauth_token
import app.models.message
import app.models.user
import app.models.parent
import app.models.student
import app.models.student_parent
import app.models.session_series
import app.models.session
import app.models.payment
import app.models.lump_sum_payment

def seed():
    from app.core.database import SessionLocal
    from app.models.user import User, Role
    from app.core.security import hash_password
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.username == 'admin').first():
            db.add(User(username='admin', hashed_password=hash_password('admin123'), role=Role.admin))
            db.commit()
    finally:
        db.close()

def _rsvp_poller():
    """Background thread: sync RSVP every 2 hours."""
    while True:
        try:
            from app.services.rsvp_sync import sync_rsvp
            sync_rsvp()
        except Exception:
            pass
        time.sleep(7200)  # 2 hours

@asynccontextmanager
async def lifespan(app):
    seed()
    t = threading.Thread(target=_rsvp_poller, daemon=True)
    t.start()
    start_scheduler()
    yield

app = FastAPI(title='Tuition Manager', lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000', 'http://localhost:5173'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth.router)
app.include_router(parents.router)
app.include_router(students.router)
app.include_router(sessions.router)
app.include_router(payments.router)
app.include_router(lump_sum_payments.router)
app.include_router(calendar.router)
app.include_router(whatsapp.router)
