from __future__ import annotations

from typing import Dict
from urllib.parse import unquote

import boto3
from botocore.client import Config

from app.core.config import PHOTOS_PRESIGN_EXPIRES_SECONDS, settings


def is_configured() -> bool:
    return all(
        [
            settings.R2_ENDPOINT,
            settings.R2_BUCKET,
            settings.R2_ACCESS_KEY_ID,
            settings.R2_SECRET_ACCESS_KEY,
            settings.R2_PUBLIC_BASE_URL,
        ]
    )


def _get_client():
    if not is_configured():
        raise RuntimeError("Photo storage is not configured.")

    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )


def presign_put_url(key: str, content_type: str, expires: int = 300) -> str:
    client = _get_client()
    expires_in = max(1, min(expires, PHOTOS_PRESIGN_EXPIRES_SECONDS))
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.R2_BUCKET,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
        HttpMethod="PUT",
    )


def final_url_for_key(key: str) -> str:
    if not settings.R2_PUBLIC_BASE_URL:
        raise RuntimeError("R2 public base URL is not configured.")
    return f"{settings.R2_PUBLIC_BASE_URL}/{key}"


def key_from_final_url(url: str) -> str:
    if not settings.R2_PUBLIC_BASE_URL:
        raise ValueError("R2 public base URL is not configured.")

    base_prefix = f"{settings.R2_PUBLIC_BASE_URL}/"
    if not url.startswith(base_prefix):
        raise ValueError("Photo URL must use configured R2 public base URL.")

    key = unquote(url[len(base_prefix) :]).strip("/")
    if not key:
        raise ValueError("Photo URL key is missing.")
    return key


def head_object(key: str) -> Dict[str, str | int]:
    client = _get_client()
    response = client.head_object(Bucket=settings.R2_BUCKET, Key=key)
    return {
        "content_length": int(response.get("ContentLength") or 0),
        "content_type": str(response.get("ContentType") or "").lower(),
    }
