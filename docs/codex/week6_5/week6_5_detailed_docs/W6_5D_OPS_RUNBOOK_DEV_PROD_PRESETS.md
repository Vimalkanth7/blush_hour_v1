# W6.5-D Ops Runbook: DEV/PROD Presets, Tracing, Cache, and Budget Protection

Date: 2026-03-05  
Scope: Docs-only ops runbook for Week 6.5

## 1) Overview

This runbook documents:
- Safe environment presets for `DEV_SAFE`, `DEV_TEST`, and `PROD`
- LangSmith tracing toggles and privacy rules
- Internal eval endpoint gating requirements
- Cache-hit confirmation steps
- Eval harness usage for deterministic baseline checks
- Spend protection checks before temporary OpenAI-mode testing

This runbook does **not** cover:
- Production rollout or deployment approvals
- Backend or mobile API/contract changes
- Any schema or migration changes

---

## 2) Presets

### DEV_SAFE (default, deterministic, $0 spend)

Use this as the default local state.

```powershell
# DEV_SAFE: deterministic mode, zero OpenAI spend
$env:CHAT_NIGHT_ICEBREAKERS_PROVIDER = "none"
$env:CHAT_NIGHT_ICEBREAKERS_MODEL = "gpt-4o-mini"
Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue

# Hard stop OpenAI guardrails
$env:CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_DAY = "0"
$env:CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_USER_PER_DAY = "0"
$env:CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_ROOM = "0"
$env:CHAT_NIGHT_ICEBREAKERS_MIN_SECONDS_BETWEEN_OPENAI_CALLS = "30"

# Conservative runtime limits
$env:CHAT_NIGHT_ICEBREAKERS_MAX_OUTPUT_TOKENS = "100"
$env:CHAT_NIGHT_ICEBREAKERS_TIMEOUT_SECONDS = "10"

# Tracing OFF
$env:LANGCHAIN_TRACING_V2 = "false"
$env:LANGSMITH_TRACING = "false"
Remove-Item Env:LANGCHAIN_API_KEY -ErrorAction SilentlyContinue
$env:LANGCHAIN_PROJECT = ""

# Internal evals OFF by default
$env:CHAT_NIGHT_TEST_MODE = "false"
$env:BH_INTERNAL_EVALS_ENABLED = "false"
```

Expected behavior:
- Icebreakers run in deterministic mode (`model=none` for contract endpoint, `meta.mode=deterministic` for internal eval endpoint)
- No OpenAI calls
- No tracing

### DEV_TEST (explicit temporary enable; optional tracing)

Use only for temporary validation windows. Reset to `DEV_SAFE` after testing.

```powershell
# DEV_TEST: temporary OpenAI validation mode
$env:CHAT_NIGHT_ICEBREAKERS_PROVIDER = "openai"
$env:CHAT_NIGHT_ICEBREAKERS_MODEL = "gpt-4o-mini"
$env:OPENAI_API_KEY = "<set-locally-never-commit>"

# Temporary higher caps (must be reset after tests)
$env:CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_DAY = "20"
$env:CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_USER_PER_DAY = "10"
$env:CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_ROOM = "1"
$env:CHAT_NIGHT_ICEBREAKERS_MIN_SECONDS_BETWEEN_OPENAI_CALLS = "3"
$env:CHAT_NIGHT_ICEBREAKERS_MAX_OUTPUT_TOKENS = "220"
$env:CHAT_NIGHT_ICEBREAKERS_TIMEOUT_SECONDS = "15"

# Internal evals only when specifically testing internal endpoint/harness
$env:CHAT_NIGHT_TEST_MODE = "true"
$env:BH_INTERNAL_EVALS_ENABLED = "true"

# Optional tracing (DEV only)
$env:LANGCHAIN_TRACING_V2 = "true"
$env:LANGSMITH_TRACING = "true"
$env:LANGCHAIN_API_KEY = "<set-locally-never-commit>"
$env:LANGCHAIN_PROJECT = "blush-hour-dev"
```

Reset after DEV_TEST:

```powershell
$env:CHAT_NIGHT_ICEBREAKERS_PROVIDER = "none"
Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
$env:LANGCHAIN_TRACING_V2 = "false"
$env:LANGSMITH_TRACING = "false"
$env:BH_INTERNAL_EVALS_ENABLED = "false"
```

### PROD (strict caps, tracing off by default, kill switch ready)

Production should default to lowest practical caps and tracing off.

```powershell
# PROD baseline (strict)
$env:CHAT_NIGHT_ICEBREAKERS_PROVIDER = "openai"
$env:CHAT_NIGHT_ICEBREAKERS_MODEL = "gpt-4o-mini"
$env:OPENAI_API_KEY = "<managed-secret>"

$env:CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_DAY = "5"
$env:CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_USER_PER_DAY = "1"
$env:CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_ROOM = "1"
$env:CHAT_NIGHT_ICEBREAKERS_MIN_SECONDS_BETWEEN_OPENAI_CALLS = "10"
$env:CHAT_NIGHT_ICEBREAKERS_MAX_OUTPUT_TOKENS = "150"
$env:CHAT_NIGHT_ICEBREAKERS_TIMEOUT_SECONDS = "10"

$env:LANGCHAIN_TRACING_V2 = "false"
$env:LANGSMITH_TRACING = "false"
$env:CHAT_NIGHT_TEST_MODE = "false"
$env:BH_INTERNAL_EVALS_ENABLED = "false"
```

