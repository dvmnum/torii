import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

// Картинки и шрифты для сайта (npm run site): скриншоты из store/ → site/img/{ru,en}/*.webp (PNG по ~1 МБ — тяжело для сайта),
// промо-плитка → og-картинка для соцсетей, плюс иконка и шрифт Manrope. Сначала — npm run store.
const STORE = path.resolve('store');
const SITE = path.resolve('site');
const browser = await chromium.launch();
const page = await browser.newPage();

// PNG → WebP через canvas браузера (без сторонних пакетов)
async function toWebp(src, dst, quality = 0.84) {
  const b64 = fs.readFileSync(src).toString('base64');
  const out = await page.evaluate(async ({ b64, quality }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', quality).split(',')[1];
  }, { b64, quality });
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, Buffer.from(out, 'base64'));
  console.log(`${path.relative(process.cwd(), dst)} — ${(fs.statSync(dst).size / 1024).toFixed(0)} КБ`);
}

for (const lang of ['ru', 'en']) {
  for (const f of fs.readdirSync(path.join(STORE, 'screenshots', lang))) {
    await toWebp(path.join(STORE, 'screenshots', lang, f), path.join(SITE, 'img', lang, f.replace(/\.png$/, '.webp')));
  }
  fs.copyFileSync(path.join(STORE, `promo-440x280-${lang}.png`), path.join(SITE, 'img', `og-${lang}.png`));
}
fs.mkdirSync(path.join(SITE, 'fonts'), { recursive: true });
for (const f of ['manrope-latin-wght-normal.woff2', 'manrope-cyrillic-wght-normal.woff2']) fs.copyFileSync(path.join('plitka', 'fonts', f), path.join(SITE, 'fonts', f));
fs.copyFileSync(path.join('plitka', 'icons', 'icon.svg'), path.join(SITE, 'img', 'icon.svg'));
fs.copyFileSync(path.join('plitka', 'icons', 'icon128.png'), path.join(SITE, 'img', 'icon128.png'));
await browser.close();
