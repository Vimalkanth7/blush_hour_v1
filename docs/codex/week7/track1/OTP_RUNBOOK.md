# OTP Runbook (Track 1)

## 1) Purpose
- OTP is the authentication path for login/signup using a phone number.
- Existing users: successful OTP verification signs the user in and returns the normal auth token response.
- New users: successful OTP verification creates the user (if missing) and then returns the normal auth token response.

## 2) Environment presets (copy/paste)

### A) DEV_TEST (no SMS) - Test provider
```env
SECRET_KEY=dev-only-secret
BH_OTP_ENABLED=true
BH_OTP_PROVIDER=test
BH_OTP_TEST_CODE=000000
CHAT_NIGHT_TEST_MODE=true
EXPO_PUBLIC_API_URL=http://localhost:8000
```

### B) DEV_TWILIO (real SMS) - Twilio Verify
```env
SECRET_KEY=dev-only-secret
BH_OTP_ENABLED=true
BH_OTP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_API_URL=http://localhost:8000
```

## 3) PowerShell commands to run backend
- Reminder: `SECRET_KEY` must be set (W7-0A) or auth setup is invalid.

### Start backend in DEV_TEST
```powershell
cd backend
$env:SECRET_KEY="dev-only-secret"
$env:BH_OTP_ENABLED="true"
$env:BH_OTP_PROVIDER="test"
$env:BH_OTP_TEST_CODE="000000"
$env:CHAT_NIGHT_TEST_MODE="true"
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Start backend in DEV_TWILIO
```powershell
cd backend
$env:SECRET_KEY="dev-only-secret"
$env:BH_OTP_ENABLED="true"
$env:BH_OTP_PROVIDER="twilio"
$env:TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
$env:TWILIO_AUTH_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
$env:TWILIO_VERIFY_SERVICE_SID="VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 4) Frontend test steps
1. Open `/login`.
2. Enter phone in E.164 format and request OTP.
3. App navigates to `/otp-code`.
4. Enter OTP and verify.
5. Confirm logged-in state/session is created.

## 5) QA verifier
- Command:
```powershell
backend\verify_otp_login_contract.ps1 -BaseUrl http://localhost:8000
```
- Notes:
  - Requires test provider mode (`BH_OTP_PROVIDER=test` and test mode enabled).
  - Script exercises rate limit behavior; repeated runs can hit `429` sooner.

## 6) Troubleshooting
### OTP not received checklist
- Verify current mode: `BH_OTP_PROVIDER=test` vs `BH_OTP_PROVIDER=twilio`.
- In Twilio mode, confirm the attempt appears in Twilio Verify logs.
- If using a Twilio trial account, confirm trial constraints (verified recipient numbers, geo/SMS restrictions).
- Check API response status for rate limits; `429` means throttling is active.

## 7) India DLT checklist (mandatory)
- [ ] DLT entity registered (TRAI/DLT).
- [ ] Sender header registered.
- [ ] OTP template registered/approved.
- [ ] Twilio/aggregator configured to use approved template/header.
- [ ] Test delivery on at least 2 Indian carriers.
- [ ] Document fallback messaging if delivery fails.

## 8) Security rules
- Never log OTP codes.
- Never store OTP codes.
- Do not commit secrets.
- `.env` stays local and gitignored.
