$baseUrl = if ([string]::IsNullOrWhiteSpace($env:CHAT_NIGHT_BASE_URL)) { "http://localhost:8000" } else { $env:CHAT_NIGHT_BASE_URL.TrimEnd("/") }
$chatNightBase = "$baseUrl/api/chat-night"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$password = "ChatNightReveal123!"

Write-Host "======================================================" -ForegroundColor Yellow
Write-Host " CHAT NIGHT ICEBREAKERS REVEAL SYNC VERIFIER (W6-B4.1) " -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Yellow
Write-Host "Target Base URL: $baseUrl" -ForegroundColor Cyan
Write-Host "Note: If onboarding scoring depends on photos, run backend with DEV_BYPASS_PHOTOS=true (dev only) or run verify_photos_r2_contract.ps1 first." -ForegroundColor DarkYellow

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
        birthday = "1997-07-15"
        gender = $gender
        bio = "Icebreaker reveal sync verification profile."
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

function Call-Icebreakers {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $roomId
    )

    $headers = @{ Authorization = "Bearer $token" }
    $body = @{ room_id = $roomId } | ConvertTo-Json
    try {
        return Invoke-RestMethod -Uri "$chatNightBase/icebreakers" -Method Post -Headers $headers -Body $body -ContentType "application/json"
    }
    catch {
        Write-Error "POST /icebreakers failed: $_"
        exit 1
    }
}

function Reveal-Icebreaker {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $roomId,
        [Parameter(Mandatory = $true)] [int] $index,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $headers = @{ Authorization = "Bearer $token" }
    $body = @{
        room_id = $roomId
        index = $index
    } | ConvertTo-Json

    try {
        return Invoke-RestMethod -Uri "$chatNightBase/icebreakers/reveal" -Method Post -Headers $headers -Body $body -ContentType "application/json"
    }
    catch {
        Write-Error "POST /icebreakers/reveal failed for ${label}: $_"
        exit 1
    }
}

function Assert-Reveal-Cache-Required {
    param(
        [Parameter(Mandatory = $true)] [string] $token,
        [Parameter(Mandatory = $true)] [string] $roomId
    )

    $headers = @{ Authorization = "Bearer $token" }
    $body = @{
        room_id = $roomId
        index = 0
    } | ConvertTo-Json

    try {
        $null = Invoke-RestMethod -Uri "$chatNightBase/icebreakers/reveal" -Method Post -Headers $headers -Body $body -ContentType "application/json"
        Write-Error "Expected POST /icebreakers/reveal to fail with 409 when cache is missing, but request succeeded."
        exit 1
    }
    catch {
        $statusCode = $null
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        elseif ($_.Exception.Message -match "409") {
            $statusCode = 409
        }

        if ($statusCode -ne 409) {
            Write-Error "Expected HTTP 409 when cache is missing, got status '$statusCode'. Error: $_"
            exit 1
        }
    }
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
    }
    catch {
        Write-Error "GET /room failed for ${label}: $_"
        exit 1
    }
}

function Assert-NoObviousPiiInPayload {
    param(
        [Parameter(Mandatory = $true)] $payload,
        [Parameter(Mandatory = $true)] [string] $label
    )

    function Get-StringValues {
        param([Parameter(Mandatory = $true)] $value)

        if ($null -eq $value) {
            return @()
        }
        if ($value -is [string]) {
            return @($value)
        }
        if ($value -is [System.Collections.IDictionary]) {
            $dictStrings = @()
            foreach ($key in $value.Keys) {
                $dictStrings += Get-StringValues -value $value[$key]
            }
            return $dictStrings
        }
        if ($value -is [System.Collections.IEnumerable] -and -not ($value -is [string])) {
            $listStrings = @()
            foreach ($item in $value) {
                $listStrings += Get-StringValues -value $item
            }
            return $listStrings
        }

        $propStrings = @()
        foreach ($prop in $value.PSObject.Properties) {
            $propStrings += Get-StringValues -value $prop.Value
        }
        return $propStrings
    }

    function Test-LooksLikePhoneNumber {
        param([Parameter(Mandatory = $true)] [string] $value)
        $text = $value.Trim()
        if ([string]::IsNullOrWhiteSpace($text)) {
            return $false
        }
        if ($text -match '[A-Za-z]') {
            return $false
        }
        $digits = ($text -replace '\D', '')
        if ($digits.Length -lt 10 -or $digits.Length -gt 15) {
            return $false
        }
        return $true
    }

    $emailPattern = '(?i)^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    $handlePattern = '(?<!\w)@[A-Za-z0-9_]{2,}'

    $stringValues = Get-StringValues -value $payload
    foreach ($value in $stringValues) {
        if ($value -match $emailPattern) {
            Write-Error "${label}: email-like PII detected in response payload."
            exit 1
        }
        if (Test-LooksLikePhoneNumber -value $value) {
            Write-Error "${label}: phone-like PII detected in response payload."
            exit 1
        }
        if ($value -match $handlePattern) {
            Write-Error "${label}: handle-like PII detected in response payload."
            exit 1
        }
    }
}

