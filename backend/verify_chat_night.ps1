$baseUrl = "http://127.0.0.1:8000"
$timestamp = Get-Date -Format "yyyyMMddHHmmss"

# --- SAFE TESTING MODE CONFIG ---
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "      CHAT NIGHT VERIFICATION SCRIPT      " -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "WARNING: Do not run this while performing manual emulator testing." -ForegroundColor Red
Write-Host "This script creates temporary users and may reset localized queue state." -ForegroundColor Red
Write-Host ""
Write-Host "Target Base URL: $baseUrl" -ForegroundColor Cyan
Write-Host ""

# 0. Pre-check Status
try {
    Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -ErrorAction Stop | Out-Null
    Write-Host "Server Check: OK (Backend is Running)" -ForegroundColor Green
} catch {
    Write-Error "Server Unreachable at $baseUrl. Is uvicorn running?"
    exit 1
}

# Helper for registration
function Register-User($prefix, $gender) {
    # Unique ID for this test run to avoid collisions
    $ph = "+${prefix}${timestamp}" 
    $body = @{ phone_number = $ph; password = "Password1!" } | ConvertTo-Json
    try {
        $res = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $body -ContentType "application/json"
        
        # Patch gender
        $headers = @{ Authorization = "Bearer $($res.access_token)" }
        $patch = @{ gender = $gender; firstName = "Test${prefix}" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $patch -ContentType "application/json" | Out-Null
        
        return @{ token = $res.access_token; phone = $ph; id = $res.user.id } # capture ID if available, else we might need another call but token is key
    } catch {
        Write-Error "Reg failed for $ph : $_"
        exit 1
    }
}

# Helper for Cleanup
function Leave-Pool($token, $name) {
    if ($null -eq $token) { return }
    $h = @{ Authorization = "Bearer $token" }
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/chat-night/leave" -Method Post -Headers $h -ErrorAction SilentlyContinue | Out-Null
        Write-Host "   Cleanup: $name left the pool." -ForegroundColor DarkGray
    } catch {
        Write-Host "   Cleanup: Failed to match $name leave request (might not be queued)." -ForegroundColor DarkGray
    }
}

$male = $null
$female = $null

try {
    # 1. Create Users
    Write-Host "1. Creating Isolated Test Users..."
    $male = Register-User "998" "Man"   # 998 prefix for Test Man
    $female = Register-User "999" "Woman" # 999 prefix for Test Woman
    Write-Host "   Users created."

    $hM = @{ Authorization = "Bearer $($male.token)" }
    $hF = @{ Authorization = "Bearer $($female.token)" }

    # 2. Check Pass Override (if ENV set)
    $statusM = Invoke-RestMethod -Uri "$baseUrl/api/chat-night/status" -Method Get -Headers $hM
    Write-Host "   Male Passes Total: $($statusM.passes_total)"

    # 3. Enter Pool - Male
    Write-Host "3. Male entering pool... and polling"
    $resM = Invoke-RestMethod -Uri "$baseUrl/api/chat-night/enter" -Method Post -Headers $hM
    Write-Host "   Male Status: $($resM.status)"
    
    # Poll immediately
    $poll1 = Invoke-RestMethod -Uri "$baseUrl/api/chat-night/my-room" -Method Get -Headers $hM
    Write-Host "   Male /my-room state: $($poll1.state)"

    # 4. Enter Pool - Female
    Write-Host "4. Female entering pool..."
    $resF = Invoke-RestMethod -Uri "$baseUrl/api/chat-night/enter" -Method Post -Headers $hF
    Write-Host "   Female Status: $($resF.status)"

    $roomId = $resF.room_id
    if (-not $roomId -and $resM.room_id) { $roomId = $resM.room_id }

    # Poll Male again
    $poll2 = Invoke-RestMethod -Uri "$baseUrl/api/chat-night/my-room" -Method Get -Headers $hM
    Write-Host "   Male /my-room (2nd poll) state: $($poll2.state)"
    
    if ($poll2.state -eq "active") {
        Write-Host "   SUCCESS: Match confirmed." -ForegroundColor Green
        # Write-Host ($poll2 | ConvertTo-Json -Depth 5)
    } else {
        Write-Warning "   Match NOT confirmed immediately. (Might be queued if environment is busy)"
    }

    # 5. Engage
    if ($roomId) {
        Write-Host "5. Engaging..."
        # Male engages
        Invoke-RestMethod -Uri "$baseUrl/api/chat-night/engage" -Method Post -Headers $hM -Body (@{room_id=$roomId}|ConvertTo-Json) -ContentType "application/json" | Out-Null
        
        # Female engages
        $finalState = Invoke-RestMethod -Uri "$baseUrl/api/chat-night/engage" -Method Post -Headers $hF -Body (@{room_id=$roomId}|ConvertTo-Json) -ContentType "application/json"
        
        if ($finalState.room_state -eq "engaged") {
            Write-Host "   SUCCESS: Room is ENGAGED." -ForegroundColor Green
        } else {
             Write-Host "   Room State: $($finalState.room_state)"
        }
    }

} catch {
    Write-Error "Test Failed: $_"
} finally {
    Write-Host "------------------------------------------"
    Write-Host "CLEANUP: Removing test users from queue..." -ForegroundColor Cyan
    if ($male)   { Leave-Pool $male.token "Male User" }
    if ($female) { Leave-Pool $female.token "Female User" }
    Write-Host "Done."
}
