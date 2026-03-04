from __future__ import annotations

from contextlib import nullcontext
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from typing import Annotated, Any, Dict, List, Optional, Sequence, Tuple, TypedDict
import hashlib
import json
import os
import re

from beanie import PydanticObjectId
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langsmith.run_helpers import tracing_context
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

from app.models.chat_night import ChatNightIcebreakers, ChatNightRoom
from app.models.user import User
from app.schemas.chat_night import SanitizedMatchContext, SanitizedPersonContext


OUTPUT_REASON_COUNT = 3
OUTPUT_ICEBREAKER_COUNT = 5
OUTPUT_LINE_MIN_LEN = 4
OUTPUT_LINE_MAX_LEN = 220
ALLOWED_HABIT_KEYS = ("drinking", "smoking", "exercise", "kids")
EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_PATTERN = re.compile(r"(?:\+?\d[\s\-()]*){7,}")
HANDLE_PATTERN = re.compile(r"(?<!\w)@[A-Za-z0-9_]{2,}")
URL_PATTERN = re.compile(r"(?:https?://|www\.)", re.IGNORECASE)
EMOJI_PATTERN = re.compile(r"[\U0001F300-\U0001FAFF\U00002600-\U000026FF\U00002700-\U000027BF]")
EXACT_LOCATION_PATTERN = re.compile(
    r"\b\d{1,5}\s+[A-Za-z0-9.\- ]+\s+(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr)\b",
    re.IGNORECASE,
)
BANNED_TOPIC_PATTERNS = [
    re.compile(r"\b(?:self[\s\-]?harm|suicide|kill yourself)\b", re.IGNORECASE),
    re.compile(r"\b(?:trauma|abuse|assault|rape)\b", re.IGNORECASE),
]
BANNED_OUTPUT_PATTERNS = [
    re.compile(r"\b(?:dm me|text me|call me)\b", re.IGNORECASE),
]

OPENAI_PROVIDER = "openai"
MODEL_NONE = "none"
MODEL_FALLBACK = "fallback"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_ICEBREAKERS_PROMPT_VERSION = "w6.5c-2026-03-04"
ICEBREAKERS_PROMPT_VERSION = (
    os.getenv("ICEBREAKERS_PROMPT_VERSION", DEFAULT_ICEBREAKERS_PROMPT_VERSION)
    or DEFAULT_ICEBREAKERS_PROMPT_VERSION
).strip() or DEFAULT_ICEBREAKERS_PROMPT_VERSION
LANGSMITH_TRACING_FLAGS = ("LANGSMITH_TRACING", "LANGCHAIN_TRACING_V2")


OutputLine = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=OUTPUT_LINE_MIN_LEN,
        max_length=OUTPUT_LINE_MAX_LEN,
    ),
]


class _IcebreakerStructuredOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reasons: List[OutputLine] = Field(
        min_length=OUTPUT_REASON_COUNT,
        max_length=OUTPUT_REASON_COUNT,
    )
    icebreakers: List[OutputLine] = Field(
        min_length=OUTPUT_ICEBREAKER_COUNT,
        max_length=OUTPUT_ICEBREAKER_COUNT,
    )


class _IcebreakerFlowState(TypedDict, total=False):
    context: SanitizedMatchContext
    requester_user_id: Optional[str]
    participant_user_ids: Optional[List[str]]
    provider_requested: str
    openai_enabled: bool
    context_hash: str
    deterministic_payload: Dict[str, List[str]]
    payload: Dict[str, List[str]]
    model: str
    cached: bool
    openai_attempted_at: Optional[datetime]
    openai_attempted: bool
    should_call_llm: bool
    should_persist: bool
    persist_requester_user_id: Optional[str]
    persist_participant_user_ids: Optional[List[str]]


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


def contains_pii(text: str) -> bool:
    value = _to_text(text)
    if not value:
        return False
    return bool(EMAIL_PATTERN.search(value) or PHONE_PATTERN.search(value))


def _env_flag_enabled(name: str) -> bool:
    return _to_text(os.getenv(name, "")).lower() in {"1", "true", "yes", "on"}


def _chat_night_test_mode_enabled() -> bool:
    return _env_flag_enabled("CHAT_NIGHT_TEST_MODE")


def _log_trace_skip_warning(reason: str) -> None:
    if _chat_night_test_mode_enabled():
        print(f"[chat-night][icebreakers] tracing skipped: {reason}")


def _trace_payload_has_pii(payload: Any) -> bool:
    try:
        serialized = json.dumps(payload, ensure_ascii=True, sort_keys=True, default=str)
    except Exception:
        serialized = _to_text(payload)
    return contains_pii(serialized)


