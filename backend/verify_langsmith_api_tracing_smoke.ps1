param(
    [string]$BaseUrl = "http://localhost:8000"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-EnvStatus {
    param(
        [Parameter(Mandatory = $true)] [string] $Name,
        [Parameter(Mandatory = $true)] [bool] $Present
    )

    $status = if ($Present) { "present" } else { "missing" }
    Write-Host ("Env Check: {0} = {1}" -f $Name, $status)
}

function Invoke-ChildVerifier {
    param(
        [Parameter(Mandatory = $true)] [string] $Path,
        [Parameter(Mandatory = $true)] [string] $Label
    )

    if (-not (Test-Path -Path $Path -PathType Leaf)) {
        throw "Required verifier script not found: $Path"
    }

    $powershellExe = if (Get-Command -Name "pwsh" -ErrorAction SilentlyContinue) { "pwsh" } else { "powershell" }
    Write-Host ("Running verifier: {0}" -f $Label) -ForegroundColor Cyan
    & $powershellExe -NoProfile -ExecutionPolicy Bypass -File $Path
    $exitCode = $LASTEXITCODE
    if ($null -eq $exitCode) {
        $exitCode = 0
    }
    if ($exitCode -ne 0) {
        throw ("Verifier failed ({0}) with exit code {1}" -f $Label, $exitCode)
    }
    Write-Host ("Verifier PASS: {0}" -f $Label) -ForegroundColor Green
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$normalizedBaseUrl = $BaseUrl.TrimEnd("/")
$healthUrl = "$normalizedBaseUrl/health"
$failed = $false
$failureReason = ""

$chatNightBaseUrlOriginal = [System.Environment]::GetEnvironmentVariable("CHAT_NIGHT_BASE_URL", "Process")

try {
    Write-Host "========================================================" -ForegroundColor Yellow
    Write-Host " LANGSMITH API TRACING SMOKE (LS-3, QA-ONLY) " -ForegroundColor Yellow
    Write-Host "========================================================" -ForegroundColor Yellow
    Write-Host ("Target Base URL: {0}" -f $normalizedBaseUrl) -ForegroundColor Cyan

    $bhLangsmithApiTracingEnabled = [System.Environment]::GetEnvironmentVariable("BH_LANGSMITH_API_TRACING_ENABLED")
    $langsmithTracing = [System.Environment]::GetEnvironmentVariable("LANGSMITH_TRACING")
    $langchainTracingV2 = [System.Environment]::GetEnvironmentVariable("LANGCHAIN_TRACING_V2")
    $langsmithApiKey = [System.Environment]::GetEnvironmentVariable("LANGSMITH_API_KEY")
    $langsmithProject = [System.Environment]::GetEnvironmentVariable("LANGSMITH_PROJECT")

    $isBhLangsmithApiTracingEnabled = ($bhLangsmithApiTracingEnabled -eq "true")
    $isLangsmithTracingEnabled = ($langsmithTracing -eq "true")
    $isLangchainTracingV2Enabled = ($langchainTracingV2 -eq "true")
    $isLangsmithApiKeyPresent = -not [string]::IsNullOrWhiteSpace($langsmithApiKey)
    $isLangsmithProjectPresent = -not [string]::IsNullOrWhiteSpace($langsmithProject)

    Write-EnvStatus -Name "BH_LANGSMITH_API_TRACING_ENABLED" -Present (-not [string]::IsNullOrWhiteSpace($bhLangsmithApiTracingEnabled))
    Write-EnvStatus -Name "LANGSMITH_TRACING" -Present (-not [string]::IsNullOrWhiteSpace($langsmithTracing))
    Write-EnvStatus -Name "LANGCHAIN_TRACING_V2" -Present (-not [string]::IsNullOrWhiteSpace($langchainTracingV2))
    Write-EnvStatus -Name "LANGSMITH_API_KEY" -Present $isLangsmithApiKeyPresent
    Write-EnvStatus -Name "LANGSMITH_PROJECT" -Present $isLangsmithProjectPresent

    if (-not $isBhLangsmithApiTracingEnabled) {
        throw "Missing prerequisite: BH_LANGSMITH_API_TRACING_ENABLED must equal 'true'."
    }
    if (-not ($isLangsmithTracingEnabled -or $isLangchainTracingV2Enabled)) {
        throw "Missing prerequisite: set LANGSMITH_TRACING='true' or LANGCHAIN_TRACING_V2='true'."
    }
    if (-not $isLangsmithApiKeyPresent) {
        throw "Missing prerequisite: LANGSMITH_API_KEY must be set."
    }

    try {
        $health = Invoke-RestMethod -Uri $healthUrl -Method Get -ErrorAction Stop
    }
    catch {
        throw ("Health check failed at {0}: {1}" -f $healthUrl, $_)
    }

    $healthState = ""
    if ($null -ne $health -and $null -ne $health.status) {
        $healthState = "$($health.status)"
    }
    if ($healthState -and $healthState.ToLowerInvariant() -ne "healthy") {
        throw ("Health endpoint returned non-healthy status: {0}" -f $healthState)
    }
    Write-Host "health OK" -ForegroundColor Green

    [System.Environment]::SetEnvironmentVariable("CHAT_NIGHT_BASE_URL", $normalizedBaseUrl, "Process")

    $contractVerifier = Join-Path -Path $scriptDir -ChildPath "verify_chat_night_icebreakers_contract.ps1"
    $revealVerifier = Join-Path -Path $scriptDir -ChildPath "verify_chat_night_icebreakers_reveal_sync.ps1"

    Invoke-ChildVerifier -Path $contractVerifier -Label "verify_chat_night_icebreakers_contract.ps1"
    Invoke-ChildVerifier -Path $revealVerifier -Label "verify_chat_night_icebreakers_reveal_sync.ps1"

    $projectNameForUi = if ([string]::IsNullOrWhiteSpace($langsmithProject)) { "default (LANGSMITH_PROJECT not set)" } else { $langsmithProject.Trim() }

    Write-Host ""
    Write-Host "What to click in LangSmith:" -ForegroundColor Yellow
    Write-Host ("- Project: {0}" -f $projectNameForUi)
    Write-Host "- Filter: api POST /api/chat-night/icebreakers"
    Write-Host "- Filter: api POST /api/chat-night/icebreakers/reveal"
    Write-Host "- Look for newest runs around current time."
}
catch {
    $failed = $true
    $failureReason = "$_"
}
finally {
    [System.Environment]::SetEnvironmentVariable("CHAT_NIGHT_BASE_URL", $chatNightBaseUrlOriginal, "Process")
}

if ($failed) {
    Write-Host ("FAIL: langsmith api tracing smoke - {0}" -f $failureReason) -ForegroundColor Red
    exit 1
}

Write-Host "PASS: langsmith api tracing smoke" -ForegroundColor Green
exit 0
