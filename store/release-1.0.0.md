# Выкладка Torii 1.0.0 — первый полноценный релиз

Проверено перед сборкой: e2e, тест закладок, смоук в Firefox — зелёные; `web-ext lint` — 0 ошибок; переводы — без пропусков на всех шести языках; вкладка открывается за ~84 мс, долгих задач нет.
Новых разрешений нет — раздел «Конфиденциальность» в магазинах не трогаем.

## Файлы

| Что | Файл |
|---|---|
| Пакет для Chrome Web Store (и Edge, Яндекс, Opera) | `dist/torii-1.0.0-chrome.zip` |
| Пакет для Firefox (AMO) | `dist/torii-1.0.0-firefox.zip` |
| Скриншоты 1280×800 (по порядку 1→5) | `store/screenshots/en/`, `store/screenshots/ru/` |
| Маленькая промо-плитка 440×280 | `store/promo-440x280-en.png`, `-ru.png` |
| Большое промо 1400×560 | `store/marquee-1400x560-en.png`, `-ru.png` |
| Описания | `store/listing-en.md`, `-ru`, `-es`, `-de`, `-fr`, `-pt` |

---

## Chrome Web Store

1. Консоль разработчика → Torii → **Пакет** → **Загрузить новый пакет** → `dist/torii-1.0.0-chrome.zip`.
2. **Описание продукта**, язык **English**:
   - Description — раздел «Detailed description» из `listing-en.md` (обновлён: «Дуо», свои иконки, правка закладок, правый клик, языки);
   - глобальные скриншоты — удалить старые, загрузить 5 из `store/screenshots/en/`;
   - промо 440×280 и 1400×560 — `-en.png`.
3. Язык **Русский**: описание из `listing-ru.md`, локализованные скриншоты из `store/screenshots/ru/`, промо `-ru.png`.
4. Языки **Spanish**, **German**, **French**, **Portuguese (Brazil)** — появятся в списке сами (в пакете есть `_locales`). Для каждого — только Description из `listing-es/de/fr/pt.md`. Скриншоты не заливать: возьмутся глобальные английские. Название и краткое описание магазин берёт из пакета.
5. **Сохранить черновик** → **Отправить на проверку**.

---

## Firefox (addons.mozilla.org)

1. Кабинет → Torii → **Загрузить новую версию** → `dist/torii-1.0.0-firefox.zip`. Платформа — только Firefox.
2. «Нужно ли отправлять исходный код?» — **Нет**.
3. **Примечания к версии** (видят пользователи):

```
• 6 interface languages: English, Russian, Spanish, German, French and Portuguese
• Right-click menus on every widget and on the background
• Edit your bookmarks right on the new tab: drag to reorder, iOS-like folders, a tree of all bookmarks
• Custom icons for links and bookmarks — your own picture or a color
• New weather layout; weather shows instantly from memory
• New "Duo" clock style
• A widget at the edge of the screen grows the other way when you resize it
```

4. **Примечания для проверяющих**:

```
No build step: all code is plain unminified JS as shipped. js/lib/gridstack-all.js is the unmodified dist file of gridstack v14 from npm. js/engine-icons.js is plain SVG icon data (Simple Icons, Font Awesome). Source: https://github.com/dvmnum/torii

New in 1.0.0: interface dictionaries in js/lang/*.js (es, de, fr, pt) are bundled in the package and loaded with a <script> tag from the extension itself — no remote code. No new permissions.

innerHTML warnings: innerHTML is only assigned our own static SVG icons and markup defined in the code. No remote data is inserted via innerHTML; the only user-entered text in those places (the greeting name) is HTML-escaped.
```

5. **Управление отображением** → переключатель языка вверху → добавить **Español**, **Deutsch**, **Français**, **Português (do Brasil)** и вставить описания из `listing-es/de/fr/pt.md`. Английское и русское описания — обновить из `listing-en.md` / `listing-ru.md`.
6. **Изображения** — заменить скриншоты на новые из `store/screenshots/en/`. Подписи (EN / RU):
   1. `Your new tab — widgets anywhere you want` / `Твоя новая вкладка — блоки где угодно`
   2. `Drag, resize, add widgets` / `Двигай, растягивай, добавляй виджеты`
   3. `Live backgrounds and effects` / `Живые фоны и эффекты`
   4. `Weather, to-dos, habits, pomodoro and more` / `Погода, дела, привычки, помодоро и не только`
   5. `Saved layouts — switch with Alt+1…9` / `Раскладки — переключение по Alt+1…9`

---

## После одобрения

- Пост на Boosty / Telegram про 1.0 (языки, правый клик, закладки).
- Черновик для Хабра — `extras/habr-post.md` (дописать про новые языки и правку закладок, если пойдёт после выхода).
