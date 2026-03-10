from uuid import uuid4

import anyio
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from app.auth.dependencies import get_current_user
from app.core.config import (
    PHOTOS_ALLOWED_TYPES,
    PHOTOS_MAX_BYTES,
    PHOTOS_PRESIGN_EXPIRES_SECONDS,
    settings,
)
from app.core.limiter import limiter
from app.models.user import User
from app.services.photo_storage import final_url_for_key, is_configured, presign_put_url

router = APIRouter()

MIME_TO_EXTENSION = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


class PhotoUploadUrlRequest(BaseModel):
    content_type: str
    content_length: int = Field(..., gt=0)

    @field_validator("content_type")
    @classmethod
    def normalize_content_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("content_type is required.")
        return normalized


class PhotoUploadUrlResponse(BaseModel):
    upload_url: str
    final_url: str
    key: str
    expires_in: int
    required_headers: dict[str, str]


def _ensure_photos_feature_ready() -> None:
    if not settings.BH_PHOTOS_ENABLED:
        raise HTTPException(status_code=503, detail="Photo uploads are disabled.")
    if not is_configured():
        raise HTTPException(status_code=503, detail="Photo storage is not configured.")


@router.post("/upload-url", response_model=PhotoUploadUrlResponse)
@limiter.limit("10/minute")
async def create_photo_upload_url(
    request: Request,
    data: PhotoUploadUrlRequest = Body(...),
    current_user: User = Depends(get_current_user),
):
    _ensure_photos_feature_ready()

    if data.content_type not in PHOTOS_ALLOWED_TYPES:
        allowed = ", ".join(sorted(PHOTOS_ALLOWED_TYPES))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content_type. Allowed: {allowed}.",
        )

    if data.content_length > PHOTOS_MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max allowed is {PHOTOS_MAX_BYTES} bytes.",
        )

    expires_in = min(PHOTOS_PRESIGN_EXPIRES_SECONDS, 300)
    extension = MIME_TO_EXTENSION[data.content_type]
    key = f"user/{current_user.id}/{uuid4().hex}.{extension}"

    upload_url = await anyio.to_thread.run_sync(
        presign_put_url,
        key,
        data.content_type,
        expires_in,
    )
    final_url = final_url_for_key(key)

    return PhotoUploadUrlResponse(
        upload_url=upload_url,
        final_url=final_url,
        key=key,
        expires_in=expires_in,
        required_headers={"Content-Type": data.content_type},
    )
