$baseUrl = "http://localhost:8000"
$chatNightBase = "$baseUrl/api/chat-night"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$password = "ChatNightTest123!"

$env:CHAT_NIGHT_TEST_MODE = "true"
$env:CHAT_NIGHT_FORCE_OPEN = "true"
$env:CHAT_NIGHT_TEST_PASSES = "5"
$env:CHAT_NIGHT_WAITTIME_BOOST_ENABLED = "true"
$env:CHAT_NIGHT_WAITTIME_BOOST_STEP_SECONDS = "30"
$env:CHAT_NIGHT_WAITTIME_BOOST_MAX_POINTS = "15"
$env:CHAT_NIGHT_V5_MIN_SCORE = "0"

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
        bio = "Fairness test profile."
        prompts = @(@{ question = "Q1"; answer = "A1" })
        work = "Engineer"
        location = "Austin"
        educationLevel = "Bachelors"
        starSign = "Leo"
        height = "170cm"
        interests = @("Music", "Art", "Hiking")
        values = @("Honesty", "Humor")
        languages = @("English")
        habits = @{ drinking = "sometimes"; smoking = "no"; exercise = "yes"; kids = "maybe" }
    } | ConvertTo-Json -Depth 6

    try {
        $null = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $patchBody -ContentType "application/json"
    } catch {
        Write-Error "Profile patch failed: $_"
        exit 1
    }
}

function Get-UserId {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $headers = @{ Authorization = "Bearer $token" }
    try {
        $me = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Get -Headers $headers
        if ($me.id) { return $me.id }
        if ($me._id) { return $me._id }
        if ($me.user_id) { return $me.user_id }
        return $null
    } catch {
        Write-Error "Get /users/me failed for ${label}: $_"
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

function Get-My-Room {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $headers = @{ Authorization = "Bearer $token" }
    try {
        return Invoke-RestMethod -Uri "$chatNightBase/my-room" -Method Get -Headers $headers
    } catch {
        Write-Error "Chat night my-room failed for ${label}: $_"
        exit 1
    }
}

function Wait-For-My-Room {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $label,
        [int] $retries = 5,
        [int] $delaySeconds = 2
    )

    for ($i = 0; $i -lt $retries; $i++) {
        $room = Get-My-Room $token $label
        if ($room.state -ne "none" -and $room.partner_user_id) {
            return $room
        }
        Start-Sleep -Seconds $delaySeconds
    }

    Write-Error "Room not found for ${label} after ${retries} attempts."
    exit 1
}

function Run-Fairness-Test {
    param(
        [Parameter(Mandatory = $true)] [string] $label,
        [Parameter(Mandatory = $true)] [string] $v5Enabled,
        [Parameter(Mandatory = $true)] [string] $male1Phone,
        [Parameter(Mandatory = $true)] [string] $male2Phone,
        [Parameter(Mandatory = $true)] [string] $femalePhone
    )

    Write-Host "`n== $label =="
    $env:CHAT_NIGHT_V5_MATCHING_ENABLED = $v5Enabled

    $male1Token = Register-User $male1Phone "$label male1"
    $male2Token = Register-User $male2Phone "$label male2"
    $femaleToken = Register-User $femalePhone "$label female"

    Patch-Profile $male1Token "Man" "${label}Male1"
    Start-Sleep -Seconds 2
    Patch-Profile $male2Token "Man" "${label}Male2"
    Patch-Profile $femaleToken "Woman" "${label}Female"

    $male1Id = Get-UserId $male1Token "$label male1"
    $male2Id = Get-UserId $male2Token "$label male2"
    if (-not $male1Id -or -not $male2Id) {
        Write-Error "Missing user id(s) for ${label}. male1Id=$male1Id male2Id=$male2Id"
        exit 1
    }

    Write-Host "Queueing older wait candidate (male1)..."
    $enterMale1 = Enter-ChatNight $male1Token "$label male1 enter"
    if ($enterMale1.status -ne "queued") {
        Write-Error "Expected male1 queued. Got: $($enterMale1.status)"
        exit 1
    }

    Write-Host "Waiting 35s to build wait advantage..."
    Start-Sleep -Seconds 35

    Write-Host "Queueing newer wait candidate (male2)..."
    $enterMale2 = Enter-ChatNight $male2Token "$label male2 enter"
    if ($enterMale2.status -ne "queued") {
        Write-Error "Expected male2 queued. Got: $($enterMale2.status)"
        exit 1
    }

    Write-Host "Female enters (expect match_found)..."
    $enterFemale = Enter-ChatNight $femaleToken "$label female enter"
    if ($enterFemale.status -ne "match_found") {
        Write-Error "Expected female match_found. Got: $($enterFemale.status)"
        exit 1
    }

    $roomId = $enterFemale.room_id
    if (-not $roomId) {
        Write-Error "Missing room_id on match_found response."
        exit 1
    }

    $room = Wait-For-My-Room $femaleToken "$label female"
    $partnerId = $room.partner_user_id

    if ($partnerId -ne $male1Id) {
        Write-Error "Fairness failed: expected partner $male1Id (male1), got $partnerId"
        exit 1
    }

    Leave-ChatNight $male1Token "$label male1 leave"
    Leave-ChatNight $male2Token "$label male2 leave"
    Leave-ChatNight $femaleToken "$label female leave"

    Write-Host "Fairness preferred older waiting candidate for $label."
}

$fifoMale1 = "+1777$timestamp"
$fifoMale2 = "+1778$timestamp"
$fifoFemale = "+1779$timestamp"
$v5Male1 = "+1780$timestamp"
$v5Male2 = "+1781$timestamp"
$v5Female = "+1782$timestamp"

Run-Fairness-Test "FIFO" "false" $fifoMale1 $fifoMale2 $fifoFemale
Write-Host "`nWaiting 65s to avoid chat night enter rate limit..."
Start-Sleep -Seconds 65
Run-Fairness-Test "V5" "true" $v5Male1 $v5Male2 $v5Female

Write-Host "`nPASS: fairness wait-time boost verified"
