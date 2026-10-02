import { firefox } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// Смоук в движке Firefox (npm run test:firefox): Playwright не умеет ставить расширения в Firefox,
// поэтому открываем саму страницу вкладки с локального сервера, а API расширения подменяем заглушкой
// (Store в этом случае работает через localStorage). Ловит ошибки скриптов и вёрстки, специфичные для Gecko.
// Настоящую проверку расширения — about:debugging → «Загрузить временное дополнение» → dist/firefox/manifest.json.
const ROOT = path.resolve('plitka');
const out = path.resolve('tests/shots');
fs.mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/newtab.html`;

const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
// «CORS request did not succeed» — так Firefox сообщает о запросах, которые тест сам оборвал (сеть наружу выключена)
page.on('console', m => { if (m.type() === 'error' && !/CORS request did not succeed/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
// сеть наружу не нужна: погода и прочее — заглушки
await page.route(/open-meteo|cbr-xml|cataas|nekos|favicon|google\.com/, r => r.abort());
await page.addInitScript(() => {
  window.chrome = { runtime: { id: 'torii-test', getManifest: () => ({ version: 'ff' }), lastError: null } };
});

const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails.push(what); };
const fails = [];

await page.goto(url);
await page.waitForTimeout(1500);
check(await page.locator('.grid-stack-item').count() >= 4, `firefox: стандартная раскладка на экране (${await page.locator('.grid-stack-item').count()} блоков)`);
check(await page.evaluate(() => document.fonts.check('16px Manrope')), 'firefox: шрифт Manrope подгрузился (format woff2)');
await page.screenshot({ path: `${out}/ff-01-home.png` });

// все виджеты разом + жидкое стекло в настройках (в Firefox должно тихо стать обычным)
const all = ['clock', 'greeting', 'search', 'links', 'notes', 'weather', 'todo', 'pomodoro', 'countdown', 'habits', 'quote', 'word', 'rates', 'pic'];
await page.evaluate((all) => {
  localStorage.setItem('settings', JSON.stringify({ glassKind: 'liquid', fx: { vignette: .4, particles: .3 } }));
  localStorage.setItem('widgets', JSON.stringify(all.map((type, i) => ({ id: 'f' + i, type, data: type === 'weather' ? { view: 'details' } : {} }))));
  localStorage.setItem('layouts', JSON.stringify({ lg: Object.fromEntries(all.map((t, i) => ['f' + i, { x: (i % 4) * 6, y: Math.floor(i / 4) * 3, w: 6, h: 3 }])) }));
}, all);
await page.reload();
await page.waitForTimeout(2000);
check(await page.locator('.grid-stack-item').count() === all.length, `firefox: все ${all.length} виджетов отрисованы`);
const notesPh = await page.getAttribute('.notes-text', 'placeholder');
check(!/[А-Яа-яЁё]/.test(notesPh), `firefox (английский): подсказка заметок переведена («${notesPh}»)`);
check(await page.evaluate(() => !document.querySelector('.w.liquid') || !/url\(/.test(getComputedStyle(document.querySelector('.w.liquid')).backdropFilter)), 'firefox: жидкое стекло не включается (нет поддержки) — обычное стекло');
check(await page.evaluate(() => CSS.supports('backdrop-filter', 'blur(4px)') && CSS.supports('selector(:has(a))') && CSS.supports('container-type', 'size')), 'firefox: backdrop-filter, :has(), container queries на месте');
check(await page.evaluate(() => document.body.classList.contains('mesh-on') || document.body.classList.contains('no-webgl')), 'firefox: фон (WebGL или запасной CSS) готов');
await page.screenshot({ path: `${out}/ff-02-widgets.png` });

// редактор и панель настроек
await page.keyboard.press('e');
await page.waitForTimeout(400);
check(await page.evaluate(() => document.body.classList.contains('editing')), 'firefox: редактор включается');
await page.click('.scene-btn');
await page.waitForTimeout(300);
check(await page.locator('.scene-menu').isVisible(), 'firefox: список раскладок открывается');
await page.screenshot({ path: `${out}/ff-03-edit.png` });
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await page.click('#btn-settings');
await page.waitForTimeout(600);
for (const tab of ['bg', 'fx', 'blocks', 'tab', 'more']) {
  await page.click(`.panel-tab[data-ptab="${tab}"]`);
  await page.waitForTimeout(250);
}
check(await page.locator('.panel.open').count() === 1, 'firefox: панель настроек, все вкладки открываются');
await page.click('.panel-tab[data-ptab="bg"]');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/ff-04-panel.png` });

check(!errors.length, `firefox: без ошибок в консоли${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
await browser.close();
server.close();
console.log(fails.length ? `FAIL: ${fails.length}` : 'OK');
process.exit(fails.length ? 1 : 0);
