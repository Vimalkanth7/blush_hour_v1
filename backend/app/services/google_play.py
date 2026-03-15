import json
import time
from dataclasses import dataclass, field
from typing import Any, List, Optional
from urllib.parse import quote

import httpx
from jose import jwt

from app.core.config import settings

ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_ANDROID_PUBLISHER_BASE_URL = "https://androidpublisher.googleapis.com/androidpublisher/v3"

_ACCESS_TOKEN_CACHE: dict[str, Any] = {
    "token": None,
    "expires_at": 0.0,
    "cache_key": None,
}


@dataclass
class GooglePlayPurchaseLineItem:
    product_id: str
    quantity: int = 1
    consumption_state: Optional[str] = None
    refundable_quantity: Optional[int] = None


@dataclass
class GooglePlayPurchaseValidation:
    order_id: Optional[str]
    purchase_state: str
    acknowledgement_state: Optional[str]
    line_items: List[GooglePlayPurchaseLineItem] = field(default_factory=list)
    is_test_purchase: bool = False
    obfuscated_external_account_id: Optional[str] = None
    purchase_completion_time: Optional[str] = None


class GooglePlayError(Exception):
    pass


class GooglePlayConfigurationError(GooglePlayError):
    pass


class GooglePlayApiError(GooglePlayError):
    def __init__(self, message: str, status_code: Optional[int] = None, retryable: bool = False):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.retryable = retryable


def is_google_play_configured() -> bool:
    return bool(
        settings.GOOGLE_PLAY_PACKAGE_NAME
        and (settings.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON or settings.GOOGLE_PLAY_SERVICE_ACCOUNT_FILE)
    )


def _safe_int(value: Any, default: int = 1) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(parsed, 1)


def _load_service_account_info() -> dict[str, Any]:
    raw_json = settings.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
    file_path = settings.GOOGLE_PLAY_SERVICE_ACCOUNT_FILE

    if raw_json:
        try:
            payload = json.loads(raw_json)
        except json.JSONDecodeError as exc:
            raise GooglePlayConfigurationError("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON.") from exc
    elif file_path:
        try:
            with open(file_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except FileNotFoundError as exc:
            raise GooglePlayConfigurationError("GOOGLE_PLAY_SERVICE_ACCOUNT_FILE was not found.") from exc
        except json.JSONDecodeError as exc:
            raise GooglePlayConfigurationError("GOOGLE_PLAY_SERVICE_ACCOUNT_FILE does not contain valid JSON.") from exc
    else:
        raise GooglePlayConfigurationError("Google Play service account credentials are not configured.")

    required_fields = ("client_email", "private_key")
    missing = [field_name for field_name in required_fields if not payload.get(field_name)]
    if missing:
        raise GooglePlayConfigurationError(
            f"Google Play service account credentials are missing required fields: {', '.join(missing)}."
        )

    return payload


def _token_cache_key(service_account_info: dict[str, Any]) -> str:
    return f"{service_account_info.get('client_email', '')}:{settings.GOOGLE_PLAY_PACKAGE_NAME or ''}"


def _clear_access_token_cache() -> None:
    _ACCESS_TOKEN_CACHE["token"] = None
    _ACCESS_TOKEN_CACHE["expires_at"] = 0.0
    _ACCESS_TOKEN_CACHE["cache_key"] = None


async def _get_access_token(force_refresh: bool = False) -> str:
    service_account_info = _load_service_account_info()
    cache_key = _token_cache_key(service_account_info)
    now = time.time()

    if (
        not force_refresh
        and _ACCESS_TOKEN_CACHE["token"]
        and _ACCESS_TOKEN_CACHE["cache_key"] == cache_key
        and float(_ACCESS_TOKEN_CACHE["expires_at"]) > now + 60
    ):
        return str(_ACCESS_TOKEN_CACHE["token"])

    token_uri = service_account_info.get("token_uri") or GOOGLE_OAUTH_TOKEN_URL
    issued_at = int(now)
    claims = {
        "iss": service_account_info["client_email"],
        "scope": ANDROID_PUBLISHER_SCOPE,
        "aud": token_uri,
        "iat": issued_at,
        "exp": issued_at + 3600,
    }
    headers = {}
    if service_account_info.get("private_key_id"):
        headers["kid"] = service_account_info["private_key_id"]

    assertion = jwt.encode(
        claims,
        service_account_info["private_key"],
        algorithm="RS256",
        headers=headers or None,
    )

    try:
        async with httpx.AsyncClient(timeout=settings.GOOGLE_PLAY_API_TIMEOUT_SECONDS) as client:
            response = await client.post(
                token_uri,
                data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": assertion,
                },
            )
    except httpx.HTTPError as exc:
        raise GooglePlayApiError("Unable to reach Google OAuth while validating the purchase.", retryable=True) from exc

    if response.status_code >= 400:
        if response.status_code in {400, 401, 403}:
            raise GooglePlayConfigurationError("Google Play credentials could not obtain an access token.")
        raise GooglePlayApiError(
            "Google OAuth token exchange failed.",
            status_code=response.status_code,
            retryable=response.status_code >= 500,
        )

    payload = response.json()
    access_token = payload.get("access_token")
    if not access_token:
        raise GooglePlayApiError("Google OAuth token exchange returned no access token.")

    expires_in = _safe_int(payload.get("expires_in"), default=3600)
    _ACCESS_TOKEN_CACHE["token"] = access_token
    _ACCESS_TOKEN_CACHE["expires_at"] = now + expires_in
    _ACCESS_TOKEN_CACHE["cache_key"] = cache_key
    return str(access_token)


