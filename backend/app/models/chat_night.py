from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional, List

class ChatNightPass(Document):
    user_id: str = Field(..., index=True)
    date_ist: str # YYYY-MM-DD
    passes_total: int
    passes_used: int = 0
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "chat_night_passes"
        indexes = [
            [("user_id", 1), ("date_ist", 1)] # Composite index for lookup
        ]

class ChatNightRoom(Document):
    room_id: str = Field(..., unique=True)
    male_user_id: str
    female_user_id: str
    starts_at: datetime
    ends_at: datetime
    state: str = "active" # active, ended, engaged
    
    engage_male: bool = False
    engage_female: bool = False
    engaged_at: Optional[datetime] = None

    class Settings:
        name = "chat_night_rooms"
        indexes = [
            "starts_at",
            "male_user_id",
            "female_user_id"
        ]

class MatchUnlocked(Document):
    user_ids: List[str]
    source: str = "chat_night"
    room_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "matches_unlocked"
        indexes = [
            "room_id",
            "user_ids"
        ]


class ChatNightIcebreakers(Document):
    room_id: str = Field(..., unique=True)
    reasons: List[str] = Field(default_factory=list)
    icebreakers: List[str] = Field(default_factory=list)
    model: str = "none"
    provider_requested: str = "none"
    context_hash: Optional[str] = None
    requester_user_id: Optional[str] = None
    participant_user_ids: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    openai_attempted_at: Optional[datetime] = None
    openai_attempt_count: int = 0

    class Settings:
        name = "chat_night_icebreakers"
        indexes = [
            "created_at",
            "updated_at",
            "openai_attempted_at",
            [("provider_requested", 1), ("openai_attempted_at", -1)],
            [("requester_user_id", 1), ("openai_attempted_at", -1)],
        ]
