import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Быстрая диагностика: открыть новую вкладку расширения и вывести ошибки консоли
const ext = path.resolve('plitka');
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plitka-dbg-'));
const ctx = await chromium.launchPersistentContext(userDir, {
  headless: true, channel: 'chromium', viewport: { width: 1600, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const page = await ctx.newPage();
page.on('console', m => console.log(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => console.log('[pageerror]', e.stack || e.message));
await page.goto('chrome://extensions');
const id = await page.evaluate(() => new Promise(r => chrome.management.getAll(l => r(l.find(x => x.name.startsWith('Plitka'))?.id))));
await page.goto(`chrome-extension://${id}/newtab.html`);
await page.waitForTimeout(2000);
console.log('widgets:', await page.locator('.grid-stack-item').count());
await ctx.close();
fs.rmSync(userDir, { recursive: true, force: true });
