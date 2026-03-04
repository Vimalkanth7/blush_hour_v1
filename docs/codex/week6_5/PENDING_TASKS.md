# Week 6.5 — Pending Tasks (AI Icebreakers v2 internals)

## Status
- W6.5-A ✅ DONE (spec)
- W6.5-B ✅ DONE (backend internals upgrade merged + verifiers PASS)
- W6.5-C ✅ DONE (LLMOps / LangSmith tracing + eval harness)
- W6.5-D ⏳ TODO (Ops runbook: safe env presets + budget protection)

---

## ✅ W6.5-A — Docs/spec: single source of truth
Status: DONE  
Deliverable:
- docs/codex/week6_5/W6_5_AI_ICEBREAKERS_SPEC.md

---

## ✅ W6.5-B — Backend internals upgrade (LangChain + LangGraph + LangSmith)
Status: DONE  
Owner: Backend Agent + QA Agent  
Goal:
- Keep existing icebreakers API contract stable while upgrading internals to LangChain + LangGraph and enabling optional LangSmith traces.

Acceptance criteria:
- No contract change for /api/chat-night/icebreakers
- Cache-first behavior preserved (2nd call cached=true)
- Safety filters preserved (PII/banned topics/format)
- OpenAI mode produces model=<configured> when enabled; otherwise deterministic mode
- LangSmith tracing OFF by default; can be enabled via env in dev; hashed metadata only (no PII)

Verification (PASS required):
- backend\verify_profile_completion.ps1
- backend\verify_profile_strength_contract.ps1
- backend\verify_languages_habits_contract.ps1
- backend\verify_chat_night_v5_only.ps1
- backend\verify_chat_night_fifo_only.ps1
- backend\verify_chat_night_icebreakers_contract.ps1
- backend\verify_chat_night_icebreakers_reveal_sync.ps1

---

## ✅ W6.5-C — LLMOps: LangSmith tracing + evaluation harness
Status: DONE  
Owner: QA Agent + Backend Agent  
Scope: backend + qa scripts (no frontend)

Closeout evidence:
- C1 merge commit: `b5f41bd`
- C2 commit: `e928627`
- Harness PASS: `Summary: total=12 pass=12 fail=0` and `PASS: icebreakers eval harness` (exit 0)
- Deterministic mode enforced (`meta.mode == deterministic`) and cache second-call required.
- Reference: `docs/codex/week6_5/week6_5_detailed_docs/W6_5C_LLMOPS_LANGSMITH_EVAL_HARNESS.md`

---

## ⏳ W6.5-D — Ops runbook: dev/prod presets + budget protection
Status: TODO  
Owner: Lead + Backend Agent  
Scope: docs only

Goal:
- Document safe env presets:
  - DEV_SAFE (very low caps)
  - DEV_TEST (temporary higher caps)
  - PROD (lowest caps + kill switch default)
- Document how to confirm cache-hit behavior (no repeated OpenAI calls per room).
- Document tracing toggles and privacy constraints.

Verification:
- Docs updated and reviewed
- One end-to-end run confirms cache-hit behavior
