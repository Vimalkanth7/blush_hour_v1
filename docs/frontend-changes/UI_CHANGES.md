# Blush Hour — Frontend UI Changes Log

## Overview
This folder tracks all UI-only changes made during the Dark Romantic UI overhaul.
These changes are purely visual — zero functionality, logic, or API behavior is affected.

---

## Packet UI-01 — Theme System Update
**Status:** In Progress
**File:** `mobile-app/constants/Theme.ts`
**Branch:** `fix/frontend-ui-theme-dark-romantic`

### What Changed
- Background: #FFFFFF → #0D0A14 (deep noir)
- Surface: #F8FAFC → #1A1425
- Primary accent: #FFBF00 → #FF6B9D (rose pink)
- Primary text: #0F172A → #F5F0FF
- Secondary text: #64748B → #A89BC2
- Border/disabled colors updated to dark palette
- Shadow colors updated to rose glow
- Added GRADIENTS export (new, additive only)

### What Was NOT Changed
- All export names
- All key names
- TYPOGRAPHY (fonts, sizes, weights)
- SPACING values
- RADIUS values
- Colors compatibility block structure

### Verification
- `npm run web` — PASS expected, no crash

Verification:
```powershell
cd mobile-app
npm run web
# Confirm: app loads, no import errors, no crash
```

## Packet UI-02 — Bottom Navigation Bar
**Status:** Done
**File:** `mobile-app/app/(tabs)/_layout.tsx`

### What Changed
- Tab bar background -> #0D0A14
- Top border -> #2D2440
- Active tint -> #FF6B9D
- Inactive tint -> #5C5175
- Active indicator pill added

### What Was NOT Changed
- Route names, hrefs, tab order
- Icon components or icon names
- Any navigation logic
