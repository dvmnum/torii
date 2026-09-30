import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Смоук-тест: грузит расширение в Chromium, гоняет редактор, проверяет сохранение раскладки.
// Запуск из корня проекта: npm test   (скрины → tests/shots)
const ext = path.resolve('plitka');
const out = process.env.OUT || path.resolve('tests/shots');
fs.mkdirSync(out, { recursive: true });
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plitka-pw-'));

const ctx = await chromium.launchPersistentContext(userDir, {
  headless: true,
  channel: 'chromium',
  viewport: { width: 1600, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});

// подсовываем ответы Open-Meteo, чтобы тест не зависел от сети
await ctx.route('https://geocoding-api.open-meteo.com/**', r => r.fulfill({ json: { results: [{ name: 'Москва', latitude: 55.75, longitude: 37.62 }] } }));
await ctx.route('https://api.open-meteo.com/**', r => r.fulfill({ json: { current: { temperature_2m: 11.4, weather_code: 2 }, daily: { temperature_2m_max: [14.2], temperature_2m_min: [7.8] } } }));
const errors = [];
const page = await ctx.newPage();
page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message));

// id расширения
await page.goto('chrome://extensions');
const id = await page.evaluate(() => new Promise(r => chrome.management.getAll(l => r(l.find(x => x.name.startsWith('Plitka'))?.id))));
console.log('ext id', id);
const url = `chrome-extension://${id}/newtab.html`;

await page.goto(url);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/01-home.png` });

// редактор
await page.keyboard.press('e');
await page.waitForTimeout(600);
await page.hover('.grid-stack-item[gs-id="w-notes"]');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/02-edit.png` });

// перетаскиваем заметки влево-вниз
const notes = await page.locator('.grid-stack-item[gs-id="w-notes"]').boundingBox();
await page.mouse.move(notes.x + notes.width / 2, notes.y + notes.height / 2);
await page.mouse.down();
await page.mouse.move(notes.x - 1000, notes.y + 300, { steps: 20 });
await page.mouse.up();
await page.waitForTimeout(500);

// растягиваем часы за правый нижний угол
const clock = await page.locator('.grid-stack-item[gs-id="w-clock"]').boundingBox();
await page.hover('.grid-stack-item[gs-id="w-clock"]');
await page.mouse.move(clock.x + clock.width - 10, clock.y + clock.height - 10);
await page.mouse.down();
await page.mouse.move(clock.x + clock.width + 250, clock.y + clock.height + 40, { steps: 15 });
await page.mouse.up();
await page.waitForTimeout(500);

// добавить виджет
await page.click('#btn-add');
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/03-add-menu.png` });
await page.click('.add-item:has-text("Заметки")');
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/04-after-edit.png` });

const before = await page.evaluate(() => JSON.stringify(window.__plitka.layout.map(i => [i.id, i.x, i.y, i.w, i.h])));
await page.click('#btn-done');
await page.waitForTimeout(500);

// перезагрузка — раскладка должна сохраниться
await page.reload();
await page.waitForTimeout(1500);
const after = await page.evaluate(() => JSON.stringify(window.__plitka.layout.map(i => [i.id, i.x, i.y, i.w, i.h])));
console.log('layout before reload', before);
console.log('layout after  reload', after);
console.log('persisted:', before === after);
await page.screenshot({ path: `${out}/05-reloaded.png` });

// настройки
await page.click('#btn-settings');
await page.fill('.panel input[type=text]', 'Влад');
await page.click('.bg-swatch[data-bg="dusk"]');
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/06-settings.png` });
await page.click('.panel [data-close]');

// модалка ссылок
await page.keyboard.press('e');
await page.waitForTimeout(400);
await page.hover('.grid-stack-item[gs-id="w-links"]');
await page.click('.grid-stack-item[gs-id="w-links"] .tool[title="Настроить"]');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/07-links-settings.png` });

await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
const fails = [];
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails.push(what); };

// погода без сети: заглушка, потом сама подтягивается, когда сеть вернулась
await ctx.unroute('https://api.open-meteo.com/**');
await ctx.route('https://api.open-meteo.com/**', r => r.abort('internetdisconnected'));
await page.evaluate(() => chrome.storage.local.remove('wx:москва'));
await page.reload();
await page.waitForTimeout(1200);
check(await page.locator('.w-weather.is-error:has-text("Нет связи")').count() === 1, 'погода: заглушка без сети');
await page.screenshot({ path: `${out}/08-weather-offline.png` });
await ctx.unroute('https://api.open-meteo.com/**');
await ctx.route('https://api.open-meteo.com/**', r => r.fulfill({ json: { current: { temperature_2m: 3, weather_code: 61 }, daily: { temperature_2m_max: [5], temperature_2m_min: [1] } } }));
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForTimeout(800);
check(await page.locator('.w-weather .wx-temp:has-text("3°")').count() === 1, 'погода: восстановилась после online');

