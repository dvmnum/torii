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
  const sub = await chrome.bookmarks.create({ parentId: f.id, title: 'Архив' });
  await chrome.bookmarks.create({ parentId: sub.id, title: 'Old', url: 'https://old.example/' });
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
check(await page.locator(`${W} .bm-add, ${W} .bm-more, ${W} .bm-tree-btn`).count() === 0, 'ни «+», ни «⋯», ни кнопок в углу — всё по правому клику');
const mini = await page.$$eval(`${W} [data-bm] .bm-folder-ico > span`, els => els.map(e => { const r = e.getBoundingClientRect(), c = e.firstElementChild?.getBoundingClientRect(); return [Math.round(r.width), Math.round(c?.width || 0), e.firstElementChild?.tagName, e.textContent]; }));
check(mini.length === 2 && mini.every(([w, cw]) => w >= 8 && cw >= 6), `папка: в значке мини-иконки сайтов внутри (${JSON.stringify(mini)})`);
await page.locator(W).screenshot({ path: `${out}/bm-0-bar.png` });

// правый клик → меню → «Изменить»
await page.click(`${W} [data-bm]:nth-child(1)`, { button: 'right' });
await page.waitForTimeout(250);
const menu = await page.$$eval('.pop-menu .pop-item', els => els.map(e => e.textContent));
check(menu.join() === 'Открыть в новой вкладке,Изменить,Удалить,Добавить закладку,Добавить папку,Все закладки' && await page.locator('.pop-menu .pop-sep').count() === 2, `меню закладки: её действия, потом «добавить» и «все закладки» (${menu})`);
await page.screenshot({ path: `${out}/bm-1-menu.png`, clip: { x: 300, y: 260, width: 900, height: 360 } });
await page.click('.pop-item:has-text("Изменить")');
await page.waitForTimeout(250);
await page.fill('#modal-form input >> nth=0', 'Alpha 2');
await page.click('#modal-form button[type=submit]');
await page.waitForTimeout(500);
check((await names())[0] === 'Alpha 2' && (await tiles())[0] === 'Alpha 2', 'изменить: название поменялось и в браузере, и на вкладке');

// удалить → «Вернуть»
await page.click(`${W} [data-bm]:nth-child(2)`, { button: 'right' });
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

// правый клик по Gamma → «Добавить закладку» — новая встаёт сразу за ней
await page.click(`${W} [data-bm]:has-text("Gamma")`, { button: 'right' });
await page.click('.pop-item:has-text("Добавить закладку")');
await page.waitForTimeout(250);
await page.fill('#modal-form input >> nth=0', 'example.org');
await page.click('#modal-form button[type=submit]');
await page.waitForTimeout(500);
check((await names()).join() === 'Beta,Gamma,example.org,Alpha 2,Работа', `добавить: новая закладка сразу за той, по которой кликнули (${await names()})`);

