import asyncio
import sys
import os
sys.path.append(os.getcwd())
try:
    from app.core.database import init_db
    from app.models.user import User
except ImportError:
    # If standard import fails, try relative or catch path issues
    sys.path.append('backend')
    from app.core.database import init_db
    from app.models.user import User

async def list_users():
    await init_db()
    users = await User.find_all().to_list()
    print(f"Total Users: {len(users)}")
    for u in users:
        print(f"ID: {u.id} | Name: '{u.first_name}' | Gender: {u.gender} | Onboarded: {u.onboarding_completed}")

if __name__ == "__main__":
    asyncio.run(list_users())
