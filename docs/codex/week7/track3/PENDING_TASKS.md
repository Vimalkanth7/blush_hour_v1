# Week 7 - Track 3 Pending Tasks

Owner: Lead + Backend + Frontend + QA  
Goal: Passes monetization (Android-compliant)  
Provider: Google Play Billing (consumables)  
Plan: `docs/codex/week7/track3/PLAN.md`

## Status
- Track 3: IN PROGRESS
- Track 3 cannot close yet because real `W7-T3-E` Google Play billing proof is still externally blocked.
- Closed out in docs:
  - `W7-T3-A / W7-T3-DOCS` - DONE
  - `W7-T3-B` - DONE
  - `W7-T3-C` - DONE
  - `W7-T3-D` - DONE
  - `W7-T3-F` - DONE
- Merged to `main`, but not fully closed in docs:
  - `W7-T3-E` - Android billing integration merged via `fb54123`; real Play verification still blocked
- Next active item:
  - `Resume W7-T3-E real Play billing verification after Google approval`
- External blocker:
  - Google Play Console identity/payments verification pending

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
- Real end-to-end Google Play billing verification is still externally blocked pending Google Play Console identity/payments verification.
- Subscriptions are out of scope for v1.

## Remaining Tasks
- [ ] `W7-T3-E` - Resume real Play billing verification
  - Scope: frontend verification / external unblock
  - Goal: complete a real Google Play test purchase end-to-end against the merged Android billing code on `main`
  - Blocker: Google Play Console identity/payments verification pending
- [ ] `W7-T3-G` - Out-of-passes UX
  - Scope: frontend only
  - Goal: show clear wallet state and respectful purchase prompts when free and paid balances are exhausted
  - Status: not started; keep pending until the real T3-E billing proof is completed
- [ ] `W7-T3-H` - QA passes verifier
  - Scope: QA only
  - Goal: verify purchase validation, wallet grants, idempotency, and consumption order
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
