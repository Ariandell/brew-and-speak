# English with Coffee — цільова архітектура v3

Статус: архітектурне рішення до початку повного переписування.

Цей документ визначає межі модулів, правила залежностей, безпечний шлях до
старої бази та роль глобальної 3D-сцени. Він не описує зовнішній вигляд
окремих сторінок і не є планом міграції production-даних без окремого
підтвердження.

---

## 1. Основне рішення

Новий застосунок будується як **модульний моноліт у monorepo**:

- один React-застосунок для учня й викладача;
- один Express API;
- одна спільна бібліотека API-контрактів;
- одна чиста бібліотека бізнес-правил;
- одна постійна Three.js / React Three Fiber сцена;
- одна існуюча Turso-база, доступ до якої можливий лише через backend.

Мікросервіси тут не потрібні: продукт і команда замалі для їхньої операційної
ціни. Модульний моноліт дає ті самі кордони в коді, але одну збірку, прості
транзакції та значно безпечніше розгортання.

### Потік залежностей

`screens → features → domain/contracts`

`API routes → application services → domain → repositories → libSQL`

`screens → navigation facade → SceneController + router`

Зворотні залежності заборонені. Домен не знає про React, Express, Three.js,
HTTP або конкретну базу.

### П’ять незмінних правил

1. Клієнт не визначає особу, роль, оцінку, drip-стан чи SRS-інтервал.
2. Екран не виконує HTTP-запити напряму й не керує Three.js.
3. GET-запит нічого не записує в базу.
4. Запуск сервера ніколи не виконує `ALTER`, backfill або очищення даних.
5. Зміна маршруту відбувається через навігаційний фасад, навіть якщо перехід
   візуально миттєвий.

---

## 2. Структура репозиторію

Увесь новий код живе всередині `v3`, доки не завершений cutover. Старий
застосунок залишається незалежною точкою відкоту.

```text
v3/
  apps/
    web/
      public/
        models/
        textures/
        icons/
      src/
        app/
          bootstrap/
          providers/
          router/
          error-boundary/
        screens/
          system/
          student/
          teacher/
        features/
          auth/
          courses/
          lessons/
          homework/
          flashcards/
          progress/
          chat/
          media/
          profile/
          teacher/
        scene/
          canvas/
          character/
          animation/
          materials/
          background/
          transitions/
          quality/
          controller/
        navigation/
        shared/
          api/
          ui/
          forms/
          hooks/
          lib/
          styles/
          assets/
        testing/
    api/
      src/
        app/
          create-server/
          middleware/
          errors/
          logging/
        modules/
          auth/
          users/
          courses/
          lessons/
          progress/
          homework/
          flashcards/
          chat/
          media/
          teacher/
        infrastructure/
          db/
          telegram/
          uploads/
          ai/
          clock/
        testing/
  packages/
    contracts/
      auth/
      courses/
      lessons/
      homework/
      flashcards/
      chat/
      common/
    domain/
      identity/
      permissions/
      lessons/
      scoring/
      drip/
      homework/
      srs/
    test-fixtures/
  migrations/
    sql/
    manifests/
    verification/
  docs/
    decisions/
    api/
    data/
    scene/
```

### Чому саме так

- `apps/web` і `apps/api` можна збирати та тестувати незалежно.
- `packages/contracts` є єдиним джерелом форми HTTP-даних.
- `packages/domain` містить правила, через які раніше виникали регресії:
  оцінювання, drip, cooldown, SRS і дозволи.
- `scene` є підсистемою застосунку, а не набором ефектів усередині сторінок.
- `migrations` не імпортується сервером і запускається лише явно.

---

## 3. Межі відповідальності frontend

### App shell

Відповідає за запуск Telegram SDK, авторизацію, Router, один глобальний Canvas,
error boundary, провайдер серверного кешу та глобальні системні стани.

App shell не містить бізнес-логіки уроку і не знає структуру блоків.

### Screens

Screen — композиція готових feature-компонентів під конкретний маршрут.

Screen може:

