from pydantic import BaseModel
from app.models.user import Role

class UserCreate(BaseModel):
    username: str
    password: str
    email: str | None = None
    full_name: str | None = None
    role: Role = Role.teacher

class UserUpdate(BaseModel):
    password: str | None = None
    email: str | None = None
    full_name: str | None = None
    role: Role | None = None
    is_active: bool | None = None
    theme: str | None = None

class UserOut(BaseModel):
    id: int
    username: str
    email: str | None = None
    full_name: str | None = None
    is_active: bool
    role: Role
    theme: str | None = 'violet'
    model_config = {"from_attributes": True}

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
