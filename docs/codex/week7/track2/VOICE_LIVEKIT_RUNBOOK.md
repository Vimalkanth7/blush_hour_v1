# Track 2 - Voice (LiveKit) - Runbook (T2-D)

## 1) Purpose
This runbook documents how Blush Hour "Voice" works in Track 2 (LiveKit Cloud):
- Backend mints short-lived LiveKit JWT tokens via `POST /api/voice/token`
- Frontend Talk Room requests the token and joins a LiveKit room
- Kill switch exists to disable voice without redeploying

Important:
- **No secrets** (LiveKit API secret/key) should ever be sent to clients.
- **No PII** (phone/name) should be logged or traced.
- **Manual Android voice testing is deferred** to the pre-launch mobile testing sprint (post Track 5).

---

## 2) Required environment variables (local .env)
Never commit these. Use placeholders in docs.

Required:
- `SECRET_KEY=...` (backend requires this at startup)
- `LIVEKIT_URL=wss://<your-project>.livekit.cloud`
- `LIVEKIT_API_KEY=<set in local .env>`
- `LIVEKIT_API_SECRET=<set in local .env>`
- `LIVEKIT_TOKEN_TTL_SECONDS=300` (server clamps <= 300)
- `BH_VOICE_ENABLED=true`

Recommended for dev testing:
- `CHAT_NIGHT_FORCE_OPEN=true` (avoids "Chat Night is closed")
- `CHAT_NIGHT_TEST_MODE=true` (optional: depends on your dev workflow)

---

## 3) Presets

### DEV_VOICE_ON (default for Track 2 work)
PowerShell:
```powershell
$env:BH_VOICE_ENABLED="true"
$env:LIVEKIT_TOKEN_TTL_SECONDS="300"
$env:CHAT_NIGHT_FORCE_OPEN="true"
# ensure SECRET_KEY + LIVEKIT_* are set in this shell
```

### DEV_VOICE_OFF (kill switch test)
PowerShell:
```powershell
$env:BH_VOICE_ENABLED="false"
# restart backend after changing this
```

## 4) Backend start (local)

From repo root:
```powershell
cd .\backend
.\venv\Scripts\Activate.ps1
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Health:
```powershell
Invoke-RestMethod http://localhost:8000/health
```

## 5) Contract verification (QA)
Enabled mode

Run (backend must be running with BH_VOICE_ENABLED=true and Chat Night open):

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\verify_voice_token_contract.ps1 -BaseUrl "http://localhost:8000" -Mode enabled
```

Expected PASS behaviors:
- `/health` OK
- unauthenticated `/api/voice/token` returns 401
- pre-engage `/api/voice/token` returns 409
- engaged room `/api/voice/token` returns 200 with:
  - token present (token never printed, only length)
  - expires_in <= 300

Disabled mode

Restart backend with BH_VOICE_ENABLED=false, then:

```powershell
powershell -ExecutionPolicy Bypass -File .\backend\verify_voice_token_contract.ps1 -BaseUrl "http://localhost:8000" -Mode disabled
```

Expected PASS behaviors:
- `/health` OK
- unauthenticated returns 401
- authenticated `/api/voice/token` returns 503 (voice unavailable)

## 6) Frontend notes (no device testing required now)

LiveKit voice requires native modules, so real audio needs an EAS Dev Build later.
For now we only require:
- code review
- lint/build checks
- backend contract verifier PASS

(Manual Android testing is deferred to the mobile testing sprint after Track 5.)

## 7) Future sprint: EAS dev build steps (for later)

Not a blocker now. For the future mobile testing sprint:

Install EAS CLI:

```powershell
npm install -g eas-cli
```

Configure and build:

```powershell
cd mobile-app
eas build --profile development --platform android
```

Run dev client:

```powershell
npx expo start --dev-client
```

## 8) Troubleshooting
"SECRET_KEY must be set..."

Set SECRET_KEY in the same shell before starting uvicorn.

"Chat Night is closed"

Set:

```powershell
$env:CHAT_NIGHT_FORCE_OPEN="true"
```

Restart backend.

503 Voice service not configured

Ensure LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET are set in the same shell as uvicorn.

409 Not engaged

This is expected pre-engage. Engage both users or run the verifier.

## 9) Security rules

Never commit .env

Never log:
- OTP codes
- phone numbers
- LiveKit API secrets

Tokens must be short TTL and minted server-side only.
