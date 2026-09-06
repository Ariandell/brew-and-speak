# English with Coffee — frontend V3 status

Оновлено: 2026-09-06.

## Готово

- Mobile-first student UI: welcome, enrollment, home, course path, lesson,
  results, homework, dictionary/cards, chat, profile, schedule.
- Teacher workspace: dashboard, courses/lessons/editor/preview, homework review,
  students, chat, broadcasts і statistics.
- Production `ProductionAppStateProvider` працює через `/api/v2`; demo provider
  вмикається лише у DEV через `?demo=`.
- Усі async-форми чекають server response, блокують double submit, зберігають
  введення при помилці й не показують успіх завчасно.
- Attempt ID та локальний display-state переживають refresh у `sessionStorage`;
  відповіді й score залишаються server-owned.
- Вкладення й фото завантажуються authenticated blob-запитами, без public URL.
- Один глобальний WebGL canvas, обмежений кеш поз, звільнення GPU-ресурсів,
  відновлення context і повноцінний 2D fallback.
- Емоції маскота змінюються лише на нейтральних екранах; семантичні sad/result
  стани не рандомізуються. Контроли лабораторії не потрапляють у product UI.
- Складні 3D-переходи відкладені за ізольованим scene contract; навігація від
  них не залежить.

## Перевірено

| Набір | Результат |
| --- | --- |
| Frontend/API/domain unit | 35/35 |
| Demo Playwright user flows | 19/19 |
| Production Playwright flows | 9/9 |
| Phone widths | 360, 390, 430 px без horizontal overflow у critical screens |
| WebGL unavailable | Навчальний UI лишається працездатним |
| Production build | PASS, JS ~396 КБ / ~119 КБ gzip |

Production browser suite не використовує `?demo`: він підставляє валідний
Telegram `initData`, взаємодіє з видимим UI та реальною локальною SQLite через
Express.

## Перед promotion

Потрібні не зміни коду, а зовнішня acceptance-перевірка: реальний Telegram
WebView, safe areas/keyboard, продуктивність 3D на цільових смартфонах і
візуальне погодження користувачем. Preview deployment має передувати production
promotion.
