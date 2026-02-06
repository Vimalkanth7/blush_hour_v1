$baseUrl = "http://localhost:8000"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$phone = "+1555$timestamp"
$password = "Secret123!"

Write-Host "Registering user $phone..."
$regBody = @{
    phone_number = $phone
    password = $password
} | ConvertTo-Json

try {
    $regResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $regBody -ContentType "application/json"
    $token = $regResponse.access_token
    Write-Host "Registered. Token: $token"
} catch {
    Write-Error "Registration failed: $_"
    exit 1
}

$headers = @{
    Authorization = "Bearer $token"
}

# 1. Check initial state
Write-Host "`n1. Checking initial state..."
$me = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Get -Headers $headers
Write-Host "Initial onboarding_completed: $($me.onboarding_completed)"
if ($me.onboarding_completed -eq $true) { Write-Error "Should be false initially" }

# 2. Patch with basic info but NO photos
Write-Host "`n2. Patching basic info (no photos)..."
$patchBody = @{
    firstName = "TestUser"
    birthday = "2000-01-01"
    gender = "Non-binary"
} | ConvertTo-Json

$me = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $patchBody -ContentType "application/json"
Write-Host "After basic patch, onboarding_completed: $($me.onboarding_completed)"
if ($me.onboarding_completed -eq $true) { Write-Error "Should be false due to missing photos" }

# 3. Patch with 3 photos (still insufficient)
Write-Host "`n3. Patching with 3 photos..."
$patchBodyPhotos3 = @{
    photos = @("p1", "p2", "p3")
} | ConvertTo-Json

$me = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $patchBodyPhotos3 -ContentType "application/json"
Write-Host "After 3 photos, onboarding_completed: $($me.onboarding_completed)"
if ($me.onboarding_completed -eq $true) { Write-Error "Should be false (need 4)" }

# 4. Patch with 4 photos
Write-Host "`n4. Patching with 4 photos..."
$patchBodyPhotos4 = @{
    photos = @("p1", "p2", "p3", "p4")
} | ConvertTo-Json

$me = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $patchBodyPhotos4 -ContentType "application/json"
Write-Host "After 4 photos, onboarding_completed: $($me.onboarding_completed)"
if ($me.onboarding_completed -ne $true) { Write-Error "Should be true now!" }

Write-Host "`nDone."
