$baseUrl = "http://localhost:8000"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$phone = "+1777$timestamp"
$password = "PartialUpdateTest!"

Write-Host "Registering user $phone..."
$regBody = @{
    phone_number = $phone
    password = $password
} | ConvertTo-Json

try {
    $regResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $regBody -ContentType "application/json"
    $token = $regResponse.access_token
} catch {
    Write-Error "Registration failed: $_"
    exit 1
}

$headers = @{ Authorization = "Bearer $token" }

# 1. Fill ALL fields
Write-Host "1. Seeding all profile fields..."
$fullPatch = @{
    firstName = "SeedName"
    birthday = "1995-05-05"
    gender = "Woman"
    work = "Software Engineer"
    location = "Berlin"
    hometown = "Munich"
    bio = "Original Bio"
    education = "TU Berlin"
    educationLevel = "Masters"
    height = "170cm"
    starSign = "Taurus"
    religion = "Agnostic"
    politics = "Liberal"
    kidsHave = "No"
    kidsWant = "Yes"
    drinking = "Socially"
    smoking = "Never"
    exercise = "Active"
    datingPreference = "Men"
    mode = "Date"
    intention = "Something serious"
    interests = @("Coding")
    values = @("Honesty")
    causes = @("Environment")
    prompts = @( @{ question="Q1"; answer="A1" } )
    photos = @("url1", "url2", "url3", "url4")
} | ConvertTo-Json

$seededUser = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $fullPatch -ContentType "application/json"

# verify seed
if ($seededUser.bio -ne "Original Bio") { Write-Error "Seed failed: Bio mismatch"; exit 1 }
if ($seededUser.work -ne "Software Engineer") { Write-Error "Seed failed: Work mismatch"; exit 1 }

# 2. Partial Update (Bio Only)
Write-Host "2. sending Partial Update (Bio only)..."
$partialPatch = @{
    bio = "Updated Bio"
} | ConvertTo-Json

$updatedUser = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $partialPatch -ContentType "application/json"

# 3. Validation
Write-Host "3. Validating persistence..."

# Check updated field
if ($updatedUser.bio -ne "Updated Bio") { 
    Write-Error "FAIL: Bio did not update." 
} else {
    Write-Host "SUCCESS: Bio updated."
}

# Check non-updated fields (should be preserved)
if ($updatedUser.work -ne "Software Engineer") { Write-Error "FAIL: 'work' was wiped/changed!"; exit 1 }
if ($updatedUser.location -ne "Berlin") { Write-Error "FAIL: 'location' was wiped/changed!"; exit 1 }
if ($updatedUser.hometown -ne "Munich") { Write-Error "FAIL: 'hometown' was wiped/changed!"; exit 1 }
if ($updatedUser.first_name -ne "SeedName") { Write-Error "FAIL: 'first_name' was wiped/changed!"; exit 1 }
if ($updatedUser.education_level -ne "Masters") { Write-Error "FAIL: 'education_level' was wiped/changed!"; exit 1 }
if ($updatedUser.interests[0] -ne "Coding") { Write-Error "FAIL: 'interests' wiped!"; exit 1 }
if ($updatedUser.prompts[0].answer -ne "A1") { Write-Error "FAIL: 'prompts' wiped!"; exit 1 }

Write-Host "SUCCESS: All other fields preserved."

# 4. Verify GET /me structure
Write-Host "4. Verifying GET /me response..."
$me = Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Get -Headers $headers

if ($me.profile_completion -gt 0) {
    Write-Host "SUCCESS: profile_completion returned ($($me.profile_completion))."
} else {
    Write-Error "FAIL: profile_completion zero or missing."
}

Write-Host "Done."
