from fastapi import APIRouter, Depends, HTTPException, Body
from app.models.user import User
from app.models.chat_night import ChatNightPass, ChatNightRoom, MatchUnlocked, ChatNightIcebreakers
from app.models.chat import ChatThread
from app.schemas.chat_night import (
    ChatNightStatus,
    ChatNightRoomResponse,
    ChatNightIcebreakersRequest,
    ChatNightIcebreakersResponse,
    ChatNightIcebreakersRevealRequest,
    ChatNightIcebreakersRevealResponse,
)
from app.auth.dependencies import get_current_user
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict
from beanie import PydanticObjectId
import os
import uuid

import re
from app.services.event_logger import log_event
from app.services.chat_night_matching_v5 import rank_candidates
from app.services.ai_icebreakers import (
    build_sanitized_match_context,
    fallback_icebreakers_response,
    generate_icebreakers,
)
from app.core.config import settings

router = APIRouter()

# Time Constants (IST is UTC+5:30)
IST_OFFSET = timedelta(hours=5, minutes=30)
WINDOW_START_HOUR = 20 # 8 PM
WINDOW_END_HOUR = 22   # 10 PM
ROOM_DURATION_MINUTES = 5

# In-Memory Queue (FIFO)
men_queue = []
women_queue = []
queue_wait_since: Dict[str, datetime] = {}
LIVE_ROOM_STATES = {"active", "engaged"}

# --- Helpers ---

def get_now_utc():
    return datetime.now(timezone.utc)

def get_ist_time(utc_dt):
    return utc_dt + IST_OFFSET

def normalize_phone_last_10(phone: str) -> str:
    digits = re.sub(r'\D', '', phone)
    if len(digits) >= 10:
        return digits[-10:]
    return digits

def is_whitelisted_for_testing(user: User) -> bool:
    if not user or not user.phone_number:
        return False
    whitelist_str = os.getenv("CHAT_NIGHT_TEST_USERS", "")
    if not whitelist_str:
        return False
        
    user_norm = normalize_phone_last_10(user.phone_number)
    parts = [p.strip() for p in whitelist_str.split(",") if p.strip()]
    for p in parts:
        if normalize_phone_last_10(p) == user_norm:
            return True
    return False

def v5_enabled() -> bool:
    return os.getenv("CHAT_NIGHT_V5_MATCHING_ENABLED", "false").lower() == "true"

def include_match_meta() -> bool:
    return os.getenv("CHAT_NIGHT_INCLUDE_MATCH_META", "false").lower() == "true"

def v5_max_candidates() -> int:
    try:
        return int(os.getenv("CHAT_NIGHT_V5_MAX_CANDIDATES", "50"))
    except ValueError:
        return 50

def v5_min_score() -> int:
    try:
        return int(os.getenv("CHAT_NIGHT_V5_MIN_SCORE", "0"))
    except ValueError:
        return 0

def pair_cooldown_minutes() -> int:
    try:
        return int(os.getenv("CHAT_NIGHT_PAIR_COOLDOWN_MINUTES", "30"))
    except ValueError:
        return 30

def wait_boost_enabled() -> bool:
    return os.getenv("CHAT_NIGHT_WAITTIME_BOOST_ENABLED", "true").lower() == "true"

def wait_boost_step_seconds() -> int:
    try:
        value = int(os.getenv("CHAT_NIGHT_WAITTIME_BOOST_STEP_SECONDS", "30"))
        return max(1, value)
    except ValueError:
        return 30

def wait_boost_max_points() -> int:
    try:
        value = int(os.getenv("CHAT_NIGHT_WAITTIME_BOOST_MAX_POINTS", "15"))
        return max(0, value)
    except ValueError:
        return 15

def get_wait_seconds(user_id: str, now: datetime) -> int:
    started = queue_wait_since.get(user_id, now)
    try:
        return max(0, int((now - started).total_seconds()))
    except Exception:
        return 0

