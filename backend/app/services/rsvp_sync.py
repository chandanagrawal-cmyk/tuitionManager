from app.services.calendar_sync import _service
from app.core.database import SessionLocal
from app.models.session import Session
from datetime import date, timedelta


def sync_rsvp():
    """Poll Google Calendar for RSVP — only next 14 days to stay within rate limits."""
    svc = _service()
    if not svc:
        return

    db = SessionLocal()
    try:
        today = date.today()
        window = today + timedelta(days=14)

        sessions = db.query(Session).filter(
            Session.google_event_id.isnot(None),
            Session.date >= today,
            Session.date <= window,
            Session.status == 'scheduled',
        ).all()

        if not sessions:
            return

        seen = {}
        for s in sessions:
            seen.setdefault(s.google_event_id, []).append(s)

        rsvp_map = {}

        for i in range(0, len(seen), 50):
            chunk = list(seen.keys())[i:i + 50]
            batch = svc.new_batch_http_request()

            for eid in chunk:
                def make_callback(captured_eid):
                    def callback(request_id, response, exception):
                        if exception or not response:
                            return
                        for attendee in response.get('attendees', []):
                            if not attendee.get('organizer'):
                                rsvp_map[captured_eid] = attendee.get('responseStatus')
                                return
                    return callback

                batch.add(
                    svc.events().get(calendarId='primary', eventId=eid),
                    callback=make_callback(eid)
                )

            try:
                batch.execute()
            except Exception:
                pass

        for event_id, status in rsvp_map.items():
            for s in seen.get(event_id, []):
                s.rsvp_status = status

        db.commit()
    finally:
        db.close()
