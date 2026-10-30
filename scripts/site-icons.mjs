import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

// Иконки стандартных ссылок — в пакет (plitka/icons/sites/<host>.webp, 96×96): новая вкладка с первого открытия без пустых плиток.
// Берём у Google (как их показывает favicon() — тот же вид), в браузере перекодируем в webp. Список — FavImg.BUNDLED в widgets.js.
// Запуск: node scripts/site-icons.mjs (нужна сеть). После — проверить, что FavImg.BUNDLED и список ниже совпадают.
const HOSTS = ['youtube.com', 'github.com', 'web.telegram.org', 'habr.com', 'kinopoisk.ru', 'claude.ai'];
const dir = path.resolve('plitka/icons/sites');
fs.mkdirSync(dir, { recursive: true });

const b = await chromium.launch();
const page = await b.newPage();
for (const host of HOSTS) {
  const r = await fetch(`https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${host}&size=128`);
  if (!r.ok) { console.log('нет иконки:', host, r.status); continue; }
  const png = Buffer.from(await r.arrayBuffer()).toString('base64');
  const webp = await page.evaluate(async (png) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob());
    const c = document.createElement('canvas'); c.width = c.height = 96;
    c.getContext('2d').drawImage(bmp, 0, 0, 96, 96);
    return c.toDataURL('image/webp', 0.92).split(',')[1];
  }, png);
  fs.writeFileSync(path.join(dir, `${host}.webp`), Buffer.from(webp, 'base64'));
  console.log(host, Math.round(Buffer.from(webp, 'base64').length / 1024 * 10) / 10, 'КБ');
}
await b.close();
