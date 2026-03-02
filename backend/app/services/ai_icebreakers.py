from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple
import hashlib
import re

from beanie import PydanticObjectId

from app.models.chat_night import ChatNightRoom
from app.models.user import User
from app.schemas.chat_night import SanitizedMatchContext, SanitizedPersonContext


ALLOWED_HABIT_KEYS = ("drinking", "smoking", "exercise", "kids")
EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_PATTERN = re.compile(r"(?:\+?\d[\s\-()]*){7,}")
HANDLE_PATTERN = re.compile(r"(?<!\w)@[A-Za-z0-9_]{2,}")
URL_PATTERN = re.compile(r"(?:https?://|www\.)", re.IGNORECASE)


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _contains_obvious_pii(value: str) -> bool:
    if not value:
        return False
    return bool(
        EMAIL_PATTERN.search(value)
        or PHONE_PATTERN.search(value)
        or HANDLE_PATTERN.search(value)
        or URL_PATTERN.search(value)
    )


def _normalize_tag(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", value.strip())
    cleaned = cleaned.replace("_", " ").replace("-", " ")
    return cleaned


def _normalize_list(raw_values: Any, limit: int, max_length: int = 48) -> List[str]:
    if not isinstance(raw_values, list):
        return []

    results: List[str] = []
    seen: set[str] = set()
    for item in raw_values:
        text = _to_text(item)
        if not text:
            continue
        if len(text) > max_length:
            continue
        if _contains_obvious_pii(text):
            continue
        normalized = _normalize_tag(text)
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        results.append(normalized)
        if len(results) >= limit:
            break
    return results


def _normalize_habits(raw_habits: Any) -> Dict[str, str]:
    if not isinstance(raw_habits, dict):
        return {}

    clean_habits: Dict[str, str] = {}
    for key in ALLOWED_HABIT_KEYS:
        text = _to_text(raw_habits.get(key))
        if not text:
            continue
        if len(text) > 32:
            continue
        if _contains_obvious_pii(text):
            continue
        clean_habits[key] = text
    return clean_habits


def _to_birth_date(value: Any) -> Optional[date]:
    if isinstance(value, datetime):
        return value.date()
    return None


def _age_bucket_from_birth_date(value: Any) -> Optional[str]:
    dob = _to_birth_date(value)
    if dob is None:
        return None

    today = datetime.now(timezone.utc).date()
    years = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    if years < 18:
        return None
    if years <= 20:
        return "18-20"
    if years <= 24:
        return "21-24"
    if years <= 29:
        return "25-29"
    if years <= 34:
        return "30-34"
    if years <= 39:
        return "35-39"
    return "40+"


def _extract_prompt_topics(raw_prompts: Any, limit: int = 3) -> List[str]:
    if not isinstance(raw_prompts, list):
        return []

    topics: List[str] = []
    seen: set[str] = set()
    for prompt in raw_prompts:
        question = ""
        answer = ""

        if isinstance(prompt, dict):
            question = _to_text(prompt.get("question"))
            answer = _to_text(prompt.get("answer"))
        else:
            question = _to_text(getattr(prompt, "question", None))
            answer = _to_text(getattr(prompt, "answer", None))

        # Known format in this codebase is {question, answer}.
        if not question or not answer:
            continue
        if len(question) > 100:
            continue
        if _contains_obvious_pii(question):
            continue

        key = question.lower()
        if key in seen:
            continue
        seen.add(key)
        topics.append(question)
        if len(topics) >= limit:
            break
    return topics


def _sanitize_person(user: User) -> SanitizedPersonContext:
    intentions = _to_text(getattr(user, "intentions", None))
    if intentions and (_contains_obvious_pii(intentions) or len(intentions) > 80):
        intentions = ""

    return SanitizedPersonContext(
        age_bucket=_age_bucket_from_birth_date(getattr(user, "birth_date", None)),
        interests=_normalize_list(getattr(user, "interests", []), limit=10),
        values=_normalize_list(getattr(user, "values", []), limit=8),
        languages=_normalize_list(getattr(user, "languages", []), limit=5),
        habits=_normalize_habits(getattr(user, "habits", {})),
        intentions=intentions or None,
        prompt_topics=_extract_prompt_topics(getattr(user, "prompts", []), limit=3),
    )


async def _load_user_from_room_id(user_id: str) -> Optional[User]:
    try:
        return await User.get(PydanticObjectId(user_id))
    except Exception:
        return None


async def build_sanitized_match_context(room: ChatNightRoom) -> SanitizedMatchContext:
    person_a_user = await _load_user_from_room_id(room.male_user_id)
    person_b_user = await _load_user_from_room_id(room.female_user_id)

    if not person_a_user or not person_b_user:
        raise ValueError("Room participants not found")

    return SanitizedMatchContext(
        room_id=room.room_id,
        person_a=_sanitize_person(person_a_user),
        person_b=_sanitize_person(person_b_user),
    )


def _shared_items(a: Sequence[str], b: Sequence[str]) -> List[str]:
    map_a = {item.lower(): item for item in a if item}
    map_b = {item.lower(): item for item in b if item}
    shared_keys = sorted(set(map_a.keys()) & set(map_b.keys()))
    return [map_a.get(key) or map_b[key] for key in shared_keys]


def _shared_habits(
    person_a: SanitizedPersonContext, person_b: SanitizedPersonContext
) -> List[Tuple[str, str]]:
    shared: List[Tuple[str, str]] = []
    for key in ALLOWED_HABIT_KEYS:
        a_val = _to_text(person_a.habits.get(key))
        b_val = _to_text(person_b.habits.get(key))
        if a_val and b_val and a_val.lower() == b_val.lower():
            shared.append((key, a_val))
    return shared


def _join_top(values: Sequence[str], limit: int = 2) -> str:
    sliced = [value for value in values[:limit] if value]
    if not sliced:
        return ""
    if len(sliced) == 1:
        return sliced[0]
    return f"{sliced[0]} and {sliced[1]}"


def _build_reasons(
    shared_interests: List[str],
    shared_values: List[str],
    shared_languages: List[str],
    shared_habits: List[Tuple[str, str]],
    same_intentions: bool,
) -> List[str]:
    reasons: List[str] = []

    if shared_interests:
        reasons.append(
            f"You both enjoy {_join_top(shared_interests)}, so starting the conversation should feel natural."
        )
    else:
        reasons.append(
            "You both shared clear profile interests, so there are easy directions for your first messages."
        )

    if shared_values:
        reasons.append(
            f"You both value {_join_top(shared_values)}, which can make the conversation feel more aligned."
        )
    else:
        reasons.append(
            "Your profiles suggest thoughtful values, which supports a respectful and easy conversation tone."
        )

    if shared_languages:
        reasons.append(
            f"You share {_join_top(shared_languages)} as a language base, which can help the chat flow smoothly."
        )
    elif same_intentions:
        reasons.append(
            "You appear aligned on intentions, so it can be easier to set the tone for a good first conversation."
        )
    elif shared_habits:
        habit_key, _ = shared_habits[0]
        reasons.append(
            f"You match on {habit_key} habits, which gives you practical day-to-day conversation starters."
        )
    else:
        reasons.append(
            "You have enough profile overlap to keep the first conversation light, safe, and low pressure."
        )

    return reasons[:3]


def _build_seed_prompts(
    shared_interests: List[str],
    shared_values: List[str],
    shared_languages: List[str],
    shared_habits: List[Tuple[str, str]],
    same_intentions: bool,
) -> List[str]:
    prompts: List[str] = []

    if shared_interests:
        prompts.append(f"You both listed {shared_interests[0]}. What do you enjoy most about it?")
    if len(shared_interests) > 1:
        prompts.append(f"If you had a free day for {shared_interests[1]}, what would your plan look like?")
    if shared_values:
        prompts.append(
            f"You both value {shared_values[0]}. What is one way that shows up in your daily life?"
        )
    if shared_languages:
        prompts.append(
            f"Since you both know {shared_languages[0]}, what is a word or phrase you really like in it?"
        )
    if shared_habits:
        prompts.append(
            f"You match on {shared_habits[0][0]} habits. What routine around that works best for you?"
        )
    if same_intentions:
        prompts.append(
            "What does a comfortable and enjoyable first conversation usually look like for you?"
        )

    return prompts


def _stable_prompt_catalog(room_id: str) -> List[str]:
    catalog = [
        "What kind of weekend plan helps you reset for the week?",
        "What is one small routine that reliably improves your day?",
        "What topic can you discuss for hours without getting bored?",
        "What is one goal you are currently excited about?",
        "What is one hobby you want to try this year?",
        "What does a relaxed evening usually look like for you?",
        "What type of place do you enjoy exploring on a day off?",
        "What kind of conversation style makes you feel most comfortable?",
    ]
    start = int(hashlib.sha1(room_id.encode("utf-8")).hexdigest(), 16) % len(catalog)
    return catalog[start:] + catalog[:start]


def generate_deterministic_icebreakers(context: SanitizedMatchContext) -> Dict[str, List[str]]:
    shared_interests = _shared_items(context.person_a.interests, context.person_b.interests)
    shared_values = _shared_items(context.person_a.values, context.person_b.values)
    shared_languages = _shared_items(context.person_a.languages, context.person_b.languages)
    shared_habits = _shared_habits(context.person_a, context.person_b)

    a_intentions = _to_text(context.person_a.intentions).lower()
    b_intentions = _to_text(context.person_b.intentions).lower()
    same_intentions = bool(a_intentions and b_intentions and a_intentions == b_intentions)

    reasons = _build_reasons(
        shared_interests=shared_interests,
        shared_values=shared_values,
        shared_languages=shared_languages,
        shared_habits=shared_habits,
        same_intentions=same_intentions,
    )

    icebreakers: List[str] = []
    seen: set[str] = set()

    for prompt in _build_seed_prompts(
        shared_interests=shared_interests,
        shared_values=shared_values,
        shared_languages=shared_languages,
        shared_habits=shared_habits,
        same_intentions=same_intentions,
    ):
        key = prompt.strip().lower()
        if key and key not in seen:
            seen.add(key)
            icebreakers.append(prompt)
        if len(icebreakers) >= 5:
            break

    if len(icebreakers) < 5:
        for prompt in _stable_prompt_catalog(context.room_id):
            key = prompt.strip().lower()
            if key in seen:
                continue
            seen.add(key)
            icebreakers.append(prompt)
            if len(icebreakers) >= 5:
                break

    return {
        "reasons": reasons[:3],
        "icebreakers": icebreakers[:5],
    }
