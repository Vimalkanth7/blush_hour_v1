# AGENT_PLAYBOOK — How we use agents (Blush Hour v0)

## Roles & ownership
### Lead Agent
Owns architecture rules, gating decisions, docs approval.
Outputs: plans + acceptance criteria. No implementation unless explicitly assigned.

### Frontend Agent
Owns `mobile-app/` changes: UI, navigation, AuthContext, screens.

### Backend Agent
Owns `backend/` changes: API routes, models, schemas, security.

### QA Agent
Owns PASS/FAIL verification, regression checklist, bug reports.

### Running Agent
Owns start/stop/reset, environment cleanup, runbook updates.

---

## Golden rules
1) One task -> one agent -> one conversation.
2) Agents do not coordinate automatically. You coordinate by copy-pasting outputs.
3) No parallel edits unless Lead explicitly splits tasks.
4) QA must PASS before starting the next feature.
5) Any auth/navigation change must reference `docs/01_AUTH_FLOW.md`.

---

## Standard workflow
1) Define problem statement (1–2 lines)
2) Lead writes plan + acceptance + file scope
3) Frontend/Backend implement (as assigned)
4) QA verifies (must pass)
5) Running agent updates runbook + clean start procedure
6) Lead declares GO for next phase

---

## When stuck: who to ask
- Architecture decision -> Lead
- UI/navigation -> Frontend
- API/persistence/security -> Backend
- “Is it actually working?” -> QA
- “How do I run/reset?” -> Running

## Antigravity Orchestration Rules (LOCKED)

### Core Execution Flow
Human → Lead GPT → One Agent → Findings / Changes / Evidence → Lead GPT → Human

### System Rules
- The Lead GPT is the sole orchestrator.
- Humans never instruct agents directly.
- One agent, one task, one execution cycle.
- No agent performs manual testing.
- No agent expands scope or refactors.
- All changes must be minimal and reversible.
- Web behavior is the source of truth.

### Human QA Rules
- Manual testing is done by the human.
- Human reports observations only.
- No diagnosis, no suggested fixes from human.

### Agent Output Contract (MANDATORY)
Each agent response must include:
- Findings
- Changes
- Evidence


