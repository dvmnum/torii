// Реестр виджетов. Каждый виджет: мета + дефолты + render(body, data, ctx) → { destroy?, update? }
const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
};

// Иконки сайтов: Google s2 → Яндекс → монограмма
function faviconSources(pageUrl, size = 64) {
  let host = '';
  try { host = new URL(pageUrl).hostname; } catch { return []; }
  const list = [
    `https://www.google.com/s2/favicons?sz=${size}&domain=${host}`,
    `https://favicon.yandex.net/favicon/v2/${host}?size=${Math.min(size, 120)}`,
  ];
  return list;
}

function faviconUrl(pageUrl, size = 64) {
  return faviconSources(pageUrl, size)[0] || '';
}

// <img> с цепочкой запасных источников; если всё упало — буква
function favicon(pageUrl, title, size = 64) {
  const srcs = faviconSources(pageUrl, size);
  const letter = (title || hostOf(pageUrl) || '?').trim()[0]?.toUpperCase() || '?';
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  let i = 0;
  const next = () => {
    if (i < srcs.length) { img.src = srcs[i++]; return; }
    const m = document.createElement('span');
    m.className = 'mono';
    m.textContent = letter;
    img.replaceWith(m);
  };
  img.addEventListener('error', next);
  // крошечная картинка (заглушка-глобус 16px или прозрачный 1×1 у Яндекса) — следующий источник, а после последнего — буква
  img.addEventListener('load', () => { if (img.naturalWidth && img.naturalWidth < 17) next(); });
  next();
  return img;
}

function normalizeUrl(u) {
  u = (u || '').trim();
  if (!u) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  return u;
}

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
}

const ICONS = {
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>',
  cloud: '<svg viewBox="0 0 24 24"><path d="M7 18.5h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.2 11 3.8 3.8 0 0 0 7 18.5z"/></svg>',
  partly: '<svg viewBox="0 0 24 24"><path d="M8.5 5.2a3.8 3.8 0 0 1 5.6 2.1M4.2 9.6H3M6 4.4l-.8-.8M8.9 2.8V2"/><path d="M8 19.5h9.5a3.8 3.8 0 0 0 .4-7.6 5.3 5.3 0 0 0-10.1 1.1A3.3 3.3 0 0 0 8 19.5z"/></svg>',
  rain: '<svg viewBox="0 0 24 24"><path d="M7 15h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.2 7.5 3.8 3.8 0 0 0 7 15z"/><path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/></svg>',
  snow: '<svg viewBox="0 0 24 24"><path d="M7 14h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.2 6.5 3.8 3.8 0 0 0 7 14z"/><path d="M8 18.5h.01M12 17.5h.01M16 18.5h.01M10 21h.01M14 21h.01" stroke-width="2.4"/></svg>',
  storm: '<svg viewBox="0 0 24 24"><path d="M7 14.5h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.2 7 3.8 3.8 0 0 0 7 14.5z"/><path d="M12.5 13.5l-2 4h3l-2 4"/></svg>',
  fog: '<svg viewBox="0 0 24 24"><path d="M4 9h16M3 13h18M5 17h14"/></svg>',
};

function weatherInfo(code) {
  if (code === 0) return ['Ясно', 'sun'];
  if (code <= 2) return ['Малооблачно', 'partly'];
  if (code === 3) return ['Пасмурно', 'cloud'];
  if (code <= 48) return ['Туман', 'fog'];
  if (code <= 67 || (code >= 80 && code <= 82)) return ['Дождь', 'rain'];
  if (code <= 77 || code === 85 || code === 86) return ['Снег', 'snow'];
  return ['Гроза', 'storm'];
}

// Поисковики; bang — префикс «!x запрос».
// browser — поисковик, выбранный в самом браузере (chrome.search.query): по умолчанию, этого требует Chrome Web Store
const ENGINES = {
  browser: { name: 'Как в браузере', url: null },
  yandex: { name: 'Яндекс', in: 'Яндексе', bang: 'y', url: 'https://yandex.ru/search/?text=' },
  google: { name: 'Google', bang: 'g', url: 'https://www.google.com/search?q=' },
  duck: { name: 'DuckDuckGo', bang: 'd', url: 'https://duckduckgo.com/?q=' },
  bing: { name: 'Bing', bang: 'b', url: 'https://www.bing.com/search?q=' },
  perplexity: { name: 'Perplexity', bang: 'p', url: 'https://www.perplexity.ai/search?q=' },
  chatgpt: { name: 'ChatGPT', bang: 'gpt', url: 'https://chatgpt.com/?q=' },
  claude: { name: 'Claude', bang: 'c', url: 'https://claude.ai/new?q=' },
  youtube: { name: 'YouTube', in: 'YouTube', bang: 'yt', url: 'https://www.youtube.com/results?search_query=' },
  wiki: { name: 'Википедия', in: 'Википедии', bang: 'w', url: 'https://ru.wikipedia.org/w/index.php?search=' },
};
// иконки — из готовых паков (js/engine-icons.js), заливка currentColor
const engineIcon = (e) => {
  const k = Object.keys(ENGINES).find(x => ENGINES[x] === e);
  if (k === 'browser') return '<svg viewBox="0 0 24 24" class="brand-svg brand-browser"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5L20.5 20.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const i = ENGINE_ICONS[k];
  return i ? `<svg viewBox="${i.vb}" class="brand-svg brand-${k}"><path d="${i.d}"/></svg>` : '';
};