async def _authorized_request(method: str, path: str, json_body: Optional[dict[str, Any]] = None) -> httpx.Response:
    if not settings.GOOGLE_PLAY_PACKAGE_NAME:
        raise GooglePlayConfigurationError("GOOGLE_PLAY_PACKAGE_NAME is not configured.")

    quoted_path = path.lstrip("/")

    for attempt in range(2):
        access_token = await _get_access_token(force_refresh=attempt > 0)
        try:
            async with httpx.AsyncClient(timeout=settings.GOOGLE_PLAY_API_TIMEOUT_SECONDS) as client:
                response = await client.request(
                    method=method,
                    url=f"{GOOGLE_ANDROID_PUBLISHER_BASE_URL}/{quoted_path}",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Accept": "application/json",
                    },
                    json=json_body,
                )
        except httpx.HTTPError as exc:
            raise GooglePlayApiError("Unable to reach Google Play while validating the purchase.", retryable=True) from exc

        if response.status_code != 401:
            return response

        _clear_access_token_cache()

    return response


def _ensure_ok_response(response: httpx.Response, invalid_token_statuses: set[int]) -> None:
    if response.status_code < 400:
        return

    if response.status_code in invalid_token_statuses:
        raise GooglePlayApiError("Google Play rejected the purchase token.", status_code=response.status_code)

    if response.status_code in {401, 403}:
        raise GooglePlayConfigurationError("Google Play validation is not authorized for this app.")

    raise GooglePlayApiError(
        "Google Play request failed.",
        status_code=response.status_code,
        retryable=response.status_code >= 500,
    )


async def get_google_play_product_purchase(purchase_token: str) -> GooglePlayPurchaseValidation:
    token_value = purchase_token.strip()
    if not token_value:
        raise GooglePlayApiError("Purchase token must be non-empty.")

    response = await _authorized_request(
        method="GET",
        path=(
            f"applications/{quote(settings.GOOGLE_PLAY_PACKAGE_NAME or '', safe='')}"
            f"/purchases/productsv2/tokens/{quote(token_value, safe='')}"
        ),
    )
    _ensure_ok_response(response, invalid_token_statuses={400, 404, 410})

    payload = response.json()
    line_items: List[GooglePlayPurchaseLineItem] = []
    for item in payload.get("productLineItem") or []:
        offer_details = item.get("productOfferDetails") or {}
        line_items.append(
            GooglePlayPurchaseLineItem(
                product_id=str(item.get("productId") or ""),
                quantity=_safe_int(offer_details.get("quantity"), default=1),
                consumption_state=offer_details.get("consumptionState"),
                refundable_quantity=_safe_int(offer_details.get("refundableQuantity"), default=1),
            )
        )

    return GooglePlayPurchaseValidation(
        order_id=payload.get("orderId"),
        purchase_state=((payload.get("purchaseStateContext") or {}).get("purchaseState") or "PURCHASE_STATE_UNSPECIFIED"),
        acknowledgement_state=payload.get("acknowledgementState"),
        line_items=line_items,
        is_test_purchase=bool(payload.get("testPurchaseContext")),
        obfuscated_external_account_id=payload.get("obfuscatedExternalAccountId"),
        purchase_completion_time=payload.get("purchaseCompletionTime"),
    )


async def consume_google_play_purchase(product_id: str, purchase_token: str) -> None:
    if not product_id.strip():
        raise GooglePlayApiError("Product id must be non-empty.")

    # Product status reads use productsv2, but consume is still exposed under purchases.products.
    response = await _authorized_request(
        method="POST",
        path=(
            f"applications/{quote(settings.GOOGLE_PLAY_PACKAGE_NAME or '', safe='')}"
            f"/purchases/products/{quote(product_id, safe='')}"
            f"/tokens/{quote(purchase_token.strip(), safe='')}:consume"
        ),
    )
    _ensure_ok_response(response, invalid_token_statuses={400, 404, 410})
