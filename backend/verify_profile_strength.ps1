$env:CHAT_NIGHT_FORCE_OPEN = "true"
$env:CHAT_NIGHT_TEST_PASSES = "100"
$env:PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT = "80" # Set high threshold to test gating

# 1. Login
$login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body '{"phone_number": "1111111111", "password": "TestPass123!"}'
$token = $login.access_token

Write-Host "--- 1. Checking Profile Strength (GET /me) ---"
try {
    $me = Invoke-RestMethod -Uri "http://localhost:8000/api/users/me" -Method Get -Headers @{"Authorization" = "Bearer $token" }
}
catch {
    Write-Host "FAIL: Get me error: $_" -ForegroundColor Red
    exit
}

Write-Host "Completion: $($me.profile_strength.completion_percent)%"
Write-Host "Tier: $($me.profile_strength.tier)"
Write-Host "Missing: $($me.profile_strength.missing_fields -join ', ')"

if ($me.profile_strength.completion_percent -eq $null) {
    Write-Host "FAIL: profile_strength missing" -ForegroundColor Red
}

# 2. Test Gating (Chat Night)
Write-Host "`n--- 2. Testing Gating (Chat Night Status) ---"
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/chat-night/status" -Method Get -Headers @{"Authorization" = "Bearer $token" }
    Write-Host "SUCCESS (Unexpected): Should have been blocked if score < 80" -ForegroundColor Yellow
}
catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "PASSED: Blocked with 400 (Expected)" -ForegroundColor Green
        # Write-Host "Error: $($_.Exception.Message)"
    }
    else {
        Write-Host "FAIL: Unexpected status code $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

Write-Host "`n--- 3. Testing Gating (Chat Night Enter) ---"
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/chat-night/enter" -Method Post -Headers @{"Authorization" = "Bearer $token" }
    Write-Host "SUCCESS (Unexpected): Should have been blocked" -ForegroundColor Yellow
}
catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "PASSED: Blocked with 400 (Expected)" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL: Unexpected status code $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}
