import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Как выглядят тосты стопкой и карточка «оцени в магазине»: node tests/toasts-look.mjs → tests/shots/toasts-*.png
const ext = path.resolve('plitka');
const out = path.resolve('tests/shots');
fs.mkdirSync(out, { recursive: true });
const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'torii-toasts-')), {
  headless: true, channel: 'chromium', viewport: { width: 1400, height: 800 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
await ctx.route('https://*.open-meteo.com/**', r => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('chrome://extensions');
const id = await page.evaluate(() => new Promise(r => chrome.management.getAll(l => r(l.find(x => x.installType === 'development')?.id))));
await page.goto(`chrome-extension://${id}/newtab.html?rate`);
await page.waitForTimeout(1500);
const t = (...a) => page.evaluate((a) => window.__plitka.toast(...a), a);
await t('Ссылка удалена', 'Вернуть'); await page.waitForTimeout(250);
await t('Задача удалена', 'Вернуть'); await page.waitForTimeout(250);
await t('Скопировано'); await page.waitForTimeout(250);
await t('Скопировано'); await page.waitForTimeout(600);
const clip = { x: 400, y: 0, width: 600, height: 230 };
await page.screenshot({ path: `${out}/toasts-1-stack.png`, clip });
await page.hover('.toasts .toast >> nth=0');
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/toasts-2-hover.png`, clip });
const n = await page.locator('.toast-n').first().textContent();
console.log('счётчик у «Скопировано»:', JSON.stringify(n));
await page.mouse.move(700, 600);
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/toasts-3-rate.png` });
console.log('карточка оценки:', await page.locator('.donate-ask').count(), await page.locator('.donate-ask a').getAttribute('href'));
console.log('ошибки:', errors.length ? errors : 'нет');
await ctx.close();
