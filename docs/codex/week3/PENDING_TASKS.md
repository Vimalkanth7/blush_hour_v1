WEEK 3 — PENDING TASKS

Theme: Foundations & Safety (Small + Safe)
Status: ACTIVE
Rules: Follow AGENTS.md strictly

🟢 W3-D — Safety & Trust Fields (Backend)

Agent: Backend Agent
Scope: Backend only
Risk Level: Low (Data-only)

🎯 Goal

Introduce safety & trust data scaffolding without enforcement.

📂 Files to Inspect

backend/app/models/user.py

backend/app/schemas/user.py

🛠️ Required Changes

Add system-controlled fields:

is_verified: bool = false

verification_level: "none" | "photo" | "id"

safety_score: int = 100

reports_received: int = 0

✅ Acceptance Criteria

Fields exist with defaults

Fields are NOT user-writable

Admin-only mutation possible

🚫 Constraints

❌ No verification logic

❌ No blocking behavior

🟢 W3-E — QA: Profile Regression Verification

Agent: QA Agent
Scope: Verification only
Risk Level: None

🎯 Goal

Confirm Week 3 changes did not break existing flows.

📂 Files to Inspect

Profile APIs

Auth flow

Existing verification scripts

🛠️ Required Actions

Verify:

Login works

Profile fetch works

New fields do not error

Write results to:

docs/codex/week3/SESSION_LOG.md

✅ Acceptance Criteria

Clear PASS / FAIL

Risks (if any) documented

🔒 WEEK 3 EXECUTION RULES

Tasks must be executed top to bottom

Only ONE task active at a time

On success:

Move task to COMPLETED_TASKS.md

On failure:

Log blocker in SESSION_LOG.md

STOP
