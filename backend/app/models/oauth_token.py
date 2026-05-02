from sqlalchemy import Column, Integer, String
from app.core.database import Base

class OAuthToken(Base):
    __tablename__ = "oauth_tokens"
    id = Column(Integer, primary_key=True)
    provider = Column(String, nullable=False, unique=True)  # e.g. "google"
    token_json = Column(String, nullable=False)
