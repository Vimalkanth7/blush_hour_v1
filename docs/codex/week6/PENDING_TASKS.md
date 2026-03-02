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
Owner: Backend Agent + QA Agent  
Tag: v1-w6b1-icebreakers-contract  
Notes:
- Added POST `/api/chat-night/icebreakers` (participant-only).
- Uses SanitizedMatchContext (no names/photos/bio/location/IDs).
- Deterministic generator returns exactly: **3 reasons + 5 icebreakers**.
- New verifier: `backend\verify_chat_night_icebreakers_contract.ps1` — PASS.

### 🟡 W6-B2 — OpenAI integration + spend guardrails
Status: TODO  
Owner: Backend Agent  
Goal:
- Call OpenAI (JSON-only) to generate reasons + icebreakers from SanitizedMatchContext.
- Enforce strict budget controls (daily cap, per-room cap, request timeout).
Acceptance criteria:
- Never exceeds configured spend caps.
- Fallback to deterministic generator on any failure.

### 🟡 W6-B3 — Safety filter + caching
Status: TODO  
Owner: Backend Agent + QA Agent  
Goal:
- Post-filter AI output (PII + sensitive content) and return safe fallback if violated.
- Cache per-room result (avoid repeat charges; rate/frequency controls).
Acceptance criteria:
- Output never contains PII (phone/email/handles/locations) or disallowed topics.
- Cached results reused; no spammy repeated calls.

### 🟡 W6-B4 — QA safety gate (scripts/checklist)
Status: TODO  
Owner: QA Agent  
Goal:
- Add QA script(s) to validate:
  - output shape (3 reasons, 5 icebreakers)
  - PII exclusion
  - caching behavior
  - spend guardrails behavior (dry-run / forced fallback)
Acceptance criteria:
- New QA checks PASS; existing regression scripts PASS.