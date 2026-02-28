# Week 6 - Realtime + Talk Room Stabilization

## W6-A - Realtime stabilization (highest priority)

Status: IN PROGRESS  
Owner: Backend Agent + Frontend Agent  
Depends on: Week 5 complete

Goal:
- Make Talk Room / Chat Night room timing + engage-state reliable across 2 devices/browsers.
- Remove client clock drift issues and flaky UI state transitions.

### W6-A2 - Authoritative Talk Room timer (server-based)

Status: DONE  
Owner: Frontend Agent  
Tag: v1-w6a2-authoritative-timer

Notes:
- `timeLeft` is derived from backend `seconds_remaining` (poll-synced), with snap-back on focus/visibility/app-active.

### W6-A1.1 - Engage sync + stale-room expiry normalization (backend)

Status: DONE  
Owner: Backend Agent  
Tag: v1-w6a1_1-engage-sync

Notes:
- `/engage` made idempotent and consistent across endpoints.
- Shared helpers normalize expiry + compute `engage_status` consistently.
- Added deterministic verifier: `backend\verify_talk_room_engage_sync.ps1` - PASS.

### W6-A1.2 - Engage UI sync (frontend)

Status: TODO  
Owner: Frontend Agent  
Goal:
- Ensure both clients reliably reflect `engage_status` transitions (`pending -> waiting_for_partner -> match_unlocked`) without stale UI.
Acceptance criteria:
- Two-browser test: A engages -> A waiting_for_partner, B pending; B engages -> both match_unlocked.
- No stuck "waiting" UI after successful unlock.
Verification:
- Two-browser checklist PASS + backend verifier PASS.

### W6-A3 - Resolve NetworkError + recovery UX

Status: TODO  
Owner: Frontend Agent (+ Backend Agent if root cause is API)  
Goal:
- Fix root cause of NetworkError in Talk Room and add safe recovery/backoff.
Acceptance criteria:
- No uncaught NetworkError; UI shows retry state + recovers automatically.
- Polling backoff is bounded and returns to normal on success.
Verification:
- Two-browser checklist PASS with simulated network drop/reconnect.

### W6-A4 - Realtime approach decision + hardening

Status: DONE  
Owner: Lead Agent + Backend Agent + Frontend Agent  
Tag: v1-w6a4-polling-only-decision

Goal:
- Lock the v1 realtime approach to polling-only for two-user Talk Room sync and document hardening behavior.

Decision:
- Polling-only chosen for v1.
- WebSockets deferred until post-Week-6 follow-up work.

Hardening rules:
- Source of truth for room/timer/engage state: `GET /api/chat-night/room/{room_id}`.
- Poll cadence: foreground `2000ms`, background `4000ms`, error backoff `5000ms`.
- Immediate poll triggers: app active, web tab visibility return, and window focus.
- Guard against duplicate alerts/navigation during `ended` and `match_unlocked` transitions.
- On `429` responses, show retry/throttled messaging and continue with bounded backoff polling.

Acceptance criteria:
- Polling-only chosen and WebSockets deferred are documented in Week 6 tracking and checklist docs.
- Two-browser behavior remains reliable under normal sync, backgrounding, engage unlock, and temporary backend outage/restart.

Verification:
- `manual run browser check.txt` PASS checklist updated for "2 browsers, 1 room" and includes A3 recovery + A4 decision confirmation.

### W6-A5 - Deterministic QA script / checklist: "2 browsers, 1 room"

Status: DONE  
Owner: QA Agent  
Tag: v1-w6a5-checklist-gate

Notes:
- Checklist-only PASS gate.
- Uses `manual run browser check.txt`.
- Now listed in `docs/QA/regression_checklist.md` as PASS required.

## W6-B - AI-assisted matching quality (safe, controlled)

Status: TODO  
Owner: Backend Agent + QA Agent + Frontend Agent (as needed)  
Depends on: W6-A

Goal:
- Add AI-generated match reasons / icebreakers (non-sensitive, safe).
- Add frequency controls and safety validation.

Acceptance criteria:
- AI reasons/icebreakers are policy-safe (no PII, no exact location, no trauma).
- Rate limits + frequency controls prevent spam.
- QA checks added for safety + PII exclusion.

Verification:
- New QA script/checklist for safety prompts - PASS.
- Existing regression scripts (Week 3/4/5) - PASS.
