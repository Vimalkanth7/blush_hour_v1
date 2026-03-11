from datetime import timedelta

from livekit import api

from app.core.config import settings

VOICE_SERVICE_NOT_CONFIGURED = "Voice service not configured"


def is_voice_service_configured() -> bool:
    return bool(settings.LIVEKIT_URL and settings.LIVEKIT_API_KEY and settings.LIVEKIT_API_SECRET)


def build_voice_identity(user_id: str) -> str:
    return f"u_{user_id}"


def build_voice_room_name(chat_night_room_id: str) -> str:
    return f"chatnight-{chat_night_room_id}"


def get_voice_token_ttl_seconds() -> int:
    ttl_seconds = settings.LIVEKIT_TOKEN_TTL_SECONDS
    return min(max(1, ttl_seconds), 300)


def mint_livekit_access_token(chat_night_room_id: str, user_id: str) -> dict:
    if not is_voice_service_configured():
        raise RuntimeError(VOICE_SERVICE_NOT_CONFIGURED)

    room_name = build_voice_room_name(chat_night_room_id)
    identity = build_voice_identity(user_id)
    ttl_seconds = get_voice_token_ttl_seconds()

    token = (
        api.AccessToken(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
        .with_identity(identity)
        .with_grants(api.VideoGrants(room_join=True, room=room_name))
        .with_ttl(timedelta(seconds=ttl_seconds))
        .to_jwt()
    )

    return {
        "url": settings.LIVEKIT_URL,
        "token": token,
        "room": room_name,
        "identity": identity,
        "expires_in": ttl_seconds,
    }