def _trace_allowed_for_context(
    context: SanitizedMatchContext,
    *,
    stage: str,
) -> bool:
    if not _langsmith_tracing_enabled():
        return False
    if _trace_payload_has_pii(context.model_dump(mode="json", exclude_none=True)):
        _log_trace_skip_warning(f"{stage} payload contains possible PII")
        return False
    return True


def _contains_exact_location(value: str) -> bool:
    if not value:
        return False
    return bool(EXACT_LOCATION_PATTERN.search(value))


def _contains_banned_topic(value: str) -> bool:
    if not value:
        return False
    return any(pattern.search(value) for pattern in BANNED_TOPIC_PATTERNS)


def _contains_banned_output_phrase(value: str) -> bool:
    if not value:
        return False
    return any(pattern.search(value) for pattern in BANNED_OUTPUT_PATTERNS)


def _contains_emoji(value: str) -> bool:
    if not value:
        return False
    return bool(EMOJI_PATTERN.search(value))


def _clean_output_line(value: str) -> str:
    return re.sub(r"\s+", " ", _to_text(value)).strip()


def _is_valid_output_line(value: str) -> bool:
    if not value:
        return False
    if len(value) < OUTPUT_LINE_MIN_LEN or len(value) > OUTPUT_LINE_MAX_LEN:
        return False
    if _contains_emoji(value):
        return False
    return True


def _langsmith_tracing_enabled() -> bool:
    for env_name in LANGSMITH_TRACING_FLAGS:
        raw_value = _to_text(os.getenv(env_name, "")).lower()
        if raw_value in {"1", "true", "yes", "on"}:
            return True
    return False


def _hash_trace_value(value: str) -> str:
    return hashlib.sha1(_to_text(value).encode("utf-8")).hexdigest()[:16]


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


def get_icebreakers_prompt_version() -> str:
    return ICEBREAKERS_PROMPT_VERSION


def _validate_output_shape(payload: Any) -> Optional[Dict[str, List[str]]]:
    raw_payload: Any = payload
    if isinstance(raw_payload, str):
        try:
            raw_payload = json.loads(raw_payload)
        except json.JSONDecodeError:
            return None

    try:
        parsed = (
            raw_payload
            if isinstance(raw_payload, _IcebreakerStructuredOutput)
            else _IcebreakerStructuredOutput.model_validate(raw_payload)
        )
    except ValidationError:
        return None

    reasons = [_clean_output_line(item) for item in parsed.reasons]
    icebreakers = [_clean_output_line(item) for item in parsed.icebreakers]

    if len(reasons) != OUTPUT_REASON_COUNT or len(icebreakers) != OUTPUT_ICEBREAKER_COUNT:
        return None

    normalized_lines = [line.lower() for line in reasons + icebreakers]
    if len(set(normalized_lines)) != len(normalized_lines):
        return None

    if any(not _is_valid_output_line(line) for line in reasons + icebreakers):
        return None

    return {
        "reasons": reasons[:OUTPUT_REASON_COUNT],
        "icebreakers": icebreakers[:OUTPUT_ICEBREAKER_COUNT],
    }


def validate_icebreakers_payload(payload: Any) -> Dict[str, List[str]]:
    validated = _validate_output_shape(payload)
    if validated is None:
        raise ValueError("Invalid icebreakers payload shape")
    return validated


