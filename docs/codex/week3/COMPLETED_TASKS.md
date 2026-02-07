🟢 W3-A — Profile V1 Schema Finalization (Backend)

Status: DONE

Notes:
- Added `profile_version` default to user model and read schema.
- Added safe defaults for `interests`, `values`, and `prompts` with backward-compatible coercion.
- No response shape breaks; no migrations.
