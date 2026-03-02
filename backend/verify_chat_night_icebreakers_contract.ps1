$baseUrl = "http://localhost:8000"
$chatNightBase = "$baseUrl/api/chat-night"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$password = "ChatNightTest123!"

Write-Host "===================================================" -ForegroundColor Yellow
Write-Host " CHAT NIGHT ICEBREAKERS CONTRACT VERIFIER (W6-B1)  " -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "Target Base URL: $baseUrl" -ForegroundColor Cyan

try {
    Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -ErrorAction Stop | Out-Null
    Write-Host "Server Check: OK (Backend is Running)" -ForegroundColor Green
}
catch {
    Write-Error "Server Unreachable at $baseUrl. Is uvicorn running?"
    exit 1
}

function Register-User {
    param(
        [Parameter(Mandatory = $true)] [string] $phone,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $regBody = @{
        phone_number = $phone
        password = $password
    } | ConvertTo-Json

    for ($attempt = 1; $attempt -le 2; $attempt++) {
        try {
            $regResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $regBody -ContentType "application/json"
            return $regResponse.access_token
        }
        catch {
            $errText = ($_ | Out-String)
            if ($errText -match "Rate limit exceeded") {
                Write-Host "Registration rate limit hit for ${label}. Waiting 65s and retrying..." -ForegroundColor Yellow
                Start-Sleep -Seconds 65
                continue
            }
            Write-Error "Registration failed for ${label}: $_"
            exit 1
        }
    }

    Write-Error "Registration failed for ${label} after retry."
    exit 1
}

function Patch-Profile {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $gender,
        [Parameter(Mandatory = $true)] [string] $firstName,
        [Parameter(Mandatory = $true)] [hashtable] $profileData
    )

    $headers = @{ Authorization = "Bearer $token" }
    $patchBody = @{
        firstName = $firstName
        birthday = "1996-06-15"
        gender = $gender
        photos = @("p1", "p2", "p3", "p4")
        bio = "Icebreaker contract verification profile."
        prompts = $profileData.prompts
        interests = $profileData.interests
        values = $profileData.values
        languages = $profileData.languages
        habits = $profileData.habits
        intention = $profileData.intention
    } | ConvertTo-Json -Depth 6

    try {
        $null = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $patchBody -ContentType "application/json"
    }
    catch {
        Write-Error "Profile patch failed: $_"
        exit 1
    }
}

function Enter-ChatNight {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $headers = @{ Authorization = "Bearer $token" }
    try {
        return Invoke-RestMethod -Uri "$chatNightBase/enter" -Method Post -Headers $headers
    }
    catch {
        Write-Error "Chat night enter failed for ${label}: $_"
        exit 1
    }
}

function Leave-ChatNight {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $headers = @{ Authorization = "Bearer $token" }
    try {
        $null = Invoke-RestMethod -Uri "$chatNightBase/leave" -Method Post -Headers $headers
    }
    catch {
        Write-Host "Cleanup warning for ${label}: $_" -ForegroundColor DarkGray
    }
}

function Get-My-Room {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $headers = @{ Authorization = "Bearer $token" }
    try {
        return Invoke-RestMethod -Uri "$chatNightBase/my-room" -Method Get -Headers $headers
    }
    catch {
        Write-Error "Chat night my-room failed for ${label}: $_"
        exit 1
    }
}

function Wait-For-RoomId {
    param(
        [Parameter(Mandatory = $true)] [string] $tokenA,
        [Parameter(Mandatory = $true)] [string] $tokenB,
        [int] $retries = 8,
        [int] $delaySeconds = 2
    )

    for ($i = 0; $i -lt $retries; $i++) {
        $roomA = Get-My-Room $tokenA "user_a"
        if ($roomA.room_id) {
            return $roomA.room_id
        }

        $roomB = Get-My-Room $tokenB "user_b"
        if ($roomB.room_id) {
            return $roomB.room_id
        }

        Start-Sleep -Seconds $delaySeconds
    }

    return $null
}

