# English with Coffee — план виправлення відомих проблем

Статус: реалізація плану завершена у V3; документ збережено як журнал причин і
прийнятих рішень. Автоматичні результати та невиконані зовнішні кроки дивись у
`PRODUCTION-READINESS-v3.md` і `E2E-USER-FLOW-TEST-PLAN-v3.md`.

Жоден пункт цього документа сам по собі не дозволяє змінювати production-БД.
Усі операції з історичними даними потребують backup, sandbox rehearsal,
verification manifest і окремого підтвердження власника.

Пов’язані документи:

- [ARCHITECTURE-v3.md](ARCHITECTURE-v3.md) — межі модулів і порядок залежностей;
- [API-CONTRACTS-v3.md](API-CONTRACTS-v3.md) — endpoint та data contracts;
- [LEGACY.md](LEGACY.md) — фактичні особливості старої бази;
- `v3/TRANSITIONS.md` — сценарій 3D-переходів.

---

## 1. Класи проблем

| Позначка | Значення | Як діємо |
| --- | --- | --- |
| `SEC` | безпека й ідентичність | виправляємо до будь-якого production write |
| `DATA` | схема або історичні дані | лише sandbox → backup → migration approval |
| `DOMAIN` | бізнес-правила | чиста policy + table-driven unit tests |
| `API` | контракти й транзакції | shared schema + integration tests |
| `UI` | рендер, стани, доступність | component/flow tests + real WebView |
| `3D` | сцена, модель, переходи | asset contract + performance acceptance |
| `OPS` | deploy, rollback, спостереження | окремі середовища й release checklist |

Пріоритети:

- **P0** — може відкрити чужі дані, пошкодити БД або заблокувати основний flow;
- **P1** — дає неправильний прогрес/оцінку або ламає важливу сторінку;
- **P2** — погіршує UX, продуктивність або підтримуваність;
- **P3** — очищення й полірування після стабілізації.

---

## 2. Безпека та ідентичність

### SEC-01 · API довіряє `userId` із frontend — P0

**Проблема.** Legacy endpoint приймають Telegram/user ID у path або body.
Користувач може підмінити його та спробувати прочитати чужий прогрес, ДЗ або
чат.

**Виправлення.**

1. У нових student endpoint прибрати `:userId` повністю.
2. На кожному запиті перевіряти Telegram `initData` HMAC-ом bot token.
3. Створювати `RequestContext` із внутрішнім `users.id`.
4. Усі repositories фільтрують student-дані за `RequestContext.userId`.
5. `studentId` дозволений лише в teacher endpoint як ціль керування.

**Перевірка.** Змінений Telegram payload, чужий ID у URL/body і прямий виклик
teacher endpoint повертають 401/403; жодні чужі дані не потрапляють у response.

**Безпека даних.** Міграція БД не потрібна.

### SEC-02 · Teacher endpoint доступний без server-side role check — P0

**Проблема.** Прихована кнопка в UI не захищає endpoint. У старому API частину
`/api/admin/*` можна було викликати напряму.

**Виправлення.**

1. У продукті залишити дві ролі: `student`, `teacher`.
2. На кожен `/api/v2/teacher/*` встановити capability middleware.
3. Legacy `role = admin` нормалізувати до domain `teacher` тільки після
   успішної auth-перевірки.
4. Невідоме значення ролі не отримує teacher capabilities.
5. UI будується з `/me.capabilities`, але це лише представлення server policy.

**Перевірка.** Один і той самий URL тестується valid teacher, student,
blocked student, invalid auth і legacy admin→teacher fixture.

### SEC-03 · Sync може змінити роль або блокування — P0

**Проблема.** Telegram profile sync не повинен бути джерелом ролі. Інакше
звичайний вхід може понизити викладача або розблокувати учня.

**Виправлення.** Sync оновлює лише display name, username і Telegram metadata.
`role`, `is_blocked`, enrollment і прогрес не приймаються від клієнта й не
входять у sync UPDATE.

