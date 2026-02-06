# Unlocked Chat Specification

## Goal
Design the data model and API surface to support "Unlocked Chat" — the persistent conversation state that occurs after a successful "Chat Night" engagement.

## 1. Data Models

### 1.1 Conversation (`conversations`)
Represents a persistent chat thread between two users. This serves as the "inbox" item.

```python
class Conversation(Document):
    participants: List[str] # [user_id_1, user_id_2] (Indexed)
    type: str = "direct" # Enum: direct, group, system
    status: str = "active" # Enum: active, archived, blocked
    
    # Origin Tracking
    source: str = "chat_night" 
    related_id: Optional[str] = None # e.g., match_unlocked_id or original room_id
    
    # List View Optimization
    last_message: Optional[dict] = None 
    # { 
    #   "text": str, 
    #   "sender_id": str, 
    #   "created_at": datetime,
    #   "is_read": bool 
    # }
    
    updated_at: datetime = Field(default_factory=datetime.utcnow) # Sort Key
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "conversations"
        indexes = [
            "participants",
            [("participants", 1), ("updated_at", -1)]
        ]
```

### 1.2 Message (`messages`)
Storage for individual chat messages.

```python
class Message(Document):
    conversation_id: str # Indexed
    sender_id: str
    text: str
    kind: str = "text" # Enum: text, image, system
    
    # Read Receipts
    read_by: List[str] = [] # [user_id_1, user_id_2]
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "messages"
        indexes = [
            [("conversation_id", 1), ("created_at", -1)]
        ]
```

### 1.3 MatchUnlocked (Existing)
We will **retain** `MatchUnlocked` as the immutable record of the *event* of matching.
- **Rule**: When a `MatchUnlocked` document is created (after 2-way engage), a background process (or the same transaction) MUST create/find the corresponding `Conversation`.

---

## 2. API Contract

### 2.1 GET /api/chat/conversations
Returns the user's inbox.
- **Header**: `Authorization: Bearer <token>`
- **Response**: `List[ConversationSchema]`
```json
[
  {
    "id": "conv_123",
    "participants": [
      {
        "user_id": "user_456",
        "name": "Alice",
        "avatar": "https://...", 
        # Profile is REVEALED here
      }
    ],
    "last_message": {
      "text": "Hi there!",
      "created_at": "2025-01-01T12:00:00Z",
      "is_read": false
    },
    "updated_at": "..."
  }
]
```

### 2.2 GET /api/chat/conversations/{conversation_id}/messages
Returns paginated message history.
- **Query Params**: `limit=50`, `before=<timestamp>`
- **Response**: `List[MessageSchema]`

### 2.3 POST /api/chat/conversations/{conversation_id}/messages
Sends a new message.
- **Body**: `{ "text": "Hello world", "kind": "text" }`
- **Side Effect**: Updates `Conversation.last_message` and `Conversation.updated_at`.

---

## 3. Migration / Integration Plan

### Step 1: Create Collections
Define the `Conversation` and `Message` Beanie models in `backend/app/models/chat.py`.

### Step 2: Signal Handling
Update the logic that handles "Chat Night Engage" (likely in `routers/chat_night.py` or a service layer):
- **Current**: Creates `MatchUnlocked`.
- **New**: 
    1. Create `MatchUnlocked`.
    2. Check if `Conversation(participants=[u1, u2])` exists.
    3. If not, create new `Conversation`.

### Step 3: Backfill (One-off Script)
For every existing `MatchUnlocked` doc:
1. Extract `user_ids`.
2. Ensure a `Conversation` exists for these IDs.
