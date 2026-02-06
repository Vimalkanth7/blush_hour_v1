$env:CHAT_NIGHT_FORCE_OPEN = "true"
$env:CHAT_NIGHT_TEST_PASSES = "100"

# 1. Login
$login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body '{"phone_number": "1111111111", "password": "TestPass123!"}'
$token = $login.access_token

# 2. Get Threads
$threads = Invoke-RestMethod -Uri "http://localhost:8000/api/chat/threads" -Method Get -Headers @{"Authorization" = "Bearer $token" }

if ($threads.threads.Count -eq 0) {
    Write-Host "No threads found. Run verify_chat_night.ps1 first to create matches." -ForegroundColor Red
    exit
}

$thread_id = $threads.threads[0].thread_id
Write-Host "Testing with Thread ID: $thread_id"

# 3. Get Partner Profile (Authorized)
Write-Host "Fetching Partner Profile (Authorized)..."
try {
    $profile = Invoke-RestMethod -Uri "http://localhost:8000/api/chat/threads/$thread_id/partner" -Method Get -Headers @{"Authorization" = "Bearer $token" }
    Write-Host "SUCCESS: Fetched Profile for $($profile.first_name)" -ForegroundColor Green
    Write-Host "Age: $($profile.age)"
    Write-Host "Bio: $($profile.bio)"
}
catch {
    Write-Host "FAIL: Authorized fetch failed: $_" -ForegroundColor Red
    exit
}

# 4. Unauthorized Access Check
# Register/Login a stranger
$stranger_phone = "9998889999"
try {
    # Try register (ignore 409 if exists)
    Invoke-RestMethod -Uri "http://localhost:8000/api/auth/register" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$stranger_phone`", `"password`": `"TestPass123!`"}" -ErrorAction SilentlyContinue
}
catch {}

$login_c = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$stranger_phone`", `"password`": `"TestPass123!`"}"
$token_c = $login_c.access_token

Write-Host "Fetching Partner Profile (Unauthorized)..."
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/chat/threads/$thread_id/partner" -Method Get -Headers @{"Authorization" = "Bearer $token_c" }
    Write-Host "FAIL: Stranger was able to access profile!" -ForegroundColor Red
}
catch {
    if ($_.Exception.Response.StatusCode -eq 403) {
        Write-Host "SUCCESS: Unauthorized access blocked (403)" -ForegroundColor Green
    }
    else {
        Write-Host "Unexpected status: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
}
