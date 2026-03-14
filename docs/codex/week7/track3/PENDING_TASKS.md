# Week 7 — Track 3 (PASSES) — PENDING TASKS

Owner: Lead + Backend + Frontend + QA  
Goal: Passes monetization (Android-compliant)  
Provider: Google Play Billing (consumables)
Plan: `docs/codex/week7/track3/PLAN.md`

## Status
- Track 3: ⏳ IN PROGRESS
- Closed out in docs:
  - W7-T3-A / W7-T3-DOCS — ✅ DONE
  - W7-T3-B — ✅ DONE
- Next active item:
  - W7-T3-C — Frontend passes shell

## Dependencies
- W7-0 (Baseline): security + safe errors
- Track 1 OTP recommended before monetization rollout

## Locked Decisions
- Android-first / Google Play Billing for paid passes.
- Backend is authoritative for wallet state, catalog availability, and entitlements.
- Free daily Chat Night passes remain separate from paid pass credits.
- Spend order is locked:
  - consume free passes first
  - consume paid credits second
- Extension work is phase 2 only.
- Google Play purchase validation is not yet implemented.
- Subscriptions are out of scope for v1.

## Backend Foundation Confirmed (W7-T3-B)
- Config flags:
  - `BH_PASSES_ENABLED`
  - `BH_PASSES_PROVIDER_MODE` (`stub|google`)
- Endpoints:
  - `GET /api/passes/catalog`
  - `GET /api/passes/me`
- Wallet foundation:
  - backend-owned paid wallet model
  - minimal ledger-ready credit entry
  - free daily `ChatNightPass` kept separate from paid credits
- Verifier evidence:
  - `PARSE_OK`
  - `PASS: passes contract verified (enabled mode).`
  - `PASS: passes contract verified (disabled mode).`

## Subtasks
- [x] W7-T3-A / W7-T3-DOCS — Track 3 planning/docs init
- [x] W7-T3-B — Backend wallet/catalog foundation
- [ ] W7-T3-C — Frontend passes shell
- [ ] W7-T3-D
- [ ] W7-T3-E
- [ ] W7-T3-F
- [ ] W7-T3-G
- [ ] W7-T3-H
- [ ] W7-T3-I
- [ ] W7-T3-J

## Rollback / Kill switch (required)
- `BH_PASSES_ENABLED=true` (default)
- If false: passes UI/endpoints should disable gracefully.
- `BH_PASSES_PROVIDER_MODE=stub` until Google Play validation is implemented.

## Acceptance Criteria (Track 3)
- Users can buy passes via Google Play Billing.
- Backend verifies purchases and updates balance reliably.
- Free daily passes and paid credits remain separate with ledger-ready audit support.
- Purchase flow fails gracefully with clear messaging; app remains usable.