- отримати route-параметри;
- викликати публічні hooks feature-модуля;
- розкласти UI-компоненти;
- попросити навігацію або сценічний настрій.

Screen не може:

- викликати `fetch`;
- читати Telegram user ID напряму;
- обчислювати оцінку, доступ до уроку чи роль;
- імпортувати Three.js або GLB;
- міняти shader uniform чи кістку моделі;
- парсити legacy JSON.

### Features

Feature володіє одним користувацьким сценарієм: проходження уроку, здача ДЗ,
сесія карток, чат або редагування уроку. Всередині є запити, локальний стан,
компоненти сценарію та адаптація DTO до view model.

Публічна поверхня feature мала: один-два компоненти, hooks і типи намірів.
Внутрішні файли іншими features не імпортуються.

### Shared UI

Містить лише візуальні примітиви: Button, Surface, Input, Select, Tabs,
Progress, Modal, Sheet, EmptyState, Skeleton, Toast, RichText та системні
іконки.

UI-компонент не знає, що таке урок, студент або flashcard. Якщо компонент
містить предметні слова чи правила, він належить feature, а не `shared/ui`.

Кожен компонент має визначені стани: default, pressed, focus-visible,
disabled, loading, error. Кольори задаються токенами явно, включно з текстом,
щоб Android dark mode не підміняв їх.

### Стан застосунку

Використовуються три різні види стану, які не змішуються:

| Вид | Власник | Приклади |
| --- | --- | --- |
| Серверний | TanStack Query | курс, уроки, ДЗ, картки, чат, профіль |
| Route-стан | React Router | поточний екран, `lessonId`, повернення назад |
| Короткочасний UI/scene | локальний state або вузький store | відкрита шторка, активний перехід, настрій маскота |

Дані API не дублюються у глобальний store. Форми тримають чернетку локально;
після mutation кеш інвалідується через ключі feature-модуля.

`localStorage` не є джерелом прогресу, ролі чи ідентичності. Його можна
використовувати лише для нешкідливих налаштувань пристрою.

### API-клієнт

Є один транспортний клієнт. Він додає Telegram `initData`, trace ID, timeout і
AbortSignal; розбирає JSON; перевіряє response-схему; перетворює неуспішну
відповідь на типізовану помилку.

Feature описує endpoint через contracts, але не вирішує, як працює HTTP.
Тіло помилки ніколи не потрапляє в UI як начебто успішний масив або об’єкт.

---

## 4. Карта екранів

### Системні стани

Це окремі контрольовані стани App shell, а не випадкові порожні сторінки:

1. Bootstrap / перевірка Telegram-середовища.
2. Welcome.
3. Onboarding.
4. Вибір курсу.
5. Доступ заблоковано.
6. Немає мережі / помилка запуску з кнопкою повтору.

### Учень

1. **Головна** — одна наступна дія, активний урок, статус ДЗ, серія та вхід у
   картки.
2. **Шлях курсу** — усі уроки з `locked / available / completed` та часом
   відкриття.
3. **Урок** — послідовність матеріалів і вправ.
4. **Результати уроку** — correct, wrong, skipped, score та дія щодо ДЗ.
5. **Домашнє завдання** — умова завжди зверху; текст, файл, поточна здача,
   оцінка і коментар.
6. **Флешкартки** — SRS-сесія до 20 карток.
7. **Словник** — слова курсу та їхній стан.
8. **Розклад / активність** — календар і історія, без дублювання головної.
9. **Чат** — діалог із викладачем.
10. **Профіль і налаштування** — дані користувача, статистика, досягнення,
    зміна курсу.

Результати уроку можуть бути route-модалкою, але мають власний route-стан,
щоб refresh або back не губили результат.

### Викладач

1. **Кабінет** — черга роботи та коротка статистика.
2. **Курси**.
3. **Уроки курсу**.
4. **Конструктор уроку** — блоки, порядок, rich text, словник і preview.
5. **Черга домашніх робіт**.
6. **Перевірка конкретної роботи**.
7. **Учні** — пошук, курс, активність, блокування, перехід у чат.
8. **Профіль учня** — прогрес і здані роботи.
9. **Діалоги** та **чат із конкретним учнем**.
10. **Фото-розсилка** — список, створення, запланований час, видалення.
11. **Статистика**.

