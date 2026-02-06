import asyncio
import os
import sys

# Ensure we can import app
sys.path.append(os.getcwd())

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
from app.models.user import User

async def init_db_inline():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(database=client[settings.DB_NAME], document_models=[User])

async def fix_names():
    await init_db_inline()
    
    # 1. Find users with no first_name
    # Explicitly check for None or empty string
    users = await User.find(
        { "$or": [ {"first_name": None}, {"first_name": ""} ] }
    ).to_list()
    
    print(f"Found {len(users)} users with missing first_name.")
    
    for u in users:
        # Generate a placeholder name
        new_name = f"User{str(u.id)[-4:]}"
        u.first_name = new_name
        await u.save()
        print(f"Updated User {u.id} -> {new_name}")

if __name__ == "__main__":
    asyncio.run(fix_names())
