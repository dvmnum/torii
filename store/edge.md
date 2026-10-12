# Torii в Microsoft Edge Add-ons

> **Закрыто (октябрь 2026):** Microsoft отклонил проверку аккаунта разработчика (адрес в России), апелляция тоже отклонена. Повторно с чужими данными не подаём. Edge ставит Torii из Chrome Web Store («Разрешить расширения из других магазинов») — кнопка «Edge, Яндекс, Opera» на сайте ведёт туда. Инструкция ниже — на случай, если правила изменятся.

Пакет тот же, что для Chrome — Edge на Chromium, менять ничего не нужно.

## Файлы

| Что | Файл |
|---|---|
| Пакет | `dist/torii-1.0.0-edge.zip` (копия `-chrome.zip`) |
| Логотип для магазина 300×300 | `store/logo-300x300.png` |
| Скриншоты 1280×800 (1→5) | `store/screenshots/en/`, `store/screenshots/ru/` |
| Маленькая плитка 440×280 | `store/promo-440x280-en.png`, `-ru.png` |
| Большая плитка 1400×560 | `store/marquee-1400x560-en.png`, `-ru.png` |
| Описания | `store/listing-en.md`, `-ru`, `-es`, `-de`, `-fr`, `-pt` — раздел «Detailed description» / «Подробное описание» |
| Политика конфиденциальности | https://dvmnum.github.io/torii/privacy.html |

## 0. Проверить в Edge руками (5 минут)

`edge://extensions` → «Режим разработчика» → «Загрузить распакованное» → папка `dist/chrome`. Открыть новую вкладку: поиск ищет, погода есть, «Панель закладок» просит разрешение и показывает закладки. Edge при первой подмене новой вкладки спросит «Сохранить изменения?» — это нормально, так у всех.

## 1. Пакет

Partner Center → **Microsoft Edge** → **Обзор** → **Создать расширение** → загрузить `dist/torii-1.0.0-edge.zip` → дождаться проверки пакета → **Продолжить**.

## 2. Доступность (Availability)

- **Видимость:** Public.
- **Рынки:** все.

## 3. Свойства (Properties)

- **Категория:** Productivity.
- **Требования конфиденциальности** — «Обращается ли расширение к личной информации, собирает или передаёт её?» → **Да** (город уходит в Open-Meteo, адреса сайтов — сервисам иконок; честнее ответить «да») → ссылка на политику: `https://dvmnum.github.io/torii/privacy.html`.
- **Сайт:** `https://dvmnum.github.io/torii/`
- **Контакты поддержки:** `https://github.com/dvmnum/torii/issues` — не личную почту.
- **Контент для взрослых:** Нет.

## 4. Описание в магазине (Store listings)

Языки — **English** и **Русский** обязательно, по желанию **Español**, **Deutsch**, **Français**, **Português (Brasil)**. Для каждого:

- **Description** — «Detailed description» из своего `listing-*.md`.
- **Extension Store logo** — `store/logo-300x300.png` (у всех языков один).
- **Screenshots** — en: 5 штук из `store/screenshots/en/`, ru: из `store/screenshots/ru/`; остальным языкам — английские.
- **Small promotional tile** — `promo-440x280-en.png` / `-ru.png`.
- **Large promotional tile** — `marquee-1400x560-en.png` / `-ru.png`.
- **Short description** — подставится из пакета, не трогать.
- **Search terms** (до 7, без названий брендов — CWS уже отклонял за «злоупотребление ключевыми словами»):
  - en: `new tab`, `dashboard`, `widgets`, `start page`, `live wallpaper`, `productivity`, `custom layout`
  - ru: `новая вкладка`, `виджеты`, `стартовая страница`, `живые обои`, `дашборд`, `продуктивность`, `закладки`

## 5. Отправка

**Notes for certification:**

```
Torii replaces the new tab page with a customizable dashboard: the user drags and resizes widgets (clock, search, links, weather, notes, to-dos, etc.) on a free-form grid.

No account or setup needed — open a new tab. Right-click a widget or the background for actions; press E (or the pencil icon in the bottom-right corner) to enter layout editing mode; the gear icon opens settings.

Search uses the browser's default search engine via chrome.search.query; the extension doesn't change search settings. Optional permissions (topSites, sessions + tabs, bookmarks) are requested only when the user adds the corresponding widget.

No remote code: all scripts, fonts and libraries are bundled. Network requests: Open-Meteo (weather), cbr-xml-daily.ru (currency rates), cataas.com / nekos.best (optional picture widget), Google s2 / favicon.yandex.net (site icons). No analytics. Source: https://github.com/dvmnum/torii
```

→ **Опубликовать**. Проверка — обычно до 7 рабочих дней. Письмо придёт на почту аккаунта.

## После одобрения

- Ссылку на Edge Add-ons — на сайт (кнопка «Edge» сейчас ведёт в Chrome Web Store) и в CLAUDE.md.
- Следующие версии: Partner Center → Torii → **Пакеты** → **Заменить** → новый zip → **Опубликовать**.
