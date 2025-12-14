from fastapi import FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to DB/Redis (TODO)
    print("Startup: Connecting to services...")
    yield
    # Shutdown: Disconnect
    print("Shutdown: Closing connections...")

app = FastAPI(title="Blush Hour Backend", lifespan=lifespan)

@app.get("/")
async def read_root():
    return {"message": "Blush Hour Backend is running", "status": "active"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
