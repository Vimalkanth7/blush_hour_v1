from fastapi import APIRouter, Depends, HTTPException, Query, Body
from beanie import PydanticObjectId
from typing import List, Optional
from datetime import datetime

from app.models.user import User
from app.models.chat_night import MatchUnlocked
from app.models.chat import ChatThread, ChatMessage
from app.schemas.chat import (
    ThreadListResponse, ThreadSnippet, PartnerSnippet, 
    MessageResponse, MessageCreate, MessageListResponse,
    PartnerProfileResponse, PartnerProfileData
)
from app.auth.dependencies import get_current_user
from app.services.event_logger import log_event
from pymongo.errors import DuplicateKeyError

from beanie.operators import In

router = APIRouter()

def calculate_age(born: datetime) -> Optional[int]:
    if not born: return None
    today = datetime.utcnow().date()
    # born might be datetime, convert to date
    born_date = born.date()
    return today.year - born_date.year - ((today.month, today.day) < (born_date.month, born_date.day))

@router.get("/threads", response_model=ThreadListResponse)
async def list_threads(current_user: User = Depends(get_current_user)):
    uid = current_user.id # PydanticObjectId
    
    # 1. Sync Strategy: Get all matches for user
    try:
        matches = await MatchUnlocked.find(
            {"user_ids": str(uid)}
        ).to_list()
        
        threads = []
        
        # 2. Collect Partner IDs for Batch Fetch
        partner_ids_map = {} # match_id -> partner_id_str
        partner_pids = []
        
        for m in matches:
            partner_id_str = next((u for u in m.user_ids if u != str(uid)), None)
            if partner_id_str:
                partner_ids_map[m.id] = partner_id_str
                try:
                    partner_pids.append(PydanticObjectId(partner_id_str))
                except:
                    pass
    
        # 3. Batch Fetch Users
        partners_db = {} # str_id -> User
        if partner_pids:
            users = await User.find(In(User.id, partner_pids)).to_list()
            for u in users:
                partners_db[str(u.id)] = u
                
        for m in matches:
            partner_id_str = partner_ids_map.get(m.id)
            if not partner_id_str: continue
            
            # Batch/Single lookup (Optimization: could be batch, but loop safe for V1)
            t = await ChatThread.find_one(ChatThread.match_id == m.id)
            
            if not t:
                try:
                    # Create Thread
                    t = ChatThread(
                        match_id=m.id,
                        participants=[uid, PydanticObjectId(partner_id_str)],
                        created_at=m.created_at
                    )
                    await t.insert()
                except DuplicateKeyError:
                    t = await ChatThread.find_one(ChatThread.match_id == m.id)
            
            # Unread Count
            unread = await ChatMessage.find(
                ChatMessage.thread_id == t.id,
                ChatMessage.sender_id != uid,
                ChatMessage.read_at == None
            ).count()
            
            # Build Partner Snippet
            partner_user = partners_db.get(partner_id_str)
            if not partner_user:
                # Need partner for contract. Skip if missing.
                continue

            photo = partner_user.photos[0] if (partner_user.photos and len(partner_user.photos) > 0) else None
            p_snippet = PartnerSnippet(
                id=str(partner_user.id),
                first_name=partner_user.first_name or "Unknown",
                age=calculate_age(partner_user.birth_date),
                photo_url=photo
            )
            
            threads.append(ThreadSnippet(
                thread_id=str(t.id),
                match_id=str(m.id),
                partner=p_snippet,
                last_message=t.last_message_text,
                last_message_at=t.last_message_at,
                unread_count=unread,
                updated_at=t.last_message_at or t.created_at
            ))
            
        # Sort by updated_at desc
        threads.sort(key=lambda x: x.updated_at, reverse=True)
        
        return {"threads": threads}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise e

