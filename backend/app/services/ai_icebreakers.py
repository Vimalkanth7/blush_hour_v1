from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple
import hashlib
import json
import os
import re

import httpx
from beanie import PydanticObjectId
from pydantic import BaseModel, Field, ValidationError

from app.models.chat_night import ChatNightIcebreakers, ChatNightRoom
from app.models.user import User
from app.schemas.chat_night import SanitizedMatchContext, SanitizedPersonContext


ALLOWED_HABIT_KEYS = ("drinking", "smoking", "exercise", "kids")
EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_PATTERN = re.compile(r"(?:\+?\d[\s\-()]*){7,}")
HANDLE_PATTERN = re.compile(r"(?<!\w)@[A-Za-z0-9_]{2,}")
URL_PATTERN = re.compile(r"(?:https?://|www\.)", re.IGNORECASE)
EXACT_LOCATION_PATTERN = re.compile(
    r"\b\d{1,5}\s+[A-Za-z0-9.\- ]+\s+(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr)\b",
    re.IGNORECASE,
)
BANNED_TOPIC_PATTERNS = [
    re.compile(r"\b(?:self[\s\-]?harm|suicide|kill yourself)\b", re.IGNORECASE),
    re.compile(r"\b(?:trauma|abuse|assault|rape)\b", re.IGNORECASE),
]

OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_PROVIDER = "openai"
MODEL_NONE = "none"
MODEL_FALLBACK = "fallback"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"


class _IcebreakerStructuredOutput(BaseModel):
    reasons: List[str] = Field(min_length=3, max_length=3)
    icebreakers: List[str] = Field(min_length=5, max_length=5)


OPENAI_ICEBREAKERS_JSON_SCHEMA: Dict[str, Any] = {
    "name": "chat_night_icebreakers",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["reasons", "icebreakers"],
        "properties": {
            "reasons": {
                "type": "array",
                "minItems": 3,
                "maxItems": 3,
                "items": {
                    "type": "string",
                    "minLength": 4,
                    "maxLength": 220,
                },
            },
            "icebreakers": {
                "type": "array",
                "minItems": 5,
                "maxItems": 5,
                "items": {
                    "type": "string",
                    "minLength": 4,
                    "maxLength": 220,
                },
            },
        },
    },
}


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


def _contains_exact_location(value: str) -> bool:
    if not value:
        return False
    return bool(EXACT_LOCATION_PATTERN.search(value))


def _contains_banned_topic(value: str) -> bool:
    if not value:
        return False
    return any(pattern.search(value) for pattern in BANNED_TOPIC_PATTERNS)


def _clean_output_line(value: str) -> str:
    return re.sub(r"\s+", " ", _to_text(value)).strip()


