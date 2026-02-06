# EDIT_PROFILE_SPEC — Blush Hour v0

## Goal
Implement the interactive "Edit Profile" modal. This file is the **FROZEN SOURCE OF TRUTH** for the UI structure, field mapping, and save logic.

## 1. Data & State
- **Read**: `GET /api/users/me` (via `useAuth().user`).
- **Write**: `PATCH /api/users/me`.
- **State Management**: Local state initialized from `user` object. Save triggers API call + `refreshProfile()`.

---

## 2. UI Structure (Section Order)

### Header
- **Left**: "Cancel" (Close modal, discard changes).
- **Center**: "Edit Profile".
- **Right**: "Done" (Save & Close). Shows loading spinner during save.

### Section 1: Photos
- **Type**: Grid (3 columns x 2 rows).
- **Behavior**:
    -   Slots 1-6.
    -   Tap to Add / X to Remove.
    -   **Validation**: Frontend allows saving partials; Backend calculates completion score.

### Section 2: Bio
- **Type**: Multiline Text Input.
- **Label**: "Bio".
- **Placeholder**: "Write a fun and punchy intro."
- **Limits**: Max 500 chars.

### Section 3: About You (Basics)
- **Format**: Row List (Label | Value >).
- **Fields**:
    1.  **Work**: `work` (String).
    2.  **Education**: `education` (String).
    3.  **Gender**: `gender` (Read-only text, from onboarding).
    4.  **Location**: `location` (String, City/Town).
    5.  **Hometown**: `hometown` (String).

### Section 4: More About You (Details)
- **Format**: Row List (Label | Value >).
- **Fields**:
    1.  **Height**: `height` (String, e.g. "5'10").
    2.  **Exercise**: `habits.exercise` (String).
    3.  **Education Level**: `education_level` (String).
    4.  **Drinking**: `habits.drinking` (String).
    5.  **Smoking**: `habits.smoking` (String).
    6.  **Looking for**: `dating_preference` (String).
    7.  **Kids**: `kids_have` (String) - *Label in UI "Kids"*.
    8.  **Family**: `kids_want` (String) - *Label in UI "Family Plans" or merged if simple*. Spec uses `kids_want`.
    9.  **Star Sign**: `star_sign` (String).
    10. **Politics**: `politics` (String).
    11. **Religion**: `religion` (String).

### Section 5: Interests & Values
- **Format**: Tag/Chip Inputs.
- **Categories**:
    1.  **Interests**: `interests` (List[str]).
    2.  **Values**: `values` (List[str]).
    3.  **Causes**: `causes` (List[str]).

### Section 6: Prompts
- **Format**: Select Question + Edit Answer.
- **Data**: `prompts` (List[{question, answer}]).
- **Behavior**:
    -   User selects a question from a predefined list.
    -   User types answer.

---

## 3. Save Logic
**Payload Structure**:
```json
{
  "bio": "string",
  "work": "string",
  "education": "string",
  "location": "string",
  "hometown": "string",
  "height": "string",
  "education_level": "string",
  "dating_preference": "string",
  "kids_have": "string",
  "kids_want": "string",
  "star_sign": "string",
  "politics": "string",
  "religion": "string",
  "habits": {
    "exercise": "string",
    "drinking": "string",
    "smoking": "string"
  },
  "interests": ["str"],
  "values": ["str"],
  "causes": ["str"],
  "prompts": [{"question": "str", "answer": "str"}],
  "photos": ["url1", "url2", ...]
}
```

**Actions**:
1.  Construct payload from local state.
2.  `PATCH /api/users/me` (handles partial updates).
3.  On Success:
    -   Call `refreshProfile()`.
    -   Close Modal.
4.  On Error:
    -   Show Alert.
    -   Stay in Modal.

## 4. Acceptance Checklist
- [ ] Modal opens/closes correctly.
- [ ] Data pre-fills from backend.
- [ ] Fields are editable.
- [ ] Save persists data (verified via Preview/Hub).
- [ ] UI matches Bumble style (Clean rows, Icons).
