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
// вкладки панели настроек: фон, эффекты, блоки, вкладка, ещё
const ptab = async (k) => { await page.click(`.panel-tab[data-ptab="${k}"]`); await page.waitForTimeout(150); };

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
await ptab('tab');
await page.fill('input[data-setting="name"]', 'Влад');
await ptab('bg');
await page.click('.mesh-preset[data-preset="dusk"]');
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
await page.evaluate(() => chrome.storage.local.remove('wx2:москва'));
await page.reload();
await page.waitForTimeout(1200);
check(await page.locator('.w-weather.is-error:has-text("Нет связи")').count() === 1, 'погода: заглушка без сети');
await page.screenshot({ path: `${out}/08-weather-offline.png` });
await ctx.unroute('https://api.open-meteo.com/**');
const week = (t) => ({ time: [...Array(7)].map((_, i) => new Date(Date.now() + i * 864e5).toISOString().slice(0, 10)), weather_code: [61, 3, 2, 0, 71, 95, 45], temperature_2m_max: [t + 2, 7, 9, 12, 1, 8, 6], temperature_2m_min: [t - 2, 2, 3, 5, -3, 4, 2] });
await ctx.route('https://api.open-meteo.com/**', r => r.fulfill({ json: { current: { temperature_2m: 3, weather_code: 61 }, daily: week(3) } }));
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
await ptab('more');
for (const bad of ['не json вообще', JSON.stringify({ app: 'plitka', layout: [{ type: 'nope' }] })]) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.panel button:has-text("Загрузить")')]);
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
await page.click('.inspector .field-toggle:has-text("Секунды")');
await page.keyboard.press('Escape'); // закрыть инспектор — всё уже применилось
await page.keyboard.press('Escape');
// замеры группируем по минуте: при смене минуты основное время честно меняет ширину
const colonX = [];
for (let i = 0; i < 4; i++) {
  colonX.push(await page.$eval('.clock-time', el => ({ x: el.querySelector('.colon').getBoundingClientRect().left, hm: el.textContent.slice(0, 5) })));
  await page.waitForTimeout(1000);
}
console.log('colon x по секундам', colonX.map(c => `${c.hm}@${c.x}`).join(', '));
const sameMinute = colonX.filter(c => c.hm === colonX[colonX.length - 1].hm);
check(sameMinute.length >= 2 && sameMinute.every(c => Math.abs(c.x - sameMinute[0].x) < 0.5), 'часы: секунды не двигают основное время');
await page.screenshot({ path: `${out}/15-clock-seconds.png` });

// модалка часов: сегменты + схема выравнивания
await openSettings('w-clock');
check(await page.locator('.inspector select').count() === 0, 'инспектор: системных select нет');
check(await page.locator('.inspector .align-picker .al-cell').count() === 9, 'инспектор: выравнивание — 9 позиций');
check(await page.locator('.inspector .al-cell[data-v="middle-center"].active').count() === 1, 'инспектор: текущее выравнивание подсвечено');
await page.click('.inspector .seg-btn:has-text("Стрелочные")');
await page.click('.inspector .al-cell[data-v="top-left"]');
await page.screenshot({ path: `${out}/16-clock-modal.png` });
await page.keyboard.press('Escape'); // закрыть инспектор — всё уже применилось
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
await page.click('.inspector .dd-btn');
await page.waitForTimeout(250);
check(await page.locator('body > .dd-list .dd-item').count() === 9, 'поиск: список поисковиков открыт');
await page.screenshot({ path: `${out}/18-dropdown.png` });
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
check(await page.locator('.dd-list').count() === 0 && (await page.textContent('.inspector .dd-label')) === 'Google', 'поиск: выбор стрелкой + Enter');
await page.click('.inspector .dd-btn');
await page.keyboard.press('Escape');
check(await page.locator('.dd-list').count() === 0 && await page.locator('.inspector').count() === 1, 'поиск: Esc закрывает список, а не инспектор');
await page.keyboard.press('Escape'); // закрыть инспектор — всё уже применилось
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
await page.click('.panel button:has-text("Настроить")');
await page.waitForTimeout(800);
check(await page.evaluate(() => document.body.classList.contains('mesh-on')), 'меш: WebGL-фон включился');
check(await page.locator('.mesh-preview .mesh-dot').count() === 4, 'меш: 4 точки в редакторе');
await page.screenshot({ path: `${out}/20-mesh-editor.png` });

await page.locator('.mesh-preview').scrollIntoViewIfNeeded();
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
await page.click('.panel button:has-text("Случайный")');
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

