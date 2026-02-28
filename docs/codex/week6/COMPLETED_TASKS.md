# Week 6 — Completed Tasks

## 🟢 W6-A2 — Authoritative Talk Room timer (server-based)

Status: DONE  
Owner: Frontend Agent  
Tag: v1-w6a2-authoritative-timer

Notes:
- Talk Room countdown is derived from backend-provided seconds_remaining (poll-synced) instead of pure client decrement.
- Added snap-back refresh on focus/visibility/app-active so backgrounding doesn’t drift.
- Polling kept (no websockets) with controlled intervals/backoff.
- Verified two-client drift stayed ~0–1s and snapped back after background.

## 🟢 W6-A1.1 — Engage sync + stale-room expiry normalization (backend)

Status: DONE  
Owner: Backend Agent  
Tag: v1-w6a1_1-engage-sync

Notes:
- Added shared room-state helpers to normalize expiry + compute engage_status consistently.
- /my-room and /room/{room_id} now return consistent remaining time + engage state.
- /engage made idempotent and safer (repeat engage does not duplicate side effects).
- Added deterministic verifier: backend\verify_talk_room_engage_sync.ps1 — PASS

## 🟢 W6-A1.2 — Engage UI sync (frontend)

Status: DONE  
Owner: Frontend Agent  
Tag: v1-w6a1_2-engage-ui-sync

Notes:
- Talk Room UI explicitly reflects engage_status:
  - waiting_for_partner → “Waiting”
  - match_unlocked → “Unlocked”
- Added guards for missing roomId/token + explicit 401/403/404 handling to avoid false NetworkError.
- Added one-time navigation guard to prevent duplicate alerts/navigation on refocus/poll.
- Verified via two-browser manual test + backend verifier PASS.

## 🟢 W6-A3 — Resolve NetworkError + recovery UX (frontend)

Status: DONE  
Owner: Frontend Agent  
Tag: v1-w6a3-network-recovery

Notes:
- Replaced Talk Room `networkError` boolean with a network state machine:
  - `ok` / `reconnecting` / `offline` / `rate_limited`
- Added bounded poll backoff steps `[2000, 3000, 5000, 8000, 13000]`.
- Backoff index now resets on successful poll and returns to standard `2000ms` cadence.
- Added explicit poll handling:
  - `429` → `Retrying (rate limit)...` and delayed retry
  - `5xx` / fetch throw → `Reconnecting...` and bounded retry
  - web offline (`navigator.onLine === false`) → `Offline` and delayed retry
- Preserved existing authoritative timer + engage/match navigation + one-time navigation guard.