**Перевірка.** Після повторного bootstrap teacher лишається teacher, blocked
student лишається blocked, enrollment не змінюється.

### SEC-04 · Блокування працює лише в інтерфейсі — P0

**Проблема.** Якщо сервер віддає курс, приховану сторінку можна обійти прямим
запитом.

**Виправлення.** Auth middleware додає `isBlocked` у RequestContext. Усі
student domain endpoint після `/me` відмовляють кодом `BLOCKED`. Teacher не
можна заблокувати через student-management command.

**Перевірка.** Заблокований учень не читає lesson, path, homework, flashcards
або chat; `/me` доступний для показу пояснення.

### SEC-05 · `demo-user` або dev-auth може потрапити в production — P0

**Проблема.** Fallback identity змішує дані реальних людей і маскує помилки
Telegram bootstrap.

**Виправлення.** Dev identity реєструється лише в окремому test/dev server
entrypoint. Production build не містить route, query flag або header для
обходу Telegram auth. CI перевіряє production bundle/route table.

**Перевірка.** Запуск production config без Telegram initData завжди дає
контрольований unauthenticated screen, а не demo account.

### SEC-06 · Секрети передані в чат або frontend — P0

**Проблема.** Раніше Gemini API key був опублікований у розмові. Такий ключ
треба вважати скомпрометованим, навіть якщо його немає в git.

**Виправлення.**

1. Відкликати старий ключ у провайдера і створити новий.
2. Новий ключ зберігати тільки у server environment variables.
3. AI endpoint доступний лише teacher й має rate limit.
4. Логи не містять request headers, initData або ключі.
5. Secret scanning запускається в CI та перед release.

**Перевірка.** `rg` по repository/build не знаходить ключ; browser network не
отримує його; student не викликає generation endpoint.

---

## 3. База даних і міграції

### DATA-01 · Два несумісні user ID — P0

**Проблема.** `user_progress` і homework використовують numeric `users.id`, а
`user_flashcard_progress.user_id` — текстовий Telegram ID. Частина SRS уже
потрапила під `demo-user`.

**Виправлення.**

1. У domain/API використовувати лише numeric internal ID.
2. Legacy adapter тимчасово вміє читати старий текстовий ID.
3. Additive migration додає новий numeric reference, не видаляючи стару
   колонку.
4. Backfill мапить лише однозначні `telegram_id → users.id`.
5. `demo-user`, orphan і неоднозначні рядки потрапляють у quarantine report.
6. Після verification новий writer працює тільки з numeric ID.

**Перевірка.** Для кожного SRS row є або валідний user, або запис у звіті;
жоден `demo-user` row не приписаний випадковому учневі.

**Безпека даних.** Не обнуляти й не перепризначати історичний прогрес без
письмового рішення власника.

### DATA-02 · Міграції запускаються під час старту сервера — P0

**Проблема.** Legacy `db.ts` виконує `CREATE`, `ALTER`, backfill і перевірки при
імпорті, часто з порожнім `catch`. Deploy може непомітно змінити production.

**Виправлення.**

1. Сервер лише перевіряє підтримувану версію схеми й завершує запуск із чіткою
   помилкою, якщо вона не збігається.
2. Міграції живуть окремо, мають номер, forward, verification і rollback plan.
3. Migration job запускається вручну/CI тільки після backup.
4. Кожна migration репетирується на snapshot-копії.
5. Помилки не ковтаються: невдалий statement зупиняє процес.

**Перевірка.** Звичайний старт API не змінює schema hash або row counts.

### DATA-03 · GET-запити записують auto-unlock — P1

**Проблема.** Читання course path/active lesson може виконати UPDATE. GET стає
неповторюваним, ускладнює кеш і створює race.

**Виправлення.** Зберігати `unlocks_at`, а `available` обчислювати як derived
state через server Clock. Запис наступного unlock виконується лише в
транзакції finish attempt.

**Перевірка.** До й після GET database hash/updated timestamps однакові;
доступність змінюється при зміні тестового Clock.

### DATA-04 · Часткові записи без транзакції — P0

