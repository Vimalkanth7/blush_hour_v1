# Week 7 Track 4 Photos R2 Runbook

## Purpose and scope
- This runbook covers local setup and verification for Track 4 real photo uploads using Cloudflare R2 presigned PUT URLs.
- Scope includes backend env setup, backend health/contract validation, onboarding photo test flow, and common failure triage.
- This runbook is docs-only guidance and does not include real credentials.

## Required env vars (placeholders only)
```dotenv
BH_PHOTOS_ENABLED=true
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_BUCKET=<bucket-name>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_PUBLIC_BASE_URL=https://<public-host-or-cdn>/<bucket-or-prefix>
```

## DEV preset blocks

### DEV_PHOTOS_ON
```dotenv
# DEV_PHOTOS_ON
BH_PHOTOS_ENABLED=true
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_BUCKET=<bucket-name>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_PUBLIC_BASE_URL=https://<public-host-or-cdn>/<bucket-or-prefix>
```

### DEV_PHOTOS_OFF
```dotenv
# DEV_PHOTOS_OFF
BH_PHOTOS_ENABLED=false
```

## PowerShell .env loader snippet
Run this from repo root in the same terminal session where backend will start:

```powershell
Get-Content .env | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $pair = $line -split "=", 2
  if ($pair.Count -ne 2) { return }
  [Environment]::SetEnvironmentVariable($pair[0].Trim(), $pair[1].Trim().Trim('"'), "Process")
}
```

## Backend run and health checks
Start backend from repo root:

```powershell
cd backend
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

In another terminal, verify API health:

```powershell
Invoke-RestMethod http://localhost:8000/health
```

Expected result: HTTP 200 with healthy status payload.

## How to validate Track 4 photos contract
From repo root:

```powershell
backend\verify_photos_r2_contract.ps1 -BaseUrl http://localhost:8000
```

Expected PASS line:
- `PASS: photos R2 contract verified (W7-T4-C)`

## Frontend test steps (Onboarding Photos)
1. Start web app from `mobile-app` with `npm run web`.
2. Sign in and reach onboarding Photos screen.
3. Pick image files (JPEG/PNG/WEBP) within 5MB limit.
4. Continue and confirm upload succeeds without proxying through backend.
5. Confirm profile save uses HTTPS URLs under `R2_PUBLIC_BASE_URL`.
6. Repeat with slow network throttling and verify retry behavior.

## Troubleshooting
### CORS or 403 from PUT upload
- Confirm R2 bucket CORS allows browser PUT from your local web origin.
- Confirm presigned URL has not expired (max 300 seconds).
- Confirm `Content-Type` sent by client matches signed request.

### Wrong endpoint
- `R2_ENDPOINT` must target your Cloudflare R2 S3-compatible endpoint.
- Region/host mismatches can invalidate signatures and return 403.

### Wrong public base URL
- `R2_PUBLIC_BASE_URL` must match the allowlisted domain used by backend validation.
- If backend rejects URL as non-allowlisted, align `R2_PUBLIC_BASE_URL` and client-final URL mapping.

### Wrong content type
- Allowed types are only `image/jpeg`, `image/png`, `image/webp`.
- Any other MIME should be rejected before upload URL issuance.

### Expiry issues
- Upload must complete before presigned URL expiry window closes.
- If users hit expiry frequently, request a new upload URL and retry.

## Security rules
- Never commit real keys or secrets (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) to git.
- Keep logs and traces PII-safe; avoid dumping full profile payloads or tokens.
- Keep `BH_PHOTOS_ENABLED` kill switch available for fast rollback.
- Do not store or accept `file://` photo URIs; only allow `R2_PUBLIC_BASE_URL` HTTPS URLs.
