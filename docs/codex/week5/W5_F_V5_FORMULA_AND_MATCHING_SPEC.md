# Week 5 - Chat Night V5 Matching Spec

## Overview
V5 is the deterministic, no-AI matching mode for Chat Night. It scores and ranks candidates using profile overlap signals and stable tie-breakers. It does not use ML models, embeddings, or external services.

## Inputs Used
- interests (list)
- values (list)
- languages (list)
- habits (object with keys: drinking, smoking, exercise, kids)
- prompts (list)
- last_active_at, last_active, last_seen_at, updated_at (for recency)

Missing or null fields are treated as empty lists or empty objects. Strings are trimmed. This keeps scoring legacy-safe and deterministic.

## Score Formula (Base Score)
Total score is the sum of the components below, clamped to 0-100.

| Component | Points | Input / Rule |
| --- | --- | --- |
| Interests overlap | 0-40 | 40 * Jaccard(interests) |
| Values overlap | 0-20 | 20 * Jaccard(values) |
| Language match | 0 or 10 | 10 if any shared language |
| Habits match | 0-20 | 5 points per matching habit key (drinking, smoking, exercise, kids), max 20 |
| Prompt overlap | 0 or 10 | 10 if both users have at least 1 prompt |
| Recent activity | 0-10 | 10 * recency bucket |

Recency buckets (minutes since last active):
- 0-2 minutes: 1.0
- 2-5 minutes: 0.8
- 5-10 minutes: 0.6
- 10-20 minutes: 0.4
- > 20 minutes or unknown: 0.0

## reason_tags Spec
Allowed tags (max 6 total, in this order):
- interests_overlap
- values_overlap
- language_match
- habits_match
- prompt_overlap
- recent_active

A tag is added only when its corresponding component contributes a positive score. Tags are PII-safe and never include raw user content.

## Matching Behavior

## FIFO Mode (CHAT_NIGHT_V5_MATCHING_ENABLED=false)
- Candidate pool is the opposite queue.
- Scan up to CHAT_NIGHT_V5_MAX_CANDIDATES from the queue, skipping cooled partners.
- Select the eligible candidate with the longest wait_seconds (oldest wait).
- If no eligible candidate is found in the scan window, no match is created and the caller is queued.

## V5 Mode (CHAT_NIGHT_V5_MATCHING_ENABLED=true)
- Candidate pool is the opposite queue limited to CHAT_NIGHT_V5_MAX_CANDIDATES.
- Remove candidates blocked by cooldown.
- Score each candidate using the V5 base score and discard any below CHAT_NIGHT_V5_MIN_SCORE.
- If wait-time boost is enabled, compute effective_score = min(100, base_score + wait_boost).
- Choose the candidate with the highest effective_score. Ties break by longer wait_seconds, then by deterministic ranking (shared interests, recency, hash tie-breaker).
- If no eligible candidate passes the min score, fall back to FIFO selection rules above.

## Cooldown Behavior (W5-C)
- Cooldown prevents repeat pairing within CHAT_NIGHT_PAIR_COOLDOWN_MINUTES.
- Applies to both V5 and FIFO selection.
- Selection uses a bounded scan (CHAT_NIGHT_V5_MAX_CANDIDATES). Skipped candidates remain in the queue, avoiding deadlocks.

## Fairness / Wait-Time Boost (W5-D)
- wait_seconds is the time since a user was queued.
- wait_boost = floor(wait_seconds / CHAT_NIGHT_WAITTIME_BOOST_STEP_SECONDS), capped at CHAT_NIGHT_WAITTIME_BOOST_MAX_POINTS.
- If CHAT_NIGHT_WAITTIME_BOOST_ENABLED=false, wait_boost is 0.
- V5 mode uses effective_score (base score + wait_boost, capped at 100).
- FIFO mode chooses the longest-waiting eligible candidate within the bounded scan.

## Feature Flags and Defaults
- CHAT_NIGHT_V5_MATCHING_ENABLED = false
- CHAT_NIGHT_V5_MAX_CANDIDATES = 50
- CHAT_NIGHT_V5_MIN_SCORE = 0
- CHAT_NIGHT_PAIR_COOLDOWN_MINUTES = 30
- CHAT_NIGHT_WAITTIME_BOOST_ENABLED = true
- CHAT_NIGHT_WAITTIME_BOOST_STEP_SECONDS = 30
- CHAT_NIGHT_WAITTIME_BOOST_MAX_POINTS = 15
- CHAT_NIGHT_INCLUDE_MATCH_META = false

## Logging Contract (PII-safe)
Match events log a PII-safe payload with:
- room_id
- users (user IDs only)
- match_algo (v5 or fifo)
- score (0-100)
- reason_tags (max 6)
- wait_seconds
- wait_boost

## Optional Match Metadata (Debug)
When CHAT_NIGHT_INCLUDE_MATCH_META=true and /api/chat-night/enter returns match_found, the response includes:
- match_algo
- score
- reason_tags
- wait_seconds
- wait_boost

When the flag is false, the response shape is unchanged.

## QA Scripts
Chat Night V5 related:
- backend\verify_chat_night_cooldown.ps1: cooldown skip behavior in FIFO and V5, bounded scan safety.
- backend\verify_chat_night_fairness.ps1: wait-time boost and longest-wait selection in FIFO and V5.
- backend\verify_chat_night_v5_contract.ps1: V5 high-overlap determinism, FIFO fallback, match_meta gating, reason_tags capped at 6.

Week 3/4 regression guards:
- backend\verify_profile_completion.ps1
- backend\verify_profile_strength_contract.ps1
- backend\verify_languages_habits_contract.ps1
