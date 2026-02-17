$baseUrl = "http://localhost:8000"
$chatNightBase = "$baseUrl/api/chat-night"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$password = "ChatNightTest123!"

$env:CHAT_NIGHT_TEST_MODE = "true"
$env:CHAT_NIGHT_FORCE_OPEN = "true"
$env:CHAT_NIGHT_TEST_PASSES = "5"
$env:CHAT_NIGHT_PAIR_COOLDOWN_MINUTES = "0"
$env:CHAT_NIGHT_WAITTIME_BOOST_ENABLED = "false"
$env:CHAT_NIGHT_V5_MIN_SCORE = "0"

Write-Host "==============================================" -ForegroundColor Yellow
Write-Host " CHAT NIGHT V5 CONTRACT REGRESSION VERIFIER   " -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor Yellow
Write-Host "Target Base URL: $baseUrl" -ForegroundColor Cyan

try {
    Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -ErrorAction Stop | Out-Null
    Write-Host "Server Check: OK (Backend is Running)" -ForegroundColor Green
} catch {
    Write-Error "Server Unreachable at $baseUrl. Is uvicorn running?"
    exit 1
}

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

    for ($attempt = 1; $attempt -le 2; $attempt++) {
        try {
            $regResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $regBody -ContentType "application/json"
            return $regResponse.access_token
        } catch {
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
        birthday = "1990-01-01"
        gender = $gender
        photos = @("p1", "p2", "p3", "p4")
        bio = "V5 contract test profile."
        prompts = $profileData.prompts
        work = "Engineer"
        location = "Austin"
        educationLevel = "Bachelors"
        starSign = "Leo"
        height = "170cm"
        interests = $profileData.interests
        values = $profileData.values
        languages = $profileData.languages
        habits = $profileData.habits
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
        [int] $retries = 6,
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

function Assert-Match-Meta-Enabled {
    param(
        [Parameter(Mandatory = $true)] $enterResponse,
        [Parameter(Mandatory = $true)] [string] $label
    )

    if (-not $enterResponse.match_meta) {
        Write-Error "Expected match_meta for ${label} when CHAT_NIGHT_INCLUDE_MATCH_META=true."
        exit 1
    }

    $meta = $enterResponse.match_meta
    if ($meta.match_algo -ne "v5") {
        Write-Error "Expected match_algo v5 for ${label}. Got: $($meta.match_algo)"
        exit 1
    }
    if ([int]$meta.score -le 0) {
        Write-Error "Expected score > 0 for ${label}. Got: $($meta.score)"
        exit 1
    }
    $tagCount = @($meta.reason_tags).Count
    if ($tagCount -le 0) {
        Write-Error "Expected reason_tags to be present for ${label}."
        exit 1
    }
    if ($tagCount -gt 6) {
        Write-Error "Expected reason_tags length <= 6 for ${label}. Got: $tagCount"
        exit 1
    }
}

function Assert-Match-Meta-Disabled {
    param(
        [Parameter(Mandatory = $true)] $enterResponse,
        [Parameter(Mandatory = $true)] [string] $label
    )

    if ($enterResponse.PSObject.Properties.Name -contains "match_meta") {
        Write-Error "match_meta should not be present for ${label} when CHAT_NIGHT_INCLUDE_MATCH_META=false."
        exit 1
    }
}

function Run-V5-Overlap-Test {
    param(
        [Parameter(Mandatory = $true)] [string] $label,
        [Parameter(Mandatory = $true)] [string] $lowPhone,
        [Parameter(Mandatory = $true)] [string] $highPhone,
        [Parameter(Mandatory = $true)] [string] $targetPhone
    )

    Write-Host "`n== $label (V5 overlap) =="
    $env:CHAT_NIGHT_V5_MATCHING_ENABLED = "true"
    $env:CHAT_NIGHT_INCLUDE_MATCH_META = "true"

    $lowToken = $null
    $highToken = $null
    $targetToken = $null

    try {
        $lowToken = Register-User $lowPhone "$label low overlap"
        $highToken = Register-User $highPhone "$label high overlap"
        $targetToken = Register-User $targetPhone "$label target"

        $targetProfile = @{
            interests = @("Music", "Coffee", "Travel")
            values = @("Honesty", "Humor")
            languages = @("English", "Spanish")
            habits = @{ drinking = "sometimes"; smoking = "no"; exercise = "yes"; kids = "maybe" }
            prompts = @(@{ question = "Q1"; answer = "A1" })
        }

        $highProfile = @{
            interests = @("Music", "Coffee", "Travel")
            values = @("Honesty", "Humor")
            languages = @("English", "Spanish")
            habits = @{ drinking = "sometimes"; smoking = "no"; exercise = "yes"; kids = "maybe" }
            prompts = @(@{ question = "Q2"; answer = "A2" })
        }

        $lowProfile = @{
            interests = @("Gaming", "Cooking", "Running")
            values = @("Ambition", "Tradition")
            languages = @("French")
            habits = @{ drinking = "no"; smoking = "yes"; exercise = "no"; kids = "no" }
            prompts = @(@{ question = "Q3"; answer = "A3" })
        }

        Patch-Profile $lowToken "Man" "${label}Low" $lowProfile
        Start-Sleep -Seconds 1
        Patch-Profile $highToken "Man" "${label}High" $highProfile
        Start-Sleep -Seconds 1
        Patch-Profile $targetToken "Woman" "${label}Target" $targetProfile

        $lowId = Get-UserId $lowToken "$label low overlap"
        $highId = Get-UserId $highToken "$label high overlap"
        if (-not $lowId -or -not $highId) {
            Write-Error "Missing user id(s) for ${label}. lowId=$lowId highId=$highId"
            exit 1
        }

        Write-Host "Queueing low overlap candidate (first)..."
        $enterLow = Enter-ChatNight $lowToken "$label low overlap enter"
        if ($enterLow.status -ne "queued") {
            Write-Error "Expected low overlap queued. Got: $($enterLow.status)"
            exit 1
        }

        Write-Host "Queueing high overlap candidate (second)..."
        $enterHigh = Enter-ChatNight $highToken "$label high overlap enter"
        if ($enterHigh.status -ne "queued") {
            Write-Error "Expected high overlap queued. Got: $($enterHigh.status)"
            exit 1
        }

        Write-Host "Target enters (expect match_found)..."
        $enterTarget = Enter-ChatNight $targetToken "$label target enter"
        if ($enterTarget.status -ne "match_found") {
            Write-Error "Expected target match_found. Got: $($enterTarget.status)"
            exit 1
        }

        Assert-Match-Meta-Enabled $enterTarget "$label target"

        $room = Wait-For-My-Room $targetToken "$label target"
        $partnerId = $room.partner_user_id

        if ($partnerId -ne $highId) {
            Write-Error "V5 overlap failed: expected partner $highId (high overlap), got $partnerId"
            exit 1
        }

        Write-Host "V5 selected higher-overlap candidate for $label."
    } finally {
        if ($lowToken) { Leave-ChatNight $lowToken "$label low overlap leave" }
        if ($highToken) { Leave-ChatNight $highToken "$label high overlap leave" }
        if ($targetToken) { Leave-ChatNight $targetToken "$label target leave" }
    }
}

function Run-FIFO-Test {
    param(
        [Parameter(Mandatory = $true)] [string] $label,
        [Parameter(Mandatory = $true)] [string] $firstPhone,
        [Parameter(Mandatory = $true)] [string] $secondPhone,
        [Parameter(Mandatory = $true)] [string] $targetPhone
    )

    Write-Host "`n== $label (FIFO) =="
    $env:CHAT_NIGHT_V5_MATCHING_ENABLED = "false"
    $env:CHAT_NIGHT_INCLUDE_MATCH_META = "false"

    $firstToken = $null
    $secondToken = $null
    $targetToken = $null

    try {
        $firstToken = Register-User $firstPhone "$label first"
        $secondToken = Register-User $secondPhone "$label second"
        $targetToken = Register-User $targetPhone "$label target"

        $targetProfile = @{
            interests = @("Music", "Coffee", "Travel")
            values = @("Honesty", "Humor")
            languages = @("English", "Spanish")
            habits = @{ drinking = "sometimes"; smoking = "no"; exercise = "yes"; kids = "maybe" }
            prompts = @(@{ question = "Q1"; answer = "A1" })
        }

        $firstProfile = @{
            interests = @("Gaming", "Cooking", "Running")
            values = @("Ambition", "Tradition")
            languages = @("French")
            habits = @{ drinking = "no"; smoking = "yes"; exercise = "no"; kids = "no" }
            prompts = @(@{ question = "Q3"; answer = "A3" })
        }

        $secondProfile = @{
            interests = @("Music", "Coffee", "Travel")
            values = @("Honesty", "Humor")
            languages = @("English", "Spanish")
            habits = @{ drinking = "sometimes"; smoking = "no"; exercise = "yes"; kids = "maybe" }
            prompts = @(@{ question = "Q2"; answer = "A2" })
        }

        Patch-Profile $firstToken "Man" "${label}First" $firstProfile
        Start-Sleep -Seconds 1
        Patch-Profile $secondToken "Man" "${label}Second" $secondProfile
        Start-Sleep -Seconds 1
        Patch-Profile $targetToken "Woman" "${label}Target" $targetProfile

        $firstId = Get-UserId $firstToken "$label first"
        $secondId = Get-UserId $secondToken "$label second"
        if (-not $firstId -or -not $secondId) {
            Write-Error "Missing user id(s) for ${label}. firstId=$firstId secondId=$secondId"
            exit 1
        }

        Write-Host "Queueing first candidate (FIFO)..."
        $enterFirst = Enter-ChatNight $firstToken "$label first enter"
        if ($enterFirst.status -ne "queued") {
            Write-Error "Expected first candidate queued. Got: $($enterFirst.status)"
            exit 1
        }

        Write-Host "Queueing second candidate (FIFO)..."
        $enterSecond = Enter-ChatNight $secondToken "$label second enter"
        if ($enterSecond.status -ne "queued") {
            Write-Error "Expected second candidate queued. Got: $($enterSecond.status)"
            exit 1
        }

        Write-Host "Target enters (expect match_found)..."
        $enterTarget = Enter-ChatNight $targetToken "$label target enter"
        if ($enterTarget.status -ne "match_found") {
            Write-Error "Expected target match_found. Got: $($enterTarget.status)"
            exit 1
        }

        Assert-Match-Meta-Disabled $enterTarget "$label target"

        $room = Wait-For-My-Room $targetToken "$label target"
        $partnerId = $room.partner_user_id

        if ($partnerId -ne $firstId) {
            Write-Error "FIFO failed: expected partner $firstId (first in queue), got $partnerId"
            exit 1
        }

        Write-Host "FIFO selected first-queued candidate for $label."
    } finally {
        if ($firstToken) { Leave-ChatNight $firstToken "$label first leave" }
        if ($secondToken) { Leave-ChatNight $secondToken "$label second leave" }
        if ($targetToken) { Leave-ChatNight $targetToken "$label target leave" }
    }
}

$v5Low1 = "+1810$timestamp"
$v5High1 = "+1811$timestamp"
$v5Target1 = "+1812$timestamp"
$v5Low2 = "+1813$timestamp"
$v5High2 = "+1814$timestamp"
$v5Target2 = "+1815$timestamp"
$fifoFirst = "+1816$timestamp"
$fifoSecond = "+1817$timestamp"
$fifoTarget = "+1818$timestamp"

Run-V5-Overlap-Test "V5-Run1" $v5Low1 $v5High1 $v5Target1
Write-Host "`nWaiting 65s to avoid chat night enter rate limit..."
Start-Sleep -Seconds 65
Run-V5-Overlap-Test "V5-Run2" $v5Low2 $v5High2 $v5Target2
Write-Host "`nWaiting 65s to avoid chat night enter rate limit..."
Start-Sleep -Seconds 65
Run-FIFO-Test "FIFO" $fifoFirst $fifoSecond $fifoTarget

Write-Host "`nPASS: chat night v5 contract verified"