// пресеты: миниатюры, применение, скрин каждого на весь экран
await page.click('#btn-settings');
await page.waitForTimeout(400);
await page.waitForFunction(() => document.querySelectorAll('.mesh-preset img').length === 14, null, { timeout: 15000 }); // рисуются по одной в простое
const thumbsOk = await page.$$eval('.mesh-preset img', imgs => imgs.length === 14 && imgs.every(i => i.src.startsWith('data:image/jpeg') && i.naturalWidth > 0));
check(thumbsOk, 'пресеты: 14 миниатюр отрисованы WebGL');
await page.screenshot({ path: `${out}/23-presets-panel.png` });
const ids = await page.$$eval('.mesh-preset', els => els.map(e => e.dataset.preset));
for (const id of ids) {
  if (!(await page.locator('#settings.open').count())) { await page.click('#btn-settings'); await page.waitForTimeout(400); }
  await page.click(`.mesh-preset[data-preset="${id}"]`);
  await page.waitForTimeout(300);
  await page.click('.panel [data-close]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/24-preset-${id}.png` });
}
const last = await page.evaluate(() => window.__plitka.settings().mesh);
check(last.preset === 'graphite' && last.points[1].color === '#3a3a44', 'пресеты: последний («Графит») применился');

// смена узора через выпадающий список
await page.click('#btn-settings');
await page.waitForTimeout(300);
if (!(await page.locator('.mesh-editor').count())) await page.click('.panel button:has-text("Настроить")');
await page.waitForTimeout(400);
await page.click('.mesh-editor .dd-btn');
await page.click('body > .dd-list .dd-item:has-text("Полутон")');
await page.waitForTimeout(400);
check(await page.evaluate(() => window.__plitka.settings().mesh.mode) === 'halftone', 'узор: переключился на полутон');
check(await page.locator('.mesh-editor .field-range:has-text("Плотность")').count() === 1, 'узор: появился ползунок плотности');
await page.click('.panel [data-close]');

// ---------- свой выбор цвета в редакторе фона ----------
await page.click('#btn-settings');
await page.waitForTimeout(300);
if (!(await page.locator('.mesh-editor').count())) await page.click('.panel button:has-text("Настроить")');
await page.click('.mesh-color-btn');
await page.waitForTimeout(250);
check(await page.locator('body > .cp.open').count() === 1, 'цвет: пикер открылся');
const sv = await page.locator('.cp-sv').boundingBox();
const selBefore = await page.evaluate(() => window.__plitka.settings().mesh.points.map(p => p.color).join());
await page.mouse.click(sv.x + sv.width * 0.9, sv.y + sv.height * 0.1);
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/25-color-picker.png` });
check(selBefore !== await page.evaluate(() => window.__plitka.settings().mesh.points.map(p => p.color).join()), 'цвет: клик в квадрате меняет цвет точки');
await page.fill('.cp-hex', '#12ab34');
await page.waitForTimeout(150);
check(await page.evaluate(() => window.__plitka.settings().mesh.points.some(p => p.color === '#12ab34')), 'цвет: HEX-поле работает');
await page.keyboard.press('Escape');
check(await page.locator('.cp').count() === 0 && await page.locator('#settings.open').count() === 1, 'цвет: Esc закрывает пикер, а не панель');
await page.click('.panel [data-close]');

// ---------- старый CSS-фон → заготовка меша ----------
await page.evaluate(() => chrome.storage.local.set({ settings: { bg: 'lagoon', name: 'Тест' } }));
await page.reload();
await page.waitForTimeout(1000);
check(await page.evaluate(() => window.__plitka.settings().mesh.preset) === 'lagoon', 'миграция фона: lagoon → заготовка «Лагуна»');

// ---------- цвет текста в блоках ----------
const inkOf = (id) => page.evaluate((i) => document.querySelector(`.grid-stack-item[gs-id="${i}"] .w`).classList.contains('ink-dark'), id);
check(!(await inkOf('w-weather')), 'текст: на тёмном фоне — светлый');
await page.click('#btn-settings');
await ptab('bg');
await page.click('.mesh-preset[data-preset="petal"]');
await page.click('.panel [data-close]');
await page.waitForTimeout(600);
check(await inkOf('w-weather') || await page.evaluate(() => document.querySelector('.grid-stack-item[gs-id="w-weather"] .w').classList.contains('bg-mixed')), 'текст: на светлом «Лепестке» погода читается (тёмный текст или выровненное стекло)');
await page.screenshot({ path: `${out}/26-auto-ink-petal.png` });

// вручную: светлый текст + своя подложка
await openSettings('w-weather');
check(await page.locator('.inspector .modal-sub:has-text("Оформление")').count() === 1, 'оформление: секция в настройках виджета');
await page.click('.inspector .seg-btn:has-text("Светлый")');
await page.click('.inspector .color-btn');
await page.waitForTimeout(200);
await page.click('.cp-quick button[title="#141418"]');
await page.screenshot({ path: `${out}/27-widget-style-modal.png` });
await page.keyboard.press('Escape');
check(await page.locator('.inspector').count() === 1, 'оформление: Esc закрыл пикер, инспектор на месте');
await page.keyboard.press('Escape'); // закрыть инспектор — всё уже применилось
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const wx = await page.evaluate(() => {
  const w = document.querySelector('.grid-stack-item[gs-id="w-weather"] .w');
  return { dark: w.classList.contains('ink-dark'), tinted: w.classList.contains('tinted'), tint: w.style.getPropertyValue('--tint') };
});
check(!wx.dark && wx.tinted && wx.tint === '#141418', 'оформление: светлый текст на тёмной подложке');
await page.screenshot({ path: `${out}/28-widget-tinted.png` });

// ---------- своя картинка с эффектами ----------
// тестовое «фото»: серый фон, тёмный силуэт, оранжевая полоса — как постер с матовым стеклом
const photoUrl = await page.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 1600; c.height = 900;
  const g = c.getContext('2d');
  g.fillStyle = '#c3c4c8'; g.fillRect(0, 0, 1600, 900);
  const rg = g.createRadialGradient(800, 900, 50, 800, 800, 520);
  rg.addColorStop(0, '#050505'); rg.addColorStop(0.8, '#0c0c0e'); rg.addColorStop(1, 'rgba(12,12,14,0)');
  g.fillStyle = rg; g.beginPath(); g.ellipse(800, 760, 430, 620, 0, 0, Math.PI * 2); g.fill();
  const og = g.createLinearGradient(560, 0, 1040, 0);
  og.addColorStop(0, '#ff3a10'); og.addColorStop(0.5, '#ff8a3a'); og.addColorStop(1, '#c82008');
  g.fillStyle = og; g.fillRect(560, 330, 480, 110);
  return c.toDataURL('image/png');
});
await page.click('#btn-settings');
await page.waitForTimeout(300);
{
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.panel button:has-text("Своя картинка")')]);
  await chooser.setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(photoUrl.split(',')[1], 'base64') });
}
await page.waitForTimeout(1200);
const ph = await page.evaluate(() => ({ img: !!window.__plitka.settings().bgImage, photo: window.__plitka.settings().photo, on: document.body.classList.contains('mesh-on') }));
check(ph.img && ph.on && ph.photo.mode === 'frosted', 'картинка: загружена, по умолчанию матовое стекло на WebGL');
check(await page.locator('.mesh-editor .clear-rect:not([hidden])').count() === 1 && await page.locator('.mesh-editor .mesh-dot').count() === 0, 'картинка: редактор открыт, есть чистая область, нет точек меша');
await page.screenshot({ path: `${out}/29-photo-editor.png` });

// двигаем и растягиваем чистую область
const cr = await page.locator('.clear-rect').boundingBox();
await page.mouse.move(cr.x + cr.width / 2, cr.y + cr.height / 2);
await page.mouse.down();
await page.mouse.move(cr.x + cr.width / 2 - 30, cr.y + cr.height / 2 - 20, { steps: 6 });
await page.mouse.up();
const se = await page.locator('.cr-h.se').boundingBox();
await page.mouse.move(se.x + 6, se.y + 6);
await page.mouse.down();
await page.mouse.move(se.x + 36, se.y + 16, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(300);
const clr = await page.evaluate(() => window.__plitka.settings().photo.clear);
check(clr.x < 0.3 && clr.y < 0.34 && clr.w > 0.4, `картинка: область сдвинута и растянута (${JSON.stringify(clr)})`);
// возвращаем область на «очки», чтобы скрин был похож на пример
await page.evaluate(async () => {
  const s = window.__plitka.settings();
  await chrome.storage.local.set({ settings: { ...s, photo: { ...s.photo, clear: { x: 0.34, y: 0.35, w: 0.32, h: 0.14 } } } });
});
await page.reload();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/30-photo-frosted.png` });

