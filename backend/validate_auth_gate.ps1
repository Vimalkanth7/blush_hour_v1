$baseUrl = "http://localhost:8000"

# 1. Test Unauthenticated Request (No Header)
Write-Host "1. Testing /api/users/me without token..."
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Get -ErrorAction Stop
    Write-Error "FAIL: Should have failed with 401, but got success."
    exit 1
} catch {
    # Check if it is a 401
    if ($_.Exception.Response.StatusCode -eq [System.Net.HttpStatusCode]::Unauthorized) {
        Write-Host "SUCCESS: Got 401 Unauthorized as expected."
    } else {
        Write-Error "FAIL: Expected 401, got $($_.Exception.Response.StatusCode)"
        exit 1
    }
}

# 2. Test Invalid Token
Write-Host "`n2. Testing /api/users/me with invalid token..."
$invalidHeaders = @{ Authorization = "Bearer invalid.token.here" }
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Get -Headers $invalidHeaders -ErrorAction Stop
    Write-Error "FAIL: Should have failed with 401, but got success."
    exit 1
} catch {
    if ($_.Exception.Response.StatusCode -eq [System.Net.HttpStatusCode]::Unauthorized) {
        Write-Host "SUCCESS: Got 401 Unauthorized as expected."
    } else {
        Write-Error "FAIL: Expected 401, got $($_.Exception.Response.StatusCode)"
        exit 1
    }
}

# 3. Test Valid Login and Auth
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$phone = "+1222$timestamp"
$password = "SecureAuthTest!"

Write-Host "`n3. Registering/Logging in as $phone..."
$regBody = @{
    phone_number = $phone
    password = $password
} | ConvertTo-Json

try {
    $regResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $regBody -ContentType "application/json"
    $token = $regResponse.access_token
    Write-Host "Got Token."
} catch {
    Write-Error "Setup failed: $_"
    exit 1
}

# 4. Test Valid Token
Write-Host "`n4. Testing /api/users/me with valid token..."
$validHeaders = @{ Authorization = "Bearer $token" }
try {
    $me = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Get -Headers $validHeaders -ErrorAction Stop
    if ($me.phone_number -eq $phone) {
        Write-Host "SUCCESS: Retrieved user profile correctly."
    } else {
        Write-Error "FAIL: Retrieved profile but phone number mismatch."
    }
} catch {
    Write-Error "FAIL: Valid token request failed: $_"
    exit 1
}

Write-Host "`nValidation Complete: Backend is strictly enforcing auth."
