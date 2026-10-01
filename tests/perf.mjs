import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Замер скорости (npm run perf): открытие вкладки с тяжёлой картинкой-фоном и десятком виджетов,
// долгие задачи (>50 мс) при открытии и цена движения ползунка в панели. Сеть замокана.
const ext = path.resolve('plitka');
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'torii-perf-'));
const ctx = await chromium.launchPersistentContext(userDir, {
  headless: true, channel: 'chromium', viewport: { width: 1600, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
await ctx.route(/open-meteo|cbr-xml|cataas|nekos|favicon|google\.com\/s2/, r => r.abort());
await ctx.addInitScript(() => {
  window.__long = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch {}
});
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (/\[plitka\]|\[mesh\]/.test(m.text())) logs.push(m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('chrome://extensions');
const id = await page.evaluate(() => new Promise(r => chrome.management.getAll(l => r(l.find(x => x.name.startsWith('Torii'))?.id))));
const url = `chrome-extension://${id}/newtab.html`;
await page.goto(url);
await page.waitForTimeout(500);

// тяжёлая картинка 2560×1440 (шум — плохо жмётся, как фото)
const IMG = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 2560; c.height = 1440;
  const g = c.getContext('2d');
  const d = g.createImageData(2560, 1440);
  for (let i = 0; i < d.data.length; i += 4) { const v = (i / 4) % 2560 / 10 + Math.random() * 60; d.data[i] = v; d.data[i + 1] = v * .8 + 40; d.data[i + 2] = 120 + Math.random() * 60; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  return c.toDataURL('image/jpeg', 0.9);
});
const types = ['clock', 'search', 'links', 'weather', 'notes', 'todo', 'pomodoro', 'quote', 'word', 'habits', 'rates', 'countdown'];
await page.evaluate(([IMG, types]) => chrome.storage.local.set({
  settings: { bgImage: IMG, photo: { plain: false, mode: 'frosted' }, glassKind: 'liquid' },
  widgets: types.map((type, i) => ({ id: 'p' + i, type, data: {} })),
  layouts: { lg: Object.fromEntries(types.map((t, i) => ['p' + i, { x: (i % 4) * 6, y: Math.floor(i / 4) * 4, w: 6, h: 3 }])) },
}), [IMG, types]);
console.log(`картинка-фон: ${(IMG.length / 1024 / 1024).toFixed(2)} МБ base64`);

// --profile: профиль JS при открытии вкладки — топ функций по собственному времени
if (process.argv.includes('--profile')) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await cdp.send('Profiler.start');
  await page.goto(url);
  await page.waitForTimeout(1500);
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map();
  const dt = profile.timeDeltas;
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  profile.samples.forEach((id, i) => {
    const n = byId.get(id), f = n.callFrame;
    const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + (dt[i] || 0) / 1000);
  });
  console.log('профиль (мс собственного времени):');
  for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log(`  ${v.toFixed(1).padStart(6)}  ${k}`);
}

const runs = [];
for (let i = 0; i < 5; i++) {
  logs.length = 0;
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__plitka, null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
  const long = await page.evaluate(() => window.__long);
  const num = (re) => +(logs.find(l => re.test(l))?.match(/(\d+) мс/)?.[1] ?? NaN);
  runs.push({ ready: num(/вкладка готова/), bg: num(/фон готов/), dcl: nav.dcl, long: long.reduce((a, b) => a + b, 0), longN: long.length });
  if (i === 0) console.log('логи:', logs.join(' | '));
}
const med = (k) => runs.map(r => r[k]).sort((a, b) => a - b)[2];
console.log(`открытие (медиана из 5): DOMContentLoaded ${med('dcl')} мс · вкладка готова ${med('ready')} мс · фон ${med('bg')} мс · долгие задачи ${med('long')} мс (${med('longN')} шт.)`);

// цена ползунка: 40 шагов «Затемнения» в панели
await page.click('#btn-settings');
await page.waitForTimeout(600);
const slider = await page.evaluate(async () => {
  const inp = [...document.querySelectorAll('.panel input[type=range]')].find(i => i.closest('label')?.textContent.includes('Затемнение'));
  if (!inp) return null;
  const t0 = performance.now();
  for (let i = 0; i < 40; i++) { inp.value = String((i % 16) / 20); inp.dispatchEvent(new Event('input', { bubbles: true })); }
  const sync = performance.now() - t0;
  await new Promise(r => setTimeout(r, 600)); // отложенное сохранение
  return { sync: Math.round(sync), per: +(sync / 40).toFixed(2) };
});
console.log(`ползунок «Затемнение»: 40 шагов за ${slider?.sync} мс (${slider?.per} мс на шаг)`);
const bytes = await page.evaluate(() => new Promise(r => chrome.storage.local.getBytesInUse('settings', r)));
console.log(`ключ settings в хранилище: ${(bytes / 1024).toFixed(0)} КБ`);
await ctx.close();
fs.rmSync(userDir, { recursive: true, force: true });
