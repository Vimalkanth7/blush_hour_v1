from datetime import datetime
from typing import Optional

from beanie import Document, PydanticObjectId
from pydantic import Field
from pymongo import IndexModel


class UserBlock(Document):
    blocker_user_id: PydanticObjectId
    blocked_user_id: PydanticObjectId
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "user_blocks"
        indexes = [
            IndexModel([("blocker_user_id", 1), ("blocked_user_id", 1)], unique=True),
            "blocker_user_id",
            "blocked_user_id",
            "created_at",
        ]


class UserMute(Document):
    muter_user_id: PydanticObjectId
    muted_user_id: PydanticObjectId
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "user_mutes"
        indexes = [
            IndexModel([("muter_user_id", 1), ("muted_user_id", 1)], unique=True),
            "muter_user_id",
            "muted_user_id",
            "created_at",
        ]


class UserReport(Document):
    reporter_user_id: PydanticObjectId
    reported_user_id: PydanticObjectId
    room_id: Optional[str] = None
    category: str
    details: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "user_reports"
        indexes = [
            "reporter_user_id",
            "reported_user_id",
            "room_id",
            "category",
            "created_at",
        ]
