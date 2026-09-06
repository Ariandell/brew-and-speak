# English with Coffee V3 — acceptance test matrix

Оновлено: 2026-09-06. Це єдина таблиця для фінальної перевірки перед promotion.

Позначки: `AUTO PASS` — перевіряється автоматично; `MANUAL` — потрібен реальний
Telegram/пристрій або візуальне рішення; `DEFERRED` — свідомо не входить у цей
реліз. Production Turso автоматичні UI-тести не використовують.

## Автоматичні набори

| Набір | Покриття | Результат |
| --- | --- | --- |
| Backend | auth, contracts, repositories, migrations, domain, isolation | 82 PASS |
| Frontend unit | API mapping, writes, identity, routes, domain, session restore, mesh | 35 PASS |
| Demo mobile E2E | повний UI, помилки, 3 ширини, WebGL fallback | 19 PASS |
| Production integration E2E | React UI → signed Telegram → Express → local SQLite | 9 PASS |
| 3D audit | neutral, wave, present, celebrate, wait | 5/5 PASS |

## Student flow

| ID | Дія | Очікування | Статус |
| --- | --- | --- | --- |
| S-01 | Новий підписаний Telegram user відкриває app | Створюється лише student, без довіри до client role | AUTO PASS |
| S-02 | Welcome → «Почати» → обрати курс | Home показує обраний курс одразу | AUTO PASS |
| S-03 | Refresh після enrollment | Курс і маршрут збережені | AUTO PASS |
| S-04 | Відкрити course path | Перший урок доступний, наступні obey drip | AUTO PASS |
| S-05 | Відкрити locked deep link | Контрольована відмова, прогрес не змінюється | AUTO PASS |
| S-06 | Пройти quiz/fill blank/true-false/word-order/match-pairs | Кожна відповідь оцінюється сервером | AUTO PASS |
| S-07 | Пропустити частину/всі вправи | Skipped не стають correct, perfect score неможливий | AUTO PASS |
| S-08 | Double answer/finish | First-answer invariant, один результат | AUTO PASS |
| S-09 | Refresh посеред уроку | Attempt відновлюється без нового score | AUTO PASS |
| S-10 | Завершити урок | Score, correct/wrong/skipped чесні; next unlock = 24h | AUTO PASS |
| S-11 | Повторити до/на межі cooldown | До 24h blocked, на межі available | AUTO PASS |
| S-12 | Відкрити homework | Prompt і форма одночасно видимі | AUTO PASS |
| S-13 | Paste HTML/script у відповідь | Зберігається безпечний текст, script не виконується | AUTO PASS |
| S-14 | Додати файл до 20 МБ | Chunked upload, SHA-256, authenticated download | AUTO PASS |
| S-15 | Invalid MIME/oversize | Зрозуміла помилка, submission не створюється | AUTO PASS |
| S-16 | Submit/refresh | Одна pending робота, текст не дублюється | AUTO PASS |
| S-17 | Після grading відкрити homework | Видно grade і feedback викладачки | AUTO PASS |
| S-18 | Dictionary / свайп cards | Review зберігається, due queue змінюється | AUTO PASS |
| S-19 | Wrong/correct SRS | 0→1→3→multiplier, ease ≥1.3 | AUTO PASS |
| S-20 | Написати в chat і refresh | Власний діалог збережений | AUTO PASS |
| S-21 | Інший студент відкриває app | Не бачить чужі lesson/homework/SRS/chat дані | AUTO PASS |
| S-22 | Відкрити scheduled broadcast до часу | Не видно | AUTO PASS |
| S-23 | Відкрити published broadcast | Caption і authenticated image видимі; view state scoped | AUTO PASS |
| S-24 | Blocked student відкриває app | Лише контрольований blocked screen, без protected reads | AUTO PASS |

## Teacher workspace