function Assert-Indices {
    param(
        [Parameter(Mandatory = $true)] $indices,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $arr = @($indices)
    foreach ($item in $arr) {
        $idx = 0
        if (-not [int]::TryParse("$item", [ref]$idx)) {
            Write-Error "${label}: non-integer reveal index found ($item)."
            exit 1
        }
        if ($idx -lt 0 -or $idx -gt 4) {
            Write-Error "${label}: reveal index out of range ($idx)."
            exit 1
        }
    }

    $uniqueCount = @($arr | Select-Object -Unique).Count
    if ($uniqueCount -ne $arr.Count) {
        Write-Error "${label}: duplicate reveal indices found."
        exit 1
    }
}

function Assert-ContainsIndex {
    param(
        [Parameter(Mandatory = $true)] $indices,
        [Parameter(Mandatory = $true)] [int] $expectedIndex,
        [Parameter(Mandatory = $true)] [string] $label
    )

    $arr = @($indices)
    if ($arr -notcontains $expectedIndex) {
        Write-Error "${label}: expected reveal index $expectedIndex not found. Actual: $($arr -join ',')"
        exit 1
    }
}

$tokenA = $null
$tokenB = $null

try {
    $phoneA = "+1911$timestamp"
    $phoneB = "+1912$timestamp"

    $tokenA = Register-User $phoneA "user_a"
    $tokenB = Register-User $phoneB "user_b"

    $profileA = @{
        interests = @("coffee", "running", "music")
        values = @("kindness", "growth")
        languages = @("English")
        habits = @{ drinking = "sometimes"; smoking = "no"; exercise = "yes"; kids = "maybe" }
        prompts = @(@{ question = "Ideal day off?"; answer = "A long walk and a good cafe." })
        intention = "relationship"
    }
    $profileB = @{
        interests = @("coffee", "travel", "music")
        values = @("kindness", "humor")
        languages = @("English")
        habits = @{ drinking = "sometimes"; smoking = "no"; exercise = "yes"; kids = "maybe" }
        prompts = @(@{ question = "Favorite way to unwind?"; answer = "Music and a short drive." })
        intention = "relationship"
    }

    Patch-Profile $tokenA "Man" "RevealA$timestamp" $profileA
    Patch-Profile $tokenB "Woman" "RevealB$timestamp" $profileB

    $enterA = Enter-ChatNight $tokenA "user_a"
    $enterB = Enter-ChatNight $tokenB "user_b"

    $roomId = $null
    if ($enterA.room_id) { $roomId = $enterA.room_id }
    if (-not $roomId -and $enterB.room_id) { $roomId = $enterB.room_id }
    if (-not $roomId) {
        $roomId = Wait-For-RoomId $tokenA $tokenB
    }

    if (-not $roomId) {
        Write-Error "Failed to resolve room_id from enter/my-room flow."
        exit 1
    }

    Assert-Reveal-Cache-Required -token $tokenA -roomId $roomId

    $icebreakersResponse = Call-Icebreakers $tokenA $roomId
    Assert-NoObviousPiiInPayload -payload $icebreakersResponse -label "POST /icebreakers"

    $revealA1 = Reveal-Icebreaker $tokenA $roomId 1 "user_a"
    Assert-Indices -indices $revealA1.revealed_indices -label "reveal_user_a_index_1"
    Assert-ContainsIndex -indices $revealA1.revealed_indices -expectedIndex 1 -label "reveal_user_a_index_1"
    Assert-NoObviousPiiInPayload -payload $revealA1 -label "POST /icebreakers/reveal user_a"

    $roomForB = Get-Room $tokenB $roomId "user_b"
    Assert-Indices -indices $roomForB.icebreakers_revealed_indices -label "room_for_user_b_after_user_a_reveal"
    Assert-ContainsIndex -indices $roomForB.icebreakers_revealed_indices -expectedIndex 1 -label "room_for_user_b_after_user_a_reveal"
    Assert-NoObviousPiiInPayload -payload $roomForB -label "GET /room user_b"

    $revealB3 = Reveal-Icebreaker $tokenB $roomId 3 "user_b"
    Assert-Indices -indices $revealB3.revealed_indices -label "reveal_user_b_index_3"
    Assert-ContainsIndex -indices $revealB3.revealed_indices -expectedIndex 1 -label "reveal_user_b_index_3"
    Assert-ContainsIndex -indices $revealB3.revealed_indices -expectedIndex 3 -label "reveal_user_b_index_3"
    Assert-NoObviousPiiInPayload -payload $revealB3 -label "POST /icebreakers/reveal user_b"

    $revealA1Again = Reveal-Icebreaker $tokenA $roomId 1 "user_a_duplicate"
    Assert-Indices -indices $revealA1Again.revealed_indices -label "reveal_user_a_index_1_duplicate"

    $roomForA = Get-Room $tokenA $roomId "user_a"
    Assert-Indices -indices $roomForA.icebreakers_revealed_indices -label "room_for_user_a_final"
    Assert-ContainsIndex -indices $roomForA.icebreakers_revealed_indices -expectedIndex 1 -label "room_for_user_a_final"
    Assert-ContainsIndex -indices $roomForA.icebreakers_revealed_indices -expectedIndex 3 -label "room_for_user_a_final"
    Assert-NoObviousPiiInPayload -payload $roomForA -label "GET /room user_a final"

    Write-Host "Room: $roomId"
    Write-Host "User A reveal response: $($revealA1.revealed_indices -join ',')"
    Write-Host "User B reveal response: $($revealB3.revealed_indices -join ',')"
    Write-Host "User A final room poll reveals: $($roomForA.icebreakers_revealed_indices -join ',')"
    Write-Host "PASS: icebreakers reveal sync verified" -ForegroundColor Green
}
finally {
    if ($tokenA) { Leave-ChatNight $tokenA "user_a" }
    if ($tokenB) { Leave-ChatNight $tokenB "user_b" }
}
