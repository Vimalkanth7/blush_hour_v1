# RUNBOOK — Local Development (Windows + Android Emulator)

## Prerequisites
- Docker Desktop running
- Python venv created for backend
- Node.js installed for mobile-app
- Android emulator running (or device)

---

## Start services (clean)
### 1) Start DB (Mongo)
From repo root:
```powershell
docker-compose up -d mongo
```

### 2) Start backend (uvicorn)
```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:
- http://localhost:8000/health should return 200

Swagger:
- http://localhost:8000/docs

### 3) Start Expo (mobile)
New terminal:
```powershell
cd mobile-app
npx expo start -c
```

Emulator:
- Press `a` in the Expo terminal to open on Android emulator

API URL notes:
- Emulator should use `http://10.0.2.2:8000`
- Physical device should use `http://<LAN_IP>:8000`

## Reset app to logged-out state (wipe Expo Go storage)
```powershell
adb shell pm clear host.exp.exponent
```

Then re-open Expo Go and load the project again.

## Verify auth via PowerShell (token + /me)
Register:
```powershell
$body = @{ phone_number="5550005555"; password="verify_password_123" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/register" -Method Post -Body $body -ContentType "application/json"
$token = $response.access_token
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri "http://localhost:8000/api/users/me" -Method Get -Headers $headers
```

## Common issues
### Port 8000 in use
Stop stale container:
```powershell
docker stop blush_hour_backend
```

Or kill PID:
```powershell
netstat -ano | findstr ":8000"
taskkill /PID <pid> /F
```

### Env vars not picked up
Expo must be restarted with cache clear:
```powershell
npx expo start -c
```

### Emulator can’t reach backend
Ensure API URL is `http://10.0.2.2:8000` (not localhost).

### Simulate invalid token
Change `SECRET_KEY` in backend config and restart backend.
This invalidates tokens so `/me` returns 401 and frontend should logout.