| ID | Дія | Очікування | Статус |
| --- | --- | --- | --- |
| T-01 | Teacher відкриває app | Відкривається teacher dashboard, не student home | AUTO PASS |
| T-02 | Student відкриває teacher deep link/API | 403 і жодних teacher даних | AUTO PASS |
| T-03 | Створити/edit course | Дані переживають refresh | AUTO PASS |
| T-04 | Видалити непорожній course | Немає silent cascade deletion | AUTO PASS |
| T-05 | Створити/edit lesson і blocks | Draft проходить semantic validation і preview | AUTO PASS |
| T-06 | Дві revision одного lesson | Застаріле збереження отримує 409 conflict | AUTO PASS |
| T-07 | Видалити новий порожній lesson/course | Записи зникають, legacy content не змінюється | AUTO PASS |
| T-08 | Відкрити pending homework | Видно автора, prompt, answer і вкладення | AUTO PASS |
| T-09 | Поставити/виправити grade + feedback | Student бачить останню перевірку | AUTO PASS |
| T-10 | Відповісти student A | Відповідь бачить лише student A | AUTO PASS |
| T-11 | Block/unblock student | API й UI негайно застосовують стан | AUTO PASS |
| T-12 | Schedule/delete photo broadcast | Server time і видалення застосовуються | AUTO PASS |
| T-13 | Відкрити statistics | Legacy + V3 дані merged без double count | AUTO PASS |
| T-14 | Teacher preview locked lesson | Доступ є, student progress не створюється | AUTO PASS |

## Security and resilience

| ID | Перевірка | Очікування | Статус |
| --- | --- | --- | --- |
| R-01 | Немає/tampered/expired/future initData | 401 або контрольований auth screen | AUTO PASS |
| R-02 | Client підміняє userId/role/outcome | Поля ігноруються або validation error | AUTO PASS |
| R-03 | Чужий asset ID | 404 без витоку існування файла | AUTO PASS |
| R-04 | Повтор chunk/finalize/message/review | Idempotent result, без дубля | AUTO PASS |
| R-05 | Зламана API відповідь | Не стає demo/fallback data | AUTO PASS |
| R-06 | Unknown route | Контрольований 404 screen/JSON envelope | AUTO PASS |
| R-07 | WebGL unavailable/context restored | Основні CTA та навчання працюють | AUTO PASS |
| R-08 | 360/390/430 px | Немає horizontal overflow на critical screens | AUTO PASS |
| R-09 | Dependency/secret scan | 0 production vulnerabilities, secrets absent | AUTO PASS |

## Фінальний ручний smoke у Telegram

Заповнюється на preview deployment перед production promotion.

| ID | Пристрій/роль | Перевірка | Android | iOS | Примітка |
| --- | --- | --- | --- | --- | --- |
| M-01 | student | Перший запуск, enrollment, back/forward | MANUAL | MANUAL | |
| M-02 | student | Урок усіх типів із реальною клавіатурою | MANUAL | MANUAL | |
| M-03 | student | Paste, коми, Unicode, довга homework відповідь | MANUAL | MANUAL | |
| M-04 | student | Upload фото/документа через Telegram WebView | MANUAL | MANUAL | |
| M-05 | student | Swipe cards одним пальцем, scroll не конфліктує | MANUAL | MANUAL | |
| M-06 | student | Chat + відкриття broadcast image | MANUAL | MANUAL | |
| M-07 | teacher | Course/lesson editor, focus і virtual keyboard | MANUAL | MANUAL | |
| M-08 | teacher | Homework download/grade/chat/broadcast | MANUAL | MANUAL | |
| M-09 | both | Safe areas, bottom nav, системна dark theme | MANUAL | MANUAL | |
| M-10 | both | 3D FPS, нагрів, пам’ять, background/restore | MANUAL | MANUAL | |
| M-11 | both | Повільна/відсутня мережа, retry після reconnect | MANUAL | MANUAL | |
| M-12 | owner | Візуальне погодження всіх екранів | MANUAL | MANUAL | |

## Data cutover checklist

| ID | Крок | Статус |
| --- | --- | --- |
| D-01 | Повний Turso backup створено | MANUAL |
| D-02 | Restore backup перевірено на окремій БД | MANUAL |
| D-03 | Read-only inventory збережено | MANUAL |
| D-04 | V3_002 migration виконано окремим job | MANUAL |
| D-05 | Legacy row counts і content fingerprint збігаються | MANUAL |
| D-06 | Preview smoke пройдено | MANUAL |
| D-07 | Попередній Vercel deployment записано для rollback | MANUAL |
| D-08 | Promotion погоджено власником | MANUAL |

## Свідомо відкладено

| Тема | Статус | Причина |
| --- | --- | --- |
| Складні 3D scene-wipe переходи | DEFERRED | Не блокують функціонал; повернуться через scene contract |
| Очищення `demo-user` SRS | DEFERRED | Історичне рішення власника даних |
| Видалення orphan media | DEFERRED | Потрібен окремий manifest і backup |
| Перерахунок історичних score | DEFERRED | Не можна змінювати оцінки без рішення власника |
