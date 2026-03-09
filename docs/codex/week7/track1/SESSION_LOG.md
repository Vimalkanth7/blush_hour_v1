# Week 7 — Track 1 (OTP) — SESSION LOG

## Log Format
- Date (YYYY-MM-DD)
- What changed
- Decisions (why we chose X over Y)
- How verified (commands + PASS lines)
- PR/commit refs
- Risks/follow-ups

## Entries

## 2026-03-09 — T1-A merged (Backend OTP endpoints)
What changed:
- Added backend OTP endpoints:
  - POST /api/auth/otp/start
  - POST /api/auth/otp/verify (issues JWT; creates user if needed)
- Added OTP config flags:
  - BH_OTP_ENABLED (kill switch)
  - BH_OTP_PROVIDER (twilio|test)
  - BH_OTP_TEST_CODE
  - TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_VERIFY_SERVICE_SID
- Added OTP service module with Twilio Verify + test provider (test gated by CHAT_NIGHT_TEST_MODE=true).
- Added rate limits (IP-based): start 3/min, verify 10/min.
- Added privacy hygiene: no OTP/full phone logging; uses phone_sha256.

Decisions (why we chose X over Y):
- Twilio Verify chosen as backend-driven OTP so Expo client stays thin and we control abuse limits server-side.
- Added test OTP provider (gated) to allow local QA and CI-style smoke tests without Twilio spend/credentials.
- Enforced strict E.164 validation to keep inputs predictable and reduce edge-case abuse.
- Kept responses minimal to avoid leaking phone/OTP details.

How verified (commands + PASS lines):
- Manual test (test provider):
  - POST /api/auth/otp/start with +919999999999 → {"status":"sent"}
  - POST /api/auth/otp/verify with code 000000 → JWT returned
- Safety/config checks:
  - provider=twilio without creds → 503 "OTP service not configured"
  - BH_OTP_ENABLED=false → 503 "OTP login is disabled"
  - provider=test with CHAT_NIGHT_TEST_MODE=false → 503 "OTP service not configured"
- Regression:
  - backend\verify_profile_strength_contract.ps1 → PASS
  - backend\verify_chat_night_icebreakers_contract.ps1 → PASS

PR/commit refs:
- Merged into main: 96609aa
- Feature commit: 9c0f4d3

Risks / follow-ups:
- Per-phone throttling is not implemented yet (only IP-based). If needed, add Redis-backed per-phone rate limits.
- Twilio live path needs real SMS E2E test with India numbers and **DLT readiness** captured in T1-D docs + T1-C QA checklist.