**Проблема.** Finish, homework upload або SRS update можуть завершити лише
половину операції при network/DB failure.

**Виправлення.** Встановити транзакційні межі для:

- attempt finish + score + progress + next unlock;
- SRS review + counters + next date;
- homework metadata + asset reference;
- grade + homework status;
- message + read state.

Додати idempotency key для повтору після timeout.

**Перевірка.** Integration test штучно падає між кроками: після rollback
немає напівзаписаного стану; retry не дублює ресурс.

### DATA-05 · Seed endpoint доступний у production — P0

**Проблема.** Публічний seed може створити контент або користувачів у реальній
БД.

**Виправлення.** Seed існує лише у test tooling і запускається проти явного
локального/sandbox URL. Production server не реєструє route.

**Перевірка.** Production route inventory не містить seed; environment guard
відмовляється працювати з production Turso URL.

### DATA-06 · Невідомий стан історичних оцінок — P1/DATA

**Проблема.** 49 із 67 завершених уроків мають score 10; частина могла бути
записана після пропуску вправ. Автоматичний перерахунок може змінити чужу
історію без повних відповідей.

**Виправлення.**

1. Не змінювати історичні score автоматично.
2. Позначити legacy progress як `calculation_version = legacy`, якщо для цього
   затверджена additive migration.
3. Нові attempts отримують нову calculation version і server-side answers.
4. UI не робить неправдивого детального розбору старого результату, якщо
   answer records відсутні.

**Перевірка.** Старі score лишаються byte-for-byte, нові спроби рахуються за
новим алгоритмом.

### DATA-07 · Orphan media й велика base64-база — P2/DATA

**Проблема.** У `app_assets` близько 92 МБ, щонайменше 17 файлів не мають
посилань. Base64 додає overhead, але видалення без аудиту небезпечне.

**Виправлення.**

1. MediaRepository ізолює поточне зберігання.
2. Згенерувати read-only asset reference report по lesson blocks, homework і
   photo messages.
3. Orphan ID перевірити на sandbox і погодити список.
4. Очищення — окрема migration з backup і точним manifest ID.
5. Object storage розглядати як окремий migration, не приховану зміну.

**Перевірка.** Усі referenced assets відкриваються до/після; видаляються лише
ID з погодженого manifest.

---

## 4. Уроки, контент та редактор

### DOMAIN-01 · Пропущені вправи рахуються правильними — P0

**Проблема.** Рахування лише помилок давало повний результат учневі, який
натиснув «Завершити», нічого не зробивши.

**Виправлення.**

- scored set визначається snapshot-ом усіх scored blocks;
- перша відповідь класифікується correct або wrong;
- блок без відповіді при finish стає skipped;
- score = correct / усі scored blocks;
- урок без scored blocks має повний completion score;
- score рахує server, не frontend.

**Перевірка.** Таблиця тестів: 4/4, 3/4, 0/4 answers, 0 scored blocks,
подвійна відповідь, word_order correct callback.

### DOMAIN-02 · Одна вправа може зарахуватися двічі — P1

**Проблема.** Повторний callback, double tap або повтор HTTP може змінити
лічильник.

**Виправлення.** У attempt answers діє unique `(attempt_id, block_id)` та
client event idempotency. Перший результат незмінний. UI блокує повторну дію,
але server constraint є остаточним захистом.

**Перевірка.** Double tap і повтор запиту не змінюють correct/wrong counts.

### DOMAIN-03 · `fill_blank` непрохідний через форматування — P1

**Проблема.** У production пропуск може бути одним або багатьма `_`, answer
містить пробіли, correct answer може не збігатися з option.

**Виправлення.**

- reader розпізнає одну чи більше `_`;
- comparison нормалізує крайні пробіли відповідей і options;
- editor перед save перевіряє наявність пропуску;
- correct answer після нормалізації мусить бути серед options;
- UI не змінює введені коми й не використовує comma-splitting без явного
  формату.

**Перевірка.** Fixtures з `_`, `___`, пробілами, комами, Unicode та відсутньою
correct option.

