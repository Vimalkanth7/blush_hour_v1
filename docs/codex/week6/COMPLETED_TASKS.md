# Week 6 - Completed Tasks

## W6-A4 - Realtime approach decision + hardening (docs-first)

Status: DONE  
Owner: Lead Agent + Backend Agent + Frontend Agent  
Tag: v1-w6a4-polling-only-decision

Notes:
- Polling-only chosen for v1 realtime behavior in Talk Room.
- WebSockets deferred to post-Week-6 scope.
- Source of truth documented as `GET /api/chat-night/room/{room_id}`.
- Polling hardening documented with explicit cadence/trigger rules:
  - Foreground poll `2000ms`
  - Background poll `4000ms`
  - Error backoff `5000ms`
  - Immediate poll on app-active, tab visibility return, and window focus
- Expected guardrails documented: no duplicate alerts/navigation during unlock/end transitions.
- `429` behavior documented: show throttled/retry messaging and keep bounded backoff.
- PASS-required manual checklist expanded for "2 browsers, 1 room" including A3 recovery + A4 decision confirmation.

## W6-A2 - Authoritative Talk Room timer (server-based)

Status: DONE  
Owner: Frontend Agent  
Tag: v1-w6a2-authoritative-timer

Notes:
- Talk Room countdown is derived from backend-provided `seconds_remaining` (poll-synced) instead of pure client decrement.
- Added snap-back refresh on focus/visibility/app-active so backgrounding does not drift.
- Polling kept (no websockets) with controlled intervals/backoff.
- Verified two-client drift stayed about 0-1s and snapped back after background.

## W6-A1.1 - Engage sync + stale-room expiry normalization (backend)

Status: DONE  
Owner: Backend Agent  
Tag: v1-w6a1_1-engage-sync

Notes:
- Added shared room-state helpers to normalize expiry + compute `engage_status` consistently.
- `/my-room` and `/room/{room_id}` now return consistent remaining time + engage state.
- `/engage` made idempotent and safer (repeat engage does not duplicate side effects).
- Added deterministic verifier: `backend\verify_talk_room_engage_sync.ps1` - PASS.
