$env:CHAT_NIGHT_FORCE_OPEN = "true"
$env:CHAT_NIGHT_TEST_PASSES = "100"

# 1. Login
$login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body '{"phone_number": "1111111111", "password": "TestPass123!"}'
$token = $login.access_token

# 2. Get Threads
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/chat/threads" -Method Get -Headers @{"Authorization" = "Bearer $token" }

Write-Host "Checking threads for 'Unknown' partners..."
foreach ($t in $response.threads) {
    $name = $t.partner.first_name
    $pid = $t.partner.id
    
    if ($name -eq "Unknown") {
        Write-Host "FOUND UNKNOWN: Thread $($t.thread_id) -> Partner $pid" -ForegroundColor Red
        
        # 3. Debug User Data directly (Admin hack or separate script? I can't query DB directly from here easily without python)
        # But I can't hit an endpoint to get generic user info usually.
        # I'll rely on the Python script I'll run next to inspect DB if this confirms it.
    }
    else {
        Write-Host "OK: $name ($pid)" -ForegroundColor Green
    }
}