// битое хранилище: неизвестный тип, мусор в координатах и настройках — страница живая
await page.evaluate(() => chrome.storage.local.set({
  widgets: [null, { type: 'nope' }, { id: 'x', type: 'clock', data: [1] }, { id: 'x', type: 'search' }],
  layouts: { lg: { x: { x: 'abc', y: 99, w: 500, h: -3 } }, md: 'мусор' },
  settings: { bg: 'zzz', radius: 'big', glassBlur: NaN, name: 42 },
}));
const errsBefore = errors.length;
await page.reload();
await page.waitForTimeout(1200);
const items = await page.evaluate(() => window.__plitka.layout.map(i => [i.id, i.type, i.x, i.y, i.w, i.h]));
console.log('cleaned layout', JSON.stringify(items));
check(items.length === 2 && new Set(items.map(i => i[0])).size === 2, 'битый layout: выжили 2 блока с разными id');
check(items.every(([, , x, y, w, h]) => x >= 0 && y >= 0 && x + w <= 24 && y + h <= 12), 'битый layout: всё внутри сетки');
check(errors.slice(errsBefore).every(e => /Failed to load resource/i.test(e)), 'битый layout: без ошибок в консоли');
await page.screenshot({ path: `${out}/09-broken-storage.png` });

// кривой импорт: тост, ничего не меняется
const layoutBefore = await page.evaluate(() => JSON.stringify(window.__plitka.layout));
await page.click('#btn-settings');
for (const bad of ['не json вообще', JSON.stringify({ app: 'plitka', layout: [{ type: 'nope' }] })]) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.panel button:has-text("Импорт")')]);
  await chooser.setFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(bad) });
  await page.waitForTimeout(400);
}
check(await page.locator('.toast:has-text("не мой бэкап")').count() >= 1, 'импорт: тост про кривой файл');
check(layoutBefore === await page.evaluate(() => JSON.stringify(window.__plitka.layout)), 'импорт: раскладка не тронута');
await page.screenshot({ path: `${out}/10-bad-import.png` });
await page.click('.panel [data-close]');

// миграция с v0.1: старый ключ layout → widgets + layouts.lg
const legacy = [
  { id: 'w-clock', type: 'clock', x: 2, y: 1, w: 10, h: 4, data: { seconds: true } },
  { id: 'w-notes', type: 'notes', x: 15, y: 3, w: 5, h: 6, data: { text: 'старая заметка' } },
];
await page.evaluate((l) => chrome.storage.local.clear().then(() => chrome.storage.local.set({ layout: l })), legacy);
await page.reload();
await page.waitForTimeout(1000);
const mig = await page.evaluate(() => chrome.storage.local.get(null));
check(!mig.layout && mig.widgets?.length === 2 && mig.widgets[1].data.text === 'старая заметка', 'миграция: виджеты и данные перенесены, старый ключ удалён');
check(['x', 'y', 'w', 'h'].map(k => mig.layouts?.lg?.['w-clock']?.[k]).join() === '2,1,10,4', 'миграция: позиции ушли в lg');

