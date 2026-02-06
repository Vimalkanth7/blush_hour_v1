# PROFILE_PREVIEW_SPEC — Blush Hour v0 (Bumble Style)

## Goal
Implement a read-only Profile Preview modal that strictly mimics the visual layout of a Bumble profile, using real data from the backend.

## 1. UI Structure & Data Binding

**Source of Truth**: `useAuth().user` (from `GET /api/users/me`).

### Header
- **Left**: Back/Down arrow icon (Tap to close).
- **Title**: "Preview" (or "Blush Hour Date" to match Bumble style, but user requested "Preview").
- **Right**: Empty or Menu (optional).

### Section 1: Profile Strength
- **UI**: Simple card/banner.
- **Data**: `user.profile_completion` (int).
- **Display**: "{N}% complete".
- **Action**: None (Read-only).

### Section 2: Photos (Media)
- **UI**: 3x2 Grid (6 slots).
- **Data**: `user.photos` (List[str]).
- **Logic**:
  - Render existing photos in order.
  - Missing slots rendered as empty placeholders (gray background + index number or "X" icon style from screenshots).
  - "Main" label on first photo.

### Section 3: Bio
- **UI**: Card with multiline text.
- **Data**: `user.bio`.
- **Title**: "Bio".
- **Empty State**: Show "Bio" title + "Add" placeholder text (or "Write a fun and punchy intro").

### Section 4: About You (Basics)
- **UI**: List of rows. Each row: Icon + Label + Value.
- **Rows**:
  1.  **Age**: Computed from `birth_date`. Icon: Cake/Calendar.
  2.  **Work**: `user.work`. Icon: Briefcase.
  3.  **Education**: `user.education`. Icon: Mortarboard.
  4.  **Gender**: `user.gender`. Icon: Person.
  5.  **Location**: `user.location`. Icon: Map Pin.
  6.  **Hometown**: `user.hometown`. Icon: House.
- **Empty State**: If value is null/empty, display "Add" (Grayed out text).

### Section 5: More About You (Details)
- **UI**: List of rows.
- **Rows**:
  1.  **Height**: `user.height`. Icon: Ruler.
  2.  **Exercise**: `user.habits.exercise` (or flat `exercise`). Icon: Dumbbell.
  3.  **Education Level**: `user.education_level`. Icon: Book.
  4.  **Drinking**: `user.habits.drinking` (or flat `drinking`). Icon: Wine.
  5.  **Smoking**: `user.habits.smoking` (or flat `smoking`). Icon: Cigarette.
  6.  **Looking For**: `user.dating_preference`. Icon: Magnifier/Heart.
  7.  **Kids**: `user.kids_want` / `user.kids_have`. Icon: Stroller.
  8.  **Star Sign**: `user.star_sign`. Icon: Stars.
  9.  **Politics**: `user.politics`. Icon: Building/Flag.
  10. **Religion**: `user.religion`. Icon: Peace.
- **Empty State**: Display "Add" if missing.

### Section 6: Interests & Values
- **UI**: Chip/Tag Cloud.
- **Categories**:
  1.  **Interests**: `user.interests` (List). Green/Yellow chips.
  2.  **Values**: `user.values` (List).
  3.  **Causes**: `user.causes` (List).

### Section 7: Prompts
- **UI**: Cards with "Question" (small/bold) and "Answer" (large/regular).
- **Data**: `user.prompts` (List[{question, answer}]).

---

## 2. Technical Implementation

### File
- `mobile-app/app/modal/preview-profile.tsx`

### Navigation
- **Entry**: From `profile.tsx` -> `router.push('/modal/preview-profile')`.
- **Exit**: `router.back()`.
- **Type**: Modal (Stack presentation).

### Styles
- **Tokens**: Match Bumble-ish aesthetic (White background, black text, yellow accents for active elements/chips).
- **Icons**: Use `Ionicons` (or `MaterialCommunityIcons` if needed for specific glyphs like "Stroller" or "Zodiac").

### Mocking/Safety
- Ensure no crash if `user` object is null (though AuthContext guarantees user if logged in).
- Handle `user.habits` being undefined safely.

---

## 3. Acceptance Criteria
1.  **Visual**: Matches the sections above.
2.  **Data**: Shows real data from `useAuth()`.
3.  **Nulls**: Shows "Add" or placeholders for missing data, does NOT hide the row (unless specified).
4.  **Navigation**: Opens/Closes without lag or layout glitches.
