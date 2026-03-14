# Week 7 - Track 3 (Passes) - Plan

## Goal
- Build Android-first passes monetization on top of a backend-authoritative wallet and catalog foundation.

## Current State
- `W7-T3-A / W7-T3-DOCS` - DONE
- `W7-T3-B` - DONE
- Next active item: `W7-T3-C - Frontend passes shell`

## Locked Decisions
- Android-first / Google Play Billing for paid passes.
- Backend is authoritative for wallet state, catalog availability, purchase validation, and entitlements.
- Free daily Chat Night passes remain separate from paid pass credits.
- Spend order is locked:
  - consume free passes first
  - consume paid credits second
- Extension work is phase 2 only.
- Google Play purchase validation is still pending.
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
- `W7-T3-C` - Frontend passes shell
- `W7-T3-D` - Backend Google Play validation
- `W7-T3-E` - Android billing integration
- `W7-T3-F` - Chat Night pass consumption
- `W7-T3-G` - Out-of-passes UX
- `W7-T3-H` - QA passes verifier
- `W7-T3-I` - Phase 2 extension design and implementation
- `W7-T3-J` - Docs closeout and runbook

## Next Step
- `W7-T3-C` should build the first visible passes screen using:
  - `GET /api/passes/catalog`
  - `GET /api/passes/me`
- Do not add Google Play purchase validation in `W7-T3-C`.
- Do not start extension work before phase 2.
