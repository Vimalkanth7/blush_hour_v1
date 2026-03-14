# Week 7 - Track 3 Completed Tasks

## W7-T3-A / W7-T3-DOCS - Track 3 planning and docs init
Status: DONE  
Date: 2026-03-14  
Scope: docs only

What shipped:
- Initialized the Track 3 docs folder:
  - `docs/codex/week7/track3/PLAN.md`
  - `docs/codex/week7/track3/PENDING_TASKS.md`
  - `docs/codex/week7/track3/COMPLETED_TASKS.md`
  - `docs/codex/week7/track3/SESSION_LOG.md`
- Locked planning decisions for passes v1:
  - Android-first / Google Play Billing
  - backend-authoritative wallet model
  - free daily passes remain separate from paid credits
  - consume free passes first
  - consume paid credits second
  - extension deferred to phase 2
  - no subscriptions in v1
- Recorded that no backend, frontend, or QA work shipped in the docs-init packet.

How verified:
- Track 3 docs record `W7-T3-A / W7-T3-DOCS = DONE`.
- `docs/codex/week7/track3/PLAN.md` exists and carries the locked planning decisions.
- The docs state that `W7-T3-C` is the next active implementation item after backend foundation closeout.

Notes / follow-ups:
- Google Play purchase validation remained pending after docs init.
- `W7-T3-B` was tracked and closed separately as the backend foundation packet.

## W7-T3-B - Backend wallet/catalog foundation
Status: DONE  
Date: 2026-03-14  
Branch: `feat/backend-w7-t3b-wallet-catalog-foundation`  
Scope: backend only

What shipped:
- Added passes config flags:
  - `BH_PASSES_ENABLED`
  - validated `BH_PASSES_PROVIDER_MODE` (`stub|google`)
- Added a backend-owned paid wallet model and kept free daily `ChatNightPass` separate from paid credits.
- Added ledger-ready `PassCreditLedgerEntry` support for paid credit tracking.
- Added a static Android catalog:
  - `pass_pack_1`
  - `pass_pack_5`
  - `pass_pack_15`
- Added endpoints:
  - `GET /api/passes/catalog`
  - `GET /api/passes/me`
- Integrated passes models and router into startup/bootstrap.
- Added `backend/verify_passes_contract.ps1`.

How verified:
- `Invoke-RestMethod http://localhost:8000/health` -> `{"status":"healthy","database":"connected"}`
- `PARSE_OK`
- `PASS: passes contract verified (enabled mode).`
- `PASS: passes contract verified (disabled mode).`
- `PASS: profile_strength contract verified.`
- `PASS: chat night icebreakers contract verified (W6-B3)`
- `PASS: talk room engage sync verified.`
- `PASS: safety/admin contract verifier completed (enabled mode).`
- Verified response summaries:
  - `catalog`: `passes_enabled=true`, `provider_mode=stub`, `platform=android`, `product_count=3`, `product_ids=[pass_pack_1, pass_pack_5, pass_pack_15]`, `grant_types=[paid_pass_credits]`
  - `wallet`: `passes_enabled=true`, `provider_mode=stub`, `catalog_available=true`, `wallet.user_id_present=true`, `wallet.paid_pass_credits=0`

Notes / follow-ups:
- Google Play purchase validation is intentionally deferred and not yet implemented.
- Spend-order enforcement is intentionally deferred; the locked rule remains free passes first and paid credits second.
- `W7-T3-C - Frontend passes shell` is the next implementation packet.
- Admin JWT/env mismatch is a separate repo/runtime note, not a `W7-T3-B` blocker.

## W7-T3-C - Frontend passes shell
Status: DONE  
Date: 2026-03-15  
Branch: `feat/frontend-w7-t3c-passes-shell`  
Scope: frontend only

What shipped:
- Added the first visible Passes screen and frontend passes API helpers:
  - `mobile-app/app/passes.tsx`
  - `mobile-app/constants/Api.ts`
- Added one profile entry point into the new Passes screen:
  - `mobile-app/app/(tabs)/profile.tsx`
- Shipped the frontend shell against the completed backend foundation endpoints:
  - `GET /api/passes/catalog`
  - `GET /api/passes/me`
- Rendered the paid wallet balance clearly and kept free daily passes explicitly separate from paid credits.
- Rendered the 3 active backend products and kept purchase actions as placeholder-only disabled CTAs.
- Added clean loading, disabled, empty, missing-wallet, and network error handling without adding any fake purchase success flow.

How verified:
- Frontend runtime:
  - `cd mobile-app`
  - `npm install`
  - `npm run web -- --port 8082 --non-interactive`
- Backend runtime used for frontend verification:
  - `BH_PASSES_ENABLED=true`
  - `BH_PASSES_PROVIDER_MODE=stub`
- Verified behavior:
  - wallet rendered
  - 3 products rendered
  - disabled state works when passes are off
  - placeholder CTA only (`Coming soon`)
  - profile entry-point navigation works
- Verified runtime summary:
  - `health`: `{"status":"healthy","database":"connected"}`
  - authenticated passes check: `product_count=3`, `provider_mode=stub`, `platform=android`, `paid_pass_credits=0`, `wallet_present=true`

Notes / follow-ups:
- Repo-wide `npm run lint` and `npx tsc --noEmit` remain noisy due to unrelated pre-existing issues outside `W7-T3-C`.
- Google Play purchase validation remains unimplemented and is the next active backend packet.
- Android billing launch flow, paid-credit spend enforcement, out-of-passes UX, and extension work remain later Track 3 items.
