# Генерація анімацій маскота

Робочий документ: опис персонажа, промти під кожну позу, налаштування,
типові збої та що з результатом робити далі.

Промти англійською — усі моделі розуміють її найкраще. Решта українською.

---

## 1. Підготовка вихідної картинки

Наші файли замалі для image-to-video:

```
neutral     240x350   єдиний придатний без апскейлу
surprised   119x175
happy       147x168
perfect     139x164
idle        117x167
sad         112x159
```

Моделі хочуть від 512px по короткій стороні, краще 1024.

**Порядок:**

1. Якщо є оригінальний файл у високій роздільності — брати його, це найкраще
2. Якщо ні — апскейл до **1024×1210** (Topaz, Upscayl, Real-ESRGAN).
   Для плоскої 3D-графіки з чистими краями вони працюють добре
3. Підкласти під нього **рівний зелений `#00FF00`** ще до генерації — тоді
   модель не вигадає власне тло
4. **Не перефарбовувати у синій.** Генеруємо з фіолетового оригіналу: колір
   застосунок робить сам одним фільтром, і всі пози лишаються в одному конвеєрі

---

## 2. Опис персонажа

Цей блок вставляється в кожен промт без змін. Він потрібен, щоб модель
**не перемалювала** персонажа — це найчастіший збій.

```
CHARACTER (do not redesign, do not restyle):
A 3D rendered cartoon takeaway coffee cup, standing upright, no legs.
- Lid: cream off-white plastic, domed, with a small raised drinking spout at the back
- Cup body: clean white paper cup, slightly tapered, wider at the top
- Sleeve: a solid purple band wrapped around the middle third of the cup
- Face: drawn directly on the purple sleeve, minimal and flat - two small round
  dark eyes and one simple curved mouth, no nose, no eyebrows, no teeth detail
- Arms: two thin, short, rounded purple arms emerging from the left and right
  sides of the sleeve, with simple mitten hands, no fingers
- Proportions: cup roughly 1 unit wide by 1.8 units tall, arms about one third
  of body height
- Material: soft matte plastic, gentle subsurface softness, no glossy highlights
- No legs, no feet, no hat, no accessories, no straw unless stated
```

---

## 3. Обовʼязкові технічні вимоги

Теж вставляються в кожен промт. Формулювання навмисно повторюються
кількома способами — моделі краще реагують на надлишковість.

```
CAMERA:
Locked static camera. Fixed tripod shot. No zoom, no dolly, no pan, no tilt,
no orbit, no parallax, no handheld shake. The frame never moves.

FRAMING:
The character is centred horizontally and vertically. Generous empty margin on
all four sides - at least 15% of frame width on left and right, at least 10% of
frame height above and below. The character never touches or crosses the frame
edge at any point in the animation.

BACKGROUND:
Solid flat pure chroma green (#00FF00) filling the entire frame. Perfectly even,
single flat colour. No gradient, no vignette, no texture, no floor, no horizon
line, no table surface, no cast shadow on the background, no reflections,
no ambient occlusion touching the background.

LIGHTING:
Soft, even, frontal studio lighting on the character only. Consistent throughout.
No flicker, no changing light, no colour shift over time.

LOOP:
The final frame is identical to the first frame. The character begins and ends
in exactly the same position, scale and pose. Seamless loop.

RENDER:
Sharp clean edges, no motion blur, no depth of field, no film grain,
no chromatic aberration.
```

---

## 4. Промти під кожну позу

Формула: **опис персонажа** + **дія** + **технічні вимоги**.

### `happy` — потрібна першою, вона на вітальному екрані

```
ACTION:
The cup character celebrates briefly and returns to rest.

Beat 1 (0.0-0.4s): from a still upright rest pose, the cup compresses slightly
downward, squashing about 5%, as an anticipation.
Beat 2 (0.4-1.0s): the cup hops upward a short distance, roughly 8% of its own
height, stretching slightly. Both arms swing up and outward into a raised cheer.
The eyes close into two happy upward arcs. The mouth opens into a wide smile.
Beat 3 (1.0-1.6s): the cup lands softly with a small secondary bounce, arms
still raised, sleeve wobbling gently like soft rubber.
Beat 4 (1.6-2.4s): arms lower back down to the sides, eyes open back to two
round dots, mouth returns to a calm closed smile, body settles completely still.

The motion is bouncy and light, with soft ease-in and ease-out. Nothing
stretches more than 10%. The character stays fully upright and does not rotate
more than 5 degrees at any point.
```

### `perfect` — святкування на екрані результатів

```
ACTION:
The cup character winks confidently.

Beat 1 (0.0-0.5s): still upright rest pose, then a slow confident lean about
5 degrees to one side.
Beat 2 (0.5-1.1s): one eye closes into a wink while the other stays a round dot.
The mouth curves into a wide pleased smile. One arm rises into a small
thumbs-up-like gesture near the top of the sleeve.
Beat 3 (1.1-1.8s): the raised arm gives one small confident shake, twice, with
a light bounce in the body.
Beat 4 (1.8-2.5s): the arm lowers, the closed eye opens, the lean returns to
vertical, the body settles completely still.
```