// другие узоры на картинке
for (const [mode, name] of [['duotone', 'Дуотон'], ['halftone', 'Полутон'], ['ribbed', 'Рифлёное стекло']]) {
  await page.click('#btn-settings');
  await page.waitForTimeout(300);
  if (!(await page.locator('.mesh-editor').count())) await page.click('.panel button:has-text("Эффект картинки")');
  await page.click('.mesh-editor .dd-btn');
  await page.click(`body > .dd-list .dd-item:has-text("${name}")`);
  await page.waitForTimeout(300);
  if (mode === 'duotone') check(await page.locator('.mesh-editor button:has-text("Тени")').count() === 1, 'картинка: у дуотона есть цвета теней и светов');
  await page.click('.panel [data-close]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/31-photo-${mode}.png` });
}
check(await page.evaluate(() => window.__plitka.settings().photo.mode) === 'ribbed', 'картинка: узоры переключаются');

// ---------- эффекты фона ----------
await page.click('#btn-settings');
await page.waitForTimeout(300);
await ptab('fx');
for (const [k, v] of [['bloom', '0.6'], ['particles', '0.7'], ['chroma', '0.5'], ['scan', '0.4'], ['vignette', '0.8']]) {
  await page.locator(`input[data-fx="${k}"]`).fill(v);
}
await page.locator('label:has(input[data-fx="mouse"])').click();
await page.locator('label:has(input[data-fx="daycycle"])').click();
await page.waitForTimeout(300);
const fx = await page.evaluate(() => window.__plitka.settings().fx);
check(fx.bloom === 0.6 && fx.particles === 0.7 && fx.chroma === 0.5 && fx.scan === 0.4 && fx.vignette === 0.8 && fx.mouse && fx.daycycle, 'эффекты: все ползунки и переключатели сохраняются');
await page.click('.panel [data-close]');
await page.mouse.move(700, 400);
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/32-fx-all.png` });

// заготовка поверх картинки: картинка уходит, но её можно вернуть
await page.click('#btn-settings');
await page.waitForTimeout(300);
await ptab('bg');
await page.click('.mesh-preset[data-preset="neon"]');
await page.waitForTimeout(300);
check(!(await page.evaluate(() => window.__plitka.settings().bgImage)), 'заготовка: убрала картинку');
await page.click('.toast-btn:has-text("Вернуть")');
await page.waitForTimeout(500);
check(!!(await page.evaluate(() => window.__plitka.settings().bgImage)), 'заготовка: «Вернуть» возвращает картинку');
// эффекты — обратно в спокойные, чтобы не мешать остальному
await page.evaluate(() => chrome.storage.local.set({ settings: {} }));
await page.click('.panel [data-close]');

// ---------- новые виджеты ----------
// сеть: курс ЦБ, котики, аниме-гифки
const png = await page.screenshot({ clip: { x: 0, y: 0, width: 320, height: 320 } });
await ctx.route('https://www.cbr-xml-daily.ru/**', r => r.fulfill({ json: {
  Date: new Date().toISOString(),
  Valute: { USD: { Nominal: 1, Value: 81.72, Previous: 81.4 }, EUR: { Nominal: 1, Value: 95.1, Previous: 95.6 }, CNY: { Nominal: 1, Value: 11.38, Previous: 11.38 } },
} }));
await ctx.route('https://cataas.com/**', r => r.fulfill({ body: png, contentType: 'image/png' }));
await ctx.route('https://nekos.best/**', r => r.fulfill({ json: { results: [{ url: 'https://pics.test/anime.png', anime_name: 'Тестовое аниме' }] } }));
await ctx.route('https://pics.test/**', r => r.fulfill({ body: png, contentType: 'image/png' }));

const freshLayout = () => page.evaluate(() => chrome.storage.local.set({
  widgets: [{ id: 'w-clock', type: 'clock', data: {} }], layouts: { lg: { 'w-clock': { x: 0, y: 0, w: 5, h: 2 } } }, settings: {},
}));
const addViaMenu = async (title) => {
  if (!(await page.evaluate(() => document.body.classList.contains('editing')))) { await page.keyboard.press('e'); await page.waitForTimeout(300); }
  await page.click('#btn-add');
  await page.waitForTimeout(150);
  await page.click(`.add-item:has-text("${title}")`);
  await page.waitForTimeout(400);
};
const idOf = (type) => page.evaluate((t) => window.__plitka.layout.find(i => i.type === t)?.id, type);
const inW = (type, sel) => page.evaluate(([t, s]) => {
  const id = window.__plitka.layout.find(i => i.type === t)?.id;
  return document.querySelector(`.grid-stack-item[gs-id="${id}"] ${s}`);
}, [type, sel]);

await freshLayout();
await page.reload();
await page.waitForTimeout(1200);
await page.keyboard.press('e');
await page.waitForTimeout(300);
await page.click('#btn-add');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/33-add-menu-2col.png` });
await page.click('#btn-add');
await addViaMenu('Список дел');
for (const t of ['Помодоро', 'Курсы ЦБ', 'Обратный отсчёт', 'Привычки', 'Цитата']) await addViaMenu(t);
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// список дел
const todoSel = `.grid-stack-item[gs-id="${await idOf('todo')}"]`;
for (const t of ['Купить молоко', 'Позвонить маме', 'Дописать Plitka']) { await page.fill(`${todoSel} .todo-new`, t); await page.press(`${todoSel} .todo-new`, 'Enter'); }
await page.click(`${todoSel} .todo-item:has-text("Купить молоко") .todo-check`);
await page.waitForTimeout(200);
const todoOrder = await page.$$eval(`${todoSel} .todo-text`, els => els.map(e => e.textContent));
check(todoOrder.join('|') === 'Позвонить маме|Дописать Plitka|Купить молоко', 'дела: сделанное уехало вниз');
await page.dblclick(`${todoSel} .todo-text:has-text("Позвонить маме")`);
await page.keyboard.press('Control+A');
await page.keyboard.type('Позвонить бабушке');
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
check(await page.locator(`${todoSel} .todo-text:has-text("Позвонить бабушке")`).count() === 1, 'дела: двойной клик — правка');

// помодоро
const pomoSel = `.grid-stack-item[gs-id="${await idOf('pomodoro')}"]`;
const t0 = await page.textContent(`${pomoSel} .pomo-time`);
await page.click(`${pomoSel} .pomo-btn.main`);
await page.waitForTimeout(1600);
const t1 = await page.textContent(`${pomoSel} .pomo-time`);
check(t0 === '25:00' && t1 !== t0, `помодоро: идёт (${t0} → ${t1})`);
check((await page.title()).includes('Фокус'), 'помодоро: время в заголовке вкладки');
await page.click(`${pomoSel} .pomo-btn.main`);

// курсы, отсчёт, привычки, цитата
check(!(await page.textContent('.w-rates')).includes('null'), 'курсы: без мусора «null»');
check(await page.locator('.rate:has-text("USD"):has-text("81,72")').count() === 1 && await page.locator('.rate-d.up').count() === 1 && await page.locator('.rate-d.down').count() === 1, 'курсы: USD 81,72 ₽, рост и падение');
check(/^\d+$/.test((await page.textContent('.cd-big')).trim()) && /дн|день/.test(await page.textContent('.cd-unit')), 'отсчёт: дни до Нового года');
const hbSel = `.grid-stack-item[gs-id="${await idOf('habits')}"]`;
await page.click(`${hbSel} .hb-dot >> nth=6`);
await page.waitForTimeout(200);
check(await page.locator(`${hbSel} .hb-dot.on`).count() === 1 && (await page.textContent(`${hbSel} .hb-streak >> nth=0`)).startsWith('1'), 'привычки: отметка за сегодня и серия 1');
const q0 = await page.textContent('.w-quote blockquote');
await page.hover('.w-quote');
await page.click('.w-quote .w-more');
await page.waitForTimeout(200);
check(q0 !== await page.textContent('.w-quote blockquote'), 'цитата: «ещё» листает');
await page.screenshot({ path: `${out}/34-widgets-a.png` });

