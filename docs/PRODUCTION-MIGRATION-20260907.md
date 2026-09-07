# English with Coffee V3 — production migration report

Date: 2026-09-07.

## Result

- Target: `brew-db-ariandell.aws-eu-west-1.turso.io`.
- Verified backup: `brew-db-pre-v3-20260907.db`.
- Backup SHA-256: `6A1B1D5BBE66E37CC4ECDF8BB8F2621B27EE2FB0B6DB0627D7245F15838ABAA7`.
- Legacy content fingerprint before and after: `10d5961790e1951dfb1d91a6fe816522a059e20f84e6fbe64a88138d90f6bb64`.
- Inventory report SHA-256: `bd2855ec4bfdea36c231692cda1f6df542a702096b71c79a5ff6d98ae512b7a2`.
- Applied migrations: `v3-001-sandbox-module-schema`, `v3-002-lesson-overlays`.
- `V3_WRITES_ENABLED=true` is configured for Preview and Production.

The migration was additive. It created only `v3_*` tables and metadata. Legacy
row counts and inherited content were checked immediately before and after the
operation and remained identical.

## Preserved legacy inventory

| Table | Rows |
| --- | ---: |
| users | 16 |
| levels | 2 |
| lessons | 20 |
| lesson_blocks | 211 |
| user_progress | 91 |
| flashcards | 339 |
| user_flashcard_progress | 1927 |
| homework_submissions | 69 |
| app_assets | 60 |
| messages | 10 |
| photo_messages | 0 |
| photo_message_views | 0 |

The one-time cutover HTTP route and its Vercel secret were removed immediately
after verification. Rollback remains a Vercel deployment rollback; the additive
`v3_*` tables can remain because older builds do not read them.
