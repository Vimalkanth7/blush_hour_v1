# Week 7 - Track 5.5 Completed Tasks

## Track Summary
- Track: `W7-T5.5`
- Focus: expose Track 5 safety actions in chat UI and finish 1:1 blocked-pair enforcement
- Status: `DONE`

## Completed Items

## W7-T5.5-A - Frontend safety actions UI
Status: `DONE`
Merged: `491b2ee`
Feature commit: `40d1e82`
Branch: `feat/frontend-w7-t5_5a-safety-actions-ui`
Scope: `mobile-app` only

Files changed:
- `mobile-app/app/chat/[id].tsx`
- `mobile-app/app/chat/talk-room.tsx`
- `mobile-app/components/chat/SafetyActionsMenu.tsx`
- `mobile-app/constants/Api.ts`

What shipped:
- Added `Report / Mute / Block` entry points in the Talk Room header and the 1:1 chat header.
- Added shared `SafetyActionsMenu` UI plus safety API helpers for `block`, `mute`, and `report`.
- Added neutral unavailable handling so blocked or unavailable responses fall back to non-leaking UI copy in both chat surfaces.

Key verification evidence:
- `main` includes the merged frontend safety UI via `491b2ee`.
- Current targeted lint rerun passed on 2026-03-14:
  - `npx eslint 'app/chat/[id].tsx' app/chat/talk-room.tsx components/chat/SafetyActionsMenu.tsx constants/Api.ts`
- Manual/runtime evidence recorded during `W7-T5.5-A` showed:
  - Chat Night safety menu shipped
  - 1:1 chat safety menu shipped
  - report / mute / block actions were exposed in both surfaces
  - neutral unavailable handling was shown after blocked/unavailable responses

Open risk captured at handoff:
- Blocked-side 1:1 chat was still usable before `W7-T5.5-B`.

## W7-T5.5-B - Backend 1:1 chat block enforcement
Status: `DONE`
Merged: `a479a3a` (Merge PR #48)
Feature commit: `262c548`
Branch: `fix/backend-w7-t5_5b-chat-block-enforcement`
Scope: `backend` only

Files changed:
- `backend/app/routers/chat.py`

What shipped:
- Added blocked-pair enforcement to:
  - `GET /api/chat/threads/{id}/partner`
  - `GET /api/chat/threads/{id}/messages`
  - `POST /api/chat/threads/{id}/messages`
  - `POST /api/chat/threads/{id}/read`
- Reused the existing neutral `403 This match is unavailable.` denial already used for blocked-pair handling elsewhere in Track 5.
- Closed the remaining blocked-side 1:1 loophole left open after `W7-T5.5-A`.

Key verification evidence:
- Live direct probe on 2026-03-14 against `http://localhost:8000`:
  - pre-block all 1:1 thread endpoints returned `200` for both users
  - post-block all 1:1 thread endpoints returned `403` for both users
  - blocked detail stayed neutral on every denied thread endpoint: `This match is unavailable.`
  - regression sanity: `GET /api/chat-night/room/{room_id}` returned `200` pre-block and `403` post-block for both users
  - regression sanity: `POST /api/voice/token` returned `200` pre-block and `403` post-block for both users
- Regression guard reruns on 2026-03-14:
  - `powershell -ExecutionPolicy Bypass -File .\backend\verify_profile_strength_contract.ps1`
    - `PASS: profile_strength contract verified.`
  - `powershell -ExecutionPolicy Bypass -File .\backend\verify_chat_night_icebreakers_contract.ps1`
    - `PASS: chat night icebreakers contract verified (W6-B3)`
  - `powershell -ExecutionPolicy Bypass -File .\backend\verify_talk_room_engage_sync.ps1`
    - `PASS: talk room engage sync verified.`
- Existing Track 5 verifier evidence already recorded on `main`:
  - `PASS: safety/admin contract verifier completed (enabled mode).`

Resolved risk note:
- The blocked-side 1:1 chat enforcement gap from `W7-T5.5-A` is fixed on `main`.
