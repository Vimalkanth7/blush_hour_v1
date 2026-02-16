# Week 5 — Chat Night Matching (V5, No-AI)

## 🟡 W5-A — Add V5 Chat Night scoring module (no-AI)
Status: TODO
Owner: Backend Agent

Goal:
- Implement a standalone V5 scoring module that returns {score, reason_tags} using existing profile signals.

Allowed files:
- backend/app/services/chat_night_matching_v5.py (new)
- backend/app/services/* (only if needed)

Acceptance criteria:
- New module exists and is NOT wired into Chat Night yet (additive only).
- Handles legacy-safe defaults (missing/null → [] / {}).
- Deterministic scoring for same inputs.
- reason_tags are PII-safe (no phone, coords, etc.), max 6.

Verification:
- backend\verify_profile_completion.ps1 — PASS
- backend\verify_profile_strength_contract.ps1 — PASS
- backend\verify_languages_habits_contract.ps1 — PASS


## 🟡 W5-B — Integrate V5 scorer into Chat Night pairing (feature-flagged)
Status: TODO
Owner: Backend Agent
Depends on: W5-A

Goal:
- Use V5 ranking to pick best partner in Chat Night pool, behind env/admin toggle.
- Keep current logic as fallback.

Allowed files:
- backend/app/routers/chat_night.py
- backend/app/services/chat_night_matching_v5.py
- backend/app/services/chat_night* (only if required)

Acceptance criteria:
- V5 logic used only when flag enabled.
- Pairing remains fast (no heavy loops; bounded candidates).
- No regression to passes/timers/gating.
- reason_tags recorded/logged safely for future icebreakers.

Verification:
- existing chat night verify scripts (if present) + Week3/Week4 guards — PASS


## 🟡 W5-C — Cooldown guard (avoid repeat pairing)
Status: TODO
Owner: Backend Agent
Depends on: W5-B

Goal:
- Prevent same pair from matching repeatedly within cooldown window.

Acceptance criteria:
- Cooldown enforced.
- Does not deadlock pool.

Verification:
- new verify script or extend existing chat-night simulation script


## 🟡 W5-D — Fairness boost (wait-time priority)
Status: TODO
Owner: Backend Agent
Depends on: W5-B

Goal:
- Prefer users waiting longer so nobody gets stuck.

Acceptance criteria:
- Waiting users get a boost without overriding hard constraints.

Verification:
- simulation script demonstrates wait-time improves matching fairness


## 🟡 W5-E — Regression script: V5 match contract
Status: TODO
Owner: QA Agent
Depends on: W5-B

Goal:
- Script that sets up small pool and asserts deterministic partner selection + reason_tags present.

Acceptance criteria:
- Script exists and PASS required to merge.

Verification:
- run script + Week3/Week4 regression scripts — PASS


## 🟡 W5-F — Docs lock-in (V5 formula + reason_tags spec)
Status: TODO
Owner: Docs/Lead Agent
Depends on: W5-E

Goal:
- Document V5 formula, flags, cooldown, fairness, and QA scripts.

Acceptance criteria:
- docs updated + regression checklist updated.

Verification:
- Diff is docs-only and Antigravity QA PASS
