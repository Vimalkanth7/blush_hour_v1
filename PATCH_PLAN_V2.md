# Patch Plan V2: Security, Data & UX Fixes

## Objectives
1.  **Security**: Prevent `password_hash` leakage in API responses.
2.  **Data Integrity**: Persist `bio` field correctly.
3.  **UX/Stability**: Fix Onboarding loop by enforcing/enabling photo minimums (Dev bypass).
4.  **Architecture**: Secure the user update method (`PATCH /me`).

---

## 1. Backend Changes

### File: `backend/app/models/user.py`
-   **Change**: Add `bio` field.
```python
class User(Document):
    ...
    bio: Optional[str] = None 
    ...
```

### File: `backend/app/routers/users.py`
-   **Security**: Update `get_my_profile` to exclude password hash.
```python
@router.get("/me", response_model=User, response_model_exclude={"password_hash"})
```
-   **Architecture**:
    -   **DELETE**: `PATCH /update` (Unsafe endpoint).
    -   **ADD**: `PATCH /me` (Secure endpoint).
        -   Dependency: `get_current_user`.
        -   Logic: Update fields from `UserUpdate` body onto `current_user`.
        -   **Fix**: Explicitly look for `data.bio` and assign to `user.bio`.

---

## 2. Frontend Changes

### File: `mobile-app/app/(onboarding)/photos.tsx`
-   **UX (Dev Only)**: Add "Debug: Fill Photos" button.
    -   Visible only if `__DEV__` is true.
    -   Action: Sets `photos` state to 5 valid `https://picsum.photos/400/500` URLs.
-   **Integration**: Update `handleNext` (Submit).
    -   URL: `.../api/users/me` (was `/update`).
    -   Method: `PATCH`.
    -   Header: `Authorization: Bearer ${token}`.
    -   Token retrieval: Use `token` from `useAuth()`.

---

## 3. QA & Verification

### Test A: Security & Bio Persistence
1.  **Fresh Install/Wipe**: Clear App Data or register new number (e.g., `+19998887777`).
2.  **Register**: Enter password -> receive token.
3.  **Onboarding**: 
    -   Fill text fields (Name, Birthday, etc.). 
    -   **Bio**: Enter "Testing Bio Persistence".
    -   **Photos**: Use "Debug: Fill Photos" to skip blocking.
4.  **Submit**: Finish wizard.
5.  **Check API**:
    -   Run `curl -H "Authorization: Bearer <TOKEN>" http://localhost:8000/api/users/me`.
    -   **Verify**: 
        -   `password_hash` is **MISSING** in JSON.
        -   `bio` is `"Testing Bio Persistence"`.
    -   **UI Verify**: App should land on Profile/Home logic correctly.

### Test B: Unsafe Access
1.  Attempt `PATCH /api/users/update` with `curl`.
2.  **Expect**: 404 Not Found (Endpoint Removed).
