# Phone vs Emulator Setup

## 1. One-Time Firewall Rule (Admin PowerShell)
```powershell
netsh advfirewall firewall add rule name="BlushHour Backend 8000" dir=in action=allow protocol=TCP localport=8000
```

## 2. Run for Phone (Pixel 8)
```powershell
taskkill /F /IM node.exe
$env:EXPO_PUBLIC_API_URL="http://192.168.1.2:8000"
npx expo start --clear --lan
```

## 3. Run for Emulator (Pixel 7)
```powershell
taskkill /F /IM node.exe
$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:8000"
npx expo start --clear --lan
```
