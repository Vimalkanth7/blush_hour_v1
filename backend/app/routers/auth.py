from fastapi import APIRouter, HTTPException, Body
from app.models.user import User
from app.auth.utils import create_access_token
from app.core.security import verify_password, get_password_hash
from pydantic import BaseModel
from typing import Optional

import re

router = APIRouter()

class AuthRequest(BaseModel):
    phone_number: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    is_new_user: bool = False

from app.services.phone import normalize_phone
from app.services.event_logger import log_event

from fastapi import Request
from app.core.limiter import limiter

@router.post("/register", response_model=LoginResponse)
@limiter.limit("5/minute")
async def register(request: Request, data: AuthRequest = Body(...)):
    # 1. Normalize
    norm_phone = normalize_phone(data.phone_number)
    
    # 2. Check Exists (Check normalized and raw just in case)
    user = await User.find_one(
        {"$or": [{"phone_number": norm_phone}, {"phone_number": data.phone_number}]}
    )
    
    if user:
         await log_event(
             "auth.register.failed", 
             source="backend", 
             payload={"reason": "duplicate", "phone_mask": norm_phone[:4] + "***"}
         )
         raise HTTPException(status_code=409, detail="Account already exists")
    
    hashed_pw = get_password_hash(data.password)
    
    # 3. Store ONLY normalized
    new_user = User(
        phone_number=norm_phone, 
        password_hash=hashed_pw
    )
    await new_user.insert()
    
    await log_event("auth.register.success", source="backend", user_id=str(new_user.id))
    
    token = create_access_token({"sub": new_user.phone_number})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "is_new_user": True
    }

@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(request: Request, data: AuthRequest = Body(...)):
    # 1. Normalize
    norm_phone = normalize_phone(data.phone_number)
    
    # 2. Lookup (Try normalized, then raw/others for backward compat)
    user = await User.find_one(
        {"$or": [
            {"phone_number": norm_phone}, 
            {"phone_number": data.phone_number},
            {"phone_number": f"+{norm_phone}"} # Legacy support for +91 stored
        ]}
    )
    
    if not user:
        await log_event("auth.login.failed", source="backend", payload={"reason": "user_not_found"})
        raise HTTPException(status_code=400, detail="Invalid credentials")
        
    # Check password
    if not user.password_hash or not verify_password(data.password, user.password_hash):
        await log_event(
            "auth.login.failed", 
            source="backend", 
            user_id=str(user.id),
            payload={"reason": "bad_password"}
        )
        raise HTTPException(status_code=400, detail="Invalid credentials")

    await log_event("auth.login.success", source="backend", user_id=str(user.id))
    token = create_access_token({"sub": user.phone_number})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "is_new_user": False
    }
