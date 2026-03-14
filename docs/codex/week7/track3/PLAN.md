# Week 7 - Track 3 Plan

## Track Summary
- Track: `W7-T3`
- Focus: passes monetization for Blush Hour
- Status: `PLANNED`
- Payment path: `Google Play Billing`
- Release priority: `Android first`
- Current task: `W7-T3-DOCS`
- Code status: no backend, frontend, or QA implementation work has started in this task

## Track Purpose
Track 3 defines the monetization plan for Blush Hour using passes and Google Play Billing. The goal is to ship a controlled, Android-first v1 that introduces consumable pass packs without weakening safety, moderation, or product clarity.

## Confirmed Product Corrections
- Consume free passes first.
- Consume paid credits second.
- Keep free daily passes separate from paid credits.
- Treat Chat Night extension as phase 2 only, after wallet and billing stability are proven.
- Do not start with subscriptions.
- Do not let paid mechanics override safety, moderation, or user consent.

## Monetization Model
Track 3 v1 is planned as:
- One-time consumable pass packs.
- Android-first rollout.
- Google Play Billing as the payment path.
- Backend-authoritative entitlement grant and wallet state.
- No subscription in the first release.

This means the first release sells consumable passes only. Any later subscription idea is explicitly out of scope for this track unless product strategy changes in a separate planning pass.

## Implementation Architecture
Planning assumptions for the implementation packets:
- Frontend launches the Google Play Billing purchase flow for consumable pass packs.
- Frontend sends the purchase token and product context to the backend after a purchase event.
- Backend verifies the purchase token and purchase state with Google Play before granting anything.
- Backend grants credits to the specific authenticated user only after successful validation.
- Backend owns the wallet and ledger model for paid credits, purchase records, and entitlement history.
- Wallet and ledger data must support idempotent purchase handling so the same purchase token cannot double-grant credits.
- Chat Night pass consumption uses free passes first and paid credits second once consumption work is implemented.
- Extension is reserved for a later phase and is not part of the initial billing foundation.

## Product Behavior
- Free daily passes remain separate from paid credits.
- Paid credits do not reset daily.
- Users should always see a clear wallet or balance state so they know how many free passes and paid credits remain.
- Paid credits only apply when free passes are exhausted.
- If extension is implemented later, it must require mutual consent and must not consume credits in a way that surprises either user.
- Backend wallet state remains the source of truth for all paid-credit balances.

## Safety and Emotional Design Rules
- Payment never bypasses safety controls.
- Paid mechanics cannot override moderation decisions.
- Blocked users stay blocked.
- Banned or suspended users stay banned or suspended.
- Extension cannot force extra time on another user.
- Monetization prompts must stay calm, explicit, and non-manipulative.
- Wallet or purchase UI should inform, not pressure.

Track 3 must remain compatible with the safety and moderation work already closed in Week 7 Track 5 and Track 5.5.

## Task Breakdown

### W7-T3-DOCS - Docs init and planning
- Scope: docs only
- Goal: open Track 3 planning, record confirmed product corrections, and define the staged rollout order

### W7-T3-B - Backend wallet and catalog foundation
- Scope: backend only
- Goal: define pass catalog metadata, wallet balances, ledger entries, and entitlement structures

### W7-T3-C - Frontend passes screen shell
- Scope: frontend only
- Goal: expose a passes screen and wallet state without billing integration yet

### W7-T3-D - Backend Google Play validation
- Scope: backend only
- Goal: verify purchase tokens, enforce idempotency, and grant credits safely

### W7-T3-E - Android billing client integration
- Scope: frontend only
- Goal: integrate Google Play Billing purchase flows and backend handoff

### W7-T3-F - Pass consumption in Chat Night entry
- Scope: backend only
- Goal: consume free passes first, then paid credits, through backend-authoritative wallet deduction rules

### W7-T3-G - Out-of-passes UX
- Scope: frontend only
- Goal: show clear wallet state and respectful purchase prompts when free and paid balances are exhausted

### W7-T3-H - QA verifier for passes
- Scope: QA only
- Goal: verify purchase validation, wallet grants, idempotency, and consumption order

### W7-T3-I - Phase 2 extension planning and implementation
- Scope: docs only for the planning packet
- Goal: define extension rules, dependencies, and mutual-consent requirements once wallet stability is established

### W7-T3-J - Docs closeout and runbook
- Scope: docs only
- Goal: capture shipped architecture, rollout notes, regression evidence, and operator guidance

Sequencing rule:
- Docs first.
- Backend wallet and validation foundation before frontend billing completion.
- Extension deferred until after wallet stability.

## Non-Goals
- No code in this task.
- No billing implementation yet.
- No Play Console secrets in docs or code.
- No subscription launch.
- No extension launch in phase 1.
- No claim that wallet or billing behavior is already shipped.

## Current State
- Track 3 planning is now being initialized after Week 7 Track 5.5 closure.
- This packet only documents the intended direction.
- Backend, frontend, and QA work remain future packets.
