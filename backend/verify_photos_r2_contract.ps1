[CmdletBinding()]
param(
    [string] $BaseUrl = "http://localhost:8000"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")

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
    Write-Host "FAIL: $Message" -ForegroundColor Red
    exit 1
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

function Get-ApiErrorDetail {
    param(
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.ErrorRecord] $ErrorRecord
    )

    if ($ErrorRecord.ErrorDetails -and -not [string]::IsNullOrWhiteSpace("$($ErrorRecord.ErrorDetails.Message)")) {
        $raw = "$($ErrorRecord.ErrorDetails.Message)"
        try {
            $parsed = $raw | ConvertFrom-Json -ErrorAction Stop
            if ($parsed.PSObject.Properties.Name -contains "detail") {
                return [string] $parsed.detail
            }
        }
        catch {
            return $raw
        }
        return $raw
    }

    return ""
}

function Get-RedactedUrl {
    param([Parameter(Mandatory = $true)][string] $Url)

    try {
        $uri = [Uri] $Url
        return "$($uri.Scheme)://$($uri.Host)$($uri.AbsolutePath)?<redacted>"
    }
    catch {
        return "<invalid-url>"
    }
}

function Register-User {
    param(
        [Parameter(Mandatory = $true)][string] $PhoneNumber,
        [Parameter(Mandatory = $true)][string] $Password
    )

    $registerBody = @{
        phone_number = $PhoneNumber
        password = $Password
    } | ConvertTo-Json

    for ($attempt = 1; $attempt -le 2; $attempt++) {
        try {
            $regResponse = Invoke-RestMethod -Uri "$BaseUrl/api/auth/register" -Method Post -Body $registerBody -ContentType "application/json"
            if (-not $regResponse.access_token) {
                Fail "Register response missing access_token."
            }
            return [string] $regResponse.access_token
        }
        catch {
            $detail = Get-ApiErrorDetail -ErrorRecord $_
            if ($detail -match "Rate limit exceeded" -and $attempt -lt 2) {
                Write-Host "Registration rate limit hit. Waiting 65s and retrying..." -ForegroundColor Yellow
                Start-Sleep -Seconds 65
                continue
            }
            Fail "User registration failed (status=$(Get-HttpStatusCodeFromError -ErrorRecord $_))."
        }
    }

    Fail "User registration failed after retry."
}

function Convert-HeadersToHashtable {
    param([Parameter(Mandatory = $true)] $HeadersObject)

    $headers = @{}
    foreach ($prop in $HeadersObject.PSObject.Properties) {
        $headers[$prop.Name] = [string] $prop.Value
    }
    return $headers
}

function Request-UploadUrl {
    param(
        [Parameter(Mandatory = $true)][string] $Token,
        [Parameter(Mandatory = $true)][string] $ContentType,
        [Parameter(Mandatory = $true)][int] $ContentLength,
        [Parameter(Mandatory = $true)][string] $Label
    )

    $headers = @{ Authorization = "Bearer $Token" }
    $requestBody = @{
        content_type = $ContentType
        content_length = $ContentLength
    } | ConvertTo-Json

    try {
        return Invoke-RestMethod -Uri "$BaseUrl/api/photos/upload-url" -Method Post -Headers $headers -Body $requestBody -ContentType "application/json"
    }
    catch {
        $statusCode = Get-HttpStatusCodeFromError -ErrorRecord $_
        $detail = Get-ApiErrorDetail -ErrorRecord $_
        if ($statusCode -eq 503 -and $detail.ToLower().Contains("disabled")) {
            Fail "set BH_PHOTOS_ENABLED=true"
        }
        Fail "POST /api/photos/upload-url failed for $Label (status=$statusCode detail='$detail')."
    }
}

