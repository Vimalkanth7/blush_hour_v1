# W6.5 AI Match Reasons + Icebreakers Spec

## A) Feature Overview

### What problem it solves
Talk Room currently relies on users to start a conversation from scratch. This feature provides safe, lightweight AI-generated match reasons and opening prompts so both participants can begin quickly without exposing sensitive profile data.

### Where it appears (Talk Room)
In Talk Room, as a 5-card module visible to both room participants after room access is granted.

### One-sentence definition of success
Both participants see the same safe, relevant 5 prompts and short match reasons, generated once per room, with no PII exposure.

## B) Data Minimization Rules (Non-negotiable)

### Fields NEVER sent to AI
- Phone numbers
- Email addresses
- Exact location (street, neighborhood, full city-level coordinates, workplace address)
- Photos or image URLs
- Real names or usernames
- Bio text verbatim
- Prompt/answer text verbatim
- Internal identifiers (user_id, account_id, device_id, auth IDs)
- Social handles (Instagram, TikTok, Snapchat, X, etc.)
- Message history or raw chat text
- Any free-text field that can contain PII

### Fields allowed to AI
- `person_a` / `person_b` labels only (no names)
- Age bucket (example: `21-24`, `25-29`, `30-34`)
- Interest tags (predefined taxonomy values)
- Values tags (predefined taxonomy values)
- Languages list (high-level language names only)
- Habits (coarse categories only; example: `smoking: "no"`, `drinking: "sometimes"`)
- Intentions (optional high-level tag; example: `relationship`, `casual`, `friendship`)

## C) "Sanitized Match Context" Schema (input to AI)

```json
{
  "room_id": "uuid",
  "person_a": {
    "age_bucket": "25-29",
    "interests": ["hiking", "live-music", "coffee"],
    "values": ["family", "growth"],
    "languages": ["English", "Spanish"],
    "habits": {
      "smoking": "no",
      "drinking": "social"
    },
    "intentions": "relationship"
  },
  "person_b": {
    "age_bucket": "25-29",
    "interests": ["travel", "coffee", "cooking"],
    "values": ["growth", "kindness"],
    "languages": ["English"],
    "habits": {
      "smoking": "no",
      "drinking": "social"
    },
    "intentions": "relationship"
  },
  "constraints": {
    "no_pii": true,
    "tone": "friendly",
    "count": 5
  }
}
```

## D) AI Output Contract (strict JSON schema)

### Required structure
```json
{
  "reasons": [
    "You both value personal growth and meaningful connection.",
    "Your shared coffee interest makes first-date planning easy."
  ],
  "icebreakers": [
    "What is one weekend plan that always boosts your mood?",
    "If you could plan a simple coffee date, what would it look like?",
    "Which travel memory still makes you smile?",
    "What is a hobby you want to try this year?",
    "What small daily habit keeps you grounded?"
  ]
}
```

### JSON Schema (strict)
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["reasons", "icebreakers"],
  "properties": {
    "reasons": {
      "type": "array",
      "minItems": 2,
      "maxItems": 3,
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 120
      }
    },
    "icebreakers": {
      "type": "array",
      "minItems": 5,
      "maxItems": 5,
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 120
      }
    }
  }
}
```

### Validation rules
- Output must be valid JSON object only (no markdown, no prose wrapper).
- `reasons`: array of 2-3 strings.
- `icebreakers`: array of exactly 5 strings.
- Every string must be one sentence and max 120 characters.
- No emojis, hashtags, links, or @handles.
- No references to names, locations, employers, schools, or contact details.
- Language should be neutral-friendly and non-judgmental.

### Banned topics list
- Sexual content or explicit innuendo
- Hate speech, harassment, or identity-based insults
- Politics, religion, trauma, medical diagnoses
- Financial status, debt, salary, or legal history
- Exact location requests or contact-exchange prompts
- Anything asking for off-platform migration

## E) Safety Filter + Fallback Policy

### PII filter checklist (pre-store and pre-render)
Reject AI output if any line matches:
- Email pattern (contains `@` plus domain-like suffix)
- Phone-like pattern (7+ digits with optional separators)
- Address-like pattern (street number + street suffix keywords)
- Social handle pattern (`@username` with platform cues)
- URL pattern (`http://`, `https://`, `www.`)

