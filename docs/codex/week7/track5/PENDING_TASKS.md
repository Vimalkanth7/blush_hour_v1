# Week 7 — Track 5 (SAFETY + ADMIN + MONITORING) — PENDING TASKS

Owner: Lead + Backend + QA + Docs  
Goal: Safety and owner control for real-world launch (moderation is not optional).

## Status
- Track 5: ⏳ TODO

## Subtasks
- [ ] T5-A (Backend) Report/Block/Mute (room + user scoped)
- [ ] T5-B (Backend) Moderation queue + admin actions (ban/suspend) + audit log
- [ ] T5-C (Docs) Beta ops runbook (pilot cities + time windows + escalation)
- [ ] T5-D (QA) Staging smoke harness (auth/onboard/match/voice/icebreakers/admin gating)

## Rollback / Kill switch (required)
- BH_SAFETY_TOOLS_ENABLED=true (default true)
- If emergency: set false to temporarily disable reporting UI/paths (must still preserve block).

## Acceptance Criteria (Track 5)
- You can block/ban quickly and see reports in an admin view.
- Clear runbook for incidents + rollout.
- Staging smoke can validate core flows quickly.
