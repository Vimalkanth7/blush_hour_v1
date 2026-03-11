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