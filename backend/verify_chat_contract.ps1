$env:CHAT_NIGHT_FORCE_OPEN = "true"
$env:CHAT_NIGHT_TEST_PASSES = "100"

# 1. Login (User A - Participant)
$login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body '{"phone_number": "1111111111", "password": "TestPass123!"}'
$token = $login.access_token

Write-Host "--- 1. Testing GET /threads ---"
try {
    $threads_resp = Invoke-RestMethod -Uri "http://localhost:8000/api/chat/threads" -Method Get -Headers @{"Authorization" = "Bearer $token" }
}
catch {
    Write-Host "FAIL: Get threads error: $_" -ForegroundColor Red
    exit
}

if ($threads_resp.threads.Count -eq 0) {
    Write-Host "No threads found. Please create matches first." -ForegroundColor Red
    exit
}

$t = $threads_resp.threads[0]
Write-Host "Thread ID: $($t.thread_id)"
Write-Host "Match ID: $($t.match_id)"
Write-Host "Partner: $($t.partner | ConvertTo-Json -Depth 1 -Compress)"

if (-not $t.match_id) { Write-Host "FAIL: match_id missing" -ForegroundColor Red }
if (-not $t.partner) { Write-Host "FAIL: partner object missing" -ForegroundColor Red }
if (-not $t.partner.age -and $t.partner.first_name) { Write-Host "WARNING: partner age missing (might be null in DB)" -ForegroundColor Yellow }

$thread_id = $t.thread_id

Write-Host "`n--- 2. Testing GET /messages ---"
try {
    $msgs_resp = Invoke-RestMethod -Uri "http://localhost:8000/api/chat/threads/$thread_id/messages" -Method Get -Headers @{"Authorization" = "Bearer $token" }
}
catch {
    Write-Host "FAIL: Get messsages error: $_" -ForegroundColor Red
    exit
}

Write-Host "Messages Count: $($msgs_resp.messages.Count)"
Write-Host "Next Cursor: $($msgs_resp.next_cursor)"

if ($msgs_resp.messages -eq $null) { Write-Host "FAIL: messages array missing" -ForegroundColor Red }

# Send a message to ensure we have content
Invoke-RestMethod -Uri "http://localhost:8000/api/chat/threads/$thread_id/messages" -Method Post -Headers @{"Authorization" = "Bearer $token" } -ContentType "application/json" -Body '{"text": "Contract Test"}' | Out-Null
$msgs_resp = Invoke-RestMethod -Uri "http://localhost:8000/api/chat/threads/$thread_id/messages" -Method Get -Headers @{"Authorization" = "Bearer $token" }
Write-Host "New Message Text: $($msgs_resp.messages[0].text)"

Write-Host "`n--- 3. Testing GET /partner (Profile) ---"
try {
    $partner_resp = Invoke-RestMethod -Uri "http://localhost:8000/api/chat/threads/$thread_id/partner" -Method Get -Headers @{"Authorization" = "Bearer $token" }
}
catch {
    Write-Host "FAIL: Get partner profile error: $_" -ForegroundColor Red
    exit
}

Write-Host "Partner Wrapper: $($partner_resp | ConvertTo-Json -Depth 5 -Compress)"
if (-not $partner_resp.partner) { Write-Host "FAIL: partner wrapper missing" -ForegroundColor Red }
Write-Host "Bio: $($partner_resp.partner.bio)"


Write-Host "`n--- 4. Testing Intruder (User C) ---"
$rand = Get-Random -Minimum 1000 -Maximum 9999
$stranger_phone = "999888$rand"
# Try register
Invoke-RestMethod -Uri "http://localhost:8000/api/auth/register" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$stranger_phone`", `"password`": `"TestPass123!`"}" -ErrorAction SilentlyContinue
# Login
$login_c = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$stranger_phone`", `"password`": `"TestPass123!`"}"
$token_c = $login_c.access_token

# Try to read messages
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/chat/threads/$thread_id/messages" -Method Get -Headers @{"Authorization" = "Bearer $token_c" }
    Write-Host "FAIL: Stranger read messages!" -ForegroundColor Red
}
catch {
    if ($_.Exception.Response.StatusCode -eq 403) {
        Write-Host "SUCCESS: Messages blocked (403)" -ForegroundColor Green
    }
    else {
        Write-Host "Unexpected status messages: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
}

# Try to read partner
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/chat/threads/$thread_id/partner" -Method Get -Headers @{"Authorization" = "Bearer $token_c" }
    Write-Host "FAIL: Stranger read partner profile!" -ForegroundColor Red
}
catch {
    if ($_.Exception.Response.StatusCode -eq 403) {
        Write-Host "SUCCESS: Partner profile blocked (403)" -ForegroundColor Green
    }
    else {
        Write-Host "Unexpected status partner: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
}
