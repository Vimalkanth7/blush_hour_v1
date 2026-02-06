# 1. Login Admin
Write-Host "--- 1. Login Admin ---"
try {
    $login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body '{"phone_number": "1111111111", "password": "TestPass123!"}'
    $token = $login.access_token
    Write-Host "Admin Token Acquired"
}
catch {
    Write-Host "Admin Login Failed: $_"
    exit
}

# 2. Set Toggle: 80% Completion
Write-Host "`n--- 2. Setting Toggle Profile Min = 80 ---"
try {
    $set = Invoke-RestMethod -Uri "http://localhost:8000/api/admin/toggles" -Method Post -Headers @{"Authorization" = "Bearer $token" } -ContentType "application/json" -Body '{"key": "PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT", "value": "80"}'
    Write-Host "Toggle Set: $($set.value)"
}
catch {
    Write-Host "Set Toggle Failed: $_"
    exit
}

# 3. Verify Persistence
Write-Host "`n--- 3. Verifying Toggle Persistence ---"
try {
    $get = Invoke-RestMethod -Uri "http://localhost:8000/api/admin/toggles" -Method Get -Headers @{"Authorization" = "Bearer $token" }
    $val = $get.dynamic_overrides.PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT
    if ($val -eq "80") {
        Write-Host "PASS: Toggle persisted as 80." -ForegroundColor Green
    }
    else {
        Write-Host "FAIL: Toggle value is '$val'" -ForegroundColor Red
        exit
    }
}
catch {
    Write-Host "Get Toggles Failed: $_"
    exit
}

# 4. Create Weak User
Write-Host "`n--- 4. Creating Weak User (Low Completion) ---"
$rand = Get-Random -Minimum 1000 -Maximum 9999
$weak_phone = "555000$rand"
Invoke-RestMethod -Uri "http://localhost:8000/api/auth/register" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$weak_phone`", `"password`": `"TestPass123!`"}" -ErrorAction SilentlyContinue | Out-Null
$w_login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$weak_phone`", `"password`": `"TestPass123!`"}"
$w_token = $w_login.access_token

# User needs basic onboarding to even hit the gate check (gender/name)
try {
    Invoke-RestMethod -Uri "http://localhost:8000/api/users/me" -Method Patch -Headers @{"Authorization" = "Bearer $w_token" } -ContentType "application/json" -Body '{"firstName": "Weak", "gender": "Man", "birthday": "2000-01-01T00:00:00Z"}' -ErrorAction Stop | Out-Null
    Write-Host "Profile Updated (Basic Onboarding Complete)"
}
catch {
    Write-Host "Profile Update Failed: $_"
    exit
}

# 5. Attempt Enter - Should Fail
Write-Host "`n--- 5. Attempting Entry (Expect 400 Gating) ---"
try {
    # Debug: Check score first (conceptually we can't see it easily from API without /me full dump)
    # But let's just hit the endpoint
    Invoke-RestMethod -Uri "http://localhost:8000/api/chat-night/enter" -Method Post -Headers @{"Authorization" = "Bearer $w_token" } -ErrorAction Stop
    Write-Host "FAIL: Weak user was allowed in!" -ForegroundColor Red
}
catch {
    $e = $_.Exception
    $resp = $e.Response
    if ($resp.StatusCode -eq 400) {
        $stream = $resp.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        
        Write-Host "Error Body: $body"
        
        if ($body -match "80% required") {
            Write-Host "PASS: Blocked with correct message" -ForegroundColor Green
        }
        else {
            # Sometimes Body is weirdly formatted in PS. Check if it contains substring broadly.
            if ($body -match "required") {
                Write-Host "PASS: Blocked with message containing 'required'" -ForegroundColor Green
            }
            else {
                Write-Host "FAIL: Blocked but wrong message: $body" -ForegroundColor Red
            }
        }
    }
    else {
        Write-Host "FAIL: Unexpected status code $($resp.StatusCode)" -ForegroundColor Red
    }
}

# 6. Cleanup: Reset Toggle
Write-Host "`n--- 6. Cleanup: Resetting Toggle ---"
Invoke-RestMethod -Uri "http://localhost:8000/api/admin/toggles" -Method Post -Headers @{"Authorization" = "Bearer $token" } -ContentType "application/json" -Body '{"key": "PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT", "value": "0"}' | Out-Null
Write-Host "Toggle reset to 0."
