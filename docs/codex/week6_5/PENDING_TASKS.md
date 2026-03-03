# Week 6.5 — Pending Tasks (AI Icebreakers v2 internals)

## Status
- W6.5-A ✅ DONE (spec)
- W6.5-B 🟡 IN PROGRESS (backend LangChain/LangGraph/LangSmith internals)
- W6.5-C ⏳ TODO (frontend refinements if needed)
- W6.5-D ⏳ TODO (QA gate + spend monitoring)

---

## ✅ W6.5-A — Docs/spec (single source of truth)
# Week 6.5 — LangChain/LangGraph/LangSmith Upgrade (Icebreakers Internals)

Status: IN PROGRESS  
Owner: Lead Agent + Backend Agent + QA Agent  
Depends on: Week 6 complete  
Budget: $4.64 credit (must be spend-safe)

## ✅ W6.5-A — Docs/spec: single source of truth
Status: DONE  
Deliverable:
- docs/codex/week6_5/W6_5_AI_ICEBREAKERS_SPEC.md

---

## 🟡 W6.5-B — Backend internals upgrade (LangChain + LangGraph + LangSmith)
Status: IN PROGRESS  
Owner: Backend Agent + QA Agent  
Goal:
- Keep the existing icebreakers API contract stable while upgrading internals to LangChain + LangGraph and enabling optional LangSmith traces.

Subtasks:
- [x] B1 Add LangChain/LangGraph/LangSmith dependencies
- [x] B2 Replace low-level OpenAI call with LangChain structured output
- [x] B3 Add minimal LangGraph flow (build→cache→call→validate→persist→return)
- [x] B4 Add optional LangSmith tracing (env-driven; hashed metadata only)
- [ ] B5 Manual verification (Mode 2 OpenAI key path) PASS

Acceptance criteria:
- No contract change for /api/chat-night/icebreakers
- Cache-first behavior preserved (2nd call cached=true)
- Safety filters preserved (PII/banned topics/format)
- OpenAI mode produces model=<configured> when enabled; otherwise deterministic mode

---

## ⏳ W6.5-C — Frontend (optional refinements)
Status: TODO  
Owner: Frontend Agent + QA Agent  
Goal:
- Only if needed: improve card UX, loading/error states, and cost-safe fetch behavior.

---

## ⏳ W6.5-D — QA gate + spend monitoring
Status: TODO  
Owner: QA Agent  
Goal:
- Add PASS-required checks for “OpenAI mode works + caching + no PII output + guardrails”
## 🟡 W6.5-B — Backend internal refactor (LangChain + LangGraph + LangSmith + OpenAI)
Status: TODO  
Owner: Backend Agent + QA Agent  
Scope: backend only

Goal:
- Replace the *internal* OpenAI generation path with a LangGraph pipeline (LangChain output parsing + validations).
- Add LangSmith tracing support (OFF by default; enabled only via env in dev).
- Keep the API contract unchanged:
  - POST /api/chat-night/icebreakers
  - POST /api/chat-night/icebreakers/reveal
  - GET /api/chat-night/room/{room_id} (reveal indices)

Acceptance criteria:
- No API response shape changes.
- Cache-first preserved (no repeated spend per room).
- Guardrails preserved (per-day/per-user/per-room + min-seconds-between).
- Safety preserved (no PII in input/output; fallback on violation).
- LangSmith traces exist when enabled, with NO PII logged.

Verification:
- backend\verify_chat_night_icebreakers_contract.ps1 — PASS
- backend\verify_chat_night_icebreakers_reveal_sync.ps1 — PASS
- Existing Week 6 regressions — PASS

---

## 🟡 W6.5-C — QA / evaluation harness (prompt quality + safety regression)
Status: TODO  
Owner: QA Agent + Backend Agent  
Scope: backend + docs/scripts only

Goal:
- Add a small offline “prompt evaluation harness”:
  - runs 10–20 synthetic SanitizedMatchContext cases
  - validates strict JSON, counts (2–3 reasons, 5 icebreakers), length limits, banned patterns
  - can run in deterministic mode with zero spend

Verification:
- New harness script — PASS
- No OpenAI spend required for baseline run

---

## 🟡 W6.5-D — Ops runbook: dev/prod presets + budget protection
Status: TODO  
Owner: Lead + Backend Agent  
Scope: docs only

Goal:
- Document safe env presets:
  - DEV_SAFE (very low caps)
  - DEV_TEST (temporary higher caps)
  - PROD (lowest caps + kill switch default)
- Document how to confirm “cache-hit” and that no extra OpenAI calls occur.

Verification:
- Docs updated, and a single end-to-end run confirms cache-hit behavior.
