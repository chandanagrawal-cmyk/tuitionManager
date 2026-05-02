from pydantic import BaseModel
from typing import Optional

class ParentBase(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    receive_calendar_invites: bool = False
    avatar: Optional[str] = None

class ParentCreate(ParentBase):
    pass

class ParentUpdate(ParentBase):
    pass

class ParentOut(ParentBase):
    id: int
    model_config = {"from_attributes": True}
