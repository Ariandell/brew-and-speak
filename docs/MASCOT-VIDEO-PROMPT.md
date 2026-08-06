# Промт для генерації відео з маскотом

Для анімації пози `perfect` (підморгує з галочкою) — святкування на екрані
результатів після бездоганного уроку.

---

## Спершу підготувати картинку

`perfect.png` має **139×164 пікселі**. Це замало: моделі image-to-video хочуть
щонайменше 512px по короткій стороні, інакше на виході буде каша.

Порядок:

1. Якщо є оригінальний файл маскота у високій роздільній здатності — брати його
2. Якщо немає — збільшити `perfect.png` до **1024×1210** будь-яким AI-апскейлером
   (Topaz, Upscayl, `Real-ESRGAN`). Для плоскої мультяшної графіки вони працюють добре
3. **Не перефарбовувати** — генерувати з фіолетового оригіналу. Синій колір
   застосунок робить сам одним фільтром, і так усі пози лишаються в одному конвеєрі

---

## Головне технічне обмеження

**Відео не має прозорості.** Тому анімацію треба генерувати на **рівному
насиченому зеленому тлі** (`#00FF00`), яке потім вирізається хромакеєм.

Зелений безпечний: у маскоті є синій, білий і кремовий, зеленого немає ніде,
тож нічого зайвого не зникне.

---

## Промт

```
A 3D cartoon coffee cup character with a cream lid and a purple sleeve,
winking with one eye closed and a wide happy smile, small stubby arms raised
in a short celebratory cheer.

The character bounces gently upward once, tilts slightly, waves one arm, then
settles back to its starting pose exactly as it began.

Locked static camera. No zoom, no pan, no parallax. The character stays
centred and fully inside frame at all times, with generous empty margin on
every side.

Flat pure chroma green background (#00FF00), evenly lit, no gradient, no
shadow cast onto the background, no reflections.

Soft even studio lighting on the character, clean edges, no motion blur.
Smooth loop: the last frame matches the first frame.

Style: clean 3D render, soft plastic material, friendly mascot, consistent
with the source image. Do not redesign the character.
```

## Негативний промт

```
text, watermark, logo, letters, numbers, extra characters, second cup,
human hands, camera movement, zoom, pan, shaky camera, motion blur,
background objects, floor, table, shadow on background, gradient background,
colour shift, style change, redesign, deformed proportions, melting,
morphing, extra limbs, cropped edges, character leaving frame
```

## Налаштування

| параметр | значення | чому |
|---|---|---|
| тривалість | **2–3 с** | реакція на результат, не мультик |
| частота | 24 або 30 fps | більше не потрібно |
| роздільність | 1024×1024 або вище | буде зменшуватись, не збільшуватись |
| рух камери | **вимкнути повністю** | камера зрушить кадр — позиціювання в застосунку розсиплеться |
| сила руху / motion | низька-середня | сильна деформує персонажа |
| зациклення | так, якщо є | інакше зробимо самі |

---

## Що зробити з результатом

1. **Вирізати зелене** — у відеоредакторі або `ffmpeg`:

   ```
   ffmpeg -i input.mp4 -vf "chromakey=0x00FF00:0.12:0.05,format=yuva420p" \
          -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 30 mascot-perfect.webm
   ```

   WebM з VP9 тримає прозорість. Значення `0.12` і `0.05` — поріг і згладжування
   країв, їх варто підібрати на око.

2. **Перевірити краї.** Зелений має звичку підсвічувати світлі частини — у нас
   кришка кремова, тож дивитись треба саме на неї.

3. **Покласти поруч із рештою** — `v2/public/assets/mascot/animations/`

---

## Вимоги до кадру, які не можна порушувати

Це не побажання, а те, на чому вже ламалась верстка:

- **персонаж по центру, з полями з усіх боків.** Наявні APNG мають стаканчик
  впритул до правого краю кадру, і через це його доводилось позиціювати від
  виміряних відсотків, а не від меж картинки
- **співвідношення сторін те саме в усіх файлах.** Інакше кожна анімація
  потребуватиме власного підбору розміру
- **перший кадр збігається з останнім**, інакше при завершенні буде смикання

---

## Якщо генерувати решту поз

Той самий промт, змінюється лише опис дії:

| поза | дія |
|---|---|
| `happy` | підстрибує один раз, обидві руки вгору, широка усмішка |
| `perfect` | підморгує, коротке святкування |
| `sad` | плечі опускаються, легкий нахил уперед, сумний рот |
| `surprised` | легкий ривок назад, очі широко, рот кружечком |
| `idle` | ледь помітне погойдування й одне кліпання, майже нерухомо |
| `neutral` | статична, анімація не потрібна |

Решта промта — без змін, щоб усі пози лишились одним персонажем.
