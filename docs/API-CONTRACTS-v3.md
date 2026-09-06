# English with Coffee — API та backend-контракти

Статус: специфікація до реалізації. Код і production-дані цим документом не
змінюються.

Цей документ деталізує backend-частину [ARCHITECTURE-v3.md](ARCHITECTURE-v3.md):
які запити існують, хто їх може викликати, що вони повертають і де проходить
межа між legacy-базою та новою предметною моделлю.

---

## 1. Загальні правила API

### Базовий URL

Усі нові запити живуть під `/api/v2`. Старі endpoint не переписуються в один
день і не змішуються з новими контрактами.

### Ідентичність

У student-запитах ніколи немає `userId` у path, query або body. Користувач
визначається сервером із перевіреного Telegram `initData`.

Teacher-запити можуть містити `studentId` лише як ціль ресурсу, який викладач
має право бачити. Сервер все одно перевіряє, що такий учень існує і належить
до дозволеного контексту викладача.

### Headers

Кожен захищений запит передає:

- raw Telegram `initData` у спеціальному authorization header;
- `Content-Type`, якщо є тіло;
- optional `Idempotency-Key` для повторюваних mutation;
- optional client request ID для діагностики.

Raw `initData` не зберігається в localStorage, URL або базі. Backend перевіряє
підпис, строк придатності й лише після цього створює RequestContext.

### Формат даних

- дати — UTC ISO 8601;
- тривалість — ціле число секунд;
- ідентифікатори — числові або чітко позначені opaque strings, без змішування;
- порожній список — `[]`, не `null` і не відсутнє поле;
- optional значення мають однакове правило `null`/відсутній у всіх endpoint;
- великі тексти та media не дублюються в кожній відповіді без потреби.

### Методи

- `GET` — читання без запису та побічних ефектів;
- `POST` — команда або створення ресурсу;
- `PATCH` — часткова зміна конкретного ресурсу;
- `DELETE` — лише погоджене teacher-видалення, з перевіркою залежностей.

GET не виконує auto-unlock, backfill, sync прогресу або створення користувача.

---

## 2. Response і error contracts

### Успішна відповідь

Кожен endpoint має заздалегідь визначену response-схему. Не можна повертати
сьогодні масив, а завтра об'єкт із полем `data` залежно від гілки коду.

Спискові ресурси мають стабільну форму:

- `items` — масив ресурсів;
- `nextCursor` — cursor або `null`, якщо сторінка остання;
- `total` — лише якщо його справді потрібно рахувати.

Одиночний ресурс повертається без випадкових legacy-полів, які UI не очікує.

### Помилка

Усі помилки мають однакову форму:

| Поле | Призначення |
| --- | --- |
| `code` | стабільний машинний код |
| `message` | безпечний текст для користувача |
| `requestId` | пошук події в логах |
| `fields` | помилки окремих полів, якщо є |
| `retryAfter` | секунди до повтору для cooldown/rate-limit |

Основні коди:

- `UNAUTHENTICATED` — немає або не пройшов Telegram auth;
- `AUTH_EXPIRED` — initData прострочений;
- `FORBIDDEN` — роль не має capability;
- `BLOCKED` — учневі закрито доступ;
- `NOT_FOUND` — ресурс не існує або не належить користувачу;
- `VALIDATION_FAILED` — тіло/query/params не відповідають схемі;
- `CONTENT_INVALID` — legacy або новий урок непрохідний;
- `CONFLICT` — суперечливий стан або повторна команда;
- `COOLDOWN` — урок ще не можна перепройти;
- `PAYLOAD_TOO_LARGE` — перевищено ліміт файлу/запиту;
- `RATE_LIMITED` — надто багато запитів;
- `INTERNAL` — неочікувана помилка.

SQL, stack trace, Telegram bot token, file path і внутрішні ID не потрапляють
у `message`.

---

## 3. Auth і поточний користувач

### `GET /api/v2/me`

Повертає серверний identity snapshot:

- внутрішній user ID, який дозволено використовувати лише у внутрішніх
  операціях;
- Telegram display name і username;
- роль `student` або `teacher`;
- `isBlocked`;
- enrollment summary;
- доступні capabilities.

Legacy `role = admin` нормалізується до `teacher` на adapter boundary. Новий
API не повертає `admin` як доменну роль і не записує його назад.

Якщо користувача ще немає, окрема команда sync створює його лише після
успішної Telegram-перевірки. GET ресурсів не створює користувача мовчки.

### Немає `POST /sync` із довільним user ID

Якщо потрібна синхронізація Telegram profile, вона є частиною auth bootstrap і
бере дані тільки з перевіреного payload. Role, blocked state та enrollment з
frontend не приймаються.

---

## 4. Курси та enrollment

### Student

`GET /api/v2/courses` — доступні курси для вибору.

`GET /api/v2/me/course` — поточний курс, summary прогресу і наступна дія.

`POST /api/v2/me/enrollment`

Тіло містить лише `courseId`. Сервер перевіряє курс, записує enrollment у
транзакції та повертає актуальний enrollment. Telegram ID і user ID беруться
з RequestContext.

`GET /api/v2/me/course/path`

