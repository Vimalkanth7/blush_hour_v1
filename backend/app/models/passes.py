from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import Field


class UserPassWallet(Document):
    user_id: str = Field(..., unique=True)
    paid_pass_credits: int = Field(default=0, ge=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "user_pass_wallets"
        indexes = [
            "updated_at",
            [("user_id", 1)],
        ]


class PassCreditLedgerEntry(Document):
    user_id: str = Field(..., index=True)
    wallet_id: Optional[str] = None
    entry_type: str
    delta_paid_pass_credits: int
    balance_after: int = Field(..., ge=0)
    source: str
    source_ref: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "pass_credit_ledger"
        indexes = [
            "created_at",
            "user_id",
            [("user_id", 1), ("created_at", -1)],
            [("source", 1), ("source_ref", 1)],
        ]


class PassPurchase(Document):
    user_id: str
    provider: str
    platform: str
    product_id: str
    purchase_token: str = Field(..., unique=True)
    purchase_token_hash: str
    order_id: Optional[str] = None
    quantity: int = Field(default=1, ge=1)
    granted_units: int = Field(default=0, ge=0)
    purchase_state: str = "PENDING"
    grant_state: str = "pending_validation"
    play_finalization_state: str = "not_started"
    acknowledgement_state: Optional[str] = None
    consumption_state: Optional[str] = None
    is_test_purchase: bool = False
    obfuscated_external_account_id: Optional[str] = None
    purchase_completion_time: Optional[str] = None
    last_validated_at: Optional[datetime] = None
    granted_at: Optional[datetime] = None
    finalized_at: Optional[datetime] = None
    processing_started_at: Optional[datetime] = None
    wallet_balance_after_grant: Optional[int] = Field(default=None, ge=0)
    validation_error_code: Optional[str] = None
    validation_error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "pass_purchases"
        indexes = [
            "updated_at",
            [("purchase_token", 1)],
            [("user_id", 1), ("created_at", -1)],
            [("user_id", 1), ("product_id", 1), ("created_at", -1)],
            [("provider", 1), ("order_id", 1)],
        ]
