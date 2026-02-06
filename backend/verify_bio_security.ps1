$baseUrl = "http://localhost:8000"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$phone = "+1999$timestamp"
$password = "SecretBio123!"

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

# 1. Update Bio
Write-Host "`n1. Updating Bio..."
$patchBody = @{
    bio = "This is my cool bio."
    firstName = "SecurityTest"
    birthday = "1999-09-09"
    gender = "Non-binary"
} | ConvertTo-Json

$me = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $patchBody -ContentType "application/json"

# Check Bio
if ($me.bio -eq "This is my cool bio.") {
    Write-Host "SUCCESS: Bio persisted and returned."
} else {
    Write-Error "FAIL: Bio mismatch. Got: '$($me.bio)'"
}

# Check Password Hash
if ($me.password_hash) {
    Write-Error "FAIL: password_hash SHOULD NOT be present in PATCH response."
} else {
    Write-Host "SUCCESS: password_hash absent from PATCH response."
}

# 2. Get Bio
Write-Host "`n2. Getting Profile..."
$meGet = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Get -Headers $headers

if ($meGet.bio -eq "This is my cool bio.") {
    Write-Host "SUCCESS: Bio persisted and returned in GET."
} else {
    Write-Error "FAIL: Bio mismatch in GET. Got: '$($meGet.bio)'"
}

if ($meGet.password_hash) {
    Write-Error "FAIL: password_hash SHOULD NOT be present in GET response."
} else {
    Write-Host "SUCCESS: password_hash absent from GET response."
}

Write-Host "`nDone."
