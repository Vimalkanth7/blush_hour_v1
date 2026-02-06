import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie, PydanticObjectId, Document
from app.core.config import settings
from app.models.user import User
from app.models.chat_night import MatchUnlocked
from app.models.chat import ChatThread, ChatMessage
from app.models.events import AppEvent
from app.models.chat_night import ChatNightPass, ChatNightRoom 
import uuid
# We need passlib context for password hash? No, just use placeholders.
from app.core.security import get_password_hash

async def setup_test_data():
    print("Initializing DB...")
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.DB_NAME], 
        document_models=[User, ChatNightPass, ChatNightRoom, MatchUnlocked, AppEvent, ChatThread, ChatMessage]
    )
    
    print("Clearing Chat Data for clean test...")
    await ChatThread.delete_all()
    await ChatMessage.delete_all()
    # Optionally clear users if needed, but let's just ensure our test users exist
    
    # Create User A
    user_a = await User.find_one(User.phone_number == "1111111111")
    if not user_a:
        user_a = User(
            phone_number="1111111111", 
            password_hash=get_password_hash("TestPass123!"),
            first_name="Alice",
            gender="Woman"
        )
        await user_a.insert()
        print("Created User A (1111111111)")
    else:
        print("User A exists")
        
    # Create User B
    user_b = await User.find_one(User.phone_number == "2222222222")
    if not user_b:
        user_b = User(
            phone_number="2222222222", 
            password_hash=get_password_hash("TestPass123!"),
            first_name="Bob",
            gender="Man"
        )
        await user_b.insert()
        print("Created User B (2222222222)")
    else:
        print("User B exists")

    # Create User C (Intruder)
    user_c = await User.find_one(User.phone_number == "3333333333")
    if not user_c:
        user_c = User(
            phone_number="3333333333", 
            password_hash=get_password_hash("TestPass123!"),
            first_name="Charlie"
        )
        await user_c.insert()
        print("Created User C (3333333333)")
    else:
        print("User C exists")

    # Create MatchUnlocked between A and B
    # Check existing
    match = await MatchUnlocked.find_one({"user_ids": {"$all": [str(user_a.id), str(user_b.id)]}})
    if not match:
        match = MatchUnlocked(
            user_ids=[str(user_a.id), str(user_b.id)],
            room_id=str(uuid.uuid4())
        )
        await match.insert()
        print(f"Created MatchUnlocked: {match.id}")
    else:
        print(f"Match exists: {match.id}")
        
    print("Setup Complete.")

if __name__ == "__main__":
    asyncio.run(setup_test_data())
