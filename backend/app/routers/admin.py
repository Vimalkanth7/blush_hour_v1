from fastapi import APIRouter, Depends, HTTPException, Body, Query
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from beanie import PydanticObjectId, operators as Ops

from app.models.user import User
from app.models.chat_night import MatchUnlocked, ChatNightPass, ChatNightRoom
from app.models.events import AppEvent
from app.models.chat import ChatThread, ChatMessage
from app.models.admin import AdminAuditLog, SystemConfig
from app.auth.dependencies import get_current_admin
from app.services.profile_scoring import compute_profile_strength

router = APIRouter()

# --- Logging Helper ---
async def log_admin_action(admin_id: str, action: str, target_id: str = None, meta: dict = None):
    log = AdminAuditLog(
        admin_id=admin_id,
        action=action,
        target_user_id=target_id,
        metadata=meta
    )
    await log.insert()

# --- Endpoints ---

@router.get("/metrics/overview")
async def get_overview(current_admin: User = Depends(get_current_admin)):
    now = datetime.utcnow()
    last_24h = now - timedelta(days=1)
    last_7d = now - timedelta(days=7)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    try:
        # Parallelize these if aggregation is slow, sequential for now
        total_users = await User.find_all().count()
        new_users_24h = await User.find(User.created_at >= last_24h).count()
        # DAU: manual scan for safety/stability
        # FIX: Do not use project() which causes ExpressionField error
        recent_events = await AppEvent.find(AppEvent.created_at >= last_24h).to_list()
        dau = len({e.user_id for e in recent_events})
        
        chat_night_enters = await AppEvent.find(
            AppEvent.event_name == "chat_night.enter", 
            AppEvent.created_at >= today_start
        ).count()

        matches_unlocked = await MatchUnlocked.find_all().count()
        matches_today = await MatchUnlocked.find(MatchUnlocked.created_at >= today_start).count()
        
        threads_created = await ChatThread.find_all().count()
        messages_sent = await ChatMessage.find_all().count()
        
        return {
            "users": {
                "total": total_users,
                "new_24h": new_users_24h,
                "dau_24h": dau
            },
            "engagement": {
                "chat_night_enters_today": chat_night_enters,
                "matches_total": matches_unlocked,
                "matches_today": matches_today,
                "threads_total": threads_created,
                "messages_total": messages_sent
            }
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise e

@router.get("/users")
async def get_users_list(
    search: Optional[str] = None,
    tier: Optional[str] = None,
    onboarded: Optional[bool] = None,
    min_completion: Optional[int] = None,
    limit: int = 20,
    curr_admin: User = Depends(get_current_admin)
):
    # Base query
    expressions = []
    if search:
        # Regex search on first name or exact match phone
        expressions.append(
            Ops.Or(
                Ops.RegEx(User.first_name, search, "i"),
                User.phone_number == search
            )
        )
    if onboarded is not None:
        expressions.append(User.onboarding_completed == onboarded)
        
    # Note: min_completion is hard to query because it's a property, not stored field.
    # We might filter post-fetch for this iteration.
    
    query = User.find(*expressions).sort(-User.created_at).limit(limit)
    users_db = await query.to_list()
    
    results = []
    for u in users_db:
        strength = compute_profile_strength(u)
        # Filter if tier/completion params present
        if tier and strength['tier'].lower() != tier.lower():
            continue
        if min_completion and strength['completion_percent'] < min_completion:
            continue
            
        # Name fallback logic
        display_name = u.first_name
        if not display_name:
             if u.phone_number:
                 display_name = f"User-{u.phone_number[-4:]}"
             else:
                 display_name = f"User-{str(u.id)[-4:]}"

        results.append({
            "id": str(u.id),
            "phone": u.phone_number, # Admin sees phone
            "name": display_name,
            "created_at": u.created_at,
            "role": u.role,
            "is_banned": u.is_banned,
            "tier": strength['tier'],
            "completion": strength['completion_percent']
        })
        
    return {"users": results}

@router.get("/users/{user_id}")
async def get_user_detail(user_id: str, curr_admin: User = Depends(get_current_admin)):
    try:
        uid = PydanticObjectId(user_id)
    except:
        raise HTTPException(400, "Invalid ID")
        
    u = await User.get(uid)
    if not u: raise HTTPException(404, "User not found")
    
    strength = compute_profile_strength(u)
    
    # Matches
    matches = await MatchUnlocked.find(Ops.In(MatchUnlocked.user_ids, [str(uid)])).sort(-MatchUnlocked.created_at).limit(10).to_list()
    
    # Threads
    threads = await ChatThread.find(Ops.In(ChatThread.participants, [uid])).sort(-ChatThread.last_message_at).limit(10).to_list()
    
    # Events
    events = await AppEvent.find(AppEvent.user_id == str(uid)).sort(-AppEvent.created_at).limit(50).to_list()
    
    # Passes
    passes = await ChatNightPass.find(ChatNightPass.user_id == uid).sort(-ChatNightPass.date_ist).limit(5).to_list()
    
    # Audit View
    await log_admin_action(str(curr_admin.id), "view_user", str(uid))

    # Computed Stats
    msg_count = await AppEvent.find(AppEvent.user_id == str(uid), AppEvent.event_name == "chat.message.sent").count()
    match_count = await MatchUnlocked.find(Ops.In(MatchUnlocked.user_ids, [str(uid)])).count()
    
    # Passes Today
    now_ist = datetime.utcnow() + timedelta(hours=5, minutes=30)
    today_str = now_ist.strftime("%Y-%m-%d")
    today_pass = await ChatNightPass.find_one(ChatNightPass.user_id == uid, ChatNightPass.date_ist == today_str)
    passes_today_used = today_pass.passes_used if today_pass else 0

    # Sanitize Profile
    profile_dict = u.dict(exclude={"password_hash"})
    profile_dict["id"] = str(u.id)
    if "_id" in profile_dict: del profile_dict["_id"]

    return {
        "profile": profile_dict,
        "strength": strength,
        "activity_stats": {
            "messages_sent_all_time": msg_count,
            "matches_count_all_time": match_count,
            "chat_night_passes_used_today": passes_today_used
        },
        "matches_recent": matches,
        "threads_recent": threads,
        "events_timeline": events,
        "passes_history": passes
    }

@router.get("/threads/{thread_id}")
async def inspect_thread(thread_id: str, curr_admin: User = Depends(get_current_admin)):
    try:
        tid = PydanticObjectId(thread_id)
    except:
         raise HTTPException(400, "Invalid ID")
         
    t = await ChatThread.get(tid)
    if not t: raise HTTPException(404, "Thread not found")
    
    msgs = await ChatMessage.find(ChatMessage.thread_id == tid).sort(-ChatMessage.created_at).limit(50).to_list()
    
    # Audit View (Sensitive)
    await log_admin_action(str(curr_admin.id), "view_thread_sensitive", target_id=thread_id, meta={"thread_id": str(tid)})
    
    return {
        "thread": t,
        "messages": msgs
    }

@router.post("/users/{user_id}/actions/reset-passes")
async def reset_passes(user_id: str, count: int = 3, curr_admin: User = Depends(get_current_admin)):
    try:
        uid = PydanticObjectId(user_id)
    except:
        raise HTTPException(400, "Invalid ID")
        
    # Get today's pass
    # Using generic 'now' but ideally this logic matches chat night router logic
    now_ist = datetime.utcnow() + timedelta(hours=5, minutes=30)
    date_str = now_ist.strftime("%Y-%m-%d")
    
    p = await ChatNightPass.find_one(ChatNightPass.user_id == str(uid), ChatNightPass.date_ist == date_str)
    if not p:
         # Create if not exists: total=count, used=0 -> remaining=count
         p = ChatNightPass(user_id=str(uid), date_ist=date_str, passes_total=count, passes_used=0)
         await p.insert()
    else:
        # Update existing: total = used + count -> remaining = count
        # This preserves history of 'used' passes while ensuring the user gets exactly 'count' more actions.
        p.passes_total = p.passes_used + count
        await p.save()
        
    await log_admin_action(str(curr_admin.id), "reset_passes", str(uid), meta={"new_count": count})
    return {"status": "ok", "new_passes": count}

@router.post("/users/{user_id}/actions/ban")
async def ban_user(user_id: str, reason: str = Body(..., embed=True), curr_admin: User = Depends(get_current_admin)):
    try:
        uid = PydanticObjectId(user_id)
    except:
        raise HTTPException(400, "Invalid ID")
        
    u = await User.get(uid)
    if not u: raise HTTPException(404, "User not found")
    
    u.is_banned = True
    u.ban_reason = reason
    await u.save()
    
    # Todo: terminate sessions if possible (jwt invalidation not implemented yet)
    
    await log_admin_action(str(curr_admin.id), "ban_user", str(uid), meta={"reason": reason})
    return {"status": "banned"}

@router.post("/users/{user_id}/actions/unban")
async def unban_user(user_id: str, curr_admin: User = Depends(get_current_admin)):
    try:
        uid = PydanticObjectId(user_id)
    except:
         raise HTTPException(400, "Invalid ID")
    
    u = await User.get(uid)
    if not u: raise HTTPException(404, "User not found")
    
    u.is_banned = False
    u.ban_reason = None
    await u.save()
    
    await log_admin_action(str(curr_admin.id), "unban_user", str(uid))
    return {"status": "unbanned"}

@router.get("/toggles")
async def get_toggles(curr_admin: User = Depends(get_current_admin)):
    # Return both Env vars (static) and DB config (dynamic)
    from app.core.config import settings
    
    # Try fetch dynamic overrides
    configs = await SystemConfig.find_all().to_list()
    config_map = {c.key: c.value for c in configs}
    
    return {
        "env_defaults": {
            "PROFILE_MIN_COMPLETION": settings.PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT,
            "FORCE_OPEN": settings.CHAT_NIGHT_FORCE_OPEN
        },
        "dynamic_overrides": config_map
    }

@router.post("/toggles")
async def set_toggle(key: str = Body(...), value: str = Body(...), curr_admin: User = Depends(get_current_admin)):
    # Persist to SystemConfig
    conf = await SystemConfig.find_one(SystemConfig.key == key)
    if not conf:
        conf = SystemConfig(key=key, value=value, updated_by=str(curr_admin.id))
        await conf.insert()
    else:
        conf.value = value
        conf.updated_by = str(curr_admin.id)
        conf.updated_at = datetime.utcnow()
        await conf.save()
        
    await log_admin_action(str(curr_admin.id), "update_config", meta={"key": key, "value": value})
    return {"status": "updated", "key": key, "value": value}