### Рольова модель

У продукті лише дві ролі: `student` і `teacher`. Викладач одночасно керує
курсами, уроками, учнями, ДЗ, чатами, розсилкою та статистикою. Окремої
сутності `admin`, окремого admin workspace і третьої гілки дозволів немає.

Старе значення `admin`, якщо воно вже записане в production-базі, repository
нормалізує в `teacher` під час читання. Це compatibility rule на межі legacy,
а не третя доменна роль. Новий код ніколи не записує `admin`.

### Відкладено до функціонального паритету

Літній івент уже описаний у продуктових документах, але не входить у
переписування ядра. Його модуль додається лише після стабільної роботи уроків,
ДЗ, SRS, чату та кабінету викладача.

---

## 5. Backend: модулі та шари

Кожен backend-модуль має однакові чотири шари:

1. **Route** — HTTP, schema validation, статус відповіді.
2. **Application service** — сценарій та транзакційна межа.
3. **Domain policy** — чисте правило без SQL.
4. **Repository** — єдине місце з SQL і legacy-мапінгом.

Route не пише SQL. Repository не формує HTTP-відповідь. Domain policy не
читає `process.env` і не знає поточний час напряму — час приходить через Clock.

### Модулі

- `auth` — перевірка Telegram initData й створення RequestContext;
- `users` — профіль, enrollment, blocked state;
- `courses` — legacy `levels`, список і шлях;
- `lessons` — уроки, блоки, спроби, оцінювання;
- `progress` — завершення, drip, cooldown, статистика;
- `homework` — здача, файл, перевірка;
- `flashcards` — словник, study session, SRS review;
- `chat` — діалоги, повідомлення, read state;
- `media` — upload/download і `app_assets`;
- `teacher` — orchestration адміністративних сценаріїв, але не дублювання
  доменних правил інших модулів.

---

## 6. API-контракти

Нове API версіонується як `/api/v2`. Версія API не зобов’язана збігатися з
назвою `v3` frontend.

### Основні правила

- У URL учнівських endpoint немає `:userId`; особа завжди з RequestContext.
- Ідентифікатори в DTO мають один канонічний тип і не вгадуються з рядка.
- Дати передаються як UTC ISO 8601.
- Списки завжди є списками, навіть коли порожні.
- Відсутній optional field не підміняється випадковим `null`; це вирішується
  в контракті один раз.
- Mutation повертає актуальний ресурс або мінімальний результат для оновлення
  кешу, а не лише неінформативне `success: true`.
- Повторення mutation після network retry не повинно дублювати завершення,
  здачу ДЗ чи повідомлення; критичні операції мають idempotency key.

### Групи endpoint

| Група | Призначення |
| --- | --- |
| `/auth/me` | перевірена особа, роль, blocked state, enrollment |
| `/courses`, `/me/course` | курси, enrollment, шлях користувача |
| `/lessons/:id`, `/lessons/:id/attempts` | контент, початок і завершення спроби |
| `/me/homework`, `/lessons/:id/homework` | стан, здача і перегляд ДЗ |
| `/me/dictionary`, `/me/study-session`, `/flashcards/:id/reviews` | словник і SRS |
| `/me/stats` | прогрес та агрегати |
| `/me/chat` | повідомлення учня |
| `/teacher/*` | курси, уроки, ДЗ, учні, діалоги, статистика, розсилка |
| `/assets/:id` | перевірене отримання медіа |

### Валідація

Обирається **Zod** як спільне джерело runtime-схем і TypeScript-типів.

- Request params, query, JSON і multipart metadata перевіряються до service.
- Відповідь repository спочатку нормалізується з legacy-формату, потім
  перевіряється як domain object.
