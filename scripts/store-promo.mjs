import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

// Промо-картинки для Chrome Web Store (часть npm run store, можно и отдельно — node scripts/store-promo.mjs):
//   store/promo-440x280-{en,ru}.png    — малая плитка: иконка, название, фраза на тёмном фоне
//   store/marquee-1400x560-{en,ru}.png — большая: то же слева + скриншот вкладки справа (берётся из store/screenshots)
// Без альфа-канала (24-битный PNG) — так требует магазин; фон сплошной, тёмный, без свечений.
const ext = path.resolve('plitka');
const OUT = path.resolve('store');
const icon = fs.readFileSync(path.join(ext, 'icons', 'icon.svg'), 'utf8');
const b64 = (f) => fs.readFileSync(f).toString('base64');
const font = (f) => b64(path.join(ext, 'fonts', f));
const FONTS = `
  @font-face { font-family: M; src: url(data:font/woff2;base64,${font('manrope-latin-wght-normal.woff2')}) format('woff2'); font-weight: 200 800; unicode-range: U+0000-00FF, U+2000-206F; }
  @font-face { font-family: M; src: url(data:font/woff2;base64,${font('manrope-cyrillic-wght-normal.woff2')}) format('woff2'); font-weight: 200 800; unicode-range: U+0400-045F; }`;
const BG = '#0d0e11';
const TEXT = {
  en: { line: 'New tab with a free-form<br>layout of widgets', big: 'A new tab that<br><em>you lay out</em>', sub: 'Drag and resize widgets anywhere.<br>Live backgrounds, glass, saved layouts.' },
  ru: { line: 'Новая вкладка со свободной<br>раскладкой виджетов', big: 'Новая вкладка,<br>которую <em>раскладываешь ты</em>', sub: 'Двигай и растягивай виджеты как хочешь.<br>Живые фоны, стекло, раскладки.' },
};

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(file, w, h, html) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><style>${FONTS}
    html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: ${BG}; color: #f4f4f5; font-family: M, sans-serif; }
    svg.icon { flex: none; filter: drop-shadow(0 12px 28px rgba(0,0,0,.45)); }
  </style>${html}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, file), omitBackground: false });
  console.log(file);
}
const iconSvg = (size) => icon.replace('<svg ', `<svg class="icon" width="${size}" height="${size}" `);

for (const lang of ['en', 'ru']) {
  const t = TEXT[lang];
  // малая плитка 440×280
  await render(`promo-440x280-${lang}.png`, 440, 280, `
    <style>
      body { display: flex; align-items: center; gap: 22px; padding: 0 36px; box-sizing: border-box; }
      h1 { margin: 0; font-size: 46px; font-weight: 800; letter-spacing: -.02em; }
      p { margin: 6px 0 0; font-size: 17px; font-weight: 600; line-height: 1.3; color: rgba(244,244,245,.72); }
    </style>${iconSvg(96)}<div><h1>Torii</h1><p>${t.line}</p></div>`);

  // большая 1400×560: слева иконка, название, фраза; справа скриншот, выходящий за правый край
  const shot = b64(path.join(OUT, 'screenshots', lang, '1-main.png'));
  await render(`marquee-1400x560-${lang}.png`, 1400, 560, `
    <style>
      .left { position: absolute; left: 96px; top: 50%; transform: translateY(-50%); width: 520px; }
      .brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 800; letter-spacing: -.01em; margin-bottom: 26px; }
      h1 { margin: 0; font-size: 50px; line-height: 1.06; font-weight: 800; letter-spacing: -.03em; }
      h1 em { font-style: normal; color: #b9adff; }
      p { margin: 20px 0 0; font-size: 20px; line-height: 1.45; font-weight: 600; color: rgba(244,244,245,.62); }
      .shot { position: absolute; left: 700px; top: 70px; width: 840px; border-radius: 18px; border: 1px solid rgba(255,255,255,.1);
        box-shadow: 0 40px 100px -30px rgba(0,0,0,.9); }
    </style>
    <div class="left"><div class="brand">${iconSvg(52)}Torii</div><h1>${t.big}</h1><p>${t.sub}</p></div>
    <img class="shot" src="data:image/png;base64,${shot}" alt="">`);
}
await browser.close();