### DOMAIN-04 · Порожні quiz options — P1

**Проблема.** Схема дозволяє зберегти кнопку без тексту.

**Виправлення.** Legacy reader відкидає порожній display option, але фіксує
content issue. Teacher editor не зберігає quiz без мінімальної кількості
непорожніх options і валідного correct option.

**Перевірка.** Старий урок рендериться без порожньої кнопки; новий невалідний
draft повертає field error.

### DOMAIN-05 · Невідомі/legacy blocks ховаються і блокують завершення — P0

**Проблема.** Фільтрація всіх невідомих блоків може перетворити урок на екран
без контенту й без кнопки finish, через що зупиняється drip.

**Виправлення.**

1. Adapter повертає `unsupported`/`contentIssue`, а не мовчки видаляє блок.
2. Учнівський renderer показує безпечний fallback і не рахує такий block як
   правильну вправу.
3. Якщо в уроці немає scored blocks, completion лишається можливим.
4. Teacher editor показує точний issue та не перезаписує невідомий content
   випадково.

**Перевірка.** Урок тільки з legacy blocks можна відкрити, зрозуміти й
завершити; teacher бачить warning.

### UI-01 · Raw HTML показується в ДЗ або відповідях — P1

**Проблема.** Вставлений `<p>...</p>` може показуватися як текст або небезпечно
рендеритися через `innerHTML`.

**Виправлення.**

- teacher rich text проходить allowlist sanitizer;
- дозволені теги: `p, br, strong/b, em/i, u, ul, ol, li, h1–h4`;
- sanitizer серіалізує теги, але взагалі не серіалізує attributes;
- student plain answer очищає pasted markup до тексту;
- rendering виконується через parsed safe nodes, не raw HTML injection.

**Перевірка.** `<script>`, `onerror`, `href`, `style`, malformed tags і
звичайний текст; текст без тегів не змінюється byte-for-byte.

### UI-02 · Rich-text editor пересуває caret або губить текст — P1

**Проблема.** Якщо React щоразу заново записує `innerHTML`, caret стрибає, а
вставка може породити небезпечну розмітку.

**Виправлення.** Editor синхронізує DOM лише коли external value справді
змінився, а не після власного input. Paste має окрему sanitized HTML/plain
text гілку. Draft зберігається локально до явного save.

**Перевірка.** Набір тексту в середині абзацу, форматування, paste з Google
Docs/ChatGPT, undo/redo та реальний Android Telegram WebView.

### DOMAIN-06 · Редактор дозволяє зберегти непрохідний урок — P1

**Виправлення.** Контракти кожного з 10 block types мають semantic validation.
Save виконується лише після перевірки всього ordered draft. Preview
використовує той самий normalized contract, що й student renderer.

**Перевірка.** Для кожного типу є valid/invalid fixtures; server повторно
валідує навіть якщо frontend validation обійдено.

### DOMAIN-07 · Редагування уроку під час проходження змінює результат — P1

**Виправлення.** На start attempt створюється content revision/snapshot scored
blocks. Finish рахується проти цієї revision. Teacher save використовує
optimistic `contentRevision`, щоб два tabs не затерли один одного.

**Перевірка.** Teacher змінює урок після student start; поточна спроба має
стабільний знаменник, наступна бачить нову revision.

---

## 5. Drip, cooldown і прогрес

### DOMAIN-08 · Drip реалізований у кількох endpoint по-різному — P1

**Проблема.** Course path, active lesson і finish містили власні варіанти
правила, тому легко виправити один і залишити інший.

**Виправлення.** Одна `DripPolicy` у domain package:

- перший урок доступний;
- наступний — через 24 години після завершення;
- teacher preview відкриває все без запису progress;
- правило працює в межах поточного course;
- усі endpoint отримують однаковий derived status.

**Перевірка.** Один набір policy tests використовується repositories/API flow;
окремо перевіряється перехід між двома курсами.

### DOMAIN-09 · Retake cooldown можна обійти або випадково подовжити — P1

