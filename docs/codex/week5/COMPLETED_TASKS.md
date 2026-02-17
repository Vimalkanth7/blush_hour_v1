# Week 5 — Completed Tasks

## 🟢 W5-A — Add V5 Chat Night scoring module (no-AI)
Status: DONE
Tag: v1-w5a-chat-night-matching-v5

Notes:
- Added standalone deterministic scorer returning { score, reason_tags } using existing profile signals.
- Legacy-safe defaults: missing/null normalized to [] / {}.
- reason_tags are PII-safe, capped at 6.
- Not wired into Chat Night yet (integration happens in W5-B).


## 🟢 W5-B — Integrate V5 scorer into Chat Night pairing (feature-flagged)
Status: DONE
Tag: v1-w5b-chat-night-v5-flagged

Notes:
- Integrated V5 ranking into Chat Night matching behind env flags:
  - CHAT_NIGHT_V5_MATCHING_ENABLED (default false)
  - CHAT_NIGHT_V5_MAX_CANDIDATES (bounded scan)
  - CHAT_NIGHT_V5_MIN_SCORE (optional threshold)
- Default behavior remains FIFO when flag is disabled.
- If V5 is enabled but score < threshold, system falls back to FIFO.
- Match logging includes { match_algo, score, reason_tags } and is PII-safe.
- QA runtime scenarios PASS (flag OFF FIFO, flag ON V5 ranking, high threshold fallback).


## 🟢 W5-C — Cooldown guard (avoid repeat pairing)
Status: DONE
Tag: v1-w5c-chat-night-cooldown

Notes:
- Added a configurable cooldown window to prevent repeat pairing of the same two users.
- Cooldown filtering applies to both V5 selection and FIFO fallback (bounded scan), avoiding deadlocks.
- Added backend\verify_chat_night_cooldown.ps1 and verified in both FIFO and V5 modes.
- Logs remain PII-safe (match_algo/score/reason_tags only).


## 🟢 W5-D — Fairness boost (wait-time priority)
Status: DONE
Tag: v1-w5d-chat-night-fairness

Notes:
- Added in-memory wait tracking to prefer longer-waiting users so nobody gets stuck.
- V5 mode: applies a wait-time boost as a tie-breaker/score boost without bypassing min-score threshold or cooldown.
- FIFO mode: uses bounded scan to select the longest-waiting eligible candidate (rather than pure pop(0)).
- Added backend\verify_chat_night_fairness.ps1 and verified in both FIFO and V5 modes.
- Match logging includes numeric wait_seconds + wait_boost (PII-safe).



## 🟢 W5-E — Regression script: V5 match contract
Status: DONE
Tag: v1-w5e-chat-night-v5-contract

Notes:
- Added backend verification script `backend/verify_chat_night_v5_contract.ps1` to lock the V5 match contract.
- Script asserts:
  - V5 mode deterministically selects the higher-overlap candidate (two runs).
  - FIFO mode selects the first queued candidate when V5 is disabled.
  - `reason_tags` are present in V5 mode, PII-safe, and capped at 6.
  - `match_meta` is only returned from `/api/chat-night/enter` when `CHAT_NIGHT_INCLUDE_MATCH_META=true`.
- Updated `docs/QA/regression_checklist.md` to require PASS for `backend\verify_chat_night_v5_contract.ps1` before merging.
- Regression guards remain green (Week3/Week4/W5).