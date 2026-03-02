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
- Guards added to prevent bad states (missing token/roomId) and duplicate navigation.

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
Status: TODO  
Owner: Backend Agent + QA Agent + Frontend Agent (as needed)  
Depends on: W6-A

Goal:
- Add AI-generated match reasons / icebreakers (non-sensitive, safe).
- Add frequency controls and safety validation.

Acceptance criteria:
- AI reasons/icebreakers are policy-safe (no PII, no exact location, no trauma).
- Rate limits + frequency controls prevent spam.
- QA checks added for safety + PII exclusion.

Verification:
- New QA script/checklist for safety prompts — PASS
- Existing regression scripts (Week3/4/5) — PASS


## 🟡 W6-B — AI-assisted matching quality (safe, controlled)

Status: TODO  
Owner: Backend Agent + QA Agent + Frontend Agent (as needed)  
Depends on: W6-A

Goal:
- Add AI-generated match reasons / icebreakers (non-sensitive, safe).
- Add frequency controls and safety validation.

Acceptance criteria:
- AI reasons/icebreakers are policy-safe (no PII, no exact location, no trauma).
- Rate limits + frequency controls prevent spam.
- QA checks added for safety + PII exclusion.

Verification:
- New QA script/checklist for safety prompts — PASS
- Existing regression scripts — PASS