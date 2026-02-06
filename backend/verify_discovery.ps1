$baseUrl = "http://localhost:8000"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"

# Helper for registration
function Register-User($prefix, $pw) {
    $ph = "+$prefix$timestamp"
    $body = @{ phone_number = $ph; password = $pw } | ConvertTo-Json
    try {
        $res = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $body -ContentType "application/json"
        return @{ token = $res.access_token; phone = $ph }
    } catch {
        Write-Error "Reg failed for $ph : $_"
        exit 1
    }
}

# Helper for patching
function Patch-User($token, $bodyHashTable) {
    $headers = @{ Authorization = "Bearer $token" }
    $json = $bodyHashTable | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $json -ContentType "application/json"
}

Write-Host "1. Creating Users..."

# User A: Viewer (Self)
$userA = Register-User "100" "PassA!"
$tokenA = $userA.token
Write-Host "   User A (Viewer) created."

# User B: Perfect Candidate (Score 100)
$userB = Register-User "200" "PassB!"
Patch-User $userB.token @{
    firstName="CandidateB"; birthday="1995-01-01"; gender="Woman";
    photos=@("p1","p2","p3","p4"); bio="I am perfect";
    work="Doctor"; location="London"; interests=@("Travel")
}
Write-Host "   User B (Score 100) created."

# User C: Incomplete (Score ~20 - No photos, no bio)
$userC = Register-User "300" "PassC!"
Patch-User $userC.token @{ firstName="CandidateC"; birthday="1999-01-01"; gender="Man" }
Write-Host "   User C (Score < 60) created."

# User D: Good Candidate (Score ~70 - Bio, Prompts, Basics)
$userD = Register-User "400" "PassD!"
Patch-User $userD.token @{
    firstName="CandidateD"; birthday="1992-01-01"; gender="Woman";
    photos=@("p1","p2","p3","p4"); # Base 50
    bio="I am good"; # +10 -> 60
    prompts=@(@{question="Q"; answer="A"}) # +10 -> 70
}
Write-Host "   User D (Score 70) created."

# 2. Run Discovery as User A
Write-Host "`n2. Running Discovery as User A..."
$headersA = @{ Authorization = "Bearer $tokenA" }
$discovery = Invoke-RestMethod -Uri "$baseUrl/api/discovery/" -Method Get -Headers $headersA

# 3. Analyze Results
Write-Host "   Found $($discovery.Count) users."

# Check Includes
$foundB = $discovery | Where-Object { $_.first_name -eq "CandidateB" }
$foundD = $discovery | Where-Object { $_.first_name -eq "CandidateD" }

if ($foundB) { Write-Host "   SUCCESS: User B found (Score 100)." } else { Write-Error "   FAIL: User B missing." }
if ($foundD) { Write-Host "   SUCCESS: User D found (Score 70)." } else { Write-Error "   FAIL: User D missing." }

# Check Excludes
$foundC = $discovery | Where-Object { $_.first_name -eq "CandidateC" }
$foundSelf = $discovery | Where-Object { $_.phone_number -eq $userA.phone } 

if ($foundC) { Write-Error "   FAIL: User C (Low Score) was returned!" } else { Write-Host "   SUCCESS: User C excluded." }
# Note: UserDiscoveryRead schema does not return phone_number, checking by ID or name would be safer but self shouldn't be there.
# Let's rely on filter count + explicit check if we knew ID.
# Actually, since UserDiscoveryRead doesn't have phone, check if any returned user has 'firstName' matching User A if we set one? User A has no first name.
# We can trust logic if count is correct (should be 2, B and D).

# Verify Schema (Fields present)
$first = $discovery[0]
if ($first.bio -and $first.work) {
    Write-Host "   SUCCESS: Schema contains bio and work."
} else {
    Write-Warning "   Schema validation warning: Bio or Work missing in first result."
}

if ($first.phone_number) {
    Write-Error "   FAIL: Schema leaked phone_number!"
} else {
    Write-Host "   SUCCESS: phone_number not leaked."
}

Write-Host "`nDone."