- У development і contract tests перевіряються також server responses.
- `lesson_blocks.content` розбирається через discriminated union за `type`.
- Невідомий блок не валить увесь урок: API повертає контрольовану помилку
  контенту викладачу, а учню — безпечний unsupported-state з можливістю
  завершити доступний сценарій.

### Помилки

Єдина форма містить:

- стабільний машинний `code`;
- безпечне повідомлення для користувача;
- `requestId` для журналу;
- optional field errors;
- optional retry-after для cooldown або rate limit.

Очікувані класи: validation, unauthenticated, forbidden, blocked, not-found,
conflict, cooldown, payload-too-large, content-invalid, internal.

Stack trace, SQL і токени ніколи не відправляються клієнту.

---

## 7. Telegram-авторизація та дозволи

### Перевірка запиту

1. Web отримує raw `initData` від Telegram SDK і тримає його лише в пам’яті.
2. API-клієнт передає raw `initData` у спеціальному header кожного захищеного
   запиту.
3. Backend відтворює Telegram data-check-string, обчислює HMAC через bot token
   і порівнює hash constant-time способом.
4. Перевіряється `auth_date` з обмеженим строком придатності.
5. `telegram_id` витягується тільки з перевіреного payload.
6. Backend знаходить внутрішній `users.id` і створює RequestContext:
   `userId`, `telegramId`, `role`, `isBlocked`.

Ім’я та username можна синхронізувати, але sync ніколи не змінює роль,
блокування або enrollment.

Production не має `demo-user`, query-параметра обходу чи довіреного
`X-Role`. Локальна тестова автентифікація існує лише в test/dev збірці й
фізично не реєструється у production.

### Авторизація

У новому домені існують тільки `student` і `teacher`. Route перевіряє не
назву сторінки, а capability:

| Capability | Student | Teacher |
| --- | ---: | ---: |
| проходити власний курс | так | preview |
| читати/здавати власне ДЗ | так | preview |
| редагувати курс і уроки | ні | так |
| перевіряти ДЗ | ні | так |
| бачити учнів і teacher-chat | ні | так |
| блокувати учня | ні | так |

Legacy-значення `admin` перетворюється на `teacher` до перевірки capability.
Інші або невідомі значення ролі не отримують teacher-доступ.

Для кожного student-запиту repository додатково фільтрує дані за
`RequestContext.userId`. Перевірки лише в UI недостатньо.

Заблокований student отримує `403 blocked` на предметних endpoint. Auth/me
залишається доступним, щоб застосунок міг показати зрозумілий екран.

---

## 8. Доменні правила

### Ідентичність

У новому домені користувач завжди має числовий внутрішній `users.id`.
`telegram_id` є лише зовнішнім ключем входу. Винятків для SRS немає.

### Lesson blocks

Десять типів описуються окремими контрактами: text, audio, image,
mascot_tip, quiz, fill_blank, true_false, word_order, match_pairs, homework.

Legacy JSON проходить через adapter, який:

- обрізає пробіли відповіді `fill_blank`;
- розпізнає один або кілька символів `_` як пропуск;
- не показує порожні quiz options;
- санітизує rich text до дозволених тегів без атрибутів;
- позначає порожній або непрохідний блок як content issue.

Конструктор не дозволяє створювати нові невалідні блоки. Reader лишається
толерантним до старих даних.

### Оцінювання

Оцінювання відбувається на сервері з відповідей, а не з переданого клієнтом
`score`.

- зараховується лише перша відповідь на вправу;
- correct, wrong і skipped — різні стани;
- знаменник — усі scored-вправи;
- урок без scored-вправ має повний результат;
- завершення без відповідей не дає повний бал.

Для надійності вводяться lesson attempt та answer records. Це технічна
модель збереження існуючої поведінки, а не нова продуктова функція.

### Drip і cooldown

Є одна `DripPolicy` з конфігурованою тривалістю 24 години та одна
`RetakePolicy` з 24 годинами. Поточний час дає server Clock.

