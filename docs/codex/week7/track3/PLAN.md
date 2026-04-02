# Week 7 - Track 3 (Passes) - Plan

## Goal
- Ship Android-first passes monetization on top of a backend-authoritative wallet and catalog foundation.

## Current State
- Week 7 Track 3 current scope is COMPLETE as of `2026-04-02`.
- `W7-T3-A / W7-T3-DOCS` - DONE
- `W7-T3-B` - DONE
- `W7-T3-C` - DONE
- `W7-T3-D` - DONE
- `W7-T3-E` - DONE
- `W7-T3-F` - DONE
- `W7-T3-G` - DONE
- `W7-T3-H` - DONE
- `W7-T3-J` - DONE
- No active current-scope Track 3 item remains.
- `W7-T3-I` remains deferred to Phase 2 and is not part of this closure.
- Final shipped Track 3 scope:
  - `W7-T3-B` wallet/catalog foundation
  - `W7-T3-C` frontend passes UI shell
  - `W7-T3-D` backend Google validation / stub verification
  - `W7-T3-E` real Play billing integration + real purchase validation proof
  - `W7-T3-F` Chat Night pass consumption with free-first / paid-second
  - `W7-T3-G` out-of-passes UX + paid-fallback hotfix
  - `W7-T3-H` QA runtime verifier coverage
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
- Chat Night spend rule is locked:
  - consume free passes first
  - consume paid credits second
- Final `W7-T3-G` UX verification recorded:
  - `Paid fallback PASS`
  - `Enter Pool available PASS`
  - `Stale-state refresh PASS`
  - `Fully exhausted state PASS`
  - `Open Passes CTA PASS`

## Locked Decisions
- Android-first / Google Play Billing for paid passes.
- Google Play consumables only.
- Backend is authoritative for wallet state, catalog availability, purchase validation, and entitlements.
- Free daily Chat Night passes remain separate from paid pass credits.
- Spend order is locked:
  - consume free passes first
  - consume paid credits second
- Extension work is Phase 2 only.
- Backend Google Play purchase validation is shipped.
- Frontend Android billing integration code is merged to `main`.
- Real Google Play end-to-end billing verification is complete.
- Subscriptions are out of scope for v1.

## Final Merged Refs On `main`
- `fb54123` - `W7-T3-E` frontend billing merge
- `225569a` - `W7-T3-E` purchase validation hotfix merge
- `973d402` - `W7-T3-F` Chat Night pass consumption merge
- `05576b5` - `W7-T3-H` QA verifier merge
- `2fd3e2b` - `W7-T3-G` out-of-passes UX merge
- `fb29faa` - `W7-T3-G` paid-fallback hotfix merge
- `37678c2` - `W7-T3-E` docs closeout merge
- `6ad1afe` - `W7-T3-F` docs closeout merge
- `d27dcac` - `W7-T3-H` docs closeout merge
- `cbb1cc4` - `W7-T3-G` docs closeout commit
- `ac2a5a4` - merge of `cbb1cc4` to `main`

## Operational Runbook
- Provider modes:
  - `BH_PASSES_PROVIDER_MODE=stub` for local verification and contract testing
  - `BH_PASSES_PROVIDER_MODE=google` for real Android billing against configured Play credentials
- Kill switch:
  - `BH_PASSES_ENABLED=true|false`
  - when `false`, the passes UI and passes endpoints must disable gracefully
- Core backend-owned endpoints:
  - `GET /api/passes/catalog`
  - `GET /api/passes/me`
  - `POST /api/passes/google/validate`
- Regression / verifier references:
  - `backend/verify_passes_contract.ps1`
  - `backend/verify_passes_runtime_suite.ps1`
  - `backend/verify_chat_night_pass_consumption_contract.ps1`

## Delivery Order
- `W7-T3-A / W7-T3-DOCS` - DONE
- `W7-T3-B` - DONE
- `W7-T3-C` - DONE
- `W7-T3-D` - DONE
- `W7-T3-E` - DONE (`fb54123` frontend merge; `225569a` validation hotfix merge; `37678c2` docs closeout merge)
- `W7-T3-F` - DONE
- `W7-T3-G` - DONE (`2fd3e2b`, `fb29faa`, `cbb1cc4`, merged to `main` via `ac2a5a4`)
- `W7-T3-H` - DONE (`05576b5`; docs closeout `d27dcac`)
- `W7-T3-I` - Phase 2 extension design and implementation
- `W7-T3-J` - DONE

## Release / Testing Notes
- Android-first release path is locked for v1; iOS and subscription work remain out of scope.
- Paid passes are Google Play consumables only in the shipped Track 3 scope.
- Backend remains the source of truth for wallet balances, validation state, and spend entitlements.
- Real device / Play internal testing proof is the shipped evidence for `W7-T3-E`; `W7-T3-H` does not replace it.
- `W7-T3-J` changes docs only. No backend code, frontend code, or QA scripts changed in this final closeout packet.

## Next Step
- No active Week 7 Track 3 current-scope work remains.
- `W7-T3-I` is the only remaining monetization item and stays deferred to Phase 2.