// перезагрузка — дела и привычки на месте
await page.reload();
await page.waitForTimeout(1200);
check(await page.locator(`${todoSel} .todo-item`).count() === 3 && await page.locator(`${hbSel} .hb-dot.on`).count() === 1, 'дела и привычки пережили перезагрузку');

// вторая партия: частые сайты, недавно закрытые, слово, картинка, погода на неделю
await freshLayout();
await page.reload();
await page.waitForTimeout(1200);
for (const t of ['Частые сайты', 'Недавно закрытые', 'Слово дня', 'Картинка', 'Погода']) await addViaMenu(t);
await page.keyboard.press('Escape');
await page.waitForTimeout(800);
check(await page.locator(`.grid-stack-item[gs-id="${await idOf('topsites')}"] button:has-text("Разрешить")`).count() === 1, 'частые сайты: без разрешения — кнопка «Разрешить»');
// sessions — разрешение без предупреждения, Chrome выдаёт его молча; тогда виджет показывает список (или просит обновить вкладку)
const recentText = await page.evaluate(() => {
  const it = window.__plitka.layout.find(i => i.type === 'recent');
  return document.querySelector(`.grid-stack-item[gs-id="${it.id}"] .w-body`)?.innerText || '';
});
check(/Разрешить|Пока ничего не закрывали|обнови вкладку/.test(recentText), `недавно закрытые: понятное состояние («${recentText.replace(/\s+/g, ' ').trim()}»)`);
await page.reload();
await page.waitForTimeout(1200);
// после перезагрузки: если доступ уже есть — должен быть список, а не просьба обновить
const recentAfter = await page.evaluate(() => {
  const it = window.__plitka.layout.find(i => i.type === 'recent');
  return document.querySelector(`.grid-stack-item[gs-id="${it.id}"] .w-body`)?.innerText || '';
});
check(!/обнови вкладку/.test(recentAfter), `недавно закрытые: после перезагрузки API на месте («${recentAfter.replace(/\s+/g, ' ').trim()}»)`);
check((await page.textContent('.word-w')).length > 2 && (await page.textContent('.word-m')).length > 5, 'слово дня: слово и значение');
check(await page.evaluate(() => { const i = document.querySelector('.w-pic img'); return !!i && i.src.includes('cataas.com') && i.naturalWidth > 0; }), 'картинка: котик загрузился');
// погода — режим «неделя»
await openSettings(await idOf('weather'));
await page.click('.inspector .seg-btn:has-text("Неделя")');
await page.keyboard.press('Escape'); // закрыть инспектор — всё уже применилось
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
check(await page.locator('.w-weather.is-week .wx-day').count() === 7, 'погода: неделя — 7 дней');
// картинка — аниме
await openSettings(await idOf('pic'));
await page.click('.inspector .seg-btn:has-text("Аниме")');
await page.keyboard.press('Escape'); // закрыть инспектор — всё уже применилось
await page.keyboard.press('Escape');
await page.waitForTimeout(800);
check(await page.evaluate(() => { const i = document.querySelector('.w-pic img'); return !!i && i.src.includes('pics.test'); }) && (await page.textContent('.pic-cap')) === 'Тестовое аниме', 'картинка: аниме-гифка с подписью');
await page.screenshot({ path: `${out}/35-widgets-b.png` });

// ---------- инспектор блока: сбоку, без затемнения, применяется сразу ----------
await freshLayout();
await page.reload();
await page.waitForTimeout(1200);
await openSettings('w-clock');
const insp = await page.evaluate(() => {
  const i = document.querySelector('.inspector').getBoundingClientRect();
  const c = document.querySelector('.grid-stack-item[gs-id="w-clock"]').getBoundingClientRect();
  const overlap = i.left < c.right && c.left < i.right && i.top < c.bottom && c.top < i.bottom;
  return { overlap, modal: document.getElementById('modal').classList.contains('open'), inspecting: document.querySelector('.grid-stack-item[gs-id="w-clock"]').classList.contains('inspecting') };
});
check(!insp.overlap && !insp.modal && insp.inspecting, 'инспектор: рядом с блоком, не перекрывает, без затемнения, блок подсвечен');
await page.click('.inspector .seg-btn:has-text("Стрелочные")');
await page.waitForTimeout(200);
check(await page.locator('.grid-stack-item[gs-id="w-clock"] .clock-face').count() === 1, 'инспектор: изменение видно сразу, без «Сохранить»');
await page.screenshot({ path: `${out}/36-inspector.png` });
await page.mouse.click(1200, 700); // клик мимо
await page.waitForTimeout(200);
check(await page.locator('.inspector').count() === 0 && await page.evaluate(() => window.__plitka.layout.find(i => i.id === 'w-clock').data.style) === 'analog', 'инспектор: клик мимо закрывает, настройка сохранена');
await page.keyboard.press('Escape');

// ---------- док: еле видимый ----------
await page.mouse.move(700, 400);
await page.waitForTimeout(400);
const dockOp = await page.evaluate(() => getComputedStyle(document.getElementById('dock')).opacity);
check(+dockOp > 0.2 && +dockOp < 0.5, `док: приглушён (opacity ${dockOp})`);

// ---------- «подглядывание» панели ----------
await page.click('#btn-settings');
await page.waitForTimeout(400);
await ptab('fx');
await page.locator('input[data-fx="vignette"]').scrollIntoViewIfNeeded();
const vig = await page.locator('input[data-fx="vignette"]').boundingBox();
await page.mouse.move(vig.x + vig.width * 0.5, vig.y + vig.height / 2);
await page.mouse.down();
await page.mouse.move(vig.x + vig.width * 0.8, vig.y + vig.height / 2, { steps: 4 });
await page.waitForTimeout(250);
check(await page.evaluate(() => document.getElementById('settings').classList.contains('peek')), 'панель: пока тянешь ползунок — прозрачная');
await page.screenshot({ path: `${out}/37-panel-peek.png` });
await page.mouse.up();
await page.waitForTimeout(250);
check(!(await page.evaluate(() => document.getElementById('settings').classList.contains('peek'))), 'панель: отпустил — вернулась');

