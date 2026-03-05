# Week 7 — Track 1 (OTP) — PENDING TASKS

Owner: Lead + Backend + Frontend + QA  
Goal: Phone OTP login for Android launch (trust + lower friction)  
Provider: Twilio Verify (backend-driven)

## Status
- Track 1: ⏳ TODO

## Dependencies (must be done before OTP ships)
- W7-0 (Baseline): security + PII patch set (no secret fallback, no PII leakage, safe errors)

## Subtasks
- [ ] T1-A (Backend) Add OTP endpoints using Twilio Verify:
  - POST /api/auth/otp/start
  - POST /api/auth/otp/verify (issue JWT)
- [ ] T1-B (Frontend) OTP UI flow:
  - phone entry → code entry → success → session token stored
  - resend cooldown + good error states
- [ ] T1-C (QA) OTP smoke + abuse checks:
  - happy path
  - invalid code
  - resend throttling / rate limit behavior
- [ ] T1-D (Docs) OTP runbook:
  - required env vars, local dev steps, test-mode steps, troubleshooting

## Acceptance Criteria (Track 1)
- OTP works end-to-end on Android (real device).
- Rate limits + anti-abuse in place (per IP/phone).
- No OTP codes or phone numbers logged/traced.
- Existing auth contract remains stable.
