[CmdletBinding()]
param(
    [string] $BaseUrl = "http://localhost:8000"
)

<#
Prerequisites (test OTP mode):
  - Backend is running
  - SECRET_KEY is set
  - BH_OTP_ENABLED=true
  - BH_OTP_PROVIDER=test
  - BH_OTP_TEST_CODE=000000
  - CHAT_NIGHT_TEST_MODE=true

Usage:
  backend\verify_otp_login_contract.ps1 -BaseUrl "http://localhost:8000"
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:HasFailure = $false
$script:FailureMessages = @()
$BaseUrl = $BaseUrl.TrimEnd("/")
$effectiveTestCode = if ([string]::IsNullOrWhiteSpace($env:BH_OTP_TEST_CODE)) { "000000" } else { $env:BH_OTP_TEST_CODE.Trim() }

function Write-Step {
    param([Parameter(Mandatory = $true)][string] $Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Pass {
    param([Parameter(Mandatory = $true)][string] $Message)
    Write-Host "PASS: $Message" -ForegroundColor Green
}

function Write-Fail {
    param([Parameter(Mandatory = $true)][string] $Message)
    $script:HasFailure = $true
    $script:FailureMessages += $Message
    Write-Host "FAIL: $Message" -ForegroundColor Red
}

function Get-HttpStatusCodeFromError {
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.ErrorRecord] $ErrorRecord
    )

    $exception = $ErrorRecord.Exception
    if ($null -eq $exception) {
        return $null
    }

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
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.ErrorRecord] $ErrorRecord
    )

    if ($ErrorRecord.ErrorDetails -and -not [string]::IsNullOrWhiteSpace("$($ErrorRecord.ErrorDetails.Message)")) {
        return "$($ErrorRecord.ErrorDetails.Message)"
    }

    $exception = $ErrorRecord.Exception
    if ($null -eq $exception) {
        return "$ErrorRecord"
    }

    if ($exception.PSObject.Properties.Name -contains "Response") {
        $response = $exception.Response

        if ($null -ne $response -and $response.PSObject.Properties.Name -contains "Content") {
            $content = "$($response.Content)"
            if (-not [string]::IsNullOrWhiteSpace($content)) {
                return $content
            }
        }

        if ($response -is [System.Net.HttpWebResponse]) {
            try {
                $stream = $response.GetResponseStream()
                if ($null -ne $stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $text = $reader.ReadToEnd()
                    $reader.Dispose()
                    $stream.Dispose()
                    if (-not [string]::IsNullOrWhiteSpace($text)) {
                        return $text
                    }
                }
            }
            catch {
                # Fall back to exception message.
            }
        }
    }

    return "$($exception.Message)"
}

function Try-GetDetailMessage {
    param([string] $RawErrorText)
    if ([string]::IsNullOrWhiteSpace($RawErrorText)) {
        return ""
    }

    try {
        $parsed = $RawErrorText | ConvertFrom-Json -ErrorAction Stop
        if ($parsed -and ($parsed.PSObject.Properties.Name -contains "detail")) {
            return "$($parsed.detail)"
        }
    }
    catch {
        # Keep raw text fallback.
    }

    return $RawErrorText
}