// ---------- живые обои: анимация на картинке ----------
await page.evaluate(async (url) => {
  await chrome.storage.local.set({ settings: { bgImage: url, bgDim: 0.1, photo: { mode: 'frosted', anim: 'rain', animAmt: 0.8, speed: 0.4, clear: null } } });
}, photoUrl);
await page.click('.panel [data-close]');
await page.reload();
await page.waitForTimeout(1500);
const f1 = await page.screenshot({ clip: { x: 200, y: 300, width: 400, height: 300 } });
await page.waitForTimeout(1200);
const f2 = await page.screenshot({ clip: { x: 200, y: 300, width: 400, height: 300 } });
check(!f1.equals(f2), 'живые обои: «дождь по стеклу» двигается');
await page.screenshot({ path: `${out}/38-live-rain.png` });
for (const a of ['breathe', 'waves', 'glitch', 'shimmer', 'kenburns']) {
  await page.evaluate(async ([url, anim]) => {
    await chrome.storage.local.set({ settings: { bgImage: url, bgDim: 0.1, photo: { mode: 'mesh', anim, animAmt: 1, speed: 0.5, clear: null } } });
  }, [photoUrl, a]);
  await page.reload();
  await page.waitForTimeout(1300);
}
await page.screenshot({ path: `${out}/39-live-kenburns.png` });
check(await page.evaluate(() => window.__plitka.settings().photo.anim) === 'kenburns', 'живые обои: анимации переключаются без ошибок');
await page.evaluate(() => chrome.storage.local.set({ settings: {} }));

// ---------- вкладка: название и иконка ----------
await freshLayout();
await page.reload();
await page.waitForTimeout(1200);
check(await page.title() === 'Новая вкладка', 'вкладка: название по умолчанию');
await page.click('#btn-settings');
await page.waitForTimeout(300);
await ptab('tab');
await page.fill('input[data-tab="title"]', '');
await page.click('.tab-tokens .chip:has-text("{время}")');
await page.keyboard.type(' · Plitka'); // курсор уже в поле, после вставленного {время}
await page.waitForTimeout(500);
check(/^\d\d:\d\d · Plitka$/.test(await page.title()), `вкладка: {время} подставляется («${await page.title()}»)`);
const iconHref = () => page.evaluate(() => document.querySelector('link[rel="icon"]').href);
await page.click('.tab-icon[data-icon="clock"]');
await page.waitForTimeout(300);
const clockIco = await iconHref();
check(clockIco.startsWith('data:image/png'), 'вкладка: иконка-часы нарисована');
await page.click('.tab-icon[data-icon="emoji"]');
await page.waitForTimeout(200);
await page.fill('input[data-tab="emoji"]', '🐱');
await page.waitForTimeout(300);
const emojiIco = await iconHref();
check(emojiIco.startsWith('data:image/png') && emojiIco !== clockIco, 'вкладка: иконка-эмодзи');
await page.screenshot({ path: `${out}/40-tab-settings.png` });
await page.reload();
await page.waitForTimeout(1000);
check(/· Plitka$/.test(await page.title()) && (await iconHref()).startsWith('data:image/png'), 'вкладка: название и иконка пережили перезагрузку');

// ---------- текст: шрифт и тень глобально и у блока ----------
const clockBody = '.grid-stack-item[gs-id="w-clock"] .w-body';
const css = (sel, prop) => page.$eval(sel, (el, p) => getComputedStyle(el)[p], prop);
check(await css(clockBody + ' .clock-sub', 'textShadow') === 'none', 'текст: по умолчанию без тени');
await page.click('#btn-settings');
await page.waitForTimeout(300);
await ptab('blocks');
await page.click('.panel .seg-btn:has-text("Мягкая")');
await page.click('.panel .panel-sec:has-text("Текст в блоках") .dd-btn');
await page.click('body > .dd-list .dd-item:has-text("С засечками")');
await page.click('.panel [data-close]');
await page.waitForTimeout(300);
check(await css(clockBody + ' .clock-sub', 'textShadow') !== 'none', 'текст: глобальная мягкая тень');
check(/Georgia/.test(await css(clockBody, 'fontFamily')), 'текст: глобальный шрифт с засечками');
await openSettings('w-clock');
await page.click('.inspector .field:has-text("Тень текста") .dd-btn');
await page.click('body > .dd-list .dd-item:has-text("Нет")');
await page.waitForTimeout(200);
check(await css(clockBody + ' .clock-sub', 'textShadow') === 'none', 'текст: у блока своя тень («Нет») перебивает глобальную');
await page.keyboard.press('Escape');

// меню «+ Виджет» с иконками и группами
await page.click('#btn-add');
await page.waitForTimeout(300);
check(await page.locator('.add-menu .add-item .add-ico svg').count() === await page.locator('.add-menu .add-item').count() && await page.locator('.add-group').count() === 5, 'меню: у каждого виджета иконка, 5 групп');
await page.screenshot({ path: `${out}/41-add-menu.png` });
await page.click('#btn-add');
await page.keyboard.press('Escape');
await page.evaluate(() => chrome.storage.local.set({ settings: {} }));

// ---------- картинка «как есть» ----------
await page.evaluate(async (url) => chrome.storage.local.set({ settings: { bgImage: url } }), photoUrl);
await page.reload();
await page.waitForTimeout(1200);
await page.click('#btn-settings');
await page.waitForTimeout(300);
await page.click('.panel .seg-btn:has-text("Как есть")');
await page.waitForTimeout(400);
check(await page.evaluate(() => window.__plitka.settings().photo.plain) === true && await page.locator('.panel button:has-text("Эффект картинки")').count() === 0, 'картинка: «как есть» — без эффекта, кнопки эффекта нет');
await page.click('.panel [data-close]');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/42-photo-plain.png` });
await page.click('#btn-settings');
await page.waitForTimeout(300);
await page.click('.panel .seg-btn:has-text("С эффектом")');
await page.waitForTimeout(200);
check(await page.evaluate(() => window.__plitka.settings().photo.plain) === false, 'картинка: «с эффектом» возвращает эффект');
await page.click('.panel [data-close]');

// ---------- слайд-шоу ----------
await page.evaluate(() => chrome.storage.local.set({ settings: {} }));
await page.reload();
await page.waitForTimeout(1200);
await page.click('#btn-settings');
await page.waitForTimeout(300);
for (const id of ['neon', 'flame']) {
  await page.click(`.mesh-preset[data-preset="${id}"]`);
  await page.waitForTimeout(250);
  await page.locator('.panel button:has-text("+ Текущий фон")').scrollIntoViewIfNeeded();
  await page.click('.panel button:has-text("+ Текущий фон")');
  await page.waitForTimeout(250);
}
{
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.panel button:has-text("+ Картинки")')]);
  await chooser.setFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from(photoUrl.split(',')[1], 'base64') },
    { name: 'b.png', mimeType: 'image/png', buffer: png },
  ]);
}
await page.waitForTimeout(1200);
check(await page.locator('.slides .slide').count() === 4, 'слайд-шоу: 2 фона + 2 картинки в списке');
await page.locator('label:has(input[data-slides="on"])').click();
await page.waitForTimeout(900);
const sl1 = await page.evaluate(() => window.__plitka.settings().slides);
check(sl1.on && sl1.idx >= 0, `слайд-шоу: включилось, показан слайд ${sl1.idx}`);
// список закрывается при прокрутке панели (окно пониже, чтобы панель правда прокручивалась)
await page.setViewportSize({ width: 1600, height: 600 });
await page.waitForTimeout(400);
await page.locator('.panel .field:has-text("Менять") .dd-btn').scrollIntoViewIfNeeded();
await page.click('.panel .field:has-text("Менять") .dd-btn');
await page.waitForTimeout(250);
check(await page.locator('.dd-list').count() === 1, 'список: открылся после прокрутки к нему');
await page.evaluate(() => { const b = document.getElementById('settings-body'); b.scrollTop = 0; });
await page.waitForTimeout(250);
check(await page.locator('.dd-list').count() === 0, 'список: закрывается при прокрутке панели');
await page.setViewportSize({ width: 1600, height: 900 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/43-slideshow-panel.png` });
// «Следующий» и смена на новой вкладке
const bgKey = () => page.evaluate(() => { const s = window.__plitka.settings(); return s.bgImage ? 'img:' + s.bgImage.length : 'mesh:' + s.mesh.points.map(p => p.color).join(); });
const b0 = await bgKey();
await page.locator('.panel button:has-text("Следующий")').scrollIntoViewIfNeeded();
await page.click('.panel button:has-text("Следующий")');
await page.waitForTimeout(1400);
const b1 = await bgKey();
check(b0 !== b1, 'слайд-шоу: «Следующий» меняет фон');
await page.click('.panel [data-close]');
const idxBefore = await page.evaluate(() => window.__plitka.settings().slides.idx);
await page.waitForTimeout(400);
await page.reload();
await page.waitForTimeout(1500);
const idxAfter = await page.evaluate(() => window.__plitka.settings().slides.idx);
check(idxAfter === (idxBefore + 1) % 4, `слайд-шоу: новая вкладка — следующий слайд (${idxBefore} → ${idxAfter})`);
await page.screenshot({ path: `${out}/44-slideshow-next.png` });

