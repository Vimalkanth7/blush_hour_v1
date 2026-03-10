$baseUrl = "http://localhost:8000"
$chatNightBase = "$baseUrl/api/chat-night"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$password = "TalkRoomSync123!"

Write-Host "==============================================" -ForegroundColor Yellow
Write-Host " TALK ROOM ENGAGE SYNC VERIFIER               " -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor Yellow
Write-Host "Target Base URL: $baseUrl" -ForegroundColor Cyan
Write-Host "Note: If onboarding scoring depends on photos, run backend with DEV_BYPASS_PHOTOS=true (dev only) or run verify_photos_r2_contract.ps1 first." -ForegroundColor DarkYellow

function Fail {
    param([Parameter(Mandatory = $true)] [string] $message)
    Write-Error $message
    exit 1
}

function Assert-Equal {
    param(
        [Parameter(Mandatory = $true)] $actual,
        [Parameter(Mandatory = $true)] $expected,
        [Parameter(Mandatory = $true)] [string] $label
    )

    if ($actual -ne $expected) {
        Fail "$label expected '$expected' but got '$actual'."
    }
}

function Assert-True {
    param(
        [Parameter(Mandatory = $true)] [bool] $condition,
        [Parameter(Mandatory = $true)] [string] $label
    )

    if (-not $condition) {
        Fail $label
    }
}

function Register-User {
    param(
        [Parameter(Mandatory = $true)] [string] $phone,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $body = @{
        phone_number = $phone
        password = $password
    } | ConvertTo-Json

    for ($attempt = 1; $attempt -le 2; $attempt++) {
        try {
            $resp = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $body -ContentType "application/json"
            return $resp.access_token
        } catch {
            $errText = ($_ | Out-String)
            if ($errText -match "Rate limit exceeded" -and $attempt -lt 2) {
                Write-Host "Registration rate limit for $label. Waiting 65s..." -ForegroundColor Yellow
                Start-Sleep -Seconds 65
                continue
            }
            Fail "Registration failed for ${label}: $_"
        }
    }

    Fail "Registration failed for $label after retries."
}

function Patch-Profile {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $gender,
        [Parameter(Mandatory = $true)] [string] $firstName
    )

    $headers = @{ Authorization = "Bearer $token" }
    $body = @{
        firstName = $firstName
        birthday = "1990-01-01"
        gender = $gender
        bio = "Talk room engage sync verification profile."
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
        $null = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $body -ContentType "application/json"
    } catch {
        Fail "Profile patch failed for ${firstName}: $_"
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
        Fail "Enter chat night failed for ${label}: $_"
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
        Write-Host "Non-fatal leave warning for ${label}: $_" -ForegroundColor DarkYellow
    }
}

function Get-MyRoom {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $headers = @{ Authorization = "Bearer $token" }
    try {
        return Invoke-RestMethod -Uri "$chatNightBase/my-room" -Method Get -Headers $headers
    } catch {
        Fail "my-room failed for ${label}: $_"
    }
}

function Wait-For-MyRoom {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $label,
        [int] $retries = 8,
        [int] $delaySeconds = 2
    )

    for ($i = 0; $i -lt $retries; $i++) {
        $resp = Get-MyRoom -token $token -label $label
        if ($resp.state -ne "none" -and $resp.room_id) {
            return $resp
        }
        Start-Sleep -Seconds $delaySeconds
    }

    Fail "Timed out waiting for room in my-room for $label."
}

function Get-Room {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $roomId,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $headers = @{ Authorization = "Bearer $token" }
    try {
        return Invoke-RestMethod -Uri "$chatNightBase/room/$roomId" -Method Get -Headers $headers
    } catch {
        Fail "room/$roomId failed for ${label}: $_"
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
        return Invoke-RestMethod -Uri "$chatNightBase/engage" -Method Post -Headers $headers -Body $body -ContentType "application/json"
    } catch {
        Fail "engage failed for ${label}: $_"
    }
}

try {
    Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -ErrorAction Stop | Out-Null
    Write-Host "Server Check: OK (Backend is Running)" -ForegroundColor Green
} catch {
    Fail "Server unreachable at $baseUrl. Start backend first."
}

$userAPhone = "+1966$timestamp"
$userBPhone = "+1967$timestamp"

$tokenA = $null
$tokenB = $null

