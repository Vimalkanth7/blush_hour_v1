# Week 7 — Track 2 (VOICE) — PENDING TASKS

Owner: Lead + Backend + Frontend + QA  
Goal: Real voice rooms (core product experience)  
Provider: LiveKit Cloud (WebRTC)

## Status
- Track 2: ⏳ TODO

## Dependencies
- W7-0 (Baseline): security + PII patch set
- Track 1 OTP preferred before broad testing (trust + abuse reduction)

## Subtasks
- [ ] T2-A (Backend) LiveKit token minting:
  - POST /api/voice/token (short TTL)
  - enforce: user must be in active room + not expired
- [ ] T2-B (Frontend) Real voice in Talk Room:
  - mic permission + connect/disconnect
  - reconnect handling
  - hard disconnect at room end (timer)
- [ ] T2-C (QA) 2-device voice smoke:
  - both directions audio
  - leave early behavior
  - background/foreground behavior
- [ ] T2-D (Docs) Voice runbook:
  - LiveKit envs, testing steps, troubleshooting, rollout notes

## Rollback / Kill switch (required)
- BH_VOICE_ENABLED=true (default)
- If false: Talk Room shows “Voice temporarily unavailable” and skips join.

## Acceptance Criteria (Track 2)
- Users can reliably join the same room and talk (Android devices).
- Room end forcibly disconnects voice.
- Failure states are clear and non-blocking.
- No sensitive info is sent to traces/logs.
