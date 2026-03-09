# Week 7 — Track 1 (OTP) — COMPLETED TASKS

## ✅ T1-A — Backend OTP endpoints (Twilio Verify + test provider)
Status: DONE  
Merged: 96609aa (into main)  
Feature commit: 9c0f4d3  
Scope: backend only

What shipped:
- Added OTP config:
  - BH_OTP_ENABLED (kill switch)
  - BH_OTP_PROVIDER (twilio|test)
  - BH_OTP_TEST_CODE
  - TWILIO_* env placeholders
- Added OTP service module:
  - Twilio Verify provider (start/verify)
  - Test provider gated by CHAT_NIGHT_TEST_MODE=true
- Added endpoints:
  - POST /api/auth/otp/start  → {"status":"sent"} (strict E.164 validation)
  - POST /api/auth/otp/verify → JWT response (reuses existing LoginResponse)
- Added rate limiting:
  - start: 3/min (IP-based)
  - verify: 10/min (IP-based)
- Observability hygiene:
  - No OTP code/full phone logs
  - Uses phone_sha256 for events

How verified:
- Manual test provider flow (start + verify) → JWT returned
- Config failure handling:
  - provider=twilio without creds → 503 OTP not configured
  - BH_OTP_ENABLED=false → 503 OTP disabled
  - provider=test with CHAT_NIGHT_TEST_MODE=false → 503 OTP not configured
- Regressions:
  - backend\verify_profile_strength_contract.ps1 → PASS
  - backend\verify_chat_night_icebreakers_contract.ps1 → PASS