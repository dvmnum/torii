# Выкладка одной командой — настройка (один раз)

После настройки новая версия выкладывается так:

1. Поднять версию в `plitka/manifest.json` и `package.json`, дописать `CHANGELOG.md`.
2. Написать «что нового» в `store/release-notes/<версия>.json` (`en-US` и `ru`) — это заметки к версии в Firefox.
3. `npm run release` — соберёт архивы, зальёт в Chrome Web Store и Firefox и отправит на проверку.

Дополнительно (флаги — через `node scripts/release.mjs`: в PowerShell `npm run release -- --флаг` теряет `--`, и флаг уходит самому npm):
- `node scripts/release.mjs --check` — только проверить, что ключи работают (ничего не заливает).
- `node scripts/release.mjs --listing` — в Firefox ещё обновить описания на всех языках из `store/listing-*.md`.
- `node scripts/release.mjs --only cws` или `--only amo` — только один магазин.

Описание в Chrome Web Store через API не меняется — его, если поменялось, по-прежнему вставлять руками в консоли разработчика.

Ключи лежат в файле `.env` в корне проекта (образец — `.env.example`). Он в `.gitignore` — **никогда не коммить его и никому не показывай**: по этим ключам можно выложить версию от твоего имени.

---

## Firefox (5 минут)

1. Зайди на https://addons.mozilla.org/developers/addon/api/key/ (под своим аккаунтом разработчика).
2. «Создать новые учётные данные» (Generate new credentials).
3. Скопируй в `.env`:
   - **JWT issuer** → `AMO_KEY=`
   - **JWT secret** → `AMO_SECRET=`

## Chrome Web Store — руками

Для ключей нужен проект в Google Cloud, а там при регистрации надо указать страну; Россию Google Cloud может не пустить, а чужая страна — ложные данные на том же Google-аккаунте, где консоль CWS (риск для аккаунта разработчика). Поэтому в CWS заливаем руками: без ключей `npm run release` просто напишет, какой архив залить:

консоль разработчика → Torii → **Пакет** → **Загрузить новый пакет** → `dist/torii-<версия>-chrome.zip` → **Отправить на проверку**.

Если когда-нибудь Google Cloud станет доступен честно — ниже шаги, как получить ключи, и тогда CWS тоже пойдёт автоматически.

### Ключи для Chrome Web Store (10–15 минут)

Нужна двухэтапная проверка в Google-аккаунте разработчика (она у тебя уже есть, раз есть консоль).

1. **ID издателя.** Консоль разработчика CWS → «Издатель» (Publisher) → «Настройки» → **Publisher ID** → в `.env` как `CWS_PUBLISHER_ID=`.
2. **Проект в Google Cloud.** https://console.cloud.google.com/ → создать проект (например, `torii-release`).
3. **Включить API.** В проекте: «APIs & Services» → «Library» → найти **Chrome Web Store API** → «Enable».
4. **Экран согласия.** «APIs & Services» → «OAuth consent screen»:
   - тип **External**;
   - название — любое (`Torii release`), почта — твоя;
   - в «Test users» добавь свою почту (ту, где консоль CWS).
   Публиковать приложение не нужно — режима «Testing» хватает.
5. **Ключ OAuth.** «APIs & Services» → «Credentials» → «Create credentials» → **OAuth client ID**:
   - тип **Web application**;
   - в «Authorized redirect URIs» добавь `https://developers.google.com/oauthplayground`;
   - создать → скопируй **Client ID** → `CWS_CLIENT_ID=`, **Client secret** → `CWS_CLIENT_SECRET=`.
6. **Refresh token.** Открой https://developers.google.com/oauthplayground
   - справа сверху шестерёнка → галочка **Use your own OAuth credentials** → вставь Client ID и Client secret;
   - слева в поле «Input your own scopes» впиши `https://www.googleapis.com/auth/chromewebstore` → **Authorize APIs**;
   - войди тем аккаунтом, где консоль CWS. Google предупредит, что приложение не проверено, — это твоё же приложение: «Дополнительно» → «Перейти»;
   - **Exchange authorization code for tokens** → скопируй **Refresh token** → `CWS_REFRESH_TOKEN=`.

> В режиме «Testing» Google может отозвать refresh token через 7 дней. Если `node scripts/release.mjs --check` начнёт писать `invalid_grant` — повтори шаг 6 и замени токен. Чтобы не повторять, на шаге 4 можно перевести приложение в «In production» (проверка Google для этого не нужна, пока ты единственный пользователь).

## Проверка

```bash
node scripts/release.mjs --check
```

Должно написать «AMO: ключи в порядке» (и про CWS — «залей руками», если ключей Google нет).
