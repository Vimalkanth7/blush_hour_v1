# Week 4 — Session Log

## W4-A — Add languages + habits (legacy-safe defaults)
Date: 2026-02-13
Agent: Backend Agent (Codex) + QA Agent (Antigravity) + Founder

Files changed:
- backend/app/models/user.py
- backend/app/schemas/user.py
- backend/app/routers/users.py

What changed:
- Added `languages` + `habits` with safe defaults.
- Normalized legacy `null` values to `[]` / `{}` in responses.
- Extended PATCH `/api/users/me` to accept `languages` + merge `habits` safely.

How verified:
- backend/verify_profile_completion.ps1 — PASS
- backend/verify_profile_strength_contract.ps1 — PASS
- QA confirmed GET/PATCH returns non-null values after server restart (stale-process issue resolved).

Tag:
- v1-w4a-profile-habits-languages

Risks / follow-ups:
- Consider adding a dedicated regression script for languages/habits contract (completed in W4-C).


## W4-B — Profile UI: render + edit languages & habits
Date: 2026-02-13
Agent: Frontend Agent (Codex) + QA Agent (Antigravity) + Founder (Manual UI)

Files changed:
- mobile-app/app/(tabs)/profile.tsx
- mobile-app/app/modal/edit-profile.tsx
- mobile-app/context/AuthContext.tsx

What changed:
- Added Languages + Habits cards on Profile screen with Edit CTAs.
- Added Edit Profile UI to update languages (multi-select) and habits (drinking/smoking/exercise/kids).
- Wired PATCH `/api/users/me` to send languages + habits and render saved values with safe defaults.

How verified:
- API checks (GET/PATCH): PASS (languages array, habits object, profile_strength intact).
- Regression scripts:
  - backend/verify_profile_completion.ps1 — PASS
  - backend/verify_profile_strength_contract.ps1 — PASS
- Founder manual UI smoke test — PASS (values persist across navigation + refresh).

Tag:
- v1-w4b-profile-edit-languages-habits

Risks / follow-ups:
- Custom languages not in the predefined list cannot be newly added (existing custom values still display).
- Legacy kids fields exist alongside habits.kids; consider consolidating later if you want one source of truth.


## W4-C — Regression guard: languages + habits contract (QA Script)
Date: 2026-02-13
Agent: QA/Backend (script + docs)

Files changed:
- backend/verify_languages_habits_contract.ps1
- docs/QA/regression_checklist.md

What changed:
- Added regression script verifying:
  - GET `/api/users/me` returns `languages` as list (never null) and `habits` as object (never null)
  - PATCH replace semantics for languages
  - PATCH partial-merge semantics for habits
  - Empty values `languages=[]`, `habits={}` don’t regress to null
- Added this script to regression checklist as PASS-required.

How verified:
- backend/verify_profile_completion.ps1 — PASS
- backend/verify_profile_strength_contract.ps1 — PASS
- backend/verify_languages_habits_contract.ps1 — PASS

Tag:
- v1-w4c-<PUT-YOUR-ACTUAL-TAG-HERE>

Risks / follow-ups:
- None.


## W4-D — Surface Languages + Habits in Preview + Partner Profile (Frontend)
Date: 2026-02-13
Agent: Frontend Agent (Codex) + QA Agent (Antigravity) + Founder (Manual UI)

Files changed:
- mobile-app/app/modal/preview-profile.tsx
- mobile-app/components/profile/PartnerProfileView.tsx

What changed:
- Added Languages chips and a dedicated Habits section (drinking/smoking/exercise/kids).
- Added “Not specified” fallbacks for missing/legacy values.
- Avoided duplication by keeping habits in a dedicated section.

How verified:
- Diff safety: only the two allowed UI files changed ✅
- Regression guards:
  - backend/verify_profile_strength_contract.ps1 — PASS
  - backend/verify_languages_habits_contract.ps1 — PASS
- Founder manual UI smoke test — PASS (Preview Profile + Partner Profile render correctly with real + empty values)

Tag:
- v1-w4d-profile-preview-partner-habits-languages

Risks / follow-ups:
- If you later add custom language input (free-text), ensure preview + partner views handle unknown values consistently.
