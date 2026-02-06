# Regression Checklist: User Registration & Onboarding Flow

**Status**: Draft
**Priority**: P0 (Critical)
**Components**: Auth, Onboarding Wizard, Discovery

## Pre-requisites
- Application installed on device/emulator (Pixel 7 verified).
- No active session (logged out state).
- Network connection active.

## Test Scenarios

### 1. Landing & Entry
- [ ] **Launch App**: Verify `WelcomeScreen` loads without crashing.
- [ ] **UI Check**: Confirm "Log In" and "Create Account" buttons are visible.
- [ ] **Navigation**: Tap "Create Account". Should navigate to `PhoneLogin`.

### 2. Authentication (Phone)
- [ ] **Input Validation**: Enter invalid phone number. Verify error state/button disabled.
- [ ] **Valid Input**: Enter valid country code + number. Tap "Continue".
- [ ] **OTP Modal**: Verify Mock OTP modal appears.
- [ ] **OTP Entry**: Enter correct OTP (e.g., '123456' if mocked).
- [ ] **Success**: Should navigate to `CreatePassword` screen.

### 2a. Create Password
- [ ] **Validation**: Enter < 8 characters. Verify button disabled or error.
- [ ] **Valid Input**: Enter >= 8 characters. Tap "Arrow Forward".
- [ ] **Success**: Should navigate to Onboarding Step 1 (`Name`).

### 3. Onboarding Wizard (Steps 1-9)
**Note**: Navigation between steps should be smooth with no white screens.

- [ ] **Name (Step 1)**: Enter name -> Continue.
- [ ] **Birthday (Step 2)**:
    - [ ] Select date < 18 years ago. Verify blocking error.
    - [ ] Select date > 18 years ago. Continue to `Gender`.
- [ ] **Gender (Step 3)**:
    - [ ] Select Gender.
    - [ ] Toggle "Show on profile".
    - [ ] Continue to `Mode`.
- [ ] **Mode (Step 4)**: Select "Date" or "BFF". Continue to `Intentions`.
- [ ] **Intentions (Step 5)**: Select a relationship goal. Continue to `Details`.
- [ ] **Details (Step 6)**:
    - [ ] Enter Height, Exercise, Education, Habits.
    - [ ] Continue to `Interests`.
- [ ] **Interests (Step 7)**:
    - [ ] Select < 3 interests. Verify "Continue" disabled (if applicable).
    - [ ] Select 3-5 interests.
    - [ ] Continue to `Values`.
- [ ] **Values (Step 8)**: Select values. Continue to `Prompts`.
- [ ] **Prompts (Step 9)**: Select question + enter text. Continue to `Photos`.

### 4. Photo Upload (Critical)
- [ ] **Initial State**: Empty grid. "Continue" should be disabled.
- [ ] **Add Photos**:
    - [ ] Add 1-3 photos. Verify "Continue" remains disabled.
    - [ ] Add 4+ photos. Verify "Continue" becomes enabled.
- [ ] **Drag & Drop**: (If implemented) Reorder photos. Verify order persists.
- [ ] **Completion**: Tap "Let's Go" (or equivalent).

### 5. Post-Registration
- [ ] **Landing**: Verify user lands on `/(tabs)/index` (Discovery/Feed).
- [ ] **Content**: Verify profile card is visible.
- [ ] **Interaction**:
    - [ ] Swipe Right (Like) -> Card disappears.
    - [ ] Swipe Left (Pass) -> Card disappears.
- [ ] **Navigation**: Tap "Matches" tab. Verify screen loads.

### 6. Security & Validation (Automated / Manual)
- [ ] **Unauthenticated Update**:
    - [ ] Curl/Postman to `PATCH /api/users/me` without token. Verify 401.
    - [ ] Curl/Postman to `PATCH /api/users/update` (Old). Verify 404.
- [ ] **Photo Validation**:
    - [ ] In `PhotosScreen`, ensure "Next" is disabled with < 4 photos.
    - [ ] Ensure attempt to proceed shows alert.


## Known Issues / Watchlist
- [ ] (Add observed bugs here)
- [ ] White screen on transition from Photos to Home? (Previous issue).
