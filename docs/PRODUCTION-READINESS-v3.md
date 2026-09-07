# English with Coffee V3 — production readiness

Оновлено: 2026-09-07.

## Поточний висновок

Код V3 розгорнутий у preview. Additive-міграцію production Turso виконано
2026-09-07 після точного порівняння з перевіреним backup; записи ввімкнено для
Preview і Production. Promotion нового дизайну на основний домен залишається
окремим ручним рішенням після візуального погодження.

Frontend працює через canonical `/api/v2`, а не через demo repository. Сервер
перевіряє Telegram `initData`, сам визначає internal user ID, роль і блокування.
Є лише дві domain-ролі: `student` та `teacher`; legacy `admin` без підвищення прав
із клієнта нормалізується до `teacher`.

## Готово

| Контур | Стан |
| --- | --- |
| Telegram auth і server-side permissions | Готово |
| Курси, enrollment, уроки й редактор | Готово |
| 5 типів вправ, чесний score, skipped, refresh attempt | Готово |
| Drip 24h і retake cooldown 24h | Готово |
| Homework, grading, вкладення до 20 МБ | Готово |
| SRS / spaced repetition | Готово |
| Student↔teacher chat та ізоляція діалогів | Готово |
| Photo broadcasts і authenticated media | Готово |
| Teacher dashboard, students, block/unblock, statistics | Готово |
| Один WebGL canvas, 2D fallback, 5 перевірених поз | Готово |
| Vercel build/rewrites/CSP | Preview розгорнуто |
| Additive migration V3_002 | Виконано, legacy fingerprint збережено |

## Автоматична перевірка

| Набір | Результат |
| --- | --- |
| Backend unit/integration | 82 сценарії |
| Frontend/API/domain unit | 35 сценаріїв |
| Demo mobile UI | 19 сценаріїв |
| Production UI → API → local SQLite | 9 сценаріїв |
| 3D asset audit | 5/5 поз, по 20 000 трикутників |
| TypeScript + production build | PASS |
| Secret scan | PASS |
| `npm audit --omit=dev` | 0 vulnerabilities |

Production UI-контур використовує справжній підписаний Telegram payload і
перевіряє enrollment, усі оцінювані блоки, homework roundtrip, chat isolation,
SRS swipe, teacher CRUD, blocking, scheduled media та рольові заборони. База
цього контуру — лише локальний файл `v3/.tmp-e2e/production-ui.sqlite`.

## Безпечний порядок випуску

1. Відкликати раніше оприлюднений Gemini key, якщо це ще не зроблено.
2. Створити й **перевірити відновлення** повного backup Turso; записати його ID.
3. Встановити server-only variables: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`,
   `TELEGRAM_BOT_TOKEN`, `V3_WRITES_ENABLED=true`.
4. Окремо запустити migration job з
   `V3_MIGRATION_CONFIRM=APPLY_V3_002_AFTER_VERIFIED_BACKUP` і
   `V3_BACKUP_REFERENCE=<verified-backup-id>`.
5. Перевірити migration report: legacy row counts і content fingerprint до/після
   мусять збігатися.
6. Розгорнути V3 як preview, не як production; виконати smoke у реальному
   Telegram WebView на Android та iOS.
7. Лише після візуального погодження користувача промотувати preview.

## Rollback

- До promotion чинний застосунок не зачіпається.
- Після promotion перший rollback — повернення попереднього Vercel deployment.
- V3_002 лише додає `v3_*` таблиці; при rollback їх не видаляти. Старий build їх
  ігнорує, тому це безпечніше за destructive down-migration.
- Якщо перевірка даних виявить розбіжність, зупинити cutover і відновити Turso з
  перевіреного backup. Не чистити й не перепризначати історичні записи вручну.

## Що потребує зовнішньої перевірки

- реальний Telegram WebView, клавіатура, safe areas і системна тема;
- FPS/нагрів/пам’ять на цільових смартфонах;
- візуальне погодження всіх student/teacher екранів;
- production backup та migration report;
- історичні `demo-user` SRS записи й orphan assets — окреме рішення власника,
  вони не очищаються цим релізом.

## Локальний recovery artifact

Поточний код заархівовано у
`C:/eng/backups/v3-production-ready-20260906.zip`, SHA-256
`6ABC119CD1B06FB78CA99F28222F4AD519B0918A8AB001F1BC24494F0397296D`.
Архів не містить `node_modules`, build/test artifacts або production-БД.
