from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from uuid import UUID
from beanie import PydanticObjectId

class ProfileStrength(BaseModel):
    completion_percent: int
    missing_fields: List[str]
    tier: str

class UserRead(BaseModel):
    id: Optional[PydanticObjectId] = Field(alias="_id")
    phone_number: str
    first_name: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[datetime] = None
    is_verified: bool = False
    onboarding_completed: bool = False
    
    show_gender: bool = True
    dating_mode: Optional[str] = None
    dating_preference: Optional[str] = None
    intentions: Optional[str] = None
    height: Optional[str] = None
    education: Optional[str] = None
    education_level: Optional[str] = None
    work: Optional[str] = None
    location: Optional[str] = None
    hometown: Optional[str] = None

    habits: Optional[dict] = None
    kids_have: Optional[str] = None
    kids_want: Optional[str] = None
    star_sign: Optional[str] = None

    interests: Optional[List[str]] = None
    values: Optional[List[str]] = None
    causes: Optional[List[str]] = None
    religion: Optional[str] = None
    politics: Optional[str] = None
    prompts: Optional[List[Dict[str, str]]] = None # Correct type hint based on usage
    bio: Optional[str] = None
    photos: Optional[List[str]] = None
    
    profile_completion: int = 0
    profile_strength: Optional[ProfileStrength] = None
    
    created_at: datetime

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        from_attributes = True

class UserDiscoveryRead(UserRead):
    """
    Schema for users in the discovery feed.
    Currently identical to UserRead but can be optimized later
    to exclude sensitive or heavy fields if needed.
    """
    pass


