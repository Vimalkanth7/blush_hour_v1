$baseUrl = "http://localhost:8000"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$phone = "+1887$timestamp"
$password = "ProfileStrength123!"

Write-Host "1. Registering user $phone..."
$regBody = @{
    phone_number = $phone
    password = $password
} | ConvertTo-Json

try {
    $regResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $regBody -ContentType "application/json"
    $token = $regResponse.access_token
    Write-Host "   Got Token."
} catch {
    Write-Error "   Registration failed: $_"
    exit 1
}

$headers = @{ Authorization = "Bearer $token" }

function Assert-ProfileStrength {
    param(
        [Parameter(Mandatory = $true)] $me,
        [Parameter(Mandatory = $true)] [string] $label
    )

    if ($null -eq $me.profile_strength) {
        Write-Error "profile_strength missing for $label."
        exit 1
    }

    $ps = $me.profile_strength

    if ($null -eq $ps.completion_percent) {
        Write-Error "completion_percent missing for $label."
        exit 1
    }

    if (-not ($ps.completion_percent -is [int] -or $ps.completion_percent -is [long])) {
        Write-Error "completion_percent is not an integer for $label."
        exit 1
    }

    if ($ps.completion_percent -lt 0 -or $ps.completion_percent -gt 100) {
        Write-Error "completion_percent out of range for $label."
        exit 1
    }

    $validTiers = @("Bronze", "Silver", "Gold")
    if ($validTiers -notcontains $ps.tier) {
        Write-Error "tier is invalid for $label."
        exit 1
    }

    if ($null -eq $ps.missing_fields -or -not ($ps.missing_fields -is [System.Array])) {
        Write-Error "missing_fields is not an array for $label."
        exit 1
    }
}

function Get-Me {
    return Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Get -Headers $headers
}

Write-Host "2. Checking profile_strength on new user (low completion)..."
$me = Get-Me
Assert-ProfileStrength $me "new user GET"
$initialScore = $me.profile_strength.completion_percent
Write-Host "   Initial completion_percent: $initialScore"

Write-Host "3. Verifying list fields can be empty arrays (legacy-safe)..."
$emptyListsPatch = @{
    interests = @()
    values = @()
    prompts = @()
} | ConvertTo-Json -Depth 5
$patchResponse = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $emptyListsPatch -ContentType "application/json"
Assert-ProfileStrength $patchResponse "empty-lists PATCH"
$me = Get-Me
Assert-ProfileStrength $me "empty-lists GET"

Write-Host "4. Completing onboarding (base + extras)..."
$completePatch = @{
    firstName = "StrengthTester"
    birthday = "1990-01-01"
    gender = "Woman"
    photos = @("p1", "p2", "p3", "p4")
    bio = "Hello from profile strength verification."
    prompts = @(@{ question = "Q1"; answer = "A1" })
    work = "Engineer"
    location = "Austin"
    educationLevel = "Bachelors"
    starSign = "Leo"
    height = "170cm"
    interests = @("Music", "Art", "Hiking")
} | ConvertTo-Json -Depth 6

$patchResponse = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $completePatch -ContentType "application/json"
Assert-ProfileStrength $patchResponse "completed PATCH"
$me = Get-Me
Assert-ProfileStrength $me "completed GET"
$finalScore = $me.profile_strength.completion_percent
Write-Host "   Final completion_percent: $finalScore"

if ($finalScore -le $initialScore) {
    Write-Error "completion_percent did not increase after onboarding."
    exit 1
}

Write-Host "`nPASS: profile_strength contract verified."
