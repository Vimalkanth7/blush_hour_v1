# Implementation Plan: Bumble-Style Profile UI

## 1. Overview
We will transform the existing `profile.tsx` (which is currently just a basic "Edit Profile" screen) into a proper **Bumble-style Profile Hub**.

**Current State**: Basic form with Photo Grid and simple inputs.
**Target State**: A "Me" tab acting as the central hub for the user's presence.

## 2. Design Specs (Bumble Inspired)

### Layout
1.  **Header**: "Profile" title + Settings Gear Icon (Right).
2.  **Hero Section**:
    *   **Avatar**: Large circular profile photo (First photo in array) centered.
    *   **Name & Age**: below avatar.
    *   **Completion Ring**: A visual indicator around the avatar (e.g., "75% Complete").
3.  **Action Buttons (Row)**:
    *   **Edit Profile**: Pencil icon/button.
    *   **Preview**: Eye icon (See how others see you).
4.  **Premium/Upsell Section** (Visual only for now):
    *   "Spotlight" (Get more visibility).
    *   "Premium" (See who likes you).
5.  **Data Binding**:
    *   Connect to `useAuth().user` instead of `MOCK_PROFILE`.
    *   Calculate age from `birth_date`.

## 3. Implementation Steps

### Step 1: Create `ProfileHub.tsx` (New Component)
We will keep `profile.tsx` as the *Tab Entry* but refactor it to render the Hub view initially.
The existing "Edit" form will move to `profile/edit.tsx` (a new sub-route) or be a mode within `profile.tsx`.
*Decision*: Create `app/modal/edit-profile.tsx` for the editing experience (standard pattern) and leave `profile.tsx` as the Hub.

### Step 2: Build the Hub UI in `profile.tsx`
-   **Structure**:
    -   `SafeAreaView`
    -   `ScrollView`
    -   `AvatarView` (Custom component for the ring + image).
    -   `ActionRow` (Edit / Settings).
    -   `MarketingBanner` (Static image/gradient for "Premium").

### Step 3: Edit Profile Modal
-   **File**: `app/modal/edit-profile.tsx`.
-   **Content**: The code currently in `profile.tsx` (PhotoGrid + Inputs) moves here.
-   **Logic**: 
    -   Fetch `user` data on mount.
    -   Submit to `PATCH /api/users/me` on save.

## 4. Verification
-   **User**: Login.
-   **Tap**: "Profile" tab.
-   **See**: My Name, Age, and Photo.
-   **Tap**: "Edit Profile".
-   **See**: The form we verified earlier (Photo Grid + Details).

## 5. Execution Order
1.  Create `app/modal/edit-profile.tsx` (Move code).
2.  Rewrite `app/(tabs)/profile.tsx` (Build Hub).