// папка как в iOS: окошко с плитками, вложенная — там же со стрелкой «назад»
await page.click(`${W} [data-bm]:has-text("Работа")`);
await page.waitForTimeout(450);
const fp = await page.evaluate(() => {
  const g = document.querySelector('.fp-overlay.open .fp-grid');
  return g && { title: document.querySelector('.fp-title').textContent, tiles: [...g.querySelectorAll('[data-bm] .link-title')].map(e => e.textContent),
    cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, back: !document.querySelector('.fp-back').hidden };
});
check(fp && fp.title === 'Работа' && fp.tiles.join() === 'Docs,Mail,Архив,Delta' && fp.cols === 3 && !fp.back, `папка: окошко с плитками (${JSON.stringify(fp)})`);
await page.screenshot({ path: `${out}/bm-4-folder.png` });
const gb = await page.locator('.fp-grid').boundingBox();
await page.mouse.click(gb.x + gb.width - 8, gb.y + gb.height - 8, { button: 'right' });
await page.waitForTimeout(200);
const fpMenu = await page.$$eval('.pop-menu .pop-item', els => els.map(e => e.textContent));
check(fpMenu.join() === 'Добавить закладку,Добавить папку', `папка: правый клик по пустому месту — добавить внутрь (${fpMenu})`);
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
await page.click('.fp-grid [data-bm]:has-text("Архив")');
await page.waitForTimeout(300);
check((await page.textContent('.fp-title')) === 'Архив' && await page.locator('.fp-back:visible').count() === 1, 'папка: вложенная открылась там же, есть «назад»');
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
check((await page.textContent('.fp-title')) === 'Работа', 'папка: Esc — на уровень выше');
// перетаскивание внутри окошка: Docs — в конец
const fb = async (t) => page.locator(`.fp-grid [data-bm]:has-text("${t}")`).boundingBox();
const dd = await fb('Docs'), dl = await fb('Delta');
await page.mouse.move(dd.x + dd.width / 2, dd.y + dd.height / 2);
await page.mouse.down();
await page.mouse.move(dd.x + dd.width / 2 + 15, dd.y + dd.height / 2, { steps: 3 });
await page.mouse.move(dl.x + dl.width * .9, dl.y + dl.height / 2, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(600);
const inF = await page.$$eval('.fp-grid [data-bm] .link-title', els => els.map(e => e.textContent));
check(inF.join() === 'Mail,Архив,Delta,Docs', `папка: порядок внутри меняется перетаскиванием (${inF})`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check(await page.locator('.fp-overlay').count() === 0, 'папка: Esc закрывает окошко');

// все закладки деревом — из меню по правому клику (здесь — по пустому месту блока)
const wb = await page.locator(`${W} .w-links`).boundingBox();
await page.mouse.click(wb.x + 6, wb.y + 6, { button: 'right' });
await page.waitForTimeout(200);
const emptyMenu = await page.$$eval('.pop-menu .pop-item', els => els.map(e => e.textContent));
check(emptyMenu.join() === 'Добавить закладку,Добавить папку,Все закладки', `пустое место: своё меню (${emptyMenu})`);
await page.click('.pop-item:has-text("Все закладки")');
await page.waitForTimeout(350);
const tree = await page.$$eval('.bm-tree .bm-title', els => els.map(e => e.textContent));
check(tree.includes('Работа') && tree.includes('example.org'), `дерево: строка закладок раскрыта (${tree.slice(0, 8)})`);
await page.click('.bm-tree .bm-folder:has-text("Работа")');
await page.waitForTimeout(200);
check((await page.$$eval('.bm-tree .bm-title', els => els.map(e => e.textContent))).includes('Docs'), 'дерево: папка раскрывается');
await page.screenshot({ path: `${out}/bm-5-tree.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// папку с содержимым — только после подтверждения, и её можно вернуть целиком
await page.click(`${W} [data-bm]:has-text("Работа")`, { button: 'right' });
await page.click('.pop-item:has-text("Удалить папку")');
await page.waitForTimeout(250);
check(await page.locator('#modal.open').count() === 1 && /Внутри: 5/.test(await page.textContent('#modal')), 'папка: спрашивает подтверждение');
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
check(back === 'Mail,Архив,Delta,Docs', `папка: вернулась со всем содержимым (${back})`);

// в раскрытой папке — то же меню по правому клику
await page.click(`${W} [data-bm]:has-text("Работа")`);
await page.waitForTimeout(450);
await page.click('.fp-grid [data-bm]:has-text("Docs")', { button: 'right' });
await page.waitForTimeout(200);
check(await page.locator('.pop-menu .pop-item:has-text("Изменить")').count() === 1, 'папка: меню и для закладок внутри');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
check(await page.locator('.fp-overlay.open').count() === 1, 'папка: Esc сначала закрывает меню, а не окошко');
await page.keyboard.press('Escape');

console.log('errors:', errors.length ? errors.join('\n') : 'none');
await ctx.close();
fs.rmSync(userDir, { recursive: true, force: true });
fs.rmSync(ext, { recursive: true, force: true });
if (fails.length || errors.length) { console.error('FAIL:', fails.join('; ')); process.exit(1); }
console.log('OK');
