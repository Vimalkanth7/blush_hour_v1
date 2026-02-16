from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence
import hashlib

HABIT_KEYS = ["drinking", "smoking", "exercise", "kids"]


def _get_value(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _to_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, (tuple, set)):
        return list(value)
    if isinstance(value, str):
        v = value.strip()
        return [v] if v else []
    return [value]


def _to_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _clean_list(values: Sequence[Any]) -> List[Any]:
    cleaned: List[Any] = []
    for v in values:
        if v is None:
            continue
        if isinstance(v, str) and v.strip() == "":
            continue
        cleaned.append(v)
    return cleaned


def _as_set(values: Sequence[Any]) -> set:
    return set(_clean_list(values))


def _normalize_habit_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip().lower()
    return str(value).strip().lower()


def _coerce_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        v = value.strip()
        if v.endswith("Z"):
            v = v[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(v)
        except ValueError:
            return None
    return None


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _get_last_active_at(candidate: Any) -> Optional[datetime]:
    for key in ("last_active_at", "last_active", "last_seen_at", "updated_at"):
        value = _get_value(candidate, key, None)
        if value:
            dt = _coerce_datetime(value)
            if dt:
                return _ensure_utc(dt)
    return None


def _get_identifier(obj: Any) -> str:
    for key in ("id", "user_id"):
        value = _get_value(obj, key, None)
        if value is not None:
            return str(value)
    return ""


def jaccard_similarity(a: Iterable[Any], b: Iterable[Any]) -> float:
    set_a = _as_set(list(a))
    set_b = _as_set(list(b))
    union = set_a | set_b
    if not union:
        return 0.0
    return len(set_a & set_b) / len(union)


def recency_bucket(last_active_at: Optional[datetime], now: datetime) -> float:
    if last_active_at is None:
        return 0.0
    now_utc = _ensure_utc(now)
    last_utc = _ensure_utc(last_active_at)
    age_minutes = (now_utc - last_utc).total_seconds() / 60
    if age_minutes < 0:
        age_minutes = 0

    if age_minutes <= 2:
        return 1.0
    if age_minutes <= 5:
        return 0.8
    if age_minutes <= 10:
        return 0.6
    if age_minutes <= 20:
        return 0.4
    return 0.0


def score_candidate(user: Any, candidate: Any, now: Optional[datetime] = None) -> Dict[str, Any]:
    """
    V5 scoring module. Returns {score, reason_tags} only.
    """
    now = now or datetime.now(timezone.utc)

    u_interests = _as_set(_to_list(_get_value(user, "interests", [])))
    c_interests = _as_set(_to_list(_get_value(candidate, "interests", [])))

    u_values = _as_set(_to_list(_get_value(user, "values", [])))
    c_values = _as_set(_to_list(_get_value(candidate, "values", [])))

    u_languages = _as_set(_to_list(_get_value(user, "languages", [])))
    c_languages = _as_set(_to_list(_get_value(candidate, "languages", [])))

    u_habits = _to_dict(_get_value(user, "habits", {}))
    c_habits = _to_dict(_get_value(candidate, "habits", {}))

    u_prompts = _to_list(_get_value(user, "prompts", []))
    c_prompts = _to_list(_get_value(candidate, "prompts", []))

    s_interests = round(40 * jaccard_similarity(u_interests, c_interests))
    s_values = round(20 * jaccard_similarity(u_values, c_values))
    s_lang = 10 if (u_languages & c_languages) else 0

    matches = 0
    for key in HABIT_KEYS:
        u_val = _normalize_habit_value(u_habits.get(key))
        c_val = _normalize_habit_value(c_habits.get(key))
        if u_val and c_val and u_val == c_val:
            matches += 1
    s_habits = min(20, matches * 5)

    s_prompts = 10 if (len(u_prompts) > 0 and len(c_prompts) > 0) else 0

    last_active_at = _get_last_active_at(candidate)
    s_recency = round(10 * recency_bucket(last_active_at, now))

    score_total = s_interests + s_values + s_lang + s_habits + s_prompts + s_recency
    score_total = max(0, min(100, score_total))

    reason_tags: List[str] = []
    if s_interests > 0:
        reason_tags.append("interests_overlap")
    if s_values > 0:
        reason_tags.append("values_overlap")
    if s_lang > 0:
        reason_tags.append("language_match")
    if s_habits > 0:
        reason_tags.append("habits_match")
    if s_prompts > 0:
        reason_tags.append("prompt_overlap")
    if s_recency > 0:
        reason_tags.append("recent_active")

    return {
        "score": int(score_total),
        "reason_tags": reason_tags[:6],
    }


def rank_candidates(
    user: Any,
    candidates: Sequence[Any],
    now: Optional[datetime] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Score and rank candidates deterministically using V5 score + tie-breakers.
    Returns list of dicts with candidate and score metadata.
    """
    now = now or datetime.now(timezone.utc)
    date_str = now.date().isoformat()
    u_id = _get_identifier(user)

    scored: List[Dict[str, Any]] = []
    for candidate in list(candidates)[:max(0, limit)]:
        result = score_candidate(user, candidate, now=now)

        u_interests = _as_set(_to_list(_get_value(user, "interests", [])))
        c_interests = _as_set(_to_list(_get_value(candidate, "interests", [])))
        shared_interests = len(u_interests & c_interests)

        last_active_at = _get_last_active_at(candidate)
        last_active_ts = (
            _ensure_utc(last_active_at).timestamp()
            if last_active_at is not None
            else -1
        )

        c_id = _get_identifier(candidate)
        raw = f"{u_id}:{c_id}:{date_str}"
        hash_int = int(hashlib.sha1(raw.encode("utf-8")).hexdigest(), 16)

        scored.append({
            "candidate": candidate,
            "score": result["score"],
            "reason_tags": result["reason_tags"],
            "shared_interests": shared_interests,
            "last_active_at": last_active_at,
            "_last_active_ts": last_active_ts,
            "_hash_int": hash_int,
        })

    def _rank_key(item: Dict[str, Any]):
        return (
            item["score"],
            item["shared_interests"],
            item["_last_active_ts"],
            -item["_hash_int"],
        )

    scored.sort(key=_rank_key, reverse=True)
    return scored


def pick_best_candidate(
    user: Any,
    candidates: Sequence[Any],
    now: Optional[datetime] = None,
    limit: int = 50,
) -> Optional[Dict[str, Any]]:
    ranked = rank_candidates(user, candidates, now=now, limit=limit)
    return ranked[0] if ranked else None


def run_self_check() -> Dict[str, Any]:
    """
    Tiny verification surface for manual checks. Safe to call without DB.
    """
    now = datetime(2026, 2, 13, 12, 0, 0, tzinfo=timezone.utc)
    user = {
        "id": "user_a",
        "interests": ["music", "coffee", "travel"],
        "values": ["honesty", "humor"],
        "languages": ["English"],
        "habits": {"drinking": "sometimes", "smoking": "no", "exercise": "yes", "kids": "maybe"},
        "prompts": [{"question": "q1", "answer": "a1"}],
    }
    candidate = {
        "id": "user_b",
        "interests": ["music", "art"],
        "values": ["humor"],
        "languages": ["English", "Spanish"],
        "habits": {"drinking": "sometimes", "smoking": "no"},
        "prompts": [{"question": "q2", "answer": "a2"}],
        "last_active_at": now,
    }
    result = score_candidate(user, candidate, now=now)
    best = pick_best_candidate(user, [candidate], now=now)
    return {"score": result, "best": best}


if __name__ == "__main__":
    output = run_self_check()
    print(output)