Повертає уроки поточного курсу з view state:

- `locked`;
- `available`;
- `completed`;
- `unlocksAt`;
- `completedAt`;
- homework summary;
- `hasHomework`.

Доступність після `unlocksAt` обчислюється без запису під час GET. Серверний
Clock є єдиним джерелом поточного часу.

### Teacher

`GET /api/v2/teacher/courses` — список курсів для кабінету.

`POST /api/v2/teacher/courses` — створення курсу.

`PATCH /api/v2/teacher/courses/:courseId` — зміна метаданих.

`DELETE /api/v2/teacher/courses/:courseId` — лише якщо залежності перевірені;
за замовчуванням контент не видаляється каскадно мовчки.

Legacy `levels` адаптується до доменного `course`; назва базової таблиці не
протікає у frontend.

---

## 5. Уроки та спроби

### Читання уроку

`GET /api/v2/lessons/:lessonId`

Backend перевіряє enrollment, drip і teacher preview. Відповідь містить:

- metadata уроку;
- нормалізовані lesson blocks;
- словник/flashcard summary, якщо він потрібен екрану;
- homework prompt summary;
- version/content revision для захисту від збереження поверх нової версії.

Учень не отримує locked lesson лише тому, що знає його числовий ID.

### Початок спроби

`POST /api/v2/lessons/:lessonId/attempts`

Створює attempt після перевірки доступу. Повертає `attemptId`, snapshot
scored blocks і час старту. Snapshot потрібен, щоб редакція уроку посеред
проходження не змінила знаменник уже початої спроби.

### Відповідь на вправу

`POST /api/v2/lesson-attempts/:attemptId/answers`

Команда містить block ID, відповідь і client event ID. Сервер перевіряє:

- attempt належить поточному user;
- block входить у snapshot;
- це перша відповідь цього block;
- формат відповіді відповідає типу block.

Повтор із тим самим event ID є idempotent. Друга різна відповідь на той самий
block не замінює першу.

### Завершення

`POST /api/v2/lesson-attempts/:attemptId/finish`

Сервер сам рахує correct, wrong, skipped і score. Клієнтський `score` не
приймається як джерело істини.

В одній транзакції:

1. attempt переходить у finished;
2. зберігається результат;
3. оновлюється `user_progress`;
4. створюється наступний unlock;
5. flashcards уроку стають доступними для SRS.

Повторне натискання finish повертає попередній результат і не створює другий
прогрес або другий unlock.

### Teacher editor

`GET /api/v2/teacher/lessons/:lessonId`

`PATCH /api/v2/teacher/lessons/:lessonId`

`PUT /api/v2/teacher/lessons/:lessonId/blocks`

Оновлення блоків передає повний упорядкований draft і `contentRevision`.
Server відхиляє конфлікт revision, щоб один tab не затер зміни іншого.

Перед збереженням кожен block проходить type-specific validation. Зберігати
урок із непрохідним quiz/fill_blank не можна.

---

## 6. Нормалізація lesson content

Legacy `lesson_blocks.content` — JSON-текст, тому repository не повертає його
напряму. Потік такий:

1. SQL row читається legacy repository.
2. JSON parse виконується з контрольованою помилкою.
3. Adapter визначає discriminated union за `type`.
4. Rich text проходить allowlist sanitizer без атрибутів.
5. Legacy quirks нормалізуються:
   - один або багато `_` означають пропуск;
   - пробіли навколо correct answer і options не впливають на порівняння;
   - порожні quiz options відкидаються з display-моделі;
   - порожній mascot tip стає content issue;
   - невідомий type не валить весь response.
6. Доменний object перевіряється response schema.

Renderer отримує лише валідний domain DTO. Він не знає, що `levels` — стара
назва courses, і не парсить JSON у JSX.

---

## 7. Homework

### Student

`GET /api/v2/lessons/:lessonId/homework`

Повертає prompt, accepted submission format, current status і останню здачу.
Умова завжди приходить разом із формою, тому її не треба пам’ятати з уроку.

`POST /api/v2/lessons/:lessonId/homework`

Multipart metadata проходить перевірку MIME, розміру й текстових полів. Команда
має idempotency key. Результат — актуальна submission, а не лише boolean.

`GET /api/v2/me/homework` — список власних робіт для Home/Profile.

### Teacher

`GET /api/v2/teacher/homework?status=pending`

`GET /api/v2/teacher/homework/:submissionId`

`POST /api/v2/teacher/homework/:submissionId/grade`

Оцінка, feedback і статус перевіряються разом. Grading дозволений лише
teacher. Повторна команда з тим самим idempotency key безпечна.

Legacy `submitted` при читанні мапиться на `pending`; у нових відповідях
існують лише `none`, `pending`, `graded`.

---

## 8. Flashcards, dictionary і SRS

### Student

`GET /api/v2/me/dictionary` — слова з lesson title, translation і learning
state. Дані фільтруються за внутрішнім user ID.

`GET /api/v2/me/study-session?limit=20` — до 20 карток у пріоритеті:
невидані, прострочені, потім інші.

`POST /api/v2/me/flashcards/:flashcardId/review`

