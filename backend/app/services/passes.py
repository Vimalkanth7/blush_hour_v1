from typing import Any

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.models.passes import UserPassWallet

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


def ensure_passes_enabled() -> None:
    if not settings.BH_PASSES_ENABLED:
        raise HTTPException(status_code=503, detail="Passes are disabled.")


def get_passes_provider_mode() -> str:
    return settings.BH_PASSES_PROVIDER_MODE


def get_passes_platform() -> str:
    return CURRENT_PASSES_PLATFORM


def get_active_pass_catalog(platform: str | None = None) -> list[dict[str, Any]]:
    target_platform = platform or get_passes_platform()
    products = [
        dict(product)
        for product in DEFAULT_PASSES_CATALOG
        if product.get("active") and product.get("platform") in {target_platform, "all"}
    ]
    return sorted(products, key=lambda product: (int(product.get("sort_order", 0)), str(product.get("product_id", ""))))


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
