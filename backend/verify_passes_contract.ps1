[CmdletBinding()]
param(
    [string] $BaseUrl = "http://localhost:8000",
    [ValidateSet("enabled", "disabled")]
    [string] $Mode = "enabled",
    [ValidateSet("stub", "google")]
    [string] $ProviderMode = "stub",
    [string] $RealProductId = "",
    [string] $RealPurchaseToken = "",
    [string] $RealOrderId = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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

function Write-Skip {
    param([Parameter(Mandatory = $true)][string] $Message)
    Write-Host "SKIP: $Message" -ForegroundColor Yellow
}

function Fail {
    param([Parameter(Mandatory = $true)][string] $Message)
    throw $Message
}

function Normalize-OptionalString {
    param([AllowNull()] $Value)

    if ($null -eq $Value) {
        return ""
    }

    return "$Value".Trim()
}

function Normalize-BaseUrl {
    param(
        [Parameter(Mandatory = $true)][AllowNull()] $Value,
        [Parameter(Mandatory = $true)][string] $Context
    )

    $normalized = (Normalize-OptionalString -Value $Value).TrimEnd("/")
    if ([string]::IsNullOrWhiteSpace($normalized)) {
        Fail "$Context must be a non-empty absolute http/https URL."
    }

    $uri = $null
    if (-not [Uri]::TryCreate($normalized, [System.UriKind]::Absolute, [ref] $uri)) {
        Fail ("{0} must be a valid absolute URL. Raw value: '{1}'." -f $Context, $normalized)
    }
    if ($uri.Scheme -notin @("http", "https")) {
        Fail ("{0} must use http or https. Raw value: '{1}'." -f $Context, $normalized)
    }

    return $normalized
}

function Resolve-OptionalValueFromEnvironment {
    param(
        [AllowNull()] $ExplicitValue,
        [Parameter(Mandatory = $true)][string[]] $EnvironmentVariableNames
    )

    $explicit = Normalize-OptionalString -Value $ExplicitValue
    if (-not [string]::IsNullOrWhiteSpace($explicit)) {
        return $explicit
    }

    foreach ($name in $EnvironmentVariableNames) {
        $candidate = Normalize-OptionalString -Value ([Environment]::GetEnvironmentVariable($name))
        if (-not [string]::IsNullOrWhiteSpace($candidate)) {
            return $candidate
        }
    }

    return ""
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

function Assert-CatalogContract {
    param(
        [Parameter(Mandatory = $true)] $CatalogResult,
        [Parameter(Mandatory = $true)][string] $ExpectedProviderMode
    )

    Assert-Success -Result $CatalogResult -Context "GET /api/passes/catalog"

    if ("$($CatalogResult.Body.provider_mode)" -ne $ExpectedProviderMode) {
        Fail ("GET /api/passes/catalog provider_mode mismatch. Expected '{0}', got '{1}'." -f $ExpectedProviderMode, "$($CatalogResult.Body.provider_mode)")
    }
    if ("$($CatalogResult.Body.platform)" -ne "android") {
        Fail ("GET /api/passes/catalog platform must be 'android'. Got '{0}'." -f "$($CatalogResult.Body.platform)")
    }

    $products = @()
    if ($CatalogResult.Body -and ($CatalogResult.Body.PSObject.Properties.Name -contains "products") -and $null -ne $CatalogResult.Body.products) {
        $products = @($CatalogResult.Body.products)
    }

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

    Write-Pass ("Authenticated GET /api/passes/catalog returned expected provider_mode={0} and active products: {1}" -f $ExpectedProviderMode, ($expectedIds -join ", "))
}

function Assert-MeContract {
    param(
        [Parameter(Mandatory = $true)] $MeResult,
        [Parameter(Mandatory = $true)][string] $ExpectedProviderMode,
        [Parameter(Mandatory = $true)][int] $ExpectedCredits,
        [Parameter(Mandatory = $true)][string] $ContextLabel
    )

    Assert-Success -Result $MeResult -Context $ContextLabel

    if ("$($MeResult.Body.provider_mode)" -ne $ExpectedProviderMode) {
        Fail ("{0} provider_mode mismatch. Expected '{1}', got '{2}'." -f $ContextLabel, $ExpectedProviderMode, "$($MeResult.Body.provider_mode)")
    }
    if (-not [bool] $MeResult.Body.catalog_available) {
        Fail ("{0} must report catalog_available=true." -f $ContextLabel)
    }

    $wallet = $MeResult.Body.wallet
    if ($null -eq $wallet) {
        Fail ("{0} missing wallet payload." -f $ContextLabel)
    }
    if ([string]::IsNullOrWhiteSpace("$($wallet.user_id)")) {
        Fail ("{0} wallet missing user_id." -f $ContextLabel)
    }

    $credits = Parse-StrictInt -Value $wallet.paid_pass_credits -Context "$ContextLabel wallet.paid_pass_credits"
    if ($credits -ne $ExpectedCredits) {
        Fail ("{0} expected wallet.paid_pass_credits={1}. Got {2}" -f $ContextLabel, $ExpectedCredits, $credits)
    }

    Write-Pass ("{0} returned wallet.paid_pass_credits={1} with provider_mode={2}." -f $ContextLabel, $credits, $ExpectedProviderMode)
    return $wallet
}

function Resolve-OptionalGoogleValidateInput {
    param(
        [AllowNull()] $ProductId,
        [AllowNull()] $PurchaseToken,
        [AllowNull()] $OrderId
    )

    $resolvedProductId = Resolve-OptionalValueFromEnvironment -ExplicitValue $ProductId -EnvironmentVariableNames @("BH_PASSES_REAL_PRODUCT_ID")
    $resolvedPurchaseToken = Resolve-OptionalValueFromEnvironment -ExplicitValue $PurchaseToken -EnvironmentVariableNames @("BH_PASSES_REAL_PURCHASE_TOKEN")
    $resolvedOrderId = Resolve-OptionalValueFromEnvironment -ExplicitValue $OrderId -EnvironmentVariableNames @("BH_PASSES_REAL_ORDER_ID")

    if ([string]::IsNullOrWhiteSpace($resolvedPurchaseToken)) {
        return [pscustomobject]@{
            ShouldAttempt = $false
            ProductId     = $resolvedProductId
            PurchaseToken = ""
            OrderId       = $resolvedOrderId
            SkipReason    = "Real Google validate step skipped because no real purchase token was supplied. Supply -RealProductId and -RealPurchaseToken (or BH_PASSES_REAL_PRODUCT_ID / BH_PASSES_REAL_PURCHASE_TOKEN) to exercise it."
        }
    }

    if ([string]::IsNullOrWhiteSpace($resolvedProductId)) {
        Fail "RealPurchaseToken requires RealProductId. Supply -RealProductId (or BH_PASSES_REAL_PRODUCT_ID) alongside the purchase token."
    }

    return [pscustomobject]@{
        ShouldAttempt = $true
        ProductId     = $resolvedProductId
        PurchaseToken = $resolvedPurchaseToken
        OrderId       = $resolvedOrderId
        SkipReason    = ""
    }
}

$BaseUrl = Normalize-BaseUrl -Value $BaseUrl -Context "BaseUrl"
$realValidateInput = Resolve-OptionalGoogleValidateInput -ProductId $RealProductId -PurchaseToken $RealPurchaseToken -OrderId $RealOrderId

Write-Host "===================================================" -ForegroundColor Yellow
Write-Host " PASSES CONTRACT VERIFIER (W7-T3-H)                " -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "Base URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "Mode: $Mode" -ForegroundColor Cyan
if ($Mode -eq "enabled") {
    Write-Host "Provider Mode: $ProviderMode" -ForegroundColor Cyan
}
else {
    Write-Host "Provider Mode: n/a (disabled mode contract)" -ForegroundColor Cyan
}
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

    $unauthValidateBody = @{
        product_id     = "pass_pack_5"
        purchase_token = "stub-pass_pack_5-unauthcheck"
        order_id       = "STUB-UNAUTH-CHECK"
        platform       = "android"
    }
    $validateNoAuth = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/passes/google/validate" -Body $unauthValidateBody
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

        $validateDisabled = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/passes/google/validate" -Headers $headers -Body $unauthValidateBody
        Assert-FailureStatus -Result $validateDisabled -ExpectedStatuses @(503) -Context "POST /api/passes/google/validate in disabled mode"
        Assert-DetailMentionsDisabled -Result $validateDisabled -Context "POST /api/passes/google/validate in disabled mode"
        Write-Pass "Authenticated POST /api/passes/google/validate returned HTTP 503 in disabled mode."

        Write-Host ""
        Write-Host "PASS: passes contract verified (disabled mode)." -ForegroundColor Green
        exit 0
    }

    Write-Step "Enabled mode checks: GET /api/passes/catalog"
    $catalog = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/passes/catalog" -Headers $headers
    Assert-CatalogContract -CatalogResult $catalog -ExpectedProviderMode $ProviderMode

    Write-Step "Enabled mode checks: GET /api/passes/me"
    $meBefore = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/passes/me" -Headers $headers
    $walletBefore = Assert-MeContract -MeResult $meBefore -ExpectedProviderMode $ProviderMode -ExpectedCredits 0 -ContextLabel "GET /api/passes/me before validation"
    $creditsBefore = Parse-StrictInt -Value $walletBefore.paid_pass_credits -Context "wallet.paid_pass_credits before validation"

    if ($ProviderMode -eq "stub") {
        Write-Step "Enabled mode checks: POST /api/passes/google/validate (stub grant)"
        $suffix = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
        $grantBody = @{
            product_id     = "pass_pack_5"
            purchase_token = "stub-pass_pack_5-$suffix"
            order_id       = "STUB-PASS-PACK-5-$suffix"
            platform       = "android"
        }
        $grantResult = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/passes/google/validate" -Headers $headers -Body $grantBody
        Assert-Success -Result $grantResult -Context "POST /api/passes/google/validate (stub grant)"

        if ([bool] $grantResult.Body.already_granted) {
            Fail "First stub validation must return already_granted=false."
        }
        if ("$($grantResult.Body.provider_mode)" -ne "stub") {
            Fail ("Validation response provider_mode mismatch. Expected 'stub', got '{0}'." -f "$($grantResult.Body.provider_mode)")
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
        $walletAfterGrantRead = Assert-MeContract -MeResult $meAfterGrant -ExpectedProviderMode "stub" -ExpectedCredits $creditsAfterGrant -ContextLabel "GET /api/passes/me after stub grant"
        $creditsAfterGrantRead = Parse-StrictInt -Value $walletAfterGrantRead.paid_pass_credits -Context "wallet.paid_pass_credits after stub grant readback"
        if ($creditsAfterGrantRead -ne $creditsAfterGrant) {
            Fail ("Wallet readback must match validation response balance {0}. Got {1}" -f $creditsAfterGrant, $creditsAfterGrantRead)
        }
        Write-Pass ("Wallet read after stub grant remained at {0} paid credits." -f $creditsAfterGrantRead)

        Write-Step "Enabled mode checks: duplicate validation idempotency"
        $grantRetry = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/passes/google/validate" -Headers $headers -Body $grantBody
        Assert-Success -Result $grantRetry -Context "Duplicate POST /api/passes/google/validate"
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
        Write-Host "PASS: passes contract verified (enabled/stub mode)." -ForegroundColor Green
        exit 0
    }

    Write-Step "Enabled mode checks: google smoke contract"
    if (-not $realValidateInput.ShouldAttempt) {
        Write-Skip $realValidateInput.SkipReason
        Write-Host ""
        Write-Host "PASS: passes contract verified (enabled/google smoke mode)." -ForegroundColor Green
        exit 0
    }

    $realValidateBody = @{
        product_id     = $realValidateInput.ProductId
        purchase_token = $realValidateInput.PurchaseToken
        platform       = "android"
    }
    if (-not [string]::IsNullOrWhiteSpace($realValidateInput.OrderId)) {
        $realValidateBody.order_id = $realValidateInput.OrderId
    }

    Write-Step "Enabled mode checks: POST /api/passes/google/validate (real token)"
    $googleValidate = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/passes/google/validate" -Headers $headers -Body $realValidateBody
    Assert-Success -Result $googleValidate -Context "POST /api/passes/google/validate (real token)"

    if ("$($googleValidate.Body.provider_mode)" -ne "google") {
        Fail ("Validation response provider_mode mismatch. Expected 'google', got '{0}'." -f "$($googleValidate.Body.provider_mode)")
    }
    if ("$($googleValidate.Body.product_id)" -ne $realValidateInput.ProductId) {
        Fail ("Validation response product_id mismatch. Expected '{0}', got '{1}'." -f $realValidateInput.ProductId, "$($googleValidate.Body.product_id)")
    }
    if ("$($googleValidate.Body.platform)" -ne "android") {
        Fail ("Validation response platform must be 'android'. Got '{0}'." -f "$($googleValidate.Body.platform)")
    }

    $googleGrantedUnits = Parse-StrictInt -Value $googleValidate.Body.granted_units -Context "google validation.granted_units"
    if ($googleGrantedUnits -lt 1) {
        Fail ("Google validation must report granted_units >= 1. Got {0}" -f $googleGrantedUnits)
    }

    $googleWallet = $googleValidate.Body.wallet
    if ($null -eq $googleWallet) {
        Fail "Google validation response missing wallet payload."
    }
    $googleWalletCredits = Parse-StrictInt -Value $googleWallet.paid_pass_credits -Context "google wallet.paid_pass_credits"
    $expectedGoogleWalletCredits = if ([bool] $googleValidate.Body.already_granted) { $creditsBefore } else { $creditsBefore + $googleGrantedUnits }
    if ($googleWalletCredits -ne $expectedGoogleWalletCredits) {
        Fail ("Google validation wallet balance mismatch. Expected {0}, got {1}" -f $expectedGoogleWalletCredits, $googleWalletCredits)
    }

    $googlePurchase = $googleValidate.Body.purchase
    if ($null -eq $googlePurchase) {
        Fail "Google validation response missing purchase payload."
    }
    if ("$($googlePurchase.grant_state)" -ne "granted") {
        Fail ("Google validation purchase.grant_state must be granted. Got '{0}'." -f "$($googlePurchase.grant_state)")
    }
    if ("$($googlePurchase.purchase_state)" -ne "PURCHASED") {
        Fail ("Google validation purchase.purchase_state must be PURCHASED. Got '{0}'." -f "$($googlePurchase.purchase_state)")
    }
    Write-Pass ("Google validation succeeded. already_granted={0}; granted_units={1}; wallet={2}." -f ([bool] $googleValidate.Body.already_granted), $googleGrantedUnits, $googleWalletCredits)

    Write-Step "Enabled mode checks: wallet read after Google validation"
    $meAfterGoogleValidate = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/passes/me" -Headers $headers
    $walletAfterGoogleValidate = Assert-MeContract -MeResult $meAfterGoogleValidate -ExpectedProviderMode "google" -ExpectedCredits $googleWalletCredits -ContextLabel "GET /api/passes/me after Google validation"
    $walletAfterGoogleRead = Parse-StrictInt -Value $walletAfterGoogleValidate.paid_pass_credits -Context "wallet.paid_pass_credits after Google validation readback"
    if ($walletAfterGoogleRead -ne $googleWalletCredits) {
        Fail ("Google validation wallet readback mismatch. Expected {0}, got {1}" -f $googleWalletCredits, $walletAfterGoogleRead)
    }

    Write-Host ""
    Write-Host "PASS: passes contract verified (enabled/google mode)." -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ""
    Write-Host ("FAIL: {0}" -f $_.Exception.Message) -ForegroundColor Red
    exit 1
}
