// Выкладка новой версии в магазины: npm run release
//   собирает архивы (если их нет), заливает в Chrome Web Store и Firefox (AMO) и отправляет на проверку.
//   --only cws | --only amo — только один магазин
//   --check                — только проверить ключи, ничего не заливать
//   --listing              — в AMO ещё обновить описания на всех языках из store/listing-*.md
// Ключи — в .env в корне (в git не попадает), как их получить — store/release-setup.md.
// Заметки к версии (что нового) — store/release-notes/<версия>.json: { "en-US": "...", "ru": "..." }.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => process.argv.includes(k);
const only = process.argv[process.argv.indexOf('--only') + 1];
const want = (s) => !arg('--only') || only === s;
const CHECK = arg('--check');

// .env: KEY=value построчно
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`нет ${k} в .env — см. store/release-setup.md`);
  return v;
};

const version = JSON.parse(fs.readFileSync(path.join(root, 'plitka/manifest.json'), 'utf8')).version;
const zip = (kind) => path.join(root, `dist/torii-${version}-${kind}.zip`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);

async function json(res, what) {
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body)}`);
  return body;
}

// ---------- Chrome Web Store (API v2, OAuth refresh token) ----------
const CWS_ITEM = 'eimplcpjlibipimkmaipfkidbdagknof';

async function cwsToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('CWS_CLIENT_ID'), client_secret: env('CWS_CLIENT_SECRET'),
      refresh_token: env('CWS_REFRESH_TOKEN'), grant_type: 'refresh_token',
    }),
  });
  return (await json(res, 'CWS: токен')).access_token;
}

async function cws() {
  // ключей Google нет (Google Cloud из России не завести) — в CWS заливаем руками
  if (!process.env.CWS_REFRESH_TOKEN) {
    log(`CWS: ключей нет — залей руками: консоль разработчика → Torii → Пакет → Загрузить новый пакет →\n     ${path.relative(root, zip('chrome'))} → Отправить на проверку`);
    return;
  }
  const token = await cwsToken();
  const auth = { authorization: `Bearer ${token}` };
  const item = `publishers/${env('CWS_PUBLISHER_ID')}/items/${CWS_ITEM}`;
  const status = await json(await fetch(`https://chromewebstore.googleapis.com/v2/${item}:fetchStatus`, { headers: auth }), 'CWS: статус');
  if (CHECK) { log('CWS: ключи в порядке', JSON.stringify(status).slice(0, 300)); return; }

  log(`CWS: заливаю ${path.basename(zip('chrome'))}…`);
  let up = await json(await fetch(`https://chromewebstore.googleapis.com/upload/v2/${item}:upload?uploadType=media`, {
    method: 'POST', headers: { ...auth, 'content-type': 'application/zip' }, body: fs.readFileSync(zip('chrome')),
  }), 'CWS: загрузка');
  for (let i = 0; up.uploadState === 'UPLOAD_IN_PROGRESS' && i < 30; i++) {
    await sleep(3000);
    const st = await json(await fetch(`https://chromewebstore.googleapis.com/v2/${item}:fetchStatus`, { headers: auth }), 'CWS: статус');
    up = { ...up, uploadState: st.lastAsyncUploadState || st.uploadState || up.uploadState, st };
  }
  if (up.uploadState && !/SUCCEEDED|SUCCESS/.test(up.uploadState)) throw new Error('CWS: загрузка не прошла: ' + JSON.stringify(up));
  log(`CWS: загружено (${up.crxVersion || version}), отправляю на проверку…`);
  const pub = await json(await fetch(`https://chromewebstore.googleapis.com/v2/${item}:publish`, {
    method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: '{}',
  }), 'CWS: публикация');
  log('CWS: отправлено на проверку', pub.state ? `(${pub.state})` : '');
}

// ---------- Firefox (AMO API v5, JWT) ----------
const AMO = 'https://addons.mozilla.org/api/v5';
const AMO_ADDON = 'torii-new-tab';

function amoAuth() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ iss: env('AMO_KEY'), jti: crypto.randomUUID(), iat: now, exp: now + 240 });
  const sig = crypto.createHmac('sha256', env('AMO_SECRET')).update(`${head}.${body}`).digest('base64url');
  return { authorization: `JWT ${head}.${body}.${sig}` };
}

