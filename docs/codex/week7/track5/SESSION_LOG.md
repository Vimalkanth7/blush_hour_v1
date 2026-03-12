# Week 7 — Track 5 (SAFETY + ADMIN + MONITORING) — SESSION LOG

## Log Format (per entry)
- Date (YYYY-MM-DD)
- What changed
- Decisions (why we chose X over Y)
- How verified (commands + PASS lines)
- PR/commit refs
- Risks/follow-ups

## Entries
## 2026-03-12 — T5-A merged (backend safety tools)
What changed:
- Added backend safety primitives for block, mute, and report.
- Added persistence models for `UserBlock`, `UserMute`, and `UserReport`.
- Added authenticated `/api/safety` router and wired it into backend startup.
- Added kill-switch behavior so `report` and `mute` are gated, while `block` remains available.

Decisions (why we chose X over Y):
- Kept `block` available even when safety tools are disabled, because blocking is a core protection mechanism and should not be turned off in emergencies.
- Logged only safe fields (`target_user_id`, `category`, `room_id`) to avoid PII leakage or free-form report text exposure.

How verified (commands + PASS lines):
- Route presence:
  - `(Invoke-RestMethod http://localhost:8000/openapi.json).paths.PSObject.Properties.Name | Where-Object { $_ -like "/api/safety*" } | Sort-Object`
  - Returned:
    - `/api/safety/block`
    - `/api/safety/blocks`
    - `/api/safety/mute`
    - `/api/safety/mutes`
    - `/api/safety/report`
    - `/api/safety/unblock`
    - `/api/safety/unmute`
- Manual smoke:
  - `POST /api/safety/block` → `status: ok`
  - `POST /api/safety/mute` → `status: ok`
  - `POST /api/safety/report` → `status: ok`
  - `GET /api/safety/blocks` → block list returned
  - `GET /api/safety/mutes` → mute list returned
- Regression smoke:
  - `Invoke-RestMethod http://localhost:8000/health` → healthy
  - `powershell -ExecutionPolicy Bypass -File .\backend\verify_profile_strength_contract.ps1` → PASS
  - `powershell -ExecutionPolicy Bypass -File .\backend\verify_chat_night_icebreakers_contract.ps1` → PASS

PR/commit refs:
- Merged into main: aeced0f
- Feature commit: 265d494

Risks / follow-ups:
- Frontend safety UI is still pending.
- Admin moderation queue and report resolution flow are still pending.
- QA verifier packet for safety/admin is still pending.
