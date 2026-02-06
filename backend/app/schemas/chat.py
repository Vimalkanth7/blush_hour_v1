from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class MessageCreate(BaseModel):
    text: str

class MessageResponse(BaseModel):
    id: str
    sender_id: str
    text: str
    created_at: datetime
    read_at: Optional[datetime] = None

class PartnerSnippet(BaseModel):
    id: str
    first_name: str
    age: Optional[int] = None
    photo_url: Optional[str] = None

class ThreadSnippet(BaseModel):
    thread_id: str
    match_id: str
    partner: PartnerSnippet
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    updated_at: datetime

class ThreadListResponse(BaseModel):
    threads: List[ThreadSnippet]

class MessageListResponse(BaseModel):
    messages: List[MessageResponse]
    next_cursor: Optional[str] = None

class PartnerProfileData(BaseModel):
    id: str
    first_name: str
    gender: Optional[str] = None
    birth_date: Optional[datetime] = None
    age: Optional[int] = None
    photos: List[str] = []
    bio: Optional[str] = None
    prompts: List[dict] = []
    interests: List[str] = []
    values: List[str] = []
    causes: List[str] = []
    habits: dict = {}
    education: Optional[str] = None
    work: Optional[str] = None
    location: Optional[str] = None
    height: Optional[str] = None
    religion: Optional[str] = None
    politics: Optional[str] = None
    created_at: Optional[datetime] = None

class PartnerProfileResponse(BaseModel):
    partner: PartnerProfileData
