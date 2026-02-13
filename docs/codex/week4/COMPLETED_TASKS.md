





# Week 4 — Completed Tasks

## 🟢 W4-A — Add languages + habits (legacy-safe defaults)
Status: DONE  
Tag: v1-w4a-profile-habits-languages

Notes:
- Added `languages` (list) and `habits` (object) to user model + read schema with safe defaults.
- Normalized legacy null values to `[]` / `{}` in responses.
- PATCH supports updating `languages` and merging `habits` safely.
- Week 3 `profile_strength` contract preserved; regression scripts PASS.

## 🟢 W4-B — Frontend: Edit Profile UI for Languages + Habits
Status: DONE  
Tag: v1-w4b-profile-edit-languages-habits

Notes:
- Added UI to view/edit `languages` + `habits` via PATCH `/api/users/me`.
- Persisted across refresh/navigation.
- No frontend scoring logic (backend remains source of truth for profile_strength).

## 🟢 W4-C — Regression guard: languages + habits contract (QA Script)
Status: DONE  
Tag: v1-w4c-regression-languages-habits
v1-w4c-tracking

Notes:
- Added `backend/verify_languages_habits_contract.ps1` to enforce never-null defaults + PATCH behavior.
- Added script to `docs/QA/regression_checklist.md` as PASS-required.
- Verified alongside Week 3 guards (`verify_profile_completion.ps1`, `verify_profile_strength_contract.ps1`).

## 🟢 W4-D — Show languages + habits in Preview + Partner Profile (Frontend)
Status: DONE  
Tag: v1-w4d-profile-preview-partner-habits-languages

Notes:
- Added Languages chips + Habits section (drinking/smoking/exercise/kids) with legacy-safe “Not specified” fallbacks.
- Updated both Preview Profile modal and PartnerProfileView to surface these signals where decisions are made.
- No regressions: Week 3/Week 4 backend contracts remain PASS via regression scripts.
