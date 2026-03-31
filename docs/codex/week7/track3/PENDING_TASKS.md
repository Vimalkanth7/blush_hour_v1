# Week 7 - Track 3 Pending Tasks

Owner: Lead + Backend + Frontend + QA  
Goal: Passes monetization (Android-compliant)  
Provider: Google Play Billing (consumables)  
Plan: `docs/codex/week7/track3/PLAN.md`

## Status
- Track 3: IN PROGRESS
- Real end-to-end Google Play billing verification for `W7-T3-E` is complete.
- Closed out in docs:
  - `W7-T3-A / W7-T3-DOCS` - DONE
  - `W7-T3-B` - DONE
  - `W7-T3-C` - DONE
  - `W7-T3-D` - DONE
  - `W7-T3-E` - DONE
  - `W7-T3-F` - DONE
  - `W7-T3-H` - DONE
- Next active item:
  - `W7-T3-G` - Out-of-passes UX
- Final real Play billing proof recorded:
  - Play internal testing app installed from Play Store
  - real prices visible
  - purchase flow opened successfully
  - purchase completed successfully
  - backend `POST /api/passes/google/validate` returned `200 OK`
  - wallet refreshed from `0 -> 1`
  - app showed `Purchase validated. Wallet refreshed.`
  - Render logs showed `POST /api/passes/google/validate HTTP/1.1" 200 OK`
- Final T3-E unblock recorded:
  - frontend merge to `main`: `fb54123`
  - hotfix branch: `fix/backend-w7-t3e-purchase-validation-beanie-collection`
  - hotfix commit: `7c6499d`
  - hotfix purpose: Beanie collection accessor compatibility in `backend/app/services/passes.py`
- T3-H regression coverage recorded:
  - QA branch: `test/qa-w7-t3h-passes-verifier`
  - QA commit: `2c71404`
  - disabled-mode PASS
  - stub-mode PASS
  - google-mode smoke PASS
  - delegated Chat Night spend-order PASS
  - full suite PASS
  - real Google validate intentionally reports `SKIP` when no real token is supplied
- T3-H is additive QA coverage only:
  - real purchase validation was already completed in `W7-T3-E`
  - `W7-T3-H` adds repeatable regression coverage, not a replacement for real-device billing proof

## Locked Decisions
- Android-first / Google Play Billing for paid passes.
- Backend remains authoritative for wallet state, catalog availability, purchase validation, and entitlements.
- Free daily passes stay separate from paid credits.
- Spend order is locked:
  - consume free passes first
  - consume paid credits second
- Extension is phase 2 only.
- Backend Google Play purchase validation is shipped.
- Frontend Android billing integration code is merged to `main` via `fb54123`.
- Real end-to-end Google Play billing verification is complete.
- Subscriptions are out of scope for v1.

## Remaining Tasks
- [ ] `W7-T3-G` - Out-of-passes UX
  - Scope: frontend only
  - Goal: show clear wallet state and respectful purchase prompts when free and paid balances are exhausted
  - Status: next active item after `W7-T3-H` closeout
- [ ] `W7-T3-I` - Phase 2 extension design and implementation
  - Scope: docs first, implementation later
  - Goal: define extension rules only after wallet and billing flows are stable
- [ ] `W7-T3-J` - Docs closeout and runbook
  - Scope: docs only
  - Goal: capture shipped behavior, rollout notes, compatibility constraints, and regression evidence

## Rollback / Kill Switch
- `BH_PASSES_ENABLED=true` (default)
- If false: passes UI and passes endpoints should disable gracefully.
- `BH_PASSES_PROVIDER_MODE=stub|google`
- Keep `stub` for local verification; switch to `google` only when Play credentials are configured.