def _parse_int_env(name: str, default: int, min_value: int, max_value: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        value = default
    return max(min_value, min(max_value, value))


def _current_provider() -> str:
    return _to_text(os.getenv("CHAT_NIGHT_ICEBREAKERS_PROVIDER", MODEL_NONE)).lower() or MODEL_NONE


def _openai_model() -> str:
    return _to_text(os.getenv("CHAT_NIGHT_ICEBREAKERS_MODEL", DEFAULT_OPENAI_MODEL)) or DEFAULT_OPENAI_MODEL


def _openai_api_key() -> str:
    return _to_text(os.getenv("OPENAI_API_KEY", ""))


def _openai_max_output_tokens() -> int:
    return _parse_int_env(
        "CHAT_NIGHT_ICEBREAKERS_MAX_OUTPUT_TOKENS",
        default=300,
        min_value=100,
        max_value=400,
    )


def _openai_timeout_seconds() -> int:
    return _parse_int_env(
        "CHAT_NIGHT_ICEBREAKERS_TIMEOUT_SECONDS",
        default=15,
        min_value=5,
        max_value=30,
    )


def _openai_max_calls_per_day() -> int:
    return _parse_int_env(
        "CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_DAY",
        default=20,
        min_value=0,
        max_value=5000,
    )


def _openai_max_calls_per_user_per_day() -> int:
    return _parse_int_env(
        "CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_USER_PER_DAY",
        default=20,
        min_value=0,
        max_value=1000,
    )


def _openai_max_calls_per_room() -> int:
    return _parse_int_env(
        "CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_ROOM",
        default=1,
        min_value=0,
        max_value=20,
    )


def _openai_min_seconds_between_calls() -> int:
    return _parse_int_env(
        "CHAT_NIGHT_ICEBREAKERS_MIN_SECONDS_BETWEEN_OPENAI_CALLS",
        default=3,
        min_value=0,
        max_value=120,
    )


def _utc_day_start(value: Optional[datetime] = None) -> datetime:
    now_utc = value or datetime.now(timezone.utc)
    return now_utc.replace(hour=0, minute=0, second=0, microsecond=0)


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


def _hash_sanitized_context(context: SanitizedMatchContext) -> str:
    stable_json = json.dumps(
        context.model_dump(mode="json", exclude_none=True),
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha1(stable_json.encode("utf-8")).hexdigest()


def _validate_output_shape(payload: Any) -> Optional[Dict[str, List[str]]]:
    raw_payload: Any = payload
    if isinstance(raw_payload, str):
        try:
            raw_payload = json.loads(raw_payload)
        except json.JSONDecodeError:
            return None

    try:
        parsed = _IcebreakerStructuredOutput.model_validate(raw_payload)
    except ValidationError:
        return None

    reasons = [_clean_output_line(item) for item in parsed.reasons]
    icebreakers = [_clean_output_line(item) for item in parsed.icebreakers]

    if any(not line for line in reasons + icebreakers):
        return None

    return {
        "reasons": reasons[:3],
        "icebreakers": icebreakers[:5],
    }


def _passes_safety_filters(payload: Dict[str, List[str]]) -> bool:
    lines: List[str] = []
    lines.extend(payload.get("reasons", []))
    lines.extend(payload.get("icebreakers", []))
    for line in lines:
        if (
            _contains_obvious_pii(line)
            or _contains_exact_location(line)
            or _contains_banned_topic(line)
        ):
            return False
    return True


def _safe_deterministic_payload(context: SanitizedMatchContext) -> Dict[str, List[str]]:
    payload = _validate_output_shape(generate_deterministic_icebreakers(context))
    if payload and _passes_safety_filters(payload):
        return payload

    # Last-resort static payload to guarantee contract safety if deterministic generation regresses.
    return {
        "reasons": [
            "Your profiles show enough overlap to make first messages easy to start.",
            "You both shared interests and values that can keep the chat comfortable.",
            "The match context supports a respectful and low-pressure first conversation.",
        ],
        "icebreakers": [
            "What kind of weekend plan helps you reset for the week?",
            "What is one small routine that reliably improves your day?",
            "What topic can you discuss for hours without getting bored?",
            "What is one goal you are currently excited about?",
            "What does a relaxed evening usually look like for you?",
        ],
    }


def _openai_messages(context: SanitizedMatchContext) -> List[Dict[str, str]]:
    sanitized_payload = context.model_dump(mode="json", exclude_none=True)
    serialized_context = json.dumps(sanitized_payload, ensure_ascii=True, sort_keys=True)

    return [
        {
            "role": "system",
            "content": (
                "You generate safe dating-app conversation starters. "
                "Use only the provided sanitized context. "
                "Never include contact info, handles, links, addresses, trauma topics, or explicit sexual content. "
                "Return strict JSON only."
            ),
        },
        {
            "role": "user",
            "content": (
                "Using this sanitized match context, produce exactly 3 concise reasons and exactly 5 concise "
                f"icebreakers as JSON.\nContext: {serialized_context}"
            ),
        },
    ]


def _extract_openai_message_content(data: Dict[str, Any]) -> Optional[Any]:
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        return None

    message = choices[0].get("message")
    if not isinstance(message, dict):
        return None

    parsed = message.get("parsed")
    if isinstance(parsed, dict):
        return parsed

    content = message.get("content")
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts: List[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            text = item.get("text")
            if isinstance(text, str):
                text_parts.append(text)
        if text_parts:
            return "".join(text_parts)
    return None


async def _generate_openai_payload(context: SanitizedMatchContext) -> Optional[Dict[str, List[str]]]:
    api_key = _openai_api_key()
    if not api_key:
        return None

    request_base: Dict[str, Any] = {
        "model": _openai_model(),
        "temperature": 0,
        "messages": _openai_messages(context),
        "response_format": {
            "type": "json_schema",
            "json_schema": OPENAI_ICEBREAKERS_JSON_SCHEMA,
        },
    }

    max_output_tokens = _openai_max_output_tokens()
    request_variants = [
        {**request_base, "max_completion_tokens": max_output_tokens},
        {**request_base, "max_tokens": max_output_tokens},
    ]

    timeout = httpx.Timeout(_openai_timeout_seconds())
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        for req in request_variants:
            try:
                response = await client.post(
                    OPENAI_CHAT_COMPLETIONS_URL,
                    headers=headers,
                    json=req,
                )
            except httpx.HTTPError:
                continue

            if response.status_code >= 400:
                continue

            try:
                body = response.json()
            except ValueError:
                continue

            raw_payload = _extract_openai_message_content(body)
            if raw_payload is None:
                continue

            payload = _validate_output_shape(raw_payload)
            if payload is None:
                continue
            return payload

    return None


def _normalize_user_ids(raw_user_ids: Optional[Sequence[str]]) -> List[str]:
    if not raw_user_ids:
        return []

    normalized: List[str] = []
    seen: set[str] = set()
    for value in raw_user_ids:
        user_id = _to_text(value)
        if not user_id:
            continue
        if user_id in seen:
            continue
        seen.add(user_id)
        normalized.append(user_id)
    return normalized


def _to_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


async def should_call_openai(
    room_id: str,
    requester_user_id: Optional[str],
) -> Tuple[bool, str]:
    room_cap = _openai_max_calls_per_room()
    if room_cap <= 0:
        return False, "room_cap_reached"

    day_start = _utc_day_start()

    try:
        cache_doc = await ChatNightIcebreakers.find_one(ChatNightIcebreakers.room_id == room_id)
        if cache_doc and int(getattr(cache_doc, "openai_attempt_count", 0) or 0) >= room_cap:
            return False, "room_cap_reached"

        max_calls_global = _openai_max_calls_per_day()
        if max_calls_global <= 0:
            return False, "global_daily_cap_reached"

        calls_today = await ChatNightIcebreakers.find(
            ChatNightIcebreakers.provider_requested == OPENAI_PROVIDER,
            ChatNightIcebreakers.openai_attempted_at >= day_start,
        ).count()
        if calls_today >= max_calls_global:
            return False, "global_daily_cap_reached"

        max_calls_per_user = _openai_max_calls_per_user_per_day()
        if max_calls_per_user <= 0:
            return False, "per_user_daily_cap_reached"

        clean_requester = _to_text(requester_user_id)
        if clean_requester:
            user_calls_today = await ChatNightIcebreakers.find(
                ChatNightIcebreakers.requester_user_id == clean_requester,
                ChatNightIcebreakers.openai_attempted_at >= day_start,
            ).count()
            if user_calls_today >= max_calls_per_user:
                return False, "per_user_daily_cap_reached"

        min_seconds_between_calls = _openai_min_seconds_between_calls()
        if min_seconds_between_calls > 0:
            latest_docs = await ChatNightIcebreakers.find(
                ChatNightIcebreakers.provider_requested == OPENAI_PROVIDER,
                ChatNightIcebreakers.openai_attempted_at != None,  # noqa: E711
            ).sort(-ChatNightIcebreakers.openai_attempted_at).limit(1).to_list()
            if latest_docs and latest_docs[0].openai_attempted_at:
                latest_attempt = _to_aware_utc(latest_docs[0].openai_attempted_at)
                elapsed = datetime.now(timezone.utc) - latest_attempt
                if elapsed < timedelta(seconds=min_seconds_between_calls):
                    return False, "global_throttle_active"
    except Exception:
        # Fail-safe: if we cannot validate spend guardrails, avoid spend and fallback.
        return False, "guardrail_check_failed"

    return True, "ok"


async def _persist_cache(
    *,
    room_id: str,
    context_hash: str,
    payload: Dict[str, List[str]],
    model: str,
    provider_requested: str,
    requester_user_id: Optional[str],
    participant_user_ids: Optional[Sequence[str]],
    openai_attempted_at: Optional[datetime],
    openai_attempted: bool,
) -> None:
    now = datetime.now(timezone.utc)
    clean_requester = _to_text(requester_user_id) or None
    normalized_participants = _normalize_user_ids(participant_user_ids)
    cache_doc = await ChatNightIcebreakers.find_one(ChatNightIcebreakers.room_id == room_id)
    if not cache_doc:
        cache_doc = ChatNightIcebreakers(
            room_id=room_id,
            reasons=payload["reasons"],
            icebreakers=payload["icebreakers"],
            model=model,
            provider_requested=provider_requested,
            context_hash=context_hash,
            requester_user_id=clean_requester,
            participant_user_ids=normalized_participants,
            created_at=now,
            updated_at=now,
            openai_attempted_at=openai_attempted_at,
            openai_attempt_count=0,
        )
        try:
            await cache_doc.insert()
        except Exception:
            # Handle concurrent insert race by falling back to a save path.
            cache_doc = await ChatNightIcebreakers.find_one(ChatNightIcebreakers.room_id == room_id)
            if not cache_doc:
                return

    cache_doc.reasons = payload["reasons"]
    cache_doc.icebreakers = payload["icebreakers"]
    cache_doc.model = model
    cache_doc.provider_requested = provider_requested
    cache_doc.context_hash = context_hash
    cache_doc.updated_at = now
    if clean_requester:
        cache_doc.requester_user_id = clean_requester
    if normalized_participants:
        cache_doc.participant_user_ids = normalized_participants
    if openai_attempted:
        cache_doc.openai_attempt_count = int(getattr(cache_doc, "openai_attempt_count", 0) or 0) + 1
    if openai_attempted_at is not None and openai_attempted:
        cache_doc.openai_attempted_at = openai_attempted_at
    await cache_doc.save()


def fallback_icebreakers_response(
    context: SanitizedMatchContext,
    *,
    prefer_fallback: bool,
) -> Tuple[List[str], List[str], str, bool]:
    payload = _safe_deterministic_payload(context)
    model = MODEL_FALLBACK if prefer_fallback else MODEL_NONE
    return payload["reasons"], payload["icebreakers"], model, False


async def generate_icebreakers(
    context: SanitizedMatchContext,
    *,
    requester_user_id: Optional[str] = None,
    participant_user_ids: Optional[Sequence[str]] = None,
) -> Tuple[List[str], List[str], str, bool]:
    """
    Provider-agnostic contract:
    generate_icebreakers(context, requester_user_id?, participant_user_ids?)
    -> (reasons, icebreakers, model, cached)
    """
    provider_requested = _current_provider()
    openai_enabled = provider_requested == OPENAI_PROVIDER and bool(_openai_api_key())
    deterministic_payload = _safe_deterministic_payload(context)

    try:
        context_hash = _hash_sanitized_context(context)
        cached_doc = await ChatNightIcebreakers.find_one(ChatNightIcebreakers.room_id == context.room_id)
        if cached_doc:
            cached_payload = _validate_output_shape(
                {
                    "reasons": cached_doc.reasons,
                    "icebreakers": cached_doc.icebreakers,
                }
            )
            if cached_payload and _passes_safety_filters(cached_payload):
                return (
                    cached_payload["reasons"],
                    cached_payload["icebreakers"],
                    _to_text(cached_doc.model) or MODEL_NONE,
                    True,
                )

            repaired_model = MODEL_FALLBACK if openai_enabled else MODEL_NONE
            try:
                await _persist_cache(
                    room_id=context.room_id,
                    context_hash=context_hash,
                    payload=deterministic_payload,
                    model=repaired_model,
                    provider_requested=provider_requested,
                    requester_user_id=requester_user_id or cached_doc.requester_user_id,
                    participant_user_ids=(
                        participant_user_ids
                        if participant_user_ids is not None
                        else cached_doc.participant_user_ids
                    ),
                    openai_attempted_at=None,
                    openai_attempted=False,
                )
            except Exception:
                pass
            return (
                deterministic_payload["reasons"],
                deterministic_payload["icebreakers"],
                repaired_model,
                True,
            )

        payload = deterministic_payload
        model = MODEL_NONE
        openai_attempted_at: Optional[datetime] = None
        openai_attempted = False

        if openai_enabled:
            allow_openai, _ = await should_call_openai(
                room_id=context.room_id,
                requester_user_id=requester_user_id,
            )
            if not allow_openai:
                model = MODEL_FALLBACK
            else:
                openai_attempted = True
                openai_attempted_at = datetime.now(timezone.utc)
                openai_payload = await _generate_openai_payload(context)
                if openai_payload and _passes_safety_filters(openai_payload):
                    payload = openai_payload
                    model = _openai_model()
                else:
                    model = MODEL_FALLBACK

        if not _passes_safety_filters(payload):
            payload = deterministic_payload
            if openai_enabled:
                model = MODEL_FALLBACK

        try:
            await _persist_cache(
                room_id=context.room_id,
                context_hash=context_hash,
                payload=payload,
                model=model,
                provider_requested=provider_requested,
                requester_user_id=requester_user_id,
                participant_user_ids=participant_user_ids,
                openai_attempted_at=openai_attempted_at,
                openai_attempted=openai_attempted,
            )
        except Exception:
            pass

        return payload["reasons"], payload["icebreakers"], model, False
    except Exception:
        return fallback_icebreakers_response(
            context,
            prefer_fallback=openai_enabled,
        )