### `sad` — коли учень помилився

```
ACTION:
The cup character deflates gently in disappointment.

Beat 1 (0.0-0.6s): from an upright rest pose the whole body sags downward,
compressing about 6%, and tilts forward about 5 degrees.
Beat 2 (0.6-1.4s): the eyes curve downward into a sad shape, the mouth turns
into a small downward curve. Both arms droop limply toward the ground.
Beat 3 (1.4-2.2s): one very small slow sway to one side, like a quiet sigh.
Beat 4 (2.2-3.0s): the body slowly rises back to upright, face returns to
neutral, arms return to the sides, completely still.

The motion is slow, soft and heavy. No sharp movements.
```

### `surprised`

```
ACTION:
The cup character reacts with a startle.

Beat 1 (0.0-0.2s): a sharp, quick recoil backward and upward, the body
stretching vertically about 8%.
Beat 2 (0.2-0.8s): the eyes open wide into large round circles, the mouth
becomes a small open circle. Both arms fly up and outward in a startled pose.
Beat 3 (0.8-1.6s): the body wobbles back down with two decreasing bounces,
like soft jelly settling.
Beat 4 (1.6-2.4s): arms lower, face returns to neutral round eyes and a calm
mouth, body settles completely still.
```

### `idle` — фонове дихання, найважливіша для «живого» відчуття

```
ACTION:
The cup character is at rest, barely moving, alive but calm.

The whole body rises and falls very gently, no more than 2% of its height,
like slow breathing, twice over the clip.
Once, near the middle of the clip, both eyes blink - closing and opening
quickly over about 0.15 seconds.
The arms hang relaxed at the sides and sway almost imperceptibly.
The mouth stays a calm closed smile throughout.

This is a subtle idle loop. The movement must be small enough that it reads as
breathing, not as an action. Nothing swings, hops or rotates.
```

---

## 5. Негативний промт

Один на всі пози:

```
text, watermark, logo, signature, letters, numbers, subtitles, caption,
extra characters, second cup, duplicate character, human, hands, fingers,
face of a person, animal,
camera movement, zoom in, zoom out, pan, tilt, dolly, orbit, parallax,
handheld, shaky camera, rack focus,
motion blur, depth of field, bokeh, film grain, noise, chromatic aberration,
lens flare, glow, bloom,
background objects, table, desk, floor, wall, horizon, room, cafe, outdoors,
shadow on background, drop shadow on floor, reflection, gradient background,
vignette, textured background, patterned background,
colour shift, hue change, style change, redesign, restyle, art style change,
different character design, changed proportions, changed colours,
deformed, melting, morphing, warping, liquid, extra limbs, extra arms,
missing arms, cropped, cut off, character leaving frame, out of frame,
legs, feet, shoes, hat, straw, glasses, accessories,
realistic photo, live action, human skin, fabric texture
```

---

## 6. Налаштування

| параметр | значення | чому саме так |
|---|---|---|
| тривалість | **2–3 с** (`idle` — 3–4 с) | це реакція, а не мультик. Довше — більше шансів, що модель попливе |
| частота кадрів | 24 або 30 | APNG усе одно не потребує більше |
| роздільність | від 1024×1024 | зменшувати можна, збільшувати ні |
| співвідношення | **однакове для всіх поз** | інакше кожна анімація потребуватиме власного підбору розміру |
| сила руху / motion strength | **низька–середня** | висока деформує персонажа, це збій №1 |
| creativity / variation | низька | нам потрібна вірність оригіналу, а не фантазія |
| рух камери | **вимкнено** явно, якщо є окремий перемикач | текстом не завжди слухається |
| seed | зафіксувати | щоб можна було повторити вдалий результат |

**Порада:** генеруйте по 3–4 варіанти на кожну позу з різними seed і обирайте.
Це дешевше, ніж домагатись ідеалу з першого разу.

---

## 7. Типові збої і що робити

| що сталось | причина | як лікувати |
|---|---|---|
| персонаж «попливе», зміниться дизайн | зависока сила руху або creativity | знизити motion strength, підсилити блок CHARACTER, додати `do not redesign` двічі |
| камера наїжджає | модель ігнорує текст | шукати окремий перемикач руху камери й вимкнути; додати `static camera` на початок **і** в кінець промта |
| зелене тло стало градієнтом | модель домальовує освітлення | підкласти зелене тло під картинку **до** генерації |
| руки обрізані з боків, хоча в джерелі поля були | **співвідношення сторін джерела не збігається з вихідним**: модель вписує кадр обрізанням по боках | покласти картинку на зелене полотно **того самого співвідношення**, що віддає модель (16:9 → 1920×1080) |
| зелений реквізит (прапорець, галочка) зник | він тієї ж кольоровості, що й тло | виміряти відстань реквізиту до ключа й поставити поріг **нижче** неї |
| стаканчик виїхав за край | замалі поля у вихідній картинці | додати полів у вихідну картинку перед генерацією |
| зелена облямівка на кремовій кришці | розсіювання хромакею | у `ffmpeg` підняти `similarity` до 0.15–0.2, додати `despill` |
| ривок наприкінці | перший і останній кадри різні | обрізати кінець або зробити ping-pong: пряме відтворення + зворотне |
| зʼявився другий стаканчик | модель дублює субʼєкт | у негативний промт додати `duplicate character`, зменшити creativity |

