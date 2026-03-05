# Week 7 — Track 0 (SECURITY + PII BASELINE) — PENDING TASKS

Owner: Lead + Backend + QA  
Goal: Remove security/PII launch blockers before OTP/Voice/Passes/Photos.

## Status
- Track 0: ⏳ TODO

## Subtasks
- [ ] T0-A Require SECRET_KEY at boot (no fallback defaults)
- [ ] T0-B Remove phone_number and sensitive fields from discovery/browse payloads
- [ ] T0-C Safe error responses (no raw exception detail to clients)
- [ ] T0-D Harden internal eval safety (keep env gating; reduce prod misconfig risk)

## Rollback / Kill switch (required)
- Add documented “strict mode” envs (implementation in code):
  - BH_STRICT_CONFIG=true (default)
  - BH_PUBLIC_DEBUG_ERRORS=false (default)

## Verification (must pass before Track 1+ starts)
- backend\verify_profile_completion.ps1
- backend\verify_profile_strength_contract.ps1
- backend\verify_languages_habits_contract.ps1
- backend\verify_chat_night_v5_only.ps1
- backend\verify_chat_night_fifo_only.ps1
- backend\verify_chat_night_icebreakers_contract.ps1
- backend\verify_chat_night_icebreakers_reveal_sync.ps1
