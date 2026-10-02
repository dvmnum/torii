import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Скриншоты для магазинов (npm run store): store/screenshots/{ru,en}/*.png — 1280×800 (размер Chrome Web Store),
// и промо-плитка store/promo-440x280.png. Погода, курсы и котики — заглушки; иконки сайтов — настоящие (нужна сеть).
const ext = path.resolve('plitka');
const OUT = path.resolve('store');
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'torii-store-'));
const ctx = await chromium.launchPersistentContext(userDir, {
  headless: true, channel: 'chromium', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const hourIso = (i) => { const d = new Date(Date.now() + i * 3600000); d.setMinutes(0, 0, 0); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const dayIso = (i) => new Date(Date.now() + i * 864e5).toISOString().slice(0, 10);
let city = 'Москва'; // для английских снимков — London
await ctx.route('https://geocoding-api.open-meteo.com/**', r => r.fulfill({ json: { results: [{ name: city, latitude: 55.75, longitude: 37.62 }] } }));
await ctx.route('https://api.open-meteo.com/**', r => r.fulfill({ json: {
  current: { temperature_2m: 14.3, weather_code: 2, apparent_temperature: 12.6, relative_humidity_2m: 64, wind_speed_10m: 3.1 },
  daily: { time: [...Array(7)].map((_, i) => dayIso(i)), weather_code: [2, 3, 61, 0, 1, 3, 0], temperature_2m_max: [16, 15, 12, 17, 18, 14, 16], temperature_2m_min: [8, 9, 7, 9, 10, 8, 9], sunrise: [hourIso(-7)], sunset: [hourIso(4)], precipitation_probability_max: [20] },
  hourly: { time: [...Array(24)].map((_, i) => hourIso(i)), temperature_2m: [...Array(24)].map((_, i) => 14 - i / 4), weather_code: [...Array(24)].map((_, i) => [2, 2, 3, 61, 3, 1][i % 6]), precipitation_probability: [...Array(24)].map((_, i) => [0, 10, 30, 60, 20, 0][i % 6]) },
} }));
await ctx.route('https://www.cbr-xml-daily.ru/**', r => r.fulfill({ json: { Date: new Date().toISOString(), Valute: { USD: { Nominal: 1, Value: 81.72, Previous: 81.4 }, EUR: { Nominal: 1, Value: 95.1, Previous: 95.6 }, CNY: { Nominal: 1, Value: 11.38, Previous: 11.31 } } } }));

const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('chrome://extensions');
const id = await page.evaluate(() => new Promise(r => chrome.management.getAll(l => r(l.find(x => x.name.startsWith('Torii'))?.id))));
const url = `chrome-extension://${id}/newtab.html`;
await page.goto(url);
await page.waitForTimeout(800);

// поставить раскладку: блоки, позиции, фон-заготовка, язык; потом перезагрузить и дать фону и иконкам появиться
async function scene({ preset, lang = 'ru', widgets, extra = {}, scenes = null }) {
  await page.evaluate(async ({ preset, lang, widgets, extra, scenes }) => {
    const p = Mesh.PRESETS.find(x => x.id === preset);
    const { id: _id, title: _t, ...mesh } = p;
    await chrome.storage.local.clear();
    await chrome.storage.local.set({
      settings: { lang, mesh: { ...mesh, preset }, ...extra },
      widgets: widgets.map(([type, , , , , data], i) => ({ id: 's' + i, type, data: {
        ...(type === 'weather' ? { city: lang === 'en' ? 'London' : 'Москва' } : {}),
        ...(type === 'search' && lang === 'en' ? { engine: 'google' } : {}),
        ...data,
      } })),
      layouts: { lg: Object.fromEntries(widgets.map(([, x, y, w, h], i) => ['s' + i, { x, y, w, h }])) },
      ...(scenes ? { scenes } : {}),
    });
  }, { preset, lang, widgets, extra, scenes });
  await page.reload();
  await page.waitForTimeout(2500); // фон и погода
  // иконки сайтов — ждём, пока все картинки догрузятся (или сдадутся в букву-заглушку), до 15 с
  await page.waitForFunction(() => [...document.querySelectorAll('.link-ico img')].every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 })
    .catch(() => console.log('  (не все иконки сайтов загрузились)'));
  await page.waitForTimeout(500);
}
const shot = async (lang, name) => {
  fs.mkdirSync(path.join(OUT, 'screenshots', lang), { recursive: true });
  await page.mouse.move(1279, 400); // курсор не на блоке
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'screenshots', lang, name) });
  console.log(`${lang}/${name}`);
};

const dk = (i) => { const d = new Date(); d.setDate(d.getDate() - i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const T = {
  ru: {
    notes: 'Созвон в 15:00\nКупить билеты на пятницу\nДописать раздел про скорость',
    todo: [['Ответить на письма', true], ['Ревью макетов', false], ['Записаться в зал', false], ['Позвонить маме', false]],
    habits: [['Вода 2 л', [0, 1, 2, 4]], ['Спорт', [1, 3]], ['Чтение', [0, 1, 2, 3, 5]]],
    countdown: { title: 'Отпуск', date: dayIso(23).split('-').reverse().join('.') },
    scenes: ['Работа', 'Дом', 'Учёба'],
    links: null, // стандартные
    city: 'Москва',
    // цитата и слово дня — русские тексты, на русских снимках они уместны
    extras: [['quote', 18, 4, 6, 4], ['word', 0, 8, 7, 3]],
  },
  en: {
    // международные сайты вместо Хабра и Кинопоиска; цитата и слово дня у нас пока только по-русски — их не показываем
    links: [['YouTube', 'https://youtube.com'], ['GitHub', 'https://github.com'], ['Gmail', 'https://mail.google.com'], ['Figma', 'https://figma.com'], ['Notion', 'https://notion.so'], ['Claude', 'https://claude.ai']].map(([title, url]) => ({ title, url })),
    city: 'London',
    extras: [['greeting', 18, 4, 6, 4, { font: 'playfair', sub: 'date' }], ['notes', 0, 8, 7, 3, { text: 'Groceries: oat milk, apples\nGym at 7' }]],
    notes: 'Call at 3 pm\nBook tickets for Friday\nFinish the speed section',
    todo: [['Reply to emails', true], ['Review mockups', false], ['Book the gym', false], ['Call mom', false]],
    habits: [['Water 2 l', [0, 1, 2, 4]], ['Workout', [1, 3]], ['Reading', [0, 1, 2, 3, 5]]],
    countdown: { title: 'Vacation', date: dayIso(23).split('-').reverse().join('.') },
    scenes: ['Work', 'Home', 'Study'],
  },
};

for (const lang of ['ru', 'en']) {
  const t = T[lang];
  city = t.city;
  const main = [
    ['clock', 6, 2, 12, 4], ['search', 5, 6, 14, 1], ['links', 6, 8, 12, 2, t.links ? { links: t.links } : {}],
    ['weather', 0, 0, 6, 3, { view: 'details' }], ['notes', 19, 0, 5, 5, { text: t.notes }],
  ];
  // 1. главный экран
  await scene({ preset: 'lagoon', lang, widgets: main });
  await shot(lang, '1-main.png');

  // 2. редактор: блоки двигаются и растягиваются, каталог виджетов
  await page.keyboard.press('e');
  await page.waitForTimeout(400);
  await page.hover('.grid-stack-item[gs-id="s3"]');
  await page.waitForTimeout(300);
  await page.click('#btn-add');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'screenshots', lang, '2-edit.png') });
  console.log(`${lang}/2-edit.png`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // 3. живые фоны: неон и панель с заготовками
  await scene({ preset: 'neon', lang, widgets: [['clock', 2, 3, 10, 4], ['search', 1, 7, 12, 1]], extra: { fx: { particles: .35, vignette: .3 } } });
  await page.click('#btn-settings');
  await page.waitForTimeout(3500); // миниатюры заготовок рисуются по одной
  await shot(lang, '3-backgrounds.png');
  await page.keyboard.press('Escape');

  // 4. много виджетов
  await scene({
    preset: 'dusk', lang, widgets: [
      ['pomodoro', 0, 0, 5, 5], ['todo', 5, 0, 6, 5, { items: t.todo.map(([text, done], i) => ({ id: 'i' + i, text, done })) }],
      ['habits', 11, 0, 7, 4, { habits: t.habits.map(([name, ds], i) => ({ id: 'h' + i, name, days: Object.fromEntries(ds.map(d => [dk(d), true])) })) }],
      ['rates', 18, 0, 6, 4], ['weather', 0, 5, 11, 3, { view: 'hours' }], ['countdown', 11, 4, 7, 4, t.countdown],
      ...t.extras, ['clock', 7, 8, 6, 3, { style: 'analog', greeting: false }], ['search', 13, 9, 11, 1],
    ],
  });
  await shot(lang, '4-widgets.png');

  // 5. раскладки: несколько наборов, переключение Alt+1…9
  await scene({
    preset: 'forest', lang,
    widgets: [['clock', 6, 2, 12, 4], ['search', 5, 6, 14, 1], ['todo', 0, 0, 6, 5, { items: t.todo.map(([text, done], i) => ({ id: 'i' + i, text, done })) }], ['weather', 17, 0, 7, 2]],
    scenes: { active: 'a', list: t.scenes.map((name, i) => ({ id: 'abc'[i], name })) },
  });
  await page.click('#btn-scenes');
  await page.waitForTimeout(500);
  await shot(lang, '5-layouts.png');
  await page.keyboard.press('Escape');
}

// промо-картинки (плитка 440×280 и большая 1400×560) — отдельно: scripts/store-promo.mjs
await ctx.close();
fs.rmSync(userDir, { recursive: true, force: true });
