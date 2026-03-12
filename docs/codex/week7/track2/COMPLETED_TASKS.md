# Week 7 — Track 2 (VOICE) — COMPLETED TASKS

## ✅ T2-A — Backend LiveKit token minting + room constraints (/api/voice/token)
Status: DONE  
Merged: 175bcd8 (Merge PR #32)  
Feature commit: 48ffae8  
Branch: feat/backend-w7-t2a-voice-token  
Scope: backend only

What shipped:
- Added POST /api/voice/token (auth required) returning:
  - url, token, room, identity, expires_in
- Kill switch: BH_VOICE_ENABLED (false → 503).
- Config required: LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET (missing → 503 “Voice service not configured”).
- Eligibility enforcement:
  - Not engaged → returns error (blocked pre-engage)
  - Expired/ended → blocked
- TTL enforced: LIVEKIT_TOKEN_TTL_SECONDS clamped to <= 300 seconds.
- Non-PII identity: u_<user_id>
- Room naming: chatnight-<room_id>
- No PII in logs.

How verified:
- backend\verify_talk_room_engage_sync.ps1 → PASS: talk room engage sync verified.
- Manual real HTTP flow:
  - /health OK
  - Pre-engage /api/voice/token blocked (detail: “Voice token is only available for engaged rooms.”)
  - Post-engage /api/voice/token → 200 with expires_in=300 and identity=u_<user_id> (non-PII)

## ✅ T2-B — Frontend LiveKit integration (Talk Room)
Status: DONE  
Merged: 44fc726 (Merge PR for T2-B)  
Feature commit: b168ae3  
Branch: feat/frontend-w7-t2b-livekit-integration  
Scope: mobile-app only

What shipped:
- LiveKit deps + Expo plugins.
- `voiceToken()` wrapper for `POST /api/voice/token`.
- Native-only LiveKit bootstrap (`registerGlobals.native.ts`, web no-op).
- Talk Room voice lifecycle (`waiting` / `connecting` / `connected` / `error`), mute/unmute, disconnect cleanup.
- Web gated (no native imports; safe message).

How verified:
- `npx eslint ...` PASS.
- `npx expo export --platform web` PASS.
- Decision recorded: manual Android audio test deferred to later sprint.


## ✅ T2-C — QA voice token contract verifier (/api/voice/token)
Status: DONE  
Merged: 8cc1750 (Merge PR #36)  
Feature commits: dedcc36 → 0782b330  
Branch: feat/qa-w7-t2c-voice-token-verifier  
Scope: backend QA scripts only

What shipped:
- Added `backend/verify_voice_token_contract.ps1` (QA-only) to validate the `/api/voice/token` backend contract.
- Covers:
  - 401 when unauthenticated
  - 503 when `BH_VOICE_ENABLED=false` (disabled mode)
  - pre-engage blocked (expects “engaged” gating)
  - engaged room returns 200 with `token` present and `expires_in <= 300`
- Token safety: token value is never printed (length only).

How verified:
- `powershell -ExecutionPolicy Bypass -File .\backend\verify_voice_token_contract.ps1 -BaseUrl "http://localhost:8000" -Mode enabled`
  - PASS: voice token contract verified (enabled mode).
- `powershell -ExecutionPolicy Bypass -File .\backend\verify_voice_token_contract.ps1 -BaseUrl "http://localhost:8000" -Mode disabled`
  - PASS: voice token contract verified (disabled mode).

## ✅ T2-D — Voice runbook (LiveKit)
Status: DONE  
Deliverable: docs/codex/week7/track2/VOICE_LIVEKIT_RUNBOOK.md

Notes:
- Documents env vars, presets, kill switch, and verifier commands.
- Explicitly records decision: manual Android audio testing deferred to the pre-launch mobile testing sprint (post Track 5).
