from urllib.parse import urlparse

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

LOCALHOST_HOSTS = {"127.0.0.1", "::1", "localhost", "testclient"}


def _request_header_host(request: Request) -> str:
    for header_name in ("origin", "referer"):
        header_value = (request.headers.get(header_name) or "").strip()
        if not header_value:
            continue
        try:
            parsed = urlparse(header_value)
        except ValueError:
            continue
        hostname = (parsed.hostname or "").strip().lower()
        if hostname:
            return hostname

    host_header = (request.headers.get("host") or "").split(":", 1)[0].strip().lower()
    return host_header


def is_localhost_request(request: Request) -> bool:
    client_host = (request.client.host if request.client else "").strip().lower()
    if client_host in LOCALHOST_HOSTS:
        return True

    return _request_header_host(request) in LOCALHOST_HOSTS


def get_otp_start_limit_key(request: Request) -> str:
    remote_address = get_remote_address(request)
    if settings.BH_OTP_PROVIDER == "test" and is_localhost_request(request):
        return f"otp-local-dev:{remote_address}"

    return remote_address


def get_otp_start_limit(key: str) -> str:
    if key.startswith("otp-local-dev:"):
        return settings.BH_OTP_LOCAL_DEV_START_RATE_LIMIT

    return settings.BH_OTP_START_RATE_LIMIT


limiter = Limiter(key_func=get_remote_address)
