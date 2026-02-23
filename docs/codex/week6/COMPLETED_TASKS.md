# Week 6 — Completed Tasks

# Week 6 — Completed Tasks

## 🟢 W6-A2 — Talk Room authoritative timer sync + focus refresh
Status: DONE  
Owner: Frontend Agent  
Branch: fix/frontend-w6a-authoritative-timer  
Tag: v1-w6a2-authoritative-timer

Notes:
- Talk Room timer now derives from backend `seconds_remaining` (authoritative) with client-side estimation between polls.
- Added focus/visibility/app-active triggers to force immediate resync.
- Reduced drift and improved snap-back after tab backgrounding.

