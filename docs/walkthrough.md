# Core Screens Theme Rollout

This walkthrough details the systematic application of V1 Design System tokens to the core screens of the Blush Hour application.

## Overview
We have replaced hardcoded styles (colors, spacing, typography, radii) with centralized tokens from `Theme.ts` across the main tabs, chat interfaces, and modal screens.

## Screens Updated

### 1. Main Tabs
- **`discovery.tsx`**: Updated main feed cards, control buttons, and empty states. Used `COLORS.primary` (Gold) for branding and `COLORS.surface` for cards.
- **`matches.tsx`**: Themed the match queue and conversation list. Headers now use `TYPOGRAPHY.h2`.
- **`chat-night.tsx`**: Applied tokens to the "Chat Night" splash screen. Ensured "Passes" badge uses pill radius and primary colors.
- **`profile.tsx`**: Themed the profile hub, including the avatar ring, action buttons, and upsell cards.
- **`_layout.tsx`**: Updated the bottom tab bar to use `COLORS.surface` and standard shadows.

### 2. Chat Experience
- **`chat/[id].tsx`**: Customized `GiftedChat` bubbles.
  - **Left (Them)**: `COLORS.surface` background, `COLORS.primaryText`.
  - **Right (Me)**: `COLORS.primary` background, `COLORS.brandBase` text.
- **`chat/talk-room.tsx`**: Maintained the dark aesthetic logic but mapped it to `COLORS.dark` tokens where appropriate. Used `COLORS.destructive` for unlocked match status.

### 3. Modals
- **`modal/edit-profile.tsx`**: Themed the form inputs, photo grid placeholders, and strength meter.
- **`modal/preview-profile.tsx`**: Updated the profile preview detail view, including chips for interests/values and ensuring 3-column photo grid calculation respects `SPACING`.
- **`modal/filter.tsx`**: Themed sliders and toggles with `COLORS.primary`.

## Verification Steps
1. **Visual Check**: Navigate through all tabs to ensure consistent background colors (`COLORS.background` vs `COLORS.surface`).
2. **Dark Mode**: Verify `Chat Night` maintains its specific dark look.
3. **Interactions**: Tapping buttons (filter, settings, edit profile) should show appropriate opacity/highlight states.
4. **Chat**: Send a test message to verify bubble colors are readable.

## Next Steps
- Validate Typography scaling on smaller devices.
- Consider creating a `ThemeContext` if dynamic dark mode switching is required globally (currently hybrid).

## Theme Compliance Cleanup
Performed a final sweep of core files to ensure 0% hardcoded hex values.
- **Targeted Files**: `profile.tsx`, `talk-room.tsx`, `edit-profile.tsx`, `preview-profile.tsx`, `filter.tsx`.
- **Actions**:
  - Replaced all hex codes (e.g., `#FFBF00`, `#ccc`) with `COLORS` tokens.
  - Replaced manual shadows with `SHADOWS` mixins.
  - Standardized font weights and sizes using `TYPOGRAPHY`.
  - Replaced fixed pixel padding with `SPACING` constants.
- **Outcome**: Confirmed 100% compliance via grep verification. Use of `COLORS.dark` for Chat Night preserved the dark aesthetic while adhering to the system.