try {
    Write-Host "Registering synthetic users..." -ForegroundColor Cyan
    $tokenA = Register-User -phone $userAPhone -label "UserA"
    $tokenB = Register-User -phone $userBPhone -label "UserB"

    Patch-Profile -token $tokenA -gender "Man" -firstName "TalkA"
    Patch-Profile -token $tokenB -gender "Woman" -firstName "TalkB"

    # Best-effort cleanup in case of retries.
    Leave-ChatNight -token $tokenA -label "UserA"
    Leave-ChatNight -token $tokenB -label "UserB"

    Write-Host "Creating room via /enter..." -ForegroundColor Cyan
    $enterA = Enter-ChatNight -token $tokenA -label "UserA"
    Assert-Equal -actual $enterA.status -expected "queued" -label "UserA first /enter status"

    $enterB = Enter-ChatNight -token $tokenB -label "UserB"
    Assert-Equal -actual $enterB.status -expected "match_found" -label "UserB /enter status"

    $roomId = $enterB.room_id
    Assert-True -condition ([string]::IsNullOrWhiteSpace($roomId) -eq $false) -label "Room ID missing from match_found response."

    $myRoomA = Wait-For-MyRoom -token $tokenA -label "UserA"
    $myRoomB = Wait-For-MyRoom -token $tokenB -label "UserB"
    Assert-Equal -actual $myRoomA.room_id -expected $roomId -label "UserA my-room room_id"
    Assert-Equal -actual $myRoomB.room_id -expected $roomId -label "UserB my-room room_id"
    Assert-Equal -actual $myRoomA.state -expected "active" -label "UserA initial my-room state"
    Assert-Equal -actual $myRoomB.state -expected "active" -label "UserB initial my-room state"

    Write-Host "Engage step 1: UserA engages first." -ForegroundColor Cyan
    $engageA1 = Engage-Room -token $tokenA -roomId $roomId -label "UserA first engage"
    Assert-Equal -actual $engageA1.status -expected "success" -label "UserA first engage response status"

    $roomAAfterA = Get-Room -token $tokenA -roomId $roomId -label "UserA after first engage"
    $roomBAfterA = Get-Room -token $tokenB -roomId $roomId -label "UserB after UserA engage"

    Assert-Equal -actual $roomAAfterA.state -expected "active" -label "Room state for UserA after first engage"
    Assert-Equal -actual $roomBAfterA.state -expected "active" -label "Room state for UserB after first engage"
    Assert-Equal -actual $roomAAfterA.engage_status -expected "waiting_for_partner" -label "UserA engage_status after first engage"
    Assert-Equal -actual $roomBAfterA.engage_status -expected "pending" -label "UserB engage_status before own engage"
    Assert-Equal -actual $roomAAfterA.match_unlocked -expected $false -label "UserA match_unlocked before UserB engage"
    Assert-Equal -actual $roomBAfterA.match_unlocked -expected $false -label "UserB match_unlocked before own engage"

    $myRoomBAfterA = Get-MyRoom -token $tokenB -label "UserB my-room after UserA engage"
    Assert-Equal -actual $myRoomBAfterA.engage_you -expected $false -label "UserB engage_you before own engage"
    Assert-Equal -actual $myRoomBAfterA.engage_partner -expected $true -label "UserB engage_partner after UserA engage"

    Write-Host "Engage step 2: UserB engages." -ForegroundColor Cyan
    $engageB = Engage-Room -token $tokenB -roomId $roomId -label "UserB engage"
    Assert-Equal -actual $engageB.status -expected "success" -label "UserB engage response status"

    $roomAAfterB = Get-Room -token $tokenA -roomId $roomId -label "UserA after UserB engage"
    $roomBAfterB = Get-Room -token $tokenB -roomId $roomId -label "UserB after own engage"

    Assert-Equal -actual $roomAAfterB.state -expected "engaged" -label "UserA room state after both engaged"
    Assert-Equal -actual $roomBAfterB.state -expected "engaged" -label "UserB room state after both engaged"
    Assert-Equal -actual $roomAAfterB.engage_status -expected "match_unlocked" -label "UserA engage_status after both engaged"
    Assert-Equal -actual $roomBAfterB.engage_status -expected "match_unlocked" -label "UserB engage_status after both engaged"
    Assert-Equal -actual $roomAAfterB.match_unlocked -expected $true -label "UserA match_unlocked after both engaged"
    Assert-Equal -actual $roomBAfterB.match_unlocked -expected $true -label "UserB match_unlocked after both engaged"

    $myRoomAAfterB = Get-MyRoom -token $tokenA -label "UserA my-room after both engaged"
    $myRoomBAfterB = Get-MyRoom -token $tokenB -label "UserB my-room after both engaged"
    Assert-Equal -actual $myRoomAAfterB.state -expected "engaged" -label "UserA my-room state after both engaged"
    Assert-Equal -actual $myRoomBAfterB.state -expected "engaged" -label "UserB my-room state after both engaged"
    Assert-Equal -actual $myRoomAAfterB.engage_you -expected $true -label "UserA my-room engage_you after both engaged"
    Assert-Equal -actual $myRoomBAfterB.engage_you -expected $true -label "UserB my-room engage_you after both engaged"

    Write-Host "Idempotency check: UserA engages again after unlock." -ForegroundColor Cyan
    $engageA2 = Engage-Room -token $tokenA -roomId $roomId -label "UserA second engage"
    Assert-Equal -actual $engageA2.status -expected "success" -label "UserA second engage response status"
    Assert-Equal -actual $engageA2.room_state -expected "engaged" -label "UserA second engage room_state"
    Assert-Equal -actual $engageA2.match_unlocked -expected $true -label "UserA second engage match_unlocked"

    Write-Host "PASS: talk room engage sync verified." -ForegroundColor Green
}
finally {
    if ($tokenA) { Leave-ChatNight -token $tokenA -label "UserA final cleanup" }
    if ($tokenB) { Leave-ChatNight -token $tokenB -label "UserB final cleanup" }
}