- перший урок доступний без progress-row;
- після завершення наступний отримує `unlocks_at`;
- доступність після настання `unlocks_at` обчислюється під час читання без
  UPDATE у GET;
- teacher preview не створює учнівський прогрес і не змінює drip;
- завершення та створення наступного unlock виконуються в одній транзакції.

### SRS

Алгоритм є однією чистою функцією domain package. Backend передає попередній
стан і correct/incorrect, а repository атомарно записує результат.

Правила: `0 → 1 → 3 → round(interval × ease)`, ease `+0.1/-0.2`, мінімум
`1.3`, старт `2.5`. Неправильна картка повертається в поточну сесію на рівні
session feature, а сервер записує нульовий інтервал.

---

## 9. Безпечне підключення старої БД

### Фаза A — інвентаризація без запису

- Зафіксувати schema dump, кількість рядків, foreign-key anomalies,
  дублікати й контрольні хеші контенту.
- Зберегти encrypted backup Turso і перевірити, що він реально
  відновлюється в окрему тестову БД.
- Запустити новий API тільки з read-only token проти production.
- Legacy назви мапити в repository: `levels → courses`, текстовий JSON →
  типізовані lesson blocks.

### Фаза B — sandbox-копія

- Відновити production snapshot в окрему Turso/local SQLite базу.
- Усі integration та migration tests виконувати тільки там.
- Зберегти до/після counts і контрольні вибірки 18 уроків, 185 блоків,
  339 карток, 57 ДЗ та користувацького прогресу.

### Фаза C — additive migrations

- Додати `schema_migrations`.
- Кожна міграція має номер, forward, verification і окремий rollback plan.
- Спочатку лише нові таблиці/колонки/індекси; старі не перейменовувати й не
  видаляти під час переходу.
- Міграція SRS додає числовий user reference, backfill через `telegram_id`,
  а невідповідні записи (`demo-user`, orphan) складає у звіт, не вгадує
  власника.
- Суперечливі production-дані не виправляються автоматично без продуктового
  рішення власника.

### Фаза D — контрольовані записи

Запис вмикається feature flag-ами по модулю: спочатку enrollment, потім
lesson attempts/progress, homework, SRS, chat і teacher editing. Перед кожним
модулем є backup та smoke-test.

Не робимо постійний dual-write двома backend-ами: це створить розходження.
Під час cutover лише один backend має право записувати конкретний модуль.

### Фаза E — cutover і rollback

- Preview використовує sandbox DB.
- Production deployment спершу запускається з вимкненими write flags.
- Після read smoke-tests записи вмикаються по модулю.
- Rollback коду не потребує rollback схеми, доки migrations additive.
- Видалення старих колонок і очищення orphan assets — окремий майбутній
  реліз після періоду стабільності.

### Заборонено

- auto-migrations під час імпорту `db.ts`;
- порожній `catch` навколо `ALTER TABLE`;
- seed endpoint у production;
- тестування проти production write-token;
- зміна історичних оцінок, blocked users або `demo-user` записів без
  затвердженого migration manifest.

---

## 10. Архітектура Three.js / React Three Fiber

### Один Canvas

Canvas монтується один раз у App shell і не перемонтовується при зміні route.
DOM-екрани живуть над ним. Завдяки цьому GLB, textures, shader programs і
AnimationMixer не завантажуються заново, а перехід справді продовжує рух
персонажа між сторінками.

Сторінки не імпортують `three`, Fiber або Drei.

### Ієрархія сцени

```text
Canvas
  World
    Background
    LightingRig
    CameraRig
    CharacterAnchor
      TransitionRig
        CharacterGLB
    TransitionOverlay
  SceneController
  QualityController
```

- `CharacterAnchor` визначає позицію персонажа для конкретної композиції.
- `TransitionRig` рухає весь об’єкт під час переходу, не конфліктуючи з
  кістками Blender.
- `CharacterGLB` містить mesh, armature, матеріали й AnimationMixer.
- `CameraRig` має власну контрольовану анімацію.
- `Background` і `TransitionOverlay` використовують обмежений набір спільних
  shader materials.