Kill switch (immediate spend stop):

```powershell
$env:CHAT_NIGHT_ICEBREAKERS_PROVIDER = "none"
Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
$env:CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_DAY = "0"
$env:CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_USER_PER_DAY = "0"
```

Operational reminder:
- Restart backend after env changes.
- Never enable internal evals in production.
- Keep logs/traces sanitized (no PII, no raw contact data).

---

## 3) LangSmith tracing (dev only)

Supported env vars:
- `LANGCHAIN_TRACING_V2=true`
- `LANGCHAIN_API_KEY=<local secret>`
- `LANGCHAIN_PROJECT=<project-name>`
- Optional compatibility flag: `LANGSMITH_TRACING=true`

Privacy rules:
- No raw PII in traces (no emails, phone numbers, handles, links)
- Only hashed metadata for identifiers (for example `room_id_hash`, `context_hash`)
- Keep payloads sanitized before tracing

Prompt-version sanity check:
- Current expected prompt version tag/value: `w6.5c-2026-03-04`
- Confirm traces show prompt version metadata/tag for W6.5-C prompt

How to sanity-check trace privacy:
1. Open recent `chat-night-icebreakers-graph` / `chat-night-icebreakers-llm` runs.
2. Verify metadata contains hashes, not raw user identifiers.
3. Spot-check inputs/outputs for `@`, phone-like patterns, or URLs.
4. If any PII appears, disable tracing immediately and investigate before re-enabling.

---

## 4) Internal eval endpoint

Endpoint:
- `POST /api/internal/evals/icebreakers`

Mandatory gating (both must be true):
- `CHAT_NIGHT_TEST_MODE=true`
- `BH_INTERNAL_EVALS_ENABLED=true`

If either flag is not true, endpoint should return `404`.

Sanitized PowerShell example:

```powershell
$env:CHAT_NIGHT_TEST_MODE = "true"
$env:BH_INTERNAL_EVALS_ENABLED = "true"

$body = @{
  case_id = "ops-sanity-001"
  context = @{
    room_id = "ops-room-001"
    person_a = @{
      age_bucket = "25-29"
      interests = @("coffee", "hiking")
      values = @("growth", "kindness")
      languages = @("English")
      habits = @{ drinking = "sometimes"; smoking = "no"; exercise = "yes"; kids = "maybe" }
      intentions = "relationship"
      prompt_topics = @("Ideal weekend")
    }
    person_b = @{
      age_bucket = "25-29"
      interests = @("coffee", "travel")
      values = @("growth", "humor")
      languages = @("English")
      habits = @{ drinking = "sometimes"; smoking = "no"; exercise = "yes"; kids = "maybe" }
      intentions = "relationship"
      prompt_topics = @("Favorite cafe")
    }
    constraints = @{
      no_pii = $true
      no_exact_location = $true
      no_trauma_content = $true
    }
  }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Uri "http://localhost:8000/api/internal/evals/icebreakers" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

Warning:
- Never enable internal eval endpoint flags in production.

---

## 5) Cache-hit confirmation

Operational meaning:
- Cache-hit means second call for same room/context returns cached result (`cached=true`) and should avoid repeated LLM spend.

How to confirm:

1. Contract verifier:
```powershell
cd backend
.\verify_chat_night_icebreakers_contract.ps1
```
Expected proof lines include:
- `First call: ... cached=False`
- `Second call: ... cached=True`

2. Internal eval endpoint:
- Send same `case_id` + same context/room twice.
- Second response should have `meta.cached=true`.

3. Harness requirement:
```powershell
cd backend
.\verify_icebreakers_eval_harness.ps1
```
- Each case enforces second call cache hit (`second_cached=True`).

---

## 6) Eval harness

Script:
- `backend\verify_icebreakers_eval_harness.ps1`

Baseline deterministic setup:

```powershell
cd backend
$env:CHAT_NIGHT_ICEBREAKERS_PROVIDER = "none"
Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
$env:CHAT_NIGHT_TEST_MODE = "true"
$env:BH_INTERNAL_EVALS_ENABLED = "true"
$env:LANGCHAIN_TRACING_V2 = "false"
$env:LANGSMITH_TRACING = "false"

venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Run harness in another shell:

```powershell
cd backend
.\verify_icebreakers_eval_harness.ps1
# Optional:
# .\verify_icebreakers_eval_harness.ps1 -BaseUrl "http://localhost:8000"
```

Expected output:
- `Summary: total=12 pass=12 fail=0`
- `PASS: icebreakers eval harness`
- Exit code `0`

Failure clue:
- If you see endpoint unavailable/404, gating flags are missing (`CHAT_NIGHT_TEST_MODE`, `BH_INTERNAL_EVALS_ENABLED`).

---

## 7) Spend protection checklist

Before enabling OpenAI mode:
1. Confirm deterministic baseline passes (`verify_icebreakers_eval_harness.ps1`).
2. Confirm strict caps are set (`CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_*`, throttle, token/time limits).
3. Confirm cache-hit behavior (`cached=false` first call, `cached=true` second call).
4. Enable OpenAI mode only for a short testing window.
5. Disable OpenAI mode when done (`provider=none`, remove key, keep caps low/zero).
6. Keep tracing disabled unless a dev-only tracing session is actively required.
