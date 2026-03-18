# Week 7 - Track 3 (Passes) - Plan

## Goal
- Build Android-first passes monetization on top of a backend-authoritative wallet and catalog foundation.

## Current State
- `W7-T3-A / W7-T3-DOCS` - DONE
- `W7-T3-B` - DONE
- `W7-T3-C` - DONE
- `W7-T3-D` - DONE
- `W7-T3-F` - DONE
- `W7-T3-E` frontend Android billing code is merged to `main` via `fb54123`, but real Play billing verification is still externally blocked.
- Next active item: `Resume W7-T3-E real Play billing verification after Google approval`
- External blocker: `Google Play Console identity/payments verification pending`

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
- Real Google Play end-to-end billing verification is still externally blocked pending Google Play Console identity/payments verification.
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
- `W7-T3-E` - merged to `main` via `fb54123`; real Play billing verification blocked externally
- `W7-T3-F` - DONE
- `W7-T3-G` - Out-of-passes UX (not started; pending final Track 3 closure sequencing)
- `W7-T3-H` - QA passes verifier
- `W7-T3-I` - Phase 2 extension design and implementation
- `W7-T3-J` - Docs closeout and runbook

## Next Step
- Resume `W7-T3-E` real Play billing verification after Google approval.
- Use the already-merged Android billing flow on `main` and capture real end-to-end Google Play test purchase proof.
- Do not mark Track 3 fully done until the Google Play Console identity/payments verification blocker is cleared.
- Leave `W7-T3-G` not started until the real billing proof and final Track 3 sequencing are settled.
