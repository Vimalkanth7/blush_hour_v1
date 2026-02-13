# Week 4 — COMPLETED TASKS

## 🟢 W4-A — Add languages + habits (legacy-safe defaults)

Status: DONE ✅

Notes:
- Added `languages` to User model + UserRead with safe defaults (empty list) and legacy-safe coercion when stored as null.
- Normalized `habits` to default to `{}` in responses; ensured legacy-safe coercion when stored as null.
- Extended PATCH `/api/users/me` to accept `languages` and `habits` and merge habits updates safely.
- Regression guards: Week 3 profile_strength contract and completion scoring remain PASS.
- Tag: `v1-w4a-profile-habits-languages`
