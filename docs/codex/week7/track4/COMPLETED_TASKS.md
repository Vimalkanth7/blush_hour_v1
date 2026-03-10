# Week 7 — Track 4 (PHOTOS) — COMPLETED TASKS

## ✅ T4-A — Backend signed photo upload flow (Cloudflare R2 presigned PUT)
Status: DONE  
Merged: 7b90ff2  
Feature commit: 87e156d  
Scope: backend only

What shipped:
- Added R2 storage config + kill switch:
  - BH_PHOTOS_ENABLED
  - R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_BASE_URL
- Added POST /api/photos/upload-url (auth):
  - returns presigned PUT upload_url + final_url under R2_PUBLIC_BASE_URL
  - validates content_length <= 5MB and content_type in {image/jpeg, image/png, image/webp}
  - presign expiry capped to 300s
- Hardened PATCH /api/users/me photos:
  - rejects file://
  - rejects non-R2_PUBLIC_BASE_URL domains
  - validates object exists + type/size via HEAD
- Added boto3 dependency (no secrets committed).

How verified:
- compileall app (PASS)
- Manual flow:
  - /api/photos/upload-url -> PUT to R2 -> PATCH /api/users/me with final_url (PASS)
- Negative checks:
  - file:// rejected (400)
  - non-R2 URL rejected (400)
  - >5MB rejected (413)
  - BH_PHOTOS_ENABLED=false returns 503 (PASS)

Notes / follow-ups:
- Some existing backend verifiers may fail until T4-B uploads real R2 URLs (or we bypass photos in QA).



## ✅ T4-B — Frontend photo upload to R2 via presigned PUT
Status: DONE  
Merged: b5af95b (Merge PR #27)  
Feature commit: f62ab85  
Scope: mobile-app only

What shipped:
- Onboarding Photos step now uploads photos to Cloudflare R2:
  - Converts selected image URI to Blob.
  - Validates size <= 5MB and type in {image/jpeg, image/png, image/webp}.
  - Calls POST /api/photos/upload-url with content_type + content_length.
  - PUTs bytes directly to presigned upload_url with required headers (Content-Type).
  - PATCHes /api/users/me with photos=[final_url,...] (HTTPS only).
- Added API helper in mobile-app/constants/Api.ts:
  - photoUploadUrl(content_type, content_length, token)
- Added basic upload UX: disables Next while submitting; progress string support; friendly error messages.

How verified:
- Lint:
  - npx eslint app/(onboarding)/photos.tsx constants/Api.ts → PASS
- Web export:
  - npx expo export --platform web → PASS
- Backend smoke:
  - POST /api/photos/upload-url returned upload_url + final_url (R2) with expires_in=300 and required_headers Content-Type.
- Manual UI:
  - Selected 4 photos on Photos step → Next completed without errors.


## ✅ T4-C — QA photo contract smoke + verifier alignment
Status: DONE  
Merged: 2e4c1b7 (Merge PR #29)  
Feature commit: 8fe4e1a  
Scope: backend verifiers only

What shipped:
- Added new verifier: `backend\verify_photos_r2_contract.ps1`.
- Updated legacy verifier scripts to align with R2 URL allowlist behavior and avoid placeholder photo URL assumptions.
- Covered required smoke cases:
  - slow network retry behavior
  - invalid URL rejection (`file://`, non-R2 domain)
  - invalid MIME rejection
  - oversized upload rejection (`>5MB`)

How verified:
- `backend\verify_photos_r2_contract.ps1 -BaseUrl http://localhost:8000` → `PASS: photos R2 contract verified (W7-T4-C)`
- Legacy verifiers executed after updates (PASS)


## ✅ T4-D — Docs runbook + Track 4 closeout
Status: DONE  
Merged: local docs branch (this task)  
Scope: docs only

What shipped:
- Added Track 4 storage runbook:
  - `docs/codex/week7/track4/PHOTOS_R2_RUNBOOK.md`
- Updated Track 4 status and task docs to close out T4-C/T4-D.
- Filled missing merge commit placeholders for Track 4 history consistency.

How verified:
- Doc existence + keyword checks for env vars, verifier command, and closeout markers (PASS)
