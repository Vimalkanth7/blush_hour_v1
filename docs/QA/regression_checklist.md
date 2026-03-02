# QA — Minimal Regression Checklist

Must confirm after any change:
- App opens
- Auth gate works (logged out -> welcome)
- Login works
- Onboarding screens load
- Photos step works (or DEV sample photos)
- Profile loads
- Sign out works
- Backend /health is 200
- /docs loads

Regression guards (PASS required to merge):
- `backend\\verify_profile_completion.ps1`
- `backend\\verify_profile_strength_contract.ps1`
- `backend\\verify_languages_habits_contract.ps1`
- `backend\\verify_chat_night_v5_only.ps1` (or `backend\\verify_chat_night_v5_contract.ps1` if you run the combined version)
- `backend\\verify_chat_night_fifo_only.ps1`
- `backend\\verify_chat_night_icebreakers_contract.ps1` (W6-B1: icebreakers contract — PASS required)
- `manual run browser check.txt` (W6-A5: Talk Room “2 browsers, 1 room” checklist — PASS required)