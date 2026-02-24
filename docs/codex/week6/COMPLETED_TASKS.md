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