@router.get("/threads/{thread_id}/partner", response_model=PartnerProfileResponse)
async def get_thread_partner(
    thread_id: str,
    current_user: User = Depends(get_current_user)
):
    try:
        tid = PydanticObjectId(thread_id)
    except:
        raise HTTPException(404, "Invalid thread ID")
        
    # 1. Load Thread
    t = await ChatThread.get(tid)
    if not t:
        raise HTTPException(404, "Thread not found")
        
    # 2. Security: Participant Check
    if current_user.id not in t.participants:
        raise HTTPException(403, "Not authorized")
        
    # 3. defensive: Check MatchUnlocked
    if t.match_id:
        match = await MatchUnlocked.get(t.match_id)
        if not match:
             # Should not happen if data integrity is good, but just in case
             raise HTTPException(404, "Match context missing")
             
    # 4. Identify Partner
    partner_id = next((p for p in t.participants if p != current_user.id), None)
    if not partner_id:
        raise HTTPException(404, "Partner not found in thread")
        
    # 5. Fetch Partner Profile
    partner = await User.get(partner_id)
    if not partner:
        raise HTTPException(404, "Partner user not found")
        
    # 6. Construct Response
    age = calculate_age(partner.birth_date)
    
    return PartnerProfileResponse(
        partner = PartnerProfileData(
            id=str(partner.id),
            first_name=partner.first_name,
            gender=partner.gender,
            birth_date=partner.birth_date,
            age=age,
            photos=partner.photos or [],
            bio=partner.bio,
            prompts=partner.prompts or [],
            interests=partner.interests or [],
            values=partner.values or [],
            causes=partner.causes or [],
            habits=partner.habits or {},
            education=partner.education,
            work=partner.work,
            location=partner.location,
            height=partner.height,
            religion=partner.religion,
            politics=partner.politics,
            created_at=partner.created_at
        )
    )

from fastapi import Request
from app.core.limiter import limiter

@router.post("/threads/{thread_id}/messages", response_model=MessageResponse)
@limiter.limit("20/minute")
async def send_message(
    request: Request,
    thread_id: str, 
    data: MessageCreate = Body(...), 
    current_user: User = Depends(get_current_user)
):
    try:
        tid = PydanticObjectId(thread_id)
    except:
        raise HTTPException(404, "Invalid thread ID")
        
    t = await ChatThread.get(tid)
    if not t:
        raise HTTPException(404, "Thread not found")
        
    # Security: Participant check
    if current_user.id not in t.participants:
        raise HTTPException(403, "Not authorized")
        
    # Create Message
    msg = ChatMessage(
        thread_id=tid,
        sender_id=current_user.id,
        text=data.text
    )
    await msg.insert()
    
    # Update Thread
    t.last_message_at = msg.created_at
    t.last_message_text = msg.text
    await t.save()
    
    await log_event("chat.message.sent", source="backend", user_id=str(current_user.id))
    
    return {
        "id": str(msg.id),
        "sender_id": str(msg.sender_id),
        "text": msg.text,
        "created_at": msg.created_at,
        "read_at": msg.read_at
    }

@router.get("/threads/{thread_id}/messages", response_model=MessageListResponse)
async def get_messages(
    thread_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    try:
        tid = PydanticObjectId(thread_id)
    except:
        raise HTTPException(404, "Invalid thread ID")
        
    t = await ChatThread.get(tid)
    if not t:
        raise HTTPException(404, "Thread not found")
    if current_user.id not in t.participants:
        raise HTTPException(403, "Not authorized")
        
    # Construct Query
    query = [ChatMessage.thread_id == tid]
    
    if before:
        try:
             before_oid = PydanticObjectId(before)
             query.append(ChatMessage.id < before_oid)
        except:
             pass

    msgs = await ChatMessage.find(
        *query
    ).sort(-ChatMessage.created_at).limit(limit).to_list()
    
    # Calculate next cursor
    next_cursor = None
    if msgs and len(msgs) == limit:
        next_cursor = str(msgs[-1].id)
    
    return MessageListResponse(
        messages=[
            MessageResponse(
                id=str(m.id),
                sender_id=str(m.sender_id),
                text=m.text,
                created_at=m.created_at,
                read_at=m.read_at
            )
            for m in msgs
        ],
        next_cursor=next_cursor
    )

@router.post("/threads/{thread_id}/read")
async def mark_read(
    thread_id: str,
    current_user: User = Depends(get_current_user)
):
    try:
        tid = PydanticObjectId(thread_id)
    except:
        raise HTTPException(404, "Invalid thread ID")
        
    t = await ChatThread.get(tid)
    if not t:
        raise HTTPException(404, "Thread not found")
    if current_user.id not in t.participants:
        raise HTTPException(403, "Not authorized")
        
    # Update all unread messages where sender != me
    now = datetime.utcnow()
    await ChatMessage.find(
        ChatMessage.thread_id == tid,
        ChatMessage.sender_id != current_user.id,
        ChatMessage.read_at == None
    ).update({"$set": {"read_at": now}})
    
    await log_event("chat.messages.read", source="backend", user_id=str(current_user.id))
    
    return {"status": "success"}
