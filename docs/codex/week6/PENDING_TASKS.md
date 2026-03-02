# Week 6 — Realtime + Talk Room Stabilization

## 🟢 W6-A — Realtime stabilization (highest priority)
Status: DONE  
Owner: Backend Agent + Frontend Agent  
Depends on: Week 5 complete

Goal:
- Make Talk Room / Chat Night room timing + engage-state reliable across 2 devices/browsers.
- Remove client clock drift issues and flaky UI state transitions.

### ✅ W6-A2 — Authoritative Talk Room timer (server-based)
Status: DONE  
Owner: Frontend Agent  
Tag: v1-w6a2-authoritative-timer  
Notes:
- `timeLeft` derived from backend `seconds_remaining` (poll-synced).
- Snap-back refresh on focus / visibility / app-active.

### ✅ W6-A1.1 — Engage sync + stale-room expiry normalization (backend)
Status: DONE  
Owner: Backend Agent  
Tag: v1-w6a1_1-engage-sync  
Notes:
- `/engage` idempotent and consistent across endpoints.
- Shared helpers normalize expiry + compute `engage_status`.
- Added deterministic verifier: `backend\verify_talk_room_engage_sync.ps1` — PASS.

### ✅ W6-A1.2 — Engage UI sync (frontend)
Status: DONE  
Owner: Frontend Agent  
Tag: v1-w6a1_2-engage-ui-sync  
Notes:
- UI reflects `engage_status` transitions reliably.
- Guards prevent bad states (missing token/roomId) and duplicate navigation.

### ✅ W6-A3 — NetworkError + recovery UX (frontend)
Status: DONE  
Owner: Frontend Agent  
Tag: v1-w6a3-network-recovery  
Notes:
- Polling recovery with bounded backoff and explicit states (offline / reconnecting / rate_limited).
- Recovers after backend restart without page refresh.

### ✅ W6-A4 — Realtime approach decision + hardening
Status: DONE  
Owner: Lead Agent + Backend Agent + Frontend Agent  
Tag: v1-w6a4-polling-only-decision  
Notes:
- Decision locked: polling-only for v1; websockets deferred.
- Hardening rules documented + checklist updated.

### ✅ W6-A5 — Checklist-only regression gate: “2 browsers, 1 room”
Status: DONE  
Owner: QA Agent  
Tag: v1-w6a5-checklist-gate  
Notes:
- Checklist-only PASS gate for Talk Room realtime behavior.
- Uses `manual run browser check.txt`.
- Added to `docs/QA/regression_checklist.md` as PASS required.

---

## 🟡 W6-B — AI-assisted matching quality (safe, controlled)
Status: IN PROGRESS  
Owner: Backend Agent + QA Agent + Frontend Agent (as needed)  
Depends on: W6-A

Goal:
- Add AI-generated match reasons / icebreakers (non-sensitive, safe).
- Add frequency controls and safety validation.

### ✅ W6-B1 — Icebreakers contract + deterministic fallback (backend)
Status: DONE  
Tag: v1-w6b1-icebreakers-contract  
Notes:
- Added POST `/api/chat-night/icebreakers` contract (3 reasons + 5 icebreakers).
- Strict SanitizedMatchContext, PII filtering, deterministic fallback.

### ✅ W6-B2 — Cache + OpenAI provider integration (backend)
Status: DONE  
Tag: v1-w6b2-icebreakers-cache-openai  
Notes:
- Room-level caching so repeated calls are cached=true.
- OpenAI-enabled generation with safe fallback if OpenAI fails.

### ✅ W6-B3 — Guardrails (budget + throttle controls) (backend)
Status: DONE  
Tag: v1-w6b3-icebreakers-guardrails  
Notes:
- Spend/throttle controls (per-day, per-user, per-room caps + optional min-seconds-between).
- Guardrail hit returns deterministic fallback (no crash, contract preserved).

### 🟡 W6-B4 — Icebreakers UI + shared reveal sync in Talk Room (frontend + backend)
Status: IN PROGRESS  
Owner: Frontend Agent + Backend Agent  
Goal:
- Show 5 icebreaker cards in Talk Room.
- Reveal actions must sync across both clients (shared state).

#### ✅ W6-B4.1 — Backend reveal sync
Status: DONE  
Tag: v1-w6b4-reveal-sync-backend  
Verification:
- `backend\verify_chat_night_icebreakers_reveal_sync.ps1` — PASS

#### 🟡 W6-B4.2 — Frontend cards + reveal sync wiring
Status: TODO  
Owner: Frontend Agent  
Acceptance criteria:
- Cards render (5).
- A reveals Card 2 → B shows within a poll cycle (2–4s).
- B reveals Card 4 → A shows within a poll cycle.
- No duplicate alerts/navigation.
- No repeated OpenAI spend on refresh (cache-first behavior).
Verification:
- Manual checklist PASS (manual run browser check.txt)
- Backend reveal verifier PASS

### 🟡 W6-B5 — QA: safety + cost regression gate
Status: TODO  
Owner: QA Agent  
Goal:
- Add PASS-required regression checks for icebreakers safety + spend behavior.
Acceptance criteria:
- Icebreakers contract verifier PASS (shape + cache + PII).
- Reveal sync verifier PASS.
- Existing regressions still PASS (noting some scripts require correct env flags and rate-limit spacing).
Verification:
- Add to `docs/QA/regression_checklist.md`:
  - `backend\verify_chat_night_icebreakers_contract.ps1`
  - `backend\verify_chat_night_icebreakers_reveal_sync.ps1`