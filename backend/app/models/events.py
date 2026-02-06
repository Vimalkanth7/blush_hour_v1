from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional, Dict, Any

class AppEvent(Document):
    event_name: str
    source: str # 'web', 'mobile', 'backend'
    user_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "app_events"
        indexes = [
            "created_at",
            "event_name",
            "user_id"
        ]
