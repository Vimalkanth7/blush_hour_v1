$env:CHAT_NIGHT_FORCE_OPEN = "true"
$env:CHAT_NIGHT_TEST_PASSES = "100"

Write-Host "Starting Backend with FORCE_OPEN=true and TEST_PASSES=100..."
$process = Start-Process -FilePath "venv\Scripts\python.exe" -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000" -PassThru -NoNewWindow
Start-Sleep -Seconds 5

try {
    Write-Host "Logging in..."
    $login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body '{"phone_number": "1111111111", "password": "TestPass123!"}'
    $token = $login.access_token
    
    Write-Host "Checking Status..."
    $status = Invoke-RestMethod -Uri "http://localhost:8000/api/chat-night/status" -Headers @{"Authorization" = "Bearer $token" }
    
    if ($status.is_open -eq $true -and $status.passes_total -eq 100) {
        Write-Host "SUCCESS: Chat Night Open with 100 Passes!" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL: Status mismatch" -ForegroundColor Red
        Write-Host $status
    }
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
finally {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
}
