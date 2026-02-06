# CHAT_NIGHT_HOUR_SPEC — Blush Hour v0

## 1. Goal
Implement "Chat Night Hour", a time-limited, audio-first blind dating experience.
-   **Core Mechanic**: Users join a pool during specific hours to get matched for 5-minute blind audio calls.
-   **Objective**: "Engage" with the partner to unlock their profile and continue chatting later.
-   **Constraint**: Available only 8:00 PM – 10:00 PM IST.

This document is the **FROZEN SOURCE OF TRUTH**.

---

## 2. Rules & Logic

### Availability
-   **Window**: Daily, 20:00 to 22:00 IST (Indian Standard Time).
-   **Source of Truth**: Backend Server Time.
-   **Outside Window**: Feature is visible but "Closed" (countdown or static message).

### Economy (Passes)
-   **Allocation**: Reset daily at 00:00 IST (or 19:59 IST).
    -   **Men**: 1 Pass / Night.
    -   **Women**: 2 Passes / Night.
-   **Consumption**: 1 Pass consumed upon successfully entering a Talk Room.

### Matching
-   **Logic**: Random assignment.
-   **Criteria**: 1 Male + 1 Female (based on `gender` field).
-   **Queue**: FIFO (First-In-First-Out) subject to gender balance.

### SESSION: The Talk Room
-   **Duration**: Exactly 5 minutes (300 seconds).
-   **Media**: Audio Only. No video. No text. No names displayed (Blind).
-   **Controls**: Mute Mic, Toggle Speaker, Leave.
-   **Action**: "Engage" button (Bottom Right).
-   **Outcome**:
    -   If **BOTH** tap "Engage" before timer zero:
        -   Room marked "Success".
        -   Match Created.
        -   Users notified "It's a Match!".
    -   If **TIMER ENDS** (and not both engaged):
        -   Room closes.
        -   Users returned to pool/home.
        -   No match created. Identity remains hidden.

---

## 3. Screen Flow

1.  **Tab Entry**: New Tab "Chat Night" (Between Profile & Matches).
2.  **Lobby Screen**:
    -   *If Closed*: "Chat Night opens at 8 PM IST".
    -   *If Open & No Passes*: "You're out of passes for tonight. Come back tomorrow!"
    -   *If Open & Has Passes*: "Enter Pool" button. Display passes remaining.
3.  **Queue Screen**:
    -   "Looking for a partner..." (Pulsing animation).
    -   "Cancel" button.
4.  **Talk Room Screen** (Active Call):
    -   Black/Dark background.
    -   Center visualizer (audio waves).
    -   Timer (Counting down from 05:00).
    -   "Engage" Button (Visual feedback if tapped, but don't show partner's status until match).
    -   Mic/Speaker/Hangup controls.
5.  **Result Screen**:
    -   *Success*: "You Engaged! Check your Matches."
    -   *Timeout/Fail*: "Time's up. Better luck next time." -> (Back to Lobby).

---

## 4. Data Model Requirements

### User Model Extensions
-   `chat_night_passes`: integer (Default 0).
-   `last_pass_reset`: datetime (IST).

### ChatSession (New Collection)
-   `_id`: UUID.
-   `user_a_id`: UUID.
-   `user_b_id`: UUID.
-   `status`: enum [`pending`, `active`, `engaged`, `expired`, `terminated`].
-   `started_at`: datetime.
-   `engaged_a`: boolean (default false).
-   `engaged_b`: boolean (default false).

### Match (Existing)
-   Source/Origin field: `chat_night` (to distinguish from swipe matches).

---

## 5. Backend & Connectivity

### API Endpoints
-   `GET /api/chat-night/status`: Returns `{ open: bool, next_window: str, passes: int }`.
-   `POST /api/chat-night/queue`: Join the matching pool. WebSocket upgrade URL returned or handled directly.
-   `POST /api/chat-night/engage`: Signal intent to match (during active session).

### WebSockets (`/ws/chat-night`)
-   **Events (Server -> Client)**:
    -   `MATCH_FOUND`: Room ID, connect to WebRTC/Agora.
    -   `SESSION_START`: Timer begins.
    -   `SESSION_END`: Timer zero.
    -   `MATCH_SUCCESS`: Both engaged.
    -   `PARTNER_DISCONNECTED`: Immediate end.

### Audio Provider
-   **Tech**: WebRTC (or service like Agora/Twilio - Implementation Detail).
-   **Constraint**: Audio-only track enabled.

---

## 6. Out of Scope (Future)
-   Smart matching (Elo score, interests, etc.).
-   Buying more passes.
-   Moderation/Reporting tools (MVP assumes beta trust).
-   Video/Text features in room.
-   Profile reveal before engagement.

---

## 7. Acceptance Criteria Checklists
- [ ] Tab appears only for authenticated users.
- [ ] Users cannot join outside 8-10 PM IST.
- [ ] Men get 1 pass, Women get 2 passes (refreshed daily).
- [ ] Queue connects 1M to 1F.
- [ ] Audio connects successfully.
- [ ] Unilateral "Engage" does nothing visible to partner.
- [ ] Bilateral "Engage" creates a Match record.
- [ ] Session hard-stops at 5:00 minutes.