### GLB asset contract

- одна версіонована GLB-модель;
- до 10 кісток і максимум 4 bone weights на вершину;
- застосовані scale/rotation, стабільний origin;
- без root motion по світових координатах;
- однакові назви actions: `idle`, `wave`, `pull`, `celebrate`, `encourage`,
  `think`, `sad`, `transition_reach`, `transition_exit`;
- матеріали та текстури мають стабільні назви;
- окремий manifest містить версію моделі, clip durations і cue момент
  повного перекриття камери.

CI перевіряє контракт моделі до збірки. Відсутній обов’язковий clip або
material name є помилкою asset pipeline, а не runtime-сюрпризом.

### Завантаження й кеш

Drei `useGLTF` завантажує та кешує модель один раз; App shell запускає preload
після bootstrap. До готовності показується контрольований статичний fallback.

При route-змінах модель не клонується. Якщо колись потрібні дві копії,
SkeletonUtils використовується всередині scene module, але поточний продукт
має одного персонажа.

### Анімації

Один AnimationMixer володіє попередньо створеними actions. Базовий `idle`
зациклений; реакції є one-shot і повертаються в idle через crossfade.

SceneController приймає семантичні команди: mood, play reaction, set pose,
transition. Він не відкриває кістки назовні.

Процедурний рух застосовується лише до батьківських rig-груп або спеціально
виділених bones/morph targets. Код і Blender-кліп не анімують одну й ту саму
властивість одночасно.

### Матеріали та білий силует

Оригінальні Blender-матеріали зберігаються. MaterialController реєструє їх
один раз і керує спільним `silhouetteMix` від 0 до 1.

У силуетному режимі модель лишається тим самим skinned mesh, але albedo,
текстури й освітлення плавно поступаються чистому білому. Матеріали не
створюються щокадру і не підміняються окремою білою GLB.

Для слабких GPU дозволений еквівалентний дешевий режим без плавного
матеріального mix, якщо візуально він проходить acceptance test.

### SceneController

SceneController — фасад і state machine, а не глобальний набір довільних
методів. Його стани:

`idle → preparing → exiting → covered → route-commit → entering → idle`

Він відповідає за:

- блокування повторного переходу;
- preload цільового route;
- запуск AnimationMixer action;
- camera rig і silhouette progress;
- cue `covered`;
- commit маршруту лише під повністю перекритим кадром;
- enter animation;
- timeout і гарантоване відновлення UI;
- reduced-motion і WebGL fallback.

### Продуктивність

Ціль: 60 FPS на середньому смартфоні, допустимий стабільний fallback — 30 FPS.

Початкові бюджети:

- модель до 25–30 тисяч triangles;
- до 10 bones, 4 influences;
- текстури переважно до 1024×1024, стиснення KTX2 після візуальної перевірки;
- один Canvas, одна модель, мінімум прозорих поверхонь;
- одна ambient/hemisphere і одна основна light;
- без realtime shadow map за замовчуванням;
- максимум два fullscreen shader passes включно з переходом;
- DPR обмежений приблизно 1–1.5 на mobile;
- quality tier визначається один раз після warmup і не стрибає щосекунди;
- Canvas зупиняє або спрощує render loop, коли Telegram/WebView прихований;
- жодних shader compilation або material allocation під час переходу.

Bundle аналізується окремо: імпорти з Three.js модульні, editor/debug helpers
не потрапляють у production.

---

## 11. Навігація та переходи

Екрани працюють із `AppNavigator`, а не з Router і SceneController окремо.
Намір містить target route, transition preset і мінімальні route params.

Послідовність `mascot-reach`:

1. Navigator перевіряє, що перехід не зайнятий.
2. Цільовий route/data починає preload.
3. SceneController запускає `transition_reach`.
4. Камера й `silhouetteMix` синхронізуються з cue manifest.
5. Біла рука повністю перекриває кадр.
6. SceneController повідомляє `covered`; лише тоді Router commit-ить target.
7. Нова screen-композиція задає CharacterAnchor і background preset.
8. Програється `transition_exit`, матеріали повертаються, input розблоковується.