function Assert-UploadUrlFails {
    param(
        [Parameter(Mandatory = $true)][string] $Token,
        [Parameter(Mandatory = $true)][string] $ContentType,
        [Parameter(Mandatory = $true)][int] $ContentLength,
        [Parameter(Mandatory = $true)][int] $ExpectedStatus,
        [Parameter(Mandatory = $true)][string] $Label
    )

    $headers = @{ Authorization = "Bearer $Token" }
    $requestBody = @{
        content_type = $ContentType
        content_length = $ContentLength
    } | ConvertTo-Json

    try {
        $null = Invoke-RestMethod -Uri "$BaseUrl/api/photos/upload-url" -Method Post -Headers $headers -Body $requestBody -ContentType "application/json"
        Fail "$Label expected HTTP $ExpectedStatus but request succeeded."
    }
    catch {
        $statusCode = Get-HttpStatusCodeFromError -ErrorRecord $_
        $detail = Get-ApiErrorDetail -ErrorRecord $_
        if ($statusCode -eq 503 -and $detail.ToLower().Contains("disabled")) {
            Fail "set BH_PHOTOS_ENABLED=true"
        }
        if ($statusCode -ne $ExpectedStatus) {
            Fail "$Label expected HTTP $ExpectedStatus but got $statusCode."
        }
        Write-Pass "$Label returned HTTP $ExpectedStatus"
    }
}

function Upload-PhotoViaPut {
    param(
        [Parameter(Mandatory = $true)][string] $UploadUrl,
        [Parameter(Mandatory = $true)][hashtable] $RequiredHeaders,
        [Parameter(Mandatory = $true)][string] $FilePath,
        [Parameter(Mandatory = $true)][string] $Label
)

    $curlArgs = @(
        "--silent",
        "--show-error",
        "--output", "NUL",
        "--write-out", "%{http_code}",
        "-X", "PUT"
    )

    foreach ($headerName in $RequiredHeaders.Keys) {
        $headerValue = [string] $RequiredHeaders[$headerName]
        $curlArgs += @("-H", "${headerName}: ${headerValue}")
    }

    $curlArgs += @("--upload-file", $FilePath, $UploadUrl)
    $statusText = & curl.exe @curlArgs
    if ($LASTEXITCODE -ne 0) {
        Fail "PUT upload failed for $Label (curl exit code=$LASTEXITCODE)."
    }

    $statusCode = 0
    if (-not [int]::TryParse("$statusText", [ref]$statusCode)) {
        Fail "PUT upload failed for $Label (invalid HTTP response code '$statusText')."
    }
    if ($statusCode -lt 200 -or $statusCode -gt 299) {
        Fail "PUT upload failed for $Label (HTTP $statusCode)."
    }
}

function Patch-Photos {
    param(
        [Parameter(Mandatory = $true)][string] $Token,
        [Parameter(Mandatory = $true)][string[]] $Photos
    )

    $headers = @{ Authorization = "Bearer $Token" }
    $patchBody = @{ photos = $Photos } | ConvertTo-Json -Depth 5
    return Invoke-RestMethod -Uri "$BaseUrl/api/users/me" -Method Patch -Headers $headers -Body $patchBody -ContentType "application/json"
}

function Assert-PatchPhotosFails {
    param(
        [Parameter(Mandatory = $true)][string] $Token,
        [Parameter(Mandatory = $true)][string[]] $Photos,
        [Parameter(Mandatory = $true)][int] $ExpectedStatus,
        [Parameter(Mandatory = $true)][string] $Label
    )

    try {
        $null = Patch-Photos -Token $Token -Photos $Photos
        Fail "$Label expected HTTP $ExpectedStatus but request succeeded."
    }
    catch {
        $statusCode = Get-HttpStatusCodeFromError -ErrorRecord $_
        $detail = Get-ApiErrorDetail -ErrorRecord $_
        if ($statusCode -eq 503 -and $detail.ToLower().Contains("disabled")) {
            Fail "set BH_PHOTOS_ENABLED=true"
        }
        if ($statusCode -ne $ExpectedStatus) {
            Fail "$Label expected HTTP $ExpectedStatus but got $statusCode."
        }
        Write-Pass "$Label returned HTTP $ExpectedStatus"
    }
}

Write-Host "===================================================" -ForegroundColor Yellow
Write-Host " PHOTOS R2 CONTRACT VERIFIER (W7-T4-C)             " -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Yellow
Write-Host "Target Base URL: $BaseUrl" -ForegroundColor Cyan

Write-Step "Checking backend health endpoint..."
try {
    $null = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
    Write-Pass "Health endpoint reachable"
}
catch {
    Fail "Backend is unreachable at $BaseUrl."
}

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$phone = "+1977$timestamp"
$password = "PhotosR2Test123!"

