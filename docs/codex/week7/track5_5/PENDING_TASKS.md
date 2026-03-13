# Week 7 — Track 5.5 Pending Tasks

## Track Summary
- Track: **W7-T5.5**
- Focus: **Frontend exposure of existing Track 5 safety system**
- Depends on:
  - **W7-T5-A** backend safety tools
  - **W7-T5-B** admin moderation queue
  - **W7-T5-B2** blocked-pair enforcement
  - **W7-T5-C** safety/admin runbook
  - **W7-T5-D** safety/admin verifier
- Status: **PLANNED**

---

## Pending Tasks

### W7-T5.5-A — Frontend safety actions UI
**Scope:** Frontend-only  
**Branch:** `feat/frontend-w7-t5_5a-safety-actions-ui`  
**Goal:** Add user-visible Report / Block / Mute actions to real interaction surfaces using existing Track 5 backend endpoints.

**Acceptance target:**
- Add safety actions in Chat Night room header
- Add safety actions in ongoing 1:1 / match chat header
- Reuse existing Track 5 backend contracts
- Keep UI low-noise and neutral
- Handle blocked/unavailable backend responses gracefully

**Dependencies:**
- Existing safety endpoints from Track 5
- Existing blocked-pair enforcement from Track 5 B2

**Status:** PENDING

---

### W7-T5.5-B — QA manual safety flow verification
**Scope:** QA-only  
**Branch:** `feat/qa-w7-t5_5b-safety-ui-verification`  
**Goal:** Verify the new frontend safety actions through manual and targeted flow testing.

**Acceptance target:**
- Two-browser test for Chat Night safety actions
- Two-browser test for ongoing 1:1 / match chat safety actions
- Confirm report / mute / block action submission
- Confirm blocked/unavailable UI behavior after block
- Confirm no regression in room entry / engage / navigation

**Dependencies:**
- W7-T5.5-A complete
- `backend/verify_safety_admin_contract.ps1` remains passing

**Status:** PENDING

---

### W7-T5.5-C — Docs closeout
**Scope:** Docs-only  
**Branch:** `chore/docs-week7-track5_5-closeout`  
**Goal:** Close out Track 5.5 with file updates, session log, and any regression checklist/manual testing note updates.

**Acceptance target:**
- Move completed tasks into completed tracker
- Add session log entry
- Record manual testing evidence
- Update regression/manual testing notes if needed

**Dependencies:**
- W7-T5.5-A complete
- W7-T5.5-B complete

**Status:** PENDING