// миниатюры заготовок после перезагрузки берутся из кэша — сразу
await page.click('#btn-settings');
await page.waitForTimeout(150);
check(await page.locator('.mesh-preset img').count() === 14, 'миниатюры: из кэша, без перерисовки');
await page.click('.panel [data-close]');
await page.evaluate(() => chrome.storage.local.set({ settings: {} }));

// ---------- первый кадр: стекло размыто сразу, а не через полсекунды ----------
// (opacity < 1 у предка выключает backdrop-filter — так было, пока сетка проявлялась целиком)
await page.evaluate(async (url) => chrome.storage.local.set({
  settings: { bgImage: url, photo: { plain: true } },
  widgets: [{ id: 'w-clock', type: 'clock', data: { glass: true } }], layouts: { lg: { 'w-clock': { x: 6, y: 3, w: 12, h: 4 } } },
}), photoUrl);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.w.glass', { state: 'attached' });
const firstFrame = await page.evaluate(() => {
  const w = document.querySelector('.w.glass');
  const bad = [];
  for (let el = w; el && el !== document.documentElement; el = el.parentElement) {
    if (+getComputedStyle(el).opacity < 1) bad.push(el.className || el.tagName);
  }
  return bad;
});
check(firstFrame.length === 0, `первый кадр: у стекла и его предков opacity 1 (${firstFrame.join(', ') || 'ок'})`);
await page.screenshot({ path: `${out}/45-first-frame.png` });
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/46-after-load.png` });
await page.evaluate(() => chrome.storage.local.set({ settings: {} }));

// ---------- ссылки: стили иконок, закладки ----------
await page.evaluate(() => chrome.storage.local.set({
  settings: {},
  widgets: [{ id: 'w-links', type: 'links', data: { links: [
    { title: 'YouTube', url: 'https://youtube.com' }, { title: 'GitHub', url: 'https://github.com' },
    { title: 'Telegram', url: 'https://web.telegram.org' }, { title: 'ВКонтакте', url: 'https://vk.com' },
    { title: 'Ozon', url: 'https://ozon.ru' }, { title: 'Мой сайт', url: 'https://example-site.dev' },
  ] } }],
  layouts: { lg: { 'w-links': { x: 4, y: 4, w: 16, h: 3 } } },
}));
await page.reload();
await page.waitForTimeout(1200);
check(await page.$eval('.link[title="YouTube"]', el => el.style.getPropertyValue('--brand')) === '#ff0033', 'ссылки: фирменный цвет YouTube');
check(/^hsl/.test(await page.$eval('.link[title="Мой сайт"]', el => el.style.getPropertyValue('--brand'))), 'ссылки: незнакомому сайту — цвет из адреса');
for (const [k, name] of [['big', 'Крупные'], ['tint', 'Цвет бренда'], ['mono', 'Монохром'], ['letter', 'Буквы']]) {
  await openSettings('w-links');
  await page.click('.inspector .field:has-text("Иконки") .dd-btn');
  await page.click(`body > .dd-list .dd-item:has-text("${name}")`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/47-icons-${k}.png`, clip: { x: 260, y: 280, width: 1080, height: 260 } });
}
check(await page.locator('.w-links.icons-letter .link-ico .mono').count() === 6 && (await page.textContent('.link[title="YouTube"] .mono')) === 'Y', 'ссылки: стиль «Буквы» — монограммы');
await openSettings('w-links');
check(await page.locator('.inspector button:has-text("Из панели закладок")').count() === 1, 'ссылки: кнопка «Из панели закладок» в настройках');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
// виджет закладок: без разрешения — понятная кнопка (диалог разрешения в тесте не нажать)
await addViaMenu('Панель закладок');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const bmText = await page.evaluate(() => {
  const it = window.__plitka.layout.find(i => i.type === 'bookmarks');
  return document.querySelector(`.grid-stack-item[gs-id="${it.id}"] .w-body`)?.innerText || '';
});
check(/Разрешить|обнови вкладку/.test(bmText), `закладки: без доступа — кнопка «Разрешить» («${bmText.replace(/\s+/g, ' ').trim()}»)`);
await page.evaluate(() => chrome.storage.local.set({ settings: {} }));

