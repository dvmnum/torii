# Plitka — контекст проекта

Расширение для браузера (Chrome / Яндекс Браузер / Edge, Manifest V3), которое подменяет новую вкладку.
Главная фишка и отличие от Bonjourr: **свободная раскладка** — виджеты двигаются и растягиваются по сетке как угодно.
Полное ТЗ и бэклог — в `SPEC.md`. Общайся с владельцем по-русски, неформально.

## Стек и принципы
- Ванильный JS + CSS, **без сборки и без фреймворков**. Файлы из `plitka/` грузятся как есть.
  Не тащи Vite/React/TS без явной просьбы — сначала обсуди.
- MV3 CSP: **никаких inline-скриптов и удалённых скриптов**. Все библиотеки лежат локально в `plitka/js/lib/`.
- Сетка — `gridstack.js` v14 (`js/lib/gridstack-all.js`, UMD, глобал `GridStack` — это сам класс).
  Обновлять: `npm i gridstack@latest` → скопировать `node_modules/gridstack/dist/gridstack-all.js` и `gridstack.min.css`.
- Шрифт Manrope (variable, cyrillic + latin) локально в `plitka/fonts/`.
- Минимум permissions: сейчас только `storage`, `unlimitedStorage`. Каждое новое разрешение — осознанно (ревью в сторах).
- Никакой аналитики и сбора данных.

## Структура
```
plitka/
  manifest.json        MV3, chrome_url_overrides.newtab → newtab.html
  newtab.html          разметка: фон, сетка, док, editbar, панель настроек, модалка
  css/style.css        весь дизайн (CSS-переменные в :root, секции по компонентам)
  js/store.js          Store.get/set/remove — chrome.storage.local, фолбэк localStorage (для открытия файла напрямую)
  js/widgets.js        хелпер h(), favicon(), ENGINES, реестр Widgets, loadWeather()
  js/mesh.js           Mesh: меш-градиент на WebGL1 (create/random/cssPreview), без библиотек
  js/app.js            IIFE: настройки, тема, сетка, редактор, модалки, панель, тосты, хоткеи
tests/e2e.mjs          Playwright-смоук (npm test)
```

## Модель данных (chrome.storage.local)
- `settings` — `{ name, bg, bgImage(dataURL|null), bgDim, accent, glassBlur, glassAlpha, radius, motion, mesh }`
  - `bg: 'mesh'` — свой меш-фон; `mesh = { mode, points: [{ x, y, color:'#rrggbb' }] (2..6, x/y — доли экрана), warp, speed, grain, density }` (числа 0..1), чистится `cleanMesh()`.
    `mode` — узор поверх меша: `mesh` (пятна) | `ribbed` (рифлёное стекло) | `halftone` | `flow` (неоновые ленты) | `ripple` (рельеф); всё в одном шейдере (`uMode`).
    Заготовки — `Mesh.PRESETS` (точка 0 обычно самая тёмная — она же фон у полутона и неона), миниатюры рисует `Mesh.thumb()` на общем невидимом канвасе.
    Весит ~200 байт — годится для `storage.sync`. Без WebGL — CSS-градиенты из тех же точек (`Mesh.cssPreview`).
- `widgets` — массив `{ id, type, data }`, общий для всех экранов; `data` = дефолты виджета + пользовательские поля
- `layouts` — `{ md?, lg? }`, в каждом `{ [id]: { x, y, w, h } }`. Диапазоны по `innerWidth` (CSS px): `sm` <700, `md` 700–1399, `lg` ≥1400.
  - Нет своей раскладки у диапазона — показывается ближайшая (`SOURCES` в `app.js`), при первой правке (drag/resize/добавление) она форкается.
  - `sm` — стопка в одну колонку (`body.narrow`, CSS-override позиций gridstack), своей раскладки нет, редактор выключен.
  - Удаление виджета — общее для всех диапазонов; блок без позиции в диапазоне gridstack ставит сам и позиция запоминается.
- `layout` — старый ключ v0.1 (один общий массив с x/y), при загрузке мигрирует в `widgets` + `layouts.lg` и удаляется.
- `wx:<город>` — кэш погоды на 30 минут; без сети виджет показывает кэш до суток с пометкой «нет сети»
- В памяти `layout` (в `app.js`) — те же объекты из `widgets` с наложенными x/y/w/h текущего диапазона.
- Всё из хранилища и импорта проходит через `cleanState()` / `cleanSettings()` — неизвестные типы и мусор выкидываются, а не роняют страницу.

