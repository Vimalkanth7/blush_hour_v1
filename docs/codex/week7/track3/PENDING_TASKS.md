# Week 7 - Track 3 Pending Tasks

## Track Summary
- Track: `W7-T3`
- Focus: passes monetization planning and staged Google Play Billing rollout
- Status: `PLANNED`
- Current active item: `W7-T3-DOCS`
- Current scope: docs planning and initialization only
- Next implementation starts after docs initialization is complete

## Confirmed Product Rules
- Free passes are consumed first.
- Paid credits are consumed second.
- Free daily passes stay separate from paid credits.
- Paid credits do not reset daily.
- Phase 2 extension work depends on wallet and billing stability.
- Track 3 phase 1 does not include subscriptions.
- Backend remains the source of truth for paid credits and purchase grants.

## Tasks

### [ ] W7-T3-DOCS - Track 3 planning docs init
Scope: docs only
Branch: `chore/docs-week7-track3-init`
Goal: open Track 3 planning after Week 7 Track 5.5 closure and record the confirmed monetization corrections
Status: `IN PROGRESS`

### [ ] W7-T3-B - Backend wallet and catalog foundation
Scope: backend only
Goal: define pass catalog, wallet balance model, ledger records, and backend-authoritative entitlement structure for consumable passes
Status: `PLANNED`

### [ ] W7-T3-C - Frontend passes screen shell
Scope: frontend only
Goal: add a passes entry point and wallet view that clearly separates free daily passes from paid credits
Status: `PLANNED`

### [ ] W7-T3-D - Backend Google Play purchase validation
Scope: backend only
Goal: verify Google Play purchase tokens server-side, enforce idempotency, and grant credits to the correct user wallet
Status: `PLANNED`

### [ ] W7-T3-E - Android billing integration
Scope: frontend only
Goal: launch Google Play Billing purchase flows for consumable pass packs and hand purchase tokens to the backend for validation
Status: `PLANNED`

### [ ] W7-T3-F - Chat Night pass consumption
Scope: backend only
Goal: enforce Chat Night entry consumption with free passes first and paid credits second through backend wallet rules
Status: `PLANNED`

### [ ] W7-T3-G - Out-of-passes UX
Scope: frontend only
Goal: handle zero-balance states with clear, non-coercive prompts and wallet visibility without noisy monetization
Status: `PLANNED`

### [ ] W7-T3-H - QA passes verifier
Scope: QA only
Goal: verify purchase, validation, entitlement grant, idempotency, wallet display, and pass-consumption behavior
Status: `PLANNED`

### [ ] W7-T3-I - Phase 2 extension design and implementation
Scope: docs only
Goal: define the phase 2 extension plan and acceptance rules only after wallet and billing flows are stable
Status: `BLOCKED ON WALLET STABILITY`

### [ ] W7-T3-J - Track 3 closeout docs
Scope: docs only
Goal: capture shipped behavior, runbook notes, compatibility constraints, and regression evidence for the monetization rollout
Status: `PLANNED`

## Notes
- `W7-T3-DOCS` is the only active scoped task in this packet.
- Wallet and purchase validation foundation must land before billing UI is treated as complete.
- Extension work remains phase 2 and must not start until the wallet model, purchase validation, and pass-consumption path are stable.
