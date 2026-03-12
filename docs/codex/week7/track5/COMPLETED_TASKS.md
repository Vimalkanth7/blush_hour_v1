# Week 7 — Track 5 (SAFETY + ADMIN + MONITORING) — COMPLETED TASKS

## ✅ T5-A — Backend safety tools (report / block / mute)
Status: DONE  
Merged: aeced0f  
Feature commit: 265d494  
Branch: feat/backend-w7-t5a-safety-tools  
Scope: backend only

What shipped:
- Added `BH_SAFETY_TOOLS_ENABLED` config flag.
- Added Beanie safety models:
  - `UserBlock`
  - `UserMute`
  - `UserReport`
- Added safety schemas for:
  - `BlockRequest`
  - `MuteRequest`
  - `ReportRequest`
  - blocks/mutes list responses
  - status response
- Added authenticated `/api/safety` endpoints:
  - `POST /block`
  - `POST /unblock`
  - `GET /blocks`
  - `POST /mute`
  - `POST /unmute`
  - `GET /mutes`
  - `POST /report`
- Kill switch behavior:
  - `report` + `mute` paths gated by `BH_SAFETY_TOOLS_ENABLED`
  - `block` remains available even when safety tools are disabled
- Added safe event logging without free-form payload dumps or PII.

How verified:
- OpenAPI route check:
  - `/api/safety/block`
  - `/api/safety/blocks`
  - `/api/safety/mute`
  - `/api/safety/mutes`
  - `/api/safety/report`
  - `/api/safety/unblock`
  - `/api/safety/unmute`
- Manual authenticated smoke:
  - `POST /api/safety/block` → `status: ok`
  - `POST /api/safety/mute` → `status: ok`
  - `POST /api/safety/report` → `status: ok`
  - `GET /api/safety/blocks` → returned block list
  - `GET /api/safety/mutes` → returned mute list
- Regression smoke:
  - `/health` healthy
  - `verify_profile_strength_contract.ps1` PASS
  - `verify_chat_night_icebreakers_contract.ps1` PASS