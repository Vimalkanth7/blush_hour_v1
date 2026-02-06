# Chat Night Runbook

## Overview
Chat Night is a time-limited feature (8 PM - 10 PM) where users are matched into live voice chat rooms.

## Infrastructure
- **Backend**: FastAPI (`app/routers/chat_night.py`)
- **Database**: MongoDB (Beanie models: `ChatNightRoom`, `ChatNightPass`)
- **Frontend**: React Native (`app/(tabs)/chat-night.tsx`, `app/talk-room.tsx`)

## Emulator Networking (CRITICAL)
For dual-emulator testing to work (User A and User B syncing), both emulators must be able to hit the SAME backend instance.

### Android Emulator
- **Base URL**: `http://10.0.2.2:8000`
- **Why**: Android emulators run in a VM. `localhost` refers to the emulator itself, NOT the host machine. `10.0.2.2` bridges to the host's `localhost`.
- **Configuration**:
    - The app checks `Platform.OS`.
    - If Android, it defaults to `10.0.2.2`.
    - Override with env var: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000`.

### iOS Simulator
- **Base URL**: `http://localhost:8000`
- **Why**: iOS simulators share the host network stack.

### Troubleshooting
- **Timers stuck / Drift**: Means one device is not hitting backend correctly. Check the debug header in Chat Night: `API: 10.0.2.2:8000`.
- **"Network Error"**: Ensure backend is running (`uvicorn app.main:app`).
- **Passes**: Run backend with `CHAT_NIGHT_TEST_MODE=true` to force open window and bypass strict time checks.

## Verification Checklist
1. Open Backend: `CHAT_NIGHT_TEST_MODE=true uvicorn app.main:app --reload`
2. Open Emulator 1 (Android): Login User A.
3. Open Emulator 2 (Android): Login User B.
4. User A enters pool (Status: "Finding a Match...").
5. User B enters pool (Status: Navigate to Talk Room).
6. User A should auto-navigate to Talk Room within 3s.
7. Both screens should show ~5:00 timer counting down together.
8. Both press Engage -> Both see "Unlocked" -> Navigate to Matches.

## Safe Testing Mode
When running the `verify_chat_night.ps1` script:
1. **Purpose**: Quick backend validation without manual clicks.
2. **Isolation**: The script creates unique temporary users (`+998...`, `+999...`) to avoid conflicting with your "permanent" emulator users (`901`, `902`).
3. **Cleanup**: The script now attempts to auto-remove these test users from the queue/room at the end.
4. **Warning**: Do NOT run this script at the *exact same moment* you are trying to match manually in the emulator, as queue logic is global (FIFO). Wait for one test to finish before starting the other.

