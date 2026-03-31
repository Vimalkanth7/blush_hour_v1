[CmdletBinding()]
param(
    [string] $DisabledBaseUrl = "",
    [string] $StubBaseUrl = "",
    [string] $GoogleBaseUrl = "",
    [string] $SpendOrderBaseUrl = "",
    [string] $RealProductId = "",
    [string] $RealPurchaseToken = "",
    [string] $RealOrderId = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:SkipMessages = New-Object System.Collections.Generic.List[string]
$script:PowerShellExe = Join-Path $PSHOME "powershell.exe"

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

function Resolve-Setting {
    param(
        [AllowNull()] $ExplicitValue,
        [Parameter(Mandatory = $true)][string[]] $EnvironmentVariableNames,
        [string] $DefaultValue = ""
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

    return (Normalize-OptionalString -Value $DefaultValue)
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

function Test-Health {
    param(
        [Parameter(Mandatory = $true)][string] $BaseUrl,
        [Parameter(Mandatory = $true)][string] $Label
    )

    try {
        $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method GET -ErrorAction Stop
    }
    catch {
        $message = if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
        Fail ("Health check failed for {0} backend at {1}. detail/error: {2}" -f $Label, $BaseUrl, $message)
    }

    if ("$($health.status)" -ne "healthy") {
        Fail ("Health check for {0} backend at {1} must return status=healthy. Raw body: {2}" -f $Label, $BaseUrl, ($health | ConvertTo-Json -Compress))
    }

    Write-Pass ("Health check passed for {0} backend at {1}." -f $Label, $BaseUrl)
}

function Assert-DistinctVerifierBackends {
    param(
        [Parameter(Mandatory = $true)][string] $DisabledUrl,
        [Parameter(Mandatory = $true)][string] $StubUrl,
        [Parameter(Mandatory = $true)][string] $GoogleUrl
    )

    if ($DisabledUrl -eq $StubUrl -or $DisabledUrl -eq $GoogleUrl -or $StubUrl -eq $GoogleUrl) {
        Fail "DisabledBaseUrl, StubBaseUrl, and GoogleBaseUrl must point to distinct backend configurations for the runtime suite. Override them with parameters or BH_PASSES_DISABLED_BASE_URL / BH_PASSES_STUB_BASE_URL / BH_PASSES_GOOGLE_BASE_URL."
    }
}

function Get-DotEnvScalarValue {
    param(
        [Parameter(Mandatory = $true)][string] $DotEnvPath,
        [Parameter(Mandatory = $true)][string] $Key
    )

    if (-not (Test-Path $DotEnvPath)) {
        return ""
    }

    $pattern = '^\s*' + [Regex]::Escape($Key) + '\s*=\s*(.+?)\s*$'
    $value = ""
    foreach ($line in Get-Content -Path $DotEnvPath) {
        if ($line -match $pattern) {
            $candidate = Normalize-OptionalString -Value $Matches[1]
            if ($candidate.Length -ge 2) {
                $quotePair = ($candidate.StartsWith('"') -and $candidate.EndsWith('"')) -or ($candidate.StartsWith("'") -and $candidate.EndsWith("'"))
                if ($quotePair) {
                    $candidate = $candidate.Substring(1, $candidate.Length - 2)
                }
            }
            $value = $candidate
        }
    }

    return $value
}

function Resolve-EnvironmentOverrideValue {
    param(
        [Parameter(Mandatory = $true)][string] $Key,
        [Parameter(Mandatory = $true)][string] $DotEnvPath
    )

    $processValue = Normalize-OptionalString -Value ([Environment]::GetEnvironmentVariable($Key))
    if (-not [string]::IsNullOrWhiteSpace($processValue)) {
        return $processValue
    }

    $dotEnvValue = Get-DotEnvScalarValue -DotEnvPath $DotEnvPath -Key $Key
    if (-not [string]::IsNullOrWhiteSpace($dotEnvValue)) {
        return $dotEnvValue
    }

    Fail ("Required env value '{0}' was not found in the current process environment or in {1}. Set it explicitly before running the suite." -f $Key, $DotEnvPath)
}

function New-PythonDotEnvMuteSiteCustomizeDirectory {
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("bh-dotenv-mute-" + [Guid]::NewGuid().ToString("N"))
    $null = New-Item -ItemType Directory -Path $tempDir -Force

    @'
import logging

logger = logging.getLogger("dotenv.main")
logger.handlers = []
logger.propagate = False
logger.disabled = True
'@ | Set-Content -Path (Join-Path $tempDir "sitecustomize.py") -Encoding ASCII

    return $tempDir
}

function Invoke-ChildVerifier {
    param(
        [Parameter(Mandatory = $true)][string] $Label,
        [Parameter(Mandatory = $true)][string] $ScriptPath,
        [Parameter(Mandatory = $true)][string[]] $Arguments,
        [AllowNull()][hashtable] $EnvironmentOverrides = $null
    )

    if (-not (Test-Path $ScriptPath)) {
        Fail ("Verifier script not found: {0}" -f $ScriptPath)
    }
    if (-not (Test-Path $script:PowerShellExe)) {
        Fail ("PowerShell executable not found at {0}" -f $script:PowerShellExe)
    }

    Write-Step $Label
    $savedEnv = @{}
    if ($null -ne $EnvironmentOverrides) {
        foreach ($key in $EnvironmentOverrides.Keys) {
            $savedEnv[$key] = [Environment]::GetEnvironmentVariable($key)
            [Environment]::SetEnvironmentVariable($key, "$($EnvironmentOverrides[$key])")
        }
    }

    try {
        & $script:PowerShellExe -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            Fail ("{0} failed with exit code {1}." -f $Label, $exitCode)
        }
    }
    finally {
        if ($null -ne $EnvironmentOverrides) {
            foreach ($key in $EnvironmentOverrides.Keys) {
                [Environment]::SetEnvironmentVariable($key, $savedEnv[$key])
            }
        }
    }

    Write-Pass ("{0} completed." -f $Label)
}

$DisabledBaseUrl = Normalize-BaseUrl -Value (Resolve-Setting -ExplicitValue $DisabledBaseUrl -EnvironmentVariableNames @("BH_PASSES_DISABLED_BASE_URL") -DefaultValue "http://127.0.0.1:8002") -Context "DisabledBaseUrl"
$StubBaseUrl = Normalize-BaseUrl -Value (Resolve-Setting -ExplicitValue $StubBaseUrl -EnvironmentVariableNames @("BH_PASSES_STUB_BASE_URL") -DefaultValue "http://127.0.0.1:8001") -Context "StubBaseUrl"
$GoogleBaseUrl = Normalize-BaseUrl -Value (Resolve-Setting -ExplicitValue $GoogleBaseUrl -EnvironmentVariableNames @("BH_PASSES_GOOGLE_BASE_URL") -DefaultValue "http://127.0.0.1:8000") -Context "GoogleBaseUrl"
$SpendOrderBaseUrl = Normalize-BaseUrl -Value (Resolve-Setting -ExplicitValue $SpendOrderBaseUrl -EnvironmentVariableNames @("BH_PASSES_SPEND_ORDER_BASE_URL") -DefaultValue $StubBaseUrl) -Context "SpendOrderBaseUrl"
$RealProductId = Resolve-Setting -ExplicitValue $RealProductId -EnvironmentVariableNames @("BH_PASSES_REAL_PRODUCT_ID")
$RealPurchaseToken = Resolve-Setting -ExplicitValue $RealPurchaseToken -EnvironmentVariableNames @("BH_PASSES_REAL_PURCHASE_TOKEN")
$RealOrderId = Resolve-Setting -ExplicitValue $RealOrderId -EnvironmentVariableNames @("BH_PASSES_REAL_ORDER_ID")

if ($SpendOrderBaseUrl -ne $StubBaseUrl -and $SpendOrderBaseUrl -ne $GoogleBaseUrl) {
    Write-Skip ("SpendOrderBaseUrl is {0}. This is allowed, but the delegated Chat Night verifier is usually expected to run against the stub-enabled passes backend." -f $SpendOrderBaseUrl)
}

if ([string]::IsNullOrWhiteSpace($RealPurchaseToken)) {
    $script:SkipMessages.Add("SKIP: real Google validate step skipped because no token was supplied.")
}

Assert-DistinctVerifierBackends -DisabledUrl $DisabledBaseUrl -StubUrl $StubBaseUrl -GoogleUrl $GoogleBaseUrl

$passesContractScript = Join-Path $PSScriptRoot "verify_passes_contract.ps1"
$chatNightPassScript = Join-Path $PSScriptRoot "verify_chat_night_pass_consumption_contract.ps1"
$backendDotEnvPath = Join-Path $PSScriptRoot ".env"
$pythonSiteCustomizeDir = New-PythonDotEnvMuteSiteCustomizeDirectory
$existingPythonPath = Normalize-OptionalString -Value ([Environment]::GetEnvironmentVariable("PYTHONPATH"))
$chatNightPythonPath = $pythonSiteCustomizeDir
if (-not [string]::IsNullOrWhiteSpace($existingPythonPath)) {
    $chatNightPythonPath = "$pythonSiteCustomizeDir;$existingPythonPath"
}
$chatNightEnvOverrides = @{
    PYTHON_DOTENV_DISABLED = "1"
    PYTHONPATH             = $chatNightPythonPath
    SECRET_KEY             = Resolve-EnvironmentOverrideValue -Key "SECRET_KEY" -DotEnvPath $backendDotEnvPath
    MONGODB_URL            = Resolve-EnvironmentOverrideValue -Key "MONGODB_URL" -DotEnvPath $backendDotEnvPath
    DB_NAME                = Resolve-EnvironmentOverrideValue -Key "DB_NAME" -DotEnvPath $backendDotEnvPath
}

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host " PASSES RUNTIME QA SUITE (W7-T3-H)                         " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "Disabled backend: $DisabledBaseUrl" -ForegroundColor Cyan
Write-Host "Stub backend: $StubBaseUrl" -ForegroundColor Cyan
Write-Host "Google backend: $GoogleBaseUrl" -ForegroundColor Cyan
Write-Host "Spend-order backend: $SpendOrderBaseUrl" -ForegroundColor Cyan

try {
    Write-Step "Health checks"
    Test-Health -BaseUrl $DisabledBaseUrl -Label "disabled-mode"
    Test-Health -BaseUrl $StubBaseUrl -Label "stub-mode"
    Test-Health -BaseUrl $GoogleBaseUrl -Label "google-mode"
    if ($SpendOrderBaseUrl -ne $StubBaseUrl -and $SpendOrderBaseUrl -ne $GoogleBaseUrl -and $SpendOrderBaseUrl -ne $DisabledBaseUrl) {
        Test-Health -BaseUrl $SpendOrderBaseUrl -Label "spend-order"
    }

    Invoke-ChildVerifier -Label "Disabled-mode passes contract" -ScriptPath $passesContractScript -Arguments @(
        "-BaseUrl", $DisabledBaseUrl,
        "-Mode", "disabled"
    )

    Invoke-ChildVerifier -Label "Stub-mode passes contract" -ScriptPath $passesContractScript -Arguments @(
        "-BaseUrl", $StubBaseUrl,
        "-Mode", "enabled",
        "-ProviderMode", "stub"
    )

    $googleArguments = @(
        "-BaseUrl", $GoogleBaseUrl,
        "-Mode", "enabled",
        "-ProviderMode", "google"
    )
    if (-not [string]::IsNullOrWhiteSpace($RealProductId)) {
        $googleArguments += @("-RealProductId", $RealProductId)
    }
    if (-not [string]::IsNullOrWhiteSpace($RealPurchaseToken)) {
        $googleArguments += @("-RealPurchaseToken", $RealPurchaseToken)
    }
    if (-not [string]::IsNullOrWhiteSpace($RealOrderId)) {
        $googleArguments += @("-RealOrderId", $RealOrderId)
    }

    Invoke-ChildVerifier -Label "Google-mode passes contract smoke" -ScriptPath $passesContractScript -Arguments $googleArguments

    Invoke-ChildVerifier -Label "Chat Night spend-order verifier" -ScriptPath $chatNightPassScript -Arguments @(
        "-BaseUrl", $SpendOrderBaseUrl
    ) -EnvironmentOverrides $chatNightEnvOverrides

    Write-Host ""
    foreach ($skipLine in ($script:SkipMessages | Select-Object -Unique)) {
        Write-Skip ($skipLine -replace "^SKIP:\s*", "")
    }
    Write-Host "PASS: all required checks passed." -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ""
    Write-Host ("FAIL: {0}" -f $_.Exception.Message) -ForegroundColor Red
    exit 1
}
finally {
    if (-not [string]::IsNullOrWhiteSpace($pythonSiteCustomizeDir) -and (Test-Path $pythonSiteCustomizeDir)) {
        Remove-Item -Path $pythonSiteCustomizeDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
