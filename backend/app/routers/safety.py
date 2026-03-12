from fastapi import APIRouter, Body, Depends, HTTPException, Request
from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from app.auth.dependencies import get_current_user
from app.core.config import settings
from app.core.limiter import limiter
from app.models.safety import UserBlock, UserMute, UserReport
from app.models.user import User
from app.schemas.safety import (
    BlockListItem,
    BlockListResponse,
    BlockRequest,
    MuteListItem,
    MuteListResponse,
    MuteRequest,
    ReportRequest,
    StatusOKResponse,
)
from app.services.event_logger import log_event

router = APIRouter()


def _parse_target_user_id(target_user_id: str) -> PydanticObjectId:
    try:
        return PydanticObjectId(target_user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid target_user_id")


def _ensure_safety_tools_enabled() -> None:
    if not settings.BH_SAFETY_TOOLS_ENABLED:
        raise HTTPException(status_code=503, detail="Safety tools are disabled.")


def _ensure_target_not_self(actor_user_id: PydanticObjectId, target_user_id: PydanticObjectId) -> None:
    if actor_user_id == target_user_id:
        raise HTTPException(status_code=400, detail="target_user_id must be a different user")


@router.post("/block", response_model=StatusOKResponse)
@limiter.limit("20/minute")
async def block_user(
    request: Request,
    data: BlockRequest = Body(...),
    current_user: User = Depends(get_current_user),
):
    actor_user_id = current_user.id
    target_user_id = _parse_target_user_id(data.target_user_id)
    _ensure_target_not_self(actor_user_id, target_user_id)

    existing = await UserBlock.find_one(
        UserBlock.blocker_user_id == actor_user_id,
        UserBlock.blocked_user_id == target_user_id,
    )

    if not existing:
        try:
            await UserBlock(
                blocker_user_id=actor_user_id,
                blocked_user_id=target_user_id,
            ).insert()
        except DuplicateKeyError:
            pass

    await log_event(
        "safety.block",
        source="backend",
        user_id=str(actor_user_id),
        payload={"target_user_id": str(target_user_id)},
    )
    return StatusOKResponse()


@router.post("/unblock", response_model=StatusOKResponse)
@limiter.limit("20/minute")
async def unblock_user(
    request: Request,
    data: BlockRequest = Body(...),
    current_user: User = Depends(get_current_user),
):
    actor_user_id = current_user.id
    target_user_id = _parse_target_user_id(data.target_user_id)
    _ensure_target_not_self(actor_user_id, target_user_id)

    existing = await UserBlock.find_one(
        UserBlock.blocker_user_id == actor_user_id,
        UserBlock.blocked_user_id == target_user_id,
    )
    if existing:
        await existing.delete()

    await log_event(
        "safety.unblock",
        source="backend",
        user_id=str(actor_user_id),
        payload={"target_user_id": str(target_user_id)},
    )
    return StatusOKResponse()


@router.get("/blocks", response_model=BlockListResponse)
async def list_blocks(current_user: User = Depends(get_current_user)):
    records = await UserBlock.find(
        UserBlock.blocker_user_id == current_user.id
    ).sort(-UserBlock.created_at).to_list()

    return BlockListResponse(
        blocks=[
            BlockListItem(target_user_id=str(record.blocked_user_id), created_at=record.created_at)
            for record in records
        ]
    )


@router.post("/mute", response_model=StatusOKResponse)
@limiter.limit("20/minute")
async def mute_user(
    request: Request,
    data: MuteRequest = Body(...),
    current_user: User = Depends(get_current_user),
):
    _ensure_safety_tools_enabled()

    actor_user_id = current_user.id
    target_user_id = _parse_target_user_id(data.target_user_id)
    _ensure_target_not_self(actor_user_id, target_user_id)

    existing = await UserMute.find_one(
        UserMute.muter_user_id == actor_user_id,
        UserMute.muted_user_id == target_user_id,
    )

    if not existing:
        try:
            await UserMute(
                muter_user_id=actor_user_id,
                muted_user_id=target_user_id,
            ).insert()
        except DuplicateKeyError:
            pass

    await log_event(
        "safety.mute",
        source="backend",
        user_id=str(actor_user_id),
        payload={"target_user_id": str(target_user_id)},
    )
    return StatusOKResponse()


@router.post("/unmute", response_model=StatusOKResponse)
@limiter.limit("20/minute")
async def unmute_user(
    request: Request,
    data: MuteRequest = Body(...),
    current_user: User = Depends(get_current_user),
):
    _ensure_safety_tools_enabled()

    actor_user_id = current_user.id
    target_user_id = _parse_target_user_id(data.target_user_id)
    _ensure_target_not_self(actor_user_id, target_user_id)

    existing = await UserMute.find_one(
        UserMute.muter_user_id == actor_user_id,
        UserMute.muted_user_id == target_user_id,
    )
    if existing:
        await existing.delete()

    await log_event(
        "safety.unmute",
        source="backend",
        user_id=str(actor_user_id),
        payload={"target_user_id": str(target_user_id)},
    )
    return StatusOKResponse()


@router.get("/mutes", response_model=MuteListResponse)
async def list_mutes(current_user: User = Depends(get_current_user)):
    _ensure_safety_tools_enabled()

    records = await UserMute.find(
        UserMute.muter_user_id == current_user.id
    ).sort(-UserMute.created_at).to_list()

    return MuteListResponse(
        mutes=[
            MuteListItem(target_user_id=str(record.muted_user_id), created_at=record.created_at)
            for record in records
        ]
    )


@router.post("/report", response_model=StatusOKResponse)
@limiter.limit("10/minute")
async def report_user(
    request: Request,
    data: ReportRequest = Body(...),
    current_user: User = Depends(get_current_user),
):
    _ensure_safety_tools_enabled()

    actor_user_id = current_user.id
    target_user_id = _parse_target_user_id(data.target_user_id)
    _ensure_target_not_self(actor_user_id, target_user_id)

    await UserReport(
        reporter_user_id=actor_user_id,
        reported_user_id=target_user_id,
        room_id=data.room_id,
        category=data.category,
        details=data.details,
    ).insert()

    payload = {
        "target_user_id": str(target_user_id),
        "category": data.category,
    }
    if data.room_id:
        payload["room_id"] = data.room_id

    await log_event(
        "safety.report",
        source="backend",
        user_id=str(actor_user_id),
        payload=payload,
    )
    return StatusOKResponse()
