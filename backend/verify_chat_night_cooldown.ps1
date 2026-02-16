$baseUrl = "http://localhost:8000"
$chatNightBase = "$baseUrl/api/chat-night"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$password = "ChatNightTest123!"

$env:CHAT_NIGHT_TEST_MODE = "true"
$env:CHAT_NIGHT_PAIR_COOLDOWN_MINUTES = "60"

function Register-User {
    param(
        [Parameter(Mandatory = $true)] [string] $phone,
        [Parameter(Mandatory = $true)] [string] $label
    )

    Write-Host "Registering $label user $phone..."
    $regBody = @{
        phone_number = $phone
        password = $password
    } | ConvertTo-Json

    try {
        $regResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $regBody -ContentType "application/json"
        return $regResponse.access_token
    } catch {
        Write-Error "Registration failed for ${label}: $_"
        exit 1
    }
}

function Patch-Profile {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $gender,
        [Parameter(Mandatory = $true)] [string] $firstName
    )

    $headers = @{ Authorization = "Bearer $token" }
    $patchBody = @{
        firstName = $firstName
        birthday = "1990-01-01"
        gender = $gender
        photos = @("p1", "p2", "p3", "p4")
        bio = "Cooldown test profile."
        prompts = @(@{ question = "Q1"; answer = "A1" })
        work = "Engineer"
        location = "Austin"
        educationLevel = "Bachelors"
        starSign = "Leo"
        height = "170cm"
        interests = @("Music", "Art", "Hiking")
    } | ConvertTo-Json -Depth 6

    try {
        $null = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $patchBody -ContentType "application/json"
    } catch {
        Write-Error "Profile patch failed: $_"
        exit 1
    }
}

function Get-ChatNight-Status {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $headers = @{ Authorization = "Bearer $token" }
    try {
        return Invoke-RestMethod -Uri "$chatNightBase/status" -Method Get -Headers $headers
    } catch {
        Write-Error "Chat night status failed for ${label}: $_"
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
    } catch {
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
    } catch {
        Write-Error "Chat night leave failed for ${label}: $_"
        exit 1
    }
}

function Engage-Room {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $roomId,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $headers = @{ Authorization = "Bearer $token" }
    $body = @{ room_id = $roomId } | ConvertTo-Json
    try {
        $null = Invoke-RestMethod -Uri "$chatNightBase/engage" -Method Post -Headers $headers -Body $body -ContentType "application/json"
    } catch {
        Write-Error "Engage failed for ${label}: $_"
        exit 1
    }
}

function Run-Cooldown-Test {
    param(
        [Parameter(Mandatory = $true)] [string] $label,
        [Parameter(Mandatory = $true)] [string] $v5Enabled,
        [Parameter(Mandatory = $true)] [string] $malePhone,
        [Parameter(Mandatory = $true)] [string] $femalePhone
    )

    Write-Host "`n== $label =="
    $env:CHAT_NIGHT_V5_MATCHING_ENABLED = $v5Enabled

    $maleToken = Register-User $malePhone "$label male"
    $femaleToken = Register-User $femalePhone "$label female"

    Patch-Profile $maleToken "Man" "CooldownMale"
    Patch-Profile $femaleToken "Woman" "CooldownFemale"

    $maleStatus = Get-ChatNight-Status $maleToken "$label male"
    if ($maleStatus.passes_total -lt 2) {
        Write-Error "Insufficient passes for cooldown test (passes_total=$($maleStatus.passes_total)). Start backend with CHAT_NIGHT_TEST_PASSES >= 2."
        exit 1
    }

    Write-Host "First match (expect queued then match_found)..."
    $firstEnterMale = Enter-ChatNight $maleToken "$label male enter 1"
    if ($firstEnterMale.status -ne "queued") {
        Write-Error "Expected male queued on first enter. Got: $($firstEnterMale.status)"
        exit 1
    }

    $firstEnterFemale = Enter-ChatNight $femaleToken "$label female enter 1"
    if ($firstEnterFemale.status -ne "match_found") {
        Write-Error "Expected female match_found on first enter. Got: $($firstEnterFemale.status)"
        exit 1
    }

    $roomId = $firstEnterFemale.room_id
    if (-not $roomId) {
        Write-Error "Missing room_id on match_found response."
        exit 1
    }

    Engage-Room $maleToken $roomId "$label male engage"
    Engage-Room $femaleToken $roomId "$label female engage"

    Leave-ChatNight $maleToken "$label male leave"
    Leave-ChatNight $femaleToken "$label female leave"

    Write-Host "Second match attempt (expect queued due to cooldown)..."
    $secondEnterMale = Enter-ChatNight $maleToken "$label male enter 2"
    if ($secondEnterMale.status -ne "queued") {
        Write-Error "Expected male queued on second enter. Got: $($secondEnterMale.status)"
        exit 1
    }

    $secondEnterFemale = Enter-ChatNight $femaleToken "$label female enter 2"
    if ($secondEnterFemale.status -eq "match_found") {
        Write-Error "Cooldown failed: second match returned match_found."
        exit 1
    }

    if ($secondEnterFemale.status -ne "queued") {
        Write-Error "Expected female queued on second enter. Got: $($secondEnterFemale.status)"
        exit 1
    }

    Leave-ChatNight $maleToken "$label male leave 2"
    Leave-ChatNight $femaleToken "$label female leave 2"

    Write-Host "Cooldown enforced for $label."
}

$fifoMale = "+1777$timestamp"
$fifoFemale = "+1778$timestamp"
$v5Male = "+1779$timestamp"
$v5Female = "+1780$timestamp"

Run-Cooldown-Test "FIFO" "false" $fifoMale $fifoFemale
Write-Host "`nWaiting 65s to avoid chat night enter rate limit..."
Start-Sleep -Seconds 65
Run-Cooldown-Test "V5" "true" $v5Male $v5Female

Write-Host "`nPASS: cooldown guard verified"
