# Week 7 — Track 4 (PHOTOS) — SESSION LOG

## Log Format
- Date (YYYY-MM-DD)
- What changed
- Decisions (why we chose X over Y)
- How verified (commands + PASS lines)
- PR/commit refs
- Risks/follow-ups

## Entries
## 2026-03-10 — T4-A merged (Backend R2 presigned upload + allowlist validation)
What changed:
- Added R2-backed photo upload support with presigned PUT URLs.
- Enforced strict allowlist rules for stored photo URLs:
  - only R2_PUBLIC_BASE_URL URLs allowed
  - file:// explicitly rejected
  - object validated via HEAD for size/type
- Added BH_PHOTOS_ENABLED kill switch.

Decisions (why we chose X over Y):
- Presigned PUT (client uploads directly to R2) to avoid backend proxy bandwidth and improve reliability.
- Hard allowlist (R2_PUBLIC_BASE_URL only) to prevent insecure external URL storage and stop file:// URIs.
- HEAD validation in backend so profile cannot reference missing/oversized/wrong-type objects.

How verified (commands + PASS lines):
- Backend compile:
  - python -m compileall app  (PASS)
- Manual API flow:
  - POST /api/photos/upload-url  (PASS: upload_url + final_url)
  - PUT to presigned URL (PASS: 200)
  - PATCH /api/users/me photos=[final_url] (PASS)
- Negative tests:
  - file:// rejected (400)
  - non-R2 rejected (400)
  - >5MB rejected (413)
  - BH_PHOTOS_ENABLED=false rejected (503)

PR/commit refs:
- Merge commit: 7b90ff2
- Feature commit: 87e156d

Risks / follow-ups:
- Existing verifiers that patch placeholder photo URLs may fail until T4-B uploads real R2 photos or QA scripts are updated.