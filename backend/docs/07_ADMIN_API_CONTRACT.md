# Admin API Contract

**Base URL**: `/api/admin`
**Authentication**: Required for all endpoints. Header `Authorization: Bearer <token>` where user.role == "admin".
**Environment**: Standard Blush Hour Backend

## 1. Metrics & Overview

### GET /api/admin/metrics/overview
Returns high-level platform statistics for dashboard widgets.

**Response**:
```json
{
  "users": {
    "total": 1250,
    "new_24h": 15,
    "dau_24h": 450
  },
  "engagement": {
    "chat_night_enters_today": 300,
    "matches_total": 500,
    "matches_today": 25,
    "threads_total": 450,
    "messages_total": 12000
  }
}
```

## 2. User Management

### GET /api/admin/users
List users with filtering.

**Query Parameters**:
- `search`: String (Phone number or First Name regex)
- `tier`: String ("Gold", "Silver", "Bronze")
- `onboarded`: Boolean
- `min_completion`: Integer (0-100)
- `limit`: Integer (default 20)

**Response**:
```json
{
  "users": [
    {
      "id": "60d5ec...",
      "phone": "1234567890",
      "name": "Alice",
      "created_at": "2025-01-01T12:00:00Z",
      "role": "user",
      "is_banned": false,
      "tier": "Gold",
      "completion": 85
    }
  ]
}
```

### GET /api/admin/users/{user_id}
Detailed 360-degree view of a user.

**Response**:
```json
{
  "profile": {
      "id": "60d5ec...",
      "phone_number": "1234567890",
      "first_name": "Alice",
      ...
      "password_hash": "<excluded>"
  },
  "strength": {
      "completion_percent": 85,
      "missing_fields": [],
      "tier": "Gold"
  },
  "activity_stats": {
      "messages_sent_all_time": 150,
      "matches_count_all_time": 12,
      "chat_night_passes_used_today": 1
  },
  "matches_recent": [ ... ],
  "threads_recent": [ ... ],
  "events_timeline": [ ... ],
  "passes_history": [ ... ]
}
```

### POST /api/admin/users/{user_id}/actions/reset-passes
Set a user's remaining passes for the current day exactly to `count`.
This is an overwrite operation: `remaining = count`. It forces recalculation of `passes_total`.

**Body**:
```json
{ "count": 3 }
```

**Response**:
```json
{ "status": "ok", "new_passes": 3 }
```

### POST /api/admin/users/{user_id}/actions/ban
Soft ban a user.

**Body**:
```json
{ "reason": "Violated terms of service" }
```

### POST /api/admin/users/{user_id}/actions/unban
Restore user access.

## 3. Content Inspection

### GET /api/admin/threads/{thread_id}
View thread details and messages. NOTE: This action is audited.

**Response**:
```json
{
  "thread": { ... },
  "messages": [ ... ]
}
```

## 4. System Configuration

### GET /api/admin/toggles
View system toggles (Env vars and Dynamic).

**Response**:
```json
{
  "env_defaults": {
    "PROFILE_MIN_COMPLETION": 0,
    "FORCE_OPEN": false
  },
  "dynamic_overrides": {
    "PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT": "80"
  }
}
```

### POST /api/admin/toggles
Update a dynamic system toggle.

**Body**:
```json
{
  "key": "PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT",
  "value": "80"
}
```

## 5. Audit Logging
All write actions and sensitive read actions (view_user, view_thread) are logged to `admin_audit_logs`.
