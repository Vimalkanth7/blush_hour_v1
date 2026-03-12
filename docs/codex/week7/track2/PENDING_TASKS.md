# Week 7 — Track 2 (VOICE) — PENDING TASKS

Owner: Lead + Backend + Frontend + QA  
Goal: Real voice rooms (core product experience)  
Provider: LiveKit Cloud (WebRTC)

## Status
- Track 2: 🟡 IN PROGRESS

## Dependencies
- W7-0 (Baseline): ✅ DONE (security + PII patch set)
- Track 1 (OTP): ✅ DONE (recommended before broad voice testing)

## Core Specs (must be enforced)
- Kill switch: BH_VOICE_ENABLED=true (default)
- Token minting is server-side only (never expose LIVEKIT_API_SECRET to clients)
- Token TTL: <= 300 seconds
- Room mapping: use chat-night room_id as LiveKit room name (or a deterministic derivative)
- Safety: no recording by default; no PII in logs/traces

## Subtasks
- [X] T2-A (Backend) LiveKit token minting + room constraints:
  - Add env/config:
    - BH_VOICE_ENABLED (kill switch)
    - LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
    - LIVEKIT_TOKEN_TTL_SECONDS (cap <= 300)
  - Add endpoint:
    - POST /api/voice/token (auth required)
    - Only returns token if user is in an active chat-night room and room not expired/ended
    - Response includes: livekit_url, token, room_name, expires_in
  - Rate limit endpoint and avoid PII logs (use user_id only)

- [x] T2-B (Frontend) Real voice in Talk Room (LiveKit):
  - Replace UI-only “voice” with real audio connect/disconnect
  - Mic permission handling + clear error states
  - Mute/unmute
  - Hard disconnect at room end (timer)
  - Web fallback: “Voice available on Android app” (no crash)
  - Decision: Manual Android voice test deferred to pre-launch mobile testing sprint (post Track 5). T2-B closed on code + contract basis.

- [X] T2-C (QA) Voice smoke:
  - Add backend contract verifier for /api/voice/token:
    - 401 when unauthenticated
    - 503 when BH_VOICE_ENABLED=false
    - 403/404 when user not in active room
    - 200 includes token + expires_in <= 300
  - Manual 2-device checklist:
    - two-way audio
    - background/foreground behavior
    - early-leave behavior
    - timer end disconnect

- [ ] T2-D (Docs) Voice runbook:
  - required env vars + presets
  - local dev steps + Android testing steps (EAS / expo run:android)
  - troubleshooting (permissions, token expiry, connectivity)
  - rollout + kill switch procedure

## Rollback / Kill switch (required)
- BH_VOICE_ENABLED=true (default)
- If false: Talk Room shows “Voice temporarily unavailable” and skips joining LiveKit.

## Acceptance Criteria (Track 2)
- Users can reliably join the same room and talk (Android devices).
- Room end forcibly disconnects voice.
- Token endpoint enforces auth + room eligibility + TTL <= 300s.
- Failure states are clear and non-blocking.
- No PII is sent to traces/logs.
