WEEK 3 — PENDING TASKS

Theme: Foundations & Safety (Small + Safe)
Status: ACTIVE
Rules: Follow AGENTS.md strictly

🟢 W3-A — Profile V1 Schema Finalization (Backend)

Agent: Backend Agent
Scope: Backend only
Risk Level: Low (Additive)

🎯 Goal

Introduce a stable V1 profile schema that is backward compatible and future-ready for AI, without changing user behavior.

📂 Files to Inspect

backend/app/models/user.py

backend/app/schemas/user.py

backend/app/routers/users.py

backend/docs/07_PROFILE_SPEC.md (update if needed)

🛠️ Required Changes

Add profile_version: "v1" (default for all users)

Add non-breaking, optional fields:

interests: List[str] = []

values: List[str] = []

bio: Optional[str]

prompts: List[{ question, answer }]

Ensure:

Existing users still deserialize correctly

No required fields added

No response shape breaks

✅ Acceptance Criteria

Existing users can fetch profile without errors

New fields appear with safe defaults

No frontend dependency introduced

🚫 Constraints

❌ No UI changes

❌ No gating logic

❌ No migrations that mutate existing data

🟢 W3-B — Profile Completion Scoring (Backend, Flagged)

Agent: Backend Agent
Scope: Backend only
Risk Level: Low (Read-only, feature-flagged)

🎯 Goal

Compute a profile completion percentage without affecting any user flow.

📂 Files to Inspect

backend/app/services/profile_scoring.py

backend/app/models/user.py

backend/app/routers/users.py

🛠️ Required Changes

Compute profile_completion_percent using weighted logic:

Photos

Basics

Bio / prompts

Interests

Expose score in profile read API

Add feature flag:

PROFILE_COMPLETION_ENABLED = false

✅ Acceptance Criteria

Score computes correctly when flag is ON

No behavior change when flag is OFF

Field is read-only

🚫 Constraints

❌ No feature gating

❌ No UI changes

🟢 W3-C — Profile Read Consistency (Frontend)

Agent: Frontend Agent
Scope: Frontend only
Risk Level: Very Low

🎯 Goal

Ensure frontend safely renders new profile fields (even if empty).

📂 Files to Inspect

mobile-app/app/(tabs)/profile.tsx

mobile-app/app/modal/preview-profile.tsx

mobile-app/components/profile/*

🛠️ Required Changes

Safely handle:

Empty interests

Empty values

Missing bio

Missing prompts

Render fallbacks only (no new UI)

✅ Acceptance Criteria

Profile screen renders for:

Old users

New users

No crashes or console errors

🚫 Constraints

❌ No redesign

❌ No new inputs

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