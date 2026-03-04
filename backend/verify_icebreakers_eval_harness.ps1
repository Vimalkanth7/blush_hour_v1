[CmdletBinding()]
param(
    [string] $BaseUrl = $(if ([string]::IsNullOrWhiteSpace($env:CHAT_NIGHT_BASE_URL)) { "http://localhost:8000" } else { $env:CHAT_NIGHT_BASE_URL.TrimEnd("/") }),
    [string] $CasesFile = $(Join-Path $PSScriptRoot "evals\icebreakers_eval_cases.json"),
    [int] $ReasonMaxLength = 280,
    [int] $IcebreakerMaxLength = 200
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$evalEndpoint = "$BaseUrl/api/internal/evals/icebreakers"
$emailPattern = '(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b'
$phonePattern = '(?<!\w)(?:\+?\d[\d\-\s\(\)]{7,}\d)(?!\w)'

function Get-HttpStatusCodeFromError {
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.ErrorRecord] $ErrorRecord
    )

    $statusCode = $null
    $exception = $ErrorRecord.Exception
    if ($null -ne $exception -and $exception.PSObject.Properties.Name -contains "Response") {
        $response = $exception.Response
        if ($null -ne $response -and $response.PSObject.Properties.Name -contains "StatusCode") {
            try {
                $statusCode = [int] $response.StatusCode
            }
            catch {
                $statusCode = $null
            }
        }
    }

    if ($null -ne $statusCode) {
        return $statusCode
    }

    $message = "$($ErrorRecord.Exception.Message)"
    if ($message -match '\b404\b') { return 404 }
    if ($message -match '\b401\b') { return 401 }
    if ($message -match '\b403\b') { return 403 }
    if ($message -match '\b422\b') { return 422 }

    return $null
}

function Get-HttpErrorText {
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.ErrorRecord] $ErrorRecord
    )

    $exception = $ErrorRecord.Exception
    if ($null -eq $exception) {
        return "$ErrorRecord"
    }

    if ($exception.PSObject.Properties.Name -contains "Response") {
        $response = $exception.Response
        if ($null -ne $response -and $response.PSObject.Properties.Name -contains "Content") {
            $content = $response.Content
            if (-not [string]::IsNullOrWhiteSpace("$content")) {
                return "$content"
            }
        }
    }

    return "$exception"
}

function Invoke-InternalEval {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable] $Body
    )

    $bodyJson = $Body | ConvertTo-Json -Depth 16
    try {
        $response = Invoke-RestMethod -Uri $evalEndpoint -Method Post -Body $bodyJson -ContentType "application/json" -ErrorAction Stop
        return @{
            ok = $true
            status = 200
            response = $response
            error = $null
            error_text = $null
        }
    }
    catch {
        $statusCode = Get-HttpStatusCodeFromError -ErrorRecord $_
        return @{
            ok = $false
            status = $statusCode
            response = $null
            error = $_
            error_text = (Get-HttpErrorText -ErrorRecord $_)
        }
    }
}

function Validate-StringCollection {
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Values,
        [Parameter(Mandatory = $true)]
        [string] $FieldName,
        [Parameter(Mandatory = $true)]
        [int] $ExpectedCount,
        [Parameter(Mandatory = $true)]
        [int] $MaxLength
    )

    $errors = @()
    $items = @($Values)

    if ($items.Count -ne $ExpectedCount) {
        $errors += "$FieldName expected $ExpectedCount items, got $($items.Count)."
    }

    for ($i = 0; $i -lt $items.Count; $i++) {
        $raw = $items[$i]
        if ($null -eq $raw) {
            $errors += "$FieldName[$i] is null."
            continue
        }

        $text = [string] $raw
        if ([string]::IsNullOrWhiteSpace($text)) {
            $errors += "$FieldName[$i] is empty."
            continue
        }

        if ($text -match $emailPattern) {
            $errors += "$FieldName[$i] contains email-like text."
        }
        if ($text -match $phonePattern) {
            $errors += "$FieldName[$i] contains phone-like text."
        }
        if ($text.Length -gt $MaxLength) {
            $errors += "$FieldName[$i] length $($text.Length) exceeds max $MaxLength."
        }
    }

    return $errors
}

