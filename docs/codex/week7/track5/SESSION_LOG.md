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

## 2026-03-12 — T5-B merged (admin moderation queue + report resolution)
What changed:
- Extended `UserReport` with moderation metadata (`status`, `resolved_at`, `resolved_by_admin_id`, `resolution`).
- Added admin moderation queue endpoints for listing reports, fetching report detail, and resolving reports.
- Reused the existing admin ban persistence pattern so report-based bans and direct bans stay aligned.
- Added audit logging for report queue views, detail views, resolutions, and ban-from-report actions.

Decisions (why we chose X over Y):
- Reused the existing admin auth and audit patterns instead of introducing a second moderation auth path.
- Kept queue/list responses lightweight to avoid unnecessary exposure of report details in bulk views.
- Resolution was restricted to a small enum (`dismissed`, `warned`, `banned_user`) to keep moderation behavior explicit and auditable.

How verified (commands + PASS lines):
- Health:
  - `Invoke-RestMethod http://localhost:8000/health`
  - Returned healthy / connected
- Regression smoke:
  - `powershell -ExecutionPolicy Bypass -File .\backend\verify_profile_strength_contract.ps1`
  - PASS: profile_strength contract verified.
  - `powershell -ExecutionPolicy Bypass -File .\backend\verify_chat_night_icebreakers_contract.ps1`
  - PASS: chat night icebreakers contract verified (W6-B3)
- Manual moderation flow:
  - created reports via `/api/safety/report`
  - listed via `/api/admin/reports?status=open`
  - inspected via `/api/admin/reports/{report_id}`
  - resolved with `dismissed`
  - resolved with `banned_user`
- PASS evidence:
  - admin reports queue returned open reports
  - report detail returned full record including moderation fields
  - dismissed resolution persisted correctly and stayed idempotent
  - banned_user resolution persisted and banned the reported user
- Audit evidence:
  - `view_reports_queue`
  - `view_report_detail`
  - `resolve_report`
  - `ban_user_from_report`

PR/commit refs:
- Merged into main: 7499758
- Feature commit: 75c3623

Risks / follow-ups:
- Resolving as `banned_user` returns 404 if the reported user no longer exists; product decision may be needed later on whether “resolve anyway” should be allowed.
- User-facing safety UI is still pending.
- Track 5 QA verifier packet is still pending.
## 2026-03-12 — T5-C completed (safety/admin runbook added)
What changed:
- Added `SAFETY_ADMIN_RUNBOOK.md` for Track 5 operations.
- Marked T5-C complete in the Track 5 pending tracker.

Decisions (why we chose X over Y):
- We documented the currently merged backend safety/admin flows before Track 5 QA so pilot operations are explicit and repeatable.
- We kept Track 5 overall status as in progress because QA is still pending.

How verified (commands + PASS lines):
- `Test-Path "docs/codex/week7/track5/SAFETY_ADMIN_RUNBOOK.md"` -> True
- `Select-String -Path "docs/codex/week7/track5/SAFETY_ADMIN_RUNBOOK.md" -Pattern "BH_SAFETY_TOOLS_ENABLED","/api/safety/report","/api/admin/reports","banned_user" -SimpleMatch` -> matched
- `Select-String -Path "docs/codex/week7/track5/PENDING_TASKS.md" -Pattern "[x] T5-C" -SimpleMatch` -> matched

PR/commit refs:
- PR branch: chore/docs-week7-track5-t5c-runbook

Risks / follow-ups:
- T5-D QA verifier is still pending.
- Track 5 cannot be closed until QA confirms final behavior.

## 2026-03-12 — T5-B2 merged (block enforcement in Chat Night + voice)
What changed:
- Added block enforcement to Chat Night matching so blocked pairs are skipped during partner selection.
- Added blocked-room protection for:
  - `GET /api/chat-night/my-room`
  - `GET /api/chat-night/room/{room_id}`
  - `POST /api/chat-night/engage`
- Added blocked-pair protection in `POST /api/voice/token`.

Decisions (why we chose X over Y):
- We added this as a backend follow-up before QA because Track 5 was not functionally safe until block had real enforcement, not just persistence.
- Error messages were kept neutral so blocked users do not learn who blocked whom.

How verified (commands + PASS lines):
- `Invoke-RestMethod http://localhost:8000/health`
  - healthy / connected
- `powershell -ExecutionPolicy Bypass -File .\backend\verify_profile_strength_contract.ps1`
  - PASS: profile_strength contract verified.
- `powershell -ExecutionPolicy Bypass -File .\backend\verify_chat_night_icebreakers_contract.ps1`
  - PASS: chat night icebreakers contract verified (W6-B3)
- `powershell -ExecutionPolicy Bypass -File .\backend\verify_talk_room_engage_sync.ps1`
  - PASS: talk room engage sync verified.
- Manual block enforcement evidence:
  - match prevention: both users remained queued / no room created
  - blocked room access returned 403
  - blocked voice token returned 403
  - PASS: W7-T5-B2 manual block enforcement checks verified.

PR/commit refs:
- Merged into main: f8e9294
- Feature commit: b3114b0

Risks / follow-ups:
- Chat thread/message block gating was intentionally not added in this patch.
- T5-D QA verifier is still required before Track 5 can close.