**Виправлення.** Одна `RetakePolicy` із server Clock. Finish existing attempt
перевіряє останній `completed_at`; teacher preview не створює completion.
Повторне проходження після 24 годин не повинно повторно заблокувати вже
відкритий наступний урок.

**Перевірка.** 23:59:59, рівно 24:00:00, після 24 годин, teacher preview,
повтор старого уроку.

### DOMAIN-10 · Enrollment UPDATE повідомляє успіх без рядка — P1

**Виправлення.** Enrollment command перевіряє course, виконує upsert за
перевіреним Telegram identity/internal user, повторно читає запис у тій самій
транзакції та повертає актуальний ресурс. Нуль змінених рядків без валідного
upsert — помилка.

**Перевірка.** Новий user, existing user, invalid course, concurrent repeat.

### API-01 · Client передає `needsTeacherReview`, score або time як істину — P1

**Виправлення.** Homework presence визначається з lesson snapshot; score — з
answers; time spent — server timestamp із bounded client telemetry лише для
аналітики. Client intent не визначає domain result.

**Перевірка.** Підміна body не змінює score, homework status або unlock.

---

## 6. Homework

### UI-03 · Умова ДЗ зникає після натискання кнопки — P1

**Проблема.** Учень переходить на форму, але не бачить, що саме треба зробити.

**Виправлення.** Homework endpoint і screen завжди повертають/показують prompt
над відповіддю. Route може відкритися напряму або після refresh без залежності
від пам’яті попереднього screen.

**Перевірка.** Вхід із results, lesson card, direct URL і refresh показує ту
саму умову зверху.

### DOMAIN-11 · Стани ДЗ суперечать один одному — P1

**Проблема.** Legacy використовував `none`, `pending`, `graded`, інколи
`submitted` або `approved` у progress.

**Виправлення.** Domain contract має `none / pending / graded`; legacy adapter
мапить `submitted → pending`. Lesson path отримує derived homework summary з
submission, а не вгадує лише за `user_progress.homework_status`.

**Перевірка.** Усі legacy statuses мають однозначний UI state; відсутнє ДЗ
відрізняється від незданого.

### DOMAIN-12 · Повторна здача створює дублікати або губить попередню — P1

**Виправлення.** Спочатку інвентаризувати duplicates. Продуктовий контракт
визначає одну актуальну submission і історію лише якщо вона реально потрібна.
Mutation має idempotency key; metadata й asset reference записуються разом.

**Перевірка.** Double tap, timeout/retry і повторний upload не створюють
випадкових рядків або orphan assets.

### SEC-07 · Upload довіряє filename/MIME або перевищує ліміти — P0

**Виправлення.** Обмежити розмір до погоджених 20 МБ, перевіряти allowlist MIME
і magic bytes, генерувати власний asset ID, не виконувати файл, не віддавати
його як HTML, застосувати rate limit. Temporary files очищаються в `finally`.

**Перевірка.** Oversize, renamed executable, подвійне розширення, порожній
файл, interrupted upload.

---

## 7. Flashcards і SRS

### DOMAIN-13 · SRS-алгоритм розкиданий по route/UI — P1

**Виправлення.** Одна pure SRS policy із правилами:

- `0 → 1 → 3 → round(interval × ease)`;
- ease стартує з `2.5`;
- correct: `+0.1`;
- wrong: `-0.2`, але не нижче `1.3`;
- wrong скидає interval у 0;
- next review рахується server Clock.

Repository атомарно записує повернений policy result.

**Перевірка.** Довгі correct/wrong sequences, ease floor, timezone boundary,
повтор запиту.

### UI-04 · Неправильна картка не повертається в поточну сесію — P1

**Виправлення.** Session feature має queue із card IDs; wrong card додається в
кінець поточної черги один раз за цикл. Server SRS і локальна session queue —
окремі відповідальності.

**Перевірка.** Wrong → інші картки → повтор цієї картки; відсутній нескінченний
дублікат при швидких кліках.

### API-02 · Study list показує картки недоступного уроку — P1