def _passes_safety_filters(payload: Dict[str, List[str]]) -> bool:
    lines: List[str] = []
    lines.extend(payload.get("reasons", []))
    lines.extend(payload.get("icebreakers", []))
    for line in lines:
        if (
            _contains_obvious_pii(line)
            or _contains_exact_location(line)
            or _contains_banned_topic(line)
            or _contains_emoji(line)
            or _contains_banned_output_phrase(line)
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


def _openai_messages(context: SanitizedMatchContext) -> List[Tuple[str, str]]:
    sanitized_payload = context.model_dump(mode="json", exclude_none=True)
    serialized_context = json.dumps(sanitized_payload, ensure_ascii=True, sort_keys=True)

    return [
        (
            "system",
            (
                "You generate safe dating-app conversation starters. "
                "Use only the provided sanitized context. "
                "Never include contact info, handles, links, addresses, trauma topics, explicit sexual content, "
                "or emojis. Keep each line concise and under 220 characters."
            ),
        ),
        (
            "human",
            (
                "Using this sanitized match context, produce exactly 3 concise reasons and exactly 5 concise "
                f"icebreakers as strict JSON.\nContext: {serialized_context}"
            ),
        ),
    ]


def _langsmith_invoke_config(
    *,
    run_name: str,
    context: SanitizedMatchContext,
    context_hash: str,
) -> Dict[str, Any]:
    metadata = {
        "room_id_hash": _hash_trace_value(context.room_id),
        "context_hash": context_hash,
        "prompt_version": get_icebreakers_prompt_version(),
        "trace_payload_sanitized": "true",
        "langsmith_tracing": "enabled",
    }
    return {
        "run_name": run_name,
        "metadata": metadata,
        "tags": [
            "chat-night",
            "icebreakers",
            f"prompt-version:{get_icebreakers_prompt_version()}",
        ],
    }


def _build_structured_openai_runnable(api_key: str) -> Any:
    llm = ChatOpenAI(
        model=_openai_model(),
        api_key=api_key,
        temperature=0,
        timeout=_openai_timeout_seconds(),
        max_retries=0,
        max_completion_tokens=_openai_max_output_tokens(),
    )
    return llm.with_structured_output(
        _IcebreakerStructuredOutput,
        method="json_schema",
        strict=True,
    )


async def _generate_openai_payload(
    context: SanitizedMatchContext,
    *,
    context_hash: str,
) -> Optional[Dict[str, List[str]]]:
    api_key = _openai_api_key()
    if not api_key:
        return None

    try:
        structured_runnable = _build_structured_openai_runnable(api_key)
        trace_allowed = _trace_allowed_for_context(context, stage="llm")
        invoke_kwargs: Dict[str, Any] = {}
        if trace_allowed:
            invoke_kwargs["config"] = _langsmith_invoke_config(
                run_name="chat-night-icebreakers-llm",
                context=context,
                context_hash=context_hash,
            )

        trace_ctx = (
            tracing_context(enabled=False)
            if _langsmith_tracing_enabled() and not trace_allowed
            else nullcontext()
        )
        with trace_ctx:
            result = await structured_runnable.ainvoke(
                _openai_messages(context),
                **invoke_kwargs,
            )
    except Exception:
        return None

    return _validate_output_shape(result)


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


def _graph_build_context(state: _IcebreakerFlowState) -> _IcebreakerFlowState:
    context = state["context"]
    participant_user_ids = state.get("participant_user_ids")
    participant_list = list(participant_user_ids) if participant_user_ids is not None else None
    provider_requested = _current_provider()
    openai_enabled = provider_requested == OPENAI_PROVIDER and bool(_openai_api_key())

    return {
        "provider_requested": provider_requested,
        "openai_enabled": openai_enabled,
        "context_hash": _hash_sanitized_context(context),
        "deterministic_payload": _safe_deterministic_payload(context),
        "payload": {},
        "model": MODEL_NONE,
        "cached": False,
        "openai_attempted_at": None,
        "openai_attempted": False,
        "should_call_llm": False,
        "should_persist": False,
        "persist_requester_user_id": state.get("requester_user_id"),
        "persist_participant_user_ids": participant_list,
    }


async def _graph_check_cache(state: _IcebreakerFlowState) -> _IcebreakerFlowState:
    context = state["context"]
    deterministic_payload = state["deterministic_payload"]
    cached_doc = await ChatNightIcebreakers.find_one(ChatNightIcebreakers.room_id == context.room_id)

    if not cached_doc:
        return {
            "payload": deterministic_payload,
            "model": MODEL_NONE,
            "cached": False,
            "should_call_llm": True,
            "should_persist": True,
        }

    cached_payload = _validate_output_shape(
        {
            "reasons": cached_doc.reasons,
            "icebreakers": cached_doc.icebreakers,
        }
    )
    if cached_payload and _passes_safety_filters(cached_payload):
        return {
            "payload": cached_payload,
            "model": _to_text(cached_doc.model) or MODEL_NONE,
            "cached": True,
            "should_call_llm": False,
            "should_persist": False,
        }

    participant_user_ids = state.get("persist_participant_user_ids")
    repaired_model = MODEL_FALLBACK if state.get("openai_enabled", False) else MODEL_NONE
    return {
        "payload": deterministic_payload,
        "model": repaired_model,
        "cached": True,
        "should_call_llm": False,
        "should_persist": True,
        "persist_requester_user_id": state.get("requester_user_id") or cached_doc.requester_user_id,
        "persist_participant_user_ids": (
            participant_user_ids
            if participant_user_ids is not None
            else list(cached_doc.participant_user_ids or [])
        ),
        "openai_attempted": False,
        "openai_attempted_at": None,
    }


def _graph_route_after_cache(state: _IcebreakerFlowState) -> str:
    if state.get("should_call_llm"):
        return "call_llm_langchain"
    if state.get("should_persist"):
        return "persist_cache"
    return "return"


async def _graph_call_llm_langchain(state: _IcebreakerFlowState) -> _IcebreakerFlowState:
    payload = state.get("payload") or state["deterministic_payload"]
    if not state.get("openai_enabled", False):
        return {
            "payload": payload,
            "model": MODEL_NONE,
            "openai_attempted": False,
            "openai_attempted_at": None,
        }

    allow_openai, _ = await should_call_openai(
        room_id=state["context"].room_id,
        requester_user_id=state.get("requester_user_id"),
    )
    if not allow_openai:
        return {
            "payload": payload,
            "model": MODEL_FALLBACK,
            "openai_attempted": False,
            "openai_attempted_at": None,
        }

    openai_attempted_at = datetime.now(timezone.utc)
    openai_payload = await _generate_openai_payload(
        state["context"],
        context_hash=state["context_hash"],
    )
    if not openai_payload:
        return {
            "payload": payload,
            "model": MODEL_FALLBACK,
            "openai_attempted": True,
            "openai_attempted_at": openai_attempted_at,
        }

    return {
        "payload": openai_payload,
        "model": _openai_model(),
        "openai_attempted": True,
        "openai_attempted_at": openai_attempted_at,
    }


def _graph_validate_and_filter(state: _IcebreakerFlowState) -> _IcebreakerFlowState:
    deterministic_payload = state["deterministic_payload"]
    payload = _validate_output_shape(state.get("payload"))
    model = _to_text(state.get("model")) or MODEL_NONE
    openai_enabled = state.get("openai_enabled", False)

    if payload is None:
        payload = deterministic_payload
        model = MODEL_FALLBACK if openai_enabled else MODEL_NONE

    if not _passes_safety_filters(payload):
        payload = deterministic_payload
        model = MODEL_FALLBACK if openai_enabled else MODEL_NONE

    return {
        "payload": payload,
        "model": model,
    }


async def _graph_persist_cache(state: _IcebreakerFlowState) -> _IcebreakerFlowState:
    if not state.get("should_persist", False):
        return {}

    try:
        await _persist_cache(
            room_id=state["context"].room_id,
            context_hash=state["context_hash"],
            payload=state["payload"],
            model=state["model"],
            provider_requested=state["provider_requested"],
            requester_user_id=state.get("persist_requester_user_id"),
            participant_user_ids=state.get("persist_participant_user_ids"),
            openai_attempted_at=state.get("openai_attempted_at"),
            openai_attempted=bool(state.get("openai_attempted", False)),
        )
    except Exception:
        pass
    return {}


def _graph_return(state: _IcebreakerFlowState) -> _IcebreakerFlowState:
    return state


@lru_cache(maxsize=1)
def _icebreaker_graph():
    graph = StateGraph(_IcebreakerFlowState)
    graph.add_node("build_context", _graph_build_context)
    graph.add_node("check_cache", _graph_check_cache)
    graph.add_node("call_llm_langchain", _graph_call_llm_langchain)
    graph.add_node("validate_and_filter", _graph_validate_and_filter)
    graph.add_node("persist_cache", _graph_persist_cache)
    graph.add_node("return", _graph_return)

    graph.set_entry_point("build_context")
    graph.add_edge("build_context", "check_cache")
    graph.add_conditional_edges(
        "check_cache",
        _graph_route_after_cache,
        {
            "call_llm_langchain": "call_llm_langchain",
            "persist_cache": "persist_cache",
            "return": "return",
        },
    )
    graph.add_edge("call_llm_langchain", "validate_and_filter")
    graph.add_edge("validate_and_filter", "persist_cache")
    graph.add_edge("persist_cache", "return")
    graph.add_edge("return", END)

    return graph.compile()


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
    openai_enabled = _current_provider() == OPENAI_PROVIDER and bool(_openai_api_key())
    context_hash = _hash_sanitized_context(context)
    participant_list = list(participant_user_ids) if participant_user_ids is not None else None

    try:
        graph_state: _IcebreakerFlowState = {
            "context": context,
            "requester_user_id": requester_user_id,
            "participant_user_ids": participant_list,
        }
        trace_allowed = _trace_allowed_for_context(context, stage="graph")
        invoke_kwargs: Dict[str, Any] = {}
        if trace_allowed:
            invoke_kwargs["config"] = _langsmith_invoke_config(
                run_name="chat-night-icebreakers-graph",
                context=context,
                context_hash=context_hash,
            )

        trace_ctx = (
            tracing_context(enabled=False)
            if _langsmith_tracing_enabled() and not trace_allowed
            else nullcontext()
        )
        with trace_ctx:
            final_state = await _icebreaker_graph().ainvoke(graph_state, **invoke_kwargs)

        payload = _validate_output_shape(final_state.get("payload"))
        if not payload or not _passes_safety_filters(payload):
            return fallback_icebreakers_response(
                context,
                prefer_fallback=openai_enabled,
            )

        model_name = _to_text(final_state.get("model")) or MODEL_NONE
        cached = bool(final_state.get("cached", False))
        return payload["reasons"], payload["icebreakers"], model_name, cached
    except Exception:
        return fallback_icebreakers_response(
            context,
            prefer_fallback=openai_enabled,
        )
