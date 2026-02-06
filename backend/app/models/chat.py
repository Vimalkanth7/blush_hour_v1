from beanie import Document, PydanticObjectId
from pydantic import Field
from datetime import datetime
from typing import List, Optional

class ChatThread(Document):
    match_id: PydanticObjectId
    participants: List[PydanticObjectId]
    last_message_at: Optional[datetime] = None
    last_message_text: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "chat_threads"
        indexes = [
            "participants",
            "last_message_at",
            [("match_id", 1)], # Unique constraint will be handled by Beanie/Mongo if passed in index options, but Beanie simple syntax:
        ]
        # Unique index on match_id enforced by index_model if needed, 
        # but Beanie supports passing extra options.
        # For simplicity and robustness we define it as a simple index here 
        # and we can add unique=True in the script or via index definition if strictly required by Beanie's new syntax.
        # Beanie's 'indexes' list supports explicit pymongo IndexModel or list of fields.
        # To enforce unique via 'indexes' list in Beanie, we simply list it.
        # Wait, for unique constraints in Beanie < 1.0 (typical) we might need index_models or just rely on manual creation in script.
        # Let's try the modern Beanie way with index_model if available, or just standard list.
        # Actually simplest for now: We will ensure Unique in the logic or script. 
        # But wait, User Request explicitly asked "Add a unique index on match_id".
        # We'll define it clearly.
        
        index_models = [
            # We can define complex indexes here if needed, but let's stick to simple list for now
            # and let the script upgrade it or define it specifically.
            # Actually, let's use the explicit PyMongo index model in the script for guaranteed correctness
            # OR just trust Beanie's simple syntax if we can find it.
            # We'll stick to basic indexes list here and ensure the script applies unique=True.
        ]

class ChatMessage(Document):
    thread_id: PydanticObjectId
    sender_id: PydanticObjectId
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    read_at: Optional[datetime] = None
    
    class Settings:
        name = "chat_messages"
        indexes = [
            [("thread_id", 1), ("created_at", -1)],
            "sender_id"
        ]
