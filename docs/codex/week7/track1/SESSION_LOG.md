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
- Added POST /api/auth/otp/start and POST /api/auth/otp/verify (JWT issued; user created if missing).
- Added BH_OTP_ENABLED, BH_OTP_PROVIDER (twilio|test), BH_OTP_TEST_CODE + TWILIO_* env placeholders.
- Added test provider gated by CHAT_NIGHT_TEST_MODE=true.
- Added IP-based rate limiting.

Decisions:
- Backend-driven OTP keeps Expo client thin and enables server-side abuse controls.
- Test provider enables deterministic QA without Twilio spend.

How verified:
- Manual test provider flow → OTP start=sent, verify returns access_token.
- backend\verify_profile_strength_contract.ps1 → PASS
- backend\verify_chat_night_icebreakers_contract.ps1 → PASS

PR/commit refs:
- Merged: 96609aa (feature commit 9c0f4d3)

Risks/follow-ups:
- Add per-phone throttling later if needed (Redis).
- India DLT checklist to be documented in T1-D.


## 2026-03-09 — T1-B merged (Frontend OTP UI)
What changed:
- /login now runs OTP phone entry flow (E.164 validation).
- /otp-code screen verifies OTP and signs in via AuthContext.
- Resend OTP cooldown + error handling.
- Api.ts adds otpStart/otpVerify helpers.

Decisions:
- Reused AuthContext session storage to avoid breaking login state.
- E.164 validation reduces bad requests and improves UX.

How verified:
- Manual click-through: /login → send OTP → /otp-code → verify → logged in.
- Resend cooldown observed.

PR/commit refs:
- Merged: 9f9c45f (feature commit b8ee094)

Risks/follow-ups:
- “Create account” route still points to legacy flow; should redirect to OTP flow later.


## 2026-03-09 — T1-C completed (QA OTP verifier)
What changed:
- Added backend/verify_otp_login_contract.ps1:
  - /health ok
  - otp/start sent
  - otp/verify returns access_token (redacted)
  - invalid code returns 400 + “Invalid code”
  - rate limit triggers (429 within 4 attempts)

Decisions:
- Deterministic test-provider verifier avoids Twilio dependency for QA.
- Token never printed.

How verified:
- PASS output you ran:
  - PASS: GET /health returned status=healthy
  - PASS: otp/start status=sent
  - PASS: otp/verify returned access_token
  - PASS: invalid code → 400 contains “Invalid code”
  - PASS: rate limiter triggered (429)

PR/commit refs:
- Merged: ce7dcb8 (QA commit 84e5523)

Risks/follow-ups:
- Rate-limit check can be affected if other tests hit the same endpoint/IP.


## 2026-03-09 — T1-D completed (OTP runbook + India DLT checklist)
What changed:
- Added `docs/codex/week7/track1/OTP_RUNBOOK.md`.
- Updated Track 1 docs trackers to mark T1-D complete.
- Included copy/paste env presets for test provider and Twilio Verify.

Decisions:
- Kept this task docs-only to preserve backend/frontend stability.
- Included both `DEV_TEST` and `DEV_TWILIO` presets so local QA can switch modes safely.
- Added an explicit India DLT checklist because OTP delivery in India can fail without DLT readiness.

How verified:
- `Test-Path docs/codex/week7/track1/OTP_RUNBOOK.md` -> `True`
- `Select-String -Path docs/codex/week7/track1/OTP_RUNBOOK.md -Pattern "BH_OTP_PROVIDER=test","BH_OTP_PROVIDER=twilio","DLT" -SimpleMatch` -> matches found
- `git status --short` -> only Track 1 docs files changed for this task
- `git diff --name-only` -> `docs/codex/week7/track1/*` task files listed

PR/commit refs:
- Branch target: `chore/docs-week7-track1-t1d-otp-runbook`

Risks/follow-ups:
- Twilio trial limitations and DLT onboarding timing can still block real-device OTP delivery in India.