**Виправлення.** Query join використовує current course та derived доступність
уроків. Teacher preview не створює student SRS rows.

**Перевірка.** Locked, available, completed lessons і зміна course.

---

## 8. API та frontend-надійність

### API-03 · Response-помилка потрапляє в UI як успішні дані — P1

**Проблема.** Об’єкт `{error}` міг опинитися в state, після чого `.map`
падав і весь застосунок зникав.

**Виправлення.** Один API client відхиляє всі non-2xx, перевіряє response Zod
schema і повертає typed result. Feature ніколи не записує unknown JSON у
списковий state.

**Перевірка.** 401, 403, 404, 500, invalid JSON, wrong response shape, timeout
і offline мають контрольований error state.

### UI-05 · Async Telegram identity захоплена до готовності — P1

**Проблема.** Effects із порожніми dependencies могли назавжди використати
placeholder user або не виконатися після `ready`.

**Виправлення.** Auth bootstrap є окремою state machine. Предметні query
enabled лише після authenticated state; їхні cache keys не залежать від
frontend user ID. Screen не читає Telegram SDK напряму.

**Перевірка.** Повільний initData, delayed SDK, auth retry, logout/reopen,
foreground після паузи.

### UI-06 · Порожній/білий екран при помилці — P1

**Виправлення.** Кожен query-driven screen має loading, empty, error і success.
Root error boundary показує request ID та retry, але не маскує локальні
помилки. Порожній lesson content має контрольоване пояснення і доступну дію.

**Перевірка.** Screenshot/flow tests усіх чотирьох станів; route не лишається
без тексту й дії.

### UI-07 · Android dark mode робить текст невидимим — P1

**Виправлення.** Усі background/text/border кольори походять із design tokens,
є explicit `color-scheme`, inputs/buttons не покладаються на system defaults.
Перевіряти Telegram Android у світлій і системній темі.

**Перевірка.** Visual snapshots і real-device smoke для Button, Input, Modal,
RichText та disabled states.

### API-04 · Endpoint повертає різні форми залежно від гілки — P1

**Виправлення.** Shared Zod request/response contracts. Список завжди має
`items`; optional/null policy однакова; dates normalized. Contract tests
перевіряють кожну status branch.

### API-05 · Запит зависає або старий response перезаписує новий — P2

**Виправлення.** API client підтримує timeout і AbortSignal. TanStack Query
володіє server cache; route change скасовує непотрібні запити. Mutation
інвалідує лише визначені keys.

**Перевірка.** Slow network, rapid route changes, repeated search, offline →
online.

---

## 9. Чат, розсилка й медіа

### SEC-08 · Sender/receiver можна підмінити — P0

**Виправлення.** Student sender завжди з RequestContext, receiver — server-side
teacher identity. Teacher endpoint приймає student target, але перевіряє role
і існування. Message queries scoped за current context.

**Перевірка.** Student не читає чужий conversation і не надсилає від імені
teacher.

### DOMAIN-14 · `scheduled_at` ігнорується — P1

**Виправлення.** Student query містить `scheduled_at <= serverNow`; direct ID
також перевіряє час. `viewed` можна записати лише для вже доступного message.

**Перевірка.** До, рівно в момент і після schedule; timezone conversion;
спроба відмітити майбутнє повідомлення.

### DATA-08 · Завантаження на ефемерний диск зникають — P1

**Виправлення.** Диск використовується лише як temporary multipart buffer.
Довготривале джерело — `app_assets` через MediaRepository на першому етапі.
Успішний response відправляється лише після durable save.

**Перевірка.** Restart/deploy simulation не втрачає asset; failure очищає temp
і не лишає submission з мертвим URL.

---

## 10. 3D-сцена, модель та переходи

### 3D-01 · Самописний renderer не підтримує фінальну GLB — P1

**Проблема.** Поточний експериментальний v3 loader стискає статичну геометрію,
але не зберігає Blender materials, skeleton та animation clips.

