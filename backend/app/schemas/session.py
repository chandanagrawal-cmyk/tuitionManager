from pydantic import BaseModel
from datetime import date as Date
from app.models.session import SessionStatus

class SessionBase(BaseModel):
    date: Date
    time: str
    notes: str | None = None

class SessionCreate(SessionBase):
    student_id: int
    series_id: int | None = None
    teacher_id: int | None = None

class SessionUpdate(BaseModel):
    date: Date | None = None
    time: str | None = None
    status: SessionStatus | None = None
    notes: str | None = None
    teacher_id: int | None = None

class SessionOut(SessionBase):
    id: int
    student_id: int
    series_id: int | None = None
    teacher_id: int | None = None
    status: SessionStatus
    google_event_id: str | None = None
    payment_status: str | None = None
    payment_id: int | None = None
    charge_status: str | None = None
    rsvp_status: str | None = None
    model_config = {"from_attributes": True}

class SeriesCreate(BaseModel):
    student_id: int
    day_of_week: int
    time: str
    start_date: Date
    end_date: Date | None = None
    notes: str | None = None
    teacher_id: int | None = None

class SeriesUpdate(BaseModel):
    day_of_week: int | None = None
    time: str | None = None
    end_date: Date | None = None
    notes: str | None = None

class SeriesOut(BaseModel):
    id: int
    student_id: int
    day_of_week: int
    time: str
    start_date: Date
    end_date: Date | None = None
    notes: str | None = None
    model_config = {"from_attributes": True}
