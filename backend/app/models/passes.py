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