function Invoke-JsonApi {
    param(
        [Parameter(Mandatory = $true)][ValidateSet("GET", "POST", "PUT", "PATCH", "DELETE")] [string] $Method,
        [Parameter(Mandatory = $true)][string] $Uri,
        [AllowNull()] $Body
    )

    $jsonBody = $null
    if ($null -ne $Body) {
        $jsonBody = $Body | ConvertTo-Json -Depth 10 -Compress
    }

    try {
        if ($null -ne $jsonBody) {
            $response = Invoke-RestMethod -Uri $Uri -Method $Method -ContentType "application/json" -Body $jsonBody -ErrorAction Stop
        }
        else {
            $response = Invoke-RestMethod -Uri $Uri -Method $Method -ErrorAction Stop
        }

        return [pscustomobject]@{
            Ok        = $true
            Status    = 200
            Body      = $response
            ErrorText = $null
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

function Get-ResultBodyOrErrorText {
    param($Result)

    if ($null -eq $Result) {
        return "<no result>"
    }

    if (-not [string]::IsNullOrWhiteSpace("$($Result.ErrorText)")) {
        return "$($Result.ErrorText)"
    }

    if ($null -ne $Result.Body) {
        return ($Result.Body | ConvertTo-Json -Compress)
    }

    return "<empty>"
}

Write-Host "=== Blush Hour QA Verifier: OTP Login Contract (W7-T1-C) ===" -ForegroundColor White
Write-Host "BaseUrl: $BaseUrl"
Write-Host "Prerequisites (test mode):"
Write-Host " - SECRET_KEY is set"
Write-Host " - BH_OTP_ENABLED=true"
Write-Host " - BH_OTP_PROVIDER=test"
Write-Host " - BH_OTP_TEST_CODE=000000"
Write-Host " - CHAT_NIGHT_TEST_MODE=true"
Write-Host " - Effective verify code used by this script: $effectiveTestCode"

Write-Step "Health check (/health)"
$health = Invoke-JsonApi -Method GET -Uri "$BaseUrl/health" -Body $null
if ($health.Ok -and $health.Body -and "$($health.Body.status)" -eq "healthy") {
    Write-Pass "GET /health returned status=healthy."
}
else {
    Write-Fail ("GET /health expected status=healthy. HTTP {0}; Body/Error: {1}" -f $health.Status, (Get-ResultBodyOrErrorText -Result $health))
}

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
$tailLength = [Math]::Min(7, $stamp.Length)
$tail = $stamp.Substring($stamp.Length - $tailLength, $tailLength)
$phone = "+91999$tail"

Write-Step "OTP start (/api/auth/otp/start) with fresh phone $phone"
$startBody = @{ phone = $phone }
$startResult = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/auth/otp/start" -Body $startBody
if ($startResult.Ok -and $startResult.Body -and "$($startResult.Body.status)" -eq "sent") {
    Write-Pass "POST /api/auth/otp/start returned status=sent."
}
else {
    Write-Fail ("POST /api/auth/otp/start expected status=sent. HTTP {0}; Body/Error: {1}" -f $startResult.Status, (Get-ResultBodyOrErrorText -Result $startResult))
}

Write-Step "OTP verify success (/api/auth/otp/verify) using test code"
$verifyBody = @{
    phone = $phone
    code  = $effectiveTestCode
}
$verifyResult = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/auth/otp/verify" -Body $verifyBody
$hasAccessToken = $verifyResult.Ok -and $verifyResult.Body -and ($verifyResult.Body.PSObject.Properties.Name -contains "access_token") -and (-not [string]::IsNullOrWhiteSpace("$($verifyResult.Body.access_token)"))
if ($hasAccessToken) {
    Write-Pass "POST /api/auth/otp/verify returned access_token (redacted)."
}
else {
    Write-Fail ("POST /api/auth/otp/verify expected access_token. HTTP {0}; Body/Error: {1}" -f $verifyResult.Status, (Get-ResultBodyOrErrorText -Result $verifyResult))
}

Write-Step "Invalid code contract check (/api/auth/otp/verify with 111111)"
$invalidBody = @{
    phone = $phone
    code  = "111111"
}
$invalidResult = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/auth/otp/verify" -Body $invalidBody
$invalidDetail = Try-GetDetailMessage -RawErrorText $invalidResult.ErrorText
if ((-not $invalidResult.Ok) -and $invalidResult.Status -eq 400 -and $invalidDetail -match "(?i)invalid code") {
    Write-Pass "Invalid code returns HTTP 400 with detail containing 'Invalid code'."
}
else {
    $detailForReport = if ([string]::IsNullOrWhiteSpace($invalidDetail)) { "<empty>" } else { $invalidDetail }
    Write-Fail ("Invalid code expected HTTP 400 with 'Invalid code'. Got HTTP {0}; detail/error: {1}" -f $invalidResult.Status, $detailForReport)
}

Write-Step "Rate limit check on /api/auth/otp/start (4 rapid calls)"
$rateStatuses = @()
$rateLimited = $false
for ($i = 1; $i -le 4; $i++) {
    $rateResult = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/auth/otp/start" -Body $startBody
    $status = if ($rateResult.Ok) { 200 } else { $rateResult.Status }
    if ($null -eq $status) { $status = -1 }
    $rateStatuses += $status
    Write-Host ("Attempt {0}: HTTP {1}" -f $i, $status)
    if ($status -eq 429) {
        $rateLimited = $true
    }
}

if ($rateLimited) {
    Write-Pass ("Rate limiter triggered on /otp/start within 4 attempts. Statuses: {0}" -f ($rateStatuses -join ", "))
}
else {
    Write-Fail ("Expected at least one HTTP 429 by 4th rapid /otp/start call. Statuses: {0}" -f ($rateStatuses -join ", "))
}

if ($script:HasFailure) {
    Write-Host ""
    Write-Host "Failure summary:" -ForegroundColor Red
    foreach ($msg in $script:FailureMessages) {
        Write-Host (" - {0}" -f $msg) -ForegroundColor Red
    }
    Write-Host "`nFAIL: otp login contract verification failed" -ForegroundColor Red
    exit 1
}

Write-Host "`nPASS: otp login contract verified" -ForegroundColor Green
exit 0
