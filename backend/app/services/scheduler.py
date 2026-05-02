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
        TutorSession.status.in_([SessionStatus.scheduled, SessionStatus.completed])
    ).order_by(TutorSession.time).all()
    
    subject = f"📚 Your Tuition Sessions for Today ({today.strftime('%A, %d %b')})"
    
    html = f"""
    <html>
    <body style="font-family: sans-serif; color: #1f2937;">
        <h2 style="color: #7c3aed;">Good morning, {user.full_name or user.username}! ☕</h2>
        <p>Here is your schedule for today, <b>{today.strftime('%A, %d %B %Y')}</b>:</p>
        <div style="margin: 20px 0;">
    """
    
    if not sessions:
        html += """
        <div style="padding: 20px; text-align: center; background: #f3f4f6; border-radius: 8px; color: #4b5563; border: 1px dashed #d1d5db;">
            <div style="font-size: 2rem; margin-bottom: 10px;">☕</div>
            <b>No sessions scheduled for today.</b><br/>
            Enjoy your free time or use it to catch up on prep!
        </div>
        """
    else:
        for s in sessions:
            student_name = s.student.name if s.student else "Unknown Student"
            status_label = ""
            border_color = "#7c3aed"
            bg_color = "#f9fafb"
            
            if s.status == SessionStatus.completed:
                status_label = '<span style="background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-left: 10px;">COMPLETED</span>'
                border_color = "#10b981"
                bg_color = "#f0fdf4"

            html += f"""
            <div style="padding: 12px; border-left: 4px solid {border_color}; background: {bg_color}; margin-bottom: 10px; border-radius: 0 8px 8px 0;">
                <div style="font-weight: bold; font-size: 1.1rem; color: #111827;">{s.time} — {student_name} {status_label}</div>
                <div style="font-size: 0.9rem; color: #6b7280; margin-top: 4px;">Subject: {s.student.subject if s.student else 'Studies'}</div>
                {f'<div style="font-size: 0.85rem; color: #374151; font-style: italic; margin-top: 4px;">Notes: {s.notes}</div>' if s.notes else ''}
            </div>
            """
        
    html += """
        </div>
        <p style="font-size: 0.8rem; color: #9ca3af; margin-top: 30px;">
            Have a great day teaching! 🎓<br/>
            <i>Tuition Manager</i>
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
