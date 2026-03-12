# Week 7 — Track 2 (VOICE) — SESSION LOG

## Log Format (per entry)
- Date (YYYY-MM-DD)
- What changed
- Decisions (why we chose X over Y)
- How verified (commands + PASS lines)
- PR/commit refs
- Risks/follow-ups

## Entries

## 2026-03-11 — T2-A merged (Backend LiveKit /api/voice/token)
What changed:
- Added backend LiveKit token minting endpoint: POST /api/voice/token (auth required).
- Enforced kill switch (BH_VOICE_ENABLED) and config gating (LIVEKIT_* required).
- Enforced engaged-room eligibility and expiry checks.
- Enforced TTL <= 300 seconds.
- Implemented non-PII identity (u_<user_id>) and deterministic room naming (chatnight-<room_id>).

Decisions (why we chose X over Y):
- LiveKit Cloud chosen for fastest Expo/EAS-compatible path to real WebRTC voice.
- Tokens minted server-side only to avoid exposing LIVEKIT_API_SECRET to clients.
- TTL capped to 300s to limit token leak blast radius and match our safety spec.
- Identity uses user_id-derived value (not phone/email) to avoid PII in LiveKit and logs.

How verified (commands + PASS lines):
- backend\verify_talk_room_engage_sync.ps1
  - PASS: talk room engage sync verified.
- Manual real HTTP test:
  - Pre-engage /api/voice/token blocked with detail: “Voice token is only available for engaged rooms.”
  - Post-engage /api/voice/token returned 200 with expires_in=300 and identity=u_<user_id> (non-PII)

PR/commit refs:
- Merged into main: 175bcd8 (PR #32)
- Feature commit: 48ffae8

Risks / follow-ups:
- Frontend LiveKit SDK requires EAS build / native run (Expo Go/web won’t do real audio).
- Next: T2-B should implement the Talk Room join/leave and timer-enforced disconnect.

## 2026-03-11 — T2-B merged (Frontend LiveKit Talk Room integration)
What changed:
- Closed out T2-B after merge to `main`.
- Recorded frontend LiveKit integration delivery (native voice lifecycle + web gating).
- Documented deferred manual Android audio testing decision.

Decisions (why we chose X over Y):
- Manual Android voice test deferred to pre-launch mobile sprint (post Track 5). T2-B merged on code + contract basis.

How verified (commands + PASS lines):
- Non-device checks only:
  - `npx eslint ...` → PASS
  - `npx expo export --platform web` → PASS
- T2-A backend `/api/voice/token` endpoint had already been verified in prior Track 2 session (no new backend testing required here).

PR/commit refs:
- Merged into main: 44fc726
- Feature commit: b168ae3

Risks / follow-ups:
- Manual Android two-device audio validation remains deferred to the pre-launch mobile testing sprint (post Track 5).
- T2-C should add the backend voice verifier coverage and formal smoke checklist.


## 2026-03-12 — T2-C merged (QA voice token verifier)
What changed:
- Added `backend/verify_voice_token_contract.ps1` to assert `/api/voice/token` contract behavior across:
  - unauthenticated (401)
  - disabled mode via `BH_VOICE_ENABLED=false` (503)
  - enabled mode pre-engage gating
  - enabled mode engaged-room success (200 + token fields)

Decisions (why we chose X over Y):
- We added a backend contract verifier to de-risk Track 2 while **manual Android voice testing is deferred** to the pre-launch mobile testing sprint (post Track 5).
- The verifier redacts secrets by policy (token never printed; length only).

How verified (commands + PASS lines):
- Enabled mode:
  - `powershell -ExecutionPolicy Bypass -File .\backend\verify_voice_token_contract.ps1 -BaseUrl "http://localhost:8000" -Mode enabled`
  - PASS: voice token contract verified (enabled mode).
- Disabled mode:
  - (restart backend with `BH_VOICE_ENABLED=false`)
  - `powershell -ExecutionPolicy Bypass -File .\backend\verify_voice_token_contract.ps1 -BaseUrl "http://localhost:8000" -Mode disabled`
  - PASS: voice token contract verified (disabled mode).

PR/commit refs:
- Merged into main: 8cc1750 (PR #36)
- Feature branch: feat/qa-w7-t2c-voice-token-verifier (dedcc36 → 0782b330)

Risks / follow-ups:
- Enabled-mode run requires Chat Night to be open (use `CHAT_NIGHT_FORCE_OPEN=true` in dev if needed).
- Manual Android two-device audio validation remains deferred to the pre-launch sprint.

## 2026-03-12 — T2-D completed (Voice runbook added)
What changed:
- Added LiveKit Voice runbook: VOICE_LIVEKIT_RUNBOOK.md
- Marked T2-D complete in Track 2 pending tracker

Decisions (why we chose X over Y):
- Manual Android voice testing deferred to the pre-launch mobile testing sprint (post Track 5).
- This task is docs-only; verification is via backend contract verifier + code review.

How verified (commands + PASS lines):
- Test-Path "docs/codex/week7/track2/VOICE_LIVEKIT_RUNBOOK.md" -> True
- Select-String ... "BH_VOICE_ENABLED","LIVEKIT_URL","verify_voice_token_contract.ps1" -> matched

PR/commit refs:
- PR branch: chore/docs-week7-track2-t2d-voice-runbook

Risks/follow-ups:
- Run Track 2 full closeout after this merges (mark Track 2 ✅ DONE).
- Android device testing remains deferred until post Track 5.
