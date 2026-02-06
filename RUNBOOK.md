# Blush Hour v0 - Development Runbook

## 1. Clean Start (Reset Environment)
If you encounter port errors or stale processes, run this first.

```powershell
# Stop existing processes on ports 8000 (Backend) and 8081 (Expo)
$ports = @(8000, 8081); foreach ($p in $ports) { $proc = Get-Process -Id (Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue; if ($proc) { Stop-Process -Id $proc.Id -Force; Write-Host "Killed on port $p" } }

# Remove stale backend container if exists
docker rm -f blush_hour_backend

# Ensure DB is up
docker-compose up -d mongo redis
```

## 2. Start Backend (Local)
Run this in a separate terminal or background tab.

```powershell
.\backend\venv\Scripts\Activate.ps1
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
*Health Check*: `http://localhost:8000/health` -> `{"status":"healthy"}`

## 3. Start Mobile App (Expo)
Run this in a separate terminal.

```powershell
cd mobile-app
npx expo start -c
```
*Action*: Press `a` to open on Android Emulator (ensure Emulator is running).

## 4. Verification Commands (Golden User)
Use this snippet to verify the entire stack is connected and working.

```powershell
$phone = "9990008888" # Golden User
$pass = "GoldenPass_2025!"
$baseUrl = "http://localhost:8000/api"

# Register/Login
$regBody = @{ phone_number = $phone; password = $pass } | ConvertTo-Json
try {
    $resp = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $regBody -ContentType "application/json"
    $token = $resp.access_token
    Write-Host "Auth Success. Token obtained."
} catch {
    $resp = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $regBody -ContentType "application/json"
    $token = $resp.access_token
    Write-Host "Auth Success (Login). Token obtained."
}

# Verify Profile Fetch
$headers = @{ Authorization = "Bearer $token" }
$me = Invoke-RestMethod -Uri "$baseUrl/users/me" -Method Get -Headers $headers
if ($me.phone_number -eq $phone) { Write-Host "PASS: Backend Reachable & DB Connected." } else { Write-Error "FAIL: Data mismatch." }
```

## 5. Reset App to Login State
To completely wipe the app's local data (SecureStore, Cache) on the Emulator:

```powershell
# Stops the Expo app
adb shell am force-stop host.exp.exponent

# Clears ALL data (Login session + Cache) for Expo Go
# WARNING: This resets Expo Go completely. You will need to re-open the project.
adb shell pm clear host.exp.exponent

# Restart Expo Server to ensure fresh bundle
cd mobile-app
npx expo start -c
```

## 6. Auth Testing Scenarios

### A. Simulate "Invalid Token" (Force Logout)
To make the current user's token invalid (simulating expiry or security event):

1. **Stop Backend**: `Ctrl+C` in backend terminal.
2. **Change Secret**: Open `backend/app/core/config.py` and change `SECRET_KEY` value (e.g. add a random letter).
3. **Restart Backend**: `uvicorn app.main:app ...`
4. **App Behavior**: The next API call from the app should fail (401), and if the app handles it correctly, it should redirect to Login.

### B. Simulate "Logged Out"
Run the [Reset App](#5-reset-app-to-login-state) commands above.

## Troubleshooting
- **Network Error on Emulator**: Ensure `mobile-app/.env` has `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000`.
- **401 Unauthorized**: Token expired or DB wiped. Re-run verification script to register again.
- **Photos not showing**: Use `adb push local.png /sdcard/Pictures/` and broadcast scan intent (see conversation history).

