from fastapi import APIRouter, Depends
from typing import List
from app.models.user import User
from app.schemas.user import UserDiscoveryRead
from app.auth.dependencies import get_current_user

router = APIRouter()

@router.get("/", response_model=List[UserDiscoveryRead])
async def get_discovery_feed(
    limit: int = 10,
    current_user: User = Depends(get_current_user)
):
    """
    Get discovery feed.
    Filters:
    - Exclude current user
    - Onboarding completed = True
    - Profile completion >= 60 (computed)
    """
    
    # 1. DB Query: Get candidates (excluding self + onboarding completed)
    # We fetch slightly more than limit to account for in-memory completion score filtering
    candidates_buffer = limit * 3 
    
    users = await User.find(
        User.id != current_user.id,
        User.onboarding_completed == True
    ).sort(-User.created_at).limit(candidates_buffer).to_list()
    
    # 2. In-Memory Filter: Profile Completion >= 60
    filtered_users = []
    for u in users:
        if u.profile_completion >= 60:
            filtered_users.append(u)
            if len(filtered_users) >= limit:
                break
                
    return filtered_users
