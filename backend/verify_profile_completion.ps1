$baseUrl = "http://localhost:8000"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$phone = "+1888$timestamp"
$password = "ProfileTest123!"

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

# Helper to get score
function Get-Score {
    $me = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Get -Headers $headers
    return $me.profile_completion
}

# 2. Check Initial Score
# Init: Not onboarding complete (missing name/birth/gender/photos) -> 0?
# Actually, logic says: if onboarding_completed: 50. else if basic fields ok: 50.
$score = Get-Score
Write-Host "2. Initial Score: $score (Expected: 0)"

# 3. Complete Onboarding (Base 50%)
Write-Host "3. Completing Onboarding (Base)..."
$basePatch = @{
    firstName = "ProfileTester"
    birthday = "1990-01-01"
    gender = "Man"
    photos = @("p1", "p2", "p3", "p4")
} | ConvertTo-Json
$null = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $basePatch -ContentType "application/json"

$score = Get-Score
Write-Host "   Score after Base: $score (Expected: 50)"

# 4. Add Bio (+10)
Write-Host "4. Adding Bio..."
$bioPatch = @{ bio = "Hello World" } | ConvertTo-Json
$null = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $bioPatch -ContentType "application/json"
$score = Get-Score
Write-Host "   Score after Bio: $score (Expected: 60)"

# 5. Add Prompts (+10)
Write-Host "5. Adding Prompts..."
$promptPatch = @{ prompts = @( @{ question="Q1"; answer="A1" } ) } | ConvertTo-Json
$null = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $promptPatch -ContentType "application/json"
$score = Get-Score
Write-Host "   Score after Prompts: $score (Expected: 70)"

# 6. Add Basics (+10) - need 2/3 of Work, Loc, Hometown
Write-Host "6. Adding Basics..."
$basicsPatch = @{
    work = "Software Engineer"
    location = "San Francisco"
} | ConvertTo-Json
$null = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $basicsPatch -ContentType "application/json"
$score = Get-Score
Write-Host "   Score after Basics: $score (Expected: 80)"

# 7. Add Details (+10) - need 3: Height, Sign, Religion, Politics, EduLevel, Kids, Habits(any)
Write-Host "7. Adding Details..."
$detailsPatch = @{
    height = "180cm"
    starSign = "Leo"
    educationLevel = "Bachelors"
} | ConvertTo-Json
$null = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $detailsPatch -ContentType "application/json"
$score = Get-Score
Write-Host "   Score after Details: $score (Expected: 90)"

# 8. Add Tags (+10) - Interests
Write-Host "8. Adding Interests..."
$tagsPatch = @{
    interests = @("Coding", "Pizza")
} | ConvertTo-Json
$null = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $tagsPatch -ContentType "application/json"
$score = Get-Score
Write-Host "   Score after Tags: $score (Expected: 100)"


Write-Host "`nDone."
