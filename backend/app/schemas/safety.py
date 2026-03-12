from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

ReportCategory = Literal[
    "harassment",
    "spam",
    "hate_speech",
    "nudity",
    "underage",
    "scam",
    "other",
]


class _TargetUserRequest(BaseModel):
    target_user_id: str = Field(..., min_length=1)

    @field_validator("target_user_id")
    @classmethod
    def normalize_target_user_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("target_user_id is required")
        return normalized


class BlockRequest(_TargetUserRequest):
    reason: Optional[str] = None


class MuteRequest(_TargetUserRequest):
    pass


class ReportRequest(_TargetUserRequest):
    category: ReportCategory
    room_id: Optional[str] = None
    details: Optional[str] = None

    @field_validator("room_id", "details")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class StatusOKResponse(BaseModel):
    status: Literal["ok"] = "ok"


class BlockListItem(BaseModel):
    target_user_id: str
    created_at: datetime


class BlockListResponse(BaseModel):
    blocks: list[BlockListItem]


class MuteListItem(BaseModel):
    target_user_id: str
    created_at: datetime


class MuteListResponse(BaseModel):
    mutes: list[MuteListItem]
