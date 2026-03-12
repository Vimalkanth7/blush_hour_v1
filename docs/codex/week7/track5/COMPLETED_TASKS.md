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

  ## ✅ T5-B — Backend moderation queue + admin report actions
Status: DONE  
Merged: 7499758  
Feature commit: 75c3623  
Branch: feat/backend-w7-t5b-admin-reports-queue  
Scope: backend only

What shipped:
- Extended `UserReport` with moderation fields:
  - `status`
  - `resolved_at`
  - `resolved_by_admin_id`
  - `resolution`
- Added admin-only moderation queue endpoints:
  - `GET /api/admin/reports`
  - `GET /api/admin/reports/{report_id}`
  - `POST /api/admin/reports/{report_id}/resolve`
- Added resolution handling for:
  - `dismissed`
  - `warned`
  - `banned_user`
- Kept existing admin ban/unban behavior intact by reusing the same persistence style.
- Added audit logging for:
  - queue view
  - report detail view
  - report resolution
  - ban-from-report flow

How verified:
- `/health` returned healthy.
- Regression smoke passed:
  - `verify_profile_strength_contract.ps1`
  - `verify_chat_night_icebreakers_contract.ps1`
- Manual admin moderation flow passed:
  - created reports through `/api/safety/report`
  - listed open reports via `/api/admin/reports?status=open`
  - fetched detail via `/api/admin/reports/{report_id}`
  - resolved one report as `dismissed`
  - resolved one report as `banned_user`
- Validation checks confirmed:
  - 400 for invalid status / invalid report id / invalid resolution
  - 404 for missing report id
- Audit log evidence confirmed:
  - `view_reports_queue`
  - `view_report_detail`
  - `resolve_report`
  - `ban_user_from_report`