function Assert-NoObviousPii {
    param(
        [Parameter(Mandatory = $true)] [string[]] $lines,
        [Parameter(Mandatory = $true)] [string] $fieldName
    )

    $emailPattern = '(?i)[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
    $phonePattern = '(?:\+?\d[\d\-\s\(\)]{6,}\d)'
    $handlePattern = '(?<!\w)@[A-Za-z0-9_]{2,}'

    foreach ($line in $lines) {
        if ($line -match $emailPattern) {
            Write-Error "PII check failed (${fieldName}): email pattern detected in '$line'"
            exit 1
        }
        if ($line -match $phonePattern) {
            Write-Error "PII check failed (${fieldName}): phone pattern detected in '$line'"
            exit 1
        }
        if ($line -match $handlePattern) {
            Write-Error "PII check failed (${fieldName}): handle pattern detected in '$line'"
            exit 1
        }
    }
}

$maleToken = $null
$femaleToken = $null

try {
    $malePhone = "+1901$timestamp"
    $femalePhone = "+1902$timestamp"

    $maleToken = Register-User $malePhone "male"
    $femaleToken = Register-User $femalePhone "female"

    $maleProfile = @{
        interests = @("coffee", "hiking", "music")
        values = @("growth", "kindness")
        languages = @("English", "Spanish")
        habits = @{ drinking = "sometimes"; smoking = "no"; exercise = "yes"; kids = "maybe" }
        prompts = @(@{ question = "A perfect Sunday looks like?"; answer = "Slow brunch and a walk." })
        intention = "relationship"
    }

    $femaleProfile = @{
        interests = @("coffee", "travel", "music")
        values = @("growth", "humor")
        languages = @("English")
        habits = @{ drinking = "sometimes"; smoking = "no"; exercise = "yes"; kids = "maybe" }
        prompts = @(@{ question = "My simple pleasure"; answer = "Fresh coffee in the morning." })
        intention = "relationship"
    }

    Patch-Profile $maleToken "Man" "IceA$timestamp" $maleProfile
    Patch-Profile $femaleToken "Woman" "IceB$timestamp" $femaleProfile

    $enterMale = Enter-ChatNight $maleToken "male"
    $enterFemale = Enter-ChatNight $femaleToken "female"

    $roomId = $null
    if ($enterMale.room_id) { $roomId = $enterMale.room_id }
    if (-not $roomId -and $enterFemale.room_id) { $roomId = $enterFemale.room_id }
    if (-not $roomId) {
        $roomId = Wait-For-RoomId $maleToken $femaleToken
    }

    if (-not $roomId) {
        Write-Error "Failed to resolve room_id from enter/my-room flow."
        exit 1
    }

    $headers = @{ Authorization = "Bearer $maleToken" }
    $reqBody = @{ room_id = $roomId } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$chatNightBase/icebreakers" -Method Post -Headers $headers -Body $reqBody -ContentType "application/json"

    $reasonsCount = @($response.reasons).Count
    $icebreakersCount = @($response.icebreakers).Count

    if ($reasonsCount -ne 3) {
        Write-Error "Expected 3 reasons, got $reasonsCount"
        exit 1
    }
    if ($icebreakersCount -ne 5) {
        Write-Error "Expected 5 icebreakers, got $icebreakersCount"
        exit 1
    }

    if (-not ($response.PSObject.Properties.Name -contains "model")) {
        Write-Error "Response missing 'model' field."
        exit 1
    }
    if (-not ($response.PSObject.Properties.Name -contains "cached")) {
        Write-Error "Response missing 'cached' field."
        exit 1
    }

    $linesToCheck = @()
    $linesToCheck += @($response.reasons)
    $linesToCheck += @($response.icebreakers)
    Assert-NoObviousPii -lines $linesToCheck -fieldName "reasons+icebreakers"

    Write-Host "PASS: chat night icebreakers contract verified" -ForegroundColor Green
    Write-Host "Room: $roomId"
    Write-Host "Reasons: $reasonsCount | Icebreakers: $icebreakersCount | model=$($response.model) | cached=$($response.cached)"
}
finally {
    if ($maleToken) { Leave-ChatNight $maleToken "male" }
    if ($femaleToken) { Leave-ChatNight $femaleToken "female" }
}
