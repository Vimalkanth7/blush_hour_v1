# Week 5 — Chat Night Matching (V5, No-AI)




## 🟡 W5-D — Fairness boost (wait-time priority)
Status: TODO
Owner: Backend Agent
Depends on: W5-B

Goal:
- Prefer users waiting longer so nobody gets stuck.

Acceptance criteria:
- Waiting users get a boost without overriding hard constraints.

Verification:
- simulation script demonstrates wait-time improves matching fairness


## 🟡 W5-E — Regression script: V5 match contract
Status: TODO
Owner: QA Agent
Depends on: W5-B

Goal:
- Script that sets up small pool and asserts deterministic partner selection + reason_tags present.

Acceptance criteria:
- Script exists and PASS required to merge.

Verification:
- run script + Week3/Week4 regression scripts — PASS


## 🟡 W5-F — Docs lock-in (V5 formula + reason_tags spec)
Status: TODO
Owner: Docs/Lead Agent
Depends on: W5-E

Goal:
- Document V5 formula, flags, cooldown, fairness, and QA scripts.

Acceptance criteria:
- docs updated + regression checklist updated.

Verification:
- Diff is docs-only and Antigravity QA PASS
