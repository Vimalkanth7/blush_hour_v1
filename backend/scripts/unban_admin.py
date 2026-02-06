import asyncio
from app.main import lifespan
from fastapi import FastAPI
from app.models.user import User

async def unban_admin():
    app = FastAPI(lifespan=lifespan)
    async with lifespan(app):
        admin = await User.find_one(User.phone_number == "1111111111")
        if admin:
            admin.is_banned = False
            admin.ban_reason = None
            await admin.save()
            print(f"Unbanned admin {admin.id}")
        else:
            print("Admin not found")

if __name__ == "__main__":
    asyncio.run(unban_admin())
