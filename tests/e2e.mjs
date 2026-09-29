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

const real = errors.filter(e => !/Failed to load resource/i.test(e));
console.log('errors:', real.length ? real.join('\n') : 'none');
await ctx.close();
fs.rmSync(userDir, { recursive: true, force: true });
if (before !== after || real.length) { console.error('FAIL'); process.exit(1); }
console.log('OK');