function Validate-EvalResponse {
    param(
        [Parameter(Mandatory = $true)]
        [AllowNull()]
        $Response,
        [Parameter(Mandatory = $true)]
        [string] $CaseId,
        [Parameter(Mandatory = $true)]
        [string] $CallLabel
    )

    $errors = @()

    if ($null -eq $Response) {
        $errors += "$CallLabel response is null (JSON parse failed)."
        return $errors
    }

    if ($Response -is [string]) {
        $errors += "$CallLabel response is plain text (JSON parse failed)."
        return $errors
    }

    if (-not ($Response.PSObject.Properties.Name -contains "case_id")) {
        $errors += "$CallLabel missing case_id."
    }
    elseif ("$($Response.case_id)" -ne $CaseId) {
        $errors += "$CallLabel case_id mismatch: expected '$CaseId', got '$($Response.case_id)'."
    }

    if (-not ($Response.PSObject.Properties.Name -contains "reasons")) {
        $errors += "$CallLabel missing reasons."
    }
    else {
        $errors += Validate-StringCollection -Values $Response.reasons -FieldName "$CallLabel reasons" -ExpectedCount 3 -MaxLength $ReasonMaxLength
    }

    if (-not ($Response.PSObject.Properties.Name -contains "icebreakers")) {
        $errors += "$CallLabel missing icebreakers."
    }
    else {
        $errors += Validate-StringCollection -Values $Response.icebreakers -FieldName "$CallLabel icebreakers" -ExpectedCount 5 -MaxLength $IcebreakerMaxLength
    }

    if (-not ($Response.PSObject.Properties.Name -contains "meta")) {
        $errors += "$CallLabel missing meta."
        return $errors
    }

    $meta = $Response.meta
    if ($null -eq $meta) {
        $errors += "$CallLabel meta is null."
        return $errors
    }

    if (-not ($meta.PSObject.Properties.Name -contains "cached")) {
        $errors += "$CallLabel meta.cached missing."
    }
    if (-not ($meta.PSObject.Properties.Name -contains "mode")) {
        $errors += "$CallLabel meta.mode missing."
    }
    elseif ("$($meta.mode)" -ne "deterministic") {
        $errors += "$CallLabel expected meta.mode='deterministic', got '$($meta.mode)'."
    }

    return $errors
}

function Get-CasesFromFixture {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    if (-not (Test-Path -Path $Path -PathType Leaf)) {
        throw "Fixture file not found: $Path"
    }

    $raw = Get-Content -Path $Path -Raw -ErrorAction Stop
    $parsed = $raw | ConvertFrom-Json -ErrorAction Stop

    if ($parsed -is [System.Array]) {
        return @($parsed)
    }

    if ($parsed.PSObject.Properties.Name -contains "cases") {
        return @($parsed.cases)
    }

    throw "Fixture JSON must be an array or object with a 'cases' property."
}

