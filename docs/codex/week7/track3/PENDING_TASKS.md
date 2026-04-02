# Week 7 - Track 3 Pending Tasks

Owner: Lead + Backend + Frontend + QA  
Goal: Passes monetization (Android-compliant)  
Provider: Google Play Billing consumables
Plan: `docs/codex/week7/track3/PLAN.md`

## Status
- Track 3 current scope: COMPLETE
- Current shipped scope closed in docs on `2026-04-02`.
- Final shipped Track 3 scope:
  - `W7-T3-B` - wallet/catalog foundation
  - `W7-T3-C` - frontend passes UI shell
  - `W7-T3-D` - backend Google validation / stub verification
  - `W7-T3-E` - real Play billing integration + real purchase validation proof
  - `W7-T3-F` - Chat Night pass consumption with free-first / paid-second
  - `W7-T3-G` - out-of-passes UX + paid-fallback hotfix
  - `W7-T3-H` - QA runtime verifier coverage
  - `W7-T3-J` - final docs closeout and runbook
- Final real Play billing proof recorded:
  - Play internal testing app installed from Play Store
  - real prices visible
  - purchase flow opened successfully
  - purchase completed successfully
  - backend `POST /api/passes/google/validate` returned `200 OK`
  - wallet refreshed from `0 -> 1`
  - app showed `Purchase validated. Wallet refreshed.`
  - Render logs showed `POST /api/passes/google/validate HTTP/1.1" 200 OK`
- Final Chat Night spend rule is locked:
  - consume free passes first
  - consume paid credits second
- T3-H regression coverage recorded:
  - disabled-mode PASS
  - stub-mode PASS
  - google-mode smoke PASS
  - delegated Chat Night spend-order PASS
  - full suite PASS
  - real Google validate intentionally reports `SKIP` when no real token is supplied
- T3-G final verified behavior recorded:
  - `Paid fallback PASS`
  - `Enter Pool available PASS`
  - `Stale-state refresh PASS`
  - `Fully exhausted state PASS`
  - `Open Passes CTA PASS`
- T3-H is additive QA coverage only:
  - real purchase validation was already completed in `W7-T3-E`
  - `W7-T3-H` adds repeatable regression coverage, not a replacement for real-device billing proof
- Current Track 3 work remaining:
  - none inside the shipped Week 7 Track 3 scope
  - `W7-T3-I` remains deferred to Phase 2

## Locked Decisions
- Android-first / Google Play Billing for paid passes.
- Google Play consumables only.
- Backend remains authoritative for wallet state, catalog availability, purchase validation, and entitlements.
- Free daily passes stay separate from paid credits.
- Spend order is locked:
  - consume free passes first
  - consume paid credits second
- Extensions are Phase 2 only.
- Backend Google Play purchase validation is shipped.
- Frontend Android billing integration code is merged to `main` via `fb54123`.
- Real end-to-end Google Play billing verification is complete.
- Subscriptions are out of scope for v1.

## Remaining Deferred Work
- [ ] `W7-T3-I` - Phase 2 extension design and implementation
  - Scope: docs first, implementation later
  - Goal: define extension rules only after wallet and billing flows are stable
  - Status: deferred / not part of current Track 3 closure
- Next item outside the shipped Track 3 scope:
  - future monetization planning starts with `W7-T3-I` only if Phase 2 is approved

## Provider Modes / Kill Switch
- `BH_PASSES_ENABLED=true` (default)
- If false: passes UI and passes endpoints should disable gracefully.
- `BH_PASSES_PROVIDER_MODE=stub|google`
- Keep `stub` for local verification and contract testing.
- Switch to `google` only when Play credentials are configured and Android billing is being exercised.
- Regression / verifier references:
  - `backend/verify_passes_contract.ps1`
  - `backend/verify_passes_runtime_suite.ps1`
  - `backend/verify_chat_night_pass_consumption_contract.ps1`
