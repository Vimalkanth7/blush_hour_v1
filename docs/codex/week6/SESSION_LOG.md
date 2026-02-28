# Week 6 - Session Log

## W6-A5 — Checklist-only regression gate

Date: 2026-02-28  
Agent: QA Agent (Antigravity)

Files changed:
- docs/QA/regression_checklist.md
- docs/codex/week6/PENDING_TASKS.md
- docs/codex/week6/COMPLETED_TASKS.md
- docs/codex/week6/SESSION_LOG.md

What changed:
- Added `manual run browser check.txt` as PASS-required checklist reference in `docs/QA/regression_checklist.md`.
- Updated Week 6 tracking: W6-A5 moved to DONE in PENDING_TASKS.md, new entry in COMPLETED_TASKS.md.

How verified:
- `git diff --name-only` output shows only the 4 allowed files.

Tag:
- v1-w6a5-checklist-gate

Risks / follow-ups:
- None (docs-only change).

## W6-A4 - Polling-only realtime decision + hardening (docs-first)

Date: 2026-02-28  
Agent: Lead Agent + Backend Agent + Frontend Agent (Antigravity)

Files changed:
- docs/codex/week6/PENDING_TASKS.md
- docs/codex/week6/COMPLETED_TASKS.md
- docs/codex/week6/SESSION_LOG.md
- manual run browser check.txt

What changed:
- Moved W6-A4 from TODO to DONE in Week 6 tracking.
- Locked realtime decision for v1:
  - Polling-only chosen
  - WebSockets deferred
- Documented hardening rules for Talk Room realtime behavior:
  - Source of truth = `/api/chat-night/room/{room_id}`
  - Poll cadence = foreground `2000ms`, background `4000ms`, error backoff `5000ms`
  - Immediate poll triggers on app active / tab visibility return / window focus
  - No duplicate alerts/navigation expected during ended/unlock transitions
  - `429` handling expectation documented (throttled/retry messaging + bounded backoff)
- Replaced manual browser runbook with deterministic PASS-required "2 browsers, 1 room" checklist including A3 recovery + A4 decision confirmation.

Why:
- Finalize Week 6-A4 as a docs-first decision and lock v1 realtime behavior without websocket scope expansion.

How verified:
- `git diff --name-only` shows only docs/checklist files (no backend/mobile code changes).
- Keyword checks confirm docs include both required phrases:
  - "Polling-only chosen"
  - "WebSockets deferred"

Tag:
- v1-w6a4-polling-only-decision

Risks / follow-ups:
- WebSockets remain deferred; any future push-based realtime should be scoped as post-Week-6 work.
- W6-A5 can still add optional automation on top of this manual PASS checklist.

## W6-A2 - Authoritative Talk Room timer (server-based)

Date: 2026-02-23  
Agent: Frontend Agent + QA Agent (Antigravity)

Files changed:
- mobile-app/app/chat/talk-room.tsx

What changed:
- Replaced pure client countdown with server-authoritative estimation derived from backend `seconds_remaining`.
- On each successful poll, store authoritative `seconds_remaining` and sync timestamp, then estimate remaining time between polls.
- Added immediate refresh on app active / tab focus / visibility change to reduce drift after backgrounding.
- Kept polling (no websockets) with bounded intervals/backoff.

Why:
- Make timer stable across two clients and resilient to backgrounding/network jitter.

How verified:
- Backend health endpoint returned healthy/connected.
- Two-client sanity: both clients stayed within about 0-1s drift and snapped back after background.

Tag:
- v1-w6a2-authoritative-timer

Risks / follow-ups:
- Remaining W6-A work included engage sync, NetworkError recovery, realtime decision, and PASS-required "2 browsers, 1 room" checklist.

## W6-A1.1 - Engage sync + stale-room expiry normalization (backend)

Date: 2026-02-23  
Agent: Backend Agent + QA Agent (Antigravity)

Files changed:
- backend/app/routers/chat_night.py
- backend/verify_talk_room_engage_sync.ps1 (new)

What changed:
- Added shared room-state helpers to normalize expiry and compute `engage_status` consistently.
- Updated active-room lookup to clean stale expired records before returning.
- Updated `/my-room` and `/room/{room_id}` to use shared remaining-time + engage-state logic.
- Made `/engage` idempotent and safer around expiry/ended states.
- Added deterministic verifier: `verify_talk_room_engage_sync.ps1`.

Why:
- Ensure Engage state transitions are consistent across two clients and stale rooms do not create misleading UI state.

How verified:
- Backend health endpoint returned healthy/connected.
- Existing regression scripts passed.
- New verifier passed ("PASS: talk room engage sync verified").

Tag:
- v1-w6a1_1-engage-sync

Risks / follow-ups:
- A narrow simultaneous `/engage` race remains possible without a DB-level unique guard on unlock records.
