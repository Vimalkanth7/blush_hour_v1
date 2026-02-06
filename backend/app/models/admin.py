from typing import Optional, Dict
from beanie import Document
from pydantic import Field
from datetime import datetime

class AdminAuditLog(Document):
    admin_id: str
    action: str # e.g., 'ban_user', 'reset_passes', 'view_thread'
    target_user_id: Optional[str] = None
    target_object_id: Optional[str] = None # generic for thread_id etc
    metadata: Optional[Dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "admin_audit_logs"
        indexes = [
            "created_at",
            "admin_id",
            "target_user_id"
        ]

class SystemConfig(Document):
    """Dynamically adjustable system configuration"""
    key: str = Field(..., unique=True) # e.g. PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT
    value: str # Stored as string, parsed by consumer
    updated_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "system_config"
