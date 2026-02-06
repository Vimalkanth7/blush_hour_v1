# AGENTS.md — Blush Hour (Antigravity Rules for Codex)

This repo is built using an Antigravity multi-agent workflow.
Codex must follow these rules before making any change.

---

## 0) Golden Rules (NON-NEGOTIABLE)

1) **One task = one agent = one scope**
   - If a task touches backend + frontend, split into two separate Codex tasks.

2) **No silent changes**
   - Every change must include:
     - what changed
     - why it changed
     - how it was verified

3) **Always keep it reversible**
   - Prefer config/env flags and additive migrations.
   - Avoid breaking existing endpoints unless explicitly instructed.

4) **Acceptance criteria must be met**
   - If you cannot meet acceptance criteria, stop and report precisely what’s blocking.

5) **Do not refactor unrelated code**
   - Only edit files required for the task.

6) **Security first**
   - Never log secrets (tokens, passwords).
   - Never expose password_hash in any API response.
   - Admin routes must remain admin-protected.

---

## 1) Repo Ownership

### Backend (FastAPI + Mongo/Beanie)
- Folder: `backend/`
- Owner: Backend Agent
- Allowed edits: API routes, models, dependencies, services, scripts, docs under backend.

### Frontend (Expo Router / React Native Web)
- Folder: `mobile-app/`
- Owner: Frontend Agent
- Allowed edits: screens under `app/`, components, context, constants, UI.

### Docs
- Folder: `backend/docs/` and `docs/` (if exists)
- Owner: Lead Agent / QA Agent
- Allowed edits: API contracts, checklists, runbooks.

### Scripts (Verification)
- Folder: `backend/*.ps1`
- Owner: QA Agent (or Backend Agent if tightly coupled)
- Must remain copy-paste runnable.

---

## 2) Default Run Commands (Windows PowerShell)

### Backend
- Run:
  - `cd backend`
  - `venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Health:
  - `Invoke-RestMethod http://localhost:8000/health`

### Mobile / Web
- Run:
  - `cd mobile-app`
  - `npm install`
  - `npm run web`

---

## 3) Branching + Output Requirements

### Branch naming
- `feat/<area>-<short-desc>`
- `fix/<area>-<short-desc>`
- `chore/<area>-<short-desc>`

### Output required from Codex after every task
1) Files changed (list)
2) What changed (bullets)
3) How verified (commands + outputs)
4) Any known follow-ups / risks

---

## 4) API Contracts / Compatibility Rules

- Do not rename existing fields unless coordinated with frontend.
- If API response shape changes:
  1) Update backend docs
  2) Update frontend mapping
  3) Update verification scripts
  4) Provide backward compatibility if possible

---

## 5) Testing Discipline

### Backend
- If a verification script exists for the feature
