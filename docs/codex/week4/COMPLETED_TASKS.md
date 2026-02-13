# Week 4 — Completed Tasks

## 🟢 W4-A — Add languages + habits (legacy-safe defaults)
Status: DONE
Tag: v1-w4a-profile-habits-languages

Notes:
- Added `languages` (list) and `habits` (object) to user model + read schema with safe defaults.
- Normalized legacy null values to [] / {} in responses.
- PATCH supports updating languages and merging habits safely.
- Week 3 profile_strength contract preserved; regression scripts PASS.

## 🟢 W4-B — Frontend: Edit Profile UI for Languages + Habits
Status: DONE
Tag: v1-w4b-profile-ui-languages-habits

Notes:
- Added UI to update languages + habits via PATCH /api/users/me
- Persisted across refresh/navigation
- No frontend scoring logic


## W4-C — Regression guard: languages + habits contract (QA Script)
Status: DONE
Notes:

Added backend/verify_languages_habits_contract.ps1 to enforce non-null defaults + PATCH behavior.

Added script to docs/QA/regression_checklist.md as PASS-required.

Verified alongside Week3 guards (profile completion + profile_strength contract).

🟢 W4-D — Show languages + habits in Preview + Partner Profile (Frontend)

Status: DONE

Notes:
- Added Languages chips + Habits section (drinking/smoking/exercise/kids) with legacy-safe “Not specified” fallbacks.
- Updated both Preview Profile modal and PartnerProfileView to surface these signals where decisions are made.
- No regressions: Week3/Week4 backend contracts remain PASS via regression scripts.
Tag: v1-w4d-profile-preview-partner-habits-languages
