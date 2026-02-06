# Task: Apply V1 Design System to Core Screens

## Objective
Replace hardcoded styles with `Theme.ts` tokens (COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS) across all core app screens while preserving existing logic and network hygiene.

## Checklist

### Tabs
- [x] `mobile-app/app/(tabs)/discovery.tsx`
- [x] `mobile-app/app/(tabs)/matches.tsx`
- [x] `mobile-app/app/(tabs)/chat-night.tsx`
- [x] `mobile-app/app/(tabs)/profile.tsx`
- [x] `mobile-app/app/(tabs)/_layout.tsx`

### Chat
- [x] `mobile-app/app/chat/[id].tsx` (GiftedChat theming)
- [x] `mobile-app/app/chat/talk-room.tsx`

### Modals
- [x] `mobile-app/app/modal/edit-profile.tsx`
- [x] `mobile-app/app/modal/preview-profile.tsx`
- [x] `mobile-app/app/modal/filter.tsx`

## Design Decisions / Notes
- Preserving `GiftedChat` logic while updating bubble colors.
- Ensuring `Chat Night` timer and polling logic remains untouched.
- Using `COLORS.surface` for cards and `COLORS.background` for screens.
- Typography: `display` for main headers, `h2/h3` for section headers, `bodyLarge` for main text.
