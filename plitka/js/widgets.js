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
  // крошечная картинка (16px заглушка) — пробуем следующий источник
  img.addEventListener('load', () => { if (img.naturalWidth && img.naturalWidth < 17 && i < srcs.length) next(); });
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

const ENGINES = {
  yandex: { name: 'Яндекс', url: 'https://yandex.ru/search/?text=', home: 'https://ya.ru' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=', home: 'https://www.google.com' },
  duck: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=', home: 'https://duckduckgo.com' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=', home: 'https://www.bing.com' },
};

const GLASS_SETTING = { key: 'glass', label: 'Стеклянная подложка', type: 'toggle' };

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
    defaults: { glass: true, engine: 'yandex' },
    settings: [
      { key: 'engine', label: 'Поисковик', type: 'select', options: Object.entries(ENGINES).map(([k, v]) => [k, v.name]) },
      GLASS_SETTING,
    ],
    render(body, data, ctx) {
      const eng = () => ENGINES[data.engine] || ENGINES.yandex;
      const engineBtn = h('button', { type: 'button', class: 'engine', title: 'Сменить поисковик' });
      const input = h('input', { type: 'text', class: 'search-input', autocomplete: 'off', spellcheck: 'false', 'data-search': '' });
      const go = h('button', { type: 'submit', class: 'search-go', title: 'Искать (Enter)', tabindex: '-1' },
        h('span', {}, 'Enter'),
        h('span', { html: '<svg viewBox="0 0 24 24"><path d="M19 5v7a3 3 0 0 1-3 3H5"/><path d="M9 11l-4 4 4 4"/></svg>' }));
      const form = h('form', { class: 'w-search' }, engineBtn, input, go);
      input.addEventListener('input', () => form.classList.toggle('has-text', !!input.value.trim()));

      const paint = () => {
        const ico = favicon(eng().home, eng().name, 64);
        ico.classList.add('engine-ico');
        engineBtn.replaceChildren(ico);
        engineBtn.title = `${eng().name} — нажми, чтобы сменить`;
        input.placeholder = `Искать в ${eng().name === 'Яндекс' ? 'Яндексе' : eng().name}`;
      };
      paint();

      engineBtn.addEventListener('click', () => {
        const keys = Object.keys(ENGINES);
        data.engine = keys[(keys.indexOf(data.engine) + 1) % keys.length];
        ctx.save();
        paint();
        input.focus();
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) return;
        const asUrl = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(q) && !q.includes(' ');
        location.href = asUrl ? normalizeUrl(q) : eng().url + encodeURIComponent(q);
      });
      body.append(form);
    },
  },

  links: {
    title: 'Ссылки',
    size: { w: 10, h: 2 }, min: { w: 2, h: 1 },
    defaults: {
      glass: true, style: 'tiles', newTab: false,
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
      { key: 'newTab', label: 'Открывать в новой вкладке', type: 'toggle' },
      GLASS_SETTING,
      { key: 'links', label: 'Ссылки', type: 'links' },
    ],
    render(body, data, ctx) {
      const wrap = h('div', { class: `w-links style-${data.style}` });
      for (const l of data.links) {
        wrap.append(h('a', { class: 'link', href: l.url, title: l.title || hostOf(l.url), target: data.newTab ? '_blank' : null, rel: 'noopener' },
          h('span', { class: 'link-ico' },
            favicon(l.url, l.title),
          ),
          h('span', { class: 'link-title' }, l.title || hostOf(l.url)),
        ));
      }
      wrap.append(h('button', {
        class: 'link link-add', type: 'button', title: 'Добавить ссылку',
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
      }, h('span', { class: 'link-ico' }, '+'), h('span', { class: 'link-title' }, 'Добавить')));
      body.append(wrap);
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
    defaults: { glass: true, city: 'Москва' },
    settings: [
      { key: 'city', label: 'Город', type: 'text' },
      GLASS_SETTING,
    ],
    render(body, data, ctx) {
      const box = h('div', { class: 'w-weather is-loading' }, h('div', { class: 'w-muted' }, 'Смотрю в окно…'));
      body.append(box);
      let alive = true;
      let retryT = null;
      let attempt = 0;

      const paint = (w, stale) => {
        const [desc, ico] = weatherInfo(w.code);
        box.classList.remove('is-loading', 'is-error');
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
  const key = 'wx:' + city.toLowerCase();
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
    const f = await get(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`);
    const w = {
      place: p.name,
      temp: f.current.temperature_2m,
      code: f.current.weather_code,
      max: f.daily.temperature_2m_max[0],
      min: f.daily.temperature_2m_min[0],
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
