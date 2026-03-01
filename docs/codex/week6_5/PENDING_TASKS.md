# Week 6.5 — AI Match Reasons + Icebreakers (OpenAI + LangChain/LangGraph/LangSmith)

Status: IN PROGRESS  
Owner: Lead Agent + Backend Agent + Frontend Agent + QA Agent  
Depends on: Week 6-A complete (timer + engage + recovery + polling decision + checklist gate)  
Budget: **$4.64 credit** (must be spend-safe)

---

## Non-negotiables (must hold for every W6.5 task)

### Privacy / compliance
- **Never send PII** to the LLM provider:
  - no phone/email, exact location/address, photos, names, user ids, social handles, bio/prompt text verbatim, chat logs, device identifiers.
- Only send **sanitized tags** (interests/values/languages/habits) + coarse metadata (age bucket).
- Store the generated content **only scoped to room_id**, not as permanent “profile inference”.

### Safety / content rules
- No trauma/sexually explicit content, no coercion, no hate/harassment, no “diagnosis”.
- Icebreakers must be “light + safe + interest-based”.

### Spend / performance guardrails
- **Max 1 generation per room** (cache).
- Hard cap daily generations (dev): default 25/day (config).
- Use a cheap model for dev: **gpt-4o-mini** (or smallest acceptable).
- Low tokens: `max_tokens <= 250`, temperature ~0.6.
- If LLM fails or violates safety → return deterministic fallback templates.

### Engineering constraints
- Backend-only and frontend-only tasks must be separate PRs.
- Feature must be behind a **kill switch** (env/config).
- Must be observable (LangSmith traces).

---

## ✅ W6.5-A — Docs/spec: single source of truth (DONE)

Status: DONE  
Owner: Lead/Docs Agent  
Deliverable:
- `docs/codex/week6_5/W6_5_AI_ICEBREAKERS_SPEC.md` finalized spec (A–J sections)
Verification:
- Docs present and reviewed (no code changes)

---

## 🟡 W6.5-B — Backend: AI “Match Reasons” + Icebreakers API (LangChain + LangGraph + LangSmith + OpenAI)

Status: TODO  
Owner: Backend Agent + QA Agent  
Scope: backend only

### Goal
Generate and serve:
- `reasons`: 2–3 short reasons
- `icebreakers`: **exactly 5** safe prompts  
for a Talk Room (room_id), based only on **sanitized shared tags**.

### Deliverables (subtasks)
**B1 — Data sanitization builder**
- Build a function that produces `SanitizedMatchContext` from:
  - User A profile tags + User B profile tags (interests/values/languages/habits, age bucket)
  - room_id
- Must explicitly exclude all PII fields.

**B2 — Persistence model**
- Create a DB model like `ChatNightIcebreakers` keyed by `room_id`:
  - `room_id` (unique)
  - `created_at`
  - `model`
  - `prompt_version`
  - `reasons[]`
  - `icebreakers[]` (len=5)
  - `fallback_used` boolean
  - `safety_flags[]` (if any)
- Add TTL or cleanup strategy if needed (optional).

**B3 — LangChain prompt + output schema**
- Prompt that *forces strict JSON output*.
- Output must be validated server-side:
  - reasons count 2–3
  - icebreakers count = 5
  - length limits (e.g., <= 120 chars each)
  - no banned patterns (phone/email/address)

**B4 — LangGraph flow**
Minimal graph is fine (don’t over-engineer):
1) build_sanitized_context
2) call_llm
3) validate_json
4) safety_filter
5) persist_cache
6) return_response

**B5 — LangSmith observability**
- Tracing enabled via env (LangChain tracing).
- Log fields:
  - room_id (or hashed), prompt_version, model, latency, token usage, fallback_used.

**B6 — API endpoints**
- `POST /api/chat-night/icebreakers/generate { room_id }`  
  - Only room participants can call
  - returns cached result if exists (idempotent)
- `GET /api/chat-night/icebreakers/{room_id}`
  - returns cached result or 404/not_ready

**B7 — Rate limiting + spend lock**
- 1 generate per room
- per-user per-day cap
- global kill switch:
  - `AI_ICEBREAKERS_ENABLED=false` → always return fallback

### Acceptance criteria
- Returns 5 safe prompts and 2–3 reasons for any valid room.
- No PII is sent to OpenAI and no PII appears in output.
- Cached by room_id (no repeated spend).
- Works with backend outage/retry patterns (doesn’t spam calls).
- LangSmith trace exists for each generation.

### Verification
- Existing backend regression scripts: PASS
- New QA checks:
  - “PII filter” unit/contract test PASS
  - “cache works” (2nd call returns same content without new generation) PASS
  - “kill switch returns fallback” PASS

---

## 🟡 W6.5-C — Frontend: Icebreaker Cards UI in Talk Room

Status: TODO  
Owner: Frontend Agent + QA Agent  
Scope: mobile-app only

### Goal
Show 5 “closed” cards in Talk Room.  
On tap, reveal the prompt to **both** users (sync).

### Deliverables (subtasks)
**C1 — Fetch + display**
- On room enter / poll cycle, fetch icebreakers:
  - show loading placeholder
  - on success show 5 cards
  - on failure show fallback/“try again” (no spam)

**C2 — Reveal sync**
- Decide sync mechanism (simple):
  - backend stores `revealed_indices[]` per room (recommended)
  - both clients read it via `/room/{room_id}` or new endpoint
- When user taps card i → POST reveal → both clients update.

**C3 — UX constraints**
- Don’t block calling experience
- Prompts must be short, 1 sentence

### Acceptance criteria
- Both users see the same 5 prompts.
- When A reveals card #3, B also sees it reveal within 1 poll.
- No duplicates, no flicker, no repeated generation calls.

### Verification
- Manual “2 browsers, 1 room” checklist: PASS (includes reveal sync)

---

## 🟡 W6.5-D — QA: Safety gate + spend guardrails + monitoring

Status: TODO  
Owner: QA Agent

### Goal
Make this shippable safely with low budget.

### Deliverables
**D1 — QA script/checklist**
- New checklist entry for:
  - no PII in output
  - no banned topics
  - 5 prompts exactly
  - cache confirmed

**D2 — Spend test**
- Verify “generate once per room” in practice.
- Verify daily cap works.

**D3 — Monitoring**
- Confirm LangSmith traces visible
- Document how to audit failures and fallback usage

### Acceptance criteria
- QA checklist PASS required before merge
- Spend stays controlled in dev testing

---

## Next execution order (recommended)
1) **W6.5-B backend** (generate + cache + safety + kill switch + traces)
2) **W6.5-C frontend** (cards UI + reveal sync)
3) **W6.5-D QA** (gate + spend + monitoring)