Сетка: `COLS=24`, `ROWS=12`, `cellHeight = (innerHeight - 2*PAD) / ROWS` (пересчёт на resize), `float: true`, `maxRow: ROWS`.
Координаты в layout — в ячейках сетки, не в пикселях.

## Как устроен виджет
Запись в `Widgets` (`js/widgets.js`):
```js
myWidget: {
  title: 'Название',                 // в меню «+ Виджет» и в тулбаре блока
  size: { w, h }, min: { w, h },     // размер по умолчанию и минимальный (в ячейках)
  defaults: { glass: true, ... },    // дефолтный data
  settings: [ { key, label, type: 'toggle'|'select'|'text'|'links'|'align', options? } ],
  render(body, data, ctx) {          // body — .w-body (container-type: size)
    // ctx.save()      — сохранить layout (после мутации data)
    // ctx.rerender()  — перерисовать этот виджет
    // ctx.modal({...})— модалка с полями
    // ctx.settings()  — глобальные настройки
    return { destroy() {} };         // обязательно чистить таймеры/слушатели
  },
}
```
- Размеры контента внутри виджета — через container query единицы (`cqw`, `cqh`) и `@container`, чтобы блок масштабировался при ресайзе.
- В режиме редактирования `.w-body` получает `pointer-events: none` (чтобы блок таскался), тулбар `.w-tools` исключён из drag через `draggable.cancel`.
- Новые типы полей настроек добавляются в `openModal()` в `app.js`.
- Системных `<select>` нет: `select` с ≤3 вариантами рисуется сегментами (`segmented()`), больше — своим списком (`dropdown()`, список рендерится в `body`, иначе `.modal` с `overflow`/`backdrop-filter` его обрежет). `align` — схема 3×3, значения `top|middle|bottom-left|center|right` (`normAlign()` понимает старые `left/center/right`).

## Режим редактирования
`body.editing` + `grid.setStatic(false)`. Хоткей `E` (и `У` в русской раскладке), `Esc` — выход. Точки сетки — `#guides` (CSS-фон с `--cw/--ch`).

## Тестирование
- `npm i` → `npx playwright install chromium` (один раз) → `npm test`.
- Тест грузит расширение через `--load-extension`, мокает Open-Meteo, таскает/ресайзит блоки, добавляет виджет, перезагружает и сверяет layout. Скрины → `tests/shots/`.
- После изменений UI — прогоняй тест и **смотри скрины**, а не только exit code.
- Ручная проверка: `chrome://extensions` → режим разработчика → «Загрузить распакованное» → `plitka/`; после правок — ↻ на карточке расширения.

## Грабли
- Внутри `.clock-time` градиент через `background-clip: text` — у вложенных `span` задавай `color` явно, иначе они невидимы.
- На `body` стоит `font-feature-settings: 'tnum' 0`, а оно перебивает `font-variant-numeric: tabular-nums`. Нужны моноширинные цифры — пиши `font-feature-settings: 'tnum' 1`. Для основного времени часов tnum не включать: единица становится слишком широкой.
- Меш-фон рендерится в ~0.35 разрешения экрана и ≤30 fps (градиент гладкий, растяжение не видно); в скрытой вкладке rAF и так стоит. Цвета смешиваются в sRGB, не в линейном — в линейном всё выцветает. Под ним стеклянные блоки пересчитывают `backdrop-filter` каждый кадр — на слабом железе проверять.
- Иконки сайтов: Google s2 → favicon.yandex.net → буква-монограмма. Внутренний `_favicon` Chrome отдаёт серый глобус для непосещённых сайтов — поэтому не используется.
- `chrome.storage.local` без `unlimitedStorage` — 10 МБ; фон-картинка ужимается до 2560px JPEG.
- Если нужен `chrome.storage.sync`: лимит ~100 КБ всего и 8 КБ на ключ — картинки туда нельзя.
- Firefox: `chrome.*` работает через совместимость, но `unlimitedStorage` и часть CSS (`backdrop-filter` ок, `color-mix` ок с 113+) проверять отдельно.
