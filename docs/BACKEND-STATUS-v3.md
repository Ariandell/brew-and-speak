# English with Coffee — backend V3 status

Оновлено: 2026-09-06.

## Архітектура

- `api/index.ts` створює лише production composition.
- `/api/v2` має стабільні Zod-контракти й однаковий JSON error envelope.
- Telegram `initData` перевіряється HMAC-ом на сервері; URL, localStorage,
  `initDataUnsafe`, `userId` або роль із frontend не є джерелом прав.
- Domain має дві ролі: `student` і `teacher`; адмінка є teacher workspace.
- Legacy-таблиці читаються через адаптер. Нові записи й override зберігаються в
  additive `v3_*` таблицях, без перезапису успадкованого контенту.
- Startup не створює таблиці: write-режим fail-closed без marker
  `v3-002-module-schema`.

## Реалізовані модулі

| Модуль | Основні гарантії |
| --- | --- |
| Identity | Provision лише з підписаного Telegram профілю; role/block/course не демотуються sync-ом |
| Courses/enrollment | Overlay без legacy UPDATE; effective reads однакові для UI й domain |
| Lessons/editor | Typed blocks, sanitization, semantic validation, optimistic revision |
| Attempts/progress | Frozen snapshot, first-answer invariant, server score, drip/cooldown |
| Homework | Idempotent submit/grade, safe answer, owner-scoped assets |
| Media | Chunked upload 512 KiB, до 20 МБ, SHA-256, resume, TTL, exact authorization |
| SRS | Canonical інтервали, server clock, idempotency |
| Chat/broadcasts | Participant isolation, read state, scheduled visibility |
| Teacher | Students, block/unblock, courses, lessons, homework, chat, broadcasts, statistics |

## Перевірки

`npm run api:test` автоматично знаходить усі `server/**/*.test.ts`, тому новий
тест неможливо випадково забути у ручному списку. Поточний набір: 82 сценарії.
Окремий production browser suite перевіряє 9 наскрізних UI→HTTP→SQLite потоків.

Додатково проходять `api:typecheck`, `security:scan`, production build і
`npm audit --omit=dev` (0 vulnerabilities).

## Межа безпеки даних

Production Turso не змінювалася. Локальний архів
`C:/eng/backups/v3-local-20260905-225514.zip` є backup вихідного коду, **не
backup бази**. Production migration дозволена лише через окремий job після
verified backup і з явною фразою підтвердження V3_002. Вона перевіряє незмінність
legacy row counts та SHA-256 fingerprint успадкованого контенту.
