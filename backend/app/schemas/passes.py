from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class PassCatalogProductRead(BaseModel):
    product_id: str
    title: str
    platform: str
    active: bool
    grant_type: str
    units_per_purchase: int = Field(..., ge=1)
    sort_order: int = 0


class PassesCatalogResponse(BaseModel):
    passes_enabled: bool = True
    provider_mode: str
    platform: str
    products: List[PassCatalogProductRead] = Field(default_factory=list)


class UserPassWalletRead(BaseModel):
    user_id: str
    paid_pass_credits: int = Field(..., ge=0)
    created_at: datetime
    updated_at: datetime


class PassesMeResponse(BaseModel):
    passes_enabled: bool = True
    provider_mode: str
    catalog_available: bool = True
    wallet: UserPassWalletRead


class PassPurchaseValidationRequest(BaseModel):
    product_id: str = Field(..., min_length=1, max_length=200)
    purchase_token: str = Field(..., min_length=8, max_length=4096)
    order_id: Optional[str] = Field(default=None, max_length=200)
    platform: str = Field(default="android", min_length=1, max_length=32)

    @field_validator("product_id", "purchase_token", "platform")
    @classmethod
    def trim_required_strings(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value must be non-empty.")
        return normalized

    @field_validator("order_id")
    @classmethod
    def trim_optional_order_id(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class PassPurchaseRead(BaseModel):
    purchase_state: str
    grant_state: str
    order_id: Optional[str] = None
    quantity: int = Field(default=1, ge=1)
    is_test_purchase: bool = False
    play_finalization_state: Optional[str] = None


class PassPurchaseValidationResponse(BaseModel):
    passes_enabled: bool = True
    provider_mode: str
    platform: str
    product_id: str
    granted_units: int = Field(..., ge=0)
    already_granted: bool = False
    wallet: UserPassWalletRead
    purchase: PassPurchaseRead
