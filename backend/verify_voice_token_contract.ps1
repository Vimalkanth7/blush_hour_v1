[CmdletBinding()]
param(
    [string] $BaseUrl = "http://localhost:8000",
    [ValidateSet("enabled", "disabled")]
    [string] $Mode = "enabled"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")

$script:Password = "VoiceTokenContract123!"
$script:UserAToken = $null
$script:UserBToken = $null

function Write-Step {
    param([Parameter(Mandatory = $true)][string] $Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Pass {
    param([Parameter(Mandatory = $true)][string] $Message)
    Write-Host "PASS: $Message" -ForegroundColor Green
}

function Fail {
    param([Parameter(Mandatory = $true)][string] $Message)
    throw $Message
}

function Get-HttpStatusCodeFromError {
    param([Parameter(Mandatory = $true)][System.Management.Automation.ErrorRecord] $ErrorRecord)

    $exception = $ErrorRecord.Exception
    if ($null -eq $exception) { return $null }

    if ($exception.PSObject.Properties.Name -contains "Response") {
        $response = $exception.Response
        if ($null -ne $response -and $response.PSObject.Properties.Name -contains "StatusCode") {
            try { return [int] $response.StatusCode } catch { return $null }
        }
    }
    return $null
}

function Get-HttpErrorText {
    param([Parameter(Mandatory = $true)][System.Management.Automation.ErrorRecord] $ErrorRecord)

    if ($ErrorRecord.ErrorDetails -and -not [string]::IsNullOrWhiteSpace("$($ErrorRecord.ErrorDetails.Message)")) {
        return "$($ErrorRecord.ErrorDetails.Message)"
    }

    $exception = $ErrorRecord.Exception
    if ($null -eq $exception) { return "$ErrorRecord" }

    if ($exception.PSObject.Properties.Name -contains "Response") {
        $response = $exception.Response
        if ($null -ne $response -and $response.PSObject.Properties.Name -contains "Content") {
            $content = "$($response.Content)"
            if (-not [string]::IsNullOrWhiteSpace($content)) { return $content }
        }
    }

    return "$($exception.Message)"
}

function Try-GetDetailMessage {
    param([AllowEmptyString()][string] $RawErrorText)

    if ([string]::IsNullOrWhiteSpace($RawErrorText)) { return "" }

    try {
        $parsed = $RawErrorText | ConvertFrom-Json -ErrorAction Stop
        if ($parsed -and ($parsed.PSObject.Properties.Name -contains "detail")) {
            return "$($parsed.detail)"
        }
    }
    catch { }

    return $RawErrorText
}

function Invoke-JsonApi {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("GET", "POST", "PATCH", "PUT", "DELETE")] [string] $Method,
        [Parameter(Mandatory = $true)][string] $Uri,
        [AllowNull()][hashtable] $Headers = $null,
        [AllowNull()] $Body = $null
    )

    $jsonBody = $null
    if ($null -ne $Body) {
        $jsonBody = $Body | ConvertTo-Json -Depth 10 -Compress
    }

    try {
        if ($null -ne $jsonBody) {
            if ($null -ne $Headers) {
                $response = Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers -ContentType "application/json" -Body $jsonBody -ErrorAction Stop
            }
            else {
                $response = Invoke-RestMethod -Uri $Uri -Method $Method -ContentType "application/json" -Body $jsonBody -ErrorAction Stop
            }
        }
        else {
            if ($null -ne $Headers) {
                $response = Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers -ErrorAction Stop
            }
            else {
                $response = Invoke-RestMethod -Uri $Uri -Method $Method -ErrorAction Stop
            }
        }

        return [pscustomobject]@{ Ok = $true; Status = 200; Body = $response; ErrorText = "" }
    }
    catch {
        return [pscustomobject]@{
            Ok        = $false
            Status    = Get-HttpStatusCodeFromError -ErrorRecord $_
            Body      = $null
            ErrorText = Get-HttpErrorText -ErrorRecord $_
        }
    }
}

function New-TestPhone {
    param([Parameter(Mandatory = $true)][string] $Prefix)
    $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
    $tailLength = [Math]::Min(7, $stamp.Length)
    $tail = $stamp.Substring($stamp.Length - $tailLength, $tailLength)
    return "+1${Prefix}${tail}"
}

function Register-TestUser {
    param(
        [Parameter(Mandatory = $true)][string] $PhoneNumber,
        [Parameter(Mandatory = $true)][string] $Label
    )

    $body = @{ phone_number = $PhoneNumber; password = $script:Password }

    for ($attempt = 1; $attempt -le 2; $attempt++) {
        $result = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/auth/register" -Body $body
        if ($result.Ok -and $result.Body -and -not [string]::IsNullOrWhiteSpace("$($result.Body.access_token)")) {
            return [string] $result.Body.access_token
        }

        $detail = Try-GetDetailMessage -RawErrorText "$($result.ErrorText)"
        $rateLimited = ($result.Status -eq 429) -or ($detail -match "(?i)rate limit exceeded")
        if ($rateLimited -and $attempt -lt 2) {
            Write-Host "Registration rate limit hit for $Label. Waiting 65s and retrying once..." -ForegroundColor Yellow
            Start-Sleep -Seconds 65
            continue
        }

        Fail ("Registration failed for {0}. HTTP {1}; detail/error: {2}" -f $Label, $result.Status, $detail)
    }

    Fail "Registration failed for $Label after retry."
}

function Patch-FullProfile {
    param(
        [Parameter(Mandatory = $true)][string] $Token,
        [Parameter(Mandatory = $true)][string] $FirstName,
        [Parameter(Mandatory = $true)][string] $Gender
    )

    $headers = @{ Authorization = "Bearer $Token" }

    # Full profile payload (modeled after talk-room verifier) to satisfy >=80% chat-night gate
    $body = @{
        firstName      = $FirstName
        birthday       = "1990-01-01"
        gender         = $Gender
        bio            = "Voice token verifier profile."
        prompts        = @(@{ question = "Q1"; answer = "A1" })
        work           = "Engineer"
        location       = "Austin"
        educationLevel = "Bachelors"
        starSign       = "Leo"
        height         = "170cm"
        interests      = @("Music", "Art", "Hiking")
        values         = @("Honesty", "Humor")
        languages      = @("English")
        habits         = @{
            drinking = "sometimes"
            smoking  = "no"
            exercise = "yes"
            kids     = "maybe"
        }
    }

    $result = Invoke-JsonApi -Method PATCH -Uri "$BaseUrl/api/users/me" -Headers $headers -Body $body
    if (-not $result.Ok) {
        $detail = Try-GetDetailMessage -RawErrorText "$($result.ErrorText)"
        Fail ("Profile patch failed for {0}. HTTP {1}; detail/error: {2}" -f $FirstName, $result.Status, $detail)
    }
}

function Enter-ChatNight {
    param([Parameter(Mandatory = $true)][hashtable] $Headers)
    return Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/chat-night/enter" -Headers $Headers
}

function Engage-ChatNight {
    param(
        [Parameter(Mandatory = $true)][hashtable] $Headers,
        [Parameter(Mandatory = $true)][string] $RoomId
    )
    $body = @{ room_id = $RoomId }
    return Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/chat-night/engage" -Headers $Headers -Body $body
}

function BestEffort-Leave {
    param([AllowNull()][string] $Token)
    if ([string]::IsNullOrWhiteSpace($Token)) { return }
    $headers = @{ Authorization = "Bearer $Token" }
    $null = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/chat-night/leave" -Headers $headers
}

Write-Host "===================================================" -ForegroundColor Yellow
Write-Host " VOICE TOKEN CONTRACT VERIFIER (W7-T2-C)           " -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "Base URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "Mode: $Mode" -ForegroundColor Cyan
Write-Host "Token output policy: token is never printed, only length is reported." -ForegroundColor DarkYellow

try {
    Write-Step "Health check (/health)"
    $health = Invoke-JsonApi -Method GET -Uri "$BaseUrl/health"
    if (-not $health.Ok -or -not $health.Body -or "$($health.Body.status)" -ne "healthy") {
        $healthError = if ($health.Ok) { ($health.Body | ConvertTo-Json -Compress) } else { "$($health.ErrorText)" }
        Fail ("GET /health must return status=healthy. HTTP {0}; body/error: {1}" -f $health.Status, $healthError)
    }
    Write-Pass "GET /health returned status=healthy."

    Write-Step "Unauthenticated contract check: POST /api/voice/token"
    $voiceNoAuth = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/voice/token"
    if ($voiceNoAuth.Ok -or $voiceNoAuth.Status -ne 401) {
        $err = if ($voiceNoAuth.Ok) { ($voiceNoAuth.Body | ConvertTo-Json -Compress) } else { "$($voiceNoAuth.ErrorText)" }
        Fail ("Expected HTTP 401 for unauthenticated request. Got HTTP {0}; body/error: {1}" -f $voiceNoAuth.Status, $err)
    }
    Write-Pass "Unauthenticated POST /api/voice/token returns HTTP 401."

    Write-Step "Create synthetic user A and patch FULL profile"
    $userAPhone = New-TestPhone -Prefix "966"
    $script:UserAToken = Register-TestUser -PhoneNumber $userAPhone -Label "UserA"
    Patch-FullProfile -Token $script:UserAToken -FirstName "VoiceA" -Gender "Man"
    $headersA = @{ Authorization = "Bearer $script:UserAToken" }
    Write-Pass "UserA registered and profile patched."

    if ($Mode -eq "disabled") {
        Write-Step "Disabled mode check: POST /api/voice/token must return 503"
        $voiceDisabled = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/voice/token" -Headers $headersA
        $disabledDetail = Try-GetDetailMessage -RawErrorText "$($voiceDisabled.ErrorText)"
        $looksUnavailable = $disabledDetail -match "(?i)(voice|unavailable|disabled)"
        if ($voiceDisabled.Ok -or $voiceDisabled.Status -ne 503 -or -not $looksUnavailable) {
            $err = if ($voiceDisabled.Ok) { ($voiceDisabled.Body | ConvertTo-Json -Compress) } else { $disabledDetail }
            Fail ("Expected HTTP 503 with Voice unavailable detail in disabled mode. Got HTTP {0}; detail/body: {1}" -f $voiceDisabled.Status, $err)
        }
        Write-Pass "Disabled mode contract verified: HTTP 503 with unavailable voice detail."
        Write-Host "`nPASS: voice token contract verified (disabled mode)." -ForegroundColor Green
        exit 0
    }

    Write-Step "Enabled mode pre-engage check: POST /api/voice/token should return 409"
    $voiceNotEngaged = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/voice/token" -Headers $headersA
    $notEngagedDetail = Try-GetDetailMessage -RawErrorText "$($voiceNotEngaged.ErrorText)"
    if ($voiceNotEngaged.Ok -or $voiceNotEngaged.Status -ne 409 -or -not ($notEngagedDetail -match "(?i)engaged")) {
        $err = if ($voiceNotEngaged.Ok) { ($voiceNotEngaged.Body | ConvertTo-Json -Compress) } else { $notEngagedDetail }
        Fail ("Expected HTTP 409 with 'engaged' detail before engage. Got HTTP {0}; detail/body: {1}" -f $voiceNotEngaged.Status, $err)
    }
    Write-Pass "Pre-engage contract verified: HTTP 409 with engaged message."

    Write-Step "Create synthetic user B, then match and engage both users"
    $userBPhone = New-TestPhone -Prefix "967"
    $script:UserBToken = Register-TestUser -PhoneNumber $userBPhone -Label "UserB"
    Patch-FullProfile -Token $script:UserBToken -FirstName "VoiceB" -Gender "Woman"
    $headersB = @{ Authorization = "Bearer $script:UserBToken" }

    BestEffort-Leave -Token $script:UserAToken
    BestEffort-Leave -Token $script:UserBToken

    $enterA = Enter-ChatNight -Headers $headersA
    if (-not $enterA.Ok) {
        $detail = Try-GetDetailMessage -RawErrorText "$($enterA.ErrorText)"
        if ($detail -match "(?i)complete your profile") {
            Fail ("UserA /chat-night/enter blocked by profile gating. detail='{0}'. Consider DEV_BYPASS_PHOTOS=true (dev only) or run verify_photos_r2_contract.ps1 first." -f $detail)
        }
        if ($detail -match "(?i)chat night is closed") {
            Fail ("UserA /chat-night/enter blocked: Chat Night is closed. Start backend with CHAT_NIGHT_FORCE_OPEN=true (dev) to run this verifier.")
        }
        Fail ("UserA /chat-night/enter failed. HTTP {0}; detail/error: {1}" -f $enterA.Status, $detail)
    }

    $roomId = $null
    $sawMatchFoundByB = $false
    for ($attempt = 1; $attempt -le 6; $attempt++) {
        $enterB = Enter-ChatNight -Headers $headersB
        if (-not $enterB.Ok) {
            $detail = Try-GetDetailMessage -RawErrorText "$($enterB.ErrorText)"
            if ($detail -match "(?i)chat night is closed") {
                Fail ("UserB /chat-night/enter blocked: Chat Night is closed. Start backend with CHAT_NIGHT_FORCE_OPEN=true (dev) to run this verifier.")
            }
            Fail ("UserB /chat-night/enter failed on attempt {0}. HTTP {1}; detail/error: {2}" -f $attempt, $enterB.Status, $detail)
        }

        $statusB = "$($enterB.Body.status)"
        if ($statusB -eq "match_found") {
            $sawMatchFoundByB = $true
            $roomId = "$($enterB.Body.room_id)"
            break
        }

        if ($statusB -eq "active_room" -and -not [string]::IsNullOrWhiteSpace("$($enterB.Body.room_id)")) {
            $roomId = "$($enterB.Body.room_id)"
        }

        Start-Sleep -Seconds 1
    }

    if (-not $sawMatchFoundByB) { Fail "UserB never received status=match_found after repeated /enter calls." }
    if ([string]::IsNullOrWhiteSpace($roomId)) { Fail "room_id missing after match_found for UserB." }
    Write-Pass ("Chat-night match created with room_id={0}" -f $roomId)

    $engageA = Engage-ChatNight -Headers $headersA -RoomId $roomId
    if (-not $engageA.Ok -or "$($engageA.Body.status)" -ne "success") {
        $err = if ($engageA.Ok) { ($engageA.Body | ConvertTo-Json -Compress) } else { (Try-GetDetailMessage -RawErrorText "$($engageA.ErrorText)") }
        Fail ("UserA engage failed. HTTP {0}; body/error: {1}" -f $engageA.Status, $err)
    }

    $engageB = Engage-ChatNight -Headers $headersB -RoomId $roomId
    if (-not $engageB.Ok -or "$($engageB.Body.status)" -ne "success") {
        $err = if ($engageB.Ok) { ($engageB.Body | ConvertTo-Json -Compress) } else { (Try-GetDetailMessage -RawErrorText "$($engageB.ErrorText)") }
        Fail ("UserB engage failed. HTTP {0}; body/error: {1}" -f $engageB.Status, $err)
    }

    if ("$($engageB.Body.room_state)" -ne "engaged") {
        Fail ("Expected engaged room_state after both engage calls. Got room_state={0}" -f "$($engageB.Body.room_state)")
    }
    Write-Pass "Both users engaged successfully."

    Write-Step "Happy path contract check: POST /api/voice/token should return 200 contract fields"
    $voiceSuccess = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/voice/token" -Headers $headersA
    if (-not $voiceSuccess.Ok) {
        $detail = Try-GetDetailMessage -RawErrorText "$($voiceSuccess.ErrorText)"
        Fail ("Expected HTTP 200 for engaged room voice token. Got HTTP {0}; detail/error: {1}" -f $voiceSuccess.Status, $detail)
    }

    $body = $voiceSuccess.Body
    $token = "$($body.token)"
    $room = "$($body.room)"
    $identity = "$($body.identity)"
    $url = "$($body.url)"

    if ([string]::IsNullOrWhiteSpace($token)) { Fail "Response missing token." }
    $tokenLength = $token.Length
    if ($tokenLength -le 0) { Fail "Token length is zero." }

    if ([string]::IsNullOrWhiteSpace($room)) { Fail "Response missing room." }
    if ([string]::IsNullOrWhiteSpace($identity)) { Fail "Response missing identity." }
    if ([string]::IsNullOrWhiteSpace($url)) { Fail "Response missing url." }

    $expiresIn = 0
    if (-not [int]::TryParse("$($body.expires_in)", [ref] $expiresIn)) {
        Fail ("expires_in is not an integer. Raw value: {0}" -f "$($body.expires_in)")
    }
    if ($expiresIn -le 0 -or $expiresIn -gt 300) {
        Fail ("expires_in must be in range 1..300. Got {0}" -f $expiresIn)
    }

    Write-Pass ("Voice token contract fields verified: token_length={0}, expires_in={1}, room present, identity present, url present." -f $tokenLength, $expiresIn)
    Write-Host "`nPASS: voice token contract verified (enabled mode)." -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ("`nFAIL: {0}" -f $_.Exception.Message) -ForegroundColor Red
    exit 1
}
finally {
    BestEffort-Leave -Token $script:UserAToken
    BestEffort-Leave -Token $script:UserBToken
}