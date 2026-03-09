from __future__ import annotations

import hmac
import os
from abc import ABC, abstractmethod
from functools import lru_cache

from starlette.concurrency import run_in_threadpool

from app.core.config import settings


OTP_SERVICE_NOT_CONFIGURED = "OTP service not configured"


class OtpServiceError(Exception):
    pass


class OtpServiceUnavailableError(OtpServiceError):
    pass


class OtpProvider(ABC):
    @abstractmethod
    async def start(self, phone: str) -> None:
        raise NotImplementedError

    @abstractmethod
    async def verify(self, phone: str, code: str) -> bool:
        raise NotImplementedError


class TestOtpProvider(OtpProvider):
    def __init__(self, test_code: str):
        normalized = (test_code or "").strip()
        self._test_code = normalized or "000000"

    async def start(self, phone: str) -> None:
        return None

    async def verify(self, phone: str, code: str) -> bool:
        normalized_code = (code or "").strip()
        return hmac.compare_digest(normalized_code, self._test_code)


class TwilioVerifyProvider(OtpProvider):
    def __init__(self, account_sid: str, auth_token: str, verify_service_sid: str):
        try:
            from twilio.rest import Client
        except Exception as exc:
            raise OtpServiceUnavailableError(OTP_SERVICE_NOT_CONFIGURED) from exc

        self._verify_service_sid = verify_service_sid
        self._client = Client(account_sid, auth_token)

    async def start(self, phone: str) -> None:
        def _start_verification() -> None:
            self._client.verify.v2.services(self._verify_service_sid).verifications.create(
                to=phone,
                channel="sms",
            )

        try:
            await run_in_threadpool(_start_verification)
        except Exception as exc:
            raise OtpServiceUnavailableError("OTP provider unavailable") from exc

    async def verify(self, phone: str, code: str) -> bool:
        def _verify_code():
            return self._client.verify.v2.services(self._verify_service_sid).verification_checks.create(
                to=phone,
                code=code,
            )

        try:
            check = await run_in_threadpool(_verify_code)
        except Exception as exc:
            raise OtpServiceUnavailableError("OTP provider unavailable") from exc

        return (getattr(check, "status", "") or "").lower() == "approved"


def _env_flag_enabled(name: str) -> bool:
    value = os.getenv(name, "").strip().lower()
    return value in {"1", "true", "yes", "on"}


@lru_cache(maxsize=1)
def get_otp_provider() -> OtpProvider:
    provider = settings.BH_OTP_PROVIDER

    if provider == "test":
        if not _env_flag_enabled("CHAT_NIGHT_TEST_MODE"):
            raise OtpServiceUnavailableError(OTP_SERVICE_NOT_CONFIGURED)
        return TestOtpProvider(settings.BH_OTP_TEST_CODE)

    if provider == "twilio":
        if not (
            settings.TWILIO_ACCOUNT_SID
            and settings.TWILIO_AUTH_TOKEN
            and settings.TWILIO_VERIFY_SERVICE_SID
        ):
            raise OtpServiceUnavailableError(OTP_SERVICE_NOT_CONFIGURED)

        return TwilioVerifyProvider(
            account_sid=settings.TWILIO_ACCOUNT_SID,
            auth_token=settings.TWILIO_AUTH_TOKEN,
            verify_service_sid=settings.TWILIO_VERIFY_SERVICE_SID,
        )

    raise OtpServiceUnavailableError(OTP_SERVICE_NOT_CONFIGURED)