// Калькулятор в строке поиска: + − × ÷ ^ % и скобки. Свой разбор — eval в расширениях запрещён (CSP), да и не нужен.
// Вернёт число или null, если это не выражение.
function calc(src) {
  const s = src.replace(/\s+/g, '').replace(/,/g, '.').replace(/[×х]/g, '*').replace(/[÷:]/g, '/').replace(/−/g, '-');
  if (!/^[\d.+\-*/^%()]+$/.test(s) || !/\d/.test(s) || !/[+\-*/^%]/.test(s.replace(/^-/, ''))) return null;
  let i = 0;
  const peek = () => s[i];
  const num = () => {
    const m = s.slice(i).match(/^\d*\.?\d+/);
    if (!m) throw 0;
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const atom = () => {
    if (peek() === '-') { i++; return -atom(); }
    if (peek() === '(') { i++; const v = expr(); if (s[i++] !== ')') throw 0; return v; }
    let v = num();
    if (peek() === '%') { i++; v /= 100; }
    return v;
  };
  const pow = () => { const b = atom(); if (peek() === '^') { i++; return Math.pow(b, pow()); } return b; };
  const term = () => { let v = pow(); while (peek() === '*' || peek() === '/') v = s[i++] === '*' ? v * pow() : v / pow(); return v; };
  const expr = () => { let v = term(); while (peek() === '+' || peek() === '-') v = s[i++] === '+' ? v + term() : v - term(); return v; };
  try {
    const v = expr();
    return i === s.length && Number.isFinite(v) ? v : null;
  } catch { return null; }
}

const GLASS_SETTING = { key: 'glass', label: 'Стеклянная подложка', type: 'toggle' };
// выравнивание содержимого по схеме 3×3 — общее для блоков с текстом (класс .aligned + v-*/h-*, CSS в разделе виджетов)
const ALIGN_SETTING = { key: 'align', label: 'Выравнивание', type: 'align' };
const alignClass = (a) => { const [v, hz] = normAlign(a).split('-'); return `v-${v} h-${hz}`; };

// ---------- ссылки: общий вид для «Ссылок», «Частых сайтов» и «Панели закладок» ----------
// Фирменные цвета популярных сайтов. Остальным — цвет из самой иконки (Brands ниже), а пока он не известен или иконка
// бесцветная — постоянный оттенок из адреса.
const BRAND = {
  'youtube.com': '#ff0033', 'youtu.be': '#ff0033', 'github.com': '#8b949e', 'web.telegram.org': '#2aabee', 'telegram.org': '#2aabee',
  't.me': '#2aabee', 'habr.com': '#77a2b6', 'kinopoisk.ru': '#ff5500', 'claude.ai': '#d97757', 'anthropic.com': '#d97757',
  'vk.com': '#0077ff', 'ya.ru': '#fc3f1d', 'yandex.ru': '#fc3f1d', 'music.yandex.ru': '#ffcc00', 'dzen.ru': '#7f7f7f',
  'mail.ru': '#005ff9', 'google.com': '#4285f4', 'mail.google.com': '#ea4335', 'drive.google.com': '#1fa463',
  'twitch.tv': '#9146ff', 'reddit.com': '#ff4500', 'x.com': '#e7e9ea', 'twitter.com': '#1d9bf0', 'wikipedia.org': '#a2a9b1',
  'spotify.com': '#1db954', 'netflix.com': '#e50914', 'instagram.com': '#e1306c', 'figma.com': '#a259ff', 'notion.so': '#9b9a97',
  'chatgpt.com': '#10a37f', 'openai.com': '#10a37f', 'avito.ru': '#00aaff', 'ozon.ru': '#005bff', 'wildberries.ru': '#cb11ab',
  'linkedin.com': '#0a66c2', 'discord.com': '#5865f2', 'pinterest.com': '#e60023', 'behance.net': '#1769ff', 'dribbble.com': '#ea4c89',
  'stackoverflow.com': '#f48024', 'gitlab.com': '#fc6d26', 'tiktok.com': '#fe2c55', 'whatsapp.com': '#25d366', 'hh.ru': '#d6001c',
  'gosuslugi.ru': '#0d4cd3', 'sber.ru': '#21a038', 'tbank.ru': '#ffdd2d', 'rutube.ru': '#1f2e6a',
};
function brandColor(url) {
  const host = hostOf(url);
  for (const [k, c] of Object.entries(BRAND)) if (host === k || host.endsWith('.' + k)) return c;
  if (Brands.map?.[host]) return Brands.map[host];
  let n = 0;
  for (const ch of host) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${n % 360} 62% 52%)`;
}

// Цвет из самой иконки: favicon.yandex.net отдаёт картинки с CORS, значит их пиксели можно прочитать (Google s2 — нет).
// Берём самый частый насыщенный оттенок; иконка серая/без цвета — '' (тогда оттенок из адреса). Кэш — ключ 'brands'.
const Brands = {
  map: null, // host → '#rrggbb' | ''
  ready: null,
  load() { return this.ready ??= Store.get('brands', {}).then((m) => { this.map = m && typeof m === 'object' ? m : {}; }); },
  save: null,
  async learn(host) {
    await this.load();
    if (host in this.map) return this.map[host];
    this.map[host] = ''; // не спрашиваем дважды за раз
    let color = '';
    try {
      const r = await fetch(`https://favicon.yandex.net/favicon/v2/${encodeURIComponent(host)}?size=32`, { signal: AbortSignal.timeout(6000) });
      if (r.ok) color = dominantColor(await createImageBitmap(await r.blob()));
    } catch { return ''; } // сеть — попробуем в другой раз
    this.map[host] = color;
    clearTimeout(this.save);
    this.save = setTimeout(() => Store.set('brands', this.map), 500);
    return color;
  },
};
Brands.load();
function dominantColor(bmp) {
  const S = 32;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S).data;
  const bins = Array.from({ length: 24 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let opaque = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 140) continue;
    opaque++;
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, ch = mx - mn;
    if (ch < 0.18 || l < 0.12 || l > 0.94) continue; // серое, чёрное, белое — не цвет бренда
    let hue = mx === r ? ((gg - b) / ch) % 6 : mx === gg ? (b - r) / ch + 2 : (r - gg) / ch + 4;
    const bin = bins[Math.floor(((hue * 60 + 360) % 360) / 15)];
    bin.w += ch; bin.r += d[i] * ch; bin.g += d[i + 1] * ch; bin.b += d[i + 2] * ch;
  }
  const best = bins.reduce((a, b) => (b.w > a.w ? b : a));
  // пустая заглушка или почти без цвета — не угадываем
  if (opaque < 20 || best.w < opaque * 0.06) return '';
  const hex = (v) => Math.round(v / best.w).toString(16).padStart(2, '0');
  return '#' + hex(best.r) + hex(best.g) + hex(best.b);
}

const ICON_STYLES = [['glass', 'Стекло'], ['big', 'Крупные'], ['tint', 'Цвет бренда'], ['mono', 'Монохром'], ['letter', 'Буквы']];
const ICONS_SETTING = { key: 'icons', label: 'Иконки', type: 'select', options: ICON_STYLES };
// расстояние между плитками: авто — растягиваются на всю ширину блока, иначе фиксированный шаг по центру
const GAP_SETTING = { key: 'gap', label: 'Расстояние между иконками', type: 'select', options: [['auto', 'Авто'], ['tight', 'Плотно'], ['normal', 'Обычно'], ['wide', 'Свободно']] };

