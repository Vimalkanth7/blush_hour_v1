from pydantic_settings import BaseSettings
from pydantic import validator
from typing import Optional

PHOTOS_MAX_BYTES = 5 * 1024 * 1024
PHOTOS_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
PHOTOS_PRESIGN_EXPIRES_SECONDS = 300


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "blush_hour"
    SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    ADMIN_TOKEN: Optional[str] = None # Protected admin endpoints disabled if None
    
    # Chat Night Dev Overrides
    CHAT_NIGHT_FORCE_OPEN: bool = False
    CHAT_NIGHT_TEST_PASSES: Optional[int] = None # If set, overrides daily passes for ALL users
    CHAT_NIGHT_PASS_MALE: int = 1
    CHAT_NIGHT_PASS_FEMALE: int = 2
    
    # Gating
    PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT: int = 0

    # OTP Auth
    BH_OTP_ENABLED: bool = True
    BH_OTP_PROVIDER: str = "twilio"  # twilio | test
    BH_OTP_TEST_CODE: str = "000000"
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_VERIFY_SERVICE_SID: Optional[str] = None

    # Photos / R2
    BH_PHOTOS_ENABLED: bool = True
    R2_ENDPOINT: Optional[str] = None
    R2_BUCKET: Optional[str] = None
    R2_ACCESS_KEY_ID: Optional[str] = None
    R2_SECRET_ACCESS_KEY: Optional[str] = None
    R2_PUBLIC_BASE_URL: Optional[str] = None

    # Voice / LiveKit
    BH_VOICE_ENABLED: bool = True
    LIVEKIT_URL: Optional[str] = None
    LIVEKIT_API_KEY: Optional[str] = None
    LIVEKIT_API_SECRET: Optional[str] = None
    LIVEKIT_TOKEN_TTL_SECONDS: int = 300

    # Safety tools
    BH_SAFETY_TOOLS_ENABLED: bool = True

    @validator("SECRET_KEY", pre=True, always=True)
    def validate_secret_key(cls, value):
        normalized = (value or "").strip()
        if not normalized:
            raise ValueError("SECRET_KEY must be set and non-empty before app startup.")
        return normalized

    @validator("BH_OTP_PROVIDER", pre=True, always=True)
    def validate_otp_provider(cls, value):
        normalized = (value or "twilio").strip().lower()
        if normalized not in {"twilio", "test"}:
            raise ValueError("BH_OTP_PROVIDER must be either 'twilio' or 'test'.")
        return normalized

    @validator(
        "R2_ENDPOINT",
        "R2_BUCKET",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        pre=True,
        always=True,
    )
    def normalize_optional_strings(cls, value):
        normalized = (value or "").strip()
        return normalized or None

    @validator("R2_PUBLIC_BASE_URL", pre=True, always=True)
    def normalize_r2_public_base_url(cls, value):
        normalized = (value or "").strip().rstrip("/")
        return normalized or None

    @validator("LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", pre=True, always=True)
    def normalize_livekit_strings(cls, value):
        normalized = (value or "").strip()
        return normalized or None

    @validator("LIVEKIT_TOKEN_TTL_SECONDS", pre=True, always=True)
    def clamp_livekit_token_ttl_seconds(cls, value):
        try:
            ttl_seconds = int(value)
        except (TypeError, ValueError):
            ttl_seconds = 300
        ttl_seconds = max(1, ttl_seconds)
        return min(ttl_seconds, 300)

    class Config:
        env_file = ".env"
        extra = "ignore"
settings = Settings()
