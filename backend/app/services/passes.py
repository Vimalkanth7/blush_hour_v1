import hashlib
import os
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Optional

from beanie import PydanticObjectId
from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.models.chat_night import ChatNightPass
from app.models.passes import PassCreditLedgerEntry, PassPurchase, UserPassWallet
from app.models.user import User
from app.schemas.passes import (
    PassPurchaseRead,
    PassPurchaseValidationRequest,
    PassPurchaseValidationResponse,
    UserPassWalletRead,
)
from app.services.google_play import (
    GooglePlayApiError,
    GooglePlayConfigurationError,
    GooglePlayPurchaseLineItem,
    consume_google_play_purchase,
    get_google_play_product_purchase,
)

CURRENT_PASSES_PLATFORM = "android"

DEFAULT_PASSES_CATALOG: tuple[dict[str, Any], ...] = (
    {
        "product_id": "pass_pack_1",
        "title": "Single Pass",
        "platform": "android",
        "active": True,
        "grant_type": "paid_pass_credits",
        "units_per_purchase": 1,
        "sort_order": 10,
    },
    {
        "product_id": "pass_pack_5",
        "title": "5 Pass Pack",
        "platform": "android",
        "active": True,
        "grant_type": "paid_pass_credits",
        "units_per_purchase": 5,
        "sort_order": 20,
    },
    {
        "product_id": "pass_pack_15",
        "title": "15 Pass Pack",
        "platform": "android",
        "active": True,
        "grant_type": "paid_pass_credits",
        "units_per_purchase": 15,
        "sort_order": 30,
    },
    {
        "product_id": "pass_pack_inactive_legacy",
        "title": "Legacy Pass Pack",
        "platform": "android",
        "active": False,
        "grant_type": "paid_pass_credits",
        "units_per_purchase": 3,
        "sort_order": 999,
    },
)

PURCHASE_GRANT_STATE_PENDING_VALIDATION = "pending_validation"
PURCHASE_GRANT_STATE_VALIDATION_FAILED = "validation_failed"
PURCHASE_GRANT_STATE_GRANTING = "granting"
PURCHASE_GRANT_STATE_GRANTED = "granted"

PURCHASE_STATE_PURCHASED = "PURCHASED"
PURCHASE_STATE_PENDING = "PENDING"
PURCHASE_STATE_CANCELLED = "CANCELLED"
PURCHASE_STATE_UNSPECIFIED = "PURCHASE_STATE_UNSPECIFIED"

PLAY_FINALIZATION_STATE_NOT_APPLICABLE = "not_applicable"
PLAY_FINALIZATION_STATE_NOT_STARTED = "not_started"
PLAY_FINALIZATION_STATE_CONSUMED = "consumed"
PLAY_FINALIZATION_STATE_ALREADY_CONSUMED = "already_consumed"
PLAY_FINALIZATION_STATE_CONSUME_PENDING = "consume_pending"

LEDGER_ENTRY_TYPE_PURCHASE_GRANT = "purchase_grant"
LEDGER_ENTRY_TYPE_CHAT_NIGHT_ENTRY_SPEND = "chat_night_entry_spend"
LEDGER_SOURCE_CHAT_NIGHT_ENTRY = "chat_night_entry"
PURCHASE_GRANT_LOCK_TIMEOUT = timedelta(minutes=5)
CHAT_NIGHT_ENTRY_SOURCE_FREE_DAILY = "free_daily"
CHAT_NIGHT_ENTRY_SOURCE_PAID_CREDIT = "paid_credit"
CHAT_NIGHT_ENTRY_SOURCE_NONE = "none"
STUB_PURCHASE_TOKEN_REGEX = re.compile(
    r"^stub[:._-](?P<product_id>[a-z0-9_]+)[:._-](?P<suffix>[a-z0-9_-]{6,})$",
    re.IGNORECASE,
)


@dataclass
class ValidatedPurchase:
    purchase_state: str
    order_id: Optional[str]
    acknowledgement_state: Optional[str]
    line_item: GooglePlayPurchaseLineItem
    is_test_purchase: bool = False
    obfuscated_external_account_id: Optional[str] = None
    purchase_completion_time: Optional[str] = None


@dataclass
class ChatNightEntryEntitlement:
    user_id: str
    date_ist: str
    free_passes_total: int
    free_passes_used: int
    free_passes_remaining: int
    paid_pass_credits: int
    effective_passes_remaining: int
    next_spend_source: str


