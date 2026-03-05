# Week 7 — Track 4 (PHOTOS) — PENDING TASKS

Owner: Lead + Backend + Frontend + QA  
Goal: Real photo upload/storage + reliable profile photos  
Provider: Cloudflare R2 (signed uploads)

## Status
- Track 4: ⏳ TODO

## Dependencies
- W7-0 (Baseline): security + PII patch set

## Subtasks
- [ ] T4-A (Backend) Signed upload flow (R2):
  - endpoint returns signed upload URL + final HTTPS URL/key
  - backend stores only HTTPS URLs from our bucket/CDN domain
- [ ] T4-B (Frontend) Photo upload UX:
  - pick + compress + upload + progress + retries
  - save final HTTPS URL to profile
- [ ] T4-C (QA) Photo smoke:
  - slow network retry
  - invalid URL rejection
- [ ] T4-D (Docs) Storage runbook:
  - env vars, bucket naming, CDN domain rules, troubleshooting

## Rollback / Kill switch (required)
- BH_PHOTOS_ENABLED=true (default)
- If false: uploads disabled; placeholders allowed.

## Acceptance Criteria (Track 4)
- Photo uploads succeed reliably on Android.
- No local file:// URIs stored in DB.
- Backend rejects non-approved external URLs.