Тіло містить тільки результат відповіді та idempotency key. Backend читає
попередній стан, викликає чисту SRS policy й атомарно записує новий стан.

Нова система всюди використовує numeric internal user ID.

### Legacy SRS migration

У старій таблиці `user_flashcard_progress.user_id` текстовий і часто є
Telegram ID. Repository має тимчасовий compatibility reader, але writer
нового модуля працює через canonical internal ID.

Під час міграції:

- однозначні Telegram ID мапляться до `users.id`;
- `demo-user` не приписується випадковому учневі;
- orphan rows потрапляють у звіт;
- до затвердження рішення legacy прогрес не перезаписується.

---

## 9. Чат і photo messages

### Чат учня

`GET /api/v2/me/chat`

`POST /api/v2/me/chat/messages`

`POST /api/v2/me/chat/read`

Учень може читати й писати лише власний діалог із teacher. Сервер не приймає
sender ID з body.

### Чат teacher

`GET /api/v2/teacher/chat/conversations`

`GET /api/v2/teacher/chat/conversations/:studentId`

`POST /api/v2/teacher/chat/conversations/:studentId/messages`

`POST /api/v2/teacher/chat/read`

Для чату на першому етапі достатньо polling із cursor. WebSocket не додаємо,
поки фактична потреба не підтверджена.

### Фото-розсилка

`GET /api/v2/me/photo-messages`

Повертає лише повідомлення, для яких `scheduledAt <= serverNow` і які доступні
цьому учню.

`POST /api/v2/teacher/photo-messages`

`DELETE /api/v2/teacher/photo-messages/:messageId`

`POST /api/v2/me/photo-messages/:messageId/viewed`

Фільтр `scheduled_at` виконується на server Clock під час читання. Запланована
фотографія не повинна з'являтися раніше, навіть якщо frontend знає її ID.

---

## 10. Media

`GET /api/v2/assets/:assetId` — перевіряє існування та дозволений контекст.

`POST /api/v2/teacher/assets` — upload лише для teacher, з обмеженнями MIME,
розміру і rate limit.

На першому етапі `app_assets` залишається compatibility storage: repository
читає base64 із БД і не протікає у frontend. Перехід на object storage — окреме
рішення після вимірювання лімітів deployment, не прихована міграція.

Upload не пише файл на ефемерний диск як єдине джерело. Тимчасовий multipart
файл видаляється після успішного збереження або невдалої операції.

---

## 11. Repository mapping до старої БД

| Domain | Legacy tables | Особливість |
| --- | --- | --- |
| User | `users` | role `admin` → domain `teacher` |
| Course | `levels` | UI/API більше не бачить назву `level` |
| Lesson | `lessons` | `level_id` → `courseId` |
| Lesson content | `lesson_blocks` | JSON text → typed union |
| Progress | `user_progress` | numeric `users.id`, drip timestamps |
| Flashcard | `flashcards` | lesson relation |
| SRS | `user_flashcard_progress` | legacy text ID → canonical numeric ID |
| Homework | `homework_submissions` | legacy status normalization |
| Media | `app_assets` | base64 compatibility adapter |
| Chat | `messages` | sender/receiver scoped by context |
| Broadcast | `photo_messages`, views | scheduled filtering server-side |

SQL знають лише repositories. Якщо один запит потребує п'ять таблиць, це
дозволено в одному repository method, але не розкривається service як SQL.

---

## 12. Транзакційні межі

Транзакція обов’язкова для:

- enrollment плюс перевірка актуального курсу;
- finish lesson attempt, progress і наступного unlock;
- SRS review і оновлення лічильників;
- homework submission metadata та asset reference;
- teacher grading і progress homework status;
- створення повідомлення та необхідного read-state.

Read operations можуть використовувати окремі запити, але view model не має
збирати напівактуальні дані так, щоб показувати учневі чужий або старий стан.

Після network retry команда з тим самим idempotency key повертає попередній
результат. Команди безпечні для повтору лише після explicit перевірки.

---

## 13. Порядок реалізації backend

1. `contracts` і error model без БД.
2. Telegram verification і RequestContext.
3. Read-only repositories для users/courses/lessons.
4. Content adapters і runtime validation.
5. Course path, drip і teacher preview як чисті policies.
6. Attempts/scoring/progress у sandbox.
7. Homework і media.
8. SRS canonical ID і dictionary.
9. Chat та photo messages.
10. Teacher editor, student management і statistics.
11. Production cutover по одному модулю.

Після кожного кроку старі endpoint не видаляються автоматично, а нова група
покривається contract + integration + E2E тестами.

---

## 14. Заборонені запити й рішення

- `/api/.../:userId` для student-ресурсів;
- `score` у body як довірений результат;
- `role` або `isAdmin` із frontend;
- SQL у React, route або shader code;
- автоматичне створення user під час довільного GET;
- auto-unlock через UPDATE у GET;
- silent fallback internal ID на Telegram ID;
- збереження raw initData;
- безмежний upload або довіра до MIME лише з filename;
- зміна legacy rows «для зручності» без migration manifest;
- видалення старого endpoint до завершення нового E2E flow.

