from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from app.core.config import settings
from app.core.database import get_db, SessionLocal
from app.api.deps import get_current_user
from app.models.session import Session as SessionModel
from app.models.student import Student
from app.models.parent import Parent
from app.models.student_parent import StudentParent
from app.models.oauth_token import OAuthToken
from collections import defaultdict
import datetime, json

router = APIRouter(prefix="/api/calendar", tags=["calendar"])
SCOPES = ["https://www.googleapis.com/auth/calendar"]

# In-memory cache — loaded from DB on first use
_token_cache: dict = {}


def _save_token(creds_dict: dict):
    """Persist token to DB and update in-memory cache."""
    _token_cache["creds"] = creds_dict
    db = SessionLocal()
    try:
        row = db.query(OAuthToken).filter(OAuthToken.provider == "google").first()
        if row:
            row.token_json = json.dumps(creds_dict)
        else:
            db.add(OAuthToken(provider="google", token_json=json.dumps(creds_dict)))
        db.commit()
    finally:
        db.close()


def _load_token() -> dict | None:
    """Load token from cache or DB."""
    if "creds" in _token_cache:
        return _token_cache["creds"]
    db = SessionLocal()
    try:
        row = db.query(OAuthToken).filter(OAuthToken.provider == "google").first()
        if row:
            _token_cache["creds"] = json.loads(row.token_json)
            return _token_cache["creds"]
    finally:
        db.close()
    return None


def _get_credentials() -> Credentials | None:
    """Get valid credentials, refreshing if expired."""
    creds_dict = _load_token()
    if not creds_dict:
        return None
    creds = Credentials(**creds_dict)
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            _save_token({
                "token": creds.token,
                "refresh_token": creds.refresh_token,
                "token_uri": creds.token_uri,
                "client_id": creds.client_id,
                "client_secret": creds.client_secret,
                "scopes": list(creds.scopes),
            })
        except Exception:
            return None
    return creds


def _flow():
    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            }
        },
        scopes=SCOPES,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
    )


@router.get("/auth")
def google_auth(_: str = Depends(get_current_user)):
    flow = _flow()
    auth_url, _ = flow.authorization_url(prompt="consent", access_type="offline")
    return {"auth_url": auth_url}


@router.get("/callback")
def google_callback(code: str):
    flow = _flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    _save_token({
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes),
    })
    return RedirectResponse("http://localhost:5173/calendar-import")


@router.get("/status")
def calendar_status(_: str = Depends(get_current_user)):
    return {"connected": _load_token() is not None}


def _get_service():
    creds = _get_credentials()
    if not creds:
        raise HTTPException(401, "Google Calendar not connected")
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def _fetch_all_events():
    service = _get_service()
    # Fetch last 2 years + next 1 year to catch all recurring sessions
    time_min = (datetime.datetime.utcnow() - datetime.timedelta(days=730)).isoformat() + "Z"
    time_max = (datetime.datetime.utcnow() + datetime.timedelta(days=365)).isoformat() + "Z"
    events = []
    page_token = None
    while True:
        result = service.events().list(
            calendarId="primary",
            timeMin=time_min,
            timeMax=time_max,
            maxResults=2500,
            singleEvents=True,
            orderBy="startTime",
            pageToken=page_token,
        ).execute()
        events.extend(result.get("items", []))
        page_token = result.get("nextPageToken")
        if not page_token:
            break
    return events


def _parse_event(e):
    start_raw = e["start"].get("dateTime", e["start"].get("date", ""))
    end_raw = e["end"].get("dateTime", e["end"].get("date", ""))
    try:
        if "T" in start_raw:
            dt = datetime.datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
            date = dt.date()
            time = dt.strftime("%H:%M")
        else:
            date = datetime.date.fromisoformat(start_raw)
            time = "00:00"
    except Exception:
        return None
    return {
        "id": e["id"],
        "title": e.get("summary", "").strip(),
        "date": date,
        "time": time,
        "recurring_id": e.get("recurringEventId"),
        "start_raw": start_raw,
    }


