from fastapi import FastAPI
from contextlib import asynccontextmanager
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from app.core.config import settings
from app.models.user import User
from app.models.chat_night import ChatNightPass, ChatNightRoom, MatchUnlocked
from app.models.events import AppEvent
from app.models.chat import ChatThread, ChatMessage
from app.models.admin import AdminAuditLog, SystemConfig
from app.routers import auth, users, discovery, chat_night, admin, chat

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    await init_beanie(
        database=client[settings.DB_NAME], 
        document_models=[
            User, 
            ChatNightPass, 
            ChatNightRoom, 
            MatchUnlocked,
            AppEvent,
            ChatThread,
            ChatMessage,
            AdminAuditLog,
            SystemConfig
        ]
    )
    print("Startup: Connected to MongoDB and initialized Beanie models.")
    yield
    # Shutdown
    print("Shutdown: Closing connections...")

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.limiter import limiter

app = FastAPI(title="Blush Hour Backend", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"Global Error: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)},
    )

from fastapi.middleware.cors import CORSMiddleware

origins = [
    # Allow localhost for development
    "http://localhost:8081",
    "http://localhost:8082",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:8082",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(discovery.router, prefix="/api/discovery", tags=["discovery"])
app.include_router(chat_night.router, prefix="/api/chat-night", tags=["chat-night"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])

@app.get("/")
async def read_root():
    return {"message": "Blush Hour Backend is running", "status": "active"}

@app.get("/health")
async def health_check():
    # Verify DB connectivity
    try:
        await User.find_one(User.phone_number == "0000000000")
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
        
    return {"status": "healthy", "database": db_status}

