# refresh_env.ps1 - Development Environment Reset Script
Write-Host "🛑 Killing existing Node/Python processes..." -ForegroundColor Yellow
taskkill /F /IM node.exe
taskkill /F /IM uvicorn.exe

Write-Host "🚀 Starting Backend (Port 8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

Write-Host "📱 Starting Frontend (Port 8081)..." -ForegroundColor Cyan
# Using Start-Process to keep it in a separate window so you can see logs
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd mobile-app; npx expo start --localhost --clear"

Write-Host "🤖 Connecting Android Emulator..." -ForegroundColor Green
Start-Sleep -Seconds 5
& 'C:\Users\vimal.MSI\AppData\Local\Android\Sdk\platform-tools\adb.exe' reverse tcp:8081 tcp:8081
& 'C:\Users\vimal.MSI\AppData\Local\Android\Sdk\platform-tools\adb.exe' shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent

Write-Host "✅ Done! Check the new terminal windows." -ForegroundColor Green
