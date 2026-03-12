from datetime import datetime, timezone

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth.dependencies import get_current_user
from app.core.config import settings
from app.core.limiter import limiter
from app.models.chat_night import ChatNightRoom
from app.models.safety import UserBlock
from app.models.user import User
from app.services.voice_tokens import VOICE_SERVICE_NOT_CONFIGURED, mint_livekit_access_token, is_voice_service_configured

router = APIRouter()


def get_now_utc() -> datetime:
    return datetime.now(timezone.utc)


def room_ends_at_utc(room: ChatNightRoom) -> datetime:
    if room.ends_at.tzinfo is None:
        return room.ends_at.replace(tzinfo=timezone.utc)
    return room.ends_at.astimezone(timezone.utc)


def user_room_filter(user_id: str) -> dict:
    return {"$or": [{"male_user_id": user_id}, {"female_user_id": user_id}]}


def _to_object_id(user_id: str) -> PydanticObjectId | None:
    try:
        return PydanticObjectId(user_id)
    except Exception:
        return None


async def has_user_blocked(blocker_user_id: str, blocked_user_id: str) -> bool:
    blocker_oid = _to_object_id(blocker_user_id)
    blocked_oid = _to_object_id(blocked_user_id)
    if not blocker_oid or not blocked_oid:
        return False
    record = await UserBlock.find_one(
        UserBlock.blocker_user_id == blocker_oid,
        UserBlock.blocked_user_id == blocked_oid,
    )
    return record is not None


async def is_pair_blocked(user_a_id: str, user_b_id: str) -> bool:
    if not user_a_id or not user_b_id or user_a_id == user_b_id:
        return False
    if await has_user_blocked(user_a_id, user_b_id):
        return True
    return await has_user_blocked(user_b_id, user_a_id)


async def enforce_room_not_blocked(room: ChatNightRoom) -> None:
    if not await is_pair_blocked(room.male_user_id, room.female_user_id):
        return
    if room.state in {"active", "engaged"}:
        room.state = "ended"
        await room.save()
    raise HTTPException(status_code=403, detail="This match is unavailable.")


async def find_eligible_engaged_room(user_id: str, now: datetime) -> ChatNightRoom | None:
    rooms = await ChatNightRoom.find(
        {
            **user_room_filter(user_id),
            "state": "engaged",
            "ends_at": {"$gt": now},
        }
    ).sort(-ChatNightRoom.starts_at).to_list()
    return rooms[0] if rooms else None


async def find_latest_user_room(user_id: str) -> ChatNightRoom | None:
    rooms = await ChatNightRoom.find(user_room_filter(user_id)).sort(-ChatNightRoom.starts_at).to_list()
    return rooms[0] if rooms else None


def ensure_voice_feature_ready() -> None:
    if not settings.BH_VOICE_ENABLED:
        raise HTTPException(status_code=503, detail="Voice is temporarily unavailable.")
    if not is_voice_service_configured():
        raise HTTPException(status_code=503, detail=VOICE_SERVICE_NOT_CONFIGURED)


@router.post("/token")
@limiter.limit("10/minute")
async def create_voice_token(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    ensure_voice_feature_ready()

    user_id = str(current_user.id)
    now = get_now_utc()

    room = await find_eligible_engaged_room(user_id, now)
    if room:
        await enforce_room_not_blocked(room)
        return mint_livekit_access_token(chat_night_room_id=room.room_id, user_id=user_id)

    latest_room = await find_latest_user_room(user_id)
    if latest_room is None:
        raise HTTPException(
            status_code=409,
            detail="You are not in an engaged Chat Night room.",
        )

    await enforce_room_not_blocked(latest_room)

    if latest_room.state == "ended" or room_ends_at_utc(latest_room) <= now:
        raise HTTPException(
            status_code=410,
            detail="Your Chat Night room has expired or ended.",
        )

    raise HTTPException(
        status_code=409,
        detail="Voice token is only available for engaged rooms.",
    )
