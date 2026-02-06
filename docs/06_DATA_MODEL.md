# DATA_MODEL — User & onboarding

## User fields (conceptual)
- phone_number (unique)
- first_name
- birth_date
- gender
- show_gender
- dating_mode
- dating_preference
- intentions
- height
- education
- habits: { exercise, drinking, smoking, kids }
- interests: string[]
- values: string[]
- causes: string[]
- religion
- politics
- prompts: {question, answer}[]
- photos: string[]
- bio: string
- onboarding_completed: boolean
- created_at

## Onboarding completion rules (source of truth)
Default required fields:
- first_name present
- birth_date present
- gender present
- photos count >= 4

Optional future required fields (for matching quality):
- dating_mode
- dating_preference
- intentions
- interests

DEV bypass:
- If DEV_BYPASS_PHOTOS=true, photo requirement may be bypassed for testing.

## Mapping convention
- Frontend uses camelCase in payload
- Backend stores snake_case fields
- GET /me returns snake_case (unless frontend maps)

## Security rule
- password_hash must never be returned by API responses
