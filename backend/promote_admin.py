import asyncio
import sys
import os
sys.path.append(os.getcwd())

from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings
from app.models.user import User

async def run():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(database=client[settings.DB_NAME], document_models=[User])
    
    phone = "1111111111"
    u = await User.find_one(User.phone_number == phone)
    if u:
        u.role = "admin"
        await u.save()
        print(f"User {phone} promoted to ADMIN.")
    else:
        print(f"User {phone} not found.")

if __name__ == "__main__":
    asyncio.run(run())
