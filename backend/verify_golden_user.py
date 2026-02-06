import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pprint import pprint
import sys
import os
import datetime

DB_URL = "mongodb://localhost:27017"
DB_NAME = "blush_hour"

USER_PHONE = "9998887779"

async def main():
    client = AsyncIOMotorClient(DB_URL)
    db = client[DB_NAME]
    collection = db["users"]
    
    # Find specific user
    user = await collection.find_one({"phone_number": USER_PHONE})
    
    if not user:
        print(f"User {USER_PHONE} not found.")
        # Fallback to finding by partial match or just latest to see who was created
        print("Last 3 users created:")
        cursor = collection.find().sort("_id", -1).limit(3)
        async for doc in cursor:
            print(f"- {doc.get('phone_number')} (Status: {doc.get('onboarding_completed')})")
        return

    user['_id'] = str(user['_id'])
    pprint(user)
    
    # Validation Logic
    required_fields = ["photos", "birth_date", "dating_preference", "dating_mode", "gender", "first_name", "interests", "prompts"]
    missing = [f for f in required_fields if not user.get(f)]
    
    print("\n--- Validation ---")
    if missing:
        print(f"❌ Missing Required Fields: {missing}")
    else:
        print("✅ All Critical Fields Present")
        
    if user.get("onboarding_completed") and missing:
            print("⚠️ INTEGRITY ERROR: User is marked complete but has missing fields.")
    elif not user.get("onboarding_completed") and not missing:
            print("ℹ️ User has all data but is NOT marked complete (Logic Issue?).")
    elif user.get("onboarding_completed"):
            print("✅ Status is Correct (Complete).")
    else:
            print("✅ Status is Correct (Incomplete).")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
