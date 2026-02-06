# FEATURE_CHECKLIST — One-page gate for any new feature

## 0) Scope
- Feature name:
- Owner agent:
- Files expected to change:
- Out of scope:

## 1) Product behavior
- User story:
- Expected UI result:
- 3 edge cases:

## 2) Data contract (if needed)
- Endpoints:
- Request payload keys:
- Response payload keys:
- Validation rules:
- Errors to handle (401/403/404/422/500):

## 3) Auth & navigation safety (mandatory)
- Requires login? YES/NO
- If logged out: redirect to where?
- If token invalid: logout behavior?
- Must use `router.replace` for auth transitions? YES
- Any way to land on protected screen while logged out? MUST be NO

## 4) UI states
- Loading:
- Empty:
- Error:
- Success:

## 5) Testing
- Manual steps:
- API verification (curl/PowerShell):
- Regression list:

## 6) Definition of Done
- QA PASS report link/file:
- RUNBOOK updated? YES/NO
- Lead approved? YES/NO
