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
- backend\verify_profile_completion.ps1
- backend\verify_profile_strength_contract.ps1
- backend\verify_languages_habits_contract.ps1
- backend\verify_chat_night_v5_only.ps1
- backend\verify_chat_night_fifo_only.ps1
- backend\verify_chat_night_icebreakers_contract.ps1
- backend\verify_chat_night_icebreakers_reveal_sync.ps1
- backend\verify_talk_room_engage_sync.ps1
- backend\verify_safety_admin_contract.ps1 (run in enabled mode and with `BH_SAFETY_TOOLS_ENABLED=false`)
- manual run browser check.txt  (Talk Room “2 browsers, 1 room” — PASS required)
