Packet 3 — Chat Night Screen
Task ID: UI-03
Scope: Frontend-only
Files to find: Search for:

mobile-app/app/(tabs)/chat-night.tsx
or any file rendering "Chat Night is Closed" / "Next session starts at"

Agent: first report the exact file path before making changes.
Goal: Transform the empty white Chat Night screen into a dramatic dark night scene with glowing moon, animated star feeling, and rich typography. Zero logic, timer, or API changes.
Acceptance Criteria:

"Chat Night is Closed" / "Next session starts at" text content unchanged
All conditional logic (open/closed state) unchanged
Pass count display unchanged
All API calls and state variables unchanged
Only background, colors, card styles, icon styles changed
npm run web PASS

Exact Visual Changes:
Screen background:        COLORS.background (#0D0A14)
Main container:           add radial glow effect behind moon icon
                          color: rgba(255,107,157,0.08), large circle ~300px

Moon icon:                color → #FF6B9D (rose pink)
                          size → increase to 72 (from current ~40-48)
                          add soft glow shadow around it

"Chat Night is Closed"    color → COLORS.primaryText (#F5F0FF)
heading:                  fontWeight keep bold

"Next session starts at"  color → COLORS.primary (#FF6B9D)
subtext:                  fontWeight → 600

Description text:         color → COLORS.secondaryText (#A89BC2)

"1 Pass Left" badge       background → rgba(255,107,157,0.15)
(top right):              border → 1px solid #FF6B9D
                          text color → #FF6B9D
                          borderRadius → RADIUS.pill

Bottom card / info box    background → COLORS.surface (#1A1425)
(if exists):              border → COLORS.border (#2D2440)
                          borderRadius → RADIUS.lg (24)
Implementation rules:

Import COLORS, RADIUS from ../../constants/Theme (adjust path if needed)
Do NOT touch any useState, useEffect, fetch, or timer logic
Do NOT touch any conditional rendering logic (if isOpen, if closed etc.)
Do NOT touch the "Join" button logic if present — only its visual style
Do NOT touch any socket or polling code
If background glow is not possible with plain View, use a large View with borderRadius: 999 and low opacity as a decorative layer behind content

Verification:
powershellcd mobile-app
$env:RCT_METRO_PORT='60123'; $env:CI='1'; npm run web
# Confirm: screen loads, closed state shows correctly
# Confirm: pass count still visible top right
# Confirm: no JS errors related to this screen
Update docs/frontend-changes/UI_CHANGES.md — append:
markdown## Packet UI-03 — Chat Night Screen
**Status:** Done
**File:** (actual path found)

### What Changed
- Background → #0D0A14
- Moon icon → rose pink #FF6B9D, size increased, glow added
- Heading color → #F5F0FF
- Subtext color → #FF6B9D
- Description → #A89BC2
- Pass badge → rose tinted with border
- Surface cards → #1A1425 with dark border

### What Was NOT Changed
- Open/closed state logic
- Timer or countdown logic
- API calls or polling
- Pass count data source
- Any useEffect or useState
Output required from Codex:

Exact file path found and changed
Visual properties changed (list)
Any logic lines it was tempted to touch but didn't (important)
npm run web — PASS/FAIL
Risks or follow-ups