Write-Step "Registering test user..."
$token = Register-User -PhoneNumber $phone -Password $password
$authHeaders = @{ Authorization = "Bearer $token" }
Write-Pass "Registered test user and acquired token"

# Tiny 1x1 PNG
$pngBytes = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6rZ2kAAAAASUVORK5CYII=")
$tempImagePath = Join-Path $env:TEMP ("bh-r2-photo-{0}.png" -f ([guid]::NewGuid().ToString("N")))
[System.IO.File]::WriteAllBytes($tempImagePath, $pngBytes)

$finalUrls = @()

try {
    Write-Step "Requesting 4 signed upload URLs and uploading photos..."
    for ($index = 1; $index -le 4; $index++) {
        $uploadContract = Request-UploadUrl -Token $token -ContentType "image/png" -ContentLength $pngBytes.Length -Label "positive-upload-$index"

        if (-not $uploadContract) {
            Fail "Upload contract is empty for photo #$index."
        }
        if ([string]::IsNullOrWhiteSpace([string]$uploadContract.upload_url)) {
            Fail "upload_url missing for photo #$index."
        }
        if ([string]::IsNullOrWhiteSpace([string]$uploadContract.final_url)) {
            Fail "final_url missing for photo #$index."
        }
        if (-not ([string]$uploadContract.final_url).StartsWith("https://")) {
            Fail "final_url is not HTTPS for photo #$index."
        }

        $expiresIn = [int] $uploadContract.expires_in
        if ($expiresIn -le 0 -or $expiresIn -gt 300) {
            Fail "expires_in out of contract bounds for photo #$index. Got $expiresIn."
        }

        if (-not $uploadContract.required_headers) {
            Fail "required_headers missing for photo #$index."
        }

        $putHeaders = Convert-HeadersToHashtable -HeadersObject $uploadContract.required_headers
        if (-not $putHeaders.ContainsKey("Content-Type")) {
            Fail "required_headers.Content-Type missing for photo #$index."
        }

        Upload-PhotoViaPut -UploadUrl ([string]$uploadContract.upload_url) -RequiredHeaders $putHeaders -FilePath $tempImagePath -Label "photo #$index"
        $finalUrls += [string] $uploadContract.final_url
        Write-Host ("   Uploaded photo #{0}: upload_url={1}" -f $index, (Get-RedactedUrl -Url ([string]$uploadContract.upload_url)))
    }

    Write-Step "Saving uploaded final URLs to profile..."
    $patchResponse = Patch-Photos -Token $token -Photos $finalUrls
    $patchedCount = @($patchResponse.photos).Count
    if ($patchedCount -ne 4) {
        Fail "PATCH /api/users/me returned photos.Count=$patchedCount (expected 4)."
    }

    $me = Invoke-RestMethod -Uri "$BaseUrl/api/users/me" -Method Get -Headers $authHeaders
    $storedPhotos = @($me.photos)
    if ($storedPhotos.Count -ne 4) {
        Fail "GET /api/users/me returned photos.Count=$($storedPhotos.Count) (expected 4)."
    }
    Write-Pass "Stored 4 photo URLs on /api/users/me"

    Write-Step "Negative check: invalid content_type rejected..."
    Assert-UploadUrlFails -Token $token -ContentType "image/gif" -ContentLength $pngBytes.Length -ExpectedStatus 400 -Label "invalid content_type"

    Write-Step "Negative check: oversized content_length rejected..."
    Assert-UploadUrlFails -Token $token -ContentType "image/png" -ContentLength (5MB + 1) -ExpectedStatus 413 -Label "oversized content_length"

    Write-Step "Negative check: file:// photo URL rejected..."
    Assert-PatchPhotosFails -Token $token -Photos @("file://local/path/photo.png") -ExpectedStatus 400 -Label "file:// URL validation"

    Write-Step "Negative check: non-R2 domain URL rejected..."
    Assert-PatchPhotosFails -Token $token -Photos @("https://example.com/photo.png") -ExpectedStatus 400 -Label "non-R2 URL validation"

    Write-Pass "photos R2 contract verified (W7-T4-C)"
}
finally {
    if (Test-Path $tempImagePath) {
        Remove-Item -Path $tempImagePath -Force
    }
}
