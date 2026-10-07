import { chromium } from 'playwright';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// Правка закладок с вкладки (npm run test:bookmarks). Разрешение bookmarks необязательное, и в автотесте его не выдать —
// поэтому грузим копию расширения, где оно в обязательных. Скрины → tests/shots/bm-*.png
const src = path.resolve('plitka');
const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'torii-bm-ext-'));
fs.cpSync(src, ext, { recursive: true });
const mf = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
mf.permissions.push('bookmarks');
mf.optional_permissions = mf.optional_permissions.filter(p => p !== 'bookmarks');
fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify(mf));
const out = path.resolve('tests/shots');
fs.mkdirSync(out, { recursive: true });

const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'torii-bm-'));
const ctx = await chromium.launchPersistentContext(userDir, {
  headless: true, channel: 'chromium', viewport: { width: 1400, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
await ctx.route(/favicons|favicon\.yandex/, r => r.abort());
const errors = [];
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
const fails = [];
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails.push(what); };

await page.goto('chrome://extensions');
const id = await page.evaluate(() => new Promise(r => chrome.management.getAll(l => r(l.find(x => x.name.startsWith('Torii'))?.id))));
await page.goto(`chrome-extension://${id}/newtab.html`);
await page.waitForTimeout(800);

// строка закладок: 4 ссылки и папка с двумя внутри; на вкладке — только виджет закладок
const barId = await page.evaluate(async () => {
  const [root] = await chrome.bookmarks.getTree();
  const bar = root.children.find(c => c.folderType === 'bookmarks-bar') || root.children[0];
  for (const c of bar.children) await chrome.bookmarks.removeTree(c.id);
  for (const [title, url] of [['Alpha', 'https://alpha.example/'], ['Beta', 'https://beta.example/'], ['Gamma', 'https://gamma.example/'], ['Delta', 'https://delta.example/']])
    await chrome.bookmarks.create({ parentId: bar.id, title, url });
  const f = await chrome.bookmarks.create({ parentId: bar.id, title: 'Работа' });
  await chrome.bookmarks.create({ parentId: f.id, title: 'Docs', url: 'https://docs.example/' });
  await chrome.bookmarks.create({ parentId: f.id, title: 'Mail', url: 'https://mail.example/' });
  await chrome.storage.local.set({
    settings: {},
    widgets: [{ id: 'wb', type: 'bookmarks', data: {} }],
    layouts: { lg: { wb: { x: 4, y: 4, w: 16, h: 3 } } },
  });
  return bar.id;
});
await page.reload();
await page.waitForTimeout(1200);
const W = '.grid-stack-item[gs-id="wb"]';
const names = () => page.evaluate(async (barId) => (await chrome.bookmarks.getChildren(barId)).map(n => n.title), barId);
const tiles = () => page.$$eval(`${W} [data-bm] .link-title`, els => els.map(e => e.textContent));
check((await tiles()).join() === 'Alpha,Beta,Gamma,Delta,Работа', `видна строка закладок (${await tiles()})`);

// правый клик → меню → «Изменить»
await page.click(`${W} [data-bm]:nth-child(1)`, { button: 'right' });
await page.waitForTimeout(250);
const menu = await page.$$eval('.pop-menu .pop-item', els => els.map(e => e.textContent));
check(menu.join() === 'Открыть в новой вкладке,Изменить,Удалить', `меню закладки (${menu})`);
await page.screenshot({ path: `${out}/bm-1-menu.png`, clip: { x: 300, y: 260, width: 900, height: 360 } });
await page.click('.pop-item:has-text("Изменить")');
await page.waitForTimeout(250);
await page.fill('#modal-form input >> nth=0', 'Alpha 2');
await page.click('#modal-form button[type=submit]');
await page.waitForTimeout(500);
check((await names())[0] === 'Alpha 2' && (await tiles())[0] === 'Alpha 2', 'изменить: название поменялось и в браузере, и на вкладке');

// «⋯» при наведении → удалить → «Вернуть»
await page.hover(`${W} [data-bm]:nth-child(2)`);
await page.click(`${W} [data-bm]:nth-child(2) .bm-more`);
await page.click('.pop-item:has-text("Удалить")');
await page.waitForTimeout(500);
check((await names()).join() === 'Alpha 2,Gamma,Delta,Работа', 'удалить: закладка ушла из браузера');
await page.click('.toast-btn:has-text("Вернуть")');
await page.waitForTimeout(500);
check((await names()).join() === 'Alpha 2,Beta,Gamma,Delta,Работа', 'вернуть: на прежнем месте');

// перетаскивание: Alpha 2 — за Gamma; посередине пути соседи уже расступились
const box = async (i) => (await page.locator(`${W} [data-bm]:nth-child(${i})`).boundingBox());
let a = await box(1), g = await box(3);
await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
await page.mouse.down();
await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2, { steps: 4 });
await page.mouse.move(g.x + g.width * .85, g.y + g.height / 2, { steps: 12 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/bm-2-drag.png`, clip: { x: 300, y: 260, width: 900, height: 360 } });
const live = await page.$$eval(`${W} [data-bm] .link-title`, els => els.map(e => e.textContent));
check(live.join() === 'Beta,Gamma,Alpha 2,Delta,Работа', `перетаскивание: остальные расступились на лету (${live})`);
await page.mouse.up();
await page.waitForTimeout(600);
check((await names()).join() === 'Beta,Gamma,Alpha 2,Delta,Работа', `перетаскивание: порядок сохранился в браузере (${await names()})`);
const clicked = page.url();
check(clicked.startsWith('chrome-extension://'), 'перетаскивание: ссылка при отпускании не открылась');

// бросить Delta на середину папки — уходит внутрь
const d = await box(4), f = await box(5);
await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
await page.mouse.down();
await page.mouse.move(d.x + d.width / 2 + 20, d.y + d.height / 2, { steps: 4 });
await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2, { steps: 10 });
await page.waitForTimeout(200);
check(await page.locator(`${W} .bm-into`).count() === 1, 'в папку: папка подсвечена');
await page.mouse.up();
await page.waitForTimeout(600);
const inFolder = await page.evaluate(async (barId) => {
  const f = (await chrome.bookmarks.getChildren(barId)).find(n => n.title === 'Работа');
  return (await chrome.bookmarks.getChildren(f.id)).map(n => n.title);
}, barId);
check(inFolder.includes('Delta') && !(await names()).includes('Delta'), `в папку: закладка внутри (${inFolder})`);

// «+» → «Закладку»
await page.hover(W);
await page.click(`${W} .w-add`);
await page.click('.pop-item:has-text("Закладку")');
await page.waitForTimeout(250);
await page.fill('#modal-form input >> nth=0', 'example.org');
await page.click('#modal-form button[type=submit]');
await page.waitForTimeout(500);
check((await names()).at(-1) === 'example.org', `добавить: новая закладка в конце (${await names()})`);

// папку с содержимым — только после подтверждения, и её можно вернуть целиком
await page.click(`${W} [data-bm]:has-text("Работа")`, { button: 'right' });
await page.click('.pop-item:has-text("Удалить папку")');
await page.waitForTimeout(250);
check(await page.locator('#modal.open').count() === 1 && /Внутри: 3/.test(await page.textContent('#modal')), 'папка: спрашивает подтверждение');
await page.screenshot({ path: `${out}/bm-3-confirm.png` });
await page.click('#modal-form button[type=submit]');
await page.waitForTimeout(500);
check(!(await names()).includes('Работа'), 'папка: удалена');
await page.click('.toast-btn:has-text("Вернуть")');
await page.waitForTimeout(700);
const back = await page.evaluate(async (barId) => {
  const f = (await chrome.bookmarks.getChildren(barId)).find(n => n.title === 'Работа');
  return f ? (await chrome.bookmarks.getChildren(f.id)).map(n => n.title).join() : '';
}, barId);
check(back === 'Docs,Mail,Delta', `папка: вернулась со всем содержимым (${back})`);

// в раскрытой папке — то же меню по правому клику
await page.click(`${W} [data-bm]:has-text("Работа")`);
await page.waitForTimeout(250);
await page.click('.bm-pop .bm-item:has-text("Docs")', { button: 'right' });
await page.waitForTimeout(200);
check(await page.locator('.pop-menu .pop-item:has-text("Изменить")').count() === 1, 'папка: меню и для закладок внутри');
await page.keyboard.press('Escape');

console.log('errors:', errors.length ? errors.join('\n') : 'none');
await ctx.close();
fs.rmSync(userDir, { recursive: true, force: true });
fs.rmSync(ext, { recursive: true, force: true });
if (fails.length || errors.length) { console.error('FAIL:', fails.join('; ')); process.exit(1); }
console.log('OK');
