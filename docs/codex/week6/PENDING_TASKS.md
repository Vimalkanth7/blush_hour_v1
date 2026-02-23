# Week 6 — Pending Tasks

## 🟡 W6-A — Realtime stabilization (highest priority)
Status: IN PROGRESS  
Owner: Lead + Backend Agent + Frontend Agent

Subtasks:
- ✅ W6-A2: Talk Room authoritative timer sync + focus refresh (DONE, tag v1-w6a2-authoritative-timer)
- 🟡 W6-A3: Engage → room state transition reliability (API + UI + polling/realtime)
- 🟡 W6-A4: Resolve networkError frontend exception + recovery UX
- 🟡 W6-A5: Decide realtime approach (polling vs websockets) + make 2-user sync reliable
- 🟡 W6-A6: Add deterministic QA script / checklist for “2 browsers, 1 room” sanity

## 🟡 W6-B — AI-assisted matching quality (safe, controlled)
Status: TODO  
Owner: AI Agent + QA Agent  
Depends on: W6-A

Goal:
- Add AI “match reasons” / icebreakers (non-sensitive, safety rules enforced)
- Add rate limits + frequency controls (no spam)
- Add QA checks for safety + PII exclusion
