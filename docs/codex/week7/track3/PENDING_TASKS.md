# Week 7 — Track 3 (PASSES) — PENDING TASKS

Owner: Lead + Backend + Frontend + QA  
Goal: Passes monetization (Android-compliant)  
Provider: Google Play Billing (consumables)

## Status
- Track 3: ⏳ TODO

## Dependencies
- W7-0 (Baseline): security + safe errors
- Track 1 OTP recommended before monetization rollout

## Subtasks
- [ ] T3-A (Frontend) Play Billing passes purchase flow (consumables)
- [ ] T3-B (Backend) Receipt verification + entitlement ledger:
  - idempotent grants
  - balance + transaction history
- [ ] T3-C (QA) Purchase sandbox checklist:
  - purchase → verify → passes granted
  - duplicate token not double-granted
  - refund/reversal handling plan
- [ ] T3-D (Docs) Monetization runbook:
  - SKU list, rollout steps, kill-switch/disable guidance
- [ ] T3-E Billing unavailable/outage graceful degradation state

## Rollback / Kill switch (required)
- BH_PASSES_ENABLED=true (default)
- If false: purchase UI disabled; existing passes still usable.

## Acceptance Criteria (Track 3)
- Users can buy passes via Play Billing.
- Backend verifies and updates balance reliably.
- No double-grants; strong audit trail.
- Purchase flow fails gracefully with clear messaging; app remains usable.
