from typing import Dict, Any, TYPE_CHECKING
import os

if TYPE_CHECKING:
    from app.models.user import User

def compute_profile_strength(user: "User") -> Dict[str, Any]:
    """
    Computes profile strength score (0-100), missing fields, and tier.

    Scoring progression:
    - Base: 50 (requires onboarding/base criteria)
    - Bio (>=10 chars): +10
    - Prompts (>=1 valid): +10
    - Basics (work + location): +10
    - Details (>=3 fields): +10
    - Interests (>=3): +10
    """
    score = 0
    missing = []

    def has_text(value: Any) -> bool:
        return isinstance(value, str) and value.strip() != ""

    # 1. Base (50)
    REQUIRED_PHOTOS = 4
    photo_count = len(user.photos) if user.photos else 0
    has_basic_info = bool(
        has_text(user.first_name) and
        user.birth_date and
        has_text(user.gender)
    )
    dev_bypass = os.getenv("DEV_BYPASS_PHOTOS", "false").lower() == "true"
    base_fields_ok = has_basic_info and (photo_count >= REQUIRED_PHOTOS or dev_bypass)
    base_complete = user.onboarding_completed or base_fields_ok
    if base_complete:
        score += 50
    else:
        if not user.onboarding_completed:
            missing.append("onboarding_completed")
        if photo_count < REQUIRED_PHOTOS:
            missing.append("photos")

    # 2. Bio (+10)
    bio_text = (user.bio or "").strip()
    if len(bio_text) >= 10:
        if base_complete:
            score += 10
    else:
        missing.append("bio")
        
    # 3. Prompts (+10)
    has_valid_prompt = False
    for prompt in user.prompts or []:
        if isinstance(prompt, dict):
            question = prompt.get("question")
            answer = prompt.get("answer")
        else:
            question = getattr(prompt, "question", None)
            answer = getattr(prompt, "answer", None)
        if has_text(question) and has_text(answer):
            has_valid_prompt = True
            break
    if has_valid_prompt:
        if base_complete:
            score += 10
    else:
        missing.append("prompts")
        
    # 4. Basics (+10) - work + location
    has_work = has_text(user.work)
    has_loc = has_text(user.location)
    if has_work and has_loc:
        if base_complete:
            score += 10
    else:
        missing.append("basics")

    # 5. Details (+10) - >=3 fields
    details_count = 0
    if has_text(user.education_level): details_count += 1
    if has_text(user.hometown): details_count += 1
    if has_text(user.height): details_count += 1
    if has_text(user.star_sign): details_count += 1
    if has_text(user.religion): details_count += 1
    if has_text(user.politics): details_count += 1
    if has_text(user.kids_have): details_count += 1
    if has_text(user.kids_want): details_count += 1
    if isinstance(user.habits, dict) and any(
        (has_text(v) if isinstance(v, str) else bool(v))
        for v in user.habits.values()
    ):
        details_count += 1
    if details_count >= 3:
        if base_complete:
            score += 10
    else:
        missing.append("details")

    # 6. Interests (+10)
    interests_count = len(user.interests) if user.interests else 0
    if interests_count >= 3:
        if base_complete:
            score += 10
    else:
        missing.append("interests")
        
    # Tier Calculation
    tier = "Bronze"
    if score >= 80:
        tier = "Gold"
    elif score >= 50:
        tier = "Silver"
        
    return {
        "completion_percent": min(score, 100),
        "missing_fields": missing,
        "tier": tier
    }
