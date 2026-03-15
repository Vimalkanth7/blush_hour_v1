[CmdletBinding()]
param(
    [string] $BaseUrl = "http://localhost:8000",
    [ValidateSet("enabled", "disabled")]
    [string] $Mode = "enabled"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")

$script:Password = "PassesContract123!"
$script:UserToken = $null

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

function New-TestPhone {
    param([Parameter(Mandatory = $true)][string] $Prefix)

    $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
    $tail = $stamp.Substring([Math]::Max(0, $stamp.Length - 7))
    return "+1$Prefix$tail"
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

function Parse-StrictInt {
    param(
        [Parameter(Mandatory = $true)][AllowNull()] $Value,
        [Parameter(Mandatory = $true)][string] $Context
    )

    $parsed = 0
    if (-not [int]::TryParse("$Value", [ref] $parsed)) {
        Fail ("{0} must be an integer. Raw value: {1}" -f $Context, "$Value")
    }
    return $parsed
}

function Assert-DetailMentionsDisabled {
    param(
        [Parameter(Mandatory = $true)] $Result,
        [Parameter(Mandatory = $true)][string] $Context
    )

    $detail = Try-GetDetailMessage -RawErrorText "$($Result.ErrorText)"
    if (-not ($detail -match "(?i)passes.+disabled|disabled.+passes")) {
        Fail ("{0} detail must indicate passes are disabled. detail/error: {1}" -f $Context, $detail)
    }
}

Write-Host "===================================================" -ForegroundColor Yellow
Write-Host " PASSES CONTRACT VERIFIER (W7-T3-D)                " -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "Base URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "Mode: $Mode" -ForegroundColor Cyan
Write-Host "Token output policy: token values are never printed." -ForegroundColor DarkYellow

try {
    Write-Step "Health check (/health)"
    $health = Invoke-JsonApi -Method GET -Uri "$BaseUrl/health"
    if (-not $health.Ok -or -not $health.Body -or "$($health.Body.status)" -ne "healthy") {
        $healthError = if ($health.Ok) { ($health.Body | ConvertTo-Json -Compress) } else { "$($health.ErrorText)" }
        Fail ("GET /health must return status=healthy. HTTP {0}; body/error: {1}" -f $health.Status, $healthError)
    }
    Write-Pass "GET /health returned status=healthy."

    Write-Step "Unauthenticated contract checks"
    $catalogNoAuth = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/passes/catalog"
    Assert-FailureStatus -Result $catalogNoAuth -ExpectedStatuses @(401) -Context "Unauthenticated GET /api/passes/catalog"
    Write-Pass "Unauthenticated GET /api/passes/catalog returned HTTP 401."

    $meNoAuth = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/passes/me"
    Assert-FailureStatus -Result $meNoAuth -ExpectedStatuses @(401) -Context "Unauthenticated GET /api/passes/me"
    Write-Pass "Unauthenticated GET /api/passes/me returned HTTP 401."

    $validateBody = @{
        product_id     = "pass_pack_5"
        purchase_token = "stub-pass_pack_5-unauthcheck"
        order_id       = "STUB-UNAUTH-CHECK"
        platform       = "android"
    }
    $validateNoAuth = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/passes/google/validate" -Body $validateBody
    Assert-FailureStatus -Result $validateNoAuth -ExpectedStatuses @(401) -Context "Unauthenticated POST /api/passes/google/validate"
    Write-Pass "Unauthenticated POST /api/passes/google/validate returned HTTP 401."

    Write-Step "Register synthetic user"
    $phone = New-TestPhone -Prefix "981"
    $script:UserToken = Register-TestUser -PhoneNumber $phone -Label "PassesUser"
    $headers = @{ Authorization = "Bearer $script:UserToken" }

    if ($Mode -eq "disabled") {
        Write-Step "Disabled mode checks"
        $catalogDisabled = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/passes/catalog" -Headers $headers
        Assert-FailureStatus -Result $catalogDisabled -ExpectedStatuses @(503) -Context "GET /api/passes/catalog in disabled mode"
        Assert-DetailMentionsDisabled -Result $catalogDisabled -Context "GET /api/passes/catalog in disabled mode"
        Write-Pass "Authenticated GET /api/passes/catalog returned HTTP 503 in disabled mode."

        $meDisabled = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/passes/me" -Headers $headers
        Assert-FailureStatus -Result $meDisabled -ExpectedStatuses @(503) -Context "GET /api/passes/me in disabled mode"
        Assert-DetailMentionsDisabled -Result $meDisabled -Context "GET /api/passes/me in disabled mode"
        Write-Pass "Authenticated GET /api/passes/me returned HTTP 503 in disabled mode."

        $validateDisabled = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/passes/google/validate" -Headers $headers -Body $validateBody
        Assert-FailureStatus -Result $validateDisabled -ExpectedStatuses @(503) -Context "POST /api/passes/google/validate in disabled mode"
        Assert-DetailMentionsDisabled -Result $validateDisabled -Context "POST /api/passes/google/validate in disabled mode"
        Write-Pass "Authenticated POST /api/passes/google/validate returned HTTP 503 in disabled mode."

        Write-Host ""
        Write-Host "PASS: passes contract verified (disabled mode)." -ForegroundColor Green
        exit 0
    }

    Write-Step "Enabled mode checks: GET /api/passes/catalog"
    $catalog = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/passes/catalog" -Headers $headers
    if (-not $catalog.Ok) {
        $detail = Try-GetDetailMessage -RawErrorText "$($catalog.ErrorText)"
        Fail ("GET /api/passes/catalog failed. HTTP {0}; detail/error: {1}" -f $catalog.Status, $detail)
    }

    if ("$($catalog.Body.provider_mode)" -ne "stub") {
        Fail ("Enabled verifier expects provider_mode=stub. Got '{0}'." -f "$($catalog.Body.provider_mode)")
    }

    $products = @($catalog.Body.products)
    if ($products.Count -lt 3) {
        Fail ("GET /api/passes/catalog must return at least 3 active pass products. Got count={0}" -f $products.Count)
    }

    $expectedIds = @("pass_pack_1", "pass_pack_5", "pass_pack_15")
    foreach ($expectedId in $expectedIds) {
        $match = $products | Where-Object { "$($_.product_id)" -eq $expectedId } | Select-Object -First 1
        if ($null -eq $match) {
            Fail ("Catalog missing expected product_id '{0}'." -f $expectedId)
        }
        if (-not [bool] $match.active) {
            Fail ("Catalog product '{0}' must be active." -f $expectedId)
        }
        if ("$($match.grant_type)" -ne "paid_pass_credits") {
            Fail ("Catalog product '{0}' must use grant_type=paid_pass_credits." -f $expectedId)
        }
        if ("$($match.platform)" -ne "android") {
            Fail ("Catalog product '{0}' must be filtered to platform=android. Got '{1}'." -f $expectedId, "$($match.platform)")
        }
    }
    Write-Pass ("Authenticated GET /api/passes/catalog returned expected active products: {0}" -f ($expectedIds -join ", "))

    Write-Step "Enabled mode checks: GET /api/passes/me"
    $meBefore = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/passes/me" -Headers $headers
    if (-not $meBefore.Ok) {
        $detail = Try-GetDetailMessage -RawErrorText "$($meBefore.ErrorText)"
        Fail ("GET /api/passes/me failed. HTTP {0}; detail/error: {1}" -f $meBefore.Status, $detail)
    }

    $walletBefore = $meBefore.Body.wallet
    if ($null -eq $walletBefore) {
        Fail "GET /api/passes/me missing wallet payload."
    }

    $creditsBefore = Parse-StrictInt -Value $walletBefore.paid_pass_credits -Context "wallet.paid_pass_credits before grant"
    if ($creditsBefore -ne 0) {
        Fail ("Fresh wallet must initialize with paid_pass_credits=0. Got {0}" -f $creditsBefore)
    }
    if ([string]::IsNullOrWhiteSpace("$($walletBefore.user_id)")) {
        Fail "GET /api/passes/me wallet missing user_id."
    }
    Write-Pass "Authenticated GET /api/passes/me returned a zero-balance wallet with paid_pass_credits."

    Write-Step "Enabled mode checks: POST /api/passes/google/validate (stub grant)"
    $suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
    $syntheticToken = "stub-pass_pack_5-$suffix"
    $syntheticOrderId = "STUB-PASS-PACK-5-$suffix"
    $grantBody = @{
        product_id     = "pass_pack_5"
        purchase_token = $syntheticToken
        order_id       = $syntheticOrderId
        platform       = "android"
    }
    $grantResult = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/passes/google/validate" -Headers $headers -Body $grantBody
    if (-not $grantResult.Ok) {
        $detail = Try-GetDetailMessage -RawErrorText "$($grantResult.ErrorText)"
        Fail ("POST /api/passes/google/validate failed. HTTP {0}; detail/error: {1}" -f $grantResult.Status, $detail)
    }

    if ([bool] $grantResult.Body.already_granted) {
        Fail "First stub validation must return already_granted=false."
    }
    if ("$($grantResult.Body.provider_mode)" -ne "stub") {
        Fail ("Validation response provider_mode must be 'stub'. Got '{0}'." -f "$($grantResult.Body.provider_mode)")
    }
    if ("$($grantResult.Body.product_id)" -ne "pass_pack_5") {
        Fail ("Validation response product_id mismatch. Got '{0}'." -f "$($grantResult.Body.product_id)")
    }

    $grantedUnits = Parse-StrictInt -Value $grantResult.Body.granted_units -Context "validation.granted_units"
    if ($grantedUnits -ne 5) {
        Fail ("Validation must grant 5 units for pass_pack_5. Got {0}" -f $grantedUnits)
    }

    $grantWallet = $grantResult.Body.wallet
    if ($null -eq $grantWallet) {
        Fail "Validation response missing wallet payload."
    }
    $creditsAfterGrant = Parse-StrictInt -Value $grantWallet.paid_pass_credits -Context "wallet.paid_pass_credits after grant"
    if ($creditsAfterGrant -ne ($creditsBefore + 5)) {
        Fail ("Wallet after grant must be {0}. Got {1}" -f ($creditsBefore + 5), $creditsAfterGrant)
    }

    $grantPurchase = $grantResult.Body.purchase
    if ($null -eq $grantPurchase) {
        Fail "Validation response missing purchase payload."
    }
    if ("$($grantPurchase.purchase_state)" -ne "PURCHASED") {
        Fail ("Validation response purchase.purchase_state must be PURCHASED. Got '{0}'." -f "$($grantPurchase.purchase_state)")
    }
    if ("$($grantPurchase.grant_state)" -ne "granted") {
        Fail ("Validation response purchase.grant_state must be granted. Got '{0}'." -f "$($grantPurchase.grant_state)")
    }
    if (-not [bool] $grantPurchase.is_test_purchase) {
        Fail "Stub validation response must mark purchase.is_test_purchase=true."
    }
    if ("$($grantPurchase.play_finalization_state)" -ne "not_applicable") {
        Fail ("Stub validation response purchase.play_finalization_state must be not_applicable. Got '{0}'." -f "$($grantPurchase.play_finalization_state)")
    }
    Write-Pass ("Stub validation granted {0} paid credits. Wallet before={1}, after={2}." -f $grantedUnits, $creditsBefore, $creditsAfterGrant)

    Write-Step "Enabled mode checks: wallet read after stub grant"
    $meAfterGrant = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/passes/me" -Headers $headers
    if (-not $meAfterGrant.Ok) {
        $detail = Try-GetDetailMessage -RawErrorText "$($meAfterGrant.ErrorText)"
        Fail ("GET /api/passes/me after grant failed. HTTP {0}; detail/error: {1}" -f $meAfterGrant.Status, $detail)
    }
    $walletAfterGrantRead = $meAfterGrant.Body.wallet
    $creditsAfterGrantRead = Parse-StrictInt -Value $walletAfterGrantRead.paid_pass_credits -Context "wallet.paid_pass_credits after grant readback"
    if ($creditsAfterGrantRead -ne $creditsAfterGrant) {
        Fail ("Wallet readback must match validation response balance {0}. Got {1}" -f $creditsAfterGrant, $creditsAfterGrantRead)
    }
    Write-Pass ("Wallet read after stub grant remained at {0} paid credits." -f $creditsAfterGrantRead)

    Write-Step "Enabled mode checks: duplicate validation idempotency"
    $grantRetry = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/passes/google/validate" -Headers $headers -Body $grantBody
    if (-not $grantRetry.Ok) {
        $detail = Try-GetDetailMessage -RawErrorText "$($grantRetry.ErrorText)"
        Fail ("Duplicate POST /api/passes/google/validate failed. HTTP {0}; detail/error: {1}" -f $grantRetry.Status, $detail)
    }
    if (-not [bool] $grantRetry.Body.already_granted) {
        Fail "Duplicate validation must return already_granted=true."
    }

    $retryGrantedUnits = Parse-StrictInt -Value $grantRetry.Body.granted_units -Context "duplicate validation.granted_units"
    if ($retryGrantedUnits -ne 5) {
        Fail ("Duplicate validation must continue to report 5 units for pass_pack_5. Got {0}" -f $retryGrantedUnits)
    }

    $retryWalletCredits = Parse-StrictInt -Value $grantRetry.Body.wallet.paid_pass_credits -Context "duplicate wallet.paid_pass_credits"
    if ($retryWalletCredits -ne $creditsAfterGrant) {
        Fail ("Duplicate validation must not change the wallet balance. Expected {0}, got {1}" -f $creditsAfterGrant, $retryWalletCredits)
    }
    if ("$($grantRetry.Body.purchase.grant_state)" -ne "granted") {
        Fail ("Duplicate validation purchase.grant_state must remain granted. Got '{0}'." -f "$($grantRetry.Body.purchase.grant_state)")
    }
    Write-Pass ("Duplicate stub validation was idempotent. Wallet stayed at {0} paid credits." -f $retryWalletCredits)

    Write-Host ""
    Write-Host "PASS: passes contract verified (enabled mode)." -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ""
    Write-Host ("FAIL: {0}" -f $_.Exception.Message) -ForegroundColor Red
    exit 1
}
