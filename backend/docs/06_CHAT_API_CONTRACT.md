# Chat API Contract (v1)

This document defines the strict JSON contract for the Chat module.
All endpoints are secured and require a valid Bearer token.
Access is restricted to thread participants only.

## 1. Get Threads
**GET** `/api/chat/threads`

Returns a list of active chat threads for the current user.

### Response (200 OK)
```json
{
  "threads": [
    {
      "thread_id": "60d5ec49f1b2c82134567890",
      "match_id": "60d5ec49f1b2c82134567891",
      "partner": {
        "id": "60d5ec49f1b2c82134567892",
        "first_name": "Alice",
        "age": 25,
        "photo_url": "https://example.com/photo.jpg"
      },
      "last_message": "Hey there!",
      "last_message_at": "2023-10-27T10:00:00.000Z",
      "unread_count": 1
    }
  ]
}
```
*   `threads`: Array, always present.
*   `partner`: Object, always present.
*   `photo_url`: String URL or `null`.
*   `unread_count`: Integer, messages sent by partner that are unread.

## 2. Get Messages
**GET** `/api/chat/threads/{thread_id}/messages`

Returns messages for a thread, sorted **newest to oldest**.

### Query Parameters
*   `limit`: (Optional) Int, default 50.
*   `before`: (Optional) Message ID (ObjectId string) to fetch messages older than.

### Response (200 OK)
```json
{
  "messages": [
    {
      "id": "60d5ec49f1b2c82134567999",
      "thread_id": "60d5ec49f1b2c82134567890",
      "sender_id": "60d5ec49f1b2c82134567892",
      "text": "Hello!",
      "created_at": "2023-10-27T10:00:00.000Z",
      "read_at": null
    }
  ],
  "next_cursor": "60d5ec49f1b2c82134567888"
}
```
*   `messages`: Array, sorted newest first.
*   `text`: Content of message.
*   `next_cursor`: Message ID of the last message in batch, or `null` if no more history.

### Errors
*   `404 Thread not found` or invalid ID.
*   `403 Not authorized` (User is not a participant).

## 3. Get Partner Profile
**GET** `/api/chat/threads/{thread_id}/partner`

Returns the full read-only profile of the chat partner.

### Response (200 OK)
```json
{
  "partner": {
    "id": "60d5ec49f1b2c82134567892",
    "first_name": "Alice",
    "age": 25,
    "photos": ["url1", "url2"],
    "bio": "Love hiking!",
    "education": "University of Life",
    "work": "Designer",
    "location": "New York",
    "height": "5'7\"",
    "habits": {
      "drinking": "Socially"
    },
    "interests": ["Hiking", "Art"],
    "values": ["Honesty"],
    "causes": ["Environment"],
    "prompts": [
      {
        "question": "My simple pleasure",
        "answer": "Coffee"
      }
    ]
  }
}
```
*   `partner`: Object wrapper.
*   Sensitive fields (phone, passwords) are **never** returned.
*   Missing fields return `null`, `[]`, or `{}` appropriate to type.

### Errors
*   `404` Thread/Partner not found.
*   `403 Not authorized`.

## 4. Send Message
**POST** `/api/chat/threads/{thread_id}/messages`

### Request
```json
{
  "text": "Hello world"
}
```

### Response (200 OK)
Returns the created `MessageResponse` object.

## 5. Mark Read
**POST** `/api/chat/threads/{thread_id}/read`

Marks all messages in thread from partner as read.

### Response (200 OK)
```json
{
  "status": "success"
}
```