try {
    Write-Host "==============================================================" -ForegroundColor Yellow
    Write-Host " ICEBREAKERS INTERNAL EVAL HARNESS (W6.5-C2, deterministic) " -ForegroundColor Yellow
    Write-Host "==============================================================" -ForegroundColor Yellow
    Write-Host "Base URL: $BaseUrl" -ForegroundColor Cyan
    Write-Host "Eval Endpoint: $evalEndpoint" -ForegroundColor Cyan
    Write-Host "Fixture File: $CasesFile" -ForegroundColor Cyan

    try {
        Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get -ErrorAction Stop | Out-Null
    }
    catch {
        Write-Error "Server unreachable at $BaseUrl. Start backend first."
        exit 1
    }

    $cases = Get-CasesFromFixture -Path $CasesFile
    if ($cases.Count -lt 10 -or $cases.Count -gt 20) {
        Write-Error "Fixture must include 10-20 cases. Found: $($cases.Count)"
        exit 1
    }

    $caseIdList = @()
    foreach ($case in $cases) {
        $caseId = "$($case.case_id)"
        if ([string]::IsNullOrWhiteSpace($caseId)) {
            Write-Error "Fixture case missing case_id."
            exit 1
        }
        if ($null -eq $case.context) {
            Write-Error "Fixture case '$caseId' missing context."
            exit 1
        }
        $caseIdList += $caseId
    }

    $duplicates = $caseIdList | Group-Object | Where-Object { $_.Count -gt 1 }
    if ($duplicates) {
        $dupValues = ($duplicates | ForEach-Object { $_.Name }) -join ", "
        Write-Error "Duplicate case_id values found: $dupValues"
        exit 1
    }

    $total = 0
    $passed = 0
    $failed = 0

    foreach ($case in $cases) {
        $total += 1
        $caseId = "$($case.case_id)"
        $roomId = [guid]::NewGuid().ToString()
        $caseErrors = @()

        # Clone context so runtime room_id changes do not mutate loaded fixtures.
        $contextClone = ($case.context | ConvertTo-Json -Depth 16) | ConvertFrom-Json -ErrorAction Stop
        $contextClone.room_id = $roomId

        $body = @{
            case_id = $caseId
            context = $contextClone
        }

        $firstCall = Invoke-InternalEval -Body $body
        if (-not $firstCall.ok) {
            if ($firstCall.status -eq 404) {
                Write-Host "Internal eval endpoint unavailable - ensure CHAT_NIGHT_TEST_MODE + BH_INTERNAL_EVALS_ENABLED are true on the server." -ForegroundColor Red
                Write-Host "FAIL: icebreakers eval harness" -ForegroundColor Red
                exit 1
            }

            $httpStatus = if ($null -eq $firstCall.status) { "unknown" } else { "$($firstCall.status)" }
            $failed += 1
            Write-Host ("FAIL [{0}] room_id={1} call#1_http={2}" -f $caseId, $roomId, $httpStatus) -ForegroundColor Red
            Write-Host ("  - call#1 request failed: {0}" -f $firstCall.error_text) -ForegroundColor Red
            continue
        }

        $caseErrors += Validate-EvalResponse -Response $firstCall.response -CaseId $caseId -CallLabel "$caseId call#1"

        $secondCall = Invoke-InternalEval -Body $body
        if (-not $secondCall.ok) {
            if ($secondCall.status -eq 404) {
                Write-Host "Internal eval endpoint unavailable - ensure CHAT_NIGHT_TEST_MODE + BH_INTERNAL_EVALS_ENABLED are true on the server." -ForegroundColor Red
                Write-Host "FAIL: icebreakers eval harness" -ForegroundColor Red
                exit 1
            }

            $httpStatus = if ($null -eq $secondCall.status) { "unknown" } else { "$($secondCall.status)" }
            $caseErrors += "call#2 request failed with HTTP $httpStatus."
            $caseErrors += "call#2 error text: $($secondCall.error_text)"
        }
        else {
            $caseErrors += Validate-EvalResponse -Response $secondCall.response -CaseId $caseId -CallLabel "$caseId call#2"
            if ($null -eq $secondCall.response.meta -or -not ($secondCall.response.meta.PSObject.Properties.Name -contains "cached")) {
                $caseErrors += "call#2 missing meta.cached."
            }
            elseif (-not [bool] $secondCall.response.meta.cached) {
                $caseErrors += "call#2 expected meta.cached=true."
            }
        }

        if ($caseErrors.Count -eq 0) {
            $passed += 1
            $firstCached = [bool] $firstCall.response.meta.cached
            $secondCached = [bool] $secondCall.response.meta.cached
            Write-Host ("PASS [{0}] room_id={1} first_cached={2} second_cached={3}" -f $caseId, $roomId, $firstCached, $secondCached) -ForegroundColor Green
        }
        else {
            $failed += 1
            Write-Host ("FAIL [{0}] room_id={1}" -f $caseId, $roomId) -ForegroundColor Red
            foreach ($entry in $caseErrors) {
                Write-Host ("  - {0}" -f $entry) -ForegroundColor Red
            }
        }
    }

    Write-Host ("Summary: total={0} pass={1} fail={2}" -f $total, $passed, $failed)
    if ($failed -eq 0) {
        Write-Host "PASS: icebreakers eval harness" -ForegroundColor Green
        exit 0
    }

    Write-Host "FAIL: icebreakers eval harness" -ForegroundColor Red
    exit 1
}
catch {
    Write-Error "Harness crashed: $_"
    Write-Host "FAIL: icebreakers eval harness" -ForegroundColor Red
    exit 1
}
