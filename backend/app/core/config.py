from pydantic_settings import BaseSettings
from pydantic import validator
from typing import Optional

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

    class Config:
        env_file = ".env"

settings = Settings()