// ---------- поиск: префиксы, калькулятор, недавние, выбор поисковика, инкогнито ----------
await page.evaluate(() => chrome.storage.local.set({
  settings: {},
  widgets: [{ id: 'w-search', type: 'search', data: { history: ['котики', 'погода завтра'] } }],
  layouts: { lg: { 'w-search': { x: 6, y: 5, w: 12, h: 1 } } },
}));
await page.reload();
await page.waitForTimeout(1000);
const sb = await page.evaluate(() => {
  const f = document.querySelector('.w-search').getBoundingClientRect();
  const w = document.querySelector('.grid-stack-item[gs-id="w-search"] .w').getBoundingClientRect();
  return { fh: f.height, wh: w.height, dc: Math.abs((f.top + f.bottom) / 2 - (w.top + w.bottom) / 2) };
});
check(sb.fh < sb.wh && sb.dc < 2, `поиск: строка тоньше ячейки и по центру (${Math.round(sb.fh)} из ${Math.round(sb.wh)} px)`);
await page.click('[data-search]');
await page.waitForTimeout(200);
check(await page.locator('.search-recent .sr-q').count() === 2, 'поиск: недавние запросы при фокусе');
await page.screenshot({ path: `${out}/48-search-recent.png`, clip: { x: 300, y: 300, width: 1000, height: 320 } });
await page.type('[data-search]', '1250*0,13');
await page.waitForTimeout(150);
check((await page.textContent('.search-calc')).replace(/\s/g, '') === '=162,5', `поиск: калькулятор («${await page.textContent('.search-calc')}»)`);
await page.fill('[data-search]', '!yt lofi');
await page.dispatchEvent('[data-search]', 'input');
await page.waitForTimeout(150);
check(await page.locator('.engine.bang').count() === 1, 'поиск: префикс !yt подсвечивает YouTube');
await page.keyboard.down('Shift');
await page.waitForTimeout(100);
check(await page.locator('.search-ghost.on').count() === 1, 'поиск: с Shift подсвечивается призрак (инкогнито)');
await page.screenshot({ path: `${out}/49-search-incognito.png`, clip: { x: 300, y: 330, width: 1000, height: 120 } });
await page.keyboard.up('Shift');
await page.fill('[data-search]', '');
await page.click('.engine');
await page.waitForTimeout(200);
check(await page.locator('.engine-menu .em-item').count() === 9, 'поиск: меню из 9 поисковиков');
await page.screenshot({ path: `${out}/50-engine-menu.png` });
await page.click('.engine-menu .em-item:has-text("Perplexity")');
check(await page.evaluate(() => window.__plitka.layout[0].data.engine) === 'perplexity', 'поиск: поисковик выбран из меню');
// призрак на экране: пустая строка — включает режим инкогнито; в настройках блока кнопки можно спрятать
await page.fill('[data-search]', '');
await page.click('.search-ghost');
check(await page.locator('.search-ghost.on').count() === 1 && /Инкогнито/.test(await page.getAttribute('[data-search]', 'placeholder')), 'поиск: призрак включает режим инкогнито');
await page.waitForTimeout(350);
await page.screenshot({ path: `${out}/53-search-ghost.png`, clip: { x: 300, y: 330, width: 1000, height: 120 } });
await page.click('.search-ghost');
await page.evaluate(() => document.activeElement.blur()); // иначе «E» уйдёт в строку поиска
await openSettings('w-search');
for (const t of ['Кнопка выбора поисковика', 'Кнопка инкогнито']) await page.click(`.inspector .field-toggle:has-text("${t}")`);
await page.waitForTimeout(200);
check(await page.locator('.w-search .engine:visible').count() === 0 && await page.locator('.w-search .search-ghost:visible').count() === 0, 'поиск: кнопки выбора и инкогнито прячутся в настройках');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
// поиск с префиксом уходит по нужному адресу
await ctx.route('https://www.youtube.com/**', r => r.fulfill({ body: '<title>yt</title>ok', contentType: 'text/html' }));
await page.fill('[data-search]', '!yt lofi beats');
await page.press('[data-search]', 'Enter');
await page.waitForURL(/youtube\.com\/results\?search_query=lofi%20beats/, { timeout: 5000 }).then(() => check(true, 'поиск: !yt ушёл на YouTube')).catch(() => check(false, 'поиск: !yt ушёл на YouTube'));
await page.goto(url);
await page.waitForTimeout(1000);
check(JSON.stringify(await page.evaluate(() => window.__plitka.layout[0].data.history)) === JSON.stringify(['!yt lofi beats', 'котики', 'погода завтра']), 'поиск: запрос попал в недавние');

