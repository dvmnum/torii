import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

// PNG-иконки расширения из plitka/icons/icon.svg: node scripts/make-icons.mjs
const dir = path.resolve('plitka/icons');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.locator('svg').screenshot({ path: path.join(dir, `icon${size}.png`), omitBackground: true });
  console.log('icon' + size);
}
await browser.close();
