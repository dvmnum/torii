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
  js/app.js            IIFE: настройки, тема, сетка, редактор, модалки, панель, тосты, хоткеи
tests/e2e.mjs          Playwright-смоук (npm test)
```

## Модель данных (chrome.storage.local)
- `settings` — `{ name, bg, bgImage(dataURL|null), bgDim, accent, glassBlur, glassAlpha, radius, motion }`
- `layout` — массив `{ id, type, x, y, w, h, data }`; `data` = дефолты виджета + пользовательские поля
- `wx:<город>` — кэш погоды на 30 минут

Сетка: `COLS=24`, `ROWS=12`, `cellHeight = (innerHeight - 2*PAD) / ROWS` (пересчёт на resize), `float: true`, `maxRow: ROWS`.
Координаты в layout — в ячейках сетки, не в пикселях.

## Как устроен виджет
Запись в `Widgets` (`js/widgets.js`):
```js
myWidget: {
  title: 'Название',                 // в меню «+ Виджет» и в тулбаре блока
  size: { w, h }, min: { w, h },     // размер по умолчанию и минимальный (в ячейках)
  defaults: { glass: true, ... },    // дефолтный data
  settings: [ { key, label, type: 'toggle'|'select'|'text'|'links', options? } ],
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

## Режим редактирования
`body.editing` + `grid.setStatic(false)`. Хоткей `E` (и `У` в русской раскладке), `Esc` — выход. Точки сетки — `#guides` (CSS-фон с `--cw/--ch`).

## Тестирование
- `npm i` → `npx playwright install chromium` (один раз) → `npm test`.
- Тест грузит расширение через `--load-extension`, мокает Open-Meteo, таскает/ресайзит блоки, добавляет виджет, перезагружает и сверяет layout. Скрины → `tests/shots/`.
- После изменений UI — прогоняй тест и **смотри скрины**, а не только exit code.
- Ручная проверка: `chrome://extensions` → режим разработчика → «Загрузить распакованное» → `plitka/`; после правок — ↻ на карточке расширения.

## Грабли
- Внутри `.clock-time` градиент через `background-clip: text` — у вложенных `span` задавай `color` явно, иначе они невидимы.
- Иконки сайтов: Google s2 → favicon.yandex.net → буква-монограмма. Внутренний `_favicon` Chrome отдаёт серый глобус для непосещённых сайтов — поэтому не используется.
- `chrome.storage.local` без `unlimitedStorage` — 10 МБ; фон-картинка ужимается до 2560px JPEG.
- Если нужен `chrome.storage.sync`: лимит ~100 КБ всего и 8 КБ на ключ — картинки туда нельзя.
- Firefox: `chrome.*` работает через совместимость, но `unlimitedStorage` и часть CSS (`backdrop-filter` ок, `color-mix` ок с 113+) проверять отдельно.
