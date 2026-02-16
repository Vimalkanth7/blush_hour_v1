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

What changed:
- Added env helpers for:
  - CHAT_NIGHT_V5_MATCHING_ENABLED (default false)
  - CHAT_NIGHT_V5_MIN_SCORE (default 0)
  - CHAT_NIGHT_V5_MAX_CANDIDATES (default 50)
- Updated matching to use V5 ranking when enabled, with bounded candidate scan.
- Added FIFO fallback when disabled, below min score, or on error.
- Extended match logging to include match_algo, score, reason_tags (PII-safe).

Why:
- Enable profile-signal-based matching (no-AI) with safe rollout controls and no regressions to existing Chat Night behavior.

How verified:
- Diff safety: git diff --name-only → backend/app/routers/chat_night.py only ✅
- Regression guards:
  - backend\verify_profile_completion.ps1 — PASS
  - backend\verify_profile_strength_contract.ps1 — PASS
  - backend\verify_languages_habits_contract.ps1 — PASS
- Runtime behavior (QA):
  - Flag OFF → FIFO match, logs show match_algo="fifo" ✅
  - Flag ON → V5 picks higher-overlap candidate, logs show match_algo="v5" with score/tags ✅
  - Flag ON + high MIN_SCORE → fallback to FIFO, logs show match_algo="fifo" ✅

Risks / follow-ups:
- In-memory queues remain unlocked (pre-existing behavior); rare race conditions possible under concurrency.
- Next: W5-C cooldown guard + W5-D fairness boost.
Tag:
- v1-w5b-chat-night-v5-flagged
