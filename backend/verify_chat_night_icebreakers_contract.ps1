$baseUrl = if ([string]::IsNullOrWhiteSpace($env:CHAT_NIGHT_BASE_URL)) { "http://localhost:8000" } else { $env:CHAT_NIGHT_BASE_URL.TrimEnd("/") }
$chatNightBase = "$baseUrl/api/chat-night"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$password = "ChatNightTest123!"

Write-Host "===================================================" -ForegroundColor Yellow
Write-Host " CHAT NIGHT ICEBREAKERS CONTRACT VERIFIER (W6-B3)  " -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "Target Base URL: $baseUrl" -ForegroundColor Cyan

$provider = if ([string]::IsNullOrWhiteSpace($env:CHAT_NIGHT_ICEBREAKERS_PROVIDER)) { "none" } else { $env:CHAT_NIGHT_ICEBREAKERS_PROVIDER.ToLower() }
$apiKeyPresent = -not [string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)
$configuredModel = if ([string]::IsNullOrWhiteSpace($env:CHAT_NIGHT_ICEBREAKERS_MODEL)) { "gpt-4o-mini" } else { $env:CHAT_NIGHT_ICEBREAKERS_MODEL }
$expectOpenAi = ($provider -eq "openai" -and $apiKeyPresent)

function Get-EnvIntOrDefault {
    param(
        [Parameter(Mandatory = $true)] [string] $name,
        [Parameter(Mandatory = $true)] [int] $defaultValue
    )
    $raw = [System.Environment]::GetEnvironmentVariable($name)
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $defaultValue
    }
    $parsed = 0
    if ([int]::TryParse($raw, [ref]$parsed)) {
        return $parsed
    }
    return $defaultValue
}

$maxCallsPerDay = Get-EnvIntOrDefault -name "CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_DAY" -defaultValue 20
$maxCallsPerUserPerDay = Get-EnvIntOrDefault -name "CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_USER_PER_DAY" -defaultValue 20
$maxCallsPerRoom = Get-EnvIntOrDefault -name "CHAT_NIGHT_ICEBREAKERS_MAX_CALLS_PER_ROOM" -defaultValue 1
$minSecondsBetweenCalls = Get-EnvIntOrDefault -name "CHAT_NIGHT_ICEBREAKERS_MIN_SECONDS_BETWEEN_OPENAI_CALLS" -defaultValue 3
$guardrailDailyCapMode = ($expectOpenAi -and $maxCallsPerDay -le 0)

Write-Host "Expected Mode: provider=$provider api_key_present=$apiKeyPresent expected_model=$configuredModel" -ForegroundColor DarkCyan
Write-Host "Guardrails: max_calls_day=$maxCallsPerDay max_calls_user_day=$maxCallsPerUserPerDay max_calls_room=$maxCallsPerRoom min_seconds_between=$minSecondsBetweenCalls" -ForegroundColor DarkCyan
if ($guardrailDailyCapMode) {
    Write-Host "Guardrail Scenario: DAILY CAP BLOCK (expect fallback/none on first call, cached=false)." -ForegroundColor Yellow
}

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

function Assert-Icebreakers-Shape {
    param(
        [Parameter(Mandatory = $true)] $response,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $reasonsCount = @($response.reasons).Count
    $icebreakersCount = @($response.icebreakers).Count

    if ($reasonsCount -ne 3) {
        Write-Error "${label}: Expected 3 reasons, got $reasonsCount"
        exit 1
    }
    if ($icebreakersCount -ne 5) {
        Write-Error "${label}: Expected 5 icebreakers, got $icebreakersCount"
        exit 1
    }
    if (-not ($response.PSObject.Properties.Name -contains "model")) {
        Write-Error "${label}: Response missing 'model' field."
        exit 1
    }
    if (-not ($response.PSObject.Properties.Name -contains "cached")) {
        Write-Error "${label}: Response missing 'cached' field."
        exit 1
    }

    $linesToCheck = @()
    $linesToCheck += @($response.reasons)
    $linesToCheck += @($response.icebreakers)
    Assert-NoObviousPii -lines $linesToCheck -fieldName "$label reasons+icebreakers"
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
    $responseCached = Invoke-RestMethod -Uri "$chatNightBase/icebreakers" -Method Post -Headers $headers -Body $reqBody -ContentType "application/json"

    Assert-Icebreakers-Shape -response $response -label "first_call"
    Assert-Icebreakers-Shape -response $responseCached -label "second_call"

    if ($guardrailDailyCapMode) {
        if (($response.model -ne "fallback") -and ($response.model -ne "none")) {
            Write-Error "Guardrail mode expected model 'fallback' or 'none', got '$($response.model)'."
            exit 1
        }
        if ($response.cached -ne $false) {
            Write-Error "Guardrail mode expected first call cached=false, got '$($response.cached)'."
            exit 1
        }
    }
    elseif ($expectOpenAi) {
        if ($response.model -ne $configuredModel) {
            Write-Error "OpenAI mode expected model '$configuredModel', got '$($response.model)'."
            exit 1
        }
    }
    else {
        if ($response.model -ne "none") {
            Write-Error "Deterministic mode expected model 'none', got '$($response.model)'."
            exit 1
        }
    }

    if ($responseCached.cached -ne $true) {
        Write-Error "Expected second call to be cached=true, got '$($responseCached.cached)'."
        exit 1
    }

    Write-Host "PASS: chat night icebreakers contract verified (W6-B3)" -ForegroundColor Green
    Write-Host "Room: $roomId"
    Write-Host "First call: model=$($response.model) | cached=$($response.cached)"
    Write-Host "Second call: model=$($responseCached.model) | cached=$($responseCached.cached)"
}
finally {
    if ($maleToken) { Leave-ChatNight $maleToken "male" }
    if ($femaleToken) { Leave-ChatNight $femaleToken "female" }
}
