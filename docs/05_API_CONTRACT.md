# API_CONTRACT — Blush Hour v0

## Base URL
- Emulator: http://10.0.2.2:8000
- Localhost (backend dev): http://localhost:8000

## Auth
### POST /api/auth/register
Request:
- phone_number: string
- password: string

Response:
- access_token: string (if implemented) OR confirmation

### POST /api/auth/login
Request:
- phone_number: string
- password: string

Response:
- access_token: string
- token_type: "bearer"

## Users
### GET /api/users/me
Auth: Bearer token required
Response:
- **profile_strength**: { completion_percent: int (0-100), tier: "Bronze"|"Silver"|"Gold", missing_fields: list[str] }
- **profile_completion**: integer (0-100)
- phone_number, first_name, birth_date, gender
- bio, photos (list[str])
- work, education, education_level
- hometown, location
- height, star_sign
- habits: { exercise, drinking, smoking, kids } -> *Deprecated: moving to flat keys preferable, but kept for backward compat if needed. Pref naming: drinking, smoking, exercise.*
- kids_have, kids_want
- dating_preference, intentions
- interests, values, causes
- religion, politics
- prompts

Contract guarantee:
- Response always includes `profile_strength` (even for legacy/partial users).

### PATCH /api/users/me
Auth: Bearer token required
Request body (partial updates allowed):
- bio
- photos: list[str]
- work
- education
- educationLevel
- hometown
- location
- height
- starSign
- exercise
- drinking
- smoking
- kidsHave
- kidsWant
- datingPreference
- intentions (or intention / mode)
- interests
- values
- causes
- religion
- politics
- prompts

Response:
- Updated user profile (including recalculated `profile_completion`, `onboarding_completed`, and `profile_strength`)
- Response always includes `profile_strength` (even for legacy/partial users).

Notes:
- `password_hash` is NEVER returned.

## Discovery
### GET /api/discovery
Auth: Bearer token required
Query Params:
- limit: int (default 10)

Response:
- List of User objects (filtered view):
  - _id
  - first_name
  - birth_date
  - photos
  - bio
  - work
  - location
  - interests

Logic:
- Excludes current user.
- MUST have `onboarding_completed=true`.
- MUST have `profile_completion >= 60`.

## Chat Night
### GET /api/chat-night/status
Response:
- is_open: bool
- date_ist: string
- seconds_until_open: int
- seconds_until_close: int
- passes_total: int
- passes_used: int
- passes_remaining: int
- active_room_id: string|null
- queue_status: "queued" | "none"

*Note*: If server env `CHAT_NIGHT_TEST_PASSES` is set (int), `passes_total` will be that value for new daily records, overriding gender defaults.

### POST /api/chat-night/enter
Response:
- status: "queued" | "match_found" | "active_room"
- room_id: string (optional)

### GET /api/chat-night/my-room
Auth: Bearer token
Response:
  If no room: { "state": "none" }
  If room:
    {
      "state": "active" | "engaged",
      "room_id": "<uuid>",
      "starts_at": "...",
      "ends_at": "...",
      "remaining_seconds": <int>,
      "partner_user_id": "<id>",
      "you_are": "male" | "female",
      "engage_you": <bool>,
      "engage_partner": <bool>
    }

### POST /api/chat-night/leave
Response: { status: "left" }

### GET /api/chat-night/room/{room_id}
Response:
- room_id
- state: "active" | "ended" | "engaged"
- seconds_remaining: int
- partner_first_name
- partner_photo
- engage_status: "pending" | "waiting_for_partner" | "match_unlocked"

### POST /api/chat-night/engage
Body: { room_id: string }
Response: { status: "success", room_state: "active"|"engaged" }
