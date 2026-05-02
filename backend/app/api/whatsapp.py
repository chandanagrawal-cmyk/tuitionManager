from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.message import Message, MessageDirection
from pydantic import BaseModel
from typing import Optional
import httpx, datetime, os

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])

WA_SERVICE = os.getenv("WA_SERVICE_URL", "http://whatsapp:3001")


def _normalise(number: str) -> str:
    n = number.split('@')[0]  # strip @c.us, @s.whatsapp.net, @lid etc
    n = n.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if n.startswith("+"):
        return n[1:]
    if n.startswith("44"):
        return n
    if n.startswith("0"):
        return "44" + n[1:]
    return "44" + n


class SendRequest(BaseModel):
    number: str
    message: str
    contact_name: Optional[str] = None


class MessageOut(BaseModel):
    id: int
    contact_number: str
    contact_name: Optional[str]
    direction: MessageDirection
    body: str
    timestamp: datetime.datetime
    model_config = {"from_attributes": True}


@router.get("/status")
def wa_status(_: str = Depends(get_current_user)):
    try:
        r = httpx.get(f"{WA_SERVICE}/status", timeout=3)
        return r.json()
    except Exception:
        return {"status": "disconnected"}


@router.get("/qr")
def wa_qr(_: str = Depends(get_current_user)):
    try:
        r = httpx.get(f"{WA_SERVICE}/qr", timeout=5)
        if r.status_code == 404:
            raise HTTPException(404, "No QR available")
        return r.json()
    except httpx.RequestError:
        raise HTTPException(503, "WhatsApp service unavailable")


@router.post("/send")
def send_message(data: SendRequest, db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    clean = _normalise(data.number)
    try:
        r = httpx.post(f"{WA_SERVICE}/send", json={"number": clean, "message": data.message}, timeout=10)
        if r.status_code == 503:
            raise HTTPException(503, "WhatsApp not connected — please scan the QR code first")
        if r.status_code != 200:
            detail = r.json().get('error', r.text) if r.content else r.text
            raise HTTPException(502, f"WhatsApp error: {detail}")
    except httpx.RequestError:
        raise HTTPException(503, "WhatsApp service unavailable")

    msg = Message(
        contact_number=clean,
        contact_name=data.contact_name,
        direction=MessageDirection.outbound,
        body=data.message,
        timestamp=datetime.datetime.utcnow(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return MessageOut.model_validate(msg)


@router.post("/receive")
async def receive_message(request: Request, db: Session = Depends(get_db)):
    """Called by the WhatsApp Node service when a message arrives."""
    body = await request.json()
    raw_from = body.get('from') or body.get('from_', '')

    # Skip group messages
    if '@g.us' in raw_from:
        return {"ok": True, "skipped": "group message"}

    # Strip all WhatsApp suffixes (@c.us, @s.whatsapp.net, @lid, etc)
    raw_number = raw_from.split('@')[0]

    # Deduplicate by whatsapp_message_id first
    message_id = body.get('message_id')
    if message_id and db.query(Message).filter(Message.whatsapp_message_id == message_id).first():
        return {"ok": True, "skipped": "duplicate"}

    # Try to match this sender to a known contact via outbound messages.
    # WhatsApp sometimes sends a LID instead of the real phone number for replies,
    # so we look for any outbound message sent around the same time window or
    # fall back to the most recent outbound contact.
    clean = _normalise(raw_number)

    # Check if this normalised number matches any known outbound contact directly
    existing = db.query(Message).filter(
        Message.contact_number == clean,
        Message.contact_name.isnot(None)
    ).first()

    # If no direct match, this is likely a LID — find the most recently messaged contact
    # by checking if there's only one outbound contact (common for tutors with few students)
    if not existing:
        from sqlalchemy import func
        last_outbound = db.query(Message).filter(
            Message.direction == MessageDirection.outbound
        ).order_by(Message.timestamp.desc()).first()
        if last_outbound:
            # Store under the real phone number, not the LID
            clean = last_outbound.contact_number
            existing = last_outbound

    contact_name = existing.contact_name if existing else None

    msg = Message(
        contact_number=clean,
        contact_name=contact_name,
        direction=MessageDirection.inbound,
        body=body.get('body', ''),
        timestamp=datetime.datetime.utcfromtimestamp(body.get('timestamp', datetime.datetime.utcnow().timestamp())),
        whatsapp_message_id=message_id,
    )
    db.add(msg)
    db.commit()
    return {"ok": True}


@router.get("/chat/{number}", response_model=list[MessageOut])
def get_chat(number: str, db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    clean = _normalise(number)
    msgs = db.query(Message).filter(Message.contact_number == clean).order_by(Message.timestamp).all()
    return msgs


@router.get("/contacts")
def list_contacts(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """Return distinct numbers with last message preview."""
    from sqlalchemy import func
    rows = db.query(
        Message.contact_number,
        Message.contact_name,
        func.max(Message.timestamp).label("last_at"),
    ).group_by(Message.contact_number, Message.contact_name).all()
    return [{"number": r.contact_number, "name": r.contact_name, "last_at": r.last_at} for r in rows]


# ── Session persistence (called by Node service, no auth required) ──

@router.post("/session/save")
async def save_wa_session(request: Request, db: Session = Depends(get_db)):
    from app.models.whatsapp_session import WhatsAppSession
    body = await request.json()
    for key, value in body.items():
        row = db.query(WhatsAppSession).filter(WhatsAppSession.key == key).first()
        if row:
            row.value = value
        else:
            db.add(WhatsAppSession(key=key, value=value))
    db.commit()
    return {"ok": True}


@router.get("/session/load")
def load_wa_session(db: Session = Depends(get_db)):
    from app.models.whatsapp_session import WhatsAppSession
    rows = db.query(WhatsAppSession).all()
    return {r.key: r.value for r in rows}
