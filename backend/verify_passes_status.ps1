# 1. Setup - Create Users
Write-Host "--- 1. Creating Users ---"
$rand = Get-Random -Minimum 1000 -Maximum 9999
$male_phone = "112233$rand"
$female_phone = "445566$rand"

# Create Male
Invoke-RestMethod -Uri "http://localhost:8000/api/auth/register" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$male_phone`", `"password`": `"TestPass123!`"}" -ErrorAction SilentlyContinue | Out-Null
$m_login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$male_phone`", `"password`": `"TestPass123!`"}"
$m_token = $m_login.access_token
# Onboard Male (Include 4 photos to satisfy onboarding_completed=True)
Invoke-RestMethod -Uri "http://localhost:8000/api/users/me" -Method Patch -Headers @{"Authorization" = "Bearer $m_token" } -ContentType "application/json" -Body '{"firstName": "MaleTest", "gender": "Man", "birthday": "2000-01-01T00:00:00Z", "photos": ["http://ex.com/1.jpg", "http://ex.com/2.jpg", "http://ex.com/3.jpg", "http://ex.com/4.jpg"]}' -ErrorAction Stop | Out-Null

# Create Female
Invoke-RestMethod -Uri "http://localhost:8000/api/auth/register" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$female_phone`", `"password`": `"TestPass123!`"}" -ErrorAction SilentlyContinue | Out-Null
$f_login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body "{`"phone_number`": `"$female_phone`", `"password`": `"TestPass123!`"}"
$f_token = $f_login.access_token
# Onboard Female
Invoke-RestMethod -Uri "http://localhost:8000/api/users/me" -Method Patch -Headers @{"Authorization" = "Bearer $f_token" } -ContentType "application/json" -Body '{"firstName": "FemaleTest", "gender": "Woman", "birthday": "2000-01-01T00:00:00Z", "photos": ["http://ex.com/1.jpg", "http://ex.com/2.jpg", "http://ex.com/3.jpg", "http://ex.com/4.jpg"]}' -ErrorAction Stop | Out-Null

# 2. Verify Defaults
Write-Host "`n--- 2. Verify Defaults ---"

# Male Check (Expect 1)
$m_status = Invoke-RestMethod -Uri "http://localhost:8000/api/chat-night/status" -Method Get -Headers @{"Authorization" = "Bearer $m_token" }
Write-Host "Male Passes Total: $($m_status.passes_total_today)"
if ($m_status.passes_total_today -eq 1) {
    Write-Host "PASS: Male has 1 pass by default" -ForegroundColor Green
}
else {
    Write-Host "FAIL: Male has $($m_status.passes_total_today) passes (Expect 1)" -ForegroundColor Red
}

# Female Check (Expect 2)
$f_status = Invoke-RestMethod -Uri "http://localhost:8000/api/chat-night/status" -Method Get -Headers @{"Authorization" = "Bearer $f_token" }
Write-Host "Female Passes Total: $($f_status.passes_total_today)"
if ($f_status.passes_total_today -eq 2) {
    Write-Host "PASS: Female has 2 passes by default" -ForegroundColor Green
}
else {
    Write-Host "FAIL: Female has $($f_status.passes_total_today) passes (Expect 2)" -ForegroundColor Red
}

# 3. Verify Admin Reset
Write-Host "`n--- 3. Verify Admin Reset ---"
# Login Admin
Write-Host "Logging in Admin..."
try {
    $a_login = Invoke-RestMethod -Uri "http://localhost:8000/api/auth/login" -Method Post -ContentType "application/json" -Body '{"phone_number": "1111111111", "password": "TestPass123!"}' -ErrorAction Stop
    $a_token = $a_login.access_token
    Write-Host "Admin Logged In. Token: $($a_token.Substring(0, 10))..."
}
catch {
    Write-Host "FAIL: Admin Login Failed. Response:"
    $_ | Select-Object *
    exit
}

# Get Male ID (using /me with m_token logic from prev scripts or searching)
# Easier: Just use the m_login response if we had id? We don't. Call /me
# Get Male ID
$m_me = Invoke-RestMethod -Uri "http://localhost:8000/api/users/me" -Method Get -Headers @{"Authorization" = "Bearer $m_token" }
$m_id = $m_me.id
if (-not $m_id) { $m_id = $m_me._id }
Write-Host "Male ID: $m_id"

# Reset Male to 5
Invoke-RestMethod -Uri "http://localhost:8000/api/admin/users/$m_id/actions/reset-passes?count=5" -Method Post -Headers @{"Authorization" = "Bearer $a_token" } | Out-Null
Write-Host "Reset Male to 5"

# Check Status Again
$m_status_new = Invoke-RestMethod -Uri "http://localhost:8000/api/chat-night/status" -Method Get -Headers @{"Authorization" = "Bearer $m_token" }
Write-Host "Male New Remaining: $($m_status_new.passes_remaining_today)"

if ($m_status_new.passes_remaining_today -eq 5) {
    Write-Host "PASS: Male now has 5 remaining" -ForegroundColor Green
}
else {
    Write-Host "FAIL: Male has $($m_status_new.passes_remaining_today) remaining (Expect 5)" -ForegroundColor Red
}
