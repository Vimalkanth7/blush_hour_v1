import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pprint import pprint
import sys
import os
import datetime

DB_URL = "mongodb://localhost:27017"
DB_NAME = "blush_hour"

def serialize(obj):
    if isinstance(obj, datetime.datetime):
        return obj.isoformat()
    return obj

async def main():
    client = AsyncIOMotorClient(DB_URL)
    db = client[DB_NAME]
    collection = db["users"]
    
    count = await collection.count_documents({})
    print(f"Total users: {count}")
    
    if count == 0:
        print("No users found.")
        return

    # Fetch latest by _id desc
    cursor = collection.find().sort("_id", -1).limit(1)
    async for doc in cursor:
        doc['_id'] = str(doc['_id'])
        pprint(doc)

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
