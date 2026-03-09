# Week 7 — Track 0 (SECURITY + PII BASELINE) — SESSION LOG

## Log Format (per entry)
- Date (YYYY-MM-DD)
- What changed
- Decisions (why we chose X over Y)
- How verified (commands + PASS lines)
- PR/commit refs
- Risks/follow-ups

## Entries
## 2026-03-05 — W7-0A merged (Security + PII baseline)
What changed:
- Removed SECRET_KEY fallback; startup now fails if SECRET_KEY is missing/empty.
- Sanitized unhandled error responses (generic 500 body to clients; logs kept server-side).
- Removed raw DB exception strings from /health.
- Removed phone_number from discovery schema/payload via dedicated public discovery schema.
- Internal eval safety: env gating remains + additional production-like guard (override required to allow in prod).

Decisions (why we chose X over Y):
- Fail-fast on SECRET_KEY to prevent insecure deployments and “silent” weak auth.
- Generic 500 responses to prevent leaking internals/PII via error messages.
- Dedicated discovery schema to guarantee public payloads never include phone_number.
- Keep internal eval usable in dev/test while preventing accidental exposure in prod-like environments.

How verified (commands + PASS lines):
- Invoke-RestMethod http://localhost:8000/health  → healthy/connected
- backend\verify_profile_completion.ps1  → PASS
- backend\verify_profile_strength_contract.ps1  → PASS
- backend\verify_languages_habits_contract.ps1  → PASS
- backend\verify_chat_night_v5_only.ps1  → PASS
- backend\verify_chat_night_fifo_only.ps1  → PASS
- backend\verify_chat_night_icebreakers_contract.ps1  → PASS
- backend\verify_chat_night_icebreakers_reveal_sync.ps1  → PASS
- Discovery check: has_phone_field=False

PR/commit refs:
- a88e8be (Merge PR #17) / backend commit 3403973

Risks / follow-ups:
- All deployments must provide SECRET_KEY (startup will fail otherwise by design).
- Internal eval production guard relies on env markers; ensure your production environment variable naming is included in the guard list if needed.
