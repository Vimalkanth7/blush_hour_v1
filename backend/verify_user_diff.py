
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pprint import pprint
import sys
import argparse

# --- CONFIG ---
DB_URL = "mongodb://localhost:27017"
DB_NAME = "blush_hour"

async def main():
    parser = argparse.ArgumentParser(description="Fetch and verify a user's data from MongoDB.")
    parser.add_argument("phone_number", help="The phone number of the user to verify (e.g., +1555...)")
    args = parser.parse_args()

    client = AsyncIOMotorClient(DB_URL)
    db = client[DB_NAME]
    collection = db["users"]
    
    print(f"--- Fetching User: {args.phone_number} ---")
    user = await collection.find_one({"phone_number": args.phone_number})
    
    if not user:
        print(f"❌ User with phone {args.phone_number} not found.")
        return

    # User found, sanitize ID for display
    user["_id"] = str(user["_id"])
    
    # Fields to Diff/Display
    fields_of_interest = ["bio", "work", "height", "interests", "photos"]
    
    print("\n--- Current DB State ---")
    for field in fields_of_interest:
        val = user.get(field)
        print(f"{field}: {val}")
        
    print("\n--- Full Document Dump (for detailed verification) ---")
    pprint(user)

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