---

## 8. Обробка результату

Нижче — не приклад, а конвеєр, яким справді зроблено `perfect`. Числа
підібрані вимірюванням; кожне з них спершу було вгадане й виявилось хибним.

### Крок 1. Виміряти тло, а не припускати

Модель віддала **`#4A9F4A`**, а не замовлений `#00FF00`. Ключ треба брати з
самого файлу:

```bash
ffmpeg -v error -i in.mp4 -vf "select='eq(n\,0)',format=rgb24" \
  -frames:v 1 -f rawvideo frame0.raw
# і прочитати піксель за зсувом (y*ширина + x)*3
```

### Крок 2. Порахувати запас до найближчого «свого» кольору

`chromakey` рахує відстань як `sqrt((du²+dv²)/(2·255²))` — **ділення на 2 легко
проґавити** і вдвічі помилитись у порозі. Виміряні відстані для `perfect`:

```
тло                0.003     ← має вирізатись
тінь на тлі        0.002     ← вирізається разом із тлом: та сама кольоровість
зелений прапорець  0.088     ← має лишитись
біле й кремове     0.137     ← має лишитись
```

Поріг ставиться **між тлом і найближчим потрібним кольором**, тут `0.040:0.020`.
Початкові `0.10:0.04` мовчки зʼїли прапорець.

### Крок 3. Ключ, despill і рамка

```bash
KEY="format=yuv444p,chromakey=0x4A9F4A:0.040:0.020,despill=type=green:mix=0.15"
```

- **`format=yuv444p` перед ключем.** Інакше край ріжеться по вчетверо меншій
  роздільності кольору й виходить сходинками
- **`mix=0.15`, не типове `0.5`.** На повній силі despill вибирає зелений із
  нейтрально-білого й **кремова кришка стає рожевою**

Рамку міряти **після** ключа з правильним порогом:

```bash
ffmpeg -v info -i in.mp4 -vf "$KEY,alphaextract,cropdetect=limit=2:round=2:reset=0" \
  -f null - 2>&1 | grep -o 'crop=[0-9:]*' | tail -1
```

Перший вимір я зробив із зависоким порогом, за якого прапорець був невидимий —
і рамка вийшла на 38 пікселів вужча, ніж треба, **обрізавши його наполовину**.

### Крок 4. Знайти точку зациклення

Останній кадр рідко збігається з першим. Кадр із найменшою розбіжністю до
першого шукається перебором: у `perfect` це кадр 84 із 192 (розбіжність 1.56
при рівні шуму 1.07 між сусідніми кадрами), тобто 8 с обрізано до 3.5 с.

### Крок 5. Кодування

```bash
ffmpeg -i in.mp4 \
  -vf "$KEY,crop=604:660:356:32,trim=end_frame=84,fps=20,scale=458:500,format=rgba" \
  -c:v libwebp_anim -lossless 0 -quality 70 -loop 0 -an perfect-anim.webp
```

**Формат — анімований WebP, не WebM.** Safari не тримає альфу у VP9/WebM, а
Telegram на iOS — це Safari, тож замість прозорого тла був би чорний
прямокутник. WebP грає у звичайному `<img>`: без політик автовідтворення,
прозорий скрізь.

Заразом перший кадр окремим файлом — його видно, поки вантажиться анімація:

```bash
ffmpeg -i in.mp4 -vf "$KEY,trim=end_frame=1,scale=458:500,format=rgba" \
  -frames:v 1 -c:v libwebp -quality 82 perfect-still.webp
```

Вага: анімація 830 КБ, постер 13 КБ. Для порівняння — APNG тієї ж сцени
важить **19.7 МБ**: персонаж дрейфує, тож жоден кадр не тисне попередній.

**Перевіряти результат тільки в браузері.** ffmpeg вміє анімований WebP
записувати, але **не вміє читати** — власною ж перевіркою файл не відкриєш.

---

## 9. Перевірка перед тим, як класти в проєкт

- [ ] тло повністю прозоре, зеленої кайми немає **на кремовій кришці**
- [ ] персонаж по центру, з полями з усіх боків
- [ ] співвідношення сторін таке саме, як в інших поз
- [ ] останній кадр збігається з першим, при зациклюванні немає ривка
- [ ] персонаж не змінив дизайн: та сама кришка, та сама смужка, ті самі руки
- [ ] розмір файлу до ~1.5 МБ (наявні APNG важать 1.2–1.6 МБ)
- [ ] **останній кадр не порожній** — на цьому вже спіткнулись: `Opening.apng`
      закінчувався прозорим кадром, і маскот просто зникав

Файли класти в `v2/public/assets/mascot/animations/`.
