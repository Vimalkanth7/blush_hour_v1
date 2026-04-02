import hashlib
import re

from fastapi import APIRouter, Body, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from app.auth.utils import create_access_token
from app.core.config import settings
from app.core.limiter import get_otp_start_limit, get_otp_start_limit_key, limiter
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.services.event_logger import log_event
from app.services.otp_service import (
    OTP_SERVICE_NOT_CONFIGURED,
    OtpServiceUnavailableError,
    get_otp_provider,
)
from app.services.phone import normalize_phone

router = APIRouter()

E164_PHONE_REGEX = re.compile(r"^\+[1-9]\d{7,14}$")
OTP_CODE_REGEX = re.compile(r"^\d{4,10}$")


class AuthRequest(BaseModel):
    phone_number: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    is_new_user: bool = False


class OtpStartRequest(BaseModel):
    phone: str = Field(..., min_length=9, max_length=16)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        normalized = value.strip()
        if not E164_PHONE_REGEX.fullmatch(normalized):
            raise ValueError("Phone must be a valid E.164 number.")
        return normalized


class OtpVerifyRequest(OtpStartRequest):
    code: str = Field(..., min_length=4, max_length=10)

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        normalized = value.strip()
        if not OTP_CODE_REGEX.fullmatch(normalized):
            raise ValueError("Code must be numeric.")
        return normalized


def _hash_phone(phone: str) -> str:
    return hashlib.sha256(phone.encode("utf-8")).hexdigest()


def _ensure_otp_enabled() -> None:
    if not settings.BH_OTP_ENABLED:
        raise HTTPException(status_code=503, detail="OTP login is disabled")


def _phone_lookup_candidates(phone: str) -> list[str]:
    normalized = normalize_phone(phone)
    candidates = [phone]

    if normalized and normalized not in candidates:
        candidates.append(normalized)

    if normalized and not normalized.startswith("+"):
        prefixed = f"+{normalized}"
        if prefixed not in candidates:
            candidates.append(prefixed)

    return candidates


async def _find_user_for_phone(phone: str):
    candidates = _phone_lookup_candidates(phone)
    return await User.find_one({"$or": [{"phone_number": value} for value in candidates]})


def _get_otp_provider_or_503():
    try:
        return get_otp_provider()
    except OtpServiceUnavailableError:
        raise HTTPException(status_code=503, detail=OTP_SERVICE_NOT_CONFIGURED)


@router.post("/register", response_model=LoginResponse)
@limiter.limit("5/minute")
async def register(request: Request, data: AuthRequest = Body(...)):
    # 1. Normalize
    norm_phone = normalize_phone(data.phone_number)

    # 2. Check Exists (Check normalized and raw just in case)
    user = await User.find_one(
        {"$or": [{"phone_number": norm_phone}, {"phone_number": data.phone_number}]}
    )

    if user:
         await log_event(
             "auth.register.failed",
             source="backend",
             payload={"reason": "duplicate", "phone_mask": norm_phone[:4] + "***"}
         )
         raise HTTPException(status_code=409, detail="Account already exists")

    hashed_pw = get_password_hash(data.password)

    # 3. Store ONLY normalized
    new_user = User(
        phone_number=norm_phone,
        password_hash=hashed_pw
    )
    await new_user.insert()

    await log_event("auth.register.success", source="backend", user_id=str(new_user.id))

    token = create_access_token({"sub": new_user.phone_number})

    return {
        "access_token": token,
        "token_type": "bearer",
        "is_new_user": True
    }


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(request: Request, data: AuthRequest = Body(...)):
    # 1. Normalize
    norm_phone = normalize_phone(data.phone_number)

    # 2. Lookup (Try normalized, then raw/others for backward compat)
    user = await User.find_one(
        {"$or": [
            {"phone_number": norm_phone},
            {"phone_number": data.phone_number},
            {"phone_number": f"+{norm_phone}"}  # Legacy support for +91 stored
        ]}
    )

    if not user:
        await log_event("auth.login.failed", source="backend", payload={"reason": "user_not_found"})
        raise HTTPException(status_code=400, detail="Invalid credentials")

    # Check password
    if not user.password_hash or not verify_password(data.password, user.password_hash):
        await log_event(
            "auth.login.failed",
            source="backend",
            user_id=str(user.id),
            payload={"reason": "bad_password"}
        )
        raise HTTPException(status_code=400, detail="Invalid credentials")

    await log_event("auth.login.success", source="backend", user_id=str(user.id))
    token = create_access_token({"sub": user.phone_number})

    return {
        "access_token": token,
        "token_type": "bearer",
        "is_new_user": False
    }


@router.post("/otp/start")
@limiter.limit(get_otp_start_limit, key_func=get_otp_start_limit_key)
async def otp_start(request: Request, data: OtpStartRequest = Body(...)):
    _ensure_otp_enabled()
    phone_hash = _hash_phone(data.phone)
    provider = _get_otp_provider_or_503()

    try:
        await provider.start(data.phone)
    except OtpServiceUnavailableError:
        await log_event(
            "auth.otp.start.failed",
            source="backend",
            payload={"reason": "provider_unavailable", "phone_sha256": phone_hash},
        )
        raise HTTPException(status_code=503, detail="OTP service unavailable")

    await log_event(
        "auth.otp.start.sent",
        source="backend",
        payload={"phone_sha256": phone_hash},
    )
    return {"status": "sent"}


@router.post("/otp/verify", response_model=LoginResponse)
@limiter.limit(settings.BH_OTP_VERIFY_RATE_LIMIT)
async def otp_verify(request: Request, data: OtpVerifyRequest = Body(...)):
    _ensure_otp_enabled()
    phone_hash = _hash_phone(data.phone)
    provider = _get_otp_provider_or_503()

    try:
        approved = await provider.verify(data.phone, data.code)
    except OtpServiceUnavailableError:
        await log_event(
            "auth.otp.verify.failed",
            source="backend",
            payload={"reason": "provider_unavailable", "phone_sha256": phone_hash},
        )
        raise HTTPException(status_code=503, detail="OTP service unavailable")

    if not approved:
        await log_event(
            "auth.otp.verify.failed",
            source="backend",
            payload={"reason": "invalid_code", "phone_sha256": phone_hash},
        )
        raise HTTPException(status_code=400, detail="Invalid code")

    user = await _find_user_for_phone(data.phone)
    is_new_user = False

    if not user:
        is_new_user = True
        storage_phone = normalize_phone(data.phone)
        user = User(phone_number=storage_phone)
        try:
            await user.insert()
        except Exception:
            # Handle race conditions on unique phone index.
            user = await _find_user_for_phone(data.phone)
            if not user:
                raise HTTPException(status_code=500, detail="Could not complete OTP login")
            is_new_user = False

    await log_event(
        "auth.otp.verify.success",
        source="backend",
        user_id=str(user.id),
        payload={"is_new_user": is_new_user, "phone_sha256": phone_hash},
    )

    token = create_access_token({"sub": user.phone_number})
    return {
        "access_token": token,
        "token_type": "bearer",
        "is_new_user": is_new_user,
    }
