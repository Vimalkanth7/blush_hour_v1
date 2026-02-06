$env:CHAT_NIGHT_FORCE_OPEN = "true"
$env:CHAT_NIGHT_TEST_PASSES = "100"

# 1. Login as Admin
Write-Host "--- 1. Login as Admin ---"
try {
    $login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body '{"phone_number": "1111111111", "password": "TestPass123!"}' -ErrorAction Stop
    $token = $login.access_token
    Write-Host "Admin Token Acquired"
}
catch {
    Write-Host "FAIL: Admin Login: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# 2. Admin Overview
Write-Host "`n--- 2. Testing Admin Overview ---"
try {
    $overview = Invoke-RestMethod -Uri "http://localhost:8000/api/admin/metrics/overview" -Method Get -Headers @{"Authorization" = "Bearer $token" } -ErrorAction Stop
    Write-Host "Total Users: $($overview.users.total)"
    if ($overview.users.total -gt 0) { Write-Host "PASS: Overview returned data" -ForegroundColor Green }
}
catch {
    Write-Host "FAIL: Admin overview error: $_" -ForegroundColor Red
}

# 3. Create Temp User for Detail/Ban Tests
Write-Host "`n--- 3. Creating Temp User ---"
$rand = Get-Random -Minimum 1000 -Maximum 9999
$target_phone = "555999$rand"
Invoke-RestMethod -Uri "http://localhost:8000/api/auth/register" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$target_phone`", `"password`": `"TestPass123!`"}" -ErrorAction SilentlyContinue | Out-Null

# Login Temp User
$t_login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$target_phone`", `"password`": `"TestPass123!`"}" -ErrorAction Stop
$t_token = $t_login.access_token

# Validate Token & Get ID (User Context)
$me_info = Invoke-RestMethod -Uri "http://localhost:8000/api/users/me" -Method Get -Headers @{"Authorization" = "Bearer $t_token" } -ErrorAction Stop
# The API returns snake_case, but PowerShell might handle case? 
# Usually 'id' or '_id'. 
$target_id = $me_info.id
if (-not $target_id) { $target_id = $me_info._id }
if (-not $target_id) { 
    Write-Host "DEBUG: /me response:`n"
    $me_info | ConvertTo-Json 
    throw "Failed to get User ID" 
}
Write-Host "Temp User Created: ID=$target_id"

# 4. Admin User Detail verification
Write-Host "`n--- 4. Testing User Detail (Security & Stats) ---"
try {
    $detail = Invoke-RestMethod -Uri "http://localhost:8000/api/admin/users/$target_id" -Method Get -Headers @{"Authorization" = "Bearer $token" } -ErrorAction Stop
    
    # Check 1: Security (No password hash)
    if ($detail.profile.password_hash) {
        Write-Host "FAIL: password_hash leaked!" -ForegroundColor Red
    }
    else {
        Write-Host "PASS: password_hash excluded" -ForegroundColor Green
    }
    
    # Check 2: ID Serialization
    if ($detail.profile.id -is [string] -and $detail.profile.id.Length -gt 10) {
        Write-Host "PASS: profile.id is string" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL: profile.id is invalid type or empty" -ForegroundColor Red
    }

    # Check 3: Activity Stats
    if ($detail.activity_stats) {
        Write-Host "PASS: activity_stats present" -ForegroundColor Green
        # Write-Host "Stats: $($detail.activity_stats | ConvertTo-Json -Compress)"
    }
    else {
        Write-Host "FAIL: activity_stats missing" -ForegroundColor Red
    }
}
catch {
    Write-Host "FAIL: Detail error: $_" -ForegroundColor Red
}

# 5. Ban Action Verification
Write-Host "`n--- 5. Testing Ban Action ---"
try {
    # BAN
    $ban = Invoke-RestMethod -Uri "http://localhost:8000/api/admin/users/$target_id/actions/ban" -Method Post -Headers @{"Authorization" = "Bearer $token" } -ContentType "application/json" -Body '{"reason": "Verify Script Ban"}' -ErrorAction Stop
    Write-Host "Ban Action Status: $($ban.status)"

    # VERIFY BAN STATE
    $detail_banned = Invoke-RestMethod -Uri "http://localhost:8000/api/admin/users/$target_id" -Method Get -Headers @{"Authorization" = "Bearer $token" } -ErrorAction Stop
    if ($detail_banned.profile.is_banned -eq $true) {
        Write-Host "PASS: User is_banned=true in detail response" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL: User is_banned=false (Expected true)" -ForegroundColor Red
    }
}
catch {
    Write-Host "FAIL: Ban error: $_" -ForegroundColor Red
}

# 6. Unban & Reset Passes
Write-Host "`n--- 6. Testing Unban & Reset Passes ---"
try {
    # UNBAN
    $unban = Invoke-RestMethod -Uri "http://localhost:8000/api/admin/users/$target_id/actions/unban" -Method Post -Headers @{"Authorization" = "Bearer $token" } -ErrorAction Stop
    Write-Host "Unban Status: $($unban.status)"
    
    # RESET PASSES (Test remaining = 1)
    $reset = Invoke-RestMethod -Uri "http://localhost:8000/api/admin/users/$target_id/actions/reset-passes?count=1" -Method Post -Headers @{"Authorization" = "Bearer $token" } -ErrorAction Stop
    Write-Host "Reset Passes: $($reset.new_passes)"
    if ($reset.new_passes -eq 1) {
        Write-Host "PASS: Passes reset to 1" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL: Expected 1, got $($reset.new_passes)" -ForegroundColor Red
    }
}
catch {
    Write-Host "FAIL: Cleanup/Reset error: $_" -ForegroundColor Red
}

# 7. Unauthorized Access Check
Write-Host "`n--- 7. Testing Unauthorized Access ---"
try {
    # Use Temp User Token (Regular User) to access Admin Endpoint
    Invoke-RestMethod -Uri "http://localhost:8000/api/admin/metrics/overview" -Method Get -Headers @{"Authorization" = "Bearer $t_token" } -ErrorAction Stop
    Write-Host "FAIL: Regular user accessed admin metrics!" -ForegroundColor Red
}
catch {
    if ($_.Exception.Response.StatusCode -eq 403) {
        Write-Host "PASS: Blocked with 403 Forbidden" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL: Unexpected status code $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

Write-Host "`nDone."
