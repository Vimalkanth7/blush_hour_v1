# docs/codex/week6/COMPLETED_TASKS.md

# Week 6 — Completed Tasks

## 🟢 W6-A2 — Authoritative Talk Room timer (server-based)

Status: DONE
Owner: Frontend Agent
Tag: v1-w6a2-authoritative-timer

Notes:

* Talk Room countdown is derived from backend-provided seconds_remaining (poll-synced) instead of pure client decrement.
* Added snap-back refresh on focus/visibility/app-active so backgrounding doesn’t drift.
* Polling kept (no websockets) with controlled intervals/backoff.
* Verified two-client drift stayed ~0–1s and snapped back after background.