@router.get("/preview")
def preview_import(_: str = Depends(get_current_user)):
    """
    Detect weekly repeating events and group them by student name.
    Returns a preview of what will be imported.
    """
    raw_events = _fetch_all_events()
    parsed = [p for e in raw_events if (p := _parse_event(e)) and p["title"]]

    # Group by title (student name)
    by_title = defaultdict(list)
    for e in parsed:
        by_title[e["title"]].append(e)

    # Detect weekly repeating: either has recurringEventId OR appears on same weekday multiple times
    weekly_students = []
    for title, evts in by_title.items():
        # Check if any have a recurringEventId
        has_recurring = any(e["recurring_id"] for e in evts)

        # Check manual weekly pattern: same weekday, at least 3 occurrences
        weekday_counts = defaultdict(int)
        for e in evts:
            weekday_counts[e["date"].weekday()] += 1
        is_weekly_pattern = any(c >= 3 for c in weekday_counts.values())

        if has_recurring or is_weekly_pattern:
            # Find the most common weekday and time
            dominant_day = max(weekday_counts, key=weekday_counts.get)
            times = [e["time"] for e in evts if e["date"].weekday() == dominant_day]
            dominant_time = max(set(times), key=times.count) if times else evts[0]["time"]
            day_names = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
            weekly_students.append({
                "student_name": title,
                "session_count": len(evts),
                "default_day": dominant_day,
                "default_day_name": day_names[dominant_day],
                "default_time": dominant_time,
                "events": [{"id": e["id"], "date": str(e["date"]), "time": e["time"]} for e in sorted(evts, key=lambda x: x["date"])],
            })

    weekly_students.sort(key=lambda x: x["student_name"])
    return {"students": weekly_students, "total_events": len(parsed)}


@router.post("/import-all")
def import_all(payload: dict, db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """
    Import only selected students. Google Calendar is master — skips duplicates.
    """
    selected_names = set(payload.get("selected", []))
    raw_events = _fetch_all_events()
    parsed = [p for e in raw_events if (p := _parse_event(e)) and p["title"]]

    by_title = defaultdict(list)
    for e in parsed:
        by_title[e["title"]].append(e)

    results = []
    for title, evts in by_title.items():
        # Only process selected students
        if title not in selected_names:
            continue

        has_recurring = any(e["recurring_id"] for e in evts)
        weekday_counts = defaultdict(int)
        for e in evts:
            weekday_counts[e["date"].weekday()] += 1
        is_weekly_pattern = any(c >= 3 for c in weekday_counts.values())

        if not (has_recurring or is_weekly_pattern):
            continue

        dominant_day = max(weekday_counts, key=weekday_counts.get)
        times = [e["time"] for e in evts if e["date"].weekday() == dominant_day]
        dominant_time = max(set(times), key=times.count) if times else evts[0]["time"]

        # Get or create parent
        parent_name = f"{title}'s Parent"
        parent = db.query(Parent).filter(Parent.name == parent_name).first()
        if not parent:
            parent = Parent(name=parent_name)
            db.add(parent)
            db.flush()

        # Get or create student
        student = db.query(Student).filter(Student.name == title).first()
        if not student:
            student = Student(
                name=title,
                default_day=dominant_day,
                default_time=dominant_time,
                fee_per_session=settings.DEFAULT_SESSION_FEE,
            )
            db.add(student)
            db.flush()
            db.add(StudentParent(student_id=student.id, parent_id=parent.id, relationship_type="Guardian", is_primary=True))
            db.flush()
        else:
            # Update schedule to match calendar
            student.default_day = dominant_day
            student.default_time = dominant_time
            db.flush()

        # Google Calendar is master — delete ALL existing sessions for this student then reimport
        existing = db.query(SessionModel).filter(SessionModel.student_id == student.id).all()
        deleted = len(existing)
        for s in existing:
            db.delete(s)
        db.flush()

        # Import all sessions from calendar
        imported = 0
        for e in evts:
            db.add(SessionModel(
                student_id=student.id,
                date=e["date"],
                time=e["time"],
                google_event_id=e["id"],
                notes="Imported from Google Calendar",
            ))
            imported += 1

        db.commit()
        results.append({
            "student": title,
            "parent": parent_name,
            "imported": imported,
            "deleted": deleted,
        })

    return {"results": results, "total_students": len(results)}
