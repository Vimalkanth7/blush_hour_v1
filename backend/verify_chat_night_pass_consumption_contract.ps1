[CmdletBinding()]
param(
    [string] $BaseUrl = "http://localhost:8000"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")
$script:Password = "ChatNightPass123!"
$script:PythonExe = Join-Path $PSScriptRoot "venv\Scripts\python.exe"

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

function Assert-True {
    param(
        [Parameter(Mandatory = $true)][bool] $Condition,
        [Parameter(Mandatory = $true)][string] $Context
    )

    if (-not $Condition) {
        Fail $Context
    }
}

function Assert-Equal {
    param(
        [Parameter(Mandatory = $true)] $Actual,
        [Parameter(Mandatory = $true)] $Expected,
        [Parameter(Mandatory = $true)][string] $Context
    )

    if ("$Actual" -ne "$Expected") {
        Fail ("{0} expected '{1}' but got '{2}'." -f $Context, "$Expected", "$Actual")
    }
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

function Patch-Profile {
    param(
        [Parameter(Mandatory = $true)][string] $Token,
        [Parameter(Mandatory = $true)][string] $Gender,
        [Parameter(Mandatory = $true)][string] $FirstName
    )

    $headers = @{ Authorization = "Bearer $Token" }
    $body = @{
        firstName = $FirstName
        birthday = "1992-05-14"
        gender = $Gender
        bio = "Chat Night pass consumption verification profile."
        prompts = @(@{ question = "Ideal Sunday?"; answer = "Coffee and a long walk." })
        work = "Engineer"
        location = "Austin"
        educationLevel = "Bachelors"
        starSign = "Leo"
        height = "170cm"
        interests = @("Music", "Art", "Hiking")
        values = @("Honesty", "Humor")
        languages = @("English")
        habits = @{ drinking = "sometimes"; smoking = "no"; exercise = "yes"; kids = "maybe" }
    }

    $result = Invoke-JsonApi -Method PATCH -Uri "$BaseUrl/api/users/me" -Headers $headers -Body $body
    Assert-Success -Result $result -Context "PATCH /api/users/me for $FirstName"
}

function Get-ChatNightStatus {
    param([Parameter(Mandatory = $true)][string] $Token)

    $headers = @{ Authorization = "Bearer $Token" }
    $result = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/chat-night/status" -Headers $headers
    Assert-Success -Result $result -Context "GET /api/chat-night/status"
    return $result.Body
}

function Enter-ChatNight {
    param([Parameter(Mandatory = $true)][string] $Token)

    $headers = @{ Authorization = "Bearer $Token" }
    for ($attempt = 1; $attempt -le 2; $attempt++) {
        $result = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/chat-night/enter" -Headers $headers
        $detail = Try-GetDetailMessage -RawErrorText "$($result.ErrorText)"
        $rateLimited = (-not $result.Ok) -and (($result.Status -eq 429) -or ($detail -match "(?i)rate limit exceeded"))
        if (-not $rateLimited -or $attempt -eq 2) {
            return $result
        }

        Write-Host "Chat Night /enter rate limit hit. Waiting 65s and retrying once..." -ForegroundColor Yellow
        Start-Sleep -Seconds 65
    }
}

function Leave-ChatNight {
    param([Parameter(Mandatory = $true)][string] $Token)

    $headers = @{ Authorization = "Bearer $Token" }
    $null = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/chat-night/leave" -Headers $headers
}

function Get-MyRoom {
    param([Parameter(Mandatory = $true)][string] $Token)

    $headers = @{ Authorization = "Bearer $Token" }
    $result = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/chat-night/my-room" -Headers $headers
    Assert-Success -Result $result -Context "GET /api/chat-night/my-room"
    return $result.Body
}

function Wait-For-MyRoom {
    param(
        [Parameter(Mandatory = $true)][string] $Token,
        [Parameter(Mandatory = $true)][string] $ExpectedRoomId,
        [Parameter(Mandatory = $true)][string] $Label,
        [int] $Retries = 8,
        [int] $DelaySeconds = 2
    )

    for ($i = 0; $i -lt $Retries; $i++) {
        $room = Get-MyRoom -Token $Token
        if ("$($room.state)" -ne "none" -and "$($room.room_id)" -eq $ExpectedRoomId) {
            return $room
        }
        Start-Sleep -Seconds $DelaySeconds
    }

    Fail "Timed out waiting for $Label to observe room $ExpectedRoomId."
}

function Get-PassesMe {
    param([Parameter(Mandatory = $true)][string] $Token)

    $headers = @{ Authorization = "Bearer $Token" }
    $result = Invoke-JsonApi -Method GET -Uri "$BaseUrl/api/passes/me" -Headers $headers
    Assert-Success -Result $result -Context "GET /api/passes/me"
    return $result.Body
}

function Validate-StubPass {
    param(
        [Parameter(Mandatory = $true)][string] $Token,
        [Parameter(Mandatory = $true)][string] $Suffix
    )

    $headers = @{ Authorization = "Bearer $Token" }
    $body = @{
        product_id     = "pass_pack_1"
        purchase_token = "stub-pass_pack_1-$Suffix"
        order_id       = "STUB-PASS-$($Suffix.ToUpper())"
        platform       = "android"
    }
    $result = Invoke-JsonApi -Method POST -Uri "$BaseUrl/api/passes/google/validate" -Headers $headers -Body $body
    Assert-Success -Result $result -Context "POST /api/passes/google/validate ($Suffix)"
    return $result.Body
}

function Invoke-DbText {
    param(
        [Parameter(Mandatory = $true)][string] $Script,
        [AllowNull()][hashtable] $EnvVars = $null
    )

    if (-not (Test-Path $script:PythonExe)) {
        Fail "Python executable not found at $script:PythonExe"
    }

    $savedEnv = @{}
    if ($null -ne $EnvVars) {
        foreach ($key in $EnvVars.Keys) {
            $savedEnv[$key] = [System.Environment]::GetEnvironmentVariable($key)
            [System.Environment]::SetEnvironmentVariable($key, "$($EnvVars[$key])")
        }
    }

    try {
        $output = @($Script | & $script:PythonExe - 2>&1 | ForEach-Object { "$_" })
        $exitCode = $LASTEXITCODE
    }
    finally {
        if ($null -ne $EnvVars) {
            foreach ($key in $EnvVars.Keys) {
                [System.Environment]::SetEnvironmentVariable($key, $savedEnv[$key])
            }
        }
    }

    $text = ($output -join "`n").Trim()
    if ($exitCode -ne 0) {
        Fail ("DB helper failed. Output: {0}" -f $text)
    }

    return $text
}

function Invoke-DbJson {
    param(
        [Parameter(Mandatory = $true)][string] $Script,
        [AllowNull()][hashtable] $EnvVars = $null
    )

    $text = Invoke-DbText -Script $Script -EnvVars $EnvVars
    if ([string]::IsNullOrWhiteSpace($text)) {
        return $null
    }

    $normalized = [System.Text.RegularExpressions.Regex]::Replace($text, "\r?\n\s*", "")

    try {
        return $normalized | ConvertFrom-Json
    }
    catch {
        Fail ("DB helper did not return valid JSON. Raw output: {0}" -f $text)
    }
}

function Get-DbUserState {
    param(
        [Parameter(Mandatory = $true)][string] $Phone,
        [Parameter(Mandatory = $true)][string] $DateIst,
        [string] $RoomId = ""
    )

    $script = @'
import json
import os
from pymongo import MongoClient
from app.core.config import settings

client = MongoClient(settings.MONGODB_URL)
db = client[settings.DB_NAME]
phone = os.environ["PHONE"]
date_ist = os.environ["DATE_IST"]
room_id = os.environ.get("ROOM_ID", "").strip()

user = db["users"].find_one({"phone_number": phone}, {"_id": 1})
if user is None:
    raise SystemExit(f"User not found for phone={phone}")

user_id = str(user["_id"])
pass_doc = db["chat_night_passes"].find_one({"user_id": user_id, "date_ist": date_ist}) or {}
wallet = db["user_pass_wallets"].find_one({"user_id": user_id}) or {}

ledger_query = {"user_id": user_id, "source": "chat_night_entry"}
if room_id:
    ledger_query["source_ref"] = room_id

ledger_entries = []
for row in db["pass_credit_ledger"].find(ledger_query).sort("created_at", 1):
    ledger_entries.append(
        {
            "id": str(row["_id"]),
            "entry_type": row.get("entry_type"),
            "delta_paid_pass_credits": int(row.get("delta_paid_pass_credits", 0)),
            "balance_after": int(row.get("balance_after", 0)),
            "source": row.get("source"),
            "source_ref": row.get("source_ref"),
            "note": row.get("note"),
        }
    )

print(
    json.dumps(
        {
            "user_id": user_id,
            "pass_total": int(pass_doc.get("passes_total", 0)),
            "pass_used": int(pass_doc.get("passes_used", 0)),
            "wallet_credits": int(wallet.get("paid_pass_credits", 0)),
            "room_ledger": ledger_entries,
        }
    )
)
'@

    return Invoke-DbJson -Script $script -EnvVars @{
        PHONE = $Phone
        DATE_IST = $DateIst
        ROOM_ID = $RoomId
    }
}

function Set-FreePassesExhausted {
    param(
        [Parameter(Mandatory = $true)][string] $Phone,
        [Parameter(Mandatory = $true)][string] $DateIst
    )

    $script = @'
import os
from datetime import datetime, timezone
from pymongo import MongoClient
from app.core.config import settings

client = MongoClient(settings.MONGODB_URL)
db = client[settings.DB_NAME]
phone = os.environ["PHONE"]
date_ist = os.environ["DATE_IST"]

user = db["users"].find_one({"phone_number": phone}, {"_id": 1})
if user is None:
    raise SystemExit(f"User not found for phone={phone}")

user_id = str(user["_id"])
pass_doc = db["chat_night_passes"].find_one({"user_id": user_id, "date_ist": date_ist})
if pass_doc is None:
    raise SystemExit(f"Pass doc not found for user_id={user_id} date_ist={date_ist}")

db["chat_night_passes"].update_one(
    {"_id": pass_doc["_id"]},
    {
        "$set": {
            "passes_used": int(pass_doc.get("passes_total", 0)),
            "updated_at": datetime.now(timezone.utc),
        }
    },
)

print("OK")
'@

    $result = Invoke-DbText -Script $script -EnvVars @{
        PHONE = $Phone
        DATE_IST = $DateIst
    }
    Assert-Equal -Actual $result -Expected "OK" -Context "Set free passes exhausted for $Phone"
}

function Get-RoomParticipants {
    param([Parameter(Mandatory = $true)][string] $RoomId)

    $script = @'
import json
import os
from pymongo import MongoClient
from app.core.config import settings

client = MongoClient(settings.MONGODB_URL)
db = client[settings.DB_NAME]
room_id = os.environ["ROOM_ID"]
room = db["chat_night_rooms"].find_one({"room_id": room_id})
if room is None:
    raise SystemExit(f"Room not found for room_id={room_id}")

print(
    json.dumps(
        {
            "room_id": room_id,
            "male_user_id": room.get("male_user_id"),
            "female_user_id": room.get("female_user_id"),
            "state": room.get("state"),
        }
    )
)
'@

    return Invoke-DbJson -Script $script -EnvVars @{ ROOM_ID = $RoomId }
}

Write-Host "============================================================" -ForegroundColor Yellow
Write-Host " CHAT NIGHT PASS CONSUMPTION CONTRACT VERIFIER (W7-T3-F)   " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "Base URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "Token output policy: token values are never printed." -ForegroundColor DarkYellow

Push-Location $PSScriptRoot
try {
    Write-Step "Health check (/health)"
    $health = Invoke-JsonApi -Method GET -Uri "$BaseUrl/health"
    if (-not $health.Ok -or -not $health.Body -or "$($health.Body.status)" -ne "healthy") {
        $healthError = if ($health.Ok) { ($health.Body | ConvertTo-Json -Compress) } else { "$($health.ErrorText)" }
        Fail ("GET /health must return status=healthy. HTTP {0}; body/error: {1}" -f $health.Status, $healthError)
    }
    Write-Pass "GET /health returned status=healthy."

    Write-Step "Scenario 1: Free-first behavior"
    $freeManPhone = New-TestPhone -Prefix "971"
    $freeWomanPhone = New-TestPhone -Prefix "972"
    $freeManToken = Register-TestUser -PhoneNumber $freeManPhone -Label "FreeMan"
    $freeWomanToken = Register-TestUser -PhoneNumber $freeWomanPhone -Label "FreeWoman"
    Patch-Profile -Token $freeManToken -Gender "Man" -FirstName "FreeMan"
    Patch-Profile -Token $freeWomanToken -Gender "Woman" -FirstName "FreeWoman"
    Leave-ChatNight -Token $freeManToken
    Leave-ChatNight -Token $freeWomanToken

    $freeManStatusBefore = Get-ChatNightStatus -Token $freeManToken
    $freeWomanStatusBefore = Get-ChatNightStatus -Token $freeWomanToken
    $dateIst = "$($freeManStatusBefore.date_ist)"
    Assert-Equal -Actual $freeManStatusBefore.next_spend_source -Expected "free_daily" -Context "FreeMan initial next_spend_source"
    Assert-Equal -Actual $freeWomanStatusBefore.next_spend_source -Expected "free_daily" -Context "FreeWoman initial next_spend_source"

    $freeManStateBefore = Get-DbUserState -Phone $freeManPhone -DateIst $dateIst
    $freeWomanStateBefore = Get-DbUserState -Phone $freeWomanPhone -DateIst $dateIst

    $enterFreeMan = Enter-ChatNight -Token $freeManToken
    Assert-Success -Result $enterFreeMan -Context "POST /api/chat-night/enter for FreeMan"
    Assert-Equal -Actual $enterFreeMan.Body.status -Expected "queued" -Context "FreeMan first /enter status"

    $enterFreeWoman = Enter-ChatNight -Token $freeWomanToken
    Assert-Success -Result $enterFreeWoman -Context "POST /api/chat-night/enter for FreeWoman"
    Assert-Equal -Actual $enterFreeWoman.Body.status -Expected "match_found" -Context "FreeWoman /enter status"
    $freeRoomId = "$($enterFreeWoman.Body.room_id)"
    Assert-True -Condition (-not [string]::IsNullOrWhiteSpace($freeRoomId)) -Context "Free-first room_id must be present."
    $null = Wait-For-MyRoom -Token $freeManToken -ExpectedRoomId $freeRoomId -Label "FreeMan"

    $freeManStateAfter = Get-DbUserState -Phone $freeManPhone -DateIst $dateIst -RoomId $freeRoomId
    $freeWomanStateAfter = Get-DbUserState -Phone $freeWomanPhone -DateIst $dateIst -RoomId $freeRoomId

    Assert-Equal -Actual $freeManStateAfter.pass_used -Expected ($freeManStateBefore.pass_used + 1) -Context "FreeMan daily pass usage after match"
    Assert-Equal -Actual $freeWomanStateAfter.pass_used -Expected ($freeWomanStateBefore.pass_used + 1) -Context "FreeWoman daily pass usage after match"
    Assert-Equal -Actual $freeManStateAfter.wallet_credits -Expected $freeManStateBefore.wallet_credits -Context "FreeMan wallet credits unchanged"
    Assert-Equal -Actual $freeWomanStateAfter.wallet_credits -Expected $freeWomanStateBefore.wallet_credits -Context "FreeWoman wallet credits unchanged"
    Assert-Equal -Actual @($freeManStateAfter.room_ledger).Count -Expected 0 -Context "FreeMan free-first ledger rows"
    Assert-Equal -Actual @($freeWomanStateAfter.room_ledger).Count -Expected 0 -Context "FreeWoman free-first ledger rows"
    Write-Pass ("Free-first proof: room {0} consumed daily passes only and left wallet credits unchanged." -f $freeRoomId)

    Write-Step "Scenario 2: Paid fallback behavior"
    $paidManPhone = New-TestPhone -Prefix "973"
    $paidWomanPhone = New-TestPhone -Prefix "974"
    $paidManToken = Register-TestUser -PhoneNumber $paidManPhone -Label "PaidMan"
    $paidWomanToken = Register-TestUser -PhoneNumber $paidWomanPhone -Label "PaidWoman"
    Patch-Profile -Token $paidManToken -Gender "Man" -FirstName "PaidMan"
    Patch-Profile -Token $paidWomanToken -Gender "Woman" -FirstName "PaidWoman"
    Leave-ChatNight -Token $paidManToken
    Leave-ChatNight -Token $paidWomanToken

    $paidManStatusBefore = Get-ChatNightStatus -Token $paidManToken
    $paidWomanStatusBefore = Get-ChatNightStatus -Token $paidWomanToken
    Assert-Equal -Actual $paidManStatusBefore.next_spend_source -Expected "free_daily" -Context "PaidMan initial next_spend_source"
    Assert-Equal -Actual $paidWomanStatusBefore.next_spend_source -Expected "free_daily" -Context "PaidWoman initial next_spend_source"

    $paidManSuffix = "paidman$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    Start-Sleep -Milliseconds 25
    $paidWomanSuffix = "paidwoman$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
    $null = Validate-StubPass -Token $paidManToken -Suffix $paidManSuffix
    $null = Validate-StubPass -Token $paidWomanToken -Suffix $paidWomanSuffix
    $paidManWalletGranted = Get-PassesMe -Token $paidManToken
    $paidWomanWalletGranted = Get-PassesMe -Token $paidWomanToken
    Assert-Equal -Actual $paidManWalletGranted.wallet.paid_pass_credits -Expected 1 -Context "PaidMan wallet after stub grant"
    Assert-Equal -Actual $paidWomanWalletGranted.wallet.paid_pass_credits -Expected 1 -Context "PaidWoman wallet after stub grant"

    Set-FreePassesExhausted -Phone $paidManPhone -DateIst $dateIst
    Set-FreePassesExhausted -Phone $paidWomanPhone -DateIst $dateIst

    $paidManStateReady = Get-DbUserState -Phone $paidManPhone -DateIst $dateIst
    $paidWomanStateReady = Get-DbUserState -Phone $paidWomanPhone -DateIst $dateIst
    $paidManStatusReady = Get-ChatNightStatus -Token $paidManToken
    $paidWomanStatusReady = Get-ChatNightStatus -Token $paidWomanToken
    Assert-Equal -Actual $paidManStatusReady.passes_remaining -Expected 0 -Context "PaidMan free passes exhausted"
    Assert-Equal -Actual $paidWomanStatusReady.passes_remaining -Expected 0 -Context "PaidWoman free passes exhausted"
    Assert-Equal -Actual $paidManStatusReady.paid_pass_credits -Expected 1 -Context "PaidMan paid_pass_credits after exhaustion"
    Assert-Equal -Actual $paidWomanStatusReady.paid_pass_credits -Expected 1 -Context "PaidWoman paid_pass_credits after exhaustion"
    Assert-Equal -Actual $paidManStatusReady.next_spend_source -Expected "paid_credit" -Context "PaidMan next_spend_source after exhaustion"
    Assert-Equal -Actual $paidWomanStatusReady.next_spend_source -Expected "paid_credit" -Context "PaidWoman next_spend_source after exhaustion"

    $enterPaidMan = Enter-ChatNight -Token $paidManToken
    Assert-Success -Result $enterPaidMan -Context "POST /api/chat-night/enter for PaidMan"
    Assert-Equal -Actual $enterPaidMan.Body.status -Expected "queued" -Context "PaidMan first /enter status"

    $enterPaidWoman = Enter-ChatNight -Token $paidWomanToken
    Assert-Success -Result $enterPaidWoman -Context "POST /api/chat-night/enter for PaidWoman"
    Assert-Equal -Actual $enterPaidWoman.Body.status -Expected "match_found" -Context "PaidWoman /enter status"
    $paidRoomId = "$($enterPaidWoman.Body.room_id)"
    Assert-True -Condition (-not [string]::IsNullOrWhiteSpace($paidRoomId)) -Context "Paid fallback room_id must be present."
    $null = Wait-For-MyRoom -Token $paidManToken -ExpectedRoomId $paidRoomId -Label "PaidMan"

    $paidManStateMatched = Get-DbUserState -Phone $paidManPhone -DateIst $dateIst -RoomId $paidRoomId
    $paidWomanStateMatched = Get-DbUserState -Phone $paidWomanPhone -DateIst $dateIst -RoomId $paidRoomId
    Assert-Equal -Actual $paidManStateMatched.pass_used -Expected $paidManStateReady.pass_used -Context "PaidMan free pass usage unchanged during paid fallback"
    Assert-Equal -Actual $paidWomanStateMatched.pass_used -Expected $paidWomanStateReady.pass_used -Context "PaidWoman free pass usage unchanged during paid fallback"
    Assert-Equal -Actual $paidManStateMatched.wallet_credits -Expected 0 -Context "PaidMan wallet after paid fallback"
    Assert-Equal -Actual $paidWomanStateMatched.wallet_credits -Expected 0 -Context "PaidWoman wallet after paid fallback"
    Assert-Equal -Actual @($paidManStateMatched.room_ledger).Count -Expected 1 -Context "PaidMan paid-spend ledger rows"
    Assert-Equal -Actual @($paidWomanStateMatched.room_ledger).Count -Expected 1 -Context "PaidWoman paid-spend ledger rows"
    Assert-Equal -Actual @($paidManStateMatched.room_ledger)[0].delta_paid_pass_credits -Expected -1 -Context "PaidMan ledger delta"
    Assert-Equal -Actual @($paidWomanStateMatched.room_ledger)[0].delta_paid_pass_credits -Expected -1 -Context "PaidWoman ledger delta"
    Assert-Equal -Actual @($paidManStateMatched.room_ledger)[0].source -Expected "chat_night_entry" -Context "PaidMan ledger source"
    Assert-Equal -Actual @($paidWomanStateMatched.room_ledger)[0].source -Expected "chat_night_entry" -Context "PaidWoman ledger source"
    Assert-Equal -Actual @($paidManStateMatched.room_ledger)[0].source_ref -Expected $paidRoomId -Context "PaidMan ledger source_ref"
    Assert-Equal -Actual @($paidWomanStateMatched.room_ledger)[0].source_ref -Expected $paidRoomId -Context "PaidWoman ledger source_ref"
    Assert-Equal -Actual @($paidManStateMatched.room_ledger)[0].balance_after -Expected 0 -Context "PaidMan ledger balance_after"
    Assert-Equal -Actual @($paidWomanStateMatched.room_ledger)[0].balance_after -Expected 0 -Context "PaidWoman ledger balance_after"

    $retryPaidWoman = Enter-ChatNight -Token $paidWomanToken
    Assert-Success -Result $retryPaidWoman -Context "Retry /api/chat-night/enter for PaidWoman"
    Assert-Equal -Actual $retryPaidWoman.Body.status -Expected "active_room" -Context "PaidWoman retry /enter status"
    Assert-Equal -Actual $retryPaidWoman.Body.room_id -Expected $paidRoomId -Context "PaidWoman retry /enter room_id"
    $paidWomanStateAfterRetry = Get-DbUserState -Phone $paidWomanPhone -DateIst $dateIst -RoomId $paidRoomId
    Assert-Equal -Actual $paidWomanStateAfterRetry.wallet_credits -Expected $paidWomanStateMatched.wallet_credits -Context "PaidWoman wallet unchanged after retry"
    Assert-Equal -Actual @($paidWomanStateAfterRetry.room_ledger).Count -Expected @($paidWomanStateMatched.room_ledger).Count -Context "PaidWoman ledger count unchanged after retry"
    Write-Pass ("Paid-fallback proof: room {0} spent one paid credit per user, preserved exhausted free counters, and stayed idempotent on retry." -f $paidRoomId)
    Write-Pass ("Ledger proof: chat_night_entry rows were written for room {0} with delta=-1 and balance_after=0 for both users." -f $paidRoomId)

    Write-Step "Scenario 3: No entitlement rejection"
    $nonePhone = New-TestPhone -Prefix "975"
    $noneToken = Register-TestUser -PhoneNumber $nonePhone -Label "NoEntitlementUser"
    Patch-Profile -Token $noneToken -Gender "Man" -FirstName "NoPass"
    Leave-ChatNight -Token $noneToken
    $noneStatusInitial = Get-ChatNightStatus -Token $noneToken
    Set-FreePassesExhausted -Phone $nonePhone -DateIst $dateIst
    $noneStatusReady = Get-ChatNightStatus -Token $noneToken
    Assert-Equal -Actual $noneStatusReady.next_spend_source -Expected "none" -Context "No-entitlement next_spend_source"
    $enterNone = Enter-ChatNight -Token $noneToken
    Assert-FailureStatus -Result $enterNone -ExpectedStatuses @(403) -Context "POST /api/chat-night/enter without entitlement"
    $noneDetail = Try-GetDetailMessage -RawErrorText "$($enterNone.ErrorText)"
    Assert-True -Condition ($noneDetail -match "(?i)no chat night passes remaining") -Context "No-entitlement detail must mention no Chat Night passes remaining."
    Write-Pass ("No-entitlement rejection proof: exhausted user was rejected with HTTP 403 and detail '{0}'." -f $noneDetail)

    Write-Step "Scenario 4: Match-side correctness skips zero-entitlement queued users"
    $staleWomanPhone = New-TestPhone -Prefix "976"
    $validWomanPhone = New-TestPhone -Prefix "977"
    $scanManPhone = New-TestPhone -Prefix "978"
    $staleWomanToken = Register-TestUser -PhoneNumber $staleWomanPhone -Label "StaleWoman"
    $validWomanToken = Register-TestUser -PhoneNumber $validWomanPhone -Label "ValidWoman"
    $scanManToken = Register-TestUser -PhoneNumber $scanManPhone -Label "ScanMan"
    Patch-Profile -Token $staleWomanToken -Gender "Woman" -FirstName "StaleWoman"
    Patch-Profile -Token $validWomanToken -Gender "Woman" -FirstName "ValidWoman"
    Patch-Profile -Token $scanManToken -Gender "Man" -FirstName "ScanMan"
    Leave-ChatNight -Token $staleWomanToken
    Leave-ChatNight -Token $validWomanToken
    Leave-ChatNight -Token $scanManToken

    $staleStatus = Get-ChatNightStatus -Token $staleWomanToken
    $validStatus = Get-ChatNightStatus -Token $validWomanToken
    $scanStatus = Get-ChatNightStatus -Token $scanManToken
    Assert-Equal -Actual $staleStatus.next_spend_source -Expected "free_daily" -Context "StaleWoman initial next_spend_source"
    Assert-Equal -Actual $validStatus.next_spend_source -Expected "free_daily" -Context "ValidWoman initial next_spend_source"
    Assert-Equal -Actual $scanStatus.next_spend_source -Expected "free_daily" -Context "ScanMan initial next_spend_source"

    $staleState = Get-DbUserState -Phone $staleWomanPhone -DateIst $dateIst
    $validState = Get-DbUserState -Phone $validWomanPhone -DateIst $dateIst
    $scanState = Get-DbUserState -Phone $scanManPhone -DateIst $dateIst

    $enterStaleWoman = Enter-ChatNight -Token $staleWomanToken
    Assert-Success -Result $enterStaleWoman -Context "POST /api/chat-night/enter for StaleWoman"
    Assert-Equal -Actual $enterStaleWoman.Body.status -Expected "queued" -Context "StaleWoman /enter status"

    $enterValidWoman = Enter-ChatNight -Token $validWomanToken
    Assert-Success -Result $enterValidWoman -Context "POST /api/chat-night/enter for ValidWoman"
    Assert-Equal -Actual $enterValidWoman.Body.status -Expected "queued" -Context "ValidWoman /enter status"

    Set-FreePassesExhausted -Phone $staleWomanPhone -DateIst $dateIst
    $staleStatusExhausted = Get-ChatNightStatus -Token $staleWomanToken
    Assert-Equal -Actual $staleStatusExhausted.next_spend_source -Expected "none" -Context "StaleWoman next_spend_source after forced exhaustion"

    $enterScanMan = Enter-ChatNight -Token $scanManToken
    Assert-Success -Result $enterScanMan -Context "POST /api/chat-night/enter for ScanMan"
    Assert-Equal -Actual $enterScanMan.Body.status -Expected "match_found" -Context "ScanMan /enter status"
    $scanRoomId = "$($enterScanMan.Body.room_id)"
    Assert-True -Condition (-not [string]::IsNullOrWhiteSpace($scanRoomId)) -Context "Match-side correctness room_id must be present."

    $validWomanRoom = Wait-For-MyRoom -Token $validWomanToken -ExpectedRoomId $scanRoomId -Label "ValidWoman"
    Assert-Equal -Actual $validWomanRoom.room_id -Expected $scanRoomId -Context "ValidWoman matched room_id"
    $staleWomanRoom = Get-MyRoom -Token $staleWomanToken
    Assert-Equal -Actual $staleWomanRoom.state -Expected "none" -Context "StaleWoman must not receive an invalid room"

    $scanRoom = Get-RoomParticipants -RoomId $scanRoomId
    Assert-Equal -Actual $scanRoom.state -Expected "active" -Context "ScanMan room state"
    Assert-True -Condition (
        "$($scanRoom.male_user_id)" -eq "$($scanState.user_id)" -or
        "$($scanRoom.female_user_id)" -eq "$($scanState.user_id)"
    ) -Context "ScanMan user_id must be a participant in the matched room."
    Assert-True -Condition (
        "$($scanRoom.male_user_id)" -eq "$($validState.user_id)" -or
        "$($scanRoom.female_user_id)" -eq "$($validState.user_id)"
    ) -Context "ValidWoman user_id must be a participant in the matched room."
    Assert-True -Condition (
        "$($scanRoom.male_user_id)" -ne "$($staleState.user_id)" -and
        "$($scanRoom.female_user_id)" -ne "$($staleState.user_id)"
    ) -Context "Zero-entitlement StaleWoman must not be a participant in the matched room."
    Write-Pass ("Match-side correctness proof: queued zero-entitlement user was skipped and room {0} matched ScanMan with ValidWoman instead." -f $scanRoomId)

    Write-Host ""
    Write-Host "PASS: chat night pass consumption contract verified." -ForegroundColor Green
}
finally {
    Pop-Location
}
