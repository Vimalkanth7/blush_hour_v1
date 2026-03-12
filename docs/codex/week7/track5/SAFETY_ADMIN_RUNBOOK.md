# Track 5 — Safety / Admin / Monitoring — Runbook

## 1) Purpose
This runbook explains how to operate Blush Hour safety tooling during pilot and beta rollout.

Current backend safety/admin scope:
- User safety endpoints:
  - `POST /api/safety/block`
  - `POST /api/safety/unblock`
  - `GET /api/safety/blocks`
  - `POST /api/safety/mute`
  - `POST /api/safety/unmute`
  - `GET /api/safety/mutes`
  - `POST /api/safety/report`
- Admin moderation endpoints:
  - `GET /api/admin/reports`
  - `GET /api/admin/reports/{report_id}`
  - `POST /api/admin/reports/{report_id}/resolve`

Important:
- Safety tools are backend-enforced APIs first.
- Frontend safety UX and QA verification are tracked separately.
- Track 5 is not complete until QA verifies end-to-end moderation and safety behavior.

---

## 2) Required backend environment variables

Minimum:
- `SECRET_KEY=<set in local .env>`
- `BH_SAFETY_TOOLS_ENABLED=true`

Notes:
- `BH_SAFETY_TOOLS_ENABLED=false` disables:
  - report
  - mute / unmute / mutes list
- `block` and `unblock` must remain available even when safety tools are disabled.

---

## 3) Safety controls summary

### Block
- Purpose: hard user-level protection.
- Expected behavior:
  - user can block another user
  - user can unblock later
  - block list is queryable by the acting user
- Emergency rule:
  - block must stay available even if safety tools are otherwise disabled

### Mute
- Purpose: softer user-level suppression
- Gated by `BH_SAFETY_TOOLS_ENABLED`

### Report
- Purpose: create a moderation record for admin review
- Gated by `BH_SAFETY_TOOLS_ENABLED`
- Current moderation fields on reports:
  - `status`
  - `resolved_at`
  - `resolved_by_admin_id`
  - `resolution`

---

## 4) Admin moderation queue flow

### List open reports
`GET /api/admin/reports?status=open`

Returns lightweight queue fields:
- id
- reporter_user_id
- reported_user_id
- room_id
- category
- status
- created_at
- resolved_at
- resolved_by_admin_id

### Get one report detail
`GET /api/admin/reports/{report_id}`

Returns the persisted report fields including:
- details
- resolution metadata if already resolved

### Resolve report
`POST /api/admin/reports/{report_id}/resolve`

Allowed resolutions:
- `dismissed`
- `warned`
- `banned_user`

If `resolution == banned_user`:
- backend bans the reported user
- admin audit log should record both resolution and ban-from-report action

---

## 5) Pilot operations checklist

Before pilot window:
- Confirm backend health:
  - `Invoke-RestMethod http://localhost:8000/health`
- Confirm safety routes are mounted:
  - `(Invoke-RestMethod http://localhost:8000/openapi.json).paths.PSObject.Properties.Name | Where-Object { $_ -like "/api/safety*" } | Sort-Object`
- Confirm admin moderation routes are mounted:
  - `(Invoke-RestMethod http://localhost:8000/openapi.json).paths.PSObject.Properties.Name | Where-Object { $_ -like "/api/admin/reports*" } | Sort-Object`
- Confirm admin auth token / admin workflow is available
- Confirm Mongo is reachable and audit logs are writing

During pilot:
- Check report queue at least once per active time window
- Resolve obvious spam/abuse quickly
- If a user must be removed urgently, use report resolution with `banned_user` or existing direct admin ban tools

After pilot:
- Review open reports count
- Review resolved reports count
- Review ban actions in audit logs
- Record any product gaps for next engineering cycle

---

## 6) Incident response

### A) Spam / harassment spike
1. Open admin reports queue
2. Identify repeated reported user_ids
3. Resolve urgent cases as `banned_user`
4. Record evidence via audit logs
5. If abuse volume becomes unmanageable:
   - temporarily disable report/mute endpoints only if necessary using:
     - `BH_SAFETY_TOOLS_ENABLED=false`
   - do **not** disable block

### B) Safety tools malfunction
1. Check `/health`
2. Check OpenAPI route presence for `/api/safety*`
3. Restart backend with correct env vars
4. Re-run smoke checks:
   - block
   - mute
   - report
   - admin reports list/detail/resolve

### C) False-positive moderation / mistaken ban
1. Inspect report detail
2. Inspect audit logs
3. Use existing admin unban flow if required
4. Add session log note for postmortem

---

## 7) Example PowerShell calls

### Create report
```powershell
Invoke-RestMethod -Method Post http://localhost:8000/api/safety/report `
  -Headers @{ Authorization = "Bearer $userToken" } `
  -ContentType "application/json" `
  -Body '{"target_user_id":"<target_id>","category":"spam"}'
```

### List open admin reports
```powershell
Invoke-RestMethod -Method Get "http://localhost:8000/api/admin/reports?status=open" `
  -Headers @{ Authorization = "Bearer $adminToken" }
```

### Resolve a report as dismissed
```powershell
Invoke-RestMethod -Method Post "http://localhost:8000/api/admin/reports/<report_id>/resolve" `
  -Headers @{ Authorization = "Bearer $adminToken" } `
  -ContentType "application/json" `
  -Body '{"resolution":"dismissed"}'
```

### Resolve a report and ban user
```powershell
Invoke-RestMethod -Method Post "http://localhost:8000/api/admin/reports/<report_id>/resolve" `
  -Headers @{ Authorization = "Bearer $adminToken" } `
  -ContentType "application/json" `
  -Body '{"resolution":"banned_user"}'
```

## 8) Troubleshooting

### `/api/safety/*` returns 404
- backend was not restarted after merge
- restart uvicorn and re-check OpenAPI

### `/api/safety/report` or `/api/safety/mute` returns 503
- `BH_SAFETY_TOOLS_ENABLED=false`
- this is expected in disabled mode

### `/api/admin/reports` returns 401/403
- admin token missing or invalid
- verify current admin auth path

### Invalid report resolution returns 400
- only these are valid:
  - `dismissed`
  - `warned`
  - `banned_user`

## 9) Security rules

- Never commit `.env`
- Never log phone numbers, OTP codes, tokens, or free-form sensitive report text
- Audit actions must remain admin-only
- Safety tooling should fail safely:
  - report/mute may be disabled
  - block must remain available

## 10) Follow-up still required

Track 5 still requires:
- T5-D QA verifier / final safety smoke
- final Track 5 closeout docs

Do not mark Track 5 done until QA confirms behavior.
