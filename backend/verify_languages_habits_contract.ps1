$baseUrl = "http://localhost:8000"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$phone = "+1999$timestamp"
$password = "LangHabits123!"

Write-Host "1. Registering user $phone..."
$regBody = @{
    phone_number = $phone
    password = $password
} | ConvertTo-Json

try {
    $regResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $regBody -ContentType "application/json"
    $token = $regResponse.access_token
    Write-Host "   Got Token."
} catch {
    Write-Error "   Registration failed: $_"
    exit 1
}

$headers = @{ Authorization = "Bearer $token" }

function Assert-IsArray {
    param(
        [Parameter(Mandatory = $true)] $value,
        [Parameter(Mandatory = $true)] [string] $label
    )

    if ($null -eq $value -or -not ($value -is [System.Array])) {
        Write-Error "$label is not an array."
        exit 1
    }
}

function Assert-IsObject {
    param(
        [Parameter(Mandatory = $true)] $value,
        [Parameter(Mandatory = $true)] [string] $label
    )

    if ($null -eq $value) {
        Write-Error "$label is null."
        exit 1
    }

    if ($value -is [System.Array]) {
        Write-Error "$label is an array (expected object)."
        exit 1
    }

    if ($value -is [string]) {
        Write-Error "$label is a string (expected object)."
        exit 1
    }

    if (-not ($value -is [pscustomobject] -or $value -is [hashtable])) {
        Write-Error "$label is not an object."
        exit 1
    }
}

function Get-Me {
    try {
        return Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Get -Headers $headers
    } catch {
        Write-Error "GET /api/users/me failed: $_"
        exit 1
    }
}

function Patch-Me {
    param(
        [Parameter(Mandatory = $true)] [string] $body,
        [Parameter(Mandatory = $true)] [string] $label
    )

    try {
        return Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $body -ContentType "application/json"
    } catch {
        Write-Error "$label PATCH failed: $_"
        exit 1
    }
}

Write-Host "2. Verifying GET /me languages + habits defaults..."
$me = Get-Me
Assert-IsArray $me.languages "languages"
Assert-IsObject $me.habits "habits"

Write-Host "3. Updating languages to [English, Tamil]..."
$languagesPatch = @{
    languages = @("English", "Tamil")
} | ConvertTo-Json -Depth 5

$languagesResponse = Patch-Me $languagesPatch "Languages"
Assert-IsArray $languagesResponse.languages "languages after languages PATCH"
if ($languagesResponse.languages.Count -ne 2 -or $languagesResponse.languages[0] -ne "English" -or $languagesResponse.languages[1] -ne "Tamil") {
    Write-Error "languages did not persist the expected list."
    exit 1
}

Write-Host "4. Updating habits (partial)..."
$habitsPatch = @{
    habits = @{
        drinking = "Occasionally"
    }
} | ConvertTo-Json -Depth 5

$habitsResponse = Patch-Me $habitsPatch "Habits"
Assert-IsObject $habitsResponse.habits "habits after partial PATCH"
if ($habitsResponse.habits.drinking -ne "Occasionally") {
    Write-Error "habits.drinking did not update."
    exit 1
}

Write-Host "5. Sending empty values (languages=[], habits={})..."
$emptyPatch = @{
    languages = @()
    habits = @{}
} | ConvertTo-Json -Depth 5

$emptyResponse = Patch-Me $emptyPatch "Empty values"
Assert-IsArray $emptyResponse.languages "languages after empty PATCH"
Assert-IsObject $emptyResponse.habits "habits after empty PATCH"

Write-Host "`nPASS: languages/habits contract verified."
