# Week 7 - Track 3 Completed Tasks

## W7-T3-D - Backend Google Play purchase validation
Status: DONE  
Date: 2026-03-15  
Branch: `feat/backend-w7-t3d-google-play-validation`  
Scope: backend only

What shipped:
- Added secure backend Google Play validation support for one-time pass products.
- Shipped backend files:
  - `backend/app/core/config.py`
  - `backend/app/main.py`
  - `backend/app/models/passes.py`
  - `backend/app/schemas/passes.py`
  - `backend/app/services/passes.py`
  - `backend/app/services/google_play.py`
  - `backend/app/routers/passes.py`
  - `backend/verify_passes_contract.ps1`
- Added authenticated `POST /api/passes/google/validate`.
- Added purchase-state persistence and idempotent grant handling keyed by `purchase_token`.
- Granted paid pass credits into the wallet without touching free daily passes.
- Wrote ledger-backed purchase grant records for paid credits.
- Preserved Track 3 rules:
  - free daily passes remain separate from paid credits
  - spend order remains locked as free passes first, paid credits second
  - Chat Night consumption is not implemented in this packet
  - extension credits are not implemented in this packet
- Preserved safe local verification via `BH_PASSES_PROVIDER_MODE=stub`.

How verified:
- `PARSE_OK`
- `PASS: passes contract verified (enabled mode).`
- `PASS: passes contract verified (disabled mode).`
- Stub grant evidence:
  - wallet before `0`, after `5`
  - duplicate retry returned `already_granted=true`, wallet stayed `5`
- Disabled mode evidence:
  - passes endpoints and validation endpoint returned controlled `503`
- Google-mode safety evidence:
  - validation returned controlled `503` when `GOOGLE_PLAY_PACKAGE_NAME` was missing
- Regression guards:
  - `PASS: profile_strength contract verified.`
  - `PASS: chat night icebreakers contract verified (W6-B3)`
  - `PASS: talk room engage sync verified.`
  - `PASS: safety/admin contract verifier completed (enabled mode).`

Notes / follow-ups:
- Real end-to-end Google test purchase validation is still pending and must be exercised with valid Play credentials plus a real test purchase token.
- `W7-T3-E - Android billing integration` is now the next active item.
- RTDN, refund/revocation handling, and Chat Night pass consumption remain later Track 3 work.

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
