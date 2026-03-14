from fastapi import FastAPI
from contextlib import asynccontextmanager
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
import logging

from app.core.config import settings
from app.models.user import User
from app.models.chat_night import (
    ChatNightIcebreakers,
    ChatNightPass,
    ChatNightRoom,
    MatchUnlocked,
)
from app.models.events import AppEvent
from app.models.chat import ChatThread, ChatMessage
from app.models.admin import AdminAuditLog, SystemConfig
from app.models.passes import PassCreditLedgerEntry, UserPassWallet
from app.models.safety import UserBlock, UserMute, UserReport
from app.routers import auth, users, discovery, chat_night, admin, chat, internal_evals, passes, photos, voice, safety

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
            ChatNightIcebreakers,
            AppEvent,
            ChatThread,
            ChatMessage,
            AdminAuditLog,
            SystemConfig,
            UserPassWallet,
            PassCreditLedgerEntry,
            UserBlock,
            UserMute,
            UserReport,
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
from app.middleware.langsmith_api_tracing import LangSmithApiTracingMiddleware

logger = logging.getLogger(__name__)

app = FastAPI(title="Blush Hour Backend", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled application error at %s",
        request.url.path,
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error"},
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
app.add_middleware(LangSmithApiTracingMiddleware)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(photos.router, prefix="/api/photos", tags=["photos"])
app.include_router(discovery.router, prefix="/api/discovery", tags=["discovery"])
app.include_router(chat_night.router, prefix="/api/chat-night", tags=["chat-night"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(voice.router, prefix="/api/voice", tags=["voice"])
app.include_router(passes.router, prefix="/api/passes", tags=["passes"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(internal_evals.router, prefix="/api/internal/evals", tags=["internal-evals"])
app.include_router(safety.router, prefix="/api/safety", tags=["safety"])

@app.get("/")
async def read_root():
    return {"message": "Blush Hour Backend is running", "status": "active"}

@app.get("/health")
async def health_check():
    # Verify DB connectivity
    try:
        await User.find_one(User.phone_number == "0000000000")
        db_status = "connected"
    except Exception:
        logger.exception("Health check database probe failed.")
        db_status = "error"
        
    return {"status": "healthy", "database": db_status}
