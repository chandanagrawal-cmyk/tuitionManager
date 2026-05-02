from sqlalchemy import Column, Integer, String, Boolean, Enum
from app.core.database import Base
import enum

class Role(str, enum.Enum):
    admin = "admin"
    teacher = "teacher"
    ledger_keeper = "ledger_keeper"
    receptionist = "receptionist"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    role = Column(Enum(Role), nullable=False, server_default="teacher")
    theme = Column(String, nullable=True, default='violet')
