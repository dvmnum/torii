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

// Поисковики: монохромные иконки в одном стиле (контур, currentColor), bang — префикс «!x запрос»
const ENGINES = {
  yandex: { name: 'Яндекс', in: 'Яндексе', bang: 'y', url: 'https://yandex.ru/search/?text=',
    icon: '<path d="M15.5 20V4h-3.6a4.2 4.2 0 0 0 0 8.4h3.6M12 12.4L7.6 20"/>' },
  google: { name: 'Google', bang: 'g', url: 'https://www.google.com/search?q=',
    icon: '<path d="M18.1 6.9A8 8 0 1 0 20 12h-7.5"/>' },
  duck: { name: 'DuckDuckGo', bang: 'd', url: 'https://duckduckgo.com/?q=',
    icon: '<circle cx="12" cy="12" r="8.5"/><circle cx="13.6" cy="9.6" r="1.2" fill="currentColor" stroke="none"/><path d="M8.6 14.6c1.8 1.6 5.2 1.6 7-.4"/>' },
  bing: { name: 'Bing', bang: 'b', url: 'https://www.bing.com/search?q=',
    icon: '<path d="M7 3.5l3.6 1.3v11.4l5.1-2.9-2.3-1.1-1.3-3.4 5.9 2.1v3.4l-7.4 4.3L7 18.4z"/>' },
  perplexity: { name: 'Perplexity', bang: 'p', url: 'https://www.perplexity.ai/search?q=',
    icon: '<path d="M12 3v18M5 7.5l7 4.5 7-4.5M5 16.5l7-4.5 7 4.5M5 7.5v9M19 7.5v9"/>' },
  chatgpt: { name: 'ChatGPT', bang: 'gpt', url: 'https://chatgpt.com/?q=',
    icon: '<path d="M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5z"/><path d="M12 8.2v7.6M8.7 10.1l6.6 3.8M15.3 10.1l-6.6 3.8"/>' },
  claude: { name: 'Claude', bang: 'c', url: 'https://claude.ai/new?q=',
    icon: '<path d="M12 3.5v5.5M12 15v5.5M3.5 12H9M15 12h5.5M6 6l3.9 3.9M14.1 14.1L18 18M18 6l-3.9 3.9M9.9 14.1L6 18"/>' },
  youtube: { name: 'YouTube', in: 'YouTube', bang: 'yt', url: 'https://www.youtube.com/results?search_query=',
    icon: '<rect x="2.8" y="5.5" width="18.4" height="13" rx="4"/><path d="M10.2 9.3v5.4l4.6-2.7z" fill="currentColor" stroke="none"/>' },
  wiki: { name: 'Википедия', in: 'Википедии', bang: 'w', url: 'https://ru.wikipedia.org/w/index.php?search=',
    icon: '<path d="M3 6.5l3.8 11.5L12 7.5l5.2 10.5L21 6.5"/>' },
};
const engineIcon = (e) => `<svg viewBox="0 0 24 24">${e.icon}</svg>`;

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