### Unsafe content rejection
Reject and fallback if output contains:
- Any banned topic content
- Sexual/violent/hate content
- Instructions that pressure user contact sharing
- Mentions of exact personal identifiers

### Fallback behavior
- Use deterministic templates from shared tags only.
- Build 2-3 reasons from top overlap in `interests`, `values`, `languages`, `habits`, `intentions`.
- Build exactly 5 generic-safe icebreakers selected from fixed template catalog.
- Fallback must not depend on model output randomness.

### What to store when fallback is used
- `fallback_used: true`
- `fallback_reason: "<validation_failed|unsafe_content|provider_error|timeout>"`
- `prompt_version`
- `generated_at`
- `cache_key` (room scoped)

## F) Backend Contracts (docs only, not implementation)

### Endpoints
1. `POST /api/chat-night/icebreakers/generate`
Request:
```json
{
  "room_id": "uuid"
}
```
Behavior:
- Auth required.
- Caller must be one of the 2 room participants.
- Generate once per room; if cached, return cached payload.

2. `GET /api/chat-night/icebreakers/{room_id}`
Behavior:
- Auth required.
- Caller must be one of the 2 room participants.
- Returns cached generated payload for that room, if available.

### Caching rule
- One generation per room.
- Cache is immutable for that room unless admin/manual invalidation is introduced later.

### Response example
```json
{
  "room_id": "uuid",
  "reasons": [
    "You both value growth and meaningful communication.",
    "You share overlapping interests that support easy first-date planning."
  ],
  "icebreakers": [
    "What kind of weekend plan feels ideal to you?",
    "What is one interest you recently got more serious about?",
    "What is your go-to conversation topic when meeting someone new?",
    "What is one place you want to visit this year?",
    "What is one routine that improves your day?"
  ],
  "fallback_used": false,
  "cached": true,
  "generated_at": "2026-02-28T00:00:00Z"
}
```

## G) Rate Limits + Cost Guardrails

- Max 1 generate call per room (`generate` is idempotent and cache-backed).
- Daily per-user cap for generate attempts (default: 10/day; env configurable).
- Global AI kill switch env flag (example: `AI_ICEBREAKERS_ENABLED=false`) forces fallback path.
- Model default for cost control: `gpt-4o-mini` in dev.
- Timeout budget enforced; timeout triggers fallback and logs `provider_error` or `timeout`.

## H) Observability (LangSmith)

Track per request/room:
- `prompt_version`
- `model`
- `latency_ms`
- `token_usage` (prompt/completion/total)
- `fallback_used`
- `fallback_reason`
- `cache_hit`

Golden test pairs (for later eval):
- Maintain fixed sanitized input pairs covering low-overlap, high-overlap, multilingual, and sparse-profile cases.
- Re-run on prompt/model changes to compare safety and relevance before rollout.

## I) Frontend UX Spec (docs only)

- Show 5 closed cards by default in Talk Room.
- Card click reveals the prompt text locally.
- Both users should receive the same 5 prompts from the same cached payload.
- Optional future enhancement: synced reveal state across participants.
- Loading state: skeleton/placeholder while fetching cached payload.
- Error state: show retry action; if AI unavailable, show fallback cards without exposing backend internals.

## J) QA / Verification Checklist (must be in this doc)

- [ ] No PII in output (emails, phones, exact addresses, handles, URLs).
- [ ] Fallback triggers correctly on validation failure and provider error.
- [ ] Same 5 cards visible to both users in the same room.
- [ ] No spam: repeated generate calls do not regenerate after first cache write.
- [ ] `GET` endpoint returns same cached payload across reloads.
- [ ] AI kill switch forces deterministic fallback.
