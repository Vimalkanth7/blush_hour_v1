# Patch Plan V1: Secure User Update & Stability

## 1. API Contract Note
### Status: PROPOSED -> ACCEPTED
**Objective**: close Critical Security Vulnerability (ID: BUG-002) where users can edit other users' profiles.

### New Endpoint: Secure Update
- **Method**: `PATCH`
- **Path**: `/api/users/me`
- **Auth**: `Bearer <token>` (Required)
- **Body**: `UserUpdate` schema (Partial fields).
- **Behavior**: Updates the user associated with the provided Bearer token.
- **Notes**: The `phoneNumber` field in the body is **ignored** for identification purposes (user ID derived from token).

### Deprecated Endpoint
- **Method**: `PATCH`
- **Path**: `/api/users/update`
- **Action**: **HARD REMOVAL**. This endpoint is too dangerous to keep. All clients must upgrade.

---

## 2. Task Breakdown (2-Day Schedule)

### Day 1: Backend Implementation & Security
**Task B-1: Implement `PATCH /users/me`**
- **File**: `backend/app/routers/users.py`
- **Description**: Add new endpoint relying on `get_current_user`.
- **Logic**: 
  - Validate token.
  - Fetch user context.
  - Apply updates from body to `current_user`.
  - Save to DB.

**Task B-2: Remove `PATCH /users/update`**
- **File**: `backend/app/routers/users.py`
- **Description**: Delete the insecure endpoint to prevent any fallback exploitation.

### Day 2: Frontend Integration & QA
**Task F-1: Update Onboarding Submit Logic**
- **File**: `mobile-app/app/(onboarding)/photos.tsx`
- **Description**:
  - Get `token` from `useAuth`.
  - Change URL from `/users/update` to `/users/me`.
  - Add `Authorization: Bearer ${token}` header.
  - Remove `phoneNumber` reliance (optional, but good cleanup).

**Task Q-1: Verification**
- **Manual Test**: Login as User A. Try to update User B's profile via cURL using User A's token (should fail or update User A).
- **Flow Test**: Complete Onboarding Wizard to ensure data persists correctly.

---

## 3. Risk Notes & Rollback

### Risks
- **Frontend/Backend Sync**: If Frontend is deployed without Backend update -> 404 Error (Update fails).
- **Onboarding Blocker**: If `token` is missing in `photos.tsx` (e.g., lost state), the user cannot complete signup.

### Rollback Plan
If Onboarding breaks completely:
1.  Revert `backend/app/routers/users.py` to restore `/update`.
2.  Revert `mobile-app/app/(onboarding)/photos.tsx` to remove Auth header usage.
