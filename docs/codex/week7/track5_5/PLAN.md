# Week 7 — Track 5.5 Plan
## Frontend Safety Exposure for Real Users

### Status
- Track: **W7-T5.5**
- Type: **Frontend exposure + QA + docs**
- Depends on: **Week 7 Track 5**
- Current state: **PLANNED**

---

## Why Track 5.5 exists

Week 7 Track 5 completed the **backend safety and moderation backbone**, including:

- block / report / mute APIs
- admin moderation queue
- admin report detail / resolve flow
- banned-user moderation outcome
- blocked-pair enforcement across Chat Night / room / voice flows
- QA verifier coverage
- safety/admin runbook

That work is already complete and should be reused exactly as-is.

However, Track 5 did **not** add user-facing frontend controls.  
As a result, real users cannot yet trigger the safety system from the app UI.

Track 5.5 exists to solve that gap.

---

## Core goal

Expose the already-built Track 5 safety system to real users in the app at the exact moments where they may need it, without rebuilding backend logic.

This means Track 5.5 is **not a new safety backend track**.

It is a **frontend usability and integration track** that connects the existing safety backbone into the real user experience.

---

## Dependency chain from Track 5

Track 5.5 must explicitly reuse the following completed work from Week 7 Track 5:

### Reuse from T5-A
- `block`
- `report`
- `mute`

### Reuse from T5-B
- admin moderation queue
- moderation resolution flow
- banned-user enforcement behavior

### Reuse from T5-B2
- blocked-pair enforcement in:
  - Chat Night
  - room access
  - engage flow
  - voice token flow

### Reuse from T5-C
- safety/admin runbook
- moderation semantics and expected operator behavior

### Reuse from T5-D
- `backend/verify_safety_admin_contract.ps1`
- existing regression expectations for block/report/admin behavior

Track 5.5 should **not duplicate or replace** this backend work.

---

## Product goal

Give users direct access to safety actions inside active 1:1 interaction surfaces, especially:

1. **Chat Night room**
2. **Ongoing 1:1 / match conversation**
3. Optional profile-related entry point only if already easy to support

The main idea is simple:

- the user should be able to **Report**
- the user should be able to **Block**
- the user should be able to **Mute**

from the place where the interaction is happening.

---

## UX principles

Track 5.5 should follow Blush Hour product principles:

- low cognitive load
- emotionally safe
- no noisy UI
- no shame/blame wording
- clear state transitions
- safety actions available, but not visually overwhelming

That means:

- use a compact overflow menu or light action sheet
- avoid giant destructive buttons
- keep confirmations short
- keep error states neutral
- after a block, use neutral unavailable wording

Example neutral copy:
- "User blocked."
- "Report submitted."
- "This connection is no longer available."

---

## Recommended feature placement

### Priority 1 — Chat Night room header
This is the most important place.

Reason:
- it is live
- it is emotional
- it is time-bound
- safety needs to be available at the moment of discomfort

### Priority 2 — Ongoing 1:1 / match chat header
This is the next most important place.

Reason:
- this is where continued unwanted interaction can happen
- users expect safety controls in a private conversation surface

### Optional Priority 3 — Profile / user sheet
Only do this if the codebase already has a reusable profile sheet with minimal effort.

Not required for the first pass.

---

## Scope design

Track 5.5 should be split cleanly by workflow:

### W7-T5.5-A — Frontend-only
Expose Report / Block / Mute in the app UI.

### W7-T5.5-B — QA-only
Run two-browser manual testing and targeted safety verification for the new UI paths.

### W7-T5.5-C — Docs-only
Close out Track 5.5 and update regression / manual testing notes.

This keeps the workflow aligned with the project rules:
- one scope per packet
- no mixed frontend/backend/docs changes
- closure after evidence

---

## Planned implementation approach

### Step A — Frontend integration
Use the existing safety backend endpoints from Track 5.

Do not rebuild contracts.  
Do not add admin UI.  
Do not redesign conversation screens.

Frontend work should include:
- safety menu entry point
- action sheet / overflow menu
- report flow
- block confirmation flow
- mute flow
- neutral unavailable handling after block

### Step B — Manual testing
Run two-browser testing with:
- OTP bypass enabled
- Chat Night forced open
- safety tools enabled

Test from real user flow:
- Chat Night room
- active conversation
- report / mute / block actions
- blocked-pair behavior after block

### Step C — Docs closure
Record:
- exact files changed
- tested surfaces
- manual PASS/FAIL notes
- any backend contract mismatch
- any follow-up UI work still pending

---

## Non-goals

Track 5.5 should **not** include:

- new backend safety contracts
- admin dashboard frontend
- moderation analytics UI
- safety settings center
- appeal flow
- redesign of Chat Night or match chat
- broad navigation changes
- monetization work

This track is about **exposing existing safety actions**, not expanding the product scope.

---

## Risks / watch items

1. **Backend contract mismatch**
   - frontend must use the exact categories and payload shapes already supported in `safety.py`

2. **Blocked-state handling**
   - frontend must gracefully handle `403` responses after block without broken screens or loops

3. **UI placement drift**
   - avoid inventing new pages if existing conversation headers can support action menus

4. **Over-design**
   - keep first pass small and safe; do not expand into a full moderation system in the client

5. **Regression risk**
   - ensure room timer, engage flow, room navigation, and chat navigation still work

---

## Success criteria for Track 5.5

Track 5.5 is successful if:

- users can access Report / Block / Mute from active conversation surfaces
- existing Track 5 backend is reused without backend reimplementation
- blocked/unavailable behavior is reflected cleanly in the UI
- two-browser manual testing passes
- docs are updated cleanly through the normal workflow loop

---

## Completion target

When Track 5.5 is complete, users should finally be able to **feel** the Week 7 safety system in the app experience, not just in backend tests and admin tools.