// одна ссылка-плитка; icons — стиль иконки (задаётся классом на обёртке .w-links.icons-*)
function linkEl(l, { newTab = false, icons = 'glass' } = {}) {
  const title = l.title || hostOf(l.url);
  const ico = icons === 'letter'
    ? h('span', { class: 'mono' }, (title.trim()[0] || '?').toUpperCase())
    : favicon(l.url, l.title, icons === 'big' ? 128 : 64);
  const a = h('a', { class: 'link', href: l.url, title, target: newTab ? '_blank' : null, rel: 'noopener', style: `--brand:${brandColor(l.url)}` },
    h('span', { class: 'link-ico' }, ico),
    h('span', { class: 'link-title', translate: 'no' }, title));
  // сайта нет в списке фирменных и цвет ещё не узнавали — узнаём из иконки и перекрашиваем
  const host = hostOf(l.url);
  if (host && !Object.keys(BRAND).some(k => host === k || host.endsWith('.' + k)) && !Brands.map?.[host]) {
    Brands.learn(host).then((c) => { if (c) a.style.setProperty('--brand', c); });
  }
  return a;
}

const Widgets = {
  clock: {
    title: 'Часы',
    size: { w: 10, h: 4 }, min: { w: 3, h: 2 },
    defaults: { glass: false, style: 'digital', format: '24', seconds: false, greeting: true, date: true, align: 'middle-center' },
    settings: [
      { key: 'style', label: 'Вид', type: 'select', options: [['digital', 'Цифровые'], ['analog', 'Стрелочные']] },
      { key: 'format', label: 'Формат', type: 'select', options: [['24', '24 часа'], ['12', '12 часов']] },
      { key: 'seconds', label: 'Секунды', type: 'toggle' },
      { key: 'greeting', label: 'Приветствие', type: 'toggle' },
      { key: 'date', label: 'Дата', type: 'toggle' },
      { key: 'align', label: 'Выравнивание', type: 'align' },
      GLASS_SETTING,
    ],
    render(body, data, ctx) {
      data.align = normAlign(data.align);
      const [v, hz] = data.align.split('-');
      const analog = data.style === 'analog';
      const time = analog ? analogFace(data.seconds) : h('div', { class: 'clock-time' });
      const sub = h('div', { class: 'clock-sub' });
      body.append(h('div', { class: `w-clock v-${v} h-${hz}` + (analog ? ' is-analog' : '') }, time, sub));

      const tick = () => {
        const d = new Date();
        if (analog) time.set(d);
        else {
          let hr = d.getHours();
          const mm = String(d.getMinutes()).padStart(2, '0');
          let suffix = '';
          if (data.format === '12') { suffix = hr >= 12 ? 'PM' : 'AM'; hr = hr % 12 || 12; }
          const hh = data.format === '12' ? String(hr) : String(hr).padStart(2, '0');
          time.innerHTML = `${hh}<span class="colon">:</span>${mm}` +
            (data.seconds ? `<span class="sec">${String(d.getSeconds()).padStart(2, '0')}</span>` : '') +
            (suffix ? `<span class="ampm">${suffix}</span>` : '');
        }
        const parts = [];
        if (data.greeting) {
          parts.push(`<span class="greet" translate="no">${escapeHtml(pickGreeting(ctx.settings(), d))}</span>`);
        }
        if (data.date) {
          parts.push(`<span>${d.toLocaleDateString(I18N.locale(), { weekday: 'long', day: 'numeric', month: 'long' })}</span>`);
        }
        sub.innerHTML = parts.join('<i class="dot"></i>');
        sub.hidden = !parts.length;
      };
      tick();
      const t = setInterval(tick, 1000);
      return { destroy: () => clearInterval(t) };
    },
  },

  search: {
    title: 'Поиск',
    size: { w: 10, h: 1 }, min: { w: 4, h: 1 },
    defaults: { glass: true, engine: 'browser', height: 'normal', newTab: false, recent: true, showEngine: true, showGhost: true, history: [] },
    settings: [
      { key: 'engine', label: 'Поисковик', type: 'select', options: Object.entries(ENGINES).map(([k, v]) => [k, v.name]) },
      { key: 'height', label: 'Высота строки', type: 'select', options: [['compact', 'Тонкая'], ['normal', 'Обычная'], ['large', 'Крупная']] },
      { key: 'newTab', label: 'Открывать в новой вкладке', type: 'toggle' },
      { key: 'recent', label: 'Помнить последние запросы', type: 'toggle' },
      { key: 'showEngine', label: 'Кнопка выбора поисковика', type: 'toggle' },
      { key: 'showGhost', label: 'Кнопка инкогнито', type: 'toggle' },
      GLASS_SETTING,
    ],
    render(body, data, ctx) {
      const eng = () => ENGINES[data.engine] || ENGINES.browser;
      const placeholder = () => eng() === ENGINES.browser ? 'Поиск' : `Искать в ${eng().in || eng().name}`;
      const engineBtn = h('button', { type: 'button', class: 'engine', title: 'Выбрать поисковик' });
      const input = h('input', { type: 'text', class: 'search-input', autocomplete: 'off', spellcheck: 'false', 'data-search': '' });
      const result = h('button', { type: 'button', class: 'search-calc', title: 'Скопировать', hidden: true });
      // клавиша Enter — минималистично: только стрелка ↵, подсвечивается, когда есть что искать
      const go = h('button', {
        type: 'submit', class: 'search-go', tabindex: '-1',
        title: 'Enter — искать здесь\nCtrl+Enter — в новой вкладке\nShift+Enter — в окне инкогнито',
        html: '<svg viewBox="0 0 24 24"><path d="M19 5v7a3 3 0 0 1-3 3H5"/><path d="M9 11l-4 4 4 4"/></svg>',
      });
      // призрак — поиск в инкогнито
      const ghostBtn = h('button', {
        type: 'button', class: 'search-ghost', tabindex: '-1', title: 'Искать в окне инкогнито (или Shift+Enter)',
        html: '<svg viewBox="0 0 24 24"><path d="M5 20V11a7 7 0 0 1 14 0v9l-2.3-1.6L14.3 20 12 18.4 9.7 20l-2.4-1.6z"/><circle cx="9.5" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="11" r="1.1" fill="currentColor" stroke="none"/></svg>',
      });
      if (data.showEngine === false) engineBtn.hidden = true;
      if (data.showGhost === false) ghostBtn.hidden = true;
      // при наведении на строку вокруг иконки поисковика один раз пробегает обводка — видно, что это кнопка выбора
      engineBtn.innerHTML = '<span class="eng-ico"></span>';
      const engIco = engineBtn.firstChild;
      const form = h('form', { class: `w-search h-${data.height}` }, engineBtn, input, result, ghostBtn, go);
      if (!data.recent && data.history?.length) { data.history = []; ctx.save(); }

      const paint = () => {
        engIco.innerHTML = engineIcon(eng());
        input.placeholder = placeholder();
      };
      paint();

      // «!yt котики» или «котики !yt» — разовый поиск в другом поисковике
      const parse = (q) => {
        let bang = null, text = q;
        const a = q.match(/^!(\S+)\s+(.+)$/), b = q.match(/^(.+?)\s+!(\S+)$/);
        if (a) { bang = a[1]; text = a[2]; } else if (b) { bang = b[2]; text = b[1]; }
        const e = bang && Object.values(ENGINES).find(x => x.bang === bang.toLowerCase());
        return e ? { e, text } : { e: eng(), text: q };
      };

      // куда открывать: модификаторы важнее настройки
      const open = (url, how) => {
        if (how === 'incognito' && chrome.windows?.create) {
          // браузер не дал открыть приватное окно (в Firefox — пока расширению не разрешили приватные окна) —
          // объясняем, где включить, и предлагаем открыть в обычной вкладке
          chrome.windows.create({ url, incognito: true }, () => { if (chrome.runtime.lastError) incognitoHelp(url); });
          return;
        }
        if (how === 'tab') { if (chrome.tabs?.create) chrome.tabs.create({ url }); else window.open(url, '_blank', 'noopener'); return; }
        location.href = url;
      };
      // поиск поисковиком браузера: через chrome.search.query, адрес поиска знает только браузер.
      // Инкогнито — пустое приватное окно, и уже в его вкладке поиск (нужно разрешение на приватные окна)
      const openSearch = (text, how) => {
        if (!chrome.search?.query) return open(ENGINES.google.url + encodeURIComponent(text), how); // страница открыта не как расширение
        if (how === 'incognito') {
          chrome.windows.create({ incognito: true }, (win) => {
            const tab = !chrome.runtime.lastError && win?.tabs?.[0];
            if (!tab) return incognitoHelp(() => chrome.search.query({ text, disposition: 'NEW_TAB' }));
            chrome.search.query({ text, tabId: tab.id }, () => void chrome.runtime.lastError);
          });
          return;
        }
        chrome.search.query({ text, disposition: how === 'tab' ? 'NEW_TAB' : 'CURRENT_TAB' });
      };
      let ghost = false; // режим «следующий поиск — в инкогнито» (кнопка-призрак), не сохраняется
      const how = (e) => (e.shiftKey || ghost) ? 'incognito' : (e.ctrlKey || e.metaKey || data.newTab) ? 'tab' : 'here';
      const search = (q, mode) => {
        q = q.trim();
        if (!q) return;
        const asUrl = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(q) && !q.includes(' ');
        const { e, text } = parse(q);
        const target = asUrl ? normalizeUrl(q) : e.url ? e.url + encodeURIComponent(text) : null;
        const run = () => target ? open(target, mode) : openSearch(text, mode);
        closeRecent();
        if (data.recent && mode !== 'incognito') { // инкогнито-запросы не запоминаем
          data.history = [q, ...(data.history || []).filter(x => x !== q)].slice(0, 6);
          // уходим со страницы только после записи — иначе отложенное сохранение не успеет
          if (mode === 'here') { ctx.saveNow().finally(run); return; }
          ctx.save();
        }
        run();
        if (mode !== 'here') { input.value = ''; onInput(); }
      };

      // режим подсвечивается на кнопках: Shift или включённый призрак — инкогнито
      const showMode = (e) => {
        const m = how(e);
        form.dataset.mode = m;
        ghostBtn.classList.toggle('on', m === 'incognito');
      };
      input.addEventListener('keydown', (e) => {
        showMode(e);
        if (e.key === 'Enter') { e.preventDefault(); search(input.value, how(e)); }
        if (e.key === 'Escape' && recentBox) { e.stopPropagation(); closeRecent(); }
      });
      input.addEventListener('keyup', showMode);
      input.addEventListener('blur', () => { delete form.dataset.mode; ghostBtn.classList.toggle('on', ghost); });
      form.addEventListener('submit', (e) => { e.preventDefault(); search(input.value, ghost ? 'incognito' : data.newTab ? 'tab' : 'here'); });
      // призрак: есть текст — сразу ищет в инкогнито; пусто — включает режим «следующий поиск в инкогнито»
      ghostBtn.addEventListener('click', () => {
        if (input.value.trim()) return search(input.value, 'incognito');
        ghost = !ghost;
        ghostBtn.classList.toggle('on', ghost);
        form.classList.toggle('ghost', ghost);
        input.placeholder = ghost ? 'Инкогнито — следующий поиск' : placeholder();
        input.focus();
      });

      // калькулятор: ответ справа, клик — скопировать
      const onInput = () => {
        const q = input.value.trim();
        form.classList.toggle('has-text', !!q);
        const v = calc(q);
        result.hidden = v == null;
        if (v != null) result.textContent = '= ' + (+v.toFixed(10)).toLocaleString(I18N.locale(), { maximumFractionDigits: 10 });
        // префикс подсвечивает иконку поисковика, в котором будет поиск
        const { e } = parse(q);
        engIco.innerHTML = engineIcon(e);
        engineBtn.classList.toggle('bang', e !== eng());
        if (q) closeRecent(); else openRecent();
      };
      input.addEventListener('input', onInput);
      result.addEventListener('click', () => {
        navigator.clipboard?.writeText(result.textContent.slice(2).replace(/\s/g, '')).then(() => ctx.toast('Скопировано'));
        input.focus();
      });

      // последние запросы — под строкой, пока поле пустое
      let recentBox = null;
      function closeRecent() { recentBox?.remove(); recentBox = null; }
      function openRecent() {
        closeRecent();
        if (!data.recent || !data.history?.length || document.activeElement !== input) return;
        const r = form.getBoundingClientRect();
        // «полка» чуть уже строки: стекло как у неё, запросы — чипсами
        recentBox = h('div', { class: 'search-recent', style: `left:${r.left + 10}px;top:${r.bottom + 8}px;width:${r.width - 20}px` },
          h('div', { class: 'sr-label' }, 'Недавние'),
          data.history.map(q => h('div', { class: 'sr-row' },
            h('button', { type: 'button', class: 'sr-q', onmousedown: (e) => { e.preventDefault(); search(q, how(e)); } },
              h('span', { class: 'sr-ico', html: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4M12 8v4l3 2"/></svg>' }), h('span', { class: 'sr-text', translate: 'no' }, q)),
            h('button', {
              type: 'button', class: 'sr-del', title: 'Убрать из истории', html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
              onmousedown: (e) => { e.preventDefault(); data.history = data.history.filter(x => x !== q); ctx.save(); openRecent(); },
            }))));
        document.body.append(recentBox);
        flipUp(recentBox, form, 8);
        const box = recentBox;
        requestAnimationFrame(() => box.classList.add('on'));
      }
      input.addEventListener('focus', () => { if (!input.value.trim()) openRecent(); });
      input.addEventListener('blur', () => setTimeout(closeRecent, 120));

      // выбор поисковика — список с иконками и префиксами
      engineBtn.addEventListener('click', () => {
        if (document.querySelector('.engine-menu')) return document.querySelector('.engine-menu').remove();
        const r = engineBtn.getBoundingClientRect();
        const menu = h('div', { class: 'engine-menu', style: `left:${r.left}px;top:${r.bottom + 8}px` },
          Object.entries(ENGINES).map(([k, e]) => h('button', {
            type: 'button', class: 'em-item' + (k === data.engine ? ' active' : ''),
            onclick: () => { data.engine = k; ctx.save(); paint(); onInput(); menu.remove(); input.focus(); },
          }, h('span', { class: 'em-ico', html: engineIcon(e) }), h('span', { class: 'em-name' }, e.name), ...(e.bang ? [h('kbd', {}, '!' + e.bang)] : []))),
          h('div', { class: 'em-hint' }, 'Префикс — разовый поиск: «!yt котики»'));
        document.body.append(menu);
        flipUp(menu, engineBtn);
        const off = (e) => { if (!menu.contains(e.target) && !engineBtn.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', off, true); } };
        document.addEventListener('mousedown', off, true);
      });

      body.append(form);
      return { destroy: () => { closeRecent(); document.querySelector('.engine-menu')?.remove(); } };
    },
  },

  links: {
    title: 'Ссылки',
    size: { w: 10, h: 2 }, min: { w: 2, h: 1 },
    defaults: {
      glass: true, style: 'tiles', icons: 'glass', newTab: false,
      links: [
        { title: 'YouTube', url: 'https://youtube.com' },
        { title: 'GitHub', url: 'https://github.com' },
        { title: 'Telegram', url: 'https://web.telegram.org' },
        { title: 'Хабр', url: 'https://habr.com' },
        { title: 'Кинопоиск', url: 'https://kinopoisk.ru' },
        { title: 'Claude', url: 'https://claude.ai' },
      ],
    },
    settings: [
      { key: 'style', label: 'Вид', type: 'select', options: [['tiles', 'Плитки'], ['list', 'Список'], ['icons', 'Только иконки']] },
      ICONS_SETTING,
      GAP_SETTING,
      { key: 'newTab', label: 'Открывать в новой вкладке', type: 'toggle' },
      GLASS_SETTING,
      { key: 'links', label: 'Ссылки', type: 'links' },
    ],
    render(body, data, ctx) {
      const wrap = h('div', { class: `w-links style-${data.style} icons-${data.icons || 'glass'} gap-${data.gap || 'auto'}` });
      for (const l of data.links) wrap.append(linkEl(l, { newTab: data.newTab, icons: data.icons }));
      // «+» в углу при наведении — не занимает места в сетке плиток (иначе ломал центровку в низком блоке)
      const add = h('button', {
        class: 'w-add', type: 'button', title: 'Добавить ссылку', html: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
        onclick: () => ctx.modal({
          title: 'Новая ссылка',
          fields: [
            { key: 'url', label: 'Адрес', type: 'text', placeholder: 'example.com', required: true },
            { key: 'title', label: 'Название', type: 'text', placeholder: 'необязательно' },
          ],
          submit: 'Добавить',
          onSubmit: (v) => {
            data.links.push({ title: v.title.trim(), url: normalizeUrl(v.url) });
            ctx.save(); ctx.rerender();
          },
        }),
      });
      body.append(wrap, add);
    },
  },

  notes: {
    title: 'Заметки',
    size: { w: 5, h: 5 }, min: { w: 3, h: 2 },
    defaults: { glass: true, title: 'Заметки', text: '' },
    settings: [
      { key: 'title', label: 'Заголовок', type: 'text' },
      GLASS_SETTING,
    ],
    render(body, data, ctx) {
      const ta = h('textarea', { class: 'notes-text', placeholder: 'Пиши сюда, всё сохранится само…', spellcheck: 'false' });
      ta.value = data.text || '';
      let t;
      ta.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => { data.text = ta.value; ctx.save(); }, 350);
      });
      body.append(h('div', { class: 'w-notes' },
        data.title ? h('div', { class: 'w-label' }, data.title) : null,
        ta,
      ));
      return { destroy: () => { clearTimeout(t); data.text = ta.value; } };
    },
  },

  // отдельное приветствие: те же фразы, что и в часах (свои — в настройках, вкладка «Вкладка»), крупно и своим шрифтом
  greeting: {
    title: 'Приветствие',
    size: { w: 12, h: 2 }, min: { w: 3, h: 1 },
    defaults: { glass: false, font: 'playfair', weight: 'regular', sub: 'none', align: 'middle-center' },
    settings: [
      { key: 'weight', label: 'Толщина', type: 'select', options: [['light', 'Тонкий'], ['regular', 'Обычный'], ['bold', 'Жирный']] },
      { key: 'sub', label: 'Подпись', type: 'select', options: [['none', 'Нет'], ['date', 'Дата'], ['time', 'Время']] },
      { key: 'align', label: 'Выравнивание', type: 'align' },
      GLASS_SETTING,
    ],
    render(body, data, ctx) {
      data.align = normAlign(data.align);
      const [v, hz] = data.align.split('-');
      const text = h('div', { class: 'greet-text', translate: 'no' });
      const sub = h('div', { class: 'greet-sub' });
      const box = h('div', { class: `w-greeting v-${v} h-${hz} wt-${data.weight}` }, text, sub);
      body.append(box);
      // подбираем размер: крупно, но в одну-две строки и без обрезки
      const fit = () => {
        const H = body.clientHeight, W = body.clientWidth;
        if (!H || !W) return;
        let fs = Math.min(H * (data.sub === 'none' ? 0.5 : 0.4), 120);
        text.style.fontSize = fs + 'px';
        for (let i = 0; i < 30 && (text.scrollWidth > text.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1); i++) {
          fs *= 0.92;
          text.style.fontSize = fs + 'px';
        }
      };
      const tick = () => {
        const d = new Date();
        const t = pickGreeting(ctx.settings(), d);
        if (text.textContent !== t) { text.textContent = t; fit(); }
        sub.hidden = data.sub === 'none';
        sub.textContent = data.sub === 'date' ? d.toLocaleDateString(I18N.locale(), { weekday: 'long', day: 'numeric', month: 'long' })
          : data.sub === 'time' ? d.toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' }) : '';
      };
      tick();
      const ro = new ResizeObserver(fit);
      ro.observe(body);
      document.fonts?.addEventListener('loadingdone', fit); // свой шрифт догрузился — шире или уже, чем запасной
      const t = setInterval(tick, 15000);
      return { fit, destroy: () => { clearInterval(t); ro.disconnect(); document.fonts?.removeEventListener('loadingdone', fit); } };
    },
  },

  weather: {
    title: 'Погода',
    size: { w: 6, h: 2 }, min: { w: 3, h: 1 },
    defaults: { glass: true, city: 'Москва', view: 'now', side: 'left' },
    // иконка и градусы влезают и в 2×1; «Подробно» и «По часам» без высоты теряют смысл
    minFor: (d) => d.view === 'mini' ? { w: 2, h: 1 } : ['details', 'hours'].includes(d.view) ? { w: 4, h: 2 } : null,
    settings: [
      { key: 'city', label: 'Город', type: 'text' },
      { key: 'view', label: 'Вид', type: 'select', options: [['now', 'Сейчас'], ['mini', 'Мини'], ['details', 'Подробно'], ['hours', 'По часам'], ['week', 'Неделя']] },
      { key: 'side', label: 'Выравнивание', type: 'select', options: [['left', 'Слева'], ['center', 'По центру'], ['right', 'Справа']] },
      GLASS_SETTING,
    ],
    render(body, data, ctx) {
      // mini — только иконка и градусы; side — куда прижать содержимое
      const box = h('div', { class: `w-weather is-loading side-${data.side || 'left'}` + (data.view === 'mini' ? ' is-mini' : '') }, h('div', { class: 'w-muted' }, 'Смотрю в окно…'));
      body.append(box);
      let alive = true;
      let retryT = null;
      let attempt = 0;

      // неделя: колонка на день — день недели, иконка, макс/мин
      const paintWeek = (w, stale) => {
        const wd = (iso, i) => i === 0 ? 'Сегодня' : new Date(iso + 'T12:00').toLocaleDateString(I18N.locale(), { weekday: 'short' });
        box.classList.remove('is-loading', 'is-error');
        box.classList.toggle('is-stale', stale);
        box.classList.add('is-week');
        box.replaceChildren(...w.days.map((d, i) => h('div', { class: 'wx-day' + (i === 0 ? ' today' : '') },
          h('div', { class: 'wx-dname' }, wd(d.date, i)),
          h('div', { class: 'wx-dico', html: ICONS[weatherInfo(d.code)[1]], title: weatherInfo(d.code)[0] }),
          h('div', { class: 'wx-dt' }, `${Math.round(d.max)}°`, h('span', {}, `${Math.round(d.min)}°`)),
        )));
      };

      // по часам: «Сейчас» и дальше каждые 2 часа — время, иконка, градусы, вероятность осадков (если заметная)
      const paintHours = (w, stale) => {
        const hm = (iso) => new Date(iso).toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' });
        box.classList.remove('is-loading', 'is-error');
        box.classList.toggle('is-stale', stale);
        box.classList.add('is-week', 'is-hours');
        box.replaceChildren(...w.hours.filter((_, i) => i % 2 === 0).slice(0, 8).map((x, i) => h('div', { class: 'wx-day' + (i === 0 ? ' today' : '') },
          h('div', { class: 'wx-dname' }, i === 0 ? 'Сейчас' : hm(x.time)),
          h('div', { class: 'wx-dico', html: ICONS[weatherInfo(x.code)[1]], title: weatherInfo(x.code)[0] }),
          h('div', { class: 'wx-dt' }, `${Math.round(x.temp)}°`),
          h('div', { class: 'wx-pop' }, x.pop >= 20 ? `${x.pop}%` : ''),
        )));
      };

      // подробно: сверху как «Сейчас», снизу строка показателей
      const paintDetails = (w, stale) => {
        const [desc, ico] = weatherInfo(w.code);
        const num = (v, unit) => (Number.isFinite(v) ? Math.round(v) + unit : '—');
        const hm = (iso) => (iso ? new Date(iso).toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' }) : '—');
        // до заката — показываем закат, после — восход
        const sun = w.sunset && Date.now() < new Date(w.sunset) ? ['Закат', hm(w.sunset)] : ['Восход', hm(w.sunrise)];
        box.classList.remove('is-loading', 'is-error', 'is-week');
        box.classList.toggle('is-stale', stale);
        box.classList.add('is-details');
        box.replaceChildren(
          h('div', { class: 'wx-top' },
            h('div', { class: 'wx-ico', html: ICONS[ico] }),
            h('div', { class: 'wx-temp' }, `${Math.round(w.temp)}°`),
            h('div', { class: 'wx-meta' },
              h('div', { class: 'wx-desc' }, desc),
              h('div', { class: 'w-muted' }, stale ? `${w.place} · нет сети` : `${w.place} · ${Math.round(w.max)}° / ${Math.round(w.min)}°`))),
          h('div', { class: 'wx-stats' }, ...[
            ['Ощущается', num(w.feels, '°')], ['Влажность', num(w.humidity, '%')],
            ['Ветер', num(w.wind, ' м/с')], ['Осадки', num(w.rain, '%')], sun,
          ].map(([k, v]) => h('div', { class: 'wx-stat' }, h('b', {}, v), h('span', {}, k)))),
        );
      };

      const paint = (w, stale) => {
        if (data.view === 'week' && w.days?.length > 1) return paintWeek(w, stale);
        if (data.view === 'hours' && w.hours?.length > 1) return paintHours(w, stale);
        if (data.view === 'details') return paintDetails(w, stale);
        const [desc, ico] = weatherInfo(w.code);
        box.classList.remove('is-loading', 'is-error', 'is-week');
        box.classList.toggle('is-stale', stale);
        box.title = data.view === 'mini' ? `${desc} · ${w.place}` : '';
        box.replaceChildren(
          h('div', { class: 'wx-ico', html: ICONS[ico] }),
          h('div', { class: 'wx-main' },
            h('div', { class: 'wx-temp' }, `${Math.round(w.temp)}°`),
            data.view === 'mini' ? '' : h('div', { class: 'wx-meta' },
              h('div', { class: 'wx-desc' }, desc),
              h('div', { class: 'w-muted' }, stale ? `${w.place} · нет сети` : `${w.place} · ${Math.round(w.max)}° / ${Math.round(w.min)}°`),
            ),
          ),
        );
      };
      // старая погода из памяти (3 ч – сутки): приглушена, в углу «5 ч назад» и спиннер, пока не придёт свежая
      let ago = null;
      const showAgo = (at, loading) => {
        const hrs = Math.max(1, Math.floor((Date.now() - at) / 3600000));
        ago = h('div', { class: 'wx-ago' }, ...(loading ? [h('span', { class: 'spinner' })] : []), h('span', {}, loading ? `${hrs} ч назад` : `${hrs} ч назад · нет сети`));
        box.classList.add('is-old');
        box.append(ago);
      };
      const clearAgo = () => { ago?.remove(); ago = null; box.classList.remove('is-old'); };
      const fail = (text) => {
        clearAgo();
        box.classList.remove('is-loading');
        box.classList.add('is-error');
        box.replaceChildren(h('div', { class: 'wx-ico', html: ICONS.cloud }), h('div', { class: 'w-muted' }, text));
      };
      // 15с, 30с, 1м, 2м … но не реже раза в 10 минут
      const retryLater = () => {
        clearTimeout(retryT);
        retryT = setTimeout(load, Math.min(15000 * 2 ** attempt++, 600000));
      };
      function load() {
        clearTimeout(retryT);
        loadWeather(data.city).then(({ w, stale, at }) => {
          if (!alive) return;
          const old = stale && Date.now() - at >= WX_MEMORY;
          clearAgo();
          paint(w, stale && !old);
          if (old) showAgo(at, false);
          if (stale) retryLater(); else attempt = 0;
        }).catch((e) => {
          if (!alive) return;
          if (e.code === 'notfound') return fail(`Не знаю город «${data.city}»`);
          console.info('[weather] нет сети, повторю позже:', e.message);
          fail('Нет связи с погодой');
          retryLater();
        });
      }
      const onOnline = () => { attempt = 0; load(); };
      window.addEventListener('online', onOnline);
      // сначала — что есть в памяти, без «Смотрю в окно…»; потом load() решит, нужен ли запрос
      weatherCache(data.city).then((c) => {
        if (!alive) return;
        const age = c ? Date.now() - c.at : Infinity;
        if (age < 24 * 3600 * 1000) { paint(c.w, false); if (age >= WX_MEMORY) showAgo(c.at, true); }
        load();
      });
      return { destroy: () => { alive = false; clearTimeout(retryT); window.removeEventListener('online', onOnline); } };
    },
  },
};

// погода, которую смотрели не раньше чем 3 часа назад, показывается из памяти как обычная;
// старше (до суток) — приглушённой с пометкой «N ч назад», пока не придёт свежая
const WX_MEMORY = 3 * 3600 * 1000;
const wxKey = (city) => 'wx3:' + city.toLowerCase(); // wx3 — с прогнозом на неделю, по часам и подробностями
const weatherCache = (city) => Store.get(wxKey(city), null);

// → { w, stale, at }. Свежее 30 минут — из кэша без запроса. Без сети отдаёт старый кэш (не старше суток) со stale: true.
// Ошибка с code 'notfound' — город не найден, повторять бессмысленно; остальные — сеть.
async function loadWeather(city) {
  const key = wxKey(city);
  const cached = await weatherCache(city);
  if (cached && Date.now() - cached.at < 30 * 60 * 1000) return { w: cached.w, stale: false, at: cached.at };

  const get = (u) => fetch(u, { signal: AbortSignal.timeout(8000) }).then((r) => {
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  });
  try {
    const geo = await get(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=ru&name=${encodeURIComponent(city)}`);
    const p = geo.results && geo.results[0];
    if (!p) throw Object.assign(new Error('city not found'), { code: 'notfound' });
    const f = await get(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}` +
      '&current=temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m' +
      '&hourly=temperature_2m,weather_code,precipitation_probability&forecast_hours=24' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max' +
      '&wind_speed_unit=ms&timezone=auto&forecast_days=7');
    const dl = f.daily, cur = f.current, hr = f.hourly || {};
    const w = {
      place: p.name,
      temp: cur.temperature_2m,
      code: cur.weather_code,
      max: dl.temperature_2m_max[0],
      min: dl.temperature_2m_min[0],
      // подробности — для вида «Подробно» (могут отсутствовать: старый ответ, сбой — тогда прочерк)
      feels: cur.apparent_temperature, humidity: cur.relative_humidity_2m, wind: cur.wind_speed_10m,
      rain: dl.precipitation_probability_max?.[0], sunrise: dl.sunrise?.[0], sunset: dl.sunset?.[0],
      days: (dl.time || []).map((date, i) => ({ date, code: dl.weather_code?.[i] ?? 0, max: dl.temperature_2m_max[i], min: dl.temperature_2m_min[i] })),
      // ближайшие часы — для вида «По часам»
      hours: (hr.time || []).map((time, i) => ({ time, code: hr.weather_code?.[i] ?? 0, temp: hr.temperature_2m?.[i], pop: hr.precipitation_probability?.[i] })),
    };
    const at = Date.now();
    Store.set(key, { at, w });
    return { w, stale: false, at };
  } catch (e) {
    if (e.code !== 'notfound' && cached && Date.now() - cached.at < 24 * 3600 * 1000) return { w: cached.w, stale: true, at: cached.at };
    throw e;
  }
}

// выравнивание по схеме 3×3: 'top|middle|bottom' + '-' + 'left|center|right'; старые 'left'/'center'/'right' → средний ряд
function normAlign(a) {
  if (/^(top|middle|bottom)-(left|center|right)$/.test(a)) return a;
  return 'middle-' + (['left', 'right'].includes(a) ? a : 'center');
}

// циферблат: SVG + set(date)
function analogFace(withSeconds) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'clock-face');
  let marks = '';
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    marks += `<line class="${big ? 'mk-h' : 'mk-m'}" x1="50" y1="${big ? 5.5 : 5}" x2="50" y2="${big ? 11 : 7.2}" transform="rotate(${i * 6} 50 50)"/>`;
  }
  svg.innerHTML = `<circle class="face" cx="50" cy="50" r="48"/>${marks}` +
    '<line class="hand hand-h" x1="50" y1="54" x2="50" y2="27"/>' +
    '<line class="hand hand-m" x1="50" y1="56" x2="50" y2="14"/>' +
    (withSeconds ? '<line class="hand hand-s" x1="50" y1="60" x2="50" y2="9"/>' : '') +
    '<circle class="pin" cx="50" cy="50" r="2.2"/>';
  const [hh, mm, ss] = ['.hand-h', '.hand-m', '.hand-s'].map(s => svg.querySelector(s));
  svg.set = (d) => {
    const s = d.getSeconds(), m = d.getMinutes() + s / 60, hr = (d.getHours() % 12) + m / 60;
    hh.setAttribute('transform', `rotate(${hr * 30} 50 50)`);
    mm.setAttribute('transform', `rotate(${m * 6} 50 50)`);
    ss?.setAttribute('transform', `rotate(${s * 6} 50 50)`);
  };
  return svg;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Приветствие: свои фразы (settings.greetings, до 5) с временем суток или на любое время.
// Есть подходящие по времени — случайная из них, иначе случайная «на любое время», иначе стандартное.
// Выбор запоминается до смены времени суток — иначе фраза менялась бы каждую секунду.
const DAY_PARTS = [['any', 'Любое время'], ['morning', 'Утро'], ['day', 'День'], ['evening', 'Вечер'], ['night', 'Ночь']];
const dayPart = (hr) => hr < 5 ? 'night' : hr < 12 ? 'morning' : hr < 18 ? 'day' : hr < 23 ? 'evening' : 'night';
const DEFAULT_GREET = { night: 'Доброй ночи', morning: 'Доброе утро', day: 'Добрый день', evening: 'Добрый вечер' };
let greetPick = null; // { key, text }
function pickGreeting(s, d = new Date()) {
  const part = dayPart(d.getHours());
  const list = (s.greetings || []).filter(g => g.text.trim());
  const key = part + '|' + JSON.stringify(list) + '|' + s.name;
  if (greetPick?.key === key) return greetPick.text;
  const byTime = list.filter(g => g.when === part), any = list.filter(g => g.when === 'any');
  const pool = byTime.length ? byTime : any;
  const name = s.name || '';
  let text;
  if (pool.length) {
    text = pool[Math.floor(Math.random() * pool.length)].text;
    // {имя} — подставить имя; без имени — убрать вместе с запятой перед ним
    text = name ? text.replace(/\{имя\}/gi, name) : text.replace(/,?\s*\{имя\}/gi, '');
  } else {
    text = I18N.t(DEFAULT_GREET[part]) + (name ? ', ' + name : '');
  }
  greetPick = { key, text: text.trim() };
  return greetPick.text;
}

// Карточка «разреши приватные окна»: включить это за пользователя расширение не может — только подвести к переключателю.
// Chromium (Chrome, Edge, Яндекс…) — кнопка открывает страницу настроек Torii; Firefox свои служебные страницы
// расширениям открывать не даёт — там подсказываем путь словами. url — что искали (или функция, которая откроет): можно открыть в обычной вкладке.
const IS_FIREFOX = /Firefox\//.test(navigator.userAgent);
function incognitoHelp(url) {
  document.querySelector('.incog-help')?.remove();
  const close = () => { card.classList.remove('on'); setTimeout(() => card.remove(), 250); };
  const card = h('div', { class: 'incog-help', role: 'dialog' },
    h('span', { class: 'ih-ico', html: '<svg viewBox="0 0 24 24"><path d="M5 20V11a7 7 0 0 1 14 0v9l-2.5-2-2.3 2-2.2-2-2.2 2-2.3-2z"/><circle cx="9.5" cy="11" r="1" fill="currentColor"/><circle cx="14.5" cy="11" r="1" fill="currentColor"/></svg>' }),
    h('div', { class: 'ih-text' },
      h('b', {}, 'Разреши Torii приватные окна'),
      IS_FIREFOX
        ? h('span', {}, 'Дополнения → Torii → «Запуск в приватных окнах» → Разрешить. Потом нажми поиск ещё раз.')
        : h('span', {}, 'Открою настройки расширения — там включи «Разрешить в режиме инкогнито». Потом нажми поиск ещё раз.')),
    h('div', { class: 'ih-actions' },
      IS_FIREFOX ? null : h('button', { type: 'button', class: 'pill small pill-accent', onclick: () => { chrome.tabs?.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` }); close(); } }, 'Открыть настройки'),
      url ? h('button', { type: 'button', class: 'pill small', onclick: () => { typeof url === 'function' ? url() : chrome.tabs?.create ? chrome.tabs.create({ url }) : window.open(url, '_blank', 'noopener'); close(); } }, 'Открыть в обычной вкладке') : null,
      h('button', { type: 'button', class: 'icon-btn ih-close', title: 'Закрыть', onclick: close }, '✕')));
  document.body.append(card);
  requestAnimationFrame(() => card.classList.add('on'));
}

// поповер под кнопкой не влезает вниз (блок внизу экрана) — открываем над ней
function flipUp(pop, anchor, gap = 6) {
  const a = anchor.getBoundingClientRect();
  if (a.bottom + gap + pop.offsetHeight > innerHeight - 8 && a.top - gap - pop.offsetHeight > 8) {
    pop.style.top = (a.top - gap - pop.offsetHeight) + 'px';
    pop.classList.add('up');
  }
}
