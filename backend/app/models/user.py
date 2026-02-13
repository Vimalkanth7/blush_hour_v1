from typing import Optional
from beanie import Document
from pydantic import Field
from datetime import datetime

class User(Document):
    phone_number: str = Field(..., unique=True)
    password_hash: Optional[str] = None
    first_name: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[datetime] = None
    is_verified: bool = False
    onboarding_completed: bool = False
    profile_version: str = "v1"
    
    # Admin / Safety
    role: str = "user" # 'user', 'admin'
    is_banned: bool = False
    ban_reason: Optional[str] = None
    
    # Onboarding Fields
    show_gender: bool = True
    dating_mode: Optional[str] = None # 'Date' or 'BFF'
    dating_preference: Optional[str] = None # Men, Women, Everyone
    intentions: Optional[str] = None
    height: Optional[str] = None 
    education: Optional[str] = None
    education_level: Optional[str] = None # New
    work: Optional[str] = None # New
    location: Optional[str] = None # New
    hometown: Optional[str] = None # New
    
    habits: Optional[dict] = Field(default_factory=dict) # { drinking: str, smoking: str, exercise: str, kids: str }
    kids_have: Optional[str] = None # New
    kids_want: Optional[str] = None # New
    star_sign: Optional[str] = None # New
    
    interests: Optional[list[str]] = Field(default_factory=list)
    values: Optional[list[str]] = Field(default_factory=list)
    languages: Optional[list[str]] = Field(default_factory=list)
    causes: Optional[list[str]] = None
    religion: Optional[str] = None
    politics: Optional[str] = None
    prompts: Optional[list[dict]] = Field(default_factory=list)
    bio: Optional[str] = None
    photos: Optional[list[str]] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    @property
    def profile_completion(self) -> int:
        from app.services.profile_scoring import compute_profile_strength
        return compute_profile_strength(self)["completion_percent"]

    class Settings:
        name = "users"
        indexes = [
            "created_at",
            "gender",
            [("phone_number", 1)] # Ensure unique handled by field def, but explicit index good practice
        ]
