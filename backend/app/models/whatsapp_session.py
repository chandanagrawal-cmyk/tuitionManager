from sqlalchemy import Column, Integer, String, Text
from app.core.database import Base

class WhatsAppSession(Base):
    __tablename__ = "whatsapp_session"
    id = Column(Integer, primary_key=True)
    key = Column(String, nullable=False, unique=True)
    value = Column(Text, nullable=False)