@dataclass
class ChatNightEntryConsumption:
    user_id: str
    date_ist: str
    spend_source: str
    room_id: Optional[str] = None
    ledger_entry_id: Optional[str] = None


def _utcnow() -> datetime:
    return datetime.utcnow()


def _get_beanie_collection(document_model: Any):
    get_motor_collection = getattr(document_model, "get_motor_collection", None)
    if callable(get_motor_collection):
        return get_motor_collection()

    get_pymongo_collection = getattr(document_model, "get_pymongo_collection", None)
    if callable(get_pymongo_collection):
        return get_pymongo_collection()

    raise RuntimeError(f"{document_model.__name__} does not expose a supported Beanie collection accessor.")


def _normalize_phone_last_10(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) >= 10:
        return digits[-10:]
    return digits


def _is_chat_night_test_whitelisted(user: User) -> bool:
    if not user or not user.phone_number:
        return False

    whitelist_str = os.getenv("CHAT_NIGHT_TEST_USERS", "")
    if not whitelist_str:
        return False

    user_norm = _normalize_phone_last_10(user.phone_number)
    return any(
        _normalize_phone_last_10(raw_value.strip()) == user_norm
        for raw_value in whitelist_str.split(",")
        if raw_value.strip()
    )


def _get_chat_night_default_pass_total(user: User) -> int:
    total = 0

    if settings.CHAT_NIGHT_TEST_PASSES is not None:
        total = settings.CHAT_NIGHT_TEST_PASSES
    elif _is_chat_night_test_whitelisted(user):
        test_passes = os.getenv("CHAT_NIGHT_TEST_PASSES")
        if test_passes and test_passes.isdigit():
            total = int(test_passes)

    if total == 0:
        total = settings.CHAT_NIGHT_PASS_FEMALE if user.gender == "Woman" else settings.CHAT_NIGHT_PASS_MALE

    return max(int(total), 0)


async def get_or_create_chat_night_pass(user: User, date_ist: str) -> ChatNightPass:
    user_id = str(user.id)
    daily_pass = await ChatNightPass.find_one(
        ChatNightPass.user_id == user_id,
        ChatNightPass.date_ist == date_ist,
    )

    desired_total = _get_chat_night_default_pass_total(user)
    if daily_pass is None:
        daily_pass = ChatNightPass(
            user_id=user_id,
            date_ist=date_ist,
            passes_total=desired_total,
            passes_used=0,
        )
        await daily_pass.insert()
        return daily_pass

    if daily_pass.passes_total != desired_total:
        daily_pass.passes_total = desired_total
        daily_pass.updated_at = _utcnow()
        await daily_pass.save()

    return daily_pass


async def _load_chat_night_user(user_id: str) -> Optional[User]:
    try:
        user_object_id = PydanticObjectId(user_id)
    except Exception:
        return None
    try:
        return await User.get(user_object_id)
    except Exception:
        return None


async def get_chat_night_entry_entitlement(
    user: User,
    date_ist: str,
) -> ChatNightEntryEntitlement:
    daily_pass = await get_or_create_chat_night_pass(user, date_ist)
    free_passes_remaining = max(int(daily_pass.passes_total) - int(daily_pass.passes_used), 0)

    paid_pass_credits = 0
    if settings.BH_PASSES_ENABLED:
        wallet = await UserPassWallet.find_one(UserPassWallet.user_id == str(user.id))
        if wallet is not None:
            paid_pass_credits = max(int(wallet.paid_pass_credits), 0)

    next_spend_source = CHAT_NIGHT_ENTRY_SOURCE_NONE
    if free_passes_remaining > 0:
        next_spend_source = CHAT_NIGHT_ENTRY_SOURCE_FREE_DAILY
    elif paid_pass_credits > 0:
        next_spend_source = CHAT_NIGHT_ENTRY_SOURCE_PAID_CREDIT

    return ChatNightEntryEntitlement(
        user_id=str(user.id),
        date_ist=date_ist,
        free_passes_total=int(daily_pass.passes_total),
        free_passes_used=int(daily_pass.passes_used),
        free_passes_remaining=free_passes_remaining,
        paid_pass_credits=paid_pass_credits,
        effective_passes_remaining=free_passes_remaining + paid_pass_credits,
        next_spend_source=next_spend_source,
    )