Back використовує той самий preset та зворотну семантику, а не миттєвий
spawn персонажа. Системний browser/Telegram back також проходить через
Navigator, якщо немає аварійного unload.

Якщо WebGL недоступний, модель не завантажилась або увімкнено
`prefers-reduced-motion`, Navigator використовує коротку непрозору DOM-штору.
Маршрут ніколи не блокується через декоративну сцену.

Повний storyboard і два напрямки переходу зафіксовані в
`v3/TRANSITIONS.md`.

---

## 12. Тестова стратегія

### Unit: domain rules

Обов’язкові таблиці сценаріїв:

- score: усі correct, mixed, skipped, нічого не виконано, урок без вправ;
- fill_blank: різна кількість `_`, пробіли, відсутня правильна option;
- drip: перший урок, до/після 24 годин, інший курс, teacher preview;
- cooldown: до/після 24 годин;
- SRS: correct chain, wrong reset, ease floor;
- capabilities: усі ролі × усі захищені дії;
- rich text sanitizer і malformed legacy blocks.

### Contract tests

- кожен request і response відповідає shared Zod schema;
- помилки мають стабільний code;
- student endpoint не приймає чужий user ID;
- malformed DB row не перетворюється на `200` із небезпечними даними.

### DB integration

Тести запускаються проти тимчасової local SQLite або sandbox Turso копії.
Перевіряються repositories, transactions, unique constraints, retry та
idempotency. Production URL/token заборонені в test environment guard-ом.

### API security

- відсутній, змінений, прострочений initData;
- підміна telegram ID або ролі;
- student викликає `/teacher/*`;
- blocked student викликає предметні endpoint;
- upload із завеликим розміром або неправильним MIME;
- XSS у rich text, homework, chat і photo caption.

### E2E flows

**Student:** bootstrap → enrollment → path → lesson → skipped/mistake/correct →
result → homework → dictionary → flashcards → chat → profile.

**Teacher:** dashboard → course → lesson editor → validation → preview → save →
homework grading → student block/unblock → chat → scheduled photo.

Тести перевіряють наслідок, а не наявність тексту, який може бути й на
попередній сторінці.

### 3D і WebView

- asset contract test для GLB і clip names;
- state-machine tests для forward, back, double tap, route failure і timeout;
- screenshot tests ключових фаз silhouette/covered;
- performance trace після cold load і після 30 секунд idle;
- реальні Android Telegram WebView та iOS Telegram smoke-tests;
- вузький екран, safe areas, клавіатура, background/foreground;
- reduced motion і WebGL unavailable fallback.

### Міграції

Кожна migration виконується на свіжій копії production snapshot, повторно
запускається для перевірки idempotency, проходить verification manifest і
відновлення з backup. Перевіряються counts, hashes контенту та вибірки
користувацького прогресу.

---

## 13. Поетапна реалізація

### Етап 0 — заморожений baseline

Інвентаризація старої БД, verified backup/restore, список legacy API,
контрольні user flows і рішення щодо суперечливих даних.

**Стабільний результат:** старий production працює без змін; є відтворювана
sandbox-копія.

### Етап 1 — workspace і контракти

Структура monorepo, contracts, domain package, error model, CI, lint/typecheck,
test DB guard.

**Стабільний результат:** порожні web/api збираються, contracts тестуються,
до production DB немає write-доступу.

### Етап 2 — auth та App shell

Telegram verification, RequestContext, capabilities, bootstrap states,
Router, error boundary, серверний кеш.

**Стабільний результат:** student і teacher входять у правильну оболонку;
підміна ролі не працює.

### Етап 3 — 3D vertical slice

Один Canvas, фінальна GLB, idle, один reaction, білий silhouette,
`mascot-reach`, fallback і performance budgets.

**Стабільний результат:** Welcome переходить на порожній тестовий route вперед
і назад без remount моделі та зі стабільним FPS.

### Етап 4 — read-only courses та lessons

