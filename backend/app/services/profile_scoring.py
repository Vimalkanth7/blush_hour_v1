from typing import List, Dict, Any
from app.models.user import User

def compute_profile_strength(user: User) -> Dict[str, Any]:
    """
    Computes profile strength score (0-100), missing fields, and tier.
    
    Weights:
    - Photos (>=2): 40%
    - Bio (>=40 chars): 20%
    - Interests (>=3): 15%
    - Prompts (>=2): 15%
    - Basics (gender, dob, location): 10%
    """
    score = 0
    missing = []
    
    # 1. Photos (40%)
    photo_count = len(user.photos) if user.photos else 0
    if photo_count >= 2:
        score += 40
    else:
        missing.append("photos")
        
    # 2. Bio (20%)
    bio_len = len(user.bio) if user.bio else 0
    if bio_len >= 40:
        score += 20
    else:
        missing.append("bio")
        
    # 3. Interests (15%)
    interests_count = len(user.interests) if user.interests else 0
    if interests_count >= 3:
        score += 15
    else:
        missing.append("interests")
        
    # 4. Prompts (15%)
    prompts_count = len(user.prompts) if user.prompts else 0
    if prompts_count >= 2:
        score += 15
    else:
        missing.append("prompts")
        
    # 5. Basics (10%)
    # gender (str), birth_date (datetime), location (str)
    has_gender = bool(user.gender)
    has_dob = bool(user.birth_date)
    has_loc = bool(user.location)
    
    if has_gender and has_dob and has_loc:
        score += 10
    else:
        if not has_gender: missing.append("gender")
        if not has_dob: missing.append("birth_date")
        if not has_loc: missing.append("location")
        
    # Tier Calculation
    tier = "Bronze"
    if score >= 80:
        tier = "Gold"
    elif score >= 50:
        tier = "Silver"
        
    return {
        "completion_percent": score,
        "missing_fields": missing,
        "tier": tier
    }
