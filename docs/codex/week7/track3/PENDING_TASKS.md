# Week 7 - Track 3 Pending Tasks

Owner: Lead + Backend + Frontend + QA  
Goal: Passes monetization (Android-compliant)  
Provider: Google Play Billing (consumables)  
Plan: `docs/codex/week7/track3/PLAN.md`

## Status
- Track 3: IN PROGRESS
- Closed out in docs:
  - `W7-T3-A / W7-T3-DOCS` - DONE
  - `W7-T3-B` - DONE
- Next active item:
  - `W7-T3-C - Frontend passes shell`

## Locked Decisions
- Android-first / Google Play Billing for paid passes.
- Backend remains authoritative for wallet state, catalog availability, purchase validation, and entitlements.
- Free daily passes stay separate from paid credits.
- Spend order is locked:
  - consume free passes first
  - consume paid credits second
- Extension is phase 2 only.
- Google Play purchase validation is still pending.
- Subscriptions are out of scope for v1.

## Remaining Tasks
- [ ] `W7-T3-C` - Frontend passes shell
  - Scope: frontend only
  - Goal: expose a passes screen and wallet state using `GET /api/passes/catalog` and `GET /api/passes/me`
- [ ] `W7-T3-D` - Backend Google Play purchase validation
  - Scope: backend only
  - Goal: verify Google Play purchase tokens server-side, enforce idempotency, and grant paid credits safely
- [ ] `W7-T3-E` - Android billing integration
  - Scope: frontend only
  - Goal: launch Google Play Billing purchase flows and hand validated purchase data to the backend
- [ ] `W7-T3-F` - Chat Night pass consumption
  - Scope: backend only
  - Goal: enforce free passes first and paid credits second through backend wallet rules
- [ ] `W7-T3-G` - Out-of-passes UX
  - Scope: frontend only
  - Goal: show clear wallet state and respectful purchase prompts when free and paid balances are exhausted
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
- `BH_PASSES_PROVIDER_MODE=stub` until Google Play validation is implemented.
