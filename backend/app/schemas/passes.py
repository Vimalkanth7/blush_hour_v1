from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


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
