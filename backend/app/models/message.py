from sqlalchemy import Column, Integer, String, DateTime, Enum
from app.core.database import Base
import enum, datetime

class MessageDirection(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True)
    contact_number = Column(String, nullable=False)   # normalised phone number
    contact_name = Column(String)                      # display name at time of send
    direction = Column(Enum(MessageDirection), nullable=False)
    body = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    whatsapp_message_id = Column(String, nullable=True)