**Виправлення.** Перейти на Three.js + React Three Fiber + Drei. Один Canvas
живе в App shell; `useGLTF` кешує фінальну модель; один AnimationMixer керує
actions. Старий `.msh` pipeline не розширювати паралельно.

**Перевірка.** GLB contract test бачить до 10 bones, materials і всі required
clips; модель не remount-иться при route change.

### 3D-02 · Модель моргає/зникає через remount або порожній останній кадр — P1

**Виправлення.** У R3F модель завантажується один раз і лишається mounted.
Actions crossfade на стабільному object. До готовності GLB використовується
явний fallback, а не asset із прозорим фінальним кадром.

**Перевірка.** 50 переходів між route без flash, повторного network load або
зникнення персонажа.

### 3D-03 · Білий силует стає сірим або прозорим — P1

**Виправлення.** MaterialController керує одним `silhouetteMix`; у кінці mix
ігнорує albedo, texture й lighting та видає чистий білий opaque output.
Skinned mesh лишається тим самим. Transparent/blending не вмикається, якщо це
не потрібно матеріалу.

**Перевірка.** Білий колір на різних фонах, усі Blender materials, рука біля
камери, low/high quality tiers.

### 3D-04 · Перехід назад спавнить персонажа — P1

**Виправлення.** AppNavigator і SceneController використовують одну state
machine `idle → preparing → exiting → covered → route commit → entering →
idle`. Back проходить ті самі cue та anchor trajectories у зворотній
семантиці. Route commit відбувається тільки під повним cover.

**Перевірка.** Forward/back, system back, double tap, interrupted preload,
route error і reduced-motion fallback.

### 3D-05 · Низький FPS, розмита або прозора сцена — P1

**Виправлення.**

- один Canvas і одна модель;
- DPR cap 1–1.5 mobile;
- 25–30k triangle budget, до 10 bones, 4 weights;
- texture budget переважно 1024;
- мінімум transparent overdraw і без realtime shadow map за замовчуванням;
- максимум два fullscreen passes;
- quality tier визначається після warmup один раз, а не стрибає;
- production diagnostics вимірюють GPU, DPR, draw calls і frame time;
- render loop спрощується, коли WebView hidden.

**Перевірка.** Cold load, 30 секунд idle, перехід рукою й урок на середньому
Android; ціль 60 FPS, контрольований стабільний fallback 30 FPS.

### 3D-06 · Сторінки напряму керують камерою/кістками — P1

**Виправлення.** Імпорт `three`, Fiber і Drei дозволений лише в `scene`.
Screens передають семантичний намір: route, transition preset, mood. Blender
clip, camera rig, silhouette й shader parameters належать SceneController.

**Перевірка.** Boundary lint/import test; feature tests запускаються без WebGL.

### 3D-07 · 3D блокує функціональність на слабкому пристрої — P0

**Виправлення.** Якщо WebGL, GLB або shader не готові, AppNavigator виконує
короткий DOM curtain transition. Урок, auth і API не залежать від успішного
рендеру сцени. `prefers-reduced-motion` має той самий гарантований шлях.

**Перевірка.** WebGL disabled/context lost/model 404 — усі маршрути й дії
залишаються доступними.

---

## 11. Тести, sandbox і deploy

### OPS-01 · Тест проходить із хибної причини — P0

**Проблема.** Legacy flow міг натиснути не той елемент, а потім знайти текст,
який був і на попередній сторінці.

**Виправлення.** E2E assert перевіряє route, semantic state і server/DB effect.
Selectors — за роллю/стабільним test ID, не випадковим текстом. Для mutation
перевіряється response і фактичний sandbox row.

**Перевірка.** Навмисне зламана дія мусить зробити тест червоним.

### OPS-02 · Тести можуть торкнутися production — P0

**Виправлення.** Test environment guard дозволяє лише local SQLite або
позначений sandbox Turso URL. Production token недоступний CI test job.
Sandbox seed працює окремою командою, а не API route.

**Перевірка.** Підставлений production URL зупиняє тест до першого query.

### OPS-03 · Немає перевіреного rollback — P0

**Виправлення.** Перед write cutover:

