# Week 7 - Track 3 (Passes) - Plan

## Goal
- Build Android-first passes monetization on top of a backend-authoritative wallet and catalog foundation.

## Current State
- `W7-T3-A / W7-T3-DOCS` - DONE
- `W7-T3-B` - DONE
- `W7-T3-C` - DONE
- `W7-T3-D` - DONE
- `W7-T3-E` - DONE
- `W7-T3-F` - DONE
- `W7-T3-H` - DONE
- `W7-T3-E` frontend Android billing integration is merged to `main` via `fb54123`, with final validation unblocked by hotfix `7c6499d`.
- Next active item: `W7-T3-G - Out-of-passes UX`
- Real Google Play end-to-end billing verification is complete:
  - Play internal testing app installed from Play Store
  - real prices visible
  - purchase flow opened successfully
  - purchase completed successfully
  - backend `POST /api/passes/google/validate` returned `200 OK`
  - wallet refreshed `0 -> 1`
  - app showed `Purchase validated. Wallet refreshed.`
  - Render logs showed `POST /api/passes/google/validate HTTP/1.1" 200 OK`
- Repeatable monetization QA coverage is complete:
  - disabled-mode PASS
  - stub-mode PASS
  - google-mode smoke PASS
  - delegated Chat Night spend-order PASS
  - full suite PASS
  - real Google validate intentionally reports `SKIP` when no real token is supplied
- Real purchase validation remains the already-completed `W7-T3-E` proof; `W7-T3-H` adds repeatable regression coverage.

## Locked Decisions
- Android-first / Google Play Billing for paid passes.
- Backend is authoritative for wallet state, catalog availability, purchase validation, and entitlements.
- Free daily Chat Night passes remain separate from paid pass credits.
- Spend order is locked:
  - consume free passes first
  - consume paid credits second
- Extension work is phase 2 only.
- Backend Google Play purchase validation is shipped.
- Frontend Android billing integration code is merged to `main`.
- Real Google Play end-to-end billing verification is complete.
- Subscriptions are out of scope for v1.

## Confirmed Backend Foundation
- Config flags:
  - `BH_PASSES_ENABLED`
  - `BH_PASSES_PROVIDER_MODE` (`stub|google`)
- Endpoints:
  - `GET /api/passes/catalog`
  - `GET /api/passes/me`
- Wallet model support:
  - backend-owned paid wallet model
  - ledger-ready `PassCreditLedgerEntry`
  - free daily `ChatNightPass` kept separate from paid credits
- Verified response summary:
  - `catalog`: `passes_enabled=true`, `provider_mode=stub`, `platform=android`, `product_count=3`
  - `wallet`: `passes_enabled=true`, `provider_mode=stub`, `catalog_available=true`, `wallet.paid_pass_credits=0`

## Delivery Order
- `W7-T3-A / W7-T3-DOCS` - DONE
- `W7-T3-B` - DONE
- `W7-T3-C` - DONE
- `W7-T3-D` - DONE
- `W7-T3-E` - DONE (`fb54123` frontend merge; `7c6499d` validation hotfix)
- `W7-T3-F` - DONE
- `W7-T3-H` - DONE (`test/qa-w7-t3h-passes-verifier`; `2c71404`)
- `W7-T3-G` - Out-of-passes UX (not started; pending final Track 3 closure sequencing)
- `W7-T3-I` - Phase 2 extension design and implementation
- `W7-T3-J` - Docs closeout and runbook

## Next Step
- Run `W7-T3-G - Out-of-passes UX` next.
- Keep `W7-T3-J` as the pending final docs/runbook step after the remaining implementation work.
- Keep `W7-T3-I` as Phase 2 only.
