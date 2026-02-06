$env:CHAT_NIGHT_FORCE_OPEN = "true"
$env:CHAT_NIGHT_TEST_PASSES = "100"

# 1. Health Check
Write-Host "--- 1. Testing Health Check ---"
$health = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
Write-Host "Status: $($health.status)"
Write-Host "DB Status: $($health.database)"

if ($health.database -eq "connected") {
    Write-Host "PASSED: Health check verified DB." -ForegroundColor Green
}
else {
    Write-Host "FAIL: Health check failed DB." -ForegroundColor Red
}

# 2. Rate Limiting (Login)
Write-Host "`n--- 2. Testing Rate Limiting (Login) ---"
$blocked = $false
for ($i = 1; $i -le 10; $i++) {
    try {
        Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body '{"phone_number": "1111111111", "password": "wrong"}' -ErrorAction Stop | Out-Null
        Write-Host "Request ${i}: Allowed"
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 429) {
            Write-Host "Request ${i}: BLOCKED (429 Too Many Requests)" -ForegroundColor Green
            $blocked = $true
            break
        }
        else {
            Write-Host "Request ${i}: Error $($_.Exception.Response.StatusCode)"
        }
    }
}

if ($blocked) {
    Write-Host "PASSED: Rate limiting active." -ForegroundColor Green
}
else {
    Write-Host "FAIL: Rate limiting not triggered." -ForegroundColor Red
}

Write-Host "Waiting 70s for rate limit reset..."
Start-Sleep -Seconds 70

# 3. Ban Check
Write-Host "`n--- 3. Testing Banned User Access ---"

# Refresh Admin Token
$admin_login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body '{"phone_number": "1111111111", "password": "TestPass123!"}'
$admin_token = $admin_login.access_token

# Create temp user
$rand = Get-Random -Minimum 10000 -Maximum 99999 # Larger range unique
$banned_phone = "998877$rand"
Write-Host "Created temp phone: $banned_phone"
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/auth/register" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$banned_phone`", `"password`": `"TestPass123!`"}"
}
catch {
    Write-Host "Register failed: $_"
}

# Login as temp user
try {
    $user_login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$banned_phone`", `"password`": `"TestPass123!`"}"
    $user_token = $user_login.access_token
    Write-Host "User Token: $user_token"
    
    # Use Admin Search to get ID reliably
    $search = Invoke-RestMethod -Uri "http://localhost:8000/api/admin/users?search=$banned_phone" -Method Get -Headers @{"Authorization" = "Bearer $admin_token" }
    $user_id = $search.users[0].id
    Write-Host "User ID (from Admin): $user_id"
    
    if (-not $user_id) { throw "User ID is null" }
}
catch {
    Write-Host "Setup failed: $_"
    exit
}

# Admin Bans User
Invoke-RestMethod -Uri "http://localhost:8000/api/admin/users/$user_id/actions/ban" -Method Post -Headers @{"Authorization" = "Bearer $admin_token" } -ContentType "application/json" -Body '{"reason": "Safety Test"}' | Out-Null
Write-Host "User Banned."

# User Tries Access
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/users/me" -Method Get -Headers @{"Authorization" = "Bearer $user_token" }
    Write-Host "FAIL: Banned user accessed /me" -ForegroundColor Red
}
catch {
    if ($_.Exception.Response.StatusCode -eq 403) {
        Write-Host "PASSED: Banned user blocked (403)." -ForegroundColor Green
    }
    else {
        Write-Host "FAIL: Unexpected status $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

# Cleanup Unban
Invoke-RestMethod -Uri "http://localhost:8000/api/admin/users/$user_id/actions/unban" -Method Post -Headers @{"Authorization" = "Bearer $admin_token" } | Out-Null
Write-Host "Cleanup: User Unbanned."