// «Подробное описание» из store/listing-*.md: от заголовка раздела до следующей черты --- (или до конца файла)
function listingText(file) {
  const md = fs.readFileSync(path.join(root, 'store', file), 'utf8').replace(/\r/g, '');
  const at = md.search(/^## (?:Detailed description|Подробное описание)/m);
  if (at < 0) throw new Error('нет описания в ' + file);
  return md.slice(at).replace(/^[^\n]*\n/, '').split(/\n---/)[0].replace(/^\([^\n]*\)\n/, '').trim();
}

async function amo() {
  const me = await json(await fetch(`${AMO}/addons/addon/${AMO_ADDON}/`, { headers: amoAuth() }), 'AMO: карточка');
  if (CHECK) { log(`AMO: ключи в порядке, сейчас там ${me.current_version?.version}`); return; }

  if (arg('--listing')) {
    const es = listingText('listing-es.md');
    const description = {
      'en-US': listingText('listing-en.md'), ru: listingText('listing-ru.md'), 'es-ES': es,
      'es-MX': es.replace('otro ordenador', 'otra computadora'), de: listingText('listing-de.md'),
      fr: listingText('listing-fr.md'), 'pt-BR': listingText('listing-pt.md'),
    };
    await json(await fetch(`${AMO}/addons/addon/${AMO_ADDON}/`, {
      method: 'PATCH', headers: { ...amoAuth(), 'content-type': 'application/json' }, body: JSON.stringify({ description }),
    }), 'AMO: описание');
    log('AMO: описания обновлены:', Object.keys(description).join(', '));
  }

  const notesFile = path.join(root, `store/release-notes/${version}.json`);
  const release_notes = fs.existsSync(notesFile) ? JSON.parse(fs.readFileSync(notesFile, 'utf8')) : null;
  if (!release_notes) log(`AMO: нет ${path.relative(root, notesFile)} — версия уйдёт без заметок`);

  log(`AMO: заливаю ${path.basename(zip('firefox'))}…`);
  const form = new FormData();
  form.append('upload', new Blob([fs.readFileSync(zip('firefox'))], { type: 'application/zip' }), path.basename(zip('firefox')));
  form.append('channel', 'listed');
  let up = await json(await fetch(`${AMO}/addons/upload/`, { method: 'POST', headers: amoAuth(), body: form }), 'AMO: загрузка');
  for (let i = 0; !up.processed && i < 60; i++) {
    await sleep(3000);
    up = await json(await fetch(`${AMO}/addons/upload/${up.uuid}/`, { headers: amoAuth() }), 'AMO: проверка');
  }
  if (!up.valid) {
    const errs = (up.validation?.messages || []).filter(m => m.type === 'error').map(m => '  - ' + m.message);
    throw new Error('AMO: валидатор не пропустил архив\n' + (errs.join('\n') || JSON.stringify(up.validation).slice(0, 800)));
  }
  log('AMO: валидатор пропустил, создаю версию…');
  const ver = await json(await fetch(`${AMO}/addons/addon/${AMO_ADDON}/versions/`, {
    method: 'POST', headers: { ...amoAuth(), 'content-type': 'application/json' },
    body: JSON.stringify({ upload: up.uuid, ...(release_notes ? { release_notes } : {}) }),
  }), 'AMO: версия');
  log(`AMO: версия ${ver.version} отправлена (${ver.file?.status || 'на проверке'})`);
}

// ---------- запуск ----------
if (!CHECK && !['chrome', 'firefox'].every(k => fs.existsSync(zip(k)))) {
  log('Собираю архивы…');
  execSync('node scripts/build.mjs', { cwd: root, stdio: 'inherit' });
}
log(`Torii ${version}${CHECK ? ' — проверка ключей' : ''}`);
let failed = false;
for (const [name, fn] of [['cws', cws], ['amo', amo]]) {
  if (!want(name)) continue;
  try { await fn(); } catch (e) { failed = true; console.error('\n✗ ' + e.message + '\n'); }
}
process.exit(failed ? 1 : 0);