async def get_chat_night_entry_entitlement_by_user_id(
    user_id: str,
    date_ist: str,
    user: Optional[User] = None,
) -> Optional[ChatNightEntryEntitlement]:
    target_user = user or await _load_chat_night_user(user_id)
    if target_user is None:
        return None
    return await get_chat_night_entry_entitlement(target_user, date_ist)


async def consume_chat_night_entry_entitlement(
    user: User,
    date_ist: str,
    room_id: Optional[str] = None,
) -> Optional[ChatNightEntryConsumption]:
    user_id = str(user.id)
    await get_or_create_chat_night_pass(user, date_ist)
    now = _utcnow()

    updated_pass = await _get_beanie_collection(ChatNightPass).find_one_and_update(
        {
            "user_id": user_id,
            "date_ist": date_ist,
            "$expr": {"$lt": ["$passes_used", "$passes_total"]},
        },
        {
            "$inc": {"passes_used": 1},
            "$set": {"updated_at": now},
        },
        return_document=ReturnDocument.AFTER,
    )
    if updated_pass is not None:
        return ChatNightEntryConsumption(
            user_id=user_id,
            date_ist=date_ist,
            spend_source=CHAT_NIGHT_ENTRY_SOURCE_FREE_DAILY,
            room_id=room_id,
        )

    if not settings.BH_PASSES_ENABLED:
        return None

    await get_or_create_user_pass_wallet(user_id)
    updated_wallet = await _get_beanie_collection(UserPassWallet).find_one_and_update(
        {"user_id": user_id, "paid_pass_credits": {"$gte": 1}},
        {"$inc": {"paid_pass_credits": -1}, "$set": {"updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if updated_wallet is None:
        return None

    wallet = UserPassWallet.model_validate(updated_wallet)
    ledger_entry = PassCreditLedgerEntry(
        user_id=user_id,
        wallet_id=str(wallet.id) if wallet.id is not None else None,
        entry_type=LEDGER_ENTRY_TYPE_CHAT_NIGHT_ENTRY_SPEND,
        delta_paid_pass_credits=-1,
        balance_after=wallet.paid_pass_credits,
        source=LEDGER_SOURCE_CHAT_NIGHT_ENTRY,
        source_ref=room_id,
        note="Chat Night entry spend",
    )
    try:
        await ledger_entry.insert()
    except Exception as exc:
        try:
            await _adjust_user_pass_wallet(user_id, 1)
        except Exception as rollback_exc:
            raise HTTPException(
                status_code=500,
                detail="Chat Night paid credit spend could not be finalized safely. Manual review is required.",
            ) from rollback_exc
        raise HTTPException(status_code=500, detail="Could not record Chat Night paid credit spend.") from exc

    return ChatNightEntryConsumption(
        user_id=user_id,
        date_ist=date_ist,
        spend_source=CHAT_NIGHT_ENTRY_SOURCE_PAID_CREDIT,
        room_id=room_id,
        ledger_entry_id=str(ledger_entry.id) if ledger_entry.id is not None else None,
    )


async def rollback_chat_night_entry_consumption(consumption: Optional[ChatNightEntryConsumption]) -> None:
    if consumption is None:
        return

    if consumption.spend_source == CHAT_NIGHT_ENTRY_SOURCE_FREE_DAILY:
        await _get_beanie_collection(ChatNightPass).find_one_and_update(
            {
                "user_id": consumption.user_id,
                "date_ist": consumption.date_ist,
                "passes_used": {"$gte": 1},
            },
            {
                "$inc": {"passes_used": -1},
                "$set": {"updated_at": _utcnow()},
            },
            return_document=ReturnDocument.AFTER,
        )
        return

    if consumption.spend_source != CHAT_NIGHT_ENTRY_SOURCE_PAID_CREDIT:
        return

    ledger_entry = None
    if consumption.ledger_entry_id:
        try:
            ledger_entry = await PassCreditLedgerEntry.get(PydanticObjectId(consumption.ledger_entry_id))
        except Exception:
            ledger_entry = None

    if ledger_entry is None and consumption.room_id:
        ledger_entry = await PassCreditLedgerEntry.find_one(
            PassCreditLedgerEntry.user_id == consumption.user_id,
            PassCreditLedgerEntry.source == LEDGER_SOURCE_CHAT_NIGHT_ENTRY,
            PassCreditLedgerEntry.source_ref == consumption.room_id,
        )

    await _adjust_user_pass_wallet(consumption.user_id, 1)
    if ledger_entry is None:
        return

    try:
        await ledger_entry.delete()
    except Exception as exc:
        try:
            await _adjust_user_pass_wallet(consumption.user_id, -1)
        except Exception as rollback_exc:
            raise HTTPException(
                status_code=500,
                detail="Chat Night paid credit rollback could not be finalized safely. Manual review is required.",
            ) from rollback_exc
        raise HTTPException(status_code=500, detail="Could not rollback Chat Night paid credit ledger.") from exc


def ensure_passes_enabled() -> None:
    if not settings.BH_PASSES_ENABLED:
        raise HTTPException(status_code=503, detail="Passes are disabled.")


def get_passes_provider_mode() -> str:
    return settings.BH_PASSES_PROVIDER_MODE


def get_passes_platform() -> str:
    return CURRENT_PASSES_PLATFORM


def get_active_pass_catalog(platform: Optional[str] = None) -> list[dict[str, Any]]:
    target_platform = platform or get_passes_platform()
    products = [
        dict(product)
        for product in DEFAULT_PASSES_CATALOG
        if product.get("active") and product.get("platform") in {target_platform, "all"}
    ]
    return sorted(
        products,
        key=lambda product: (int(product.get("sort_order", 0)), str(product.get("product_id", ""))),
    )


def build_user_pass_wallet_read(wallet: UserPassWallet) -> UserPassWalletRead:
    return UserPassWalletRead(
        user_id=wallet.user_id,
        paid_pass_credits=wallet.paid_pass_credits,
        created_at=wallet.created_at,
        updated_at=wallet.updated_at,
    )


def _hash_purchase_token(purchase_token: str) -> str:
    return hashlib.sha256(purchase_token.encode("utf-8")).hexdigest()


def _expected_google_account_obfuscation(user_id: str) -> str:
    return hashlib.sha256(f"blush-hour:{user_id}".encode("utf-8")).hexdigest()


def _get_catalog_product_or_400(product_id: str, platform: str) -> dict[str, Any]:
    for product in get_active_pass_catalog(platform):
        if product.get("product_id") == product_id:
            return product
    raise HTTPException(status_code=400, detail="Unsupported pass product.")


def _purchase_ledger_source(provider_mode: str) -> str:
    return f"passes_purchase_{provider_mode}"


def _build_purchase_response(
    purchase: PassPurchase,
    wallet: UserPassWallet,
    provider_mode: str,
    granted_units: int,
    already_granted: bool,
) -> PassPurchaseValidationResponse:
    return PassPurchaseValidationResponse(
        provider_mode=provider_mode,
        platform=purchase.platform,
        product_id=purchase.product_id,
        granted_units=granted_units,
        already_granted=already_granted,
        wallet=build_user_pass_wallet_read(wallet),
        purchase=PassPurchaseRead(
            purchase_state=purchase.purchase_state,
            grant_state=purchase.grant_state,
            order_id=purchase.order_id,
            quantity=purchase.quantity,
            is_test_purchase=purchase.is_test_purchase,
            play_finalization_state=purchase.play_finalization_state,
        ),
    )


def _compute_granted_units(product: dict[str, Any], quantity: int) -> int:
    return int(product.get("units_per_purchase", 0)) * max(quantity, 1)


async def get_or_create_user_pass_wallet(user_id: str) -> UserPassWallet:
    wallet = await UserPassWallet.find_one(UserPassWallet.user_id == user_id)
    if wallet is not None:
        return wallet

    wallet = UserPassWallet(user_id=user_id)
    try:
        await wallet.insert()
        return wallet
    except DuplicateKeyError:
        existing = await UserPassWallet.find_one(UserPassWallet.user_id == user_id)
        if existing is not None:
            return existing
        raise


async def _adjust_user_pass_wallet(user_id: str, delta: int) -> UserPassWallet:
    wallet = await get_or_create_user_pass_wallet(user_id)
    now = _utcnow()
    updated_wallet = await _get_beanie_collection(UserPassWallet).find_one_and_update(
        {"user_id": user_id},
        {"$inc": {"paid_pass_credits": delta}, "$set": {"updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    if updated_wallet is None:
        raise HTTPException(status_code=500, detail="Could not update the pass wallet.")
    return UserPassWallet.model_validate(updated_wallet)


async def _get_or_create_pass_purchase(
    user_id: str,
    provider_mode: str,
    request_data: PassPurchaseValidationRequest,
) -> PassPurchase:
    existing = await PassPurchase.find_one(PassPurchase.purchase_token == request_data.purchase_token)
    if existing is not None:
        return existing

    purchase = PassPurchase(
        user_id=user_id,
        provider=provider_mode,
        platform=request_data.platform,
        product_id=request_data.product_id,
        purchase_token=request_data.purchase_token,
        purchase_token_hash=_hash_purchase_token(request_data.purchase_token),
        order_id=request_data.order_id,
        play_finalization_state=(
            PLAY_FINALIZATION_STATE_NOT_APPLICABLE
            if provider_mode == "stub"
            else PLAY_FINALIZATION_STATE_NOT_STARTED
        ),
        updated_at=_utcnow(),
    )
    try:
        await purchase.insert()
        return purchase
    except DuplicateKeyError:
        existing = await PassPurchase.find_one(PassPurchase.purchase_token == request_data.purchase_token)
        if existing is not None:
            return existing
        raise


def _assert_purchase_request_matches_existing(
    purchase: PassPurchase,
    user_id: str,
    provider_mode: str,
    request_data: PassPurchaseValidationRequest,
) -> None:
    if purchase.user_id != user_id:
        raise HTTPException(status_code=400, detail="Purchase token is already associated with another user.")
    if purchase.provider != provider_mode:
        raise HTTPException(status_code=400, detail="Purchase token was recorded under a different provider mode.")
    if purchase.platform != request_data.platform:
        raise HTTPException(status_code=400, detail="Purchase token platform does not match the request.")
    if purchase.product_id != request_data.product_id:
        raise HTTPException(status_code=400, detail="Purchase token does not match the requested product.")
    if request_data.order_id and purchase.order_id and purchase.order_id != request_data.order_id:
        raise HTTPException(status_code=400, detail="Provided order_id does not match the recorded purchase.")


async def _mark_purchase_validation_failed(
    purchase: PassPurchase,
    code: str,
    detail: str,
    purchase_state: Optional[str] = None,
) -> None:
    now = _utcnow()
    purchase.grant_state = PURCHASE_GRANT_STATE_VALIDATION_FAILED
    purchase.processing_started_at = None
    purchase.validation_error_code = code
    purchase.validation_error_message = detail
    purchase.updated_at = now
    purchase.last_validated_at = now
    if purchase_state:
        purchase.purchase_state = purchase_state
    await purchase.save()


async def _apply_validated_purchase_details(
    purchase: PassPurchase,
    request_data: PassPurchaseValidationRequest,
    validated_purchase: ValidatedPurchase,
) -> PassPurchase:
    now = _utcnow()
    purchase.purchase_state = validated_purchase.purchase_state
    purchase.acknowledgement_state = validated_purchase.acknowledgement_state
    purchase.consumption_state = validated_purchase.line_item.consumption_state
    purchase.quantity = max(validated_purchase.line_item.quantity, 1)
    purchase.is_test_purchase = validated_purchase.is_test_purchase
    purchase.obfuscated_external_account_id = validated_purchase.obfuscated_external_account_id
    purchase.purchase_completion_time = validated_purchase.purchase_completion_time
    purchase.order_id = validated_purchase.order_id or purchase.order_id or request_data.order_id
    purchase.last_validated_at = now
    purchase.updated_at = now
    purchase.validation_error_code = None
    purchase.validation_error_message = None
    await purchase.save()
    return purchase


async def _claim_purchase_for_grant(purchase_token: str) -> Optional[PassPurchase]:
    now = _utcnow()
    stale_before = now - PURCHASE_GRANT_LOCK_TIMEOUT
    claimed = await _get_beanie_collection(PassPurchase).find_one_and_update(
        {
            "purchase_token": purchase_token,
            "$or": [
                {"grant_state": {"$in": [PURCHASE_GRANT_STATE_PENDING_VALIDATION, PURCHASE_GRANT_STATE_VALIDATION_FAILED]}},
                {
                    "grant_state": PURCHASE_GRANT_STATE_GRANTING,
                    "processing_started_at": {"$lt": stale_before},
                },
            ],
        },
        {
            "$set": {
                "grant_state": PURCHASE_GRANT_STATE_GRANTING,
                "processing_started_at": now,
                "updated_at": now,
                "validation_error_code": None,
                "validation_error_message": None,
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    if claimed is None:
        return None
    return PassPurchase.model_validate(claimed)


async def _mark_purchase_granted(
    purchase: PassPurchase,
    granted_units: int,
    wallet_balance_after_grant: int,
) -> PassPurchase:
    now = _utcnow()
    updated_purchase = await _get_beanie_collection(PassPurchase).find_one_and_update(
        {"_id": purchase.id},
        {
            "$set": {
                "granted_units": granted_units,
                "wallet_balance_after_grant": wallet_balance_after_grant,
                "grant_state": PURCHASE_GRANT_STATE_GRANTED,
                "granted_at": now,
                "processing_started_at": None,
                "updated_at": now,
                "validation_error_code": None,
                "validation_error_message": None,
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    if updated_purchase is None:
        raise HTTPException(status_code=500, detail="Could not persist the purchase grant.")
    return PassPurchase.model_validate(updated_purchase)


async def _get_existing_purchase_grant_ledger(purchase: PassPurchase) -> Optional[PassCreditLedgerEntry]:
    return await PassCreditLedgerEntry.find_one(
        {
            "entry_type": LEDGER_ENTRY_TYPE_PURCHASE_GRANT,
            "source": _purchase_ledger_source(purchase.provider),
            "source_ref": purchase.purchase_token_hash,
        }
    )


async def _ensure_purchase_grant_ledger(purchase: PassPurchase, wallet: UserPassWallet) -> None:
    existing_ledger = await _get_existing_purchase_grant_ledger(purchase)
    if existing_ledger is not None:
        return

    ledger_entry = PassCreditLedgerEntry(
        user_id=purchase.user_id,
        wallet_id=str(wallet.id) if wallet.id is not None else None,
        entry_type=LEDGER_ENTRY_TYPE_PURCHASE_GRANT,
        delta_paid_pass_credits=max(purchase.granted_units, 0),
        balance_after=purchase.wallet_balance_after_grant or wallet.paid_pass_credits,
        source=_purchase_ledger_source(purchase.provider),
        source_ref=purchase.purchase_token_hash,
        note=(
            f"{purchase.provider} purchase grant for {purchase.product_id}"
            + (f" order:{purchase.order_id}" if purchase.order_id else "")
        ),
    )
    await ledger_entry.insert()


def _validate_stub_purchase(request_data: PassPurchaseValidationRequest) -> ValidatedPurchase:
    match = STUB_PURCHASE_TOKEN_REGEX.fullmatch(request_data.purchase_token)
    if match is None:
        raise HTTPException(
            status_code=400,
            detail="Stub mode requires a synthetic purchase token matching 'stub-<product_id>-<suffix>'.",
        )

    token_product_id = match.group("product_id")
    if token_product_id != request_data.product_id:
        raise HTTPException(status_code=400, detail="Purchase token does not match the requested product.")

    synthetic_order_id = request_data.order_id or f"STUB-{request_data.product_id.upper()}-{match.group('suffix').upper()}"
    return ValidatedPurchase(
        purchase_state=PURCHASE_STATE_PURCHASED,
        order_id=synthetic_order_id,
        acknowledgement_state="ACKNOWLEDGEMENT_STATE_PENDING",
        line_item=GooglePlayPurchaseLineItem(
            product_id=request_data.product_id,
            quantity=1,
            consumption_state="CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
        ),
        is_test_purchase=True,
    )


async def _validate_google_purchase(request_data: PassPurchaseValidationRequest, user_id: str) -> ValidatedPurchase:
    try:
        google_purchase = await get_google_play_product_purchase(request_data.purchase_token)
    except GooglePlayConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except GooglePlayApiError as exc:
        if exc.status_code in {400, 404, 410}:
            raise HTTPException(status_code=400, detail="Google Play rejected the purchase token.") from exc
        raise HTTPException(status_code=503, detail="Google Play purchase validation is temporarily unavailable.") from exc

    line_item = None
    for candidate in google_purchase.line_items:
        if candidate.product_id == request_data.product_id:
            line_item = candidate
            break

    if line_item is None:
        raise HTTPException(status_code=400, detail="Purchase token does not match the requested product.")

    if request_data.order_id and google_purchase.order_id != request_data.order_id:
        raise HTTPException(status_code=400, detail="Provided order_id does not match Google Play.")

    expected_account_id = _expected_google_account_obfuscation(user_id)
    if (
        google_purchase.obfuscated_external_account_id
        and google_purchase.obfuscated_external_account_id != expected_account_id
    ):
        raise HTTPException(status_code=400, detail="Purchase is associated with a different app account.")

    return ValidatedPurchase(
        purchase_state=google_purchase.purchase_state,
        order_id=google_purchase.order_id,
        acknowledgement_state=google_purchase.acknowledgement_state,
        line_item=line_item,
        is_test_purchase=google_purchase.is_test_purchase,
        obfuscated_external_account_id=google_purchase.obfuscated_external_account_id,
        purchase_completion_time=google_purchase.purchase_completion_time,
    )


async def _validate_purchase_with_provider(
    request_data: PassPurchaseValidationRequest,
    user_id: str,
) -> ValidatedPurchase:
    provider_mode = get_passes_provider_mode()
    if provider_mode == "stub":
        return _validate_stub_purchase(request_data)
    return await _validate_google_purchase(request_data, user_id)


async def _finalize_google_purchase_if_needed(purchase: PassPurchase) -> PassPurchase:
    if purchase.provider != "google":
        purchase.play_finalization_state = PLAY_FINALIZATION_STATE_NOT_APPLICABLE
        return purchase

    if purchase.consumption_state == "CONSUMPTION_STATE_CONSUMED":
        purchase.play_finalization_state = PLAY_FINALIZATION_STATE_ALREADY_CONSUMED
        purchase.finalized_at = purchase.finalized_at or _utcnow()
        purchase.updated_at = _utcnow()
        await purchase.save()
        return purchase

    try:
        await consume_google_play_purchase(product_id=purchase.product_id, purchase_token=purchase.purchase_token)
        purchase.consumption_state = "CONSUMPTION_STATE_CONSUMED"
        purchase.play_finalization_state = PLAY_FINALIZATION_STATE_CONSUMED
        purchase.finalized_at = _utcnow()
        purchase.updated_at = _utcnow()
        await purchase.save()
        return purchase
    except GooglePlayConfigurationError:
        purchase.play_finalization_state = PLAY_FINALIZATION_STATE_CONSUME_PENDING
        purchase.validation_error_code = "google_finalize_unavailable"
        purchase.validation_error_message = "Google Play consume could not be completed because the provider is not configured."
    except GooglePlayApiError as exc:
        purchase.play_finalization_state = PLAY_FINALIZATION_STATE_CONSUME_PENDING
        purchase.validation_error_code = "google_finalize_failed"
        purchase.validation_error_message = "Google Play consume will need a retry."
        if exc.status_code == 400:
            try:
                refreshed_purchase = await get_google_play_product_purchase(purchase.purchase_token)
            except (GooglePlayApiError, GooglePlayConfigurationError):
                refreshed_purchase = None

            if refreshed_purchase is not None:
                for line_item in refreshed_purchase.line_items:
                    if line_item.product_id == purchase.product_id:
                        purchase.consumption_state = line_item.consumption_state
                        if line_item.consumption_state == "CONSUMPTION_STATE_CONSUMED":
                            purchase.play_finalization_state = PLAY_FINALIZATION_STATE_ALREADY_CONSUMED
                            purchase.finalized_at = purchase.finalized_at or _utcnow()
                        break

    purchase.updated_at = _utcnow()
    await purchase.save()
    return purchase


def _ensure_purchase_ready_to_grant(purchase: PassPurchase) -> None:
    if purchase.purchase_state == PURCHASE_STATE_PENDING:
        raise HTTPException(status_code=400, detail="Purchase is pending and cannot be granted yet.")
    if purchase.purchase_state == PURCHASE_STATE_CANCELLED:
        raise HTTPException(status_code=400, detail="Purchase was cancelled and cannot be granted.")
    if purchase.purchase_state == PURCHASE_STATE_UNSPECIFIED:
        raise HTTPException(status_code=400, detail="Purchase state is invalid.")
    if purchase.purchase_state != PURCHASE_STATE_PURCHASED:
        raise HTTPException(status_code=400, detail="Purchase is not in a grantable state.")
    if purchase.consumption_state == "CONSUMPTION_STATE_CONSUMED":
        raise HTTPException(status_code=400, detail="Purchase has already been consumed.")


async def validate_pass_purchase(
    current_user: User,
    request_data: PassPurchaseValidationRequest,
) -> PassPurchaseValidationResponse:
    ensure_passes_enabled()

    if request_data.platform != CURRENT_PASSES_PLATFORM:
        raise HTTPException(status_code=400, detail="Unsupported purchase platform.")

    product = _get_catalog_product_or_400(request_data.product_id, request_data.platform)
    provider_mode = get_passes_provider_mode()
    user_id = str(current_user.id)

    purchase = await _get_or_create_pass_purchase(user_id, provider_mode, request_data)
    _assert_purchase_request_matches_existing(purchase, user_id, provider_mode, request_data)

    try:
        validated_purchase = await _validate_purchase_with_provider(request_data, user_id)
    except HTTPException as exc:
        await _mark_purchase_validation_failed(
            purchase,
            code="provider_validation_failed",
            detail=str(exc.detail),
        )
        raise

    purchase = await _apply_validated_purchase_details(purchase, request_data, validated_purchase)

    if purchase.grant_state == PURCHASE_GRANT_STATE_GRANTED:
        wallet = await get_or_create_user_pass_wallet(user_id)
        await _ensure_purchase_grant_ledger(purchase, wallet)
        purchase = await _finalize_google_purchase_if_needed(purchase)
        granted_units = max(purchase.granted_units, _compute_granted_units(product, purchase.quantity))
        return _build_purchase_response(
            purchase=purchase,
            wallet=wallet,
            provider_mode=provider_mode,
            granted_units=granted_units,
            already_granted=True,
        )

    try:
        _ensure_purchase_ready_to_grant(purchase)
    except HTTPException as exc:
        await _mark_purchase_validation_failed(
            purchase,
            code="purchase_not_grantable",
            detail=str(exc.detail),
            purchase_state=purchase.purchase_state,
        )
        raise

    claimed_purchase = await _claim_purchase_for_grant(purchase.purchase_token)
    if claimed_purchase is None:
        refreshed_purchase = await PassPurchase.find_one(PassPurchase.purchase_token == purchase.purchase_token)
        if refreshed_purchase is not None and refreshed_purchase.grant_state == PURCHASE_GRANT_STATE_GRANTED:
            wallet = await get_or_create_user_pass_wallet(user_id)
            await _ensure_purchase_grant_ledger(refreshed_purchase, wallet)
            refreshed_purchase = await _finalize_google_purchase_if_needed(refreshed_purchase)
            granted_units = max(
                refreshed_purchase.granted_units,
                _compute_granted_units(product, refreshed_purchase.quantity),
            )
            return _build_purchase_response(
                purchase=refreshed_purchase,
                wallet=wallet,
                provider_mode=provider_mode,
                granted_units=granted_units,
                already_granted=True,
            )
        raise HTTPException(status_code=409, detail="Purchase validation is already in progress. Retry shortly.")

    granted_units = _compute_granted_units(product, claimed_purchase.quantity)
    wallet = await _adjust_user_pass_wallet(user_id, granted_units)

    try:
        claimed_purchase = await _mark_purchase_granted(
            purchase=claimed_purchase,
            granted_units=granted_units,
            wallet_balance_after_grant=wallet.paid_pass_credits,
        )
    except HTTPException as exc:
        try:
            wallet = await _adjust_user_pass_wallet(user_id, -granted_units)
            await _mark_purchase_validation_failed(
                claimed_purchase,
                code="grant_persist_failed",
                detail="Purchase verification succeeded but the local grant could not be saved. Retry the validation request.",
                purchase_state=claimed_purchase.purchase_state,
            )
        except Exception as rollback_exc:
            raise HTTPException(
                status_code=500,
                detail="Purchase verification succeeded but the local grant could not be finalized safely. Manual review is required.",
            ) from rollback_exc
        raise exc

    await _ensure_purchase_grant_ledger(claimed_purchase, wallet)
    claimed_purchase = await _finalize_google_purchase_if_needed(claimed_purchase)

    return _build_purchase_response(
        purchase=claimed_purchase,
        wallet=wallet,
        provider_mode=provider_mode,
        granted_units=granted_units,
        already_granted=False,
    )
