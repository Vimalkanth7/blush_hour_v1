# Week 6.5 — Pending Tasks (AI Icebreakers v2 internals)

## Status
- W6.5-A ✅ DONE (spec)
- W6.5-B 🟡 IN PROGRESS (backend LangChain/LangGraph/LangSmith internals)
- W6.5-C ⏳ TODO (frontend refinements if needed)
- W6.5-D ⏳ TODO (QA gate + spend monitoring)

---

## ✅ W6.5-A — Docs/spec (single source of truth)
Status: DONE  
Owner: Lead/Docs Agent  
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