# Week 5 — Session Log

## W5-A — Add V5 Chat Night scoring module (no-AI)
Date: 2026-02-??
Agent: Backend Agent (Codex) + QA Agent (Antigravity)

Files changed:
- backend/app/services/chat_night_matching_v5.py
- docs/codex/week5/PENDING_TASKS.md
- docs/codex/week5/COMPLETED_TASKS.md
- docs/codex/week5/SESSION_LOG.md

What changed:
- Implemented standalone V5 matching scorer returning `{ score, reason_tags }` using profile signals (no AI).
- Added deterministic ranking helpers to pick best candidate later (W5-B integration).
- Enforced legacy-safe normalization (lists/dicts never null) and PII-safe reason tags (max 6).

Why:
- Establish a deterministic, testable matching engine that can be plugged into Chat Night later without touching routing logic yet.

How verified:
- backend/verify_profile_completion.ps1 — PASS
- backend/verify_profile_strength_contract.ps1 — PASS
- backend/verify_languages_habits_contract.ps1 — PASS

Risks / follow-ups:
- W5-B will integrate this into Chat Night with feature flag + bounded candidate scan + threshold.
- If future tests require round-half-up (instead of Python banker’s rounding), adjust and lock expected behavior in docs/tests.

## W5-B — Feature-flagged V5 matching integration (Chat Night)
Date: 2026-02-??
Agent: Backend Agent (Codex) + QA Agent (Antigravity)

Files changed:
- backend/app/routers/chat_night.py

Why:
- Enable profile-signal-based matching (no-AI) safely using feature flags, with bounded candidate scan and FIFO fallback.

How verified:
- Diff safety: backend/app/routers/chat_night.py only ✅
- Regression guards:
  - backend\verify_profile_completion.ps1 — PASS
  - backend\verify_profile_strength_contract.ps1 — PASS
  - backend\verify_languages_habits_contract.ps1 — PASS
- QA runtime behavior:
  - Flag OFF → FIFO match (match_algo="fifo") ✅
  - Flag ON → V5 selects higher-overlap candidate (match_algo="v5", score + reason_tags) ✅
  - Flag ON + MIN_SCORE high → FIFO fallback (match_algo="fifo", score=0, reason_tags=[]) ✅

Tag:
- v1-w5b-chat-night-v5-flagged

## W5-C — Cooldown guard (avoid repeat pairing)
Date: 2026-02-??
Agent: Backend Agent (Codex) + QA Agent (Antigravity) + Founder

Files changed:
- backend/app/routers/chat_night.py
- backend/verify_chat_night_cooldown.ps1

What changed:
- Added cooldown helpers to avoid repeat pairing within a configurable window.
- Applied cooldown filtering to V5 candidate selection and FIFO fallback (bounded scan), preventing deadlocks.
- Added verify_chat_night_cooldown.ps1 to validate FIFO + V5 cooldown behavior.

How verified:
- Diff safety: git diff --name-only — PASS (clean working tree).
- Regression guards:
  - backend\verify_profile_completion.ps1 — PASS
  - backend\verify_profile_strength_contract.ps1 — PASS
  - backend\verify_languages_habits_contract.ps1 — PASS
- Cooldown verification:
  - backend\verify_chat_night_cooldown.ps1 — PASS
  - Verified twice with backend restart:
    - CHAT_NIGHT_V5_MATCHING_ENABLED=false (FIFO) — PASS
    - CHAT_NIGHT_V5_MATCHING_ENABLED=true (V5) — PASS
- Log sanity: match events include match_algo/score/reason_tags; no PII.

Tag:
- v1-w5c-chat-night-cooldown

Risks / follow-ups:
- In-memory queues remain unlocked (pre-existing); rare race conditions still possible under concurrency.
- verify_chat_night_cooldown.ps1 expects test passes available; script fails fast if insufficient.


## W5-D — Fairness boost (wait-time priority)
Date: 2026-02-??
Agent: Backend Agent (Codex) + QA Agent (Antigravity)

Files changed:
- backend/app/routers/chat_night.py
- backend/verify_chat_night_fairness.ps1

What changed:
- Added in-memory wait tracking for queued users.
- FIFO mode: bounded scan prefers longest-wait eligible candidate (still respects cooldown).
- V5 mode: applies wait-time boost as a tie-breaker/score boost while preserving base score threshold + cooldown eligibility.
- Added verify_chat_night_fairness.ps1 to validate fairness behavior in both FIFO and V5 modes.
- Logged numeric wait_seconds + wait_boost (PII-safe).

How verified:
- Regression guards:
  - backend\verify_profile_completion.ps1 — PASS
  - backend\verify_profile_strength_contract.ps1 — PASS
  - backend\verify_languages_habits_contract.ps1 — PASS
- Existing chat night guard:
  - backend\verify_chat_night_cooldown.ps1 — PASS
- Fairness verification:
  - backend\verify_chat_night_fairness.ps1 — PASS
  - Verified twice with backend restart:
    - CHAT_NIGHT_V5_MATCHING_ENABLED=false (FIFO) — PASS
    - CHAT_NIGHT_V5_MATCHING_ENABLED=true (V5) — PASS
- Log sanity: match events include match_algo/score/reason_tags/wait_seconds/wait_boost; no PII.

Tag:
- v1-w5d-chat-night-fairness

Risks / follow-ups:
- Wait tracking is in-memory and resets on backend restart (acceptable for this scope).