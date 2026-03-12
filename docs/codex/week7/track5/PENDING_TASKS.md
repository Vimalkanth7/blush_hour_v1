# Week 7 — Track 5 (SAFETY + ADMIN + MONITORING) — PENDING TASKS

Owner: Lead + Backend + QA + Docs  
Goal: Safety and owner control for real-world launch (moderation is not optional).

## Status
- Track 5: 🟡 IN PROGRESS

## Dependencies
- Track 0 (Security baseline): ✅ DONE
- Track 1 (OTP): ✅ DONE (recommended before broad rollout to reduce abuse)
- Track 4 (Photos): ✅ DONE (reports can reference photo issues)
- Track 2 (Voice): in progress/partial validation (device testing deferred)

## Core Specs (must be enforced)
- PII hygiene:
  - Never log phone numbers, OTP codes, report free-text, or user-provided identifiers.
  - If any telemetry/tracing is enabled, use only non-PII identifiers (user_id is OK server-side; hashes in logs if needed).
- Payload limits:
  - report.reason must be an enum (no arbitrary strings)
  - report.details (optional) must be capped (e.g., <= 500 chars)
- Admin-only moderation:
  - all moderation actions must require admin auth (no env-only gating)
- Safety must work even if UI is imperfect:
  - block should have real enforcement server-side

## Rollback / Kill switch (required)
- BH_SAFETY_TOOLS_ENABLED=true (default true)
- Emergency rollback:
  - BH_SAFETY_TOOLS_ENABLED=false disables REPORT + MODERATION endpoints
  - BLOCK must remain available (do not disable block in emergencies)

## Subtasks

### [x] T5-A (Backend) Report / Block / Mute primitives + enforcement
Deliverables:
- New models:
  - Block (blocker_user_id, blocked_user_id, created_at)
  - Report (reporter_user_id, target_user_id, room_id optional, reason enum, details optional, status=open|resolved, created_at)
- User endpoints (auth required):
  - POST /api/safety/block
  - DELETE /api/safety/block/{blocked_user_id}
  - GET /api/safety/blocks
  - POST /api/safety/report
- Enforcement rules:
  - Discovery/browse must exclude blocked users (both directions).
  - Chat Night matching must not pair blocked users.
  - If a user blocks someone while in an active room, room access must be prevented going forward (best-effort: end/leave + deny re-entry).
- No PII in logs/traces; sanitize error messages.

### [x] T5-B (Backend) Moderation queue + admin actions (ban/suspend) + audit log
Deliverables (admin-only):
- GET /api/admin/reports?status=open|resolved
- POST /api/admin/reports/{report_id}/resolve
- POST /api/admin/users/{user_id}/ban (duration or permanent)
- POST /api/admin/users/{user_id}/unban
- AuditLog model capturing:
  - admin_user_id, action, target_user_id, report_id optional, created_at
Enforcement:
- Banned users cannot use core flows (at minimum: login/enter chat-night).

### [ ] T5-C (Docs) Safety + beta ops runbook
Deliverable:
- docs/codex/week7/track5/SAFETY_ADMIN_RUNBOOK.md
Must include:
- Pilot rollout checklist (cities, time windows, who monitors)
- Incident response (report spikes, harassment, underage risk escalation steps)
- Admin endpoints usage (curl/PowerShell examples)
- Kill switch procedure (BH_SAFETY_TOOLS_ENABLED)

### [ ] T5-D (QA) Safety/admin verifiers + staging smoke harness
Deliverables:
- backend\verify_safety_admin_contract.ps1:
  - report works (auth)
  - block works (auth) + enforcement checks (discovery/match exclusion if implemented)
  - admin endpoints require admin (403/401 for normal users)
- Minimal staging smoke checklist script (optional later)

## Acceptance Criteria (Track 5)
- Any user can block another user; blocked users are not shown/paired again.
- Users can report; reports appear in admin queue; admin can resolve.
- Ban/suspend prevents access to key flows.
- Kill switch disables reporting/moderation endpoints without breaking block.
- QA verifier(s) PASS.