# Week 7 — Track 4 (PHOTOS) — PENDING TASKS

Owner: Lead + Backend + Frontend + QA
Goal: Real photo upload/storage + reliable profile photos
Provider: Cloudflare R2 (signed uploads)

## Status
- Track 4: ⏳ TODO

## Dependencies
- W7-0 (Baseline): security + PII patch set
- Track 1 (OTP): ✅ DONE (preferred before broad photo testing)

## Core Specs (must be enforced)
- Max upload size: 5MB
- Allowed types only: image/jpeg, image/png, image/webp
- Signed URL expiry: 300 seconds max
- Upload method: client uploads directly to R2 via PUT (no backend proxy)
- URL safety:
  - Backend must reject any file:// URI
  - Backend must allowlist URLs to R2_PUBLIC_BASE_URL only (reject other domains)

## Subtasks
- [ ] T4-A (Backend) Signed upload flow (R2):
  - Add BH_PHOTOS_ENABLED kill switch (default true)
  - Endpoint returns:
    - presigned PUT upload URL (expires <= 300s)
    - final public HTTPS URL (must be under R2_PUBLIC_BASE_URL)
    - required headers/metadata for upload (e.g., Content-Type)
  - Validate inputs:
    - content_type must be one of: image/jpeg, image/png, image/webp
    - content_length must be <= 5MB
  - Storage rules:
    - backend stores only final HTTPS URLs under R2_PUBLIC_BASE_URL
    - explicitly reject file:// and any non-allowlisted URL domains (also on profile update)
- [ ] T4-B (Frontend) Photo upload UX:
  - pick + compress + upload + progress + retries
  - PUT directly to presigned URL (no proxy through backend)
  - save final HTTPS URL to profile
- [ ] T4-C (QA) Photo smoke:
  - slow network retry
  - invalid URL rejection (file://, non-R2 domain)
  - invalid mime type rejection
  - oversized upload rejection (>5MB)
- [ ] T4-D (Docs) Storage runbook:
  - env vars, bucket naming, R2_PUBLIC_BASE_URL rules, troubleshooting

## Rollback / Kill switch (required)
- BH_PHOTOS_ENABLED=true (default)
- If false: uploads disabled; placeholders allowed.

## Acceptance Criteria (Track 4)
- Photo uploads succeed reliably on Android.
- No local file:// URIs stored in DB.
- Backend rejects non-allowlisted external URLs (enforce R2_PUBLIC_BASE_URL).
- Max size and mime-type enforcement works (5MB + jpeg/png/webp only).