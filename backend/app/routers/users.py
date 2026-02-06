from fastapi import APIRouter, Body, HTTPException, Depends
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.schemas.user import UserRead
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime
import os

router = APIRouter()

class UserProfileUpdate(BaseModel):
    firstName: Optional[str] = None
    birthday: Optional[str] = None # ISO format
    gender: Optional[str] = None
    showGender: Optional[bool] = None
    datingPreference: Optional[str] = None
    mode: Optional[str] = None
    intention: Optional[str] = None
    height: Optional[str] = None
    exercise: Optional[str] = None
    education: Optional[str] = None
    educationLevel: Optional[str] = None
    work: Optional[str] = None
    location: Optional[str] = None
    hometown: Optional[str] = None
    kidsHave: Optional[str] = None
    kidsWant: Optional[str] = None
    starSign: Optional[str] = None
    drinking: Optional[str] = None
    smoking: Optional[str] = None
    kids: Optional[str] = None
    interests: Optional[List[str]] = None
    values: Optional[List[str]] = None
    causes: Optional[List[str]] = None
    religion: Optional[str] = None
    politics: Optional[str] = None
    prompts: Optional[List[Dict[str, str]]] = None 
    bio: Optional[str] = None
    photos: Optional[List[Optional[str]]] = None 

from app.services.profile_scoring import compute_profile_strength
from app.schemas.user import ProfileStrength

@router.get("/me", response_model=UserRead)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    strength = compute_profile_strength(current_user)
    
    # We must construct the model manually or rely on from_attributes, 
    # but since 'profile_strength' is not on the Document, we explicitly set it.
    
    # 1. Convert DB model to dict or copy
    user_dict = current_user.dict()
    
    # 2. Add properties manually if not in dict
    user_dict["profile_completion"] = strength["completion_percent"]
    user_dict["profile_strength"] = ProfileStrength(**strength)
    
    # 3. Create UserRead (Validation will happen automatically)
    return UserRead(**user_dict)

@router.patch("/me", response_model=UserRead)
async def update_my_profile(
    data: UserProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    if data.firstName is not None:
        current_user.first_name = data.firstName
    
    if data.birthday:
        try:
             current_user.birth_date = datetime.fromisoformat(data.birthday.replace('Z', '+00:00'))
        except:
            pass 
            
    if data.gender is not None:
        current_user.gender = data.gender
        
    if data.showGender is not None:
        current_user.show_gender = data.showGender
        
    if data.datingPreference is not None:
        current_user.dating_preference = data.datingPreference
        
    if data.mode is not None:
        current_user.dating_mode = data.mode
        
    if data.intention is not None:
        current_user.intentions = data.intention
        
    if data.height is not None:
        current_user.height = data.height
        
    if data.education is not None:
        current_user.education = data.education
        
    if data.educationLevel is not None:
        current_user.education_level = data.educationLevel
        
    if data.work is not None:
        current_user.work = data.work
        
    if data.location is not None:
        current_user.location = data.location
        
    if data.hometown is not None:
        current_user.hometown = data.hometown
        
    if data.kidsHave is not None:
        current_user.kids_have = data.kidsHave
        
    if data.kidsWant is not None:
        current_user.kids_want = data.kidsWant
        
    if data.starSign is not None:
        current_user.star_sign = data.starSign
    
    # Handle habits update (merging or overwriting)
    new_habits = current_user.habits or {}
    if data.exercise is not None: new_habits["exercise"] = data.exercise
    if data.drinking is not None: new_habits["drinking"] = data.drinking
    if data.smoking is not None: new_habits["smoking"] = data.smoking
    if data.kids is not None: new_habits["kids"] = data.kids
    current_user.habits = new_habits

    if data.interests is not None:
        current_user.interests = data.interests
        
    if data.values is not None:
        current_user.values = data.values
        
    if data.causes is not None:
        current_user.causes = data.causes
        
    if data.religion is not None:
        current_user.religion = data.religion
        
    if data.politics is not None:
        current_user.politics = data.politics
        
    if data.prompts is not None:
        current_user.prompts = data.prompts
        
    if data.bio is not None:
        current_user.bio = data.bio

    if data.photos is not None:
        current_user.photos = [p for p in data.photos if p is not None]

    # VALIDATION LOGIC
    REQUIRED_PHOTOS = 4
    
    # Check if basic info is present
    has_basic_info = bool(
        current_user.first_name and 
        current_user.birth_date and 
        current_user.gender
    )
    
    # Check photos
    photo_count = len(current_user.photos) if current_user.photos else 0
    has_photos = photo_count >= REQUIRED_PHOTOS
    
    # Check bypass
    # os.getenv returns string, we check for 'true'
    dev_bypass = os.getenv("DEV_BYPASS_PHOTOS", "false").lower() == "true"
    
    # Determine completion status
    if has_basic_info and (has_photos or dev_bypass):
        current_user.onboarding_completed = True
    else:
        # If criteria are not met, ensure it is False
        current_user.onboarding_completed = False
        
    await current_user.save()
    return current_user
