$baseUrl = "http://localhost:8000"

# Generate random phone for unique user to ensure clean state
$rand = Get-Random -Minimum 10000 -Maximum 99999
$phone = "+120000$rand" 
$password = "TestPass123!"

Write-Host "1. Registering Test Woman ($phone)..."

try {
    # 1. Register
    $regBody = @{ phone_number = $phone; password = $password }
    $regJson = $regBody | ConvertTo-Json
    $regRes = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method Post -Body $regJson -ContentType "application/json"
    $token = $regRes.access_token
    
    # 2. Update Profile (Gender=Woman, Onboarding=True)
    Write-Host "2. Setting profile to Woman + Onboarding Complete..."
    $headers = @{ Authorization = "Bearer $token" }
    $patchBody = @{ 
        gender = "Woman"
        first_name = "Anna"
        onboarding_completed = $true 
        birth_date = "2000-01-01" 
    }
    $patchJson = $patchBody | ConvertTo-Json
    
    Invoke-RestMethod -Uri "$baseUrl/api/users/me" -Method Patch -Headers $headers -Body $patchJson -ContentType "application/json" | Out-Null

    # 3. Enter Chat Night Pool
    Write-Host "3. Entering Chat Night Pool..."
    $enterRes = Invoke-RestMethod -Uri "$baseUrl/api/chat-night/enter" -Method Post -Headers $headers
    
    Write-Host "   Status: $($enterRes.status)"
    if ($enterRes.room_id) {
         Write-Host "   MATCH FOUND! Room ID: $($enterRes.room_id)"
         Write-Host "   Go check your app!"
    } else {
         Write-Host "   User Queued. Waiting for match..."
    }

} catch {
    Write-Error "Error: $_"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $details = $reader.ReadToEnd()
        Write-Host "Details: $details"
    }
}