def compute_wait_boost(wait_seconds: int) -> int:
    if not wait_boost_enabled():
        return 0
    max_points = wait_boost_max_points()
    if max_points <= 0:
        return 0
    step_seconds = wait_boost_step_seconds()
    return min(max_points, max(0, wait_seconds) // step_seconds)

async def load_users_from_ids(user_ids: List[str], limit: int) -> List[User]:
    users: List[User] = []
    if limit <= 0:
        return users
    for uid in user_ids[:limit]:
        try:
            user = await User.get(PydanticObjectId(uid))
        except Exception:
            continue
        if user:
            users.append(user)
    return users

def room_ends_at_utc(room: ChatNightRoom) -> datetime:
    if room.ends_at.tzinfo is None:
        return room.ends_at.replace(tzinfo=timezone.utc)
    return room.ends_at.astimezone(timezone.utc)


def normalize_revealed_indices(raw_indices: Optional[List[int]]) -> List[int]:
    normalized: List[int] = []
    seen: set[int] = set()
    for raw_value in raw_indices or []:
        try:
            index = int(raw_value)
        except (TypeError, ValueError):
            continue
        if index < 0 or index > 4:
            continue
        if index in seen:
            continue
        seen.add(index)
        normalized.append(index)
    return normalized


def room_is_expired(room: ChatNightRoom, now: Optional[datetime] = None) -> bool:
    ref = now or get_now_utc()
    return ref > room_ends_at_utc(room)

async def normalize_room_if_expired(room: ChatNightRoom, now: Optional[datetime] = None) -> bool:
    if room.state not in LIVE_ROOM_STATES:
        return False
    if not room_is_expired(room, now):
        return False
    room.state = "ended"
    await room.save()
    return True

def build_engage_status(room: ChatNightRoom, my_engage: bool) -> str:
    if room.state == "engaged":
        return "match_unlocked"
    if my_engage:
        return "waiting_for_partner"
    return "pending"

async def find_active_room_for_user(user_id: str):
    rooms = await ChatNightRoom.find(
        {
            "$or": [{"male_user_id": user_id}, {"female_user_id": user_id}],
            "state": {"$in": list(LIVE_ROOM_STATES)},
        }
    ).sort(-ChatNightRoom.starts_at).to_list()

    if not rooms:
        return None

    now = get_now_utc()
    for room in rooms:
        if await normalize_room_if_expired(room, now):
            continue
        return room

    return None

async def get_recent_partner_ids(user_id: str, minutes: int) -> set[str]:
    if minutes <= 0:
        return set()

    since = get_now_utc() - timedelta(minutes=minutes)

    rooms = await ChatNightRoom.find(
        {
            "$or": [{"male_user_id": user_id}, {"female_user_id": user_id}],
            "starts_at": {"$gte": since},
        }
    ).to_list()

    partners = set()
    for r in rooms:
        if r.male_user_id == user_id:
            partners.add(r.female_user_id)
        elif r.female_user_id == user_id:
            partners.add(r.male_user_id)

    partners.discard(user_id)
    return partners

# NOTE: Keeping is_whitelisted_for_testing for legacy individual whitelist support if needed,
# but new settings apply globally or complement it.

def get_chat_window_status(user: User = None):
    """
    Returns (is_open, date_ist_str, seconds_until_open, seconds_until_close)
    Accepts optional user for whitelist checks.
    """
    now_utc = get_now_utc()
    now_ist = get_ist_time(now_utc)
    today_ist_str = now_ist.strftime("%Y-%m-%d")
    
    # 1. Force Open (Settings Override)
    if settings.CHAT_NIGHT_FORCE_OPEN:
        return True, today_ist_str, 0, 99999
        
    # 2. Test/Legacy Overrides
    if os.getenv("CHAT_NIGHT_TEST_MODE", "false").lower() == "true":
        return True, today_ist_str, 0, 99999
        
    if os.getenv("CHAT_NIGHT_FORCE_OPEN", "false").lower() == "true": # Legacy Env check just in case
        return True, today_ist_str, 0, 99999

    # 3. Whitelist Override
    if user and is_whitelisted_for_testing(user):
        return True, today_ist_str, 0, 99999

    # 4. Standard Time Logic
    start_dt = now_ist.replace(hour=WINDOW_START_HOUR, minute=0, second=0, microsecond=0)
    end_dt = now_ist.replace(hour=WINDOW_END_HOUR, minute=0, second=0, microsecond=0)
    
    is_open = False
    sec_open = 0
    sec_close = 0
    
    if now_ist < start_dt:
        is_open = False
        sec_open = int((start_dt - now_ist).total_seconds())
        sec_close = int((end_dt - now_ist).total_seconds())
    elif start_dt <= now_ist < end_dt:
        is_open = True
        sec_open = 0
        sec_close = int((end_dt - now_ist).total_seconds())
    else:
        is_open = False
        sec_open = -1 
        sec_close = 0
        
    return is_open, today_ist_str, sec_open, sec_close

async def get_or_create_pass(user: User, date_ist: str) -> ChatNightPass:
    p = await ChatNightPass.find_one(ChatNightPass.user_id == str(user.id), ChatNightPass.date_ist == date_ist)
    if not p:
        total = 0
        
        # Priority 1: Global Test Passes (Env)
        if settings.CHAT_NIGHT_TEST_PASSES is not None:
             total = settings.CHAT_NIGHT_TEST_PASSES
        
        # Priority 2: Whitelist (Legacy)
        elif is_whitelisted_for_testing(user):
             test_passes = os.getenv("CHAT_NIGHT_TEST_PASSES")
             if test_passes and test_passes.isdigit():
                 total = int(test_passes)
        
        # Priority 3: Standard Defaults
        if total == 0:
             total = settings.CHAT_NIGHT_PASS_FEMALE if user.gender == "Woman" else settings.CHAT_NIGHT_PASS_MALE
             
        p = ChatNightPass(
            user_id=str(user.id),
            date_ist=date_ist,
            passes_total=total,
            passes_used=0
        )
        await p.insert()
        
    # ALWAYS Force Override (In-Memory) for Global Test Mode
    # This allows changing env var to immediately affect existing passes
    if settings.CHAT_NIGHT_TEST_PASSES is not None:
         p.passes_total = settings.CHAT_NIGHT_TEST_PASSES
         # We don't reset passes_used here to preserve usage history, 
         # unless we want to reset daily? Requirement says "effectively have 100 passes". 
         # If existing user used 2/2, and we set 100, they have 98 left. Good.
         
    # Legacy Whitelist override
    elif is_whitelisted_for_testing(user):
        test_passes = os.getenv("CHAT_NIGHT_TEST_PASSES")
        if test_passes and test_passes.isdigit():
             p.passes_total = int(test_passes)

    return p

# --- Logic: Room Creation ---
async def try_match_and_create_room(user_id: str, gender: str, date_ist: str):
    # Based on gender, look at OPPOSITE queue
    # FIFO: Pop index 0
    
    partner_id: Optional[str] = None
    match_algo = "fifo"
    score: Optional[int] = None
    reason_tags: Optional[List[str]] = None
    wait_seconds: Optional[int] = None
    wait_boost: Optional[int] = None
    
    opposite_queue = men_queue if gender == "Woman" else women_queue
    
    if len(opposite_queue) == 0:
        return None, None

    cooldown_set = await get_recent_partner_ids(user_id, pair_cooldown_minutes())
    selection_now = get_now_utc()
    
    if v5_enabled():
        current_user_obj: Optional[User] = None
        try:
            current_user_obj = await User.get(PydanticObjectId(user_id))
        except Exception:
            current_user_obj = None
            
        if current_user_obj:
            max_candidates = v5_max_candidates()
            candidates = await load_users_from_ids(opposite_queue, max_candidates)
            eligible_candidates = [
                candidate for candidate in candidates
                if str(candidate.id) != user_id and str(candidate.id) not in cooldown_set
            ]
            if eligible_candidates:
                min_score = v5_min_score()
                ranked = rank_candidates(current_user_obj, eligible_candidates, now=selection_now, limit=max_candidates)
                best = None
                best_effective = -1
                best_wait_seconds = -1
                best_wait_boost = 0
                for item in ranked:
                    base_score = int(item.get("score", 0))
                    if base_score < min_score:
                        continue
                    candidate_obj = item.get("candidate")
                    if not candidate_obj:
                        continue
                    candidate_id = str(candidate_obj.id)
                    if candidate_id == user_id:
                        continue
                    candidate_wait_seconds = get_wait_seconds(candidate_id, selection_now)
                    candidate_boost = compute_wait_boost(candidate_wait_seconds)
                    effective_score = min(100, base_score + candidate_boost)
                    if (
                        effective_score > best_effective
                        or (effective_score == best_effective and candidate_wait_seconds > best_wait_seconds)
                    ):
                        best = item
                        best_effective = effective_score
                        best_wait_seconds = candidate_wait_seconds
                        best_wait_boost = candidate_boost
                if best:
                    candidate_obj = best.get("candidate")
                    if candidate_obj:
                        candidate_id = str(candidate_obj.id)
                        if candidate_id != user_id:
                            try:
                                opposite_queue.remove(candidate_id)
                                partner_id = candidate_id
                                match_algo = "v5"
                                score = int(best.get("score", 0))
                                reason_tags = best.get("reason_tags") or []
                                wait_seconds = best_wait_seconds
                                wait_boost = best_wait_boost
                            except ValueError:
                                partner_id = None
    
    if partner_id is None:
        if len(opposite_queue) > 0:
            max_scan = v5_max_candidates()
            selected_index = None
            selected_wait_seconds = -1
            for idx, cid in enumerate(opposite_queue[:max_scan]):
                if cid == user_id or cid in cooldown_set:
                    continue
                candidate_wait_seconds = get_wait_seconds(cid, selection_now)
                if candidate_wait_seconds > selected_wait_seconds:
                    selected_index = idx
                    selected_wait_seconds = candidate_wait_seconds
            if selected_index is not None:
                partner_id = opposite_queue.pop(selected_index)
                wait_seconds = selected_wait_seconds
                wait_boost = compute_wait_boost(wait_seconds)
            
    if partner_id:
        queue_wait_since.pop(user_id, None)
        queue_wait_since.pop(partner_id, None)
        # Create Room
        now = get_now_utc()
        room = ChatNightRoom(
            room_id=str(uuid.uuid4()),
            male_user_id=user_id if gender != "Woman" else partner_id,
            female_user_id=user_id if gender == "Woman" else partner_id,
            starts_at=now,
            ends_at=now + timedelta(minutes=ROOM_DURATION_MINUTES),
            state="active"
        )
        await room.insert()
        
        # Log Match
        match_meta = {
            "match_algo": match_algo,
            "score": score if score is not None else 0,
            "reason_tags": reason_tags if reason_tags is not None else [],
            "wait_seconds": wait_seconds if wait_seconds is not None else 0,
            "wait_boost": wait_boost if wait_boost is not None else 0,
        }

        await log_event(
            "chat_night.match",
            source="backend",
            payload={
                "room_id": room.room_id,
                "users": [room.male_user_id, room.female_user_id],
                **match_meta,
            },
        )
        
        # CONSUME PASSES for BOTH
        # We need to find pass doc for partner too
        # Caller pass is handled by caller wrapper but safer to do both here atomically-ish
        
        # Update User A Pass
        pass_a = await ChatNightPass.find_one(ChatNightPass.user_id == user_id, ChatNightPass.date_ist == date_ist)
        if pass_a: 
            pass_a.passes_used += 1
            await pass_a.save()
            
        # Update User B Pass
        pass_b = await ChatNightPass.find_one(ChatNightPass.user_id == partner_id, ChatNightPass.date_ist == date_ist)
        if pass_b:
            pass_b.passes_used += 1
            await pass_b.save()
            
        return room, match_meta
    
    return None, None

# --- Endpoints ---

# --- Helper: Dynamic Config ---
async def get_effective_min_score():
    from app.core.config import settings
    from app.models.admin import SystemConfig
    
    # 1. DB Override
    try:
        conf = await SystemConfig.find_one(SystemConfig.key == "PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT")
        if conf and conf.value.isdigit():
            return int(conf.value)
    except:
        pass
        
    # 2. Env Fallback
    return settings.PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT

@router.get("/status", response_model=ChatNightStatus)
async def get_status(current_user: User = Depends(get_current_user)):
    # Onboarding barrier
    if not current_user.gender or not current_user.first_name:
        raise HTTPException(status_code=400, detail="Complete onboarding before using Chat Night")
        
    is_open, date_ist, sec_open, sec_close = get_chat_window_status(current_user)
    
    # Profile Completion Gating
    from app.services.profile_scoring import compute_profile_strength
    
    status = "open" if is_open else "closed"
    gate_detail = None
    user_score = 0
    min_score = await get_effective_min_score()
    
    if min_score > 0:
        strength = compute_profile_strength(current_user)
        user_score = strength["completion_percent"]
        if user_score < min_score:
            status = "gated"
            gate_detail = f"Complete your profile ({min_score}% required) to use Chat Night"
    
    # Get Pass Info
    p = await get_or_create_pass(current_user, date_ist)
    
    # Get Active Room?
    active_room = await find_active_room_for_user(str(current_user.id))
    
    # Queue Status
    uid = str(current_user.id)
    q_status = 'none'
    if uid in men_queue or uid in women_queue:
        q_status = 'queued'
        
    return ChatNightStatus(
        is_open=is_open,
        status=status,
        min_completion=min_score,
        user_completion=user_score,
        detail=gate_detail,
        date_ist=date_ist,
        seconds_until_open=sec_open,
        seconds_until_close=sec_close,
        passes_total=p.passes_total,
        passes_used=p.passes_used,
        passes_remaining=p.passes_total - p.passes_used,
        passes_remaining_today=p.passes_total - p.passes_used,
        passes_used_today=p.passes_used,
        passes_total_today=p.passes_total,
        active_room_id=active_room.room_id if active_room else None,
        queue_status=q_status
    )

from fastapi import Request
from app.core.limiter import limiter

@router.post("/enter")
@limiter.limit("5/minute")
async def enter_pool(request: Request, current_user: User = Depends(get_current_user)):
    if not current_user.gender or not current_user.first_name:
         raise HTTPException(status_code=400, detail="Complete onboarding before using Chat Night")

    is_open, date_ist, _, _ = get_chat_window_status(current_user)
    # Profile Completion Gating
    from app.services.profile_scoring import compute_profile_strength
    
    min_score = await get_effective_min_score()
    if min_score > 0:
        score = compute_profile_strength(current_user)["completion_percent"]
        if score < min_score:
            raise HTTPException(status_code=400, detail=f"Complete your profile ({min_score}% required) to use Chat Night")
            
    if not is_open:
        raise HTTPException(status_code=400, detail="Chat Night is closed")
        
    uid = str(current_user.id)
    
    await log_event("chat_night.enter", source="backend", user_id=uid)
    
    # 1. Idempotency: Check if already in active room
    active_room = await find_active_room_for_user(uid)
    if active_room and active_room.state == "active":
        return {"status": "active_room", "room_id": active_room.room_id}
        
    # 2. Idempotency: Check if already queued
    if uid in men_queue or uid in women_queue:
        if uid not in queue_wait_since:
            queue_wait_since[uid] = get_now_utc()
        return {"status": "queued"}
        
    # 3. Check Pass Availability
    p = await get_or_create_pass(current_user, date_ist)
    if p.passes_used >= p.passes_total:
        raise HTTPException(status_code=403, detail="No passes remaining")
        
    # 4. Attempt Match (Consumes pass if successful)
    gender = current_user.gender or "Man" # Fallback
    
    room, match_meta = await try_match_and_create_room(uid, gender, date_ist)
    
    if room:
        response = {"status": "match_found", "room_id": room.room_id}
        if include_match_meta():
            response["match_meta"] = match_meta or {
                "match_algo": "fifo",
                "score": 0,
                "reason_tags": [],
                "wait_seconds": 0,
                "wait_boost": 0,
            }
        return response
    else:
        # Enqueue
        now = get_now_utc()
        if gender == "Woman":
            women_queue.append(uid)
        else:
            men_queue.append(uid)
        if uid not in queue_wait_since:
            queue_wait_since[uid] = now
        return {"status": "queued"}

@router.get("/my-room")
async def get_my_room(current_user: User = Depends(get_current_user)):
    """
    Polling endpoint: Check if I am in an active/engaged room.
    Useful for the user who was queued and needs to know if a match happened.
    """
    room = await find_active_room_for_user(str(current_user.id))
    
    if not room:
        return {"state": "none"}
        
    # Partner Logic (Copied from get_room - refactor if strict DRY needed, 
    # but kept inline for speed as per instructions)
    uid = str(current_user.id)
    if uid == room.male_user_id:
        partner_id = room.female_user_id
        my_role = "male"
        my_engage = room.engage_male
        partner_engage = room.engage_female
    elif uid == room.female_user_id:
        partner_id = room.male_user_id
        my_role = "female"
        my_engage = room.engage_female
        partner_engage = room.engage_male
    else:
        # Should not happen since we searched by ID
        return {"state": "none"}
        
    # Calculate Remaining Seconds
    now = get_now_utc()
    rem = int((room_ends_at_utc(room) - now).total_seconds())
    if rem < 0: rem = 0
    
    return {
        "state": room.state,
        "room_id": room.room_id,
        "starts_at": room.starts_at,
        "ends_at": room.ends_at,
        "remaining_seconds": rem,
        "partner_user_id": partner_id,
        "you_are": my_role,
        "engage_you": my_engage,
        "engage_partner": partner_engage
    }

@router.post("/leave")
async def leave_pool(current_user: User = Depends(get_current_user)):
    uid = str(current_user.id)
    if uid in men_queue: men_queue.remove(uid)
    if uid in women_queue: women_queue.remove(uid)
    queue_wait_since.pop(uid, None)
    return {"status": "left"}


@router.post("/icebreakers", response_model=ChatNightIcebreakersResponse)
async def get_icebreakers(
    data: ChatNightIcebreakersRequest,
    current_user: User = Depends(get_current_user),
):
    room = await ChatNightRoom.find_one(ChatNightRoom.room_id == data.room_id)
    if not room:
        raise HTTPException(404, "Room not found")

    uid = str(current_user.id)
    if uid != room.male_user_id and uid != room.female_user_id:
        raise HTTPException(403, "Not in room")

    try:
        context = await build_sanitized_match_context(room)
    except ValueError:
        raise HTTPException(404, "Room participants not found")

    try:
        reasons, icebreakers, model_name, cached = await generate_icebreakers(
            context,
            requester_user_id=uid,
            participant_user_ids=[room.male_user_id, room.female_user_id],
        )
    except Exception:
        prefer_fallback = (
            os.getenv("CHAT_NIGHT_ICEBREAKERS_PROVIDER", "none").strip().lower() == "openai"
            and bool(os.getenv("OPENAI_API_KEY", "").strip())
        )
        reasons, icebreakers, model_name, cached = fallback_icebreakers_response(
            context,
            prefer_fallback=prefer_fallback,
        )

    return ChatNightIcebreakersResponse(
        room_id=room.room_id,
        reasons=reasons,
        icebreakers=icebreakers,
        model=model_name,
        cached=cached,
    )


@router.post("/icebreakers/reveal", response_model=ChatNightIcebreakersRevealResponse)
async def reveal_icebreaker(
    data: ChatNightIcebreakersRevealRequest,
    current_user: User = Depends(get_current_user),
):
    room = await ChatNightRoom.find_one(ChatNightRoom.room_id == data.room_id)
    if not room:
        raise HTTPException(404, "Room not found")

    uid = str(current_user.id)
    if uid != room.male_user_id and uid != room.female_user_id:
        raise HTTPException(403, "Not in room")

    cache_doc = await ChatNightIcebreakers.find_one(ChatNightIcebreakers.room_id == data.room_id)
    if not cache_doc:
        raise HTTPException(409, "Icebreakers cache missing for room")

    revealed_indices = normalize_revealed_indices(cache_doc.revealed_indices)
    if data.index not in revealed_indices:
        revealed_indices.append(data.index)

    now = get_now_utc()
    cache_doc.revealed_indices = revealed_indices
    cache_doc.reveal_updated_at = now
    cache_doc.updated_at = now
    await cache_doc.save()

    return ChatNightIcebreakersRevealResponse(
        room_id=room.room_id,
        revealed_indices=revealed_indices,
    )


@router.get("/room/{room_id}", response_model=ChatNightRoomResponse)
async def get_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = await ChatNightRoom.find_one(ChatNightRoom.room_id == room_id)
    if not room:
        raise HTTPException(404, "Room not found")
        
    # Check Expiry
    now = get_now_utc()
    await normalize_room_if_expired(room, now)
        
    # Partner Info
    uid = str(current_user.id)
    if uid == room.male_user_id:
        partner_id = room.female_user_id
        my_engage = room.engage_male
        partner_engage = room.engage_female
    elif uid == room.female_user_id:
        partner_id = room.male_user_id
        my_engage = room.engage_female
        partner_engage = room.engage_male
    else:
        raise HTTPException(403, "Not in room")
        
    # Resolving Partner ID type (UUID vs PydanticObjectId)
    # Beanie IDs are PydanticObjectId (ObjectId), but uuid4 was used for room_id. 
    # User IDs are usually PydanticObjectId.
        
    partner = None
    try:
        # Try as ObjectId first (standard Beanie User)
        pid = PydanticObjectId(partner_id)
        partner = await User.get(pid)
    except:
        pass
        
    if not partner:
        # Maybe UUID?
        try:
             partner = await User.find_one(User.id == uuid.UUID(partner_id))
        except:
             pass
    
    partner_name = partner.first_name if (partner and partner.first_name) else "Unknown"
    partner_photo = partner.photos[0] if (partner and partner.photos) else None
    
    # Calculate Seconds Remaining
    rem = int((room_ends_at_utc(room) - now).total_seconds())
    if rem < 0: rem = 0
    
    # Engage Status UI logic
    status_ui = build_engage_status(room, my_engage)
    icebreakers_cache = await ChatNightIcebreakers.find_one(ChatNightIcebreakers.room_id == room.room_id)
    revealed_indices = normalize_revealed_indices(
        icebreakers_cache.revealed_indices if icebreakers_cache else []
    )
            
    return ChatNightRoomResponse(
        room_id=room.room_id,
        state=room.state,
        starts_at=room.starts_at,
        ends_at=room.ends_at,
        seconds_remaining=rem,
        partner_first_name=partner_name,
        partner_photo=partner_photo,
        engage_status=status_ui,
        match_unlocked=(room.state == "engaged"),
        icebreakers_revealed_indices=revealed_indices,
    )

@router.post("/engage")
@limiter.limit("10/minute")
async def engage_room(
    request: Request,
    data: dict = Body(...), 
    current_user: User = Depends(get_current_user)
):
    room_id = data.get("room_id")
    if not room_id:
        raise HTTPException(400, "room_id is required")

    room = await ChatNightRoom.find_one(ChatNightRoom.room_id == room_id)
    if not room:
        raise HTTPException(404, "Room not found")

    uid = str(current_user.id)
    is_male_user = uid == room.male_user_id
    is_female_user = uid == room.female_user_id
    if not is_male_user and not is_female_user:
        raise HTTPException(403, "Not in room")
    
    # Validate Liveness
    now = get_now_utc()
    if await normalize_room_if_expired(room, now):
        raise HTTPException(400, "Room expired")
    if room.state == "ended":
        raise HTTPException(400, "Room ended")

    if room.state == "engaged":
        my_engage = room.engage_male if is_male_user else room.engage_female
        return {
            "status": "success",
            "room_state": room.state,
            "engage_status": build_engage_status(room, my_engage),
            "match_unlocked": True,
        }

    engage_changed = False
    if is_male_user and not room.engage_male:
        room.engage_male = True
        engage_changed = True
    if is_female_user and not room.engage_female:
        room.engage_female = True
        engage_changed = True

    if engage_changed:
        await log_event("chat_night.engage", source="backend", user_id=uid, payload={"room_id": room_id})

    # Check Mutual
    if room.engage_male and room.engage_female:
        room.state = "engaged"
        room.engaged_at = now

        match = await MatchUnlocked.find_one(MatchUnlocked.room_id == room_id)
        if not match:
            # Log Unlocked
            await log_event(
                "chat_night.unlocked",
                source="backend",
                payload={"room_id": room_id, "users": [room.male_user_id, room.female_user_id]}
            )

            # Unlock Match
            match = MatchUnlocked(
                user_ids=[room.male_user_id, room.female_user_id],
                room_id=room_id
            )
            await match.insert()

        # BRIDGE: Auto-create ChatThread immediately
        if match:
            try:
                existing_thread = await ChatThread.find_one(ChatThread.match_id == match.id)
                if not existing_thread:
                    # MatchUnlocked user_ids are strings, ChatThread wants PydanticObjectId
                    p1 = PydanticObjectId(room.male_user_id)
                    p2 = PydanticObjectId(room.female_user_id)

                    t = ChatThread(
                        match_id=match.id,
                        participants=[p1, p2],
                        created_at=match.created_at
                    )
                    await t.insert()
            except Exception as e:
                # DuplicateKeyError or other issues shouldn't block the MatchUnlocked flow
                # It will be healed by GET /threads anyway. Log and continue.
                print(f"ChatThread creation bridge warning: {e}")

    await room.save()
    my_engage = room.engage_male if is_male_user else room.engage_female
    return {
        "status": "success",
        "room_state": room.state,
        "engage_status": build_engage_status(room, my_engage),
        "match_unlocked": room.state == "engaged",
    }