1. створити production backup;
2. відновити його в окреме середовище;
3. пройти core flows на відновленій копії;
4. мати попередній deploy artifact;
5. використовувати additive migrations і write flags по модулю;
6. відрепетирувати вимкнення нового writer.

**Перевірка.** Документований rehearsal із часом відновлення і контрольними
hash/counts.

### OPS-04 · Зміна одного модуля ламає інший — P1

**Виправлення.** Enforce dependency boundaries:

- screens → features → contracts/domain;
- routes → services → policies → repositories;
- scene не імпортується feature-модулями;
- SQL лише repositories;
- API лише shared client;
- contracts мають compatibility tests.

**Перевірка.** Import-boundary CI, unit/contract/integration/E2E pyramid і
change-impact checklist для кожного PR.

### OPS-05 · Production deploy не відповідає commit/build — P1

**Виправлення.** Build artifact створюється CI з конкретного commit SHA;
promotion не перебудовує інший код. Release notes містять DB mode, enabled
flags і migration version. Smoke-tests запускаються після deploy до write
enablement.

---

## 12. Порядок виправлення

### Хвиля 0 — нічого не записуємо

1. Rotate exposed secrets.
2. Зафіксувати production inventory та backup/restore.
3. Створити sandbox-копію.
4. Увімкнути test environment guard.

**Вихід:** production не змінений, sandbox відтворюваний.

### Хвиля 1 — безпека й контракти

1. Telegram auth і RequestContext.
2. Дві ролі та teacher capabilities.
3. Shared API/error schemas.
4. Прибрати userId/role/score trust.

**Вихід:** новий read-only API не має IDOR/admin hole.

### Хвиля 2 — adapters і domain policies

1. Legacy user/course/content adapters.
2. Lesson block validation/sanitization.
3. Scoring, drip, cooldown, SRS pure policies.
4. Contract і table-driven tests.

**Вихід:** старий контент читається без зміни БД; правила перевірені.

### Хвиля 3 — контрольовані записи в sandbox

1. Attempts/answers/progress transactions.
2. Homework/media transactions.
3. SRS canonical ID migration rehearsal.
4. Chat/photo security та scheduling.

**Вихід:** повні student↔teacher flows у sandbox.

### Хвиля 4 — Three.js і UX

1. Фінальна GLB та asset contract.
2. Один R3F Canvas і AnimationMixer.
3. Silhouette та forward/back SceneTransition.
4. Mobile performance/reduced-motion/WebGL fallback.
5. Loading/empty/error states і real Telegram tests.

**Вихід:** функціональність не залежить від 3D, а сцена проходить budget.

### Хвиля 5 — cutover

1. Повний regression на production snapshot.
2. Backup + rollback rehearsal.
3. Deploy у read-only режимі.
4. Write flags по одному модулю.
5. Моніторинг request errors, latency, auth failures і data invariants.

**Вихід:** новий production можна відкотити без втрати даних.

---

## 13. Окремі рішення власника даних

Ці пункти **не виправляються автоматично**:

- що робити з SRS rows під `demo-user`;
- чи залишати 49 legacy score = 10 без змін;
- чи очищати 17 orphan assets;
- чи видаляти/змінювати 4 заблокованих users;
- чи переносити media з base64 у зовнішнє storage;
- чи потрібна історія кількох homework submissions.

До рішення вони лишаються як є, а новий код лише коректно їх читає або
ізолює. Жодних припущень про власника даних.

---

## 14. Definition of fixed

Проблема вважається виправленою лише коли одночасно виконано все:

1. Є одна канонічна policy/contract, а не локальний patch в одному screen.
2. Є regression test, який падає на старій поведінці.
3. Є integration/E2E перевірка реального користувацького наслідку.
4. Для data change є backup, sandbox rehearsal і verification manifest.
5. Помилка має контрольований UI state, а не blank screen.
6. Виправлення не розширює доступ і не довіряє frontend.
7. Для 3D є fallback, тому декоративний шар не блокує навчання.
8. Production deployment має відомий rollback.
