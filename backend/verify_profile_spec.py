
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pprint import pprint
import sys
import datetime

# --- CONFIG ---
DB_URL = "mongodb://localhost:27017"
DB_NAME = "blush_hour"

# --- HELPER: Manual Calculation of Score to Verify Backend Logic ---
def calculate_score(user):
    score = 0
    # 1. Base (Onboarding) - 50%
    if user.get("onboarding_completed"):
        score += 50
    else:
        # Check raw fields for fallback
        photos = user.get("photos") or []
        if user.get("first_name") and user.get("birth_date") and user.get("gender") and len(photos) >= 4:
            score += 50

    # 2. Bio - 10%
    bio = user.get("bio")
    if bio and len(bio.strip()) > 0:
        score += 10
        
    # 3. Prompts - 10%
    prompts = user.get("prompts") or []
    if len(prompts) >= 1:
        score += 10
            
    # 4. Interests/Values/Causes - 10%
    tag_count = len(user.get("interests") or []) + len(user.get("values") or []) + len(user.get("causes") or [])
    if tag_count > 0:
        score += 10
        
    # 5. Basics - 10% (Work, Location, Hometown) - relaxed rule: at least 2 present
    basics_count = 0
    if user.get("work"): basics_count += 1
    if user.get("location"): basics_count += 1
    if user.get("hometown"): basics_count += 1
    if basics_count >= 2:
        score += 10
        
    # 6. Details - 10% (Height, Habits, Religion, Politics, Signs, Kids, EduLevel)
    details_count = 0
    if user.get("height"): details_count += 1
    if user.get("star_sign"): details_count += 1
    if user.get("religion"): details_count += 1
    if user.get("politics"): details_count += 1
    if user.get("education_level"): details_count += 1
    if user.get("kids_have") or user.get("kids_want"): details_count += 1
    habits = user.get("habits") or {}
    if any(habits.values()): details_count += 1
        
    if details_count >= 3:
        score += 10
        
    return min(score, 100)

async def main():
    client = AsyncIOMotorClient(DB_URL)
    db = client[DB_NAME]
    collection = db["users"]
    
    print("--- 1. Fetching Latest User ---")
    user = await collection.find_one(sort=[("_id", -1)])
    if not user:
        print("No users found.")
        return

    user_id = str(user["_id"])
    print(f"User ID: {user_id}")
    print(f"Name: {user.get('first_name')}")
    print(f"Phone: {user.get('phone_number')}")
    print("\n--- 2. Field Existence Check ---")
    
    fields_to_check = [
        "education_level", "work", "location", "hometown", 
        "kids_have", "kids_want", "star_sign", 
        "interests", "values", "prompts"
    ]
    
    for f in fields_to_check:
        val = user.get(f)
        status = "✅ Present" if val else "❌ Missing/Null"
        print(f"{f}: {status} ({val})")
        
    print("\n--- 3. Onboarding & Completion Score Verification ---")
    onboarding_status = user.get("onboarding_completed", False)
    print(f"Onboarding Completed: {onboarding_status}")
    
    # Calculate score logic in script to compare with what backend WOULD return (property isn't stored in DB)
    calculated_score = calculate_score(user)
    print(f"Profile Completion (Calculated): {calculated_score}%")
    
    # Validation against spec
    print("\n--- 4. Integrity Report ---")
    if onboarding_status:
        # Check defaults for full profile
        if calculated_score < 50:
             print("⚠️ WARN: User is 'onboarding_completed' but score is < 50%.")
        else:
             print("✅ User is onboarded and has valid base score.")
             
        if calculated_score == 100:
             print("🎉 User has a Perfect 100% Profile!")
        elif calculated_score >= 80:
             print("👍 User has a Strong Profile (>80%)")
        else:
             print("ℹ️ User has an Average Profile.")
    else:
        print("ℹ️ User is NOT yet onboarding_completed.")


if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
