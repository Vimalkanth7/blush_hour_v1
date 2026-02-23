# Week 6 — Realtime + Talk Room Stabilization

## 🟡 W6-A — Realtime stabilization (highest priority)
Status: TODO
Owner: Backend Agent + Frontend Agent
Depends on: Week 5 complete

Goal:
- Make Talk Room / Chat Night room timing + engage-state reliable across 2 devices/browsers.
- Remove client clock drift issues and flaky UI state transitions.

Acceptance criteria:
- Timer is based on backend authoritative clock (no client drift).
- Engage → room state transition works end-to-end (API + UI + polling/realtime).
- "NetworkError" frontend exception resolved (root cause fixed + guarded).
- Realtime approach decided and implemented reliably:
  - polling only OR websockets (choose one for Week 6-A).
- A deterministic QA script or manual checklist exists for "2 browsers, 1 room".

Verification:
- Existing regression scripts (Week3/4/5) — PASS
- New "2 browsers, 1 room" sanity script/checklist — PASS


## 🟡 W6-B — AI-assisted matching quality (safe, controlled)
Status: TODO
Owner: Backend Agent + QA Agent + Frontend Agent (as needed)
Depends on: W6-A

Goal:
- Add AI-generated match reasons / icebreakers (non-sensitive, safe).
- Add frequency controls and safety validation.

Acceptance criteria:
- AI reasons/icebreakers are non-sensitive and policy-safe (no PII, no exact location, no trauma).
- Rate limits + frequency controls prevent spam.
- QA checks added for safety + PII exclusion.

Verification:
- New QA script/checklist for safety prompts — PASS
- Existing regression scripts — PASS
