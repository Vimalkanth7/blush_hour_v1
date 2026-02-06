import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.models.user import User
from app.core.security import get_password_hash
from datetime import datetime
import httpx

# Configuration
DB_URL = "mongodb://localhost:27017"
DB_NAME = "blush_hour"

# Test Users Data
USERS = [
    {
        "phone_number": "9990008888", # SELF (Golden User)
        "password": "GoldenPass_2025!",
        "first_name": "Golden",
        "gender": "Man",
        "birth_date": datetime(1990, 1, 1),
        "photos": ["p1", "p2", "p3", "p4"],
        "onboarding_completed": True,
        # Score: 50 + ...
    },
    {
        "phone_number": "1110001111", # Other 1 (Target >= 60)
        "password": "Password123!",
        "first_name": "Alice",
        "gender": "Woman",
        "birth_date": datetime(1995, 5, 5),
        "photos": ["p1", "p2", "p3", "p4"],
        "onboarding_completed": True,
        "bio": "I am a high scoring profile!", # +10 points -> Total 60
        "is_verified": True
    },
    {
        "phone_number": "2220002222", # Other 2 (Target < 60)
        "password": "Password123!",
        "first_name": "Bob",
        "gender": "Man",
        "birth_date": datetime(1988, 8, 8),
        "photos": ["p1", "p2", "p3", "p4"],
        "onboarding_completed": True,
        "bio": "", # No points
        # Score: 50
    }
]

async def seed_db():
    print("🌱 Connecting to DB...")
    client = AsyncIOMotorClient(DB_URL)
    await init_beanie(database=client[DB_NAME], document_models=[User])
    
    print("🌱 Seeding Users...")
    for u_data in USERS:
        existing = await User.find_one(User.phone_number == u_data["phone_number"])
        if existing:
            # Update
            existing.onboarding_completed = u_data["onboarding_completed"]
            existing.first_name = u_data["first_name"]
            existing.birth_date = u_data["birth_date"]
            existing.photos = u_data["photos"]
            if "bio" in u_data:
                existing.bio = u_data["bio"]
            
            # Save
            await existing.save()
            print(f"   Updated {u_data['phone_number']} (Score: {existing.profile_completion})")
        else:
            # Create
            user = User(
                phone_number=u_data["phone_number"],
                password_hash=get_password_hash(u_data["password"]),
                first_name=u_data["first_name"],
                gender=u_data["gender"],
                birth_date=u_data["birth_date"],
                photos=u_data["photos"],
                onboarding_completed=u_data["onboarding_completed"],
                bio=u_data.get("bio")
            )
            await user.insert()
            print(f"   Created {u_data['phone_number']} (Score: {user.profile_completion})")

async def test_api():
    base_url = "http://localhost:8000"
    
    async with httpx.AsyncClient() as client:
        # 1. Login
        print("\n🔐 Logging in as Self (9990008888)...")
        login_res = await client.post(f"{base_url}/api/auth/login", json={
            "phone_number": "9990008888",
            "password": "GoldenPass_2025!"
        })
        
        if login_res.status_code != 200:
            print(f"❌ Login failed: {login_res.text}")
            return
            
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Call Discovery
        print("🔎 Creating Discovery Feed...")
        auth_res = await client.get(f"{base_url}/api/discovery/", headers=headers)
        
        if auth_res.status_code != 200:
            print(f"❌ Discovery failed: Status {auth_res.status_code} - {auth_res.text}")
            return
            
        data = auth_res.json()
        print(f"\n✅ RESPONSE LENGTH: {len(data)}")
        
        if len(data) > 0:
            print(f"✅ FIRST USER KEYS: {list(data[0].keys())}")
        else:
            print("⚠️ No users found in discovery (check filters)")

if __name__ == "__main__":
    # Run Seeding
    asyncio.run(seed_db())
    # Run API verify
    asyncio.run(test_api())
