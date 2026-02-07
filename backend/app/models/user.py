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
    
    habits: Optional[dict] = None # { drinking: str, smoking: str, exercise: str, kids: str }
    kids_have: Optional[str] = None # New
    kids_want: Optional[str] = None # New
    star_sign: Optional[str] = None # New
    
    interests: Optional[list[str]] = Field(default_factory=list)
    values: Optional[list[str]] = Field(default_factory=list)
    causes: Optional[list[str]] = None
    religion: Optional[str] = None
    politics: Optional[str] = None
    prompts: Optional[list[dict]] = Field(default_factory=list)
    bio: Optional[str] = None
    photos: Optional[list[str]] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    @property
    def profile_completion(self) -> int:
        score = 0
        # 1. Base (Onboarding) - 50%
        # onboarding_completed implies required fields are set
        if self.onboarding_completed:
            score += 50
        else:
            # Fallback check if onboarding logic changed but flag not set
            base_ok = self.first_name and self.birth_date and self.gender and (self.photos and len(self.photos) >= 4)
            if base_ok: score += 50

        # 2. Bio - 10%
        if self.bio and len(self.bio.strip()) > 0:
            score += 10
            
        # 3. Prompts - 10%
        if self.prompts and len(self.prompts) >= 1:
             score += 10
             
        # 4. Interests/Values/Causes - 10%
        tag_count = (len(self.interests or [])) + (len(self.values or [])) + (len(self.causes or []))
        if tag_count > 0:
            score += 10
            
        # 5. Basics - 10% (Work, Location, Hometown) - relaxed rule: at least 2 present
        basics_count = 0
        if self.work: basics_count += 1
        if self.location: basics_count += 1
        if self.hometown: basics_count += 1
        if basics_count >= 2:
            score += 10
            
        # 6. Details - 10% (Height, Habits, Religion, Politics, Signs, Kids, EduLevel)
        # Require a reasonable subset (e.g. 3)
        details_count = 0
        if self.height: details_count += 1
        if self.star_sign: details_count += 1
        if self.religion: details_count += 1
        if self.politics: details_count += 1
        if self.education_level: details_count += 1
        if self.kids_have or self.kids_want: details_count += 1
        if self.habits: 
            # If habits dict has any real values
            if any(self.habits.values()): details_count += 1
            
        if details_count >= 3:
            score += 10
            
        return min(score, 100)

    class Settings:
        name = "users"
        indexes = [
            "created_at",
            "gender",
            [("phone_number", 1)] # Ensure unique handled by field def, but explicit index good practice
        ]