// ---------- ссылки: общий вид для «Ссылок», «Частых сайтов» и «Панели закладок» ----------
// Фирменные цвета популярных сайтов. Остальным — постоянный оттенок из адреса (цвет из самой иконки
// не достать: расширению нельзя читать пиксели чужих картинок без лишних разрешений).
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
  let n = 0;
  for (const ch of host) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${n % 360} 62% 52%)`;
}

const ICON_STYLES = [['glass', 'Стекло'], ['big', 'Крупные'], ['tint', 'Цвет бренда'], ['mono', 'Монохром'], ['letter', 'Буквы']];
const ICONS_SETTING = { key: 'icons', label: 'Иконки', type: 'select', options: ICON_STYLES };

// одна ссылка-плитка; icons — стиль иконки (задаётся классом на обёртке .w-links.icons-*)
function linkEl(l, { newTab = false, icons = 'glass' } = {}) {
  const title = l.title || hostOf(l.url);
  const ico = icons === 'letter'
    ? h('span', { class: 'mono' }, (title.trim()[0] || '?').toUpperCase())
    : favicon(l.url, l.title, icons === 'big' ? 128 : 64);
  return h('a', { class: 'link', href: l.url, title, target: newTab ? '_blank' : null, rel: 'noopener', style: `--brand:${brandColor(l.url)}` },
    h('span', { class: 'link-ico' }, ico),
    h('span', { class: 'link-title' }, title));
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

      const greet = (hr) => hr < 5 ? 'Доброй ночи' : hr < 12 ? 'Доброе утро' : hr < 18 ? 'Добрый день' : 'Добрый вечер';
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
          const name = ctx.settings().name;
          parts.push(`<span class="greet">${greet(d.getHours())}${name ? ', ' + escapeHtml(name) : ''}</span>`);
        }
        if (data.date) {
          parts.push(`<span>${d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</span>`);
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
    defaults: { glass: true, engine: 'yandex', height: 'normal', newTab: false, recent: true, history: [] },
    settings: [
      { key: 'engine', label: 'Поисковик', type: 'select', options: Object.entries(ENGINES).map(([k, v]) => [k, v.name]) },
      { key: 'height', label: 'Высота строки', type: 'select', options: [['compact', 'Тонкая'], ['normal', 'Обычная'], ['large', 'Крупная']] },
      { key: 'newTab', label: 'Открывать в новой вкладке', type: 'toggle' },
      { key: 'recent', label: 'Помнить последние запросы', type: 'toggle' },
      GLASS_SETTING,
    ],
    render(body, data, ctx) {
      const eng = () => ENGINES[data.engine] || ENGINES.yandex;
      const engineBtn = h('button', { type: 'button', class: 'engine', title: 'Выбрать поисковик' });
      const input = h('input', { type: 'text', class: 'search-input', autocomplete: 'off', spellcheck: 'false', 'data-search': '' });
      const result = h('button', { type: 'button', class: 'search-calc', title: 'Скопировать', hidden: true });
      const keyLabel = h('span', {}, 'Enter');
      const go = h('button', {
        type: 'submit', class: 'search-go', tabindex: '-1',
        title: 'Enter — искать здесь\nCtrl+Enter — в новой вкладке\nShift+Enter — в окне инкогнито',
      }, keyLabel, h('span', { class: 'kc-ico', html: '<svg viewBox="0 0 24 24"><path d="M19 5v7a3 3 0 0 1-3 3H5"/><path d="M9 11l-4 4 4 4"/></svg>' }));
      const form = h('form', { class: `w-search h-${data.height}` }, engineBtn, input, result, go);
      if (!data.recent && data.history?.length) { data.history = []; ctx.save(); }

      const paint = () => {
        engineBtn.innerHTML = engineIcon(eng());
        input.placeholder = `Искать в ${eng().in || eng().name}`;
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
          chrome.windows.create({ url, incognito: true }, () => { if (chrome.runtime.lastError) ctx.toast('Инкогнито недоступно — открыл в новой вкладке'); });
          return;
        }
        if (how === 'tab') { if (chrome.tabs?.create) chrome.tabs.create({ url }); else window.open(url, '_blank', 'noopener'); return; }
        location.href = url;
      };
      const how = (e) => e.shiftKey ? 'incognito' : (e.ctrlKey || e.metaKey || data.newTab) ? 'tab' : 'here';
      const search = (q, mode) => {
        q = q.trim();
        if (!q) return;
        const asUrl = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(q) && !q.includes(' ');
        const { e, text } = parse(q);
        const target = asUrl ? normalizeUrl(q) : e.url + encodeURIComponent(text);
        closeRecent();
        if (data.recent && mode !== 'incognito') { // инкогнито-запросы не запоминаем
          data.history = [q, ...(data.history || []).filter(x => x !== q)].slice(0, 6);
          // уходим со страницы только после записи — иначе отложенное сохранение не успеет
          if (mode === 'here') { ctx.saveNow().finally(() => open(target, mode)); return; }
          ctx.save();
        }
        open(target, mode);
        if (mode !== 'here') { input.value = ''; onInput(); }
      };

      // подсказка на клавише: держишь Shift — «Инкогнито», Ctrl — «Новая вкладка»
      const showMode = (e) => {
        const m = how(e);
        keyLabel.textContent = m === 'incognito' ? 'Инкогнито' : m === 'tab' && (e.ctrlKey || e.metaKey) ? 'Новая вкладка' : 'Enter';
        form.dataset.mode = m;
      };
      input.addEventListener('keydown', (e) => {
        showMode(e);
        if (e.key === 'Enter') { e.preventDefault(); search(input.value, how(e)); }
        if (e.key === 'Escape' && recentBox) { e.stopPropagation(); closeRecent(); }
      });
      input.addEventListener('keyup', showMode);
      input.addEventListener('blur', () => { keyLabel.textContent = 'Enter'; delete form.dataset.mode; });
      form.addEventListener('submit', (e) => { e.preventDefault(); search(input.value, data.newTab ? 'tab' : 'here'); });

      // калькулятор: ответ справа, клик — скопировать
      const onInput = () => {
        const q = input.value.trim();
        form.classList.toggle('has-text', !!q);
        const v = calc(q);
        result.hidden = v == null;
        if (v != null) result.textContent = '= ' + (+v.toFixed(10)).toLocaleString('ru-RU', { maximumFractionDigits: 10 });
        // префикс подсвечивает иконку поисковика, в котором будет поиск
        const { e } = parse(q);
        engineBtn.innerHTML = engineIcon(e);
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
        recentBox = h('div', { class: 'search-recent', style: `left:${r.left}px;top:${r.bottom + 6}px;width:${r.width}px` },
          data.history.map(q => h('div', { class: 'sr-row' },
            h('button', { type: 'button', class: 'sr-q', onmousedown: (e) => { e.preventDefault(); search(q, how(e)); } },
              h('span', { class: 'sr-ico', html: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4M12 8v4l3 2"/></svg>' }), q),
            h('button', {
              type: 'button', class: 'sr-del', title: 'Убрать из истории', html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
              onmousedown: (e) => { e.preventDefault(); data.history = data.history.filter(x => x !== q); ctx.save(); openRecent(); },
            }))));
        document.body.append(recentBox);
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
          }, h('span', { class: 'em-ico', html: engineIcon(e) }), h('span', { class: 'em-name' }, e.name), h('kbd', {}, '!' + e.bang))),
          h('div', { class: 'em-hint' }, 'Префикс — разовый поиск: «!yt котики»'));
        document.body.append(menu);
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
      { key: 'newTab', label: 'Открывать в новой вкладке', type: 'toggle' },
      GLASS_SETTING,
      { key: 'links', label: 'Ссылки', type: 'links' },
    ],
    render(body, data, ctx) {
      const wrap = h('div', { class: `w-links style-${data.style} icons-${data.icons || 'glass'}` });
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

  weather: {
    title: 'Погода',
    size: { w: 6, h: 2 }, min: { w: 3, h: 1 },
    defaults: { glass: true, city: 'Москва', view: 'now' },
    settings: [
      { key: 'city', label: 'Город', type: 'text' },
      { key: 'view', label: 'Вид', type: 'select', options: [['now', 'Сейчас'], ['week', 'Неделя']] },
      GLASS_SETTING,
    ],
    render(body, data, ctx) {
      const box = h('div', { class: 'w-weather is-loading' }, h('div', { class: 'w-muted' }, 'Смотрю в окно…'));
      body.append(box);
      let alive = true;
      let retryT = null;
      let attempt = 0;

      // неделя: колонка на день — день недели, иконка, макс/мин
      const paintWeek = (w, stale) => {
        const wd = (iso, i) => i === 0 ? 'Сегодня' : new Date(iso + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'short' });
        box.classList.remove('is-loading', 'is-error');
        box.classList.toggle('is-stale', stale);
        box.classList.add('is-week');
        box.replaceChildren(...w.days.map((d, i) => h('div', { class: 'wx-day' + (i === 0 ? ' today' : '') },
          h('div', { class: 'wx-dname' }, wd(d.date, i)),
          h('div', { class: 'wx-dico', html: ICONS[weatherInfo(d.code)[1]], title: weatherInfo(d.code)[0] }),
          h('div', { class: 'wx-dt' }, `${Math.round(d.max)}°`, h('span', {}, `${Math.round(d.min)}°`)),
        )));
      };

      const paint = (w, stale) => {
        if (data.view === 'week' && w.days?.length > 1) return paintWeek(w, stale);
        const [desc, ico] = weatherInfo(w.code);
        box.classList.remove('is-loading', 'is-error', 'is-week');
        box.classList.toggle('is-stale', stale);
        box.replaceChildren(
          h('div', { class: 'wx-ico', html: ICONS[ico] }),
          h('div', { class: 'wx-main' },
            h('div', { class: 'wx-temp' }, `${Math.round(w.temp)}°`),
            h('div', { class: 'wx-meta' },
              h('div', { class: 'wx-desc' }, desc),
              h('div', { class: 'w-muted' }, stale ? `${w.place} · нет сети` : `${w.place} · ${Math.round(w.max)}° / ${Math.round(w.min)}°`),
            ),
          ),
        );
      };
      const fail = (text) => {
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
        loadWeather(data.city).then(({ w, stale }) => {
          if (!alive) return;
          paint(w, stale);
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
      load();
      return { destroy: () => { alive = false; clearTimeout(retryT); window.removeEventListener('online', onOnline); } };
    },
  },
};

// → { w, stale }. Без сети отдаёт старый кэш (не старше суток) со stale: true.
// Ошибка с code 'notfound' — город не найден, повторять бессмысленно; остальные — сеть.
async function loadWeather(city) {
  const key = 'wx2:' + city.toLowerCase(); // wx2 — с прогнозом на неделю
  const cached = await Store.get(key, null);
  if (cached && Date.now() - cached.at < 30 * 60 * 1000) return { w: cached.w, stale: false };

  const get = (u) => fetch(u, { signal: AbortSignal.timeout(8000) }).then((r) => {
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  });
  try {
    const geo = await get(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=ru&name=${encodeURIComponent(city)}`);
    const p = geo.results && geo.results[0];
    if (!p) throw Object.assign(new Error('city not found'), { code: 'notfound' });
    const f = await get(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`);
    const dl = f.daily;
    const w = {
      place: p.name,
      temp: f.current.temperature_2m,
      code: f.current.weather_code,
      max: dl.temperature_2m_max[0],
      min: dl.temperature_2m_min[0],
      days: (dl.time || []).map((date, i) => ({ date, code: dl.weather_code?.[i] ?? 0, max: dl.temperature_2m_max[i], min: dl.temperature_2m_min[i] })),
    };
    Store.set(key, { at: Date.now(), w });
    return { w, stale: false };
  } catch (e) {
    if (e.code !== 'notfound' && cached && Date.now() - cached.at < 24 * 3600 * 1000) return { w: cached.w, stale: true };
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
