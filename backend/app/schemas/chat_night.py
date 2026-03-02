from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime

class ChatNightStatus(BaseModel):
    is_open: bool
    date_ist: str
    seconds_until_open: int
    seconds_until_close: int
    passes_total: int
    passes_used: int
    passes_remaining: int
    
    # Explicit Pass Fields (Day 7)
    passes_remaining_today: int
    passes_used_today: int
    passes_total_today: int

    active_room_id: Optional[str] = None
    queue_status: Optional[str] = None # 'queued', 'none'
    
    # Gating / Access Info
    status: str = "open" # 'open', 'closed', 'gated'
    min_completion: Optional[int] = None
    user_completion: Optional[int] = None
    detail: Optional[str] = None

class ChatNightRoomResponse(BaseModel):
    room_id: str
    state: str
    starts_at: datetime
    ends_at: datetime
    seconds_remaining: int
    partner_first_name: str
    partner_photo: Optional[str] = None
    engage_status: str # 'pending', 'accepted', 'waiting_for_partner'
    match_unlocked: bool = False


class ChatNightIcebreakersRequest(BaseModel):
    room_id: str


class ChatNightIcebreakersResponse(BaseModel):
    room_id: str
    reasons: List[str] = Field(default_factory=list)
    icebreakers: List[str] = Field(default_factory=list)
    model: str = "none"
    cached: bool = False


class ChatNightIcebreakerConstraints(BaseModel):
    no_pii: bool = True
    no_exact_location: bool = True
    no_trauma_content: bool = True


class SanitizedPersonContext(BaseModel):
    age_bucket: Optional[str] = None
    interests: List[str] = Field(default_factory=list)
    values: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    habits: Dict[str, str] = Field(default_factory=dict)
    intentions: Optional[str] = None
    prompt_topics: List[str] = Field(default_factory=list)


class SanitizedMatchContext(BaseModel):
    room_id: str
    person_a: SanitizedPersonContext
    person_b: SanitizedPersonContext
    constraints: ChatNightIcebreakerConstraints = Field(default_factory=ChatNightIcebreakerConstraints)
