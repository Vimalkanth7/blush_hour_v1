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
- Left: "Cancel" (Close modal, discard changes).
- Center: "Edit Profile".
- Right: "Done" (Save & Close). Shows loading spinner during save.

### Section 1: Photos
- **Type**: Grid (3 columns x 2 rows).
- **Behavior**:
    -   Slots 1-6.
    -   Drag & drop reordering (if supported) OR Tap to Add / X to Remove.
    -   **Validation**: Minimum 4 photos required to save? (Backend enforces `onboarding_completed` logic, but frontend should encourage it. For MVP Edit, we allow saving partials unless it blocks the user). *Decision: Allow saving any state, Backend updates completion score.*

### Section 2: Bio
- **Type**: Multiline Text Input.
- **Label**: "Bio".
- **Placeholder**: "Write a fun and punchy intro."
- **Limits**: Max 500 chars.

### Section 3: About You (Basics)
- **Format**: Row List (Label | Value >).
- **Fields**:
    1.  **Work**: `work` (String).
    2.  **Education**: `education` (String, e.g. "Harvard").
    3.  **Gender**: `gender` (Read-only text, from onboarding).
    4.  **Location**: `location` (String, City/Town).
    5.  **Hometown**: `hometown` (String).

### Section 4: More About You (Details)
- **Format**: Row List (Label | Value >).
- **Fields**:
    1.  **Height**: `height` (String, e.g. "5'10").
    2.  **Exercise**: `habits.exercise` (String).
    3.  **Education Level**: `education_level` (String, e.g. "Bachelors").
    4.  **Drinking**: `habits.drinking` (String).
    5.  **Smoking**: `habits.smoking` (String).
    6.  **Looking for**: `dating_preference` (String).
    7.  **Kids Have**: `kids_have` (String).
    8.  **Kids Want**: `kids_want` (String).
    9.  **Star Sign**: `star_sign` (String).
    10. **Politics**: `politics` (String).
    11. **Religion**: `religion` (String).

### Section 5: Interests & Values
- **Format**: Tag/Chip Inputs (Comma-separated for MVP v0).
- **Categories**:
    1.  **Interests**: `interests` (List[str]).
    2.  **Values**: `values` (List[str]).
    3.  **Causes**: `causes` (List[str]).

### Section 6: Prompts
- **Format**: Question Selector + Answer Input.
- **Data**: `prompts` (List[{question, answer}]).
- **Behavior**:
    -   Show 1 prompt slot minimum.
    -   User can edit Question string (or pick from list) and Answer string.

---

## 3. Save Logic
**Payload**:
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
  "prompts": [{"question": "q", "answer": "a"}],
  "photos": ["url1", "url2", ...]
}
```

**Actions**:
1.  Construct payload from local state.
2.  `PATCH /api/users/me`.
3.  On 200 OK:
    -   `await refreshProfile()`.
    -   `router.back()`.
4.  On Error:
    -   Alert user.
    -   Do not close modal.

## 4. Acceptance Checklist
- [ ] Modal opens/closes correctly.
- [ ] Form populates with existing data.
- [ ] All fields (Sections 1-6) are editable.
- [ ] Save updates the backend (Verified via Preview).
- [ ] Keyboard handling works (KeyboardAvoidingView).
