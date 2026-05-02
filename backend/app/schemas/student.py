from pydantic import BaseModel
from typing import List
from app.schemas.parent import ParentOut

class GuardianOut(BaseModel):
    id: int
    parent_id: int
    parent: ParentOut
    relationship_type: str
    is_primary: bool
    model_config = {"from_attributes": True}

class GuardianAdd(BaseModel):
    parent_id: int
    relationship_type: str = "Guardian"
    is_primary: bool = False

class GuardianUpdate(BaseModel):
    relationship_type: str | None = None
    is_primary: bool | None = None

class StudentBase(BaseModel):
    name: str
    subject: str | None = None
    default_day: int
    default_time: str
    fee_per_session: float = 35.00
    phone: str | None = None
    email: str | None = None
    birth_month: int | None = None
    birth_year: int | None = None
    school_year: str | None = None
    avatar: str | None = None

class StudentCreate(StudentBase):
    guardian_name: str | None = None

class StudentUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    default_day: int | None = None
    default_time: str | None = None
    fee_per_session: float | None = None
    phone: str | None = None
    email: str | None = None
    birth_month: int | None = None
    birth_year: int | None = None
    school_year: str | None = None
    avatar: str | None = None

class StudentOut(StudentBase):
    id: int
    guardians: List[GuardianOut] = []
    model_config = {"from_attributes": True}