// ---------- разные экраны ----------
const snap = () => page.evaluate(() => ({
  bucket: window.__plitka.bucket,
  pos: Object.fromEntries(window.__plitka.layout.map(i => [i.id, [i.x, i.y, i.w, i.h]])),
  own: Object.keys(window.__plitka.layouts),
  overlap: (() => {
    const n = window.__plitka.grid.engine.nodes;
    for (let i = 0; i < n.length; i++) for (let j = i + 1; j < n.length; j++) {
      const a = n[i], b = n[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return `${a.id}×${b.id}`;
    }
    return null;
  })(),
}));
const resize = async (width, height) => { await page.setViewportSize({ width, height }); await page.waitForTimeout(700); };
const drag = async (id, dx, dy) => {
  const b = await page.locator(`.grid-stack-item[gs-id="${id}"]`).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(500);
};

await page.evaluate(() => chrome.storage.local.clear());
await page.setViewportSize({ width: 2560, height: 1440 });
await page.reload();
await page.waitForTimeout(1200);
let s = await snap();
check(s.bucket === 'lg', 'экраны: 2560 → lg');
await page.keyboard.press('e');
await page.waitForTimeout(300);
await drag('w-weather', 0, 700);
await page.keyboard.press('Escape');
const lg = await snap();
check(lg.pos['w-weather'][1] > 0, 'экраны: погода на lg сдвинута вниз');
await page.screenshot({ path: `${out}/11-lg-2560.png` });

await resize(1366, 768);
s = await snap();
check(s.bucket === 'md' && !s.own.includes('md'), 'экраны: 1366 → md, своей раскладки ещё нет');
check(JSON.stringify(s.pos) === JSON.stringify(lg.pos), 'экраны: md без своей раскладки показывает lg');

await page.keyboard.press('e');
await page.waitForTimeout(300);
await drag('w-notes', -500, 0);
await page.keyboard.press('Escape');
const md = await snap();
check(md.own.includes('md'), 'экраны: правка на md создала свою раскладку');
check(md.pos['w-notes'][0] < lg.pos['w-notes'][0], 'экраны: заметки на md сдвинуты влево');
check(!md.overlap, 'экраны: на md ничего не перекрывается');
await page.screenshot({ path: `${out}/12-md-1366.png` });

await resize(2560, 1440);
s = await snap();
check(JSON.stringify(s.pos) === JSON.stringify(lg.pos) && !s.overlap, 'экраны: вернулись на 2560 — раскладка lg не тронута');
await resize(1366, 768);
await page.reload();
await page.waitForTimeout(1200);
s = await snap();
check(JSON.stringify(s.pos) === JSON.stringify(md.pos), 'экраны: md пережила перезагрузку');

await resize(600, 900);
s = await snap();
check(s.bucket === 'sm' && await page.evaluate(() => document.body.classList.contains('narrow')), 'экраны: 600 → стопка');
const boxes = await page.$$eval('.grid-stack-item', els => els.map(e => e.getBoundingClientRect()).map(r => [r.left, r.top, r.width, r.height]).sort((a, b) => a[1] - b[1]));
check(boxes.every((b, i) => b[2] === boxes[0][2] && (i === 0 || b[1] >= boxes[i - 1][1] + boxes[i - 1][3] - 1)), 'экраны: блоки стопкой одинаковой ширины, без наложений');
await page.keyboard.press('e');
await page.waitForTimeout(300);
check(!(await page.evaluate(() => document.body.classList.contains('editing'))), 'экраны: на узком редактор не включается');
await page.screenshot({ path: `${out}/13-sm-600.png`, fullPage: true });
await page.evaluate(() => document.body.scrollTo(0, 99999));
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/14-sm-600-scrolled.png` });
s = await snap();
check(JSON.stringify(s.pos) === JSON.stringify(md.pos), 'экраны: стопка не портит сохранённые позиции');

// ---------- часы, поиск, свои контролы ----------
await page.evaluate(() => chrome.storage.local.clear());
await page.setViewportSize({ width: 1600, height: 900 });
await page.reload();
await page.waitForTimeout(1200);
const openSettings = async (id) => {
  if (!(await page.evaluate(() => document.body.classList.contains('editing')))) await page.keyboard.press('e');
  await page.waitForTimeout(300);
  await page.hover(`.grid-stack-item[gs-id="${id}"]`);
  await page.click(`.grid-stack-item[gs-id="${id}"] .tool[title="Настроить"]`);
  await page.waitForTimeout(400);
};

// секунды не двигают основное время
await openSettings('w-clock');
await page.click('.modal .field-toggle:has-text("Секунды")');
await page.click('.modal button[type=submit]');
await page.keyboard.press('Escape');
const colonX = [];
for (let i = 0; i < 4; i++) {
  colonX.push(await page.$eval('.clock-time .colon', el => el.getBoundingClientRect().left));
  await page.waitForTimeout(1000);
}
console.log('colon x по секундам', colonX.join(', '));
check(colonX.every(x => Math.abs(x - colonX[0]) < 0.5), 'часы: секунды не двигают основное время');
await page.screenshot({ path: `${out}/15-clock-seconds.png` });

// модалка часов: сегменты + схема выравнивания
await openSettings('w-clock');
check(await page.locator('.modal select').count() === 0, 'модалка: системных select нет');
check(await page.locator('.modal .align-picker .al-cell').count() === 9, 'модалка: выравнивание — 9 позиций');
check(await page.locator('.modal .al-cell[data-v="middle-center"].active').count() === 1, 'модалка: текущее выравнивание подсвечено');
await page.click('.modal .seg-btn:has-text("Стрелочные")');
await page.click('.modal .al-cell[data-v="top-left"]');
await page.screenshot({ path: `${out}/16-clock-modal.png` });
await page.click('.modal button[type=submit]');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check(await page.locator('.w-clock.is-analog.v-top.h-left svg.clock-face .hand-s').count() === 1, 'часы: стрелочные, сверху слева, с секундной');
await page.screenshot({ path: `${out}/17-clock-analog.png` });

// старое значение align 'right' понимается
await page.waitForTimeout(400);
await page.evaluate(async () => {
  const { widgets } = await chrome.storage.local.get('widgets');
  Object.assign(widgets.find(i => i.id === 'w-clock').data, { align: 'right', style: 'digital' });
  await chrome.storage.local.set({ widgets });
});
await page.reload();
await page.waitForTimeout(1000);
check(await page.locator('.w-clock.v-middle.h-right').count() === 1, 'часы: старое align "right" → середина справа');

// поиск: выпадающий список с клавиатуры
await openSettings('w-search');
await page.click('.modal .dd-btn');
await page.waitForTimeout(250);
check(await page.locator('body > .dd-list .dd-item').count() === 4, 'поиск: список поисковиков открыт');
await page.screenshot({ path: `${out}/18-dropdown.png` });
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
check(await page.locator('.dd-list').count() === 0 && (await page.textContent('.modal .dd-label')) === 'Google', 'поиск: выбор стрелкой + Enter');
await page.click('.modal .dd-btn');
await page.keyboard.press('Escape');
check(await page.locator('.dd-list').count() === 0 && await page.locator('#modal.open').count() === 1, 'поиск: Esc закрывает список, а не модалку');
await page.click('.modal button[type=submit]');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check(await page.evaluate(() => window.__plitka.layout.find(i => i.id === 'w-search').data.engine) === 'google', 'поиск: поисковик сохранён');
await page.fill('[data-search]', 'котики');
await page.waitForTimeout(400);
check(await page.locator('.w-search.has-text .search-go').count() === 1, 'поиск: кнопка Enter подсвечена, когда есть текст');
await page.screenshot({ path: `${out}/19-search-enter.png` });

// ---------- меш-фон ----------
await page.fill('[data-search]', '');
await page.click('#btn-settings');
await page.click('.bg-swatch[data-bg="mesh"]');
await page.waitForTimeout(800);
check(await page.evaluate(() => document.body.classList.contains('mesh-on')), 'меш: WebGL-фон включился');
check(await page.locator('.mesh-preview .mesh-dot').count() === 4, 'меш: 4 точки в редакторе');
await page.screenshot({ path: `${out}/20-mesh-editor.png` });

const dot = await page.locator('.mesh-dot').first().boundingBox();
const prev = await page.locator('.mesh-preview').boundingBox();
await page.mouse.move(dot.x + 10, dot.y + 10);
await page.mouse.down();
await page.mouse.move(prev.x + prev.width * 0.8, prev.y + prev.height * 0.7, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(400);
const p0 = await page.evaluate(() => window.__plitka.settings().mesh.points[0]);
check(Math.abs(p0.x - 0.8) < 0.05 && Math.abs(p0.y - 0.7) < 0.05, `меш: точка перетащена (${p0.x}, ${p0.y})`);

const colorsBefore = await page.evaluate(() => window.__plitka.settings().mesh.points.map(p => p.color).join());
await page.click('.mesh-tools button:has-text("Случайный")');
await page.waitForTimeout(400);
check(colorsBefore !== await page.evaluate(() => window.__plitka.settings().mesh.points.map(p => p.color).join()), 'меш: «Случайный» меняет цвета');
await page.click('.mesh-tools button:has-text("+ Точка")');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/21-mesh-random.png` });
const meshSaved = await page.evaluate(() => JSON.stringify(window.__plitka.settings().mesh));
await page.click('.panel [data-close]');
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/22-mesh-bg.png` });

await page.reload();
await page.waitForTimeout(1200);
check(meshSaved === await page.evaluate(() => JSON.stringify(window.__plitka.settings().mesh)), 'меш: пережил перезагрузку');
check(await page.evaluate(() => document.body.classList.contains('mesh-on')), 'меш: после перезагрузки снова живой');
await page.evaluate(() => chrome.storage.local.set({ settings: { bg: 'mesh', mesh: { points: [{ color: 'red' }, 5], warp: 'x', speed: 9 } } }));
await page.reload();
await page.waitForTimeout(1000);
const cleaned = await page.evaluate(() => window.__plitka.settings().mesh);
check(cleaned.points.length === 4 && cleaned.speed === 1, 'меш: кривые параметры чистятся');

const real = errors.filter(e => !/Failed to load resource/i.test(e));
if (fails.length) { console.error('FAIL:', fails.join('; ')); process.exitCode = 1; }
console.log('errors:', real.length ? real.join('\n') : 'none');
await ctx.close();
fs.rmSync(userDir, { recursive: true, force: true });
if (before !== after || real.length) { console.error('FAIL'); process.exit(1); }
console.log('OK');
