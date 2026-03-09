# Week 7 — Track 1 (OTP) — SESSION LOG

## Log Format
- Date (YYYY-MM-DD)
- What changed
- Decisions (why we chose X over Y)
- How verified (commands + PASS lines)
- PR/commit refs
- Risks/follow-ups

## Entries
- (none yet)
## 2026-03-09 — T1-B merged (Frontend OTP UI)
What changed:
- Replaced /login UI with OTP phone entry flow (E.164 validation).
- Added /otp-code screen for code entry + verify.
- Added resend OTP with 30s cooldown.
- Added otpStart/otpVerify helpers in Api.ts.
- JWT stored using existing AuthContext.signIn(access_token).

Decisions (why we chose X over Y):
- Kept OTP flow minimal and reused AuthContext storage to avoid breaking session handling.
- Used E.164 validation client-side to reduce bad requests and improve UX.
- Implemented resend cooldown to reduce abuse and improve deliverability.

How verified (commands + PASS lines):
- Manual web click-through:
  - /login → send OTP → /otp-code → verify → logged in
  - resend cooldown observed
- Backend endpoints:
  - POST /api/auth/otp/start → sent
  - POST /api/auth/otp/verify → access_token returned

PR/commit refs:
- Merged into main: MERGE_COMMIT_FOR_T1B
- Feature commit: b8ee094

Risks / follow-ups:
- “Create account” route still points to legacy flow; should be redirected to OTP flow to avoid two entry experiences.