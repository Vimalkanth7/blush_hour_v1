# DISCOVERY_SPEC — Blush Hour v0

## 1. Goal
Implement the core Discovery experience: a high-quality, immersive way to view potential matches one profile at a time. The focus is on **profile viewing** and strictly mimicking the Bumble card style (scrollable details), rather than rapid-fire swiping.

This document is the **FROZEN SOURCE OF TRUTH**.

---

## 2. Discovery UI Structure
- **Container**: Full-screen view (minus Tab Bar).
- **Interactive Model**: Stack of cards (One active at a time).
- **Scrolling**: Vertical scrolling *within* the card to reveal profile details (unlike Tinder which is just a single image stack usually).
- **Actions**: Floating Action Buttons (FABs) at the bottom (or overlaid).

### Visual Style (Bumble-inspired)
- **Background**: White or light neutral.
- **Card**: Rounded corners, elevation.
- **Typography**: Consistent with `PROFILE_SPEC`.

---

## 3. Data Requirements
**Source**: `GET /api/users` (Simulated feed for now, or real endpoint).
**Fields Needed from User Model**:
- **Identity**: `first_name`, `birth_date` (Age computation), `gender`.
- **Media**: `photos` (List[str]).
- **Core**: `work`, `education`, `location`, `hometown`.
- **Details**: `bio`, `height`, `habits` (drinking/smoking/exercise), `dating_preference`, `kids_have/want`, `star_sign`, `politics`, `religion`.
- **Tags**: `interests`, `values`, `causes`.
- **personality**: `prompts`.

---

## 4. Card Layout (The "Profile View")
The card should reuse the visual logic from `08_PROFILE_PREVIEW_SPEC.md` but adapted for a Discover feed.

### A. Main Header (Sticky/Top)
- **Image**: Photo #1 (Full width/height coverage of top area).
- **Overlay Details**: 
    -   Name, Age.
    -   Job / School (Icon + Text).
    -   Location (Icon + Text).
    -   *Consistent with Bumble: This info sits on top of the first photo at the bottom, OR immediately below it.*

### B. Scrollable Content (Below Fold)
1.  **Bio Section**: Text card.
2.  **About You (Basics)**: Icon rows (Height, Exercise, Education, etc.).
3.  **Photos**: Interspersed photos (Photo #2, #3, etc.) between content sections or a secondary grid. *Decision: Bumble scrolls photo -> content -> photo. For v0, we can stack remaining photos after Bio.*
4.  **Interests/Values/Causes**: Chip clouds.
5.  **Prompts**: Q&A Cards.
6.  **Location**: Map pin / City name detailed.

---

## 5. Actions (Local Only for v0)
**Visible Controls**:
1.  **Pass (X)**: Bottom Left. Circle button, Gray/Red accent.
2.  **Like (Heart)**: Bottom Right. Circle button, Yellow/Gold accent.

**Interaction**:
-   **Tap X**: Animate card off-screen (Left). Load next user. Log `PASS: <user_id>`.
-   **Tap Heart**: Animate card off-screen (Right). Load next user. Log `LIKE: <user_id>`.
-   **No Match Logic** yet (Frontend only).

---

## 6. Empty States
**Scenario**: No more users in the feed.
**UI**:
-   Centered Icon (e.g., Radar/Sparkles).
-   Text: "That's everyone for now."
-   Subtext: "Check back later or adjust your filters."
-   Button: "Refresh" (Re-fetches list).

---

## 7. Navigation Rules
-   **Tab**: Discovery is the default `(tabs)/index` or `(tabs)/home`.
-   **Drill-down**: Tapping a photo might go full screen (optional for v0).
-   **Filter**: Entry point via Header Right icon -> Modal (Existing `modal/filter`).

---

## 8. Acceptance Criteria
- [ ] Displays one profile at a time.
- [ ] User can scroll vertically to see Bio, Prompts, and details.
- [ ] Real data from backend is rendered (Name, Age, Photos).
- [ ] "Like" button logs action and removes card.
- [ ] "Pass" button logs action and removes card.
- [ ] Empty state appears when list is exhausted.
- [ ] Layout matches `PROFILE_PREVIEW_SPEC` aesthetics (clean, modern).
