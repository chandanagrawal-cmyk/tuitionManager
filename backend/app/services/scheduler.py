import asyncio
import datetime
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User
from app.models.session import Session as TutorSession, SessionStatus
from app.models.student import Student
from app.services.email_service import send_email

def send_user_summary(user: User, db: Session):
    today = datetime.date.today()
    sessions = db.query(TutorSession).filter(
        TutorSession.teacher_id == user.id,
        TutorSession.date == today,
        TutorSession.status == SessionStatus.scheduled
    ).order_by(TutorSession.time).all()
    
    if not sessions:
        return False, "No sessions scheduled for today."
        
    subject = f"📚 Your Tuition Sessions for Today ({today.strftime('%A, %d %b')})"
    
    html = f"""
    <html>
    <body style="font-family: sans-serif; color: #1f2937;">
        <h2 style="color: #7c3aed;">Good morning, {user.full_name or user.username}! ☕</h2>
        <p>Here is your schedule for today, <b>{today.strftime('%A, %d %B %Y')}</b>:</p>
        <div style="margin: 20px 0;">
    """
    
    for s in sessions:
        student_name = s.student.name if s.student else "Unknown Student"
        html += f"""
        <div style="padding: 12px; border-left: 4px solid #7c3aed; background: #f9fafb; margin-bottom: 10px; border-radius: 0 8px 8px 0;">
            <div style="font-weight: bold; font-size: 1.1rem; color: #111827;">{s.time} — {student_name}</div>
            <div style="font-size: 0.9rem; color: #6b7280; margin-top: 4px;">Subject: {s.student.subject if s.student else 'Studies'}</div>
            {f'<div style="font-size: 0.85rem; color: #374151; font-style: italic; margin-top: 4px;">Notes: {s.notes}</div>' if s.notes else ''}
        </div>
        """
        
    html += """
        </div>
        <p style="font-size: 0.8rem; color: #9ca3af; margin-top: 30px;">
            Have a great day teaching! 🎓<br/>
            <i>TuitionManager Bot</i>
        </p>
    </body>
    </html>
    """
    
    success = send_email(user.email, subject, html)
    return success, "Email sent successfully." if success else "Failed to send email."

async def send_daily_summaries():
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.email.isnot(None), User.is_active == True).all()
        for user in users:
            send_user_summary(user, db)
    finally:
        db.close()

async def scheduler_loop():
    while True:
        now = datetime.datetime.now()
        # Target time: 06:00 AM
        target = now.replace(hour=6, minute=0, second=0, microsecond=0)
        if now >= target:
            target += datetime.timedelta(days=1)
            
        wait_seconds = (target - now).total_seconds()
        print(f"Scheduler waiting {wait_seconds/3600:.1f} hours until next run at {target}")
        await asyncio.sleep(wait_seconds)
        
        print("Running daily session summaries...")
        await send_daily_summaries()

def start_scheduler():
    asyncio.create_task(scheduler_loop())
