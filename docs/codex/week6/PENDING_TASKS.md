# docs/codex/week6/PENDING_TASKS.md

# Week 6 — Realtime + Talk Room Stabilization

## 🟡 W6-A — Realtime stabilization (highest priority)

Status: IN PROGRESS
Owner: Backend Agent + Frontend Agent
Depends on: Week 5 complete

Goal:

* Make Talk Room / Chat Night room timing + engage-state reliable across 2 devices/browsers.
* Remove client clock drift issues and flaky UI state transitions.

### ✅ W6-A2 — Authoritative Talk Room timer (server-based)

Status: DONE
Owner: Frontend Agent
Tag: v1-w6a2-authoritative-timer
Notes:

* timeLeft derived from backend seconds_remaining (poll-synced), snap-back on focus/visibility/app-active.

### 🟡 W6-A1 — Engage → room state transition end-to-end

Status: TODO
Owner: Backend Agent + Frontend Agent
Goal:

* Ensure Engage tap updates backend state and both clients reflect state changes reliably.
  Acceptance criteria:
* Engage works on both clients; room state + engage_status stays consistent (no stuck “waiting”).
* No “active_room” / stale-room confusion during normal flow.
  Verification:
* Two-browser checklist PASS (both see engaged/unlocked transition).

### 🟡 W6-A3 — Resolve NetworkError + recovery UX

Status: TODO
Owner: Frontend Agent (+ Backend Agent if root cause is API)
Goal:

* Fix root cause of NetworkError in Talk Room and add safe recovery/backoff.
  Acceptance criteria:
* No uncaught NetworkError; UI shows retry state + recovers automatically.
* Polling backoff is bounded and returns to normal on success.
  Verification:
* Two-browser checklist PASS with simulated network drop/reconnect.

### 🟡 W6-A4 — Realtime approach decision + hardening

Status: TODO
Owner: Lead Agent + Backend Agent + Frontend Agent
Goal:

* Decide and lock “polling-only” OR “websockets” for two-user sync; implement reliably.
  Acceptance criteria:
* Chosen approach documented and implemented.
* State sync remains reliable under backgrounding and temporary network loss.
  Verification:
* Two-browser checklist PASS.

### 🟡 W6-A5 — Deterministic QA script / checklist: “2 browsers, 1 room”

Status: TODO
Owner: QA Agent
Goal:

* Add a small deterministic QA checklist or script for Talk Room sync sanity.
  Acceptance criteria:
* Checklist/script exists and is PASS-required for W6-A completion.
  Verification:
* Checklist/script PASS + existing regression scripts PASS.

## 🟡 W6-B — AI-assisted matching quality (safe, controlled)

Status: TODO
Owner: Backend Agent + QA Agent + Frontend Agent (as needed)
Depends on: W6-A

Goal:

* Add AI-generated match reasons / icebreakers (non-sensitive, safe).
* Add frequency controls and safety validation.

Acceptance criteria:

* AI reasons/icebreakers are policy-safe (no PII, no exact location, no trauma).
* Rate limits + frequency controls prevent spam.
* QA checks added for safety + PII exclusion.

Verification:

* New QA script/checklist for safety prompts — PASS
* Existing regression scripts (Week3/4/5) — PASS
