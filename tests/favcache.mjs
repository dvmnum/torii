import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Кэш иконок сайтов на живой сети (node tests/favcache.mjs): ставим ссылки на разные сайты, открываем вкладку,
// ждём, пока иконки сохранятся, открываем заново и смотрим: стандартные — из пакета, остальные — из памяти (data:), без сети.
const ext = path.resolve('plitka');
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'torii-fav-')), {
  headless: true, channel: 'chromium', viewport: { width: 1400, height: 800 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
await ctx.route('https://*.open-meteo.com/**', r => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('chrome://extensions');
const id = await page.evaluate(() => new Promise(r => chrome.management.getAll(l => r(l.find(x => x.installType === 'development')?.id))));
await page.goto(`chrome-extension://${id}/newtab.html`);
await page.waitForTimeout(800);
const links = ['youtube.com', 'github.com', 'claude.ai', 'chatgpt.com', 'pinterest.com', 'vk.com', 'notion.so', 'figma.com']
  .map(h => ({ title: h.split('.')[0], url: 'https://' + h }));
await page.evaluate(async (links) => chrome.storage.local.set({ settings: {}, widgets: [{ id: 'l', type: 'links', data: { links } }], layouts: { lg: { l: { x: 2, y: 3, w: 20, h: 3 } } } }), links);
await page.reload();
await page.waitForTimeout(9000); // иконки грузятся, Яндекс — в фоне
const saved = await page.evaluate(async () => Object.entries((await chrome.storage.local.get('favimgs')).favimgs || {}).map(([h, [d]]) => `${h}: ${d ? Math.round(d.length / 1024) + ' КБ' : 'нет у Яндекса'}`));
console.log('в памяти:', saved.join(', ') || 'пусто');
// второе открытие — без сети к иконкам: всё должно встать сразу
await ctx.route(/favicons|favicon\.yandex|gstatic/, r => r.abort());
await page.reload();
await page.waitForTimeout(700);
const srcs = await page.$$eval('.link-ico img', imgs => imgs.map(i => (i.src.startsWith('data:') ? 'память' : i.src.includes('/icons/sites/') ? 'пакет' : 'сеть') + (i.naturalWidth ? '' : ' (не видна)')));
console.log('второе открытие:', srcs.join(', '));
fs.mkdirSync('tests/shots', { recursive: true });
await page.screenshot({ path: 'tests/shots/favcache.png', clip: { x: 100, y: 180, width: 1200, height: 260 } });
console.log('ошибки:', errors.length ? errors : 'нет');
await ctx.close();
