# PROFILE_SPEC — Blush Hour v0 (Bumble Style)

## Goal
Implement a single, definitive Profile system where the Backend is the authority on completion status, and the Frontend provides a rich, sectioned editing experience.

---

## 1. Profile Data Structure
The profile is divided into specific sections. All data is persisted to the `User` model.

### Section 1: Photos (Media)
- **Field**: `photos` (List[str], max 6)
- **UI**: 3x2 Grid.
- **Rules**:
  - Minimum 4 photos required for completion.
  - Drag-and-drop reordering.
  - slots 5 & 6 are optional.
  - "DEV" mode allows filling sample photos.

### Section 2: Bio (Core)
- **Field**: `bio` (String)
- **UI**: Multiline text input.
- **Rules**: Required for completion (min length 1 char).

### Section 3: About You (Basics)
- **Fields**:
  - `work` (String)
  - `education` (String) - *Existing*
  - `gender` (String) - *Existing*
  - `location` (String) - *New*
  - `hometown` (String) - *New*
- **UI**: Row layout, right-aligned values with chevron > (if editable via modal) or inline entry.
- **Note**: Age is computed from `birth_date` (Read-only).

### Section 4: More About You (Details)
- **Fields**:
  - `height` (String)
  - `exercise` (String) - *From habits*
  - `education_level` (String) - *Distinct from 'education' (school name)? Or same? Let's treat 'education' as School/Uni name and 'education_level' as Degree.*
  - `drinking` (String) - *From habits*
  - `smoking` (String) - *From habits*
  - `dating_preference` (String) - *Existing (Looking for)*
  - `kids_have` (String) - *New*
  - `kids_want` (String) - *New*
  - `star_sign` (String) - *New*
  - `politics` (String)
  - `religion` (String)

### Section 5: Interests & Values
- **Fields**:
  - `interests` (List[str]) - "My Interests"
  - `values` (List[str]) - "Values & Traits"
  - `causes` (List[str]) - "Causes I care about"
- **Rules**: At least 1 selected in each category (or overall 1 for completion).

### Section 6: Prompts
- **Field**: `prompts` (List[{question, answer}])
- **UI**: Card list. User picks a question prompt and types an answer.
- **Rules**: Minimum 1 prompt required.

---

## 2. Profile Hub (Tab)
The main "Me" screen.
- **Header**: "Profile" title, Settings Icon (Sign Out within Settings).
- **Hero**:
  - Primary Avatar (Photo[0]).
  - Name + Computed Age.
  - **Completion Ring**: Visual circle around avatar showing `profile_completion` %.
- **Actions**:
  - [Edit Profile] -> Opens Edit Modal.
  - [Preview] -> Opens Preview Modal (Read-only card view).

---

## 3. Data Rules & Completion Logic
**Authority**: The Backend computes these values. The frontend DOES NOT calculate percentages locally.

### Onboarding vs Profile Completion
1.  **`onboarding_completed` (Boolean)**:
    -   **Purpose**: Gates access to the App (Tabs).
    -   **True when**: 
        -   `first_name`, `birth_date`, `gender` are set.
        -   `photos` count >= 4.
2.  **`profile_completion` (Integer 0-100)**:
    -   **Purpose**: Gamification / Badge.
    -   **Calculation (Server-side)**:
        -   Base (Onboarding fields): 50%
        -   Bio present: +10%
        -   Prompts >= 1: +10%
        -   Interests/Values/Causes (any): +10%
        -   Basics (Work/Home/Location): +10%
        -   Details (Height/Habits/Etc): +10%
    -   **Max**: 100%.

### Required Fields for 100%
- Bio
- Photos >= 4
- At least 1 Prompt
- At least 1 Interest
- Filled out Basics & Details

---

## 4. API impact
- **GET /me**: Returns `profile_completion` (int) + all new fields.
- **PATCH /me**: Accepts new fields (`work`, `hometown`, `location`, `education_level`, `star_sign`, `kids_have`, `kids_want`).

