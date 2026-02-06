# QA — Auth Flow Tests

## Scenario 1: Fresh install
Steps:
1) Wipe Expo Go: `adb shell pm clear host.exp.exponent`
2) Open app
Expected:
- Welcome/Login screen shown

## Scenario 2: Register -> Login
Steps:
1) Create account
2) Confirm redirect to login
Expected:
- Login screen appears

## Scenario 3: Login -> Onboarding/Tabs
Steps:
1) Login with valid credentials
Expected:
- If onboarding_completed=false -> onboarding
- If true -> tabs

## Scenario 4: Restart app
Steps:
1) Close app
2) Reopen
Expected:
- Routes correctly based on token

## Scenario 5: Sign Out
Steps:
1) Profile -> Sign Out
Expected:
- Redirect to Welcome
- Restart stays logged out

## Scenario 6: Invalid token
Steps:
1) Invalidate SECRET_KEY and restart backend
2) Open app
Expected:
- 401 triggers logout -> Welcome
