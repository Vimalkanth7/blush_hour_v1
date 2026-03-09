# Week 7 — Track 1 (OTP) — COMPLETED TASKS

## ✅ T1-A — Backend OTP endpoints (Twilio Verify + test provider)
Status: DONE  
Merged: 96609aa (into main)  
Feature commit: 9c0f4d3  
Scope: backend only

What shipped:
- Added OTP config flags (BH_OTP_ENABLED, BH_OTP_PROVIDER, BH_OTP_TEST_CODE, TWILIO_* env placeholders).
- Added OTP service: Twilio Verify provider + test provider gated by CHAT_NIGHT_TEST_MODE=true.
- Added endpoints:
  - POST /api/auth/otp/start → {"status":"sent"} (strict E.164 validation)
  - POST /api/auth/otp/verify → JWT response (reuses existing login response)
- Added IP-based rate limiting.
- No OTP/full phone logging; uses phone_sha256 in events.

How verified:
- Manual OTP test in test provider mode (start + verify) → JWT returned.
- Config failure paths return 503 (disabled/unconfigured/test-provider blocked outside test mode).
- backend\verify_profile_strength_contract.ps1 → PASS
- backend\verify_chat_night_icebreakers_contract.ps1 → PASS


## ✅ T1-B — Frontend OTP UI flow (/login → /otp-code)
Status: DONE  
Merged: 9f9c45f (into main)  
Feature commit: b8ee094  
Scope: mobile-app only

What shipped:
- /login is OTP phone entry (E.164 validation) → calls POST /api/auth/otp/start.
- /otp-code screen → calls POST /api/auth/otp/verify and stores JWT via AuthContext.
- Resend OTP with 30s cooldown + friendly handling for 503/429/network errors.
- Api.ts helpers: otpStart(phone), otpVerify(phone, code)

How verified:
- Manual click-through:
  - /login → +919999999999 → Send OTP → /otp-code
  - 000000 → Verify → logged in
  - Resend cooldown observed (~30s)


## ✅ T1-C — QA OTP login contract verifier
Status: DONE  
Merged: ce7dcb8 (into main)  
QA commit: 84e5523  
Scope: QA-only (backend verifier script)

What shipped:
- Added backend/verify_otp_login_contract.ps1 validating:
  - /health = healthy
  - otp/start = sent
  - otp/verify returns access_token
  - invalid code returns 400 + "Invalid code"
  - rate limit triggers within 4 rapid attempts

How verified:
- Your run output shows PASS for all checks including 429 rate limit.


## ✅ T1-D OTP runbook
Status: DONE  
Date: 2026-03-09  
Scope: docs only (`docs/codex/week7/track1`)

What shipped:
- Added `OTP_RUNBOOK.md` with purpose, environment presets, backend run commands, frontend test flow, QA verifier guidance, troubleshooting, India DLT checklist, and security rules.

How verified:
- `Test-Path docs/codex/week7/track1/OTP_RUNBOOK.md` -> `True`
- `Select-String -Path docs/codex/week7/track1/OTP_RUNBOOK.md -Pattern "BH_OTP_PROVIDER=test","BH_OTP_PROVIDER=twilio","DLT" -SimpleMatch` -> matches found
