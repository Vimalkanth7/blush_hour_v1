import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import anyio
from botocore.exceptions import ClientError
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.core.config import PHOTOS_ALLOWED_TYPES, PHOTOS_MAX_BYTES, settings
from app.models.user import User
from app.schemas.user import UserRead
from app.services.photo_storage import head_object, is_configured, key_from_final_url

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
    habits: Optional[Dict[str, Any]] = None
    interests: Optional[List[str]] = None
    values: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    causes: Optional[List[str]] = None
    religion: Optional[str] = None
    politics: Optional[str] = None
    prompts: Optional[List[Dict[str, str]]] = None 
    bio: Optional[str] = None
    photos: Optional[List[Optional[str]]] = None 

from app.services.profile_scoring import compute_profile_strength
from app.schemas.user import ProfileStrength


async def _validate_updated_photos(photos: List[Optional[str]]) -> List[str]:
    if not settings.BH_PHOTOS_ENABLED:
        raise HTTPException(status_code=503, detail="Photo uploads are disabled.")
    if not is_configured():
        raise HTTPException(status_code=503, detail="Photo storage is not configured.")

    r2_prefix = f"{settings.R2_PUBLIC_BASE_URL}/"
    cleaned = [photo.strip() for photo in photos if photo and photo.strip()]

    for photo_url in cleaned:
        if photo_url.lower().startswith("file://"):
            raise HTTPException(status_code=400, detail="file:// photo URLs are not allowed.")
        if not photo_url.startswith(r2_prefix):
            raise HTTPException(
                status_code=400,
                detail="Photo URL must be under configured R2 public base URL.",
            )

        try:
            key = key_from_final_url(photo_url)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        try:
            metadata = await anyio.to_thread.run_sync(head_object, key)
        except ClientError as exc:
            raise HTTPException(status_code=400, detail="Photo object not found in storage.") from exc
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Could not validate photo object.") from exc

        content_length = int(metadata["content_length"])
        content_type = str(metadata["content_type"]).lower()
        if content_length > PHOTOS_MAX_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Photo exceeds max size of {PHOTOS_MAX_BYTES} bytes.",
            )
        if content_type not in PHOTOS_ALLOWED_TYPES:
            allowed = ", ".join(sorted(PHOTOS_ALLOWED_TYPES))
            raise HTTPException(
                status_code=400,
                detail=f"Photo content type must be one of: {allowed}.",
            )

    return cleaned

def _build_user_read_with_strength(user: User) -> UserRead:
    strength = compute_profile_strength(user)
    if not strength:
        strength = {
            "completion_percent": 0,
            "missing_fields": [],
            "tier": "Bronze",
        }

    user_dict = user.dict()
    user_dict["profile_completion"] = strength.get("completion_percent", 0)
    user_dict["profile_strength"] = ProfileStrength(**strength)
    return UserRead(**user_dict)

@router.get("/me", response_model=UserRead)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return _build_user_read_with_strength(current_user)

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
    
    # Handle habits update (merge dict + legacy fields)
    new_habits = current_user.habits or {}
    if data.habits is not None:
        new_habits.update(data.habits)
    if data.exercise is not None: new_habits["exercise"] = data.exercise
    if data.drinking is not None: new_habits["drinking"] = data.drinking
    if data.smoking is not None: new_habits["smoking"] = data.smoking
    if data.kids is not None: new_habits["kids"] = data.kids
    current_user.habits = new_habits

    if data.interests is not None:
        current_user.interests = data.interests
        
    if data.values is not None:
        current_user.values = data.values

    if data.languages is not None:
        current_user.languages = data.languages
        
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
        current_user.photos = await _validate_updated_photos(data.photos)

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
    return _build_user_read_with_strength(current_user)