// ---------- все виджеты в минимальном размере: отступы и центровка ----------
const mins = [
  ['clock', 0, 0, 3, 2], ['notes', 3, 0, 3, 2], ['todo', 6, 0, 3, 2], ['pomodoro', 9, 0, 3, 3], ['recent', 12, 0, 3, 2],
  ['rates', 15, 0, 3, 2], ['countdown', 18, 0, 3, 2], ['word', 21, 0, 3, 2],
  ['links', 0, 3, 8, 1], ['search', 8, 3, 6, 1], ['weather', 14, 3, 4, 1],
  ['habits', 0, 5, 4, 2], ['quote', 4, 5, 4, 2], ['pic', 8, 5, 2, 2],
];
await page.evaluate((list) => chrome.storage.local.set({
  settings: {},
  widgets: list.map(([type]) => ({ id: 'm-' + type, type, data: type === 'todo' ? { items: [{ id: 'a', text: 'Купить хлеб', done: false }] } : {} })),
  layouts: { lg: Object.fromEntries(list.map(([type, x, y, w, h]) => ['m-' + type, { x, y, w, h }])) },
}), mins);
await page.reload();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/51-min-sizes.png` });
const linkC = await page.evaluate(() => {
  const w = document.querySelector('.grid-stack-item[gs-id="m-links"] .w').getBoundingClientRect();
  const icons = [...document.querySelectorAll('.grid-stack-item[gs-id="m-links"] .link-ico')].map(e => e.getBoundingClientRect());
  return { dc: Math.max(...icons.map(i => Math.abs((i.top + i.bottom) / 2 - (w.top + w.bottom) / 2))), inside: icons.every(i => i.top >= w.top && i.bottom <= w.bottom) };
});
check(linkC.dc < 3 && linkC.inside, `ссылки: в блоке высотой 1 иконки по центру (сдвиг ${linkC.dc.toFixed(1)} px)`);
await page.evaluate(() => chrome.storage.local.set({ settings: {} }));

// ---------- пёстрый фон: стекло выравнивает яркость под собой ----------
const halfUrl = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 900;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 1600, 900);
  g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, 800, 900);
  return c.toDataURL('image/png');
});
await page.evaluate((u) => chrome.storage.local.set({
  settings: { bgImage: u, bgDim: 0, photo: { plain: true } },
  widgets: [{ id: 'w-search', type: 'search', data: {} }, { id: 'w-clock', type: 'clock', data: { glass: true } }],
  layouts: { lg: { 'w-search': { x: 6, y: 7, w: 12, h: 1 }, 'w-clock': { x: 0, y: 0, w: 6, h: 3 } } },
}), halfUrl);
await page.reload();
await page.waitForTimeout(1500);
const mix = await page.evaluate(() => {
  const s = document.querySelector('.grid-stack-item[gs-id="w-search"] .w');
  const c = document.querySelector('.grid-stack-item[gs-id="w-clock"] .w');
  return { mixed: s.classList.contains('bg-mixed'), dark: s.classList.contains('ink-dark'), clockMixed: c.classList.contains('bg-mixed'),
    bf: getComputedStyle(s.querySelector('.w-search')).backdropFilter };
});
check(mix.mixed && !mix.dark && !mix.clockMixed, 'читаемость: поиск на границе чёрного и белого — «пёстрый», текст светлый; часы на однотонном — нет');
check(/blur/.test(mix.bf) && /contrast/.test(mix.bf), `читаемость: фильтр принят браузером (${mix.bf})`);
await page.fill('[data-search]', 'текст поверх белого и чёрного');
await page.screenshot({ path: `${out}/52-mixed-bg.png` });
await page.evaluate(() => chrome.storage.local.set({ settings: {} }));

// ---------- свои углы и стекло у блока, жидкое стекло ----------
// контрастные полосы — на них видно, как стекло преломляет фон у краёв
const STRIPES = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 900;
  const g = c.getContext('2d');
  for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? '#f2f2f2' : '#1a1a2a'; g.fillRect(i * 40, 0, 40, 900); }
  g.fillStyle = '#ff5a3c'; g.fillRect(0, 430, 1600, 40);
  return c.toDataURL('image/png');
});
await page.evaluate((STRIPES) => chrome.storage.local.set({
  settings: { bgImage: STRIPES, bgDim: 0, photo: { plain: true } },
  widgets: [{ id: 'w-clock', type: 'clock', data: { glass: true } }, { id: 'w-search', type: 'search', data: {} }, { id: 'w-links', type: 'links', data: {} }],
  layouts: { lg: { 'w-clock': { x: 7, y: 1, w: 10, h: 4 }, 'w-search': { x: 6, y: 6, w: 12, h: 1 }, 'w-links': { x: 6, y: 8, w: 12, h: 2 } } },
}), STRIPES);
await page.reload();
await page.waitForTimeout(1200);
await openSettings('w-clock');
await page.locator('.inspector .field-range:has-text("Скругление углов") input').fill('40');
await page.waitForTimeout(200);
check(await page.$eval('.grid-stack-item[gs-id="w-clock"] .w', el => getComputedStyle(el).borderTopLeftRadius) === '40px', 'блок: своё скругление углов');
await page.click('.inspector .field-range:has-text("Скругление углов") .mini-reset');
await page.waitForTimeout(150);
check(await page.$eval('.grid-stack-item[gs-id="w-clock"] .w', el => getComputedStyle(el).borderTopLeftRadius) === '22px', 'блок: «как везде» возвращает общее скругление');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await page.click('#btn-settings');
await ptab('blocks');
await page.click('.panel .seg-btn:has-text("Жидкое стекло")');
await page.click('.panel [data-close]');
await page.waitForTimeout(800);
const lq = await page.evaluate(() => ({
  clock: getComputedStyle(document.querySelector('.grid-stack-item[gs-id="w-clock"] .w')).backdropFilter,
  search: getComputedStyle(document.querySelector('.w-search')).backdropFilter,
  maps: document.querySelectorAll('filter feDisplacementMap').length,
}));
check(/url\(/.test(lq.clock) && /url\(/.test(lq.search) && lq.maps >= 3, `жидкое стекло: фильтр-линза на блоках (${lq.maps} шт., ${lq.clock.slice(0, 40)}…)`);
await page.screenshot({ path: `${out}/54-liquid-glass.png` });
await page.evaluate(() => document.querySelector("filter[id^=lq] feImage").getAttribute("href")).then(u => fs.writeFileSync(`${out}/56-liquid-map.png`, Buffer.from(u.split(",")[1], "base64")));
console.log("lq filters:", await page.evaluate(() => [...document.querySelectorAll("filter[id^=lq]")].map(f => f.id + " " + f.getAttribute("width") + "x" + f.getAttribute("height") + " img=" + (f.querySelector("feImage")?.getAttribute("href") || "").length + " scale=" + f.querySelector("feDisplacementMap")?.getAttribute("scale") + " ns=" + f.querySelector("feImage")?.namespaceURI).join(" | ")));
await page.screenshot({ path: `${out}/55-liquid-edge.png`, clip: { x: 440, y: 70, width: 260, height: 320 } });
await page.evaluate(() => chrome.storage.local.set({ settings: {} }));

// ---------- свои приветствия, «Ещё», картинка во «Фоне» ----------
await page.evaluate(() => chrome.storage.local.set({
  settings: { name: 'Вова' },
  widgets: [{ id: 'w-clock', type: 'clock', data: {} }], layouts: { lg: { 'w-clock': { x: 7, y: 2, w: 10, h: 4 } } },
}));
await page.reload();
await page.waitForTimeout(1000);
await page.click('#btn-settings');
await ptab('tab');
await page.fill('input[data-greet="0"]', 'Йо, {имя}');
await page.waitForTimeout(500);
check((await page.textContent('.greet')) === 'Йо, Вова', `приветствие: своё с именем («${await page.textContent('.greet')}»)`);
await page.click('.greets .text-btn');
await page.fill('input[data-greet="1"]', 'Ночь не для сна');
// второе — только на текущее время суток: должно победить «любое время»
const part = await page.evaluate(() => { const hr = new Date().getHours(); return hr < 5 ? 'Ночь' : hr < 12 ? 'Утро' : hr < 18 ? 'День' : hr < 23 ? 'Вечер' : 'Ночь'; });
await page.click('.greet-row:nth-child(2) .dd-btn');
await page.click(`body > .dd-list .dd-item:has-text("${part}")`);
await page.waitForTimeout(500);
check((await page.textContent('.greet')) === 'Ночь не для сна', 'приветствие: по времени суток важнее «любого времени»');
await page.screenshot({ path: `${out}/57-greetings.png` });
await ptab('more');
check(await page.locator('.action-card:has-text("Изменить раскладку")').count() === 1 && await page.locator('.hotkeys kbd').count() >= 6 && await page.locator('.panel-footer:has-text("Plitka")').count() === 1, 'ещё: карточка раскладки, клавиши, подвал с названием');
await page.screenshot({ path: `${out}/58-more.png` });
await page.click('.panel [data-close]');
await page.evaluate((u) => chrome.storage.local.set({ settings: { bgImage: u } }), photoUrl);
await page.reload();
await page.waitForTimeout(1000);
await page.click('#btn-settings');
check(await page.locator('.bg-current').count() === 1 && await page.locator('.panel .mesh-editor').count() === 1, 'фон: превью своей картинки и редактор эффекта сразу, без кнопки');
await page.screenshot({ path: `${out}/59-bg-photo.png` });
await page.click('.panel [data-close]');
await page.evaluate(() => chrome.storage.local.set({ settings: {} }));

const real = errors.filter(e => !/Failed to load resource/i.test(e));
if (fails.length) { console.error('FAIL:', fails.join('; ')); process.exitCode = 1; }
console.log('errors:', real.length ? real.join('\n') : 'none');
await ctx.close();
fs.rmSync(userDir, { recursive: true, force: true });
if (before !== after || real.length) { console.error('FAIL'); process.exit(1); }
console.log('OK');
