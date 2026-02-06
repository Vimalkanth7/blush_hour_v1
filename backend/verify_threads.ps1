$env:CHAT_NIGHT_FORCE_OPEN = "true"
$env:CHAT_NIGHT_TEST_PASSES = "100"

# 1. Login
$login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body '{"phone_number": "1111111111", "password": "TestPass123!"}'
$token = $login.access_token

# 2. Get Threads
$response = Invoke-RestMethod -Uri "http://localhost:8000/api/chat/threads" -Method Get -Headers @{"Authorization" = "Bearer $token" }

# 3. Print First Thread
if ($response.threads.Count -gt 0) {
    $t = $response.threads[0]
    Write-Host "Thread Found:"
    Write-Host "ID: $($t.thread_id)"
    if ($t.partner) {
        Write-Host "Partner Name: $($t.partner.first_name)"
        Write-Host "Partner Photo: $($t.partner.photo_url)"
    }
    else {
        Write-Host "FAIL: Partner info missing" -ForegroundColor Red
    }
}
else {
    Write-Host "No threads found. Register more users and match them first."
}
