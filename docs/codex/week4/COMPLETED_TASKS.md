# Week 4 — Completed Tasks

## 🟢 W4-A — Add languages + habits (legacy-safe defaults)
Status: DONE
Tag: v1-w4a-profile-habits-languages

Notes:
- Added `languages` (list) and `habits` (object) to user model + read schema with safe defaults.
- Normalized legacy null values to [] / {} in responses.
- PATCH supports updating languages and merging habits safely.
- Week 3 profile_strength contract preserved; regression scripts PASS.
