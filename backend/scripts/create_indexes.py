import asyncio
import os
import sys

# Add backend root to path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.core.config import settings
from app.models.user import User
from app.models.chat_night import ChatNightPass, ChatNightRoom, MatchUnlocked
from app.models.chat import ChatThread, ChatMessage
from app.models.events import AppEvent

async def create_indexes():
    print(f"Connecting to MongoDB at {settings.MONGODB_URL}...")
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    
    print(f"Initializing Beanie for database: {settings.DB_NAME}")
    await init_beanie(
        database=client[settings.DB_NAME], 
        document_models=[
            User, 
            ChatNightPass, 
            ChatNightRoom, 
            MatchUnlocked,
            AppEvent,
            ChatThread,
            ChatMessage
        ]
    )
    print("Indexes created successfully.")

if __name__ == "__main__":
    asyncio.run(create_indexes())
