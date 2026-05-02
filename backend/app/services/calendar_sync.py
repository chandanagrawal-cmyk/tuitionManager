from googleapiclient.discovery import build
from app.api.calendar import _get_credentials
import datetime


def _service():
    creds = _get_credentials()
    if not creds:
        return None
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def _primary_guest(student) -> tuple[str | None, str, bool]:
    """Returns (email, parent_name, warn) — warn=True if invites ticked but no email."""
    for link in student.guardians:
        if link.is_primary and link.parent.receive_calendar_invites:
            email = link.parent.email
            name = link.parent.name or 'Parent'
            if not email:
                return None, name, True
            return email, name, False
    return None, 'Parent', False


def _format_reminders(overrides):
    if not overrides: return ""
    lines = []
    for o in sorted(overrides, key=lambda x: x['minutes'], reverse=True):
        mins = o['minutes']
        if mins >= 1440:
            days = mins // 1440
            lines.append(f"{days} day{'s' if days > 1 else ''} in advance")
        elif mins >= 60:
            hours = mins // 60
            lines.append(f"{hours} hour{'s' if hours > 1 else ''} in advance")
        else:
            lines.append(f"{mins} minute{'s' if mins > 1 else ''} in advance")
    
    if len(lines) == 1:
        return f"🔔 You will be reminded {lines[0]}.\n"
    
    reminders_str = ", then ".join(lines[:-1]) + f" and then {lines[-1]}"
    return f"🔔 You will be reminded {len(lines)} times: first {reminders_str}.\n"


def _event_body(student, date, time: str, teacher_name: str = None, notes: str = None, guest_email: str = None, parent_name: str = 'Parent'):
    start_dt = datetime.datetime.combine(date, datetime.time.fromisoformat(time))
    end_dt = start_dt + datetime.timedelta(hours=1)
    subject = student.subject or 'their studies'
    teacher = teacher_name or 'the teacher'
    summary = f"{student.name} — {subject} session"
    description = (
        f"Dear {parent_name},\n\n"
        f"This is a confirmation that a {subject} session for {student.name} "
        f"has been scheduled with {teacher}.\n\n"
        f"📅 Date: {date.strftime('%A, %d %B %Y')}\n"
        f"🕐 Time: {start_dt.strftime('%I:%M %p')}\n"
        f"📚 Subject: {subject}\n"
        f"👨🏫 Teacher: {teacher}\n"
    )
    overrides = [
        {"method": "popup", "minutes": 30},
        {"method": "popup", "minutes": 2880},  # 2 days
    ]
    description += f"\n{_format_reminders(overrides)}"

    if notes:
        description += f"\n📝 Notes: {notes}\n"
    description += f"\nKind regards,\n{teacher}"
    body = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start_dt.isoformat(), "timeZone": "Europe/London"},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": "Europe/London"},
        "reminders": {
            "useDefault": False,
            "overrides": overrides,
        },
    }
    if guest_email:
        body["attendees"] = [{"email": guest_email}]
    return body


def create_recurring_event(student, start_date, time: str, day_of_week: int, end_date=None, teacher_name: str = None, notes: str = None) -> tuple[str | None, bool]:
    """Create a single recurring Google Calendar event with RRULE. Returns (event_id, warn_no_email)."""
    svc = _service()
    if not svc:
        return None, False
    guest_email, parent_name, warn = _primary_guest(student)
    subject = student.subject or 'their studies'
    teacher = teacher_name or 'the teacher'
    day_map = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
    rrule = f"RRULE:FREQ=WEEKLY;BYDAY={day_map[day_of_week]}"
    if end_date:
        rrule += f";UNTIL={end_date.strftime('%Y%m%d')}T235959Z"
    start_dt = datetime.datetime.combine(start_date, datetime.time.fromisoformat(time))
    end_dt = start_dt + datetime.timedelta(hours=1)
    description = (
        f"Dear {parent_name},\n\n"
        f"This is a confirmation that a weekly {subject} session for {student.name} "
        f"has been scheduled with {teacher}.\n\n"
        f"📅 Every {start_date.strftime('%A')} at {start_dt.strftime('%I:%M %p')}\n"
        f"📚 Subject: {subject}\n"
        f"👨🏫 Teacher: {teacher}\n"
        f"🗓️ Starting: {start_date.strftime('%d %B %Y')}\n"
    )
    overrides = [
        {"method": "popup", "minutes": 30},
        {"method": "popup", "minutes": 2880},  # 2 days
    ]
    description += f"\n{_format_reminders(overrides)}"

    if end_date:
        description += f"⏹️ Until: {end_date.strftime('%d %B %Y')}\n"
    if notes:
        description += f"\n📝 Notes: {notes}\n"
    description += f"\nKind regards,\n{teacher}"
    body = {
        "summary": f"{student.name} — {subject} (weekly)",
        "description": description,
        "start": {"dateTime": start_dt.isoformat(), "timeZone": "Europe/London"},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": "Europe/London"},
        "recurrence": [rrule],
        "reminders": {
            "useDefault": False,
            "overrides": overrides,
        },
    }
    if guest_email:
        body["attendees"] = [{"email": guest_email}]
    try:
        event = svc.events().insert(calendarId="primary", body=body, sendUpdates="all" if guest_email else "none").execute()
        return event["id"], warn
    except Exception:
        return None, warn


def create_event(student, date, time: str, teacher_name: str = None, notes: str = None) -> tuple[str | None, bool]:
    """Create a Google Calendar event. Returns (event_id, warn_no_email)."""
    svc = _service()
    if not svc:
        return None, False
    guest_email, parent_name, warn = _primary_guest(student)
    body = _event_body(student, date, time, teacher_name, notes, guest_email, parent_name)
    try:
        event = svc.events().insert(calendarId="primary", body=body, sendUpdates="all" if guest_email else "none").execute()
        return event["id"], warn
    except Exception:
        return None, warn


def update_event(event_id: str, student, date, time: str, teacher_name: str = None, notes: str = None) -> bool:
    """Update an existing Google Calendar event. Returns warn_no_email."""
    svc = _service()
    if not svc or not event_id:
        return False
    guest_email, parent_name, warn = _primary_guest(student)
    body = _event_body(student, date, time, teacher_name, notes, guest_email, parent_name)
    try:
        svc.events().update(calendarId="primary", eventId=event_id, body=body, sendUpdates="all" if guest_email else "none").execute()
    except Exception:
        pass
    return warn


def delete_event(event_id: str) -> None:
    """Delete a Google Calendar event."""
    svc = _service()
    if not svc or not event_id:
        return
    try:
        svc.events().delete(calendarId="primary", eventId=event_id, sendUpdates="all").execute()
    except Exception:
        pass
