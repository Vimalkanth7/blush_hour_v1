$env:CHAT_NIGHT_FORCE_OPEN = "true"
$env:CHAT_NIGHT_TEST_PASSES = "100"

# Rate Limit Thresholds
$LIMIT_ENTER = 5
$LIMIT_ENGAGE = 10
$LIMIT_MSG = 20

# 1. Login
Write-Host "--- 1. Login ---"
$rand = Get-Random -Minimum 10000 -Maximum 99999
$phone = "889977$rand"
# Register
Invoke-RestMethod -Uri "http://localhost:8000/api/auth/register" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$phone`", `"password`": `"TestPass123!`"}" -ErrorAction SilentlyContinue | Out-Null
# Login
$login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$phone`", `"password`": `"TestPass123!`"}"
$token = $login.access_token

# Seed onboarding profile (simple)
$headers = @{"Authorization" = "Bearer $token" }
# Invoke-RestMethod -Uri "http://localhost:8000/api/users/me" -Method Put -Headers $headers -ContentType "application/json" -Body '{"first_name": "Rates", "gender": "Man", "birth_date": "1990-01-01T00:00:00Z"}' -ErrorAction SilentlyContinue | Out-Null

Invoke-RestMethod -Uri "http://localhost:8000/api/users/me" -Method Get -Headers @{"Authorization" = "Bearer $token" } | Out-Null
Write-Host "PASS: Auth token verified."


# 2. Test /enter limit (5)
Write-Host "`n--- 2. Testing /enter Limit ($LIMIT_ENTER) ---"
$count = 0
$blocked = $false
for ($i = 1; $i -le ($LIMIT_ENTER + 3); $i++) {
    try {
        Invoke-RestMethod -Uri "http://localhost:8000/api/chat-night/enter" -Method Post -Headers $headers -ErrorAction Stop | Out-Null
        Write-Host "Request ${i}: OK"
        $count++
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 429) {
            Write-Host "Request ${i}: BLOCKED (429)" -ForegroundColor Green
            $blocked = $true
            break
        }
        else {
            Write-Host "Request ${i}: Error $($_.Exception.Response.StatusCode) $($_.Exception.Message)"
        }
    }
}
if ($blocked) { Write-Host "PASS: /enter limit verified." -ForegroundColor Green } else { Write-Host "FAIL: /enter not blocked." -ForegroundColor Red }


# 3. Test /engage limit (10)
# We can just send a dummy room_id. Rate limit should hit before 404/Validation logic if it works correctly per-IP? 
# SlowAPI works on Request before function body logic usually? 
# Wait, SlowAPI is a decorator. It runs BEFORE the function body. So even if body fails 404, valid requests count?
# Actually, if the function returns 4xx, SlowAPI usually COUNTS it as a hit unless configured otherwise.
# Let's try.
Write-Host "`n--- 3. Testing /engage Limit ($LIMIT_ENGAGE) ---"
$count = 0
$blocked = $false
# Need dummy body
$body = '{"room_id": "dummy"}'
for ($i = 1; $i -le ($LIMIT_ENGAGE + 3); $i++) {
    try {
        Invoke-RestMethod -Uri "http://localhost:8000/api/chat-night/engage" -Method Post -Headers $headers -ContentType "application/json" -Body $body -ErrorAction Stop | Out-Null
        Write-Host "Request ${i}: OK (Wait, endpoint success?)" 
        # Usually we expect 404 here, but if 404 counts towards limit, we are good.
        $count++
    }
    catch {
        $status = $_.Exception.Response.StatusCode
        if ($status -eq 429) {
            Write-Host "Request ${i}: BLOCKED (429)" -ForegroundColor Green
            $blocked = $true
            break
        }
        elseif ($status -eq 404) {
            # Expected non-rate-limited failure
            Write-Host "Request ${i}: 404 (Counted)"
        }
        else {
            Write-Host "Request ${i}: Error $status"
        }
    }
}
if ($blocked) { Write-Host "PASS: /engage limit verified." -ForegroundColor Green } else { Write-Host "FAIL: /engage not blocked." -ForegroundColor Red }


# 4. Test /messages limit (20)
Write-Host "`n--- 4. Testing /messages Limit ($LIMIT_MSG) ---"
$count = 0
$blocked = $false
$body = '{"text": "spam"}'
# Dummy thread ID
$tid = "60d5ec9af682fbd39a1d8b33" 

for ($i = 1; $i -le ($LIMIT_MSG + 5); $i++) {
    try {
        Invoke-RestMethod -Uri "http://localhost:8000/api/chat/threads/$tid/messages" -Method Post -Headers $headers -ContentType "application/json" -Body $body -ErrorAction Stop | Out-Null
        Write-Host "Request ${i}: OK"
    }
    catch {
        $status = $_.Exception.Response.StatusCode
        if ($status -eq 429) {
            Write-Host "Request ${i}: BLOCKED (429)" -ForegroundColor Green
            $blocked = $true
            break
        }
        elseif ($status -eq 404) {
            Write-Host "Request ${i}: 404 (Counted)"
        }
        else {
            Write-Host "Request ${i}: Error $status"
        }
    }
}
if ($blocked) { Write-Host "PASS: /messages limit verified." -ForegroundColor Green } else { Write-Host "FAIL: /messages not blocked." -ForegroundColor Red }