Legacy adapters, enrollment read, course path, lesson block normalization,
student Home/Path/Lesson у read-only режимі.

**Стабільний результат:** реальний контент читається із sandbox; жодного запису.

### Етап 5 — lesson attempts, score і progress

Server-side scoring, first-answer invariant, skipped state, finish transaction,
drip і cooldown.

**Стабільний результат:** повний урок проходиться в sandbox; автоматичні тести
покривають відомі регресії.

### Етап 6 — homework

Умова, submit/view, upload, teacher queue, grading і статуси на path/home.

**Стабільний результат:** повний student↔teacher цикл ДЗ.

### Етап 7 — flashcards і dictionary

Єдиний числовий user ID, SRS migration у sandbox, study session та статистика.

**Стабільний результат:** інтервали перевірені clock-based тестами; чужий
прогрес не змішується.

### Етап 8 — chat, media, profile

Chat/read state, photo delivery за `scheduled_at`, assets adapter, статистика,
профіль і налаштування.

**Стабільний результат:** завершений основний student flow.

### Етап 9 — teacher workspace

Курси, уроки, типізований editor, validation/preview, students, homework,
chat, photo messages, statistics.

**Стабільний результат:** викладач може створити валідний урок і провести
учня через увесь цикл без legacy UI.

### Етап 10 — production cutover

Повний regression, real-device WebView, performance, backup, read-only smoke,
поетапне ввімкнення write flags, моніторинг і rollback rehearsal.

**Стабільний результат:** новий production працює; старий deploy і backup
залишаються доступними для відкоту протягом погодженого періоду.

---

## 14. Ризики та анти-патерни

| Ризик | Захист |
| --- | --- |
| Два типи user ID | внутрішній numeric ID скрізь; legacy mapping лише в repository |
| Пошкодження production | read-only спочатку, backup restore drill, additive migrations, flags |
| Повтор старого score bug | server-side score та table-driven domain tests |
| Race у finish/review | транзакції, constraints, idempotency key |
| Невалідний legacy JSON | tolerant adapter + strict editor contracts |
| Teacher API доступний учню | verified initData + capability middleware на кожному route |
| Scene ламає навігацію | state machine, timeout, DOM fallback, route commit під cover |
| Низький FPS | одна сцена, budgets, DPR cap, stable quality tier, device traces |
| Витік GPU memory | Canvas не remount-иться; кешовані матеріали; явний dispose замінених assets |
| Десять різних анімаційних стилів | один motion vocabulary і cue manifest |
| API response спричиняє blank screen | runtime validation, typed errors, error/empty states |
| GET має побічні ефекти | derived availability; writes лише в application commands |
| Випадкова міграція під час deploy | сервер не має migration-on-start; окремий migration job |
| Тест проходить хибно | assert route/state/DB effect, не випадковий текст |

Заборонені архітектурні скорочення:

- `fetch` у screen або UI-компоненті;
- SQL у route handler;
- `userId` з request body для student-операції;
- роль із localStorage або Telegram username;
- score, interval або unlock status, яким backend довіряє від клієнта;
- імпорт Three.js поза `scene`;
- окремий Canvas на сторінку;
- шейдер або GLB-клон для кожного переходу;
- business rule, продубльований у frontend і backend без domain tests;
- мовчазний `catch` під час міграції;
- очищення «дивних» production-даних за припущенням.

---

## 15. Критерій готовності архітектури

Архітектура вважається реалізованою, коли:

- кожен модуль має публічну межу й не порушує напрям залежностей;
- frontend не може звернутися до DB або видати себе за іншу роль;
- scene можна вимкнути, а всі функції й навігація продовжують працювати;
- одна й та сама GLB живе між route без повторного завантаження;
- score, drip, cooldown і SRS мають server-side джерело істини;
- migrations перевірені на копії production і мають rollback plan;
- student і teacher E2E flows проходять у sandbox;
- Android/iOS Telegram smoke-tests не мають blank screens;
- production cutover не вимагає необоротної зміни старої схеми.
