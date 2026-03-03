# Week 6 — Realtime + Talk Room Stabilization

## 🟢 W6-A — Realtime stabilization (highest priority)
Status: DONE  
Owner: Backend Agent + Frontend Agent  
Depends on: Week 5 complete

Goal:
- Make Talk Room / Chat Night timing + engage-state reliable across 2 devices/browsers.
- Remove client clock drift issues and flaky UI state transitions.

✅ Completed:
- W6-A2 — Authoritative Talk Room timer (server-based) — Tag: v1-w6a2-authoritative-timer
- W6-A1.1 — Engage sync + stale-room expiry normalization (backend) — Tag: v1-w6a1_1-engage-sync
- W6-A1.2 — Engage UI sync (frontend) — Tag: v1-w6a1_2-engage-ui-sync
- W6-A3 — Network recovery + bounded backoff (frontend) — Tag: v1-w6a3-network-recovery
- W6-A4 — Polling-only realtime decision + hardening — Tag: v1-w6a4-polling-only-decision
- W6-A5 — Checklist-only regression gate (“2 browsers, 1 room”) — Tag: v1-w6a5-checklist-gate

---

## 🟢 W6-B — AI-assisted matching quality (safe, controlled)
Status: DONE  
Owner: Backend Agent + QA Agent + Frontend Agent (as needed)  
Depends on: W6-A

Goal:
- Add AI-generated match reasons / icebreakers (non-sensitive, safe).
- Add frequency controls and safety validation.
- Add shared reveal sync so both clients see the same revealed card(s).

✅ Completed:
- W6-B1 — Icebreakers contract + deterministic fallback (backend) — Tag: v1-w6b1-icebreakers-contract
- W6-B2 — Cache + OpenAI provider integration (backend) — Tag: v1-w6b2-icebreakers-cache-openai
- W6-B3 — Guardrails (budget + throttle controls) (backend) — Tag: v1-w6b3-icebreakers-guardrails
- W6-B4 — Icebreakers UI + shared reveal sync (frontend+backend) — Tags:
  - backend: v1-w6b4-reveal-sync-backend
  - frontend: (your merged PR/commit tag for Talk Room UI)
- W6-B5 — QA safety + spend regression gate (docs + scripts) — Tag: v1-w6b-close

Verification (Week 6 close-out):
- backend\verify_profile_completion.ps1 — PASS
- backend\verify_profile_strength_contract.ps1 — PASS
- backend\verify_languages_habits_contract.ps1 — PASS
- backend\verify_chat_night_v5_only.ps1 — PASS (when backend env includes match_meta)
- backend\verify_chat_night_fifo_only.ps1 — PASS (when backend env disables match_meta)
- backend\verify_chat_night_icebreakers_contract.ps1 — PASS
- backend\verify_chat_night_icebreakers_reveal_sync.ps1 — PASS
- manual run browser check.txt — PASS (“2 browsers, 1 room”)

Note on occasional script failures:
- Some scripts fail if backend env flags don’t match their expectations (match_meta on/off).
- Some scripts fail if executed too quickly due to the 5/min rate limit; waiting ~70s usually resolves it.