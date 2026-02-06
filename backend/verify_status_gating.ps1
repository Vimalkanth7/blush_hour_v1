# 1. Login Admin to Set Toggle
Write-Host "--- 1. Set Toggle 80% ---"
try {
    $login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body '{"phone_number": "1111111111", "password": "TestPass123!"}' -ErrorAction Stop
    $token = $login.access_token
    Invoke-RestMethod -Uri "http://localhost:8000/api/admin/toggles" -Method Post -Headers @{"Authorization" = "Bearer $token" } -ContentType "application/json" -Body '{"key": "PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT", "value": "80"}' | Out-Null
    Write-Host "Toggle set to 80"
}
catch {
    Write-Host "FAIL: Setup failed"
    exit
}

# 2. Create User (~60% score - Name/Gender only)
Write-Host "`n--- 2. Create Weak User ---"
$rand = Get-Random -Minimum 1000 -Maximum 9999
$u_phone = "881188$rand"
Invoke-RestMethod -Uri "http://localhost:8000/api/auth/register" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$u_phone`", `"password`": `"TestPass123!`"}" -ErrorAction SilentlyContinue | Out-Null
$u_login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$u_phone`", `"password`": `"TestPass123!`"}"
$u_token = $u_login.access_token

# Basic profile (Gender, Name, DOB) -> ~30-40% 
Invoke-RestMethod -Uri "http://localhost:8000/api/users/me" -Method Patch -Headers @{"Authorization" = "Bearer $u_token" } -ContentType "application/json" -Body '{"firstName": "TestUser", "gender": "Man", "birthday": "2000-01-01T00:00:00Z"}' -ErrorAction Stop | Out-Null
Write-Host "User created and onboarded"

# 3. Check Status - Should be GATED (200 OK)
Write-Host "`n--- 3. Verify Status Gated ---"
try {
    $status = Invoke-RestMethod -Uri "http://localhost:8000/api/chat-night/status" -Method Get -Headers @{"Authorization" = "Bearer $u_token" } -ErrorAction Stop
    
    Write-Host "Status: $($status.status)"
    Write-Host "Detail: $($status.detail)"
    Write-Host "User Score: $($status.user_completion)"
    Write-Host "Min Score: $($status.min_completion)"
    
    if ($status.status -eq "gated") {
        Write-Host "PASS: Status is 'gated'" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL: Status is '$($status.status)'" -ForegroundColor Red
    }
    
    if ($status.user_completion -lt 80) {
        Write-Host "PASS: User completion correctly returned" -ForegroundColor Green
    }
}
catch {
    Write-Host "FAIL: Error calling status: $_" -ForegroundColor Red
}

# 4. Cleanup
Write-Host "`n--- 4. Cleanup ---"
Invoke-RestMethod -Uri "http://localhost:8000/api/admin/toggles" -Method Post -Headers @{"Authorization" = "Bearer $token" } -ContentType "application/json" -Body '{"key": "PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT", "value": "0"}' | Out-Null
Write-Host "Toggle reset"
