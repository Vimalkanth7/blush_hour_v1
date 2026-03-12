[CmdletBinding()]
param(
    [string] $BaseUrl = "http://localhost:8000",
    [ValidateSet("enabled", "disabled")]
    [string] $Mode = "enabled"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")

$script:Password = "SafetyAdminContract123!"
$script:RunStamp = Get-Date -Format "yyyyMMddHHmmssfff"
$script:UserAToken = $null
$script:UserBToken = $null
$script:UserCToken = $null
$script:UserDToken = $null
$script:AdminToken = $null
$script:PreviousMinCompletion = $null
$script:RestoreMinCompletion = $false

function Write-Section {
    param([Parameter(Mandatory = $true)][string] $Message)
    Write-Host ""
    Write-Host "===================================================" -ForegroundColor Yellow
    Write-Host " $Message" -ForegroundColor Yellow
    Write-Host "===================================================" -ForegroundColor Yellow
}

function Write-Step {
    param([Parameter(Mandatory = $true)][string] $Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
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
            try {
                return [int] $response.StatusCode
            }
            catch {
                return $null
            }
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
            if ($parsed.detail -is [System.Array]) {
                return ($parsed.detail | ConvertTo-Json -Compress)
            }
            return [string] $parsed.detail
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
        $jsonBody = $Body | ConvertTo-Json -Depth 12 -Compress
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

        return [pscustomobject]@{
            Ok        = $true
            Status    = 200
            Body      = $response
            ErrorText = ""
        }
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

function Get-OptionalProperty {
    param(
        [AllowNull()] $Object,
        [Parameter(Mandatory = $true)][string] $Name
    )

    if ($null -eq $Object) { return $null }

    if ($Object -is [hashtable]) {
        if ($Object.ContainsKey($Name)) { return $Object[$Name] }
        return $null
    }

    if ($Object.PSObject.Properties.Name -contains $Name) {
        return $Object.$Name
    }

    return $null
}

function Assert-Success {
    param(
        [Parameter(Mandatory = $true)] $Result,
        [Parameter(Mandatory = $true)][string] $Context
    )

    if (-not $Result.Ok) {
        $detail = Try-GetDetailMessage -RawErrorText "$($Result.ErrorText)"
        Fail ("{0} failed. HTTP {1}; detail/error: {2}" -f $Context, $Result.Status, $detail)
    }
}

function Assert-FailureStatus {
    param(
        [Parameter(Mandatory = $true)] $Result,
        [Parameter(Mandatory = $true)][int[]] $ExpectedStatuses,
        [Parameter(Mandatory = $true)][string] $Context
    )

    if ($Result.Ok) {
        $body = if ($null -ne $Result.Body) { $Result.Body | ConvertTo-Json -Compress } else { "<no-body>" }
        Fail ("{0} expected failure status [{1}] but request succeeded with body: {2}" -f $Context, ($ExpectedStatuses -join ","), $body)
    }

    $status = 0
    if (-not [int]::TryParse("$($Result.Status)", [ref] $status)) {
        $detail = Try-GetDetailMessage -RawErrorText "$($Result.ErrorText)"
        Fail ("{0} expected HTTP status [{1}] but no status code was captured. detail/error: {2}" -f $Context, ($ExpectedStatuses -join ","), $detail)
    }

    if ($ExpectedStatuses -notcontains $status) {
        $detail = Try-GetDetailMessage -RawErrorText "$($Result.ErrorText)"
        Fail ("{0} expected HTTP status [{1}] but got HTTP {2}. detail/error: {3}" -f $Context, ($ExpectedStatuses -join ","), $status, $detail)
    }
}

function New-TestPhone {
    param([Parameter(Mandatory = $true)][string] $Prefix)

    $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
    $tail = $stamp.Substring([Math]::Max(0, $stamp.Length - 7))
    $suffix = (Get-Random -Minimum 0 -Maximum 9).ToString()
    return "+1$Prefix$tail$suffix"
}

function Register-TestUser {
    param(
        [Parameter(Mandatory = $true)][string] $PhoneNumber,
        [Parameter(Mandatory = $true)][string] $Label
    )

    $body = @{
        phone_number = $PhoneNumber
        password     = $script:Password
    }

    for ($attempt = 1; $attempt -le 2; $attempt++) {
        $result = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/auth/register" -Body $body
        if ($result.Ok -and $result.Body -and -not [string]::IsNullOrWhiteSpace("$($result.Body.access_token)")) {
            Write-Pass "$Label registered and token acquired."
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

function Login-User {
    param(
        [Parameter(Mandatory = $true)][string] $PhoneNumber,
        [Parameter(Mandatory = $true)][string] $Password,
        [Parameter(Mandatory = $true)][string] $Label
    )

    $body = @{
        phone_number = $PhoneNumber
        password     = $Password
    }

    for ($attempt = 1; $attempt -le 2; $attempt++) {
        $result = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/auth/login" -Body $body
        if ($result.Ok -and $result.Body -and -not [string]::IsNullOrWhiteSpace("$($result.Body.access_token)")) {
            Write-Pass "$Label token acquired."
            return [string] $result.Body.access_token
        }

        $detail = Try-GetDetailMessage -RawErrorText "$($result.ErrorText)"
        $rateLimited = ($result.Status -eq 429) -or ($detail -match "(?i)rate limit exceeded")
        if ($rateLimited -and $attempt -lt 2) {
            Write-Host "Login rate limit hit for $Label. Waiting 65s and retrying once..." -ForegroundColor Yellow
            Start-Sleep -Seconds 65
            continue
        }

        Fail ("Login failed for {0}. HTTP {1}; detail/error: {2}" -f $Label, $result.Status, $detail)
    }

    Fail "Login failed for $Label after retry."
}

function Patch-FullProfile {
    param(
        [Parameter(Mandatory = $true)][string] $Token,
        [Parameter(Mandatory = $true)][string] $FirstName,
        [Parameter(Mandatory = $true)][string] $Gender
    )

    $headers = @{ Authorization = "Bearer $Token" }
    $body = @{
        firstName      = $FirstName
        birthday       = "1991-01-01"
        gender         = $Gender
        bio            = "Safety admin contract verification profile."
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
    Assert-Success -Result $result -Context "PATCH /api/users/me ($FirstName)"
}

function Get-UserId {
    param(
        [Parameter(Mandatory = $true)][string] $Token,
        [Parameter(Mandatory = $true)][string] $Label
    )

    $headers = @{ Authorization = "Bearer $Token" }
    $result = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/users/me" -Headers $headers
    Assert-Success -Result $result -Context "GET /api/users/me ($Label)"

    $id = ""
    if ($result.Body.PSObject.Properties.Name -contains "id") {
        $id = "$($result.Body.id)"
    }
    if ([string]::IsNullOrWhiteSpace($id) -and ($result.Body.PSObject.Properties.Name -contains "_id")) {
        $id = "$($result.Body._id)"
    }
    if ([string]::IsNullOrWhiteSpace($id)) {
        Fail "GET /api/users/me ($Label) missing id."
    }
    return $id
}

function Get-AdminTokenFromEnvironment {
    $tokenCandidates = @(
        [Environment]::GetEnvironmentVariable("BH_ADMIN_BEARER_TOKEN"),
        [Environment]::GetEnvironmentVariable("ADMIN_BEARER_TOKEN"),
        [Environment]::GetEnvironmentVariable("ADMIN_TOKEN"),
        [Environment]::GetEnvironmentVariable("BLUSH_ADMIN_TOKEN")
    )

    foreach ($candidate in $tokenCandidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate)) {
            Write-Pass "Admin token acquired from environment."
            return $candidate.Trim()
        }
    }

    $phone = [Environment]::GetEnvironmentVariable("BH_ADMIN_PHONE")
    $password = [Environment]::GetEnvironmentVariable("BH_ADMIN_PASSWORD")
    if ([string]::IsNullOrWhiteSpace($phone) -or [string]::IsNullOrWhiteSpace($password)) {
        $phone = [Environment]::GetEnvironmentVariable("ADMIN_PHONE")
        $password = [Environment]::GetEnvironmentVariable("ADMIN_PASSWORD")
    }

    if (-not [string]::IsNullOrWhiteSpace($phone) -and -not [string]::IsNullOrWhiteSpace($password)) {
        return Login-User -PhoneNumber $phone.Trim() -Password $password -Label "Admin"
    }

    Fail "Admin credentials are required for enabled mode. Set BH_ADMIN_BEARER_TOKEN (or ADMIN_BEARER_TOKEN/ADMIN_TOKEN) OR BH_ADMIN_PHONE+BH_ADMIN_PASSWORD (or ADMIN_PHONE+ADMIN_PASSWORD)."
}

function BestEffort-Leave {
    param([AllowNull()][string] $Token)

    if ([string]::IsNullOrWhiteSpace($Token)) { return }
    $headers = @{ Authorization = "Bearer $Token" }
    $null = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/chat-night/leave" -Headers $headers
}

function Enter-ChatNight {
    param(
        [Parameter(Mandatory = $true)][string] $Token,
        [Parameter(Mandatory = $true)][string] $Label
    )

    $headers = @{ Authorization = "Bearer $Token" }
    $result = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/chat-night/enter" -Headers $headers
    if ($result.Ok) { return $result }

    $detail = Try-GetDetailMessage -RawErrorText "$($result.ErrorText)"
    if ($detail -match "(?i)complete your profile") {
        Fail ("{0} /chat-night/enter blocked by profile gating. detail='{1}'. Consider DEV_BYPASS_PHOTOS=true (dev only) or run verify_photos_r2_contract.ps1 first." -f $Label, $detail)
    }
    if ($detail -match "(?i)chat night is closed") {
        Fail ("{0} /chat-night/enter blocked: Chat Night is closed. Start backend with CHAT_NIGHT_FORCE_OPEN=true for this verifier." -f $Label)
    }

    Fail ("{0} /chat-night/enter failed. HTTP {1}; detail/error: {2}" -f $Label, $result.Status, $detail)
}

function Get-MyRoom {
    param(
        [Parameter(Mandatory = $true)][string] $Token,
        [Parameter(Mandatory = $true)][string] $Label
    )

    $headers = @{ Authorization = "Bearer $Token" }
    $result = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/chat-night/my-room" -Headers $headers
    Assert-Success -Result $result -Context "GET /api/chat-night/my-room ($Label)"
    return $result.Body
}

function Get-Room {
    param(
        [Parameter(Mandatory = $true)][string] $Token,
        [Parameter(Mandatory = $true)][string] $RoomId,
        [Parameter(Mandatory = $true)][string] $Label
    )

    $headers = @{ Authorization = "Bearer $Token" }
    $result = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/chat-night/room/$RoomId" -Headers $headers
    Assert-Success -Result $result -Context "GET /api/chat-night/room/$RoomId ($Label)"
    return $result.Body
}

function Engage-Room {
    param(
        [Parameter(Mandatory = $true)][string] $Token,
        [Parameter(Mandatory = $true)][string] $RoomId,
        [Parameter(Mandatory = $true)][string] $Label
    )

    $headers = @{ Authorization = "Bearer $Token" }
    $body = @{ room_id = $RoomId }
    $result = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/chat-night/engage" -Headers $headers -Body $body
    Assert-Success -Result $result -Context "POST /api/chat-night/engage ($Label)"

    if ("$($result.Body.status)" -ne "success") {
        Fail ("POST /api/chat-night/engage ($Label) expected status=success, got: {0}" -f ($result.Body | ConvertTo-Json -Compress))
    }

    return $result.Body
}

function Find-ReportInQueue {
    param(
        [Parameter(Mandatory = $true)][string] $AdminToken,
        [Parameter(Mandatory = $true)][string] $ReporterUserId,
        [Parameter(Mandatory = $true)][string] $ReportedUserId,
        [Parameter(Mandatory = $true)][string] $Status,
        [Parameter(Mandatory = $true)][string] $Category
    )

    $headers = @{ Authorization = "Bearer $AdminToken" }
    $uri = "$BaseUrl/api/admin/reports?status=$Status&limit=100"
    $listResult = Invoke-JsonApi -Method GET -Uri $uri -Headers $headers
    Assert-Success -Result $listResult -Context "GET /api/admin/reports?status=$Status"

    $reports = @($listResult.Body.reports)
    $match = $reports | Where-Object {
        "$($_.reporter_user_id)" -eq $ReporterUserId -and
        "$($_.reported_user_id)" -eq $ReportedUserId -and
        "$($_.status)" -eq $Status -and
        "$($_.category)" -eq $Category
    } | Select-Object -First 1

    return $match
}

function Assert-BlockedFailure {
    param(
        [Parameter(Mandatory = $true)] $Result,
        [Parameter(Mandatory = $true)][string] $Context
    )

    Assert-FailureStatus -Result $Result -ExpectedStatuses @(403) -Context $Context
    $detail = Try-GetDetailMessage -RawErrorText "$($Result.ErrorText)"
    if (-not ($detail -match "(?i)(block|unavailable|no longer available|match is unavailable|room is no longer available)")) {
        Fail ("{0} returned 403 but detail did not indicate blocked/unavailable semantics. detail/error: {1}" -f $Context, $detail)
    }
}

Write-Section "SAFETY / ADMIN CONTRACT VERIFIER (W7-T5-D)"
Write-Host "Base URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "Mode: $Mode" -ForegroundColor Cyan
Write-Host "Token output policy: token values are never printed." -ForegroundColor DarkYellow

try {
    Write-Step "Health check (/health)"
    $health = Invoke-JsonApi -Method GET -Uri "$BaseUrl/health"
    Assert-Success -Result $health -Context "GET /health"
    if ("$($health.Body.status)" -ne "healthy") {
        Fail ("GET /health must return status=healthy. Got: {0}" -f ($health.Body | ConvertTo-Json -Compress))
    }
    Write-Pass "GET /health returned status=healthy."

    Write-Step "Unauthenticated contract checks"
    $placeholderUserId = "507f1f77bcf86cd799439011"
    $unauthBlock = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/safety/block" -Body @{ target_user_id = $placeholderUserId }
    Assert-FailureStatus -Result $unauthBlock -ExpectedStatuses @(401) -Context "Unauthenticated POST /api/safety/block"
    Write-Pass "Unauthenticated POST /api/safety/block returned HTTP 401."

    $unauthReport = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/safety/report" -Body @{ target_user_id = $placeholderUserId; category = "spam" }
    Assert-FailureStatus -Result $unauthReport -ExpectedStatuses @(401) -Context "Unauthenticated POST /api/safety/report"
    Write-Pass "Unauthenticated POST /api/safety/report returned HTTP 401."

    $unauthAdmin = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/admin/reports"
    Assert-FailureStatus -Result $unauthAdmin -ExpectedStatuses @(401, 403) -Context "Unauthenticated GET /api/admin/reports"
    Write-Pass "Unauthenticated GET /api/admin/reports returned HTTP 401/403."

    Write-Step "Register synthetic users A/B/C/D and patch full profiles"
    $userAPhone = New-TestPhone -Prefix "951"
    $userBPhone = New-TestPhone -Prefix "952"
    $userCPhone = New-TestPhone -Prefix "953"
    $userDPhone = New-TestPhone -Prefix "954"

    $script:UserAToken = Register-TestUser -PhoneNumber $userAPhone -Label "User A"
    $script:UserBToken = Register-TestUser -PhoneNumber $userBPhone -Label "User B"
    $script:UserCToken = Register-TestUser -PhoneNumber $userCPhone -Label "User C"
    $script:UserDToken = Register-TestUser -PhoneNumber $userDPhone -Label "User D"

    Patch-FullProfile -Token $script:UserAToken -FirstName "SafetyA" -Gender "Man"
    Patch-FullProfile -Token $script:UserBToken -FirstName "SafetyB" -Gender "Woman"
    Patch-FullProfile -Token $script:UserCToken -FirstName "SafetyC" -Gender "Man"
    Patch-FullProfile -Token $script:UserDToken -FirstName "SafetyD" -Gender "Woman"
    Write-Pass "Synthetic users created and profile patch completed."

    $headersA = @{ Authorization = "Bearer $script:UserAToken" }
    $headersB = @{ Authorization = "Bearer $script:UserBToken" }
    $headersC = @{ Authorization = "Bearer $script:UserCToken" }
    $headersD = @{ Authorization = "Bearer $script:UserDToken" }

    $userAId = Get-UserId -Token $script:UserAToken -Label "User A"
    $userBId = Get-UserId -Token $script:UserBToken -Label "User B"
    $userCId = Get-UserId -Token $script:UserCToken -Label "User C"
    $userDId = Get-UserId -Token $script:UserDToken -Label "User D"
    Write-Pass "Resolved user ids for A/B/C/D."

    if ($Mode -eq "disabled") {
        Write-Step "Disabled mode checks (BH_SAFETY_TOOLS_ENABLED=false)"

        $reportDisabled = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/safety/report" -Headers $headersA -Body @{
            target_user_id = $userBId
            category       = "spam"
            details        = "disabled-mode-report-$script:RunStamp"
        }
        Assert-FailureStatus -Result $reportDisabled -ExpectedStatuses @(503) -Context "POST /api/safety/report in disabled mode"
        Write-Pass "Authenticated POST /api/safety/report returned HTTP 503."

        $muteDisabled = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/safety/mute" -Headers $headersA -Body @{
            target_user_id = $userBId
        }
        Assert-FailureStatus -Result $muteDisabled -ExpectedStatuses @(503) -Context "POST /api/safety/mute in disabled mode"
        Write-Pass "Authenticated POST /api/safety/mute returned HTTP 503."

        $mutesDisabled = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/safety/mutes" -Headers $headersA
        Assert-FailureStatus -Result $mutesDisabled -ExpectedStatuses @(503) -Context "GET /api/safety/mutes in disabled mode"
        Write-Pass "Authenticated GET /api/safety/mutes returned HTTP 503."

        $blockStillOn = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/safety/block" -Headers $headersA -Body @{
            target_user_id = $userBId
        }
        Assert-Success -Result $blockStillOn -Context "POST /api/safety/block in disabled mode"
        if ("$($blockStillOn.Body.status)" -ne "ok") {
            Fail ("POST /api/safety/block in disabled mode expected status=ok, got: {0}" -f ($blockStillOn.Body | ConvertTo-Json -Compress))
        }
        Write-Pass "Authenticated POST /api/safety/block still returned HTTP 200."

        Write-Host ""
        Write-Host "PASS: safety/admin contract verifier completed (disabled mode)." -ForegroundColor Green
        exit 0
    }

    Write-Step "Enabled mode: Block contract"
    $blockFirst = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/safety/block" -Headers $headersA -Body @{
        target_user_id = $userBId
    }
    Assert-Success -Result $blockFirst -Context "First POST /api/safety/block"
    if ("$($blockFirst.Body.status)" -ne "ok") {
        Fail ("First POST /api/safety/block expected status=ok, got: {0}" -f ($blockFirst.Body | ConvertTo-Json -Compress))
    }

    $blockSecond = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/safety/block" -Headers $headersA -Body @{
        target_user_id = $userBId
    }
    Assert-Success -Result $blockSecond -Context "Second POST /api/safety/block (idempotent)"
    if ("$($blockSecond.Body.status)" -ne "ok") {
        Fail ("Second POST /api/safety/block expected status=ok, got: {0}" -f ($blockSecond.Body | ConvertTo-Json -Compress))
    }

    $blockList = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/safety/blocks" -Headers $headersA
    Assert-Success -Result $blockList -Context "GET /api/safety/blocks"
    $matchCount = @($blockList.Body.blocks | Where-Object { "$($_.target_user_id)" -eq $userBId }).Count
    if ($matchCount -ne 1) {
        Fail ("GET /api/safety/blocks expected exactly one block for user B. Found count={0}" -f $matchCount)
    }
    Write-Pass "Block idempotency and list uniqueness verified."

    Write-Step "Enabled mode: Report contract"
    $report1Category = "spam"
    $report1Details = "w7-t5-d-report-1-$script:RunStamp"
    $report1Create = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/safety/report" -Headers $headersA -Body @{
        target_user_id = $userBId
        category       = $report1Category
        details        = $report1Details
    }
    Assert-Success -Result $report1Create -Context "POST /api/safety/report (report #1)"
    if ("$($report1Create.Body.status)" -ne "ok") {
        Fail ("POST /api/safety/report expected status=ok, got: {0}" -f ($report1Create.Body | ConvertTo-Json -Compress))
    }
    Write-Pass "Report creation succeeded while safety tools are enabled."

    Write-Step "Enabled mode: Acquire admin token via repo/dev auth pattern"
    $script:AdminToken = Get-AdminTokenFromEnvironment
    $headersAdmin = @{ Authorization = "Bearer $script:AdminToken" }

    $adminQueueSmoke = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/admin/reports?limit=5" -Headers $headersAdmin
    Assert-Success -Result $adminQueueSmoke -Context "GET /api/admin/reports as admin"
    Write-Pass "Admin queue access works with acquired admin token."

    $togglesRead = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/admin/toggles" -Headers $headersAdmin
    Assert-Success -Result $togglesRead -Context "GET /api/admin/toggles"
    if ($togglesRead.Body.dynamic_overrides -and ($togglesRead.Body.dynamic_overrides.PSObject.Properties.Name -contains "PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT")) {
        $script:PreviousMinCompletion = "$($togglesRead.Body.dynamic_overrides.PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT)"
        $script:RestoreMinCompletion = -not [string]::IsNullOrWhiteSpace($script:PreviousMinCompletion)
    }

    $setMinCompletion = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/admin/toggles" -Headers $headersAdmin -Body @{
        key   = "PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT"
        value = "0"
    }
    Assert-Success -Result $setMinCompletion -Context "POST /api/admin/toggles (PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT=0)"
    Write-Pass "Set PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT to 0 for deterministic room/voice enforcement checks."

    $report1Record = Find-ReportInQueue -AdminToken $script:AdminToken -ReporterUserId $userAId -ReportedUserId $userBId -Status "open" -Category $report1Category
    if ($null -eq $report1Record -or [string]::IsNullOrWhiteSpace("$($report1Record.id)")) {
        Fail "Could not locate report #1 in admin open queue."
    }
    $report1Id = "$($report1Record.id)"
    Write-Pass "Resolved report #1 id via admin queue lookup."

    Write-Step "Enabled mode: Non-admin moderation endpoints reject access"
    $nonAdminList = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/admin/reports" -Headers $headersA
    Assert-FailureStatus -Result $nonAdminList -ExpectedStatuses @(401, 403) -Context "Non-admin GET /api/admin/reports"

    $nonAdminDetail = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/admin/reports/$report1Id" -Headers $headersA
    Assert-FailureStatus -Result $nonAdminDetail -ExpectedStatuses @(401, 403) -Context "Non-admin GET /api/admin/reports/{id}"

    $nonAdminResolve = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/admin/reports/$report1Id/resolve" -Headers $headersA -Body @{
        resolution = "dismissed"
    }
    Assert-FailureStatus -Result $nonAdminResolve -ExpectedStatuses @(401, 403) -Context "Non-admin POST /api/admin/reports/{id}/resolve"
    Write-Pass "Non-admin moderation endpoints correctly rejected."

    Write-Step "Enabled mode: Admin detail/resolve flow"
    $report1Detail = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/admin/reports/$report1Id" -Headers $headersAdmin
    Assert-Success -Result $report1Detail -Context "Admin GET /api/admin/reports/$report1Id"
    if ("$($report1Detail.Body.id)" -ne $report1Id) {
        Fail "Admin report detail returned mismatched id for report #1."
    }
    if ("$($report1Detail.Body.status)" -ne "open") {
        Fail ("Admin report detail expected status=open before resolve. Got '{0}'." -f "$($report1Detail.Body.status)")
    }
    Write-Pass "Admin detail endpoint returned report #1."

    $resolveDismissed = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/admin/reports/$report1Id/resolve" -Headers $headersAdmin -Body @{
        resolution = "dismissed"
    }
    Assert-Success -Result $resolveDismissed -Context "Admin resolve report #1 as dismissed"
    if ("$($resolveDismissed.Body.status)" -ne "resolved") {
        Fail ("Resolve report #1 expected status=resolved. Got: {0}" -f ($resolveDismissed.Body | ConvertTo-Json -Compress))
    }
    if ("$($resolveDismissed.Body.report.resolution)" -ne "dismissed") {
        Fail ("Resolve report #1 expected resolution=dismissed. Got: {0}" -f "$($resolveDismissed.Body.report.resolution)")
    }
    Write-Pass "Admin resolved report #1 as dismissed."

    $report2Category = "harassment"
    $report2Details = "w7-t5-d-report-2-$script:RunStamp"
    $report2Create = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/safety/report" -Headers $headersA -Body @{
        target_user_id = $userBId
        category       = $report2Category
        details        = $report2Details
    }
    Assert-Success -Result $report2Create -Context "POST /api/safety/report (report #2)"
    if ("$($report2Create.Body.status)" -ne "ok") {
        Fail ("POST /api/safety/report for report #2 expected status=ok. Got: {0}" -f ($report2Create.Body | ConvertTo-Json -Compress))
    }

    $report2Record = Find-ReportInQueue -AdminToken $script:AdminToken -ReporterUserId $userAId -ReportedUserId $userBId -Status "open" -Category $report2Category
    if ($null -eq $report2Record -or [string]::IsNullOrWhiteSpace("$($report2Record.id)")) {
        Fail "Could not locate report #2 in admin open queue."
    }
    $report2Id = "$($report2Record.id)"
    Write-Pass "Resolved report #2 id via admin queue lookup."

    $report2Detail = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/admin/reports/$report2Id" -Headers $headersAdmin
    Assert-Success -Result $report2Detail -Context "Admin GET /api/admin/reports/$report2Id"
    if ("$($report2Detail.Body.id)" -ne $report2Id) {
        Fail "Admin report detail returned mismatched id for report #2."
    }

    $resolveBan = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/admin/reports/$report2Id/resolve" -Headers $headersAdmin -Body @{
        resolution = "banned_user"
    }
    Assert-Success -Result $resolveBan -Context "Admin resolve report #2 as banned_user"
    if ("$($resolveBan.Body.status)" -ne "resolved") {
        Fail ("Resolve report #2 expected status=resolved. Got: {0}" -f ($resolveBan.Body | ConvertTo-Json -Compress))
    }
    if ("$($resolveBan.Body.report.resolution)" -ne "banned_user") {
        Fail ("Resolve report #2 expected resolution=banned_user. Got: {0}" -f "$($resolveBan.Body.report.resolution)")
    }
    Write-Pass "Admin resolved report #2 as banned_user."

    $bannedUserProbe = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/users/me" -Headers $headersB
    Assert-FailureStatus -Result $bannedUserProbe -ExpectedStatuses @(403) -Context "Banned reported user access check (GET /api/users/me)"
    $bannedDetail = Try-GetDetailMessage -RawErrorText "$($bannedUserProbe.ErrorText)"
    if (-not ($bannedDetail -match "(?i)banned")) {
        Fail ("Reported user access was denied but detail does not indicate ban. detail/error: {0}" -f $bannedDetail)
    }
    Write-Pass "Reported user became banned after banned_user resolution."

    Write-Step "Enabled mode: Blocked pair enforcement in room and voice flows"
    BestEffort-Leave -Token $script:UserCToken
    BestEffort-Leave -Token $script:UserDToken

    $enterC = Enter-ChatNight -Token $script:UserCToken -Label "User C"
    $statusC = [string] (Get-OptionalProperty -Object $enterC.Body -Name "status")
    if (($statusC -ne "queued") -and ($statusC -ne "match_found") -and ($statusC -ne "active_room")) {
        Fail ("User C /chat-night/enter unexpected status '{0}'. body: {1}" -f $statusC, ($enterC.Body | ConvertTo-Json -Compress))
    }

    $roomId = ""
    $enterCRoomId = [string] (Get-OptionalProperty -Object $enterC.Body -Name "room_id")
    if (-not [string]::IsNullOrWhiteSpace($enterCRoomId)) {
        $roomId = $enterCRoomId
    }

    for ($attempt = 1; $attempt -le 3 -and [string]::IsNullOrWhiteSpace($roomId); $attempt++) {
        $enterD = Enter-ChatNight -Token $script:UserDToken -Label "User D"
        $statusD = [string] (Get-OptionalProperty -Object $enterD.Body -Name "status")
        if (($statusD -ne "queued") -and ($statusD -ne "match_found") -and ($statusD -ne "active_room")) {
            Fail ("User D /chat-night/enter unexpected status '{0}'. body: {1}" -f $statusD, ($enterD.Body | ConvertTo-Json -Compress))
        }

        $enterDRoomId = [string] (Get-OptionalProperty -Object $enterD.Body -Name "room_id")
        if (-not [string]::IsNullOrWhiteSpace($enterDRoomId)) {
            $roomId = $enterDRoomId
            break
        }

        Start-Sleep -Seconds 1
    }

    if ([string]::IsNullOrWhiteSpace($roomId)) {
        for ($attempt = 1; $attempt -le 6 -and [string]::IsNullOrWhiteSpace($roomId); $attempt++) {
            $myRoomC = Get-MyRoom -Token $script:UserCToken -Label "User C"
            $myRoomCRoomId = [string] (Get-OptionalProperty -Object $myRoomC -Name "room_id")
            if (-not [string]::IsNullOrWhiteSpace($myRoomCRoomId)) {
                $roomId = $myRoomCRoomId
                break
            }

            $myRoomD = Get-MyRoom -Token $script:UserDToken -Label "User D"
            $myRoomDRoomId = [string] (Get-OptionalProperty -Object $myRoomD -Name "room_id")
            if (-not [string]::IsNullOrWhiteSpace($myRoomDRoomId)) {
                $roomId = $myRoomDRoomId
                break
            }

            Start-Sleep -Seconds 1
        }
    }

    if ([string]::IsNullOrWhiteSpace($roomId)) {
        Fail "Could not establish chat-night room for users C/D."
    }
    Write-Pass "Room established for users C/D."

    $engageC = Engage-Room -Token $script:UserCToken -RoomId $roomId -Label "User C"
    $engageD = Engage-Room -Token $script:UserDToken -RoomId $roomId -Label "User D"
    if ("$($engageD.room_state)" -ne "engaged") {
        $roomNow = Get-Room -Token $script:UserCToken -RoomId $roomId -Label "User C post-engage"
        if ("$($roomNow.state)" -ne "engaged") {
            Fail ("Expected engaged room for users C/D before block. Current state: {0}" -f "$($roomNow.state)")
        }
    }
    Write-Pass "Users C/D engaged in active room."

    $blockCD = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/safety/block" -Headers $headersC -Body @{
        target_user_id = $userDId
    }
    Assert-Success -Result $blockCD -Context "POST /api/safety/block (C blocks D)"
    if ("$($blockCD.Body.status)" -ne "ok") {
        Fail ("POST /api/safety/block (C->D) expected status=ok, got: {0}" -f ($blockCD.Body | ConvertTo-Json -Compress))
    }
    Write-Pass "User C blocked user D after engage."

    $myRoomBlocked = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/chat-night/my-room" -Headers $headersC
    Assert-BlockedFailure -Result $myRoomBlocked -Context "GET /api/chat-night/my-room after block"

    $roomBlocked = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/chat-night/room/$roomId" -Headers $headersC
    Assert-BlockedFailure -Result $roomBlocked -Context "GET /api/chat-night/room/{room_id} after block"

    $engageBlocked = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/chat-night/engage" -Headers $headersC -Body @{
        room_id = $roomId
    }
    Assert-BlockedFailure -Result $engageBlocked -Context "POST /api/chat-night/engage after block"

    $voiceBlocked = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/voice/token" -Headers $headersC
    if (-not $voiceBlocked.Ok -and $voiceBlocked.Status -eq 503) {
        $detail503 = Try-GetDetailMessage -RawErrorText "$($voiceBlocked.ErrorText)"
        Fail ("POST /api/voice/token returned 503 instead of 403. Voice feature must be enabled/configured for this contract. detail/error: {0}" -f $detail503)
    }
    Assert-BlockedFailure -Result $voiceBlocked -Context "POST /api/voice/token after block"
    Write-Pass "Blocked pair enforced across chat-night room/engage and voice token endpoints."

    Write-Host ""
    Write-Host "PASS: safety/admin contract verifier completed (enabled mode)." -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ""
    Write-Host ("FAIL: {0}" -f $_.Exception.Message) -ForegroundColor Red
    exit 1
}
finally {
    if (-not [string]::IsNullOrWhiteSpace($script:AdminToken) -and $script:RestoreMinCompletion) {
        $restoreHeaders = @{ Authorization = "Bearer $script:AdminToken" }
        $null = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/admin/toggles" -Headers $restoreHeaders -Body @{
            key   = "PROFILE_MIN_COMPLETION_FOR_CHAT_NIGHT"
            value = $script:PreviousMinCompletion
        }
    }
    BestEffort-Leave -Token $script:UserAToken
    BestEffort-Leave -Token $script:UserBToken
    BestEffort-Leave -Token $script:UserCToken
    BestEffort-Leave -Token $script:UserDToken
}
