(async () => {
  const COLS = 24;
  const ROWS = 12;
  const MARGIN = 6;
  const PAD = 14; // отступ сетки от краёв экрана

  const ACCENTS = ['#9b8cff', '#5cc8ff', '#b4f05a', '#ff7a9c', '#ffc35c', '#f2f2f2'];

  // иконка вкладки: часы и помодоро — «живые», перерисовываются
  const TAB_ICONS = [['logo', 'Plitka'], ['emoji', 'Эмодзи'], ['letter', 'Буква'], ['clock', 'Часы'], ['pomodoro', 'Помодоро'], ['image', 'Своя']];
  // шрифт и тень текста в блоках: глобально и с переопределением у блока («Как везде»)
  const FONT_STACK = {
    manrope: "'Manrope', system-ui, sans-serif",
    system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace",
  };
  const FONTS = [['manrope', 'Manrope'], ['system', 'Системный'], ['serif', 'С засечками'], ['mono', 'Моноширинный']];
  const SHADOWS = [['none', 'Нет'], ['soft', 'Мягкая'], ['strong', 'Сильная']];
  // как часто менять слайд-шоу (нужно уже при чистке настроек)
  const SLIDE_EVERY_KEYS = ['tab', '10m', '1h', '1d'];

  // меш-градиент (js/mesh.js): координаты точек в долях экрана
  // mesh.preset — id заготовки, пока её не правили (для подсветки в панели)
  const fromPreset = ({ id, title, ...p }) => ({ ...structuredClone(p), preset: id });
  const unit = (v, d) => Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d;
  const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  const DEFAULT_DUO = ['#120c24', '#ffd2a8'];
  const DEFAULT_MESH = { clear: null, duo: DEFAULT_DUO, anim: 'none', animAmt: 0.5, ...fromPreset(Mesh.PRESETS[0]) };
  // своя картинка: узор и эффекты отдельно от меша, чтобы переключение туда-обратно ничего не теряло.
  // По умолчанию — матовое стекло с чистой полосой по центру.
  const DEFAULT_PHOTO = {
    mode: 'frosted', warp: 0, speed: 0.15, density: 0.55, grain: 0.3, anim: 'none', animAmt: 0.5,
    clear: { x: 0.3, y: 0.34, w: 0.4, h: 0.16 }, duo: DEFAULT_DUO, plain: false,
  };
  // до v0.2 фоны были CSS-пятнами: settings.bg → заготовка меша с той же палитрой
  const LEGACY_BG = { aurora: 'aurora', dusk: 'dusk', lagoon: 'lagoon', forest: 'forest', mono: 'graphite' };

  const DEFAULT_SETTINGS = {
    name: '',
    bgImage: null,
    bgDim: 0.35,
    accent: ACCENTS[0],
    glassBlur: 22,
    glassAlpha: 0.08,
    glassTone: 0.25, // «читаемость»: насколько стекло выравнивает яркость фона под собой (на пёстром — минимум 0.75)
    radius: 22,
    motion: true,
    mesh: DEFAULT_MESH,
    photo: DEFAULT_PHOTO,
    fx: Mesh.FX_DEFAULTS,
    tab: { title: 'Новая вкладка', icon: 'logo', emoji: '🌙', letter: 'P', image: null },
    text: { font: 'manrope', shadow: 'none' },
    slides: { on: false, items: [], every: 'tab', order: 'seq', idx: -1, at: 0 },
  };

  // оформление, общее для всех виджетов: цвет текста и подложки
  const STYLE_DEFAULTS = { ink: 'auto', tint: null, font: 'inherit', shadow: 'inherit' };
  const STYLE_SETTINGS = [
    { key: 'ink', label: 'Цвет текста', type: 'select', options: [['auto', 'Авто'], ['light', 'Светлый'], ['dark', 'Тёмный']] },
    { key: 'font', label: 'Шрифт', type: 'select', options: [['inherit', 'Как везде'], ...FONTS] },
    { key: 'shadow', label: 'Тень текста', type: 'select', options: [['inherit', 'Как везде'], ...SHADOWS] },
    { key: 'tint', label: 'Цвет подложки', type: 'color', empty: 'Стекло' },
  ];

  const DEFAULT_LAYOUT = [
    { id: 'w-clock', type: 'clock', x: 6, y: 2, w: 12, h: 4 },
    { id: 'w-search', type: 'search', x: 6, y: 6, w: 12, h: 1 },
    { id: 'w-links', type: 'links', x: 6, y: 8, w: 12, h: 2 },
    { id: 'w-weather', type: 'weather', x: 0, y: 0, w: 6, h: 2 },
    { id: 'w-notes', type: 'notes', x: 19, y: 0, w: 5, h: 6 },
  ];

  // Раскладки по ширине окна. sm — блоки стопкой, своей раскладки нет; md и lg хранятся отдельно.
  // Пока у диапазона нет своей раскладки, он показывает ближайшую (SOURCES) и форкает её при первой правке.
  const bucketOf = (w) => w < 700 ? 'sm' : w < 1400 ? 'md' : 'lg';
  const SOURCES = { sm: ['md', 'lg'], md: ['md', 'lg'], lg: ['lg', 'md'] };
  const geom = (n) => ({ x: n.x, y: n.y, w: n.w, h: n.h });
  const stripGeom = (list) => list.map(({ id, type, data }) => ({ id, type, data }));

  let settings = cleanSettings(await Store.get('settings', {}));
  // layout — общие для всех экранов виджеты { id, type, data } + x/y/w/h текущего диапазона;
  // layouts — { md?, lg? }: позиции { [id]: { x, y, w, h } }
  let { widgets: layout, layouts } = await loadState();
  layout.forEach(fillDefaults);
  let bucket = bucketOf(window.innerWidth);

  async function loadState() {
    let st = cleanState(await Store.get('widgets', null), await Store.get('layouts', null));
    if (!st) {
      // миграция с v0.1: одна раскладка на все экраны → становится lg
      const legacy = fromLegacy(await Store.get('layout', null));
      st = cleanState(legacy.widgets, legacy.layouts);
      if (st) {
        await Store.set('widgets', stripGeom(st.widgets));
        await Store.set('layouts', st.layouts);
        await Store.remove('layout');
      }
    }
    return st || defaultState();
  }

  function defaultState() {
    return {
      widgets: DEFAULT_LAYOUT.map(({ id, type }) => ({ id, type, data: {} })),
      layouts: { lg: Object.fromEntries(DEFAULT_LAYOUT.map(i => [i.id, geom(i)])) },
    };
  }

  function fromLegacy(arr) {
    if (!Array.isArray(arr)) return {};
    return { widgets: arr, layouts: { lg: Object.fromEntries(arr.filter(i => i && typeof i.id === 'string').map(i => [i.id, i])) } };
  }

  // Всё, что пришло из хранилища или файла, — недоверенное: чистим, а не падаем.
  function cleanSettings(raw) {
    const s = { ...DEFAULT_SETTINGS };
    if (!raw || typeof raw !== 'object') return s;
    for (const k in DEFAULT_SETTINGS) {
      const v = raw[k];
      if (k === 'bgImage') s.bgImage = typeof v === 'string' && v.startsWith('data:image/') ? v : null;
      else if (k === 'mesh') s.mesh = cleanMesh(v);
      else if (k === 'photo') s.photo = cleanPhoto(v);
      else if (k === 'fx') s.fx = cleanFx(v);
      else if (k === 'tab') s.tab = cleanTab(v);
      else if (k === 'text') s.text = cleanText(v);
      else if (k === 'slides') s.slides = cleanSlides(v);
      else if (typeof v === typeof DEFAULT_SETTINGS[k] && (typeof v !== 'number' || Number.isFinite(v))) s[k] = v;
    }
    // старый CSS-фон → та же палитра на меше
    const legacy = Mesh.PRESETS.find(p => p.id === LEGACY_BG[raw.bg]);
    if (legacy) s.mesh = fromPreset(legacy);
    return s;
  }

  // общее для меша и картинки: узор, ползунки, чистая область, цвета дуотона
  function cleanLook(raw, def) {
    const m = structuredClone(def);
    if (!raw || typeof raw !== 'object') return m;
    for (const k of ['warp', 'speed', 'grain', 'density', 'animAmt']) m[k] = unit(raw[k], m[k]);
    m.anim = Mesh.ANIMS[raw.anim] ? raw.anim : 'none';
    if ('plain' in def) m.plain = !!raw.plain;
    m.mode = Mesh.MODES[raw.mode] ? raw.mode : def.mode;
    const c = raw.clear;
    m.clear = c && typeof c === 'object' && [c.x, c.y, c.w, c.h].every(Number.isFinite)
      ? { x: unit(c.x, 0), y: unit(c.y, 0), w: Math.max(0.03, unit(c.w, 0.2)), h: Math.max(0.03, unit(c.h, 0.2)) }
      : raw.clear === null ? null : m.clear;
    if (m.clear) { m.clear.w = Math.min(m.clear.w, 1 - m.clear.x); m.clear.h = Math.min(m.clear.h, 1 - m.clear.y); }
    if (Array.isArray(raw.duo) && raw.duo.length === 2 && raw.duo.every(isHex)) m.duo = raw.duo.map(x => x.toLowerCase());
    return m;
  }

  function cleanMesh(raw) {
    const m = cleanLook(raw, DEFAULT_MESH);
    if (!raw || typeof raw !== 'object') return m;
    const pts = Array.isArray(raw.points) ? raw.points
      .filter(p => p && isHex(p.color))
      .slice(0, Mesh.MAX)
      .map(p => ({ x: unit(p.x, 0.5), y: unit(p.y, 0.5), color: p.color.toLowerCase() })) : [];
    if (pts.length >= 2) m.points = pts;
    if (Mesh.PRESETS.some(p => p.id === raw.preset)) m.preset = raw.preset;
    else delete m.preset;
    return m;
  }

  function cleanPhoto(raw) { return cleanLook(raw, DEFAULT_PHOTO); }

  function cleanTab(raw) {
    const t = { ...DEFAULT_SETTINGS.tab };
    if (!raw || typeof raw !== 'object') return t;
    if (typeof raw.title === 'string') t.title = raw.title.slice(0, 80);
    if (TAB_ICONS.some(([k]) => k === raw.icon)) t.icon = raw.icon;
    if (typeof raw.emoji === 'string' && raw.emoji.trim()) t.emoji = [...raw.emoji.trim()].slice(0, 4).join('');
    if (typeof raw.letter === 'string' && raw.letter.trim()) t.letter = [...raw.letter.trim()].slice(0, 2).join('');
    t.image = typeof raw.image === 'string' && raw.image.startsWith('data:image/') && raw.image.length < 300000 ? raw.image : null;
    return t;
  }

  function cleanSlides(raw) {
    const s = { ...DEFAULT_SETTINGS.slides, items: [] };
    if (!raw || typeof raw !== 'object') return s;
    s.on = !!raw.on;
    if (SLIDE_EVERY_KEYS.includes(raw.every)) s.every = raw.every;
    if (raw.order === 'random') s.order = 'random';
    s.at = Number.isFinite(raw.at) ? raw.at : 0;
    for (const it of Array.isArray(raw.items) ? raw.items.slice(0, 40) : []) {
      if (!it || typeof it.id !== 'string') continue;
      if (it.kind === 'image') s.items.push({ id: it.id, kind: 'image', thumb: typeof it.thumb === 'string' && it.thumb.startsWith('data:image/') && it.thumb.length < 60000 ? it.thumb : null });
      else if (it.kind === 'mesh' && it.mesh && typeof it.mesh === 'object') s.items.push({ id: it.id, kind: 'mesh', mesh: cleanMesh(it.mesh) });
    }
    s.idx = Number.isInteger(raw.idx) && raw.idx < s.items.length ? raw.idx : -1;
    return s;
  }

  function cleanText(raw) {
    return {
      font: FONT_STACK[raw?.font] ? raw.font : 'manrope',
      shadow: SHADOWS.some(([k]) => k === raw?.shadow) ? raw.shadow : 'none',
    };
  }

  function cleanFx(raw) {
    const f = { ...Mesh.FX_DEFAULTS };
    if (!raw || typeof raw !== 'object') return f;
    for (const k in f) f[k] = typeof f[k] === 'boolean' ? !!raw[k] : unit(raw[k], f[k]);
    return f;
  }

  // → { widgets, layouts } или null, если спасать нечего
  function cleanState(rawWidgets, rawLayouts) {
    if (!Array.isArray(rawWidgets)) return null;
    const ids = new Set();
    const widgets = [];
    for (const it of rawWidgets) {
      if (!it || !Widgets[it.type]) continue;
      let id = typeof it.id === 'string' && it.id ? it.id : 'w-' + Math.random().toString(36).slice(2, 9);
      while (ids.has(id)) id += '-' + Math.random().toString(36).slice(2, 5);
      ids.add(id);
      widgets.push({ id, type: it.type, data: it.data && typeof it.data === 'object' && !Array.isArray(it.data) ? it.data : {} });
    }
    if (!widgets.length) return null;

    const int = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
    const layouts = {};
    for (const b of ['md', 'lg']) {
      const m = rawLayouts && rawLayouts[b];
      if (!m || typeof m !== 'object') continue;
      layouts[b] = {};
      for (const { id, type } of widgets) {
        const p = m[id];
        if (!p || typeof p !== 'object') continue; // нет позиции — gridstack найдёт место сам
        const min = Widgets[type].min;
        const w = int(p.w, min.w, COLS);
        const hh = int(p.h, min.h, ROWS);
        layouts[b][id] = { x: int(p.x, 0, COLS - w), y: int(p.y, 0, ROWS - hh), w, h: hh };
      }
    }
    return { widgets, layouts };
  }

  function fillDefaults(item) {
    const def = Widgets[item.type];
    item.data = { ...STYLE_DEFAULTS, ...structuredClone(def.defaults), ...(item.data || {}) };
    if (!['auto', 'light', 'dark'].includes(item.data.ink)) item.data.ink = 'auto';
    if (!/^#[0-9a-f]{6}$/i.test(item.data.tint)) item.data.tint = null;
    if (item.data.font !== 'inherit' && !FONT_STACK[item.data.font]) item.data.font = 'inherit';
    if (!['inherit', ...SHADOWS.map(([k]) => k)].includes(item.data.shadow)) item.data.shadow = 'inherit';
  }

  // ---------- тема ----------
  function applyTheme() {
    const r = document.documentElement.style;
    r.setProperty('--accent', settings.accent);
    r.setProperty('--glass-blur', settings.glassBlur + 'px');
    r.setProperty('--glass-alpha', settings.glassAlpha);
    r.setProperty('--glass-tone', settings.glassTone);
    r.setProperty('--radius', settings.radius + 'px');
    r.setProperty('--bg-dim', settings.bgDim);
    document.body.classList.toggle('has-image', !!settings.bgImage);
    // картинка с эффектом: «чистую» заглушку до готовности WebGL не показываем (см. CSS)
    document.body.classList.toggle('photo-fx', !!settings.bgImage && !settings.photo.plain);
    document.body.classList.toggle('no-motion', !settings.motion);
    document.querySelector('#bg .bg-image').style.backgroundImage = settings.bgImage ? `url("${settings.bgImage}")` : '';
    r.setProperty('--w-font', FONT_STACK[settings.text.font]);
    document.body.dataset.ts = settings.text.shadow;
    applyMesh();
    applyTab();
    // фон поменялся — пересчитать «авто»-цвет текста у блоков (после инициализации сетки)
    setTimeout(refreshInk, 60);
  }

  // ---------- вкладка: заголовок и иконка ----------
  // В заголовке можно {время}, {дата}, {день}. Помодоро временно занимает его через Tab.set (widgets-more.js).
  function tabTitle() {
    const d = new Date();
    const t = (settings.tab.title || '')
      .replace(/\{время\}/gi, d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
      .replace(/\{дата\}/gi, d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }))
      .replace(/\{день\}/gi, d.toLocaleDateString('ru-RU', { weekday: 'long' }));
    return t.trim() || '​'; // пустой заголовок Chrome заменит адресом — ставим невидимый символ
  }

  // рисует иконку в 64×64 и возвращает dataURL (или путь к файлу для логотипа)
  function tabIcon(kind = settings.tab.icon) {
    const tab = settings.tab;
    if (kind === 'logo' || (kind === 'image' && !tab.image)) return 'icons/icon32.png';
    if (kind === 'image') return tab.image;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (kind === 'emoji') {
      g.font = '54px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      g.fillText(tab.emoji, 32, 36);
    } else if (kind === 'letter') {
      g.fillStyle = settings.accent;
      g.beginPath(); g.roundRect(2, 2, 60, 60, 16); g.fill();
      g.fillStyle = '#0c0c0d';
      g.font = `800 ${tab.letter.length > 1 ? 30 : 40}px Manrope, sans-serif`;
      g.fillText(tab.letter, 32, 35);
    } else if (kind === 'clock') {
      const d = new Date();
      g.fillStyle = '#18181a'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
      g.strokeStyle = settings.accent; g.lineWidth = 3; g.stroke();
      const hand = (a, len, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.sin(a) * len, 32 - Math.cos(a) * len); g.stroke(); };
      const m = d.getMinutes() + d.getSeconds() / 60;
      hand((d.getHours() % 12 + m / 60) / 12 * Math.PI * 2, 14, 6, '#fff');
      hand(m / 60 * Math.PI * 2, 22, 4, '#fff');
      g.fillStyle = settings.accent; g.beginPath(); g.arc(32, 32, 4, 0, 7); g.fill();
    } else if (kind === 'pomodoro') {
      // кольцо оставшегося времени и минуты в центре; таймер не идёт — полное тусклое кольцо
      const p = Tab.pomo;
      const col = p?.phase === 'rest' ? '#6fe3b0' : settings.accent;
      g.fillStyle = '#18181a'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
      g.lineWidth = 7; g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(32, 32, 24, 0, 7); g.stroke();
      if (p) {
        g.strokeStyle = col;
        g.beginPath(); g.arc(32, 32, 24, -Math.PI / 2, -Math.PI / 2 + (1 - p.progress) * Math.PI * 2); g.stroke();
        g.fillStyle = '#fff';
        g.font = '800 24px Manrope, sans-serif';
        g.fillText(String(p.min), 32, 34);
      } else {
        g.fillStyle = col; g.beginPath(); g.arc(32, 32, 8, 0, 7); g.fill();
      }
    }
    return c.toDataURL('image/png');
  }

  let lastIcon = '';
  function applyTab() {
    document.title = Tab.override || tabTitle();
    const href = tabIcon();
    if (href !== lastIcon) { document.querySelector('link[rel="icon"]').href = href; lastIcon = href; }
  }
  Tab.update = applyTab;
  // часы и {время} меняются сами — раз в секунду сверяем (иконка перезаписывается, только если изменилась)
  setInterval(() => { if (!document.hidden || settings.tab.icon === 'clock' || settings.tab.icon === 'pomodoro') applyTab(); }, 1000);

  // Живой фон на WebGL — и для меша, и для своей картинки (она становится текстурой, узоры работают поверх).
  // Без WebGL: CSS-градиенты из точек меша или обычная картинка (.bg-image).
  let meshBg = null;
  const look = () => settings.bgImage ? settings.photo : settings.mesh; // что сейчас редактируем
  function bgParams() {
    const p = settings.bgImage
      ? { ...settings.photo, image: settings.bgImage, dim: settings.bgDim, fx: settings.fx,
          // «как есть»: картинка без узора, анимации и чистой области — эффекты фона (виньетка и т.п.) остаются
          ...(settings.photo.plain ? { mode: 'mesh', anim: 'none', clear: null, warp: 0 } : {}) }
      : { ...settings.mesh, fx: settings.fx };
    // «Живой фон» выключен — всё стоит на месте, включая частицы
    return settings.motion ? p : { ...p, speed: 0, fx: { ...p.fx, still: true } };
  }
  function applyMesh() {
    const bg = document.getElementById('bg');
    bg.style.setProperty('--grain', settings.bgImage && settings.photo.plain ? 0 : look().grain * 0.4);
    bg.style.background = settings.bgImage ? '' : Mesh.cssPreview(settings.mesh);
    meshBg ??= Mesh.create(document.getElementById('bg-mesh'), {
      onReady: () => {
        document.body.classList.add('mesh-on');
        console.info(`[plitka] фон готов через ${Math.round(performance.now())} мс после открытия вкладки`);
      },
    });
    meshBg?.set(bgParams());
    // без WebGL остаётся CSS-заглушка — тогда картинку показываем как есть
    document.body.classList.toggle('no-webgl', !meshBg);
  }
  applyTheme();

  // эффекты, которым нужен внешний сигнал: курсор и часы
  window.addEventListener('pointermove', (e) => {
    if (settings.fx.mouse) meshBg?.pointer(e.clientX / innerWidth, e.clientY / innerHeight);
  }, { passive: true });
  setInterval(() => { if (settings.fx.daycycle) meshBg?.set(bgParams()); }, 60000);

  // вкладка в фоне — фон не анимируем
  const syncHidden = () => document.body.classList.toggle('tab-hidden', document.hidden);
  document.addEventListener('visibilitychange', syncHidden);
  syncHidden();

  // ---------- сетка ----------
  const cellH = () => Math.floor((window.innerHeight - PAD * 2) / ROWS);

  const grid = GridStack.init({
    column: COLS,
    maxRow: ROWS,
    cellHeight: cellH(),
    margin: MARGIN,
    float: true,
    animate: true,
    staticGrid: true,
    columnOpts: { breakpoints: [] },
    resizable: { handles: 'n,e,s,w,ne,se,sw,nw' },
    draggable: { cancel: '.w-tools, .w-tools *' },
  }, '#grid');

  const live = new Map(); // id -> { el, body, inst }

  const saveLayout = debounce(() => {
    Store.set('widgets', stripGeom(layout));
    Store.set('layouts', layouts);
  }, 250);
  const saveSettings = debounce(() => Store.set('settings', settings), 250);

  function ctxFor(item) {
    return {
      id: item.id,
      settings: () => settings,
      save: saveLayout,
      // сохранить сразу и дождаться — перед уходом со страницы (поиск, переход по ссылке)
      saveNow: () => Promise.all([Store.set('widgets', stripGeom(layout)), Store.set('layouts', layouts)]),
      rerender: () => renderWidget(item),
      modal: openModal,
      toast,
    };
  }

  function renderWidget(item) {
    const rec = live.get(item.id);
    if (!rec) return;
    rec.inst?.destroy?.();
    rec.body.replaceChildren();
    rec.shell.classList.toggle('glass', !!item.data.glass);
    rec.shell.classList.toggle('tinted', !!item.data.tint);
    rec.shell.style.setProperty('--tint', item.data.tint || '');
    // шрифт и тень: своё у блока или глобальное (тогда атрибута нет — работает body[data-ts] / --w-font)
    rec.shell.style.setProperty('--wf', item.data.font !== 'inherit' ? FONT_STACK[item.data.font] : '');
    if (item.data.shadow !== 'inherit') rec.shell.dataset.ts = item.data.shadow; else delete rec.shell.dataset.ts;
    rec.shell.dataset.type = item.type;
    rec.inst = Widgets[item.type].render(rec.body, item.data, ctxFor(item)) || null;
    applyInk(item);
  }

  // ---------- цвет текста в блоках ----------
  // «Авто»: смотрим яркость фона под блоком (и цвет подложки, если она своя) и выбираем светлый/тёмный текст.
  let imgLum = null; // { w, h, data } — уменьшенная копия своей картинки-фона
  function bgLum(x, y) {
    if (settings.bgImage && imgLum) {
      const i = (Math.min(imgLum.h - 1, Math.floor(y * imgLum.h)) * imgLum.w + Math.min(imgLum.w - 1, Math.floor(x * imgLum.w))) * 4;
      const d = imgLum.data;
      const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255 * (1 - settings.bgDim);
      const p = settings.photo, c = p.clear;
      if (p.plain) return l; // «как есть» — без узора
      if (c && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return l; // чистая область — как есть
      if (p.mode === 'frosted') return l * 0.9 + 0.08;
      if (p.mode === 'halftone') return l * 0.55;
      if (p.mode === 'flow') return 0.05 + l * 0.15;
      if (p.mode === 'duotone') { const [a, b] = p.duo.map(hexLum); return a + (b - a) * l; }
      return l;
    }
    if (settings.bgImage) return 0.3;
    return Mesh.lumAt(settings.mesh, x, y, innerWidth / innerHeight);
  }
  // → { mean, spread } — средняя яркость под блоком и разброс (пёстрый фон: и белое, и чёрное сразу)
  function lumUnder(el) {
    const r = el.getBoundingClientRect();
    let sum = 0, lo = 1, hi = 0;
    for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) for (const fy of [0.2, 0.5, 0.8]) {
      const l = bgLum((r.left + r.width * fx) / innerWidth, (r.top + r.height * fy) / innerHeight);
      sum += l; lo = Math.min(lo, l); hi = Math.max(hi, l);
    }
    return { mean: sum / 15, spread: hi - lo };
  }
  const hexLum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };

  function applyInk(item) {
    const rec = live.get(item.id);
    if (!rec) return;
    let dark = item.data.ink === 'dark';
    const { mean, spread } = lumUnder(rec.el);
    // пёстрый фон под стеклом — стекло выравнивает яркость подложки (сжимает контраст), и любой цвет текста читается
    const mixed = !!item.data.glass && !item.data.tint && spread > 0.4;
    rec.shell.classList.toggle('bg-mixed', mixed);
    if (item.data.ink === 'auto') {
      let l = mean;
      if (item.data.glass && item.data.tint) l = 0.35 * l + 0.65 * hexLum(item.data.tint);
      else if (mixed) l = 0.3; // после выравнивания подложка тёмно-серая — текст светлый
      else if (item.data.glass) l = l + (1 - l) * settings.glassAlpha; // белое стекло чуть высветляет
      dark = l > 0.58;
    }
    rec.shell.classList.toggle('ink-dark', dark);
  }
  function refreshInk() { for (const it of layout) applyInk(it); }

  // уменьшенная копия картинки-фона для «авто»-текста
  function sampleImage() {
    imgLum = null;
    if (!settings.bgImage) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 48; c.height = 27;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, c.width, c.height);
      imgLum = { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data };
      refreshInk();
    };
    img.src = settings.bgImage;
  }

  // pos — где стоять; без неё gridstack сам ищет свободное место
  function mountWidget(item, pos) {
    const def = Widgets[item.type];
    const autoPosition = !pos;
    if (pos) Object.assign(item, pos);
    else if (!item.w) Object.assign(item, def.size);
    const body = h('div', { class: 'w-body' });
    const tools = h('div', { class: 'w-tools' },
      h('span', { class: 'w-name' }, def.title),
      h('button', { class: 'tool', title: 'Настроить', onclick: () => openWidgetSettings(item), html: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>' }),
      h('button', { class: 'tool danger', title: 'Удалить', onclick: () => removeWidget(item), html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>' }),
    );
    const shell = h('div', { class: 'w' }, body, tools);
    const el = h('div', { class: 'grid-stack-item' }, h('div', { class: 'grid-stack-item-content' }, shell));
    grid.makeWidget(el, {
      id: item.id,
      x: autoPosition ? undefined : item.x, y: autoPosition ? undefined : item.y,
      w: item.w, h: item.h,
      minW: def.min.w, minH: def.min.h,
      autoPosition,
    });
    live.set(item.id, { el, body, shell, inst: null });
    renderWidget(item);
    return el;
  }

  // позиции, которые сейчас на экране: своя раскладка диапазона или ближайшая
  function shownPositions() {
    const src = SOURCES[bucket].find(b => layouts[b]);
    return src ? layouts[src] : (layouts[bucket === 'sm' ? 'md' : bucket] = {});
  }
  let shown = null;

  // геометрия из gridstack → в item, плюс порядок и высота для стопки на узком экране
  function syncGeom(item) {
    const rec = live.get(item.id);
    const n = rec?.el.gridstackNode;
    if (!n) return;
    Object.assign(item, geom(n));
    rec.el.style.setProperty('--order', item.y * COLS + item.x);
    rec.el.style.setProperty('--h', item.h);
  }

  let mounting = false;
  function mountAll() {
    shown = shownPositions();
    mounting = true;
    grid.batchUpdate();
    for (const it of layout) mountWidget(it, shown[it.id]);
    grid.batchUpdate(false);
    mounting = false;
    for (const it of layout) {
      syncGeom(it);
      // блока в этой раскладке не было — запоминаем, куда его поставил gridstack
      if (!shown[it.id]) { shown[it.id] = geom(it); saveLayout(); }
    }
    refreshInk(); // позиции известны только сейчас
  }

  function unmountAll() {
    for (const rec of live.values()) rec.inst?.destroy?.();
    live.clear();
    grid.removeAll();
  }

  // пользователь что-то поменял — у текущего диапазона теперь своя раскладка
  function commitPositions() {
    if (bucket === 'sm') return;
    shown = layouts[bucket] = Object.fromEntries(layout.map(i => [i.id, geom(i)]));
    saveLayout();
  }

  document.body.classList.toggle('narrow', bucket === 'sm');
  mountAll();
  sampleImage();

  grid.on('change', (_e, nodes) => {
    for (const n of nodes || []) {
      const it = layout.find(i => i.id === n.id);
      if (it) syncGeom(it);
    }
    if (!mounting) commitPositions();
    placeInspector?.();
    refreshInk();
  });

  function applyBucket() {
    const b = bucketOf(window.innerWidth);
    if (b === bucket) return;
    bucket = b;
    document.body.classList.toggle('narrow', b === 'sm');
    if (b === 'sm' && editing) setEditing(false);
    // перерисовываем, только если на экран должна встать другая раскладка
    if (shownPositions() !== shown) { unmountAll(); mountAll(); }
  }

  window.addEventListener('resize', debounce(() => {
    grid.cellHeight(cellH());
    refreshInk();
    drawGuides();
  }, 80));
  // раскладку меняем, когда окно перестали тянуть, — чтобы блоки не прыгали на границе
  window.addEventListener('resize', debounce(applyBucket, 250));

  // ---------- режим редактирования ----------
  let editing = false;
  const guides = document.getElementById('guides');

  function drawGuides() {
    const g = document.getElementById('grid').getBoundingClientRect();
    const cw = g.width / COLS;
    const ch = cellH();
    guides.style.cssText = `left:${g.left}px;top:${g.top}px;width:${g.width}px;height:${ch * ROWS}px;` +
      `--cw:${cw}px;--ch:${ch}px;--m:${MARGIN}px`;
  }

  function setEditing(on) {
    if (on && bucket === 'sm') { toast('Окно слишком узкое — растяни его, чтобы двигать блоки'); return; }
    editing = on;
    document.body.classList.toggle('editing', on);
    grid.setStatic(!on);
    if (on) drawGuides();
    else { closeAddMenu(); closeInspector?.(); }
  }

  document.getElementById('btn-edit').addEventListener('click', () => setEditing(!editing));
  document.getElementById('btn-done').addEventListener('click', () => setEditing(false));

  // добавление
  const addMenu = document.getElementById('add-menu');
  // карточки по группам: иконка, название, что умеет
  for (const [g, gTitle] of WIDGET_GROUPS) {
    const items = Object.entries(Widgets).filter(([, def]) => (def.group || 'mood') === g);
    if (!items.length) continue;
    addMenu.append(h('div', { class: 'add-group' }, gTitle),
      ...items.map(([type, def]) => h('button', { class: 'add-item', type: 'button', onclick: () => { addWidget(type); closeAddMenu(); } },
        h('span', { class: 'add-ico', html: def.icon || '' }),
        h('span', { class: 'add-txt' }, h('b', {}, def.title), h('small', {}, def.desc || '')))));
  }
  const closeAddMenu = () => addMenu.classList.remove('open');
  document.getElementById('btn-add').addEventListener('click', (e) => { e.stopPropagation(); addMenu.classList.toggle('open'); });
  document.addEventListener('click', (e) => { if (!addMenu.contains(e.target)) closeAddMenu(); });

  function addWidget(type) {
    const def = Widgets[type];
    // необязательное разрешение спрашиваем сразу — пока клик ещё «свежий»; откажут — виджет покажет кнопку
    if (def.perm) chrome.permissions?.request({ permissions: [def.perm] }).then((ok) => { if (ok) renderWidget(item); }).catch(() => {});
    const item = { id: 'w-' + Math.random().toString(36).slice(2, 9), type, w: def.size.w, h: def.size.h };
    fillDefaults(item);
    if (!grid.willItFit({ w: item.w, h: item.h })) {
      item.w = def.min.w; item.h = def.min.h;
      if (!grid.willItFit({ w: item.w, h: item.h })) { toast('Места нет — освободи немного'); return; }
    }
    layout.push(item);
    const el = mountWidget(item);
    syncGeom(item);
    commitPositions(); // в других диапазонах блок появится там, где найдётся место
    el.classList.add('just-added');
    setTimeout(() => el.classList.remove('just-added'), 900);
  }

  // удаление общее для всех экранов
  function removeWidget(item) {
    const rec = live.get(item.id);
    if (!rec) return;
    if (rec.el.classList.contains('inspecting')) closeInspector?.();
    rec.inst?.destroy?.();
    grid.removeWidget(rec.el);
    live.delete(item.id);
    layout = layout.filter(i => i.id !== item.id);
    const was = {};
    for (const [b, m] of Object.entries(layouts)) if (m[item.id]) { was[b] = m[item.id]; delete m[item.id]; }
    saveLayout();
    toast(`«${Widgets[item.type].title}» удалён`, 'Вернуть', () => {
      for (const b in was) if (layouts[b]) layouts[b][item.id] = was[b];
      layout.push(item);
      mountWidget(item, shown[item.id]);
      syncGeom(item);
      if (!shown[item.id]) shown[item.id] = geom(item);
      saveLayout();
    });
  }

  // ---------- инспектор блока: настройки сбоку от него, применяются сразу ----------
  let closeInspector = null;
  let placeInspector = null;
  function openWidgetSettings(item) {
    closeInspector?.();
    const def = Widgets[item.type];
    const rec = live.get(item.id);
    if (!rec) return;
    const fields = [...def.settings, { type: 'heading', label: 'Оформление' }, ...STYLE_SETTINGS]
      .map(s => ({ ...s, value: structuredClone(item.data[s.key]) }));

    let getters = {};
    let t = null;
    const apply = () => {
      clearTimeout(t);
      const v = {};
      for (const k in getters) v[k] = getters[k]();
      // ничего не поменялось — не перерисовываем (таймеры и фокус виджета не сбиваем)
      if (Object.keys(v).every(k => JSON.stringify(v[k]) === JSON.stringify(item.data[k]))) return;
      Object.assign(item.data, v);
      saveLayout();
      renderWidget(item);
    };
    // клики применяем сразу, набор текста — с небольшой задержкой
    const notify = (typing) => { clearTimeout(t); t = setTimeout(apply, typing ? 300 : 0); };
    const built = buildFields(fields, notify);
    getters = built.getters;

    const el = h('aside', { class: 'inspector', role: 'dialog', 'aria-label': def.title },
      h('header', { class: 'insp-head' },
        h('h3', {}, def.title),
        h('button', { type: 'button', class: 'icon-btn', title: 'Закрыть (Esc)', onclick: () => close() }, '✕')),
      h('div', { class: 'insp-body' }, ...built.nodes));
    document.body.append(el);
    rec.el.classList.add('inspecting');

    // сбоку от блока: справа, если влезает, иначе слева, иначе поверх края экрана
    const place = () => {
      const r = rec.el.getBoundingClientRect();
      const W = el.offsetWidth, H = el.offsetHeight, gap = 12;
      let left = r.right + gap;
      if (left + W > innerWidth - gap) left = r.left - gap - W;
      if (left < gap) left = innerWidth - W - gap;
      const top = Math.min(Math.max(gap, r.top), innerHeight - H - gap);
      el.style.left = left + 'px';
      el.style.top = Math.max(gap, top) + 'px';
    };
    place();
    requestAnimationFrame(() => el.classList.add('open'));

    const onKey = (e) => {
      if (e.key !== 'Escape' || closePicker || closeDropdown) return; // сначала закрываются пикер и список
      e.stopImmediatePropagation();
      close();
    };
    const onDown = (e) => {
      if (el.contains(e.target) || rec.el.contains(e.target) || e.target.closest('.cp, .dd-list, .toast')) return;
      close();
    };
    const onMove = () => place();
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('resize', onMove);
    placeInspector = place; // блок подвинули — инспектор едет за ним (зовётся из обработчика change)

    function close() {
      apply(); // недописанный текст не теряем
      el.remove();
      rec.el.classList.remove('inspecting');
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('resize', onMove);
      placeInspector = null;
      closePicker?.();
      closeDropdown?.();
      if (closeInspector === close) closeInspector = null;
    }
    closeInspector = close;
  }

  // ---------- поля настроек: общие для инспектора и модалки ----------
  // notify(typing) — зовётся на каждое изменение (typing — набор текста, можно подождать)
  function buildFields(fields, notify = () => {}) {
    const nodes = [];
    const getters = {};
    for (const f of fields) {
      const id = 'f-' + f.key + '-' + Math.random().toString(36).slice(2, 6);
      let control;
      if (f.type === 'heading') {
        nodes.push(h('h4', { class: 'modal-sub' }, f.label));
        continue;
      }
      if (f.type === 'color') {
        // null = «нет своего цвета» (f.empty — подпись для этого случая)
        let cur = f.value || null;
        const dot = h('i');
        const text = h('span');
        const reset = h('button', { type: 'button', class: 'pill small', onclick: () => { cur = null; paint(); notify(); } }, 'Сбросить');
        const paint = () => {
          dot.style.background = cur || '';
          dot.classList.toggle('none', !cur);
          text.textContent = cur || f.empty || 'Нет';
          reset.hidden = !cur;
        };
        const btn = h('button', {
          type: 'button', class: 'color-btn',
          onclick: () => colorPicker(btn, cur || '#8a7cff', (c) => { cur = c; paint(); notify(); }),
        }, dot, text);
        paint();
        control = h('div', { class: 'field field-row' }, h('span', {}, f.label), h('div', { class: 'row' }, reset, btn));
        getters[f.key] = () => cur;
      } else if (f.type === 'toggle') {
        const inp = h('input', { type: 'checkbox', id });
        inp.checked = !!f.value;
        inp.addEventListener('change', () => notify());
        control = h('label', { class: 'field field-toggle', for: id }, h('span', {}, f.label), h('span', { class: 'switch' }, inp, h('i')));
        getters[f.key] = () => inp.checked;
      } else if (f.type === 'select') {
        // до трёх вариантов — сегменты (всё видно сразу), больше — выпадающий список
        const c = f.options.length <= 3 ? segmented(f.options, f.value, () => notify()) : dropdown(f.options, f.value, () => notify());
        control = h('div', { class: 'field' }, h('span', {}, f.label), c.el);
        getters[f.key] = c.get;
      } else if (f.type === 'align') {
        const c = alignPicker(f.value, () => notify());
        control = h('div', { class: 'field field-row' }, h('span', {}, f.label), c.el);
        getters[f.key] = c.get;
      } else if (f.type === 'links') {
        const list = structuredClone(f.value || []);
        const box = h('div', { class: 'links-editor' });
        const paint = () => {
          box.replaceChildren(...list.map((l, i) => h('div', { class: 'le-row' },
            h('span', { class: 'le-ico' }, favicon(l.url, l.title, 32)),
            h('input', { type: 'text', value: l.title, placeholder: hostOf(l.url), oninput: (e) => { l.title = e.target.value; notify(true); } }),
            h('input', { type: 'text', value: l.url, class: 'le-url', oninput: (e) => { l.url = e.target.value; notify(true); } }),
            h('button', { type: 'button', class: 'tool', title: 'Выше', disabled: i === 0, onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; paint(); notify(); }, html: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>' }),
            h('button', { type: 'button', class: 'tool danger', title: 'Удалить', onclick: () => { list.splice(i, 1); paint(); notify(); }, html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>' }),
          )), h('div', { class: 'row' },
            h('button', { type: 'button', class: 'pill small', onclick: () => { list.push({ title: '', url: 'https://' }); paint(); box.querySelector('.le-row:last-of-type .le-url')?.focus(); } }, '+ Ссылка'),
            h('button', { type: 'button', class: 'pill small', title: 'Забрать ссылки из строки закладок браузера', onclick: () => fromBookmarks() }, 'Из панели закладок')));
        };
        // разово забираем строку закладок (и первый уровень папок); дубликаты пропускаем
        const fromBookmarks = async () => {
          if (!(await Perm.has('bookmarks')) && !(await Perm.ask('bookmarks'))) return;
          if (!Bookmarks.available()) { toast('Доступ есть — обнови вкладку и нажми ещё раз'); return; }
          const have = new Set(list.map(l => normalizeUrl(l.url)));
          const add = (await Bookmarks.flat()).filter(b => /^https?:/.test(b.url) && !have.has(normalizeUrl(b.url))).map(b => ({ title: b.title || '', url: b.url }));
          list.push(...add);
          paint();
          notify();
          toast(add.length ? `Добавлено из закладок: ${add.length}` : 'Новых закладок нет');
        };
        paint();
        control = h('div', { class: 'field field-block' }, h('span', {}, f.label), box);
        getters[f.key] = () => list.filter(l => l.url && l.url !== 'https://').map(l => ({ title: l.title.trim(), url: normalizeUrl(l.url) }));
      } else {
        const inp = h('input', { type: 'text', id, placeholder: f.placeholder || '', required: f.required });
        inp.value = f.value ?? '';
        inp.addEventListener('input', () => notify(true));
        control = h('label', { class: 'field', for: id }, h('span', {}, f.label), inp);
        getters[f.key] = () => inp.value;
      }
      nodes.push(control);
    }
    return { nodes, getters };
  }

  // ---------- модалка: только там, где нужно явное «Добавить» (например, новая ссылка) ----------
  const modal = document.getElementById('modal');
  const modalForm = document.getElementById('modal-form');

  function openModal({ title, fields, submit = 'OK', onSubmit }) {
    document.getElementById('modal-title').textContent = title;
    const { nodes, getters } = buildFields(fields);
    modalForm.replaceChildren(...nodes, h('div', { class: 'modal-actions' },
      h('button', { type: 'button', class: 'pill', onclick: closeModal }, 'Отмена'),
      h('button', { type: 'submit', class: 'pill pill-accent' }, submit),
    ));
    modalForm.onsubmit = (e) => {
      e.preventDefault();
      const v = {};
      for (const k in getters) v[k] = getters[k]();
      closeModal();
      onSubmit(v);
    };
    modal.classList.add('open');
    setTimeout(() => modalForm.querySelector('input[type=text]')?.focus(), 30);
  }
  function closeModal() { closeDropdown?.(); closePicker?.(); modal.classList.remove('open'); }

  // ---------- свои контролы вместо системных ----------
  // каждый → { el, get() }

  function segmented(options, value, onChange) {
    let cur = options.some(([v]) => v === value) ? value : options[0][0];
    const btns = options.map(([v, t]) => h('button', { type: 'button', class: 'seg-btn', role: 'radio', onclick: () => { const ch = cur !== v; cur = v; paint(); if (ch) onChange?.(v); } }, t));
    const paint = () => btns.forEach((b, i) => {
      const on = options[i][0] === cur;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on);
    });
    paint();
    return { el: h('div', { class: 'seg', role: 'radiogroup' }, btns), get: () => cur };
  }

  let closeDropdown = null; // открыт максимум один список
  function dropdown(options, value, onChange) {
    let cur = options.some(([v]) => v === value) ? value : options[0][0];
    const label = h('span', { class: 'dd-label' });
    const btn = h('button', { type: 'button', class: 'dd-btn', 'aria-haspopup': 'listbox' }, label,
      h('span', { class: 'dd-chev', html: '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>' }));
    const paint = () => { label.textContent = options.find(([v]) => v === cur)[1]; };
    paint();

    let hi = 0;
    // список живёт в body: .modal с overflow и backdrop-filter обрезала бы его
    const list = h('div', { class: 'dd-list', role: 'listbox' });
    const items = options.map(([v, t], i) => h('button', {
      type: 'button', class: 'dd-item', role: 'option', tabindex: '-1',
      onmousemove: () => highlight(i),
      onclick: () => pick(i),
    }, t));
    list.append(...items);
    const highlight = (i) => { hi = (i + items.length) % items.length; items.forEach((it, j) => it.classList.toggle('hi', j === hi)); };
    const pick = (i) => {
      const changed = cur !== options[i][0];
      cur = options[i][0]; paint(); close(); btn.focus();
      if (changed) onChange?.(cur);
    };

    const onOutside = (e) => { if (!list.contains(e.target) && !btn.contains(e.target)) close(); };
    // закрываем, только если кнопка правда уехала (а не пришёл запоздалый scroll от прокрутки к ней)
    let anchorAt = null;
    const moved = () => { const r = btn.getBoundingClientRect(); return !anchorAt || Math.abs(r.top - anchorAt[0]) > 2 || Math.abs(r.left - anchorAt[1]) > 2; };
    const onScroll = (e) => { if (!list.contains(e.target) && moved()) close(); };
    function open() {
      closeDropdown?.();
      const r = btn.getBoundingClientRect();
      anchorAt = [r.top, r.left];
      const below = window.innerHeight - r.bottom > options.length * 40 + 16;
      list.style.cssText = `left:${r.left}px;width:${r.width}px;` + (below ? `top:${r.bottom + 6}px` : `bottom:${window.innerHeight - r.top + 6}px`);
      items.forEach((it, i) => it.classList.toggle('sel', options[i][0] === cur));
      highlight(options.findIndex(([v]) => v === cur));
      document.body.append(list);
      requestAnimationFrame(() => list.classList.add('open'));
      btn.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      document.addEventListener("mousedown", onOutside, true);
      // список стоит fixed и не едет за прокруткой панели — закрываем, как обычный селект
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", close);
      closeDropdown = close;
    }
    function close() {
      list.classList.remove('open');
      list.remove();
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener("mousedown", onOutside, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      if (closeDropdown === close) closeDropdown = null;
    }
    const isOpen = () => list.isConnected;

    btn.addEventListener('click', () => isOpen() ? close() : open());
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen()) return open();
        highlight(hi + (e.key === 'ArrowDown' ? 1 : -1));
      } else if ((e.key === 'Enter' || e.key === ' ') && isOpen()) {
        e.preventDefault();
        pick(hi);
      } else if (e.key === 'Escape' && isOpen()) {
        e.stopPropagation(); // закрыть список, а не модалку
        close();
      }
    });
    return { el: h('div', { class: 'dd' }, btn), get: () => cur };
  }

  // ---------- выбор цвета ----------
  // Поповер у anchor: квадрат насыщенность/яркость, полоса оттенка, HEX, быстрые образцы.
  // onInput(hex) зовётся на каждое изменение — можно править вживую.
  let closePicker = null;
  const QUICK_COLORS = ['#ffffff', '#f4f3f8', '#9b8cff', '#5cc8ff', '#b4f05a', '#ffc35c', '#ff7a9c', '#ff4655', '#141418', '#000000'];

  function hexToHsv(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
    let hh = 0;
    if (d) hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (hh * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx };
  }
  function hsvToHex({ h: hh, s, v }) {
    const f = (n) => { const k = (n + hh / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  }

  function colorPicker(anchor, value, onInput) {
    closePicker?.();
    let hsv = hexToHsv(/^#[0-9a-f]{6}$/i.test(value) ? value : '#8a7cff');
    const svKnob = h('i', { class: 'cp-knob' });
    const sv = h('div', { class: 'cp-sv' }, svKnob);
    const hueKnob = h('i', { class: 'cp-knob' });
    const hue = h('div', { class: 'cp-hue' }, hueKnob);
    const swatch = h('span', { class: 'cp-swatch' });
    const hex = h('input', { type: 'text', class: 'cp-hex', maxlength: 7, spellcheck: 'false' });
    const bgColors = [...new Set(settings.bgImage ? [] : settings.mesh.points.map(p => p.color))];
    const quick = h('div', { class: 'cp-quick' }, [...bgColors, ...QUICK_COLORS.filter(c => !bgColors.includes(c))].slice(0, 18).map(c =>
      h('button', { type: 'button', title: c, style: `--c:${c}`, onclick: () => { hsv = hexToHsv(c); paint(true); } })));
    const pop = h('div', { class: 'cp' }, sv, hue, h('div', { class: 'cp-row' }, swatch, hex), quick);

    const paint = (emit) => {
      const c = hsvToHex(hsv);
      sv.style.setProperty('--hue', `hsl(${hsv.h} 100% 50%)`);
      svKnob.style.left = hsv.s * 100 + '%';
      svKnob.style.top = (1 - hsv.v) * 100 + '%';
      svKnob.style.background = c;
      hueKnob.style.left = hsv.h / 360 * 100 + '%';
      hueKnob.style.background = `hsl(${hsv.h} 100% 50%)`;
      swatch.style.background = c;
      if (document.activeElement !== hex) hex.value = c;
      if (emit) onInput(c);
    };

    const drag = (el, fn) => el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      const at = (ev) => { fn(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))); paint(true); };
      at(e);
      const up = () => { el.removeEventListener('pointermove', at); el.removeEventListener('pointerup', up); };
      el.addEventListener('pointermove', at);
      el.addEventListener('pointerup', up);
    });
    drag(sv, (x, y) => { hsv.s = x; hsv.v = 1 - y; });
    drag(hue, (x) => { hsv.h = x * 359.9; });
    hex.addEventListener('input', () => {
      let v = hex.value.trim();
      if (!v.startsWith('#')) v = '#' + v;
      if (/^#[0-9a-f]{6}$/i.test(v)) { hsv = hexToHsv(v.toLowerCase()); paint(true); }
    });

    // Esc закрывает только пикер; клик мимо — тоже
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(); } };
    const onOutside = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) close(); };
    // поповер стоит fixed — если под ним прокрутили панель или инспектор, он бы остался висеть не там
    const at0 = anchor.getBoundingClientRect();
    const onScroll = (e) => {
      if (pop.contains(e.target)) return;
      const r = anchor.getBoundingClientRect(); // закрываем, только если кнопка правда уехала
      if (Math.abs(r.top - at0.top) > 2 || Math.abs(r.left - at0.left) > 2) close();
    };
    function close() {
      pop.remove();
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener("mousedown", onOutside, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      if (closePicker === close) closePicker = null;
      if (anchor.closest?.("#settings")) panelPeek(null);
    }
    window.addEventListener('keydown', onKey, true);
    document.addEventListener("mousedown", onOutside, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    closePicker = close;
    if (anchor.closest?.("#settings")) panelPeek(anchor); // цвет из панели — тоже «подглядываем»

    document.body.append(pop);
    const a = anchor.getBoundingClientRect();
    const W = 232, H = pop.offsetHeight;
    const left = Math.min(innerWidth - W - 8, Math.max(8, a.left + a.width / 2 - W / 2));
    const top = a.bottom + 8 + H < innerHeight ? a.bottom + 8 : Math.max(8, a.top - 8 - H);
    pop.style.cssText = `left:${left}px;top:${top}px`;
    requestAnimationFrame(() => pop.classList.add('open'));
    paint(false);
  }

  function alignPicker(value, onChange) {
    let cur = normAlign(value);
    const cells = [];
    for (const v of ['top', 'middle', 'bottom']) for (const hz of ['left', 'center', 'right']) {
      const key = `${v}-${hz}`;
      cells.push(h('button', {
        type: 'button', class: 'al-cell', 'data-v': key, role: 'radio',
        title: { top: 'Сверху', middle: 'По центру', bottom: 'Снизу' }[v] + ' · ' + { left: 'слева', center: 'по центру', right: 'справа' }[hz],
        onclick: () => { const ch = cur !== key; cur = key; paint(); if (ch) onChange?.(key); },
      }, h('i')));
    }
    const paint = () => cells.forEach(c => {
      const on = c.dataset.v === cur;
      c.classList.toggle('active', on);
      c.setAttribute('aria-checked', on);
    });
    paint();
    return { el: h('div', { class: 'align-picker', role: 'radiogroup' }, cells), get: () => cur };
  }
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModal(); });

  // ---------- настройки ----------
  const panel = document.getElementById('settings');
  const panelBody = document.getElementById('settings-body');
  const fileInput = document.getElementById('file-input');

  // «подглядывание»: тянешь ползунок в панели — панель прячется, остаётся только он, и видно весь экран
  function panelPeek(el) {
    panel.querySelectorAll('.peek-path, .peek-keep').forEach(x => x.classList.remove('peek-path', 'peek-keep'));
    panel.classList.toggle('peek', !!el);
    if (!el) return;
    const keep = el.closest('.field, .row') || el;
    keep.classList.add('peek-keep');
    for (let p = keep.parentElement; p && p !== panelBody; p = p.parentElement) p.classList.add('peek-path');
  }
  panel.addEventListener('pointerdown', (e) => { if (e.target.matches('input[type=range]')) panelPeek(e.target); });
  window.addEventListener('pointerup', () => { if (panel.classList.contains('peek') && !closePicker) panelPeek(null); });

  function openSettings() { renderSettings(); panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); }
  function closeSettings() { closePicker?.(); meshPreview?.destroy(); meshPreview = null; panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }
  document.getElementById('btn-settings').addEventListener('click', () => panel.classList.contains('open') ? closeSettings() : openSettings());
  panel.querySelector('[data-close]').addEventListener('click', closeSettings);

  function setSetting(k, v, rerenderWidgets = false) {
    settings[k] = v;
    if (k === 'bgImage') sampleImage();
    applyTheme();
    saveSettings();
    if (rerenderWidgets) layout.forEach(renderWidget);
  }

  function slider(label, key, min, max, step, fmt = (v) => v) {
    const out = h('output', {}, fmt(settings[key]));
    const inp = h('input', { type: 'range', min, max, step, value: settings[key] });
    inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); setSetting(key, +inp.value); });
    return h('label', { class: 'field field-range' }, h('span', {}, label, out), inp);
  }

  // ---------- редактор фона: меш или своя картинка ----------
  let meshPreview = null;
  let meshSel = 0;
  const DEFAULT_CLEAR = () => ({ x: 0.3, y: 0.34, w: 0.4, h: 0.16 });
  function bgEditor() {
    const img = !!settings.bgImage;
    const key = img ? 'photo' : 'mesh';
    const m = look();
    if (!img) meshSel = Math.min(meshSel, m.points.length - 1);
    const r3 = (v) => +v.toFixed(3);
    const unit01 = (v) => Math.min(1, Math.max(0, v));

    const canvas = h('canvas', { class: 'mesh-canvas' });
    const clearBox = h('div', { class: 'clear-rect', title: 'Чистая область: тащи, чтобы двигать, за угол — менять размер' },
      h('i', { class: 'cr-h nw' }), h('i', { class: 'cr-h se' }));
    const dots = h('div', { class: 'mesh-dots' });
    // пропорции как у экрана — точки и область в превью стоят там же, где на фоне
    const box = h('div', { class: 'mesh-preview', style: `aspect-ratio:${innerWidth} / ${innerHeight}` }, canvas, clearBox, dots);

    // любая правка меша — это уже не заготовка
    const commit = () => {
      if (!img) {
        delete m.preset;
        panelBody.querySelectorAll('.mesh-preset.active').forEach(b => b.classList.remove('active'));
        box.style.background = Mesh.cssPreview(m);
      }
      setSetting(key, m);
      meshPreview?.set(bgParams());
    };

    // точки меша
    const tools = h('div', { class: 'row mesh-tools' });
    const paint = () => {
      if (img) return;
      dots.replaceChildren(...m.points.map((p, i) => {
        const d = h('button', {
          type: 'button', class: 'mesh-dot' + (i === meshSel ? ' sel' : ''),
          title: 'Тащи, чтобы двигать', style: `left:${p.x * 100}%;top:${p.y * 100}%;--c:${p.color}`,
        });
        d.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          d.setPointerCapture(e.pointerId);
          if (meshSel !== i) { meshSel = i; dots.querySelectorAll('.mesh-dot').forEach((x, j) => x.classList.toggle('sel', j === i)); paintTools(); }
          const r = box.getBoundingClientRect();
          const move = (ev) => {
            p.x = r3(unit01((ev.clientX - r.left) / r.width));
            p.y = r3(unit01((ev.clientY - r.top) / r.height));
            d.style.left = p.x * 100 + '%';
            d.style.top = p.y * 100 + '%';
            commit();
          };
          const up = () => { d.removeEventListener('pointermove', move); d.removeEventListener('pointerup', up); };
          d.addEventListener('pointermove', move);
          d.addEventListener('pointerup', up);
        });
        return d;
      }));
      paintTools();
    };
    const paintTools = () => {
      const p = m.points[meshSel];
      const colorBtn = h('button', {
        type: 'button', class: 'pill small mesh-color-btn', title: 'Цвет выбранной точки', style: `--c:${p.color}`,
        onclick: () => colorPicker(colorBtn, p.color, (c) => {
          p.color = c;
          commit();
          dots.children[meshSel]?.style.setProperty('--c', c);
          colorBtn.style.setProperty('--c', c);
        }),
      }, h('i'), 'Цвет');
      tools.replaceChildren(
        colorBtn,
        h('button', {
          type: 'button', class: 'pill small', disabled: m.points.length <= 2,
          onclick: () => { m.points.splice(meshSel, 1); meshSel = Math.max(0, meshSel - 1); commit(); paint(); },
        }, 'Убрать'),
        h('button', {
          type: 'button', class: 'pill small', disabled: m.points.length >= Mesh.MAX,
          onclick: () => {
            m.points.push({ x: r3(0.3 + Math.random() * 0.4), y: r3(0.3 + Math.random() * 0.4), color: Mesh.random()[1].color });
            meshSel = m.points.length - 1; commit(); paint();
          },
        }, '+ Точка'),
      );
    };

    // чистая область: двигать за тело, менять размер за углы
    const paintClear = () => {
      const c = m.clear;
      clearBox.hidden = !c;
      if (c) Object.assign(clearBox.style, { left: c.x * 100 + '%', top: c.y * 100 + '%', width: c.w * 100 + '%', height: c.h * 100 + '%' });
    };
    clearBox.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      clearBox.setPointerCapture(e.pointerId);
      const r = box.getBoundingClientRect();
      const how = e.target.classList.contains('nw') ? 'nw' : e.target.classList.contains('se') ? 'se' : 'move';
      const s = { ...m.clear }, sx = e.clientX, sy = e.clientY;
      const move = (ev) => {
        const dx = (ev.clientX - sx) / r.width, dy = (ev.clientY - sy) / r.height;
        const c = m.clear;
        if (how === 'move') {
          c.x = unit01(Math.min(s.x + dx, 1 - s.w));
          c.y = unit01(Math.min(s.y + dy, 1 - s.h));
        } else if (how === 'se') {
          c.w = Math.max(0.03, Math.min(s.w + dx, 1 - s.x));
          c.h = Math.max(0.03, Math.min(s.h + dy, 1 - s.y));
        } else {
          c.x = unit01(Math.min(s.x + dx, s.x + s.w - 0.03));
          c.y = unit01(Math.min(s.y + dy, s.y + s.h - 0.03));
          c.w = s.x + s.w - c.x;
          c.h = s.y + s.h - c.y;
        }
        for (const k of ['x', 'y', 'w', 'h']) c[k] = r3(c[k]);
        paintClear();
        commit();
      };
      const up = () => { clearBox.removeEventListener('pointermove', move); clearBox.removeEventListener('pointerup', up); };
      clearBox.addEventListener('pointermove', move);
      clearBox.addEventListener('pointerup', up);
    });
    const clearBtn = h('button', {
      type: 'button', class: 'pill small' + (m.clear ? ' on' : ''), title: 'Прямоугольник, где узора нет',
      onclick: () => {
        m.clear = m.clear ? null : DEFAULT_CLEAR();
        clearBtn.classList.toggle('on', !!m.clear);
        paintClear();
        commit();
      },
    }, 'Чистая область');

    // цвета дуотона: тени и света
    const duoBtn = (i, label) => {
      const b = h('button', {
        type: 'button', class: 'pill small mesh-color-btn', style: `--c:${m.duo[i]}`,
        onclick: () => colorPicker(b, m.duo[i], (c) => { m.duo = m.duo.map((x, j) => j === i ? c : x); b.style.setProperty('--c', c); commit(); }),
      }, h('i'), label);
      return b;
    };

    const sl = (label, k, fmt) => {
      const out = h('output', {}, fmt(m[k]));
      const inp = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: m[k] });
      inp.addEventListener('input', () => { m[k] = +inp.value; out.textContent = fmt(m[k]); commit(); });
      return h('label', { class: 'field field-range' }, h('span', {}, label, out), inp);
    };
    const pct = (v) => Math.round(v * 100) + '%';

    const mode = dropdown(Object.entries(Mesh.MODES), m.mode, (v) => { m.mode = v; commit(); renderSettings(); });
    // живые обои: анимация поверх любого узора
    const anim = dropdown(Object.entries(Mesh.ANIMS), m.anim, (v) => { m.anim = v; commit(); renderSettings(); });

    if (!img) box.style.background = Mesh.cssPreview(m);
    paint();
    paintClear();
    return h('div', { class: 'mesh-editor' }, box,
      img ? null : tools,
      h('div', { class: 'field' }, h('span', {}, 'Узор'), mode.el),
      h('div', { class: 'field' }, h('span', {}, 'Анимация'), anim.el),
      m.anim !== 'none' ? sl('Сила анимации', 'animAmt', pct) : null,
      h('div', { class: 'row' }, clearBtn, m.mode === 'duotone' ? duoBtn(0, 'Тени') : null, m.mode === 'duotone' ? duoBtn(1, 'Света') : null),
      !['mesh', 'duotone'].includes(m.mode) ? sl(m.mode === 'frosted' ? 'Мелкость стекла' : 'Плотность', 'density', pct) : null,
      sl(img ? 'Жидкость' : 'Искажение', 'warp', pct),
      sl('Скорость', 'speed', (v) => v ? pct(v) : 'стоит'),
      sl('Зерно', 'grain', pct));
  }

  // заготовки: применяются целиком (и убирают свою картинку), дальше их можно докрутить в редакторе
  function meshPresets() {
    return h('div', { class: 'mesh-presets' }, Mesh.PRESETS.map(p => {
      const src = presetThumb(p);
      return h('button', {
        type: 'button', 'data-preset': p.id, title: p.title,
        class: 'mesh-preset' + (!settings.bgImage && settings.mesh.preset === p.id ? ' active' : ''),
        style: src ? null : `background:${Mesh.cssPreview(p)}`,
        onclick: () => {
          const had = settings.bgImage;
          const { clear, duo, anim, animAmt } = settings.mesh; // своё оформление поверх заготовки сохраняем
          settings.mesh = { ...fromPreset(p), clear, duo, anim, animAmt };
          settings.bgImage = null;
          meshSel = 0;
          setSetting('mesh', settings.mesh);
          sampleImage();
          renderSettings();
          // своя картинка не пропадает молча
          if (had) toast('Картинка убрана', 'Вернуть', () => { setSetting('bgImage', had); renderSettings(); });
        },
      }, src ? h('img', { src, alt: '' }) : null, h('span', {}, p.title));
    }));
  }
  let meshOpen = false; // редактор свёрнут по умолчанию — панель и так длинная

  // Миниатюры заготовок. Каждая — свой вариант шейдера, и рисовать все 14 разом значит синхронно
  // компилировать несколько шейдеров подряд (на Windows — заметное подвисание). Поэтому рисуем по одной
  // в простое браузера и сохраняем: со второго раза они берутся из хранилища.
  const THUMBS_KEY = 'thumbs:' + Mesh.PRESETS.length + ':' + JSON.stringify(Mesh.PRESETS).length;
  const thumbs = new Map();
  Store.get(THUMBS_KEY, null).then((saved) => { if (saved) for (const k in saved) if (!thumbs.has(k)) thumbs.set(k, saved[k]); });
  const thumbQueue = [];
  function presetThumb(p) {
    if (!thumbs.has(p.id) && !thumbQueue.includes(p)) { thumbQueue.push(p); drawThumbsLater(); }
    return thumbs.get(p.id) || null;
  }
  let thumbTimer = 0;
  function drawThumbsLater() {
    if (thumbTimer) return;
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 50));
    thumbTimer = idle(() => {
      thumbTimer = 0;
      const p = thumbQueue.shift();
      if (!p) return;
      const src = Mesh.thumb(p);
      if (src) {
        thumbs.set(p.id, src);
        // подменяем в уже открытой панели
        const tile = panelBody.querySelector(`.mesh-preset[data-preset="${p.id}"]`);
        if (tile && !tile.querySelector('img')) { tile.style.background = ''; tile.prepend(h('img', { src, alt: '' })); }
      }
      if (thumbQueue.length) drawThumbsLater();
      else Store.set(THUMBS_KEY, Object.fromEntries(thumbs));
    });
  }

  // Панель — вкладками, чтобы не листать простыню: фон, эффекты, блоки, вкладка браузера, остальное
  const PANEL_TABS = [
    ['bg', 'Фон', '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M3.5 17l5-4.5 3.5 3 3-2.5 5.5 4.5"/></svg>'],
    ['fx', 'Эффекты', '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>'],
    ['blocks', 'Блоки', '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="10" rx="2"/><rect x="13" y="3" width="8" height="6" rx="2"/><rect x="13" y="11" width="8" height="10" rx="2"/><rect x="3" y="15" width="8" height="6" rx="2"/></svg>'],
    ['tab', 'Вкладка', '<svg viewBox="0 0 24 24"><path d="M3 9V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>'],
    ['more', 'Ещё', '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>'],
  ];
  let panelTab = 'bg';
  const panelTabs = h('nav', { class: 'panel-tabs', role: 'tablist' });
  panel.querySelector('.panel-head').after(panelTabs);

  function renderSettings() {
    meshPreview?.destroy();
    meshPreview = null;
    closeDropdown?.();
    panelTabs.replaceChildren(...PANEL_TABS.map(([k, label, icon]) => h('button', {
      type: 'button', class: 'panel-tab' + (panelTab === k ? ' active' : ''), role: 'tab', 'aria-selected': String(panelTab === k), 'data-ptab': k,
      onclick: () => { panelTab = k; panelBody.scrollTop = 0; renderSettings(); },
    }, h('span', { html: icon }), label)));

    const content = {
      bg: () => bgTab(),
      fx: () => [section('Эффекты поверх фона',
        fxSlider('Виньетка', 'vignette'),
        fxSlider('Свечение', 'bloom'),
        fxSlider('Частицы', 'particles'),
        fxSlider('Аберрация', 'chroma'),
        fxSlider('Сканлайны', 'scan'),
        fxToggle('Линза за курсором', 'mouse'),
        fxToggle('Оттенок по времени суток', 'daycycle'),
        h('p', { class: 'field-hint' }, 'Работают и с мешем, и со своей картинкой. Узоры и анимации — во вкладке «Фон» → «Настроить».'))],
      blocks: () => {
        const accents = h('div', { class: 'swatches' }, ACCENTS.map(c =>
          h('button', { class: 'accent-swatch' + (settings.accent === c ? ' active' : ''), style: `--c:${c}`, title: c, onclick: () => { setSetting('accent', c); renderSettings(); } })));
        return [
          section('Текст в блоках',
            h('div', { class: 'field' }, h('span', {}, 'Шрифт'), dropdown(FONTS, settings.text.font, (v) => setSetting('text', { ...settings.text, font: v })).el),
            h('div', { class: 'field' }, h('span', {}, 'Тень'), segmented(SHADOWS, settings.text.shadow, (v) => setSetting('text', { ...settings.text, shadow: v })).el),
            h('p', { class: 'field-hint' }, 'У каждого блока можно поставить своё — в его настройках, «Оформление».')),
          section('Стекло',
            slider('Размытие', 'glassBlur', 0, 40, 1, v => v + 'px'),
            slider('Плотность', 'glassAlpha', 0, 0.3, 0.01, v => Math.round(v * 100) + '%'),
            slider('Читаемость', 'glassTone', 0, 1, 0.05, v => Math.round(v * 100) + '%'),
            h('p', { class: 'field-hint' }, 'Стекло выравнивает яркость фона под собой. На пёстром фоне (и белое, и чёрное сразу) включается само.'),
            slider('Скругление', 'radius', 0, 36, 1, v => v + 'px')),
          section('Акцент', accents),
        ];
      },
      tab: () => {
        const nameInp = h('input', { type: 'text', value: settings.name, placeholder: 'Как к тебе обращаться?', 'data-setting': 'name' });
        nameInp.addEventListener('input', debounce(() => setSetting('name', nameInp.value.trim(), true), 300));
        return [
          section('Вкладка браузера', ...tabSettings()),
          section('Приветствие', h('label', { class: 'field' }, h('span', {}, 'Имя'), nameInp)),
        ];
      },
      more: () => [
        section('Раскладка',
          h('div', { class: 'row' },
            h('button', { class: 'pill small', onclick: () => { closeSettings(); setEditing(true); } }, 'Редактировать'),
            h('button', { class: 'pill small', onclick: resetLayout }, 'Сбросить')),
          h('div', { class: 'row' },
            h('button', { class: 'pill small', onclick: exportAll }, 'Экспорт'),
            h('button', { class: 'pill small', onclick: () => pickFile('application/json', importAll) }, 'Импорт'))),
        h('p', { class: 'panel-foot' }, 'Plitka 0.1 · E — редактор, / — поиск, Esc — закрыть'),
      ],
    };
    panelBody.replaceChildren(...content[panelTab]().filter(Boolean));

    // превью создаём, когда канвас уже в DOM и у него есть размер
    const mc = panelBody.querySelector('.mesh-canvas');
    if (mc) {
      meshPreview = Mesh.create(mc, { scale: 1 });
      meshPreview?.set(bgParams());
    }
  }

  // вкладка «Фон»: заготовки, своя картинка (как есть или с эффектом), редактор, слайд-шоу
  function bgTab() {
    const img = !!settings.bgImage;
    const plain = img && settings.photo.plain;
    const motion = h('input', { type: 'checkbox' });
    motion.checked = settings.motion;
    motion.addEventListener('change', () => setSetting('motion', motion.checked));

    const bgRow = h('div', { class: 'row' },
      plain ? null : h('button', {
        class: 'pill small' + (meshOpen ? ' on' : ''), 'aria-expanded': String(meshOpen),
        onclick: () => { meshOpen = !meshOpen; renderSettings(); },
      }, meshOpen ? 'Свернуть' : img ? 'Эффект картинки' : 'Настроить'),
      img ? null : h('button', {
        class: 'pill small', title: 'Случайные цвета и точки, узор тот же',
        onclick: () => { settings.mesh.points = Mesh.random(); delete settings.mesh.preset; meshSel = 0; setSetting('mesh', settings.mesh); renderSettings(); },
      }, 'Случайный'),
      h('button', { class: 'pill small', onclick: () => pickFile('image/*', loadBgImage) }, img ? 'Сменить картинку' : 'Своя картинка'),
      img ? h('button', { class: 'pill small', onclick: () => { setSetting('bgImage', null); renderSettings(); } }, 'Убрать картинку') : null,
    );

    // своя картинка: как есть или с эффектом поверх
    const photoMode = img ? h('div', { class: 'field' }, h('span', {}, 'Картинка'),
      segmented([['plain', 'Как есть'], ['fx', 'С эффектом']], plain ? 'plain' : 'fx', (v) => {
        setSetting('photo', { ...settings.photo, plain: v === 'plain' });
        sampleImage();
        renderSettings();
      }).el) : null;

    return [
      section('Фон', meshPresets(), bgRow, photoMode,
        img ? slider('Затемнение картинки', 'bgDim', 0, 0.8, 0.05, v => Math.round(v * 100) + '%') : null,
        meshOpen && !plain ? bgEditor() : null,
        h('label', { class: 'field field-toggle' }, h('span', {}, 'Живой фон'), h('span', { class: 'switch' }, motion, h('i')))),
      section('Слайд-шоу', ...slideshowSettings()),
    ];
  }

  // слайд-шоу: список фонов (свои картинки + меши/заготовки), как часто и в каком порядке менять
  function slideshowSettings() {
    const s = settings.slides;
    const setS = (patch, rerender = true) => { settings.slides = { ...settings.slides, ...patch }; saveSettings(); if (rerender) renderSettings(); };
    const on = h('input', { type: 'checkbox', 'data-slides': 'on' });
    on.checked = s.on;
    on.addEventListener('change', () => { setS({ on: on.checked }); if (on.checked && s.items.length) nextSlide(); });
    const toggle = h('label', { class: 'field field-toggle' }, h('span', {}, 'Менять фоны сами'), h('span', { class: 'switch' }, on, h('i')));

    const addCurrent = async () => {
      const id = 's' + Math.random().toString(36).slice(2, 9);
      if (settings.bgImage) {
        await Store.set('slide:' + id, settings.bgImage);
        const thumb = await new Promise((res) => {
          const im = new Image();
          im.onload = () => {
            const t = h('canvas', { width: 160, height: 100 });
            const k = Math.max(160 / im.width, 100 / im.height);
            t.getContext('2d').drawImage(im, (160 - im.width * k) / 2, (100 - im.height * k) / 2, im.width * k, im.height * k);
            res(t.toDataURL('image/jpeg', 0.8));
          };
          im.src = settings.bgImage;
        });
        setS({ items: [...settings.slides.items, { id, kind: 'image', thumb }] });
      } else {
        setS({ items: [...settings.slides.items, { id, kind: 'mesh', mesh: structuredClone(settings.mesh) }] });
      }
      toast('Фон добавлен в слайд-шоу');
    };
    const addImages = (files) => Promise.all(files.map(async (f) => {
      const { full, thumb } = await shrinkImage(f);
      const id = 's' + Math.random().toString(36).slice(2, 9);
      await Store.set('slide:' + id, full);
      return { id, kind: 'image', thumb };
    })).then((items) => { setS({ items: [...settings.slides.items, ...items] }); toast(`Добавлено: ${items.length}`); });

    const list = h('div', { class: 'slides' }, s.items.map((it, i) => h('div', { class: 'slide' + (i === s.idx ? ' current' : ''), title: i === s.idx ? 'Сейчас на экране' : 'Показать' },
      h('button', {
        type: 'button', class: 'slide-thumb', style: it.kind === 'mesh' ? `background:${Mesh.cssPreview(it.mesh)}` : null,
        onclick: () => { setS({ idx: i, at: Date.now() }); applySlide(it); },
      }, it.kind === 'image' && it.thumb ? h('img', { src: it.thumb, alt: '' }) : null),
      h('button', {
        type: 'button', class: 'slide-del', title: 'Убрать из слайд-шоу', html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        onclick: () => {
          if (it.kind === 'image') Store.remove('slide:' + it.id);
          const items = settings.slides.items.filter(x => x !== it);
          setS({ items, idx: Math.min(settings.slides.idx, items.length - 1) });
        },
      }))));

    return [
      toggle,
      s.items.length ? list : h('p', { class: 'field-hint' }, 'Выбери фон выше и добавь его сюда, или загрузи свои картинки — можно сразу несколько.'),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'pill small', onclick: addCurrent }, '+ Текущий фон'),
        h('button', { type: 'button', class: 'pill small', onclick: () => pickFile('image/*', addImages, true) }, '+ Картинки'),
        s.items.length > 1 ? h('button', { type: 'button', class: 'pill small', onclick: () => { nextSlide(); setTimeout(renderSettings, 700); } }, 'Следующий') : null),
      s.items.length > 1 ? h('div', { class: 'field' }, h('span', {}, 'Менять'),
        dropdown([['tab', 'С каждой новой вкладкой'], ['10m', 'Каждые 10 минут'], ['1h', 'Каждый час'], ['1d', 'Раз в день']], s.every, (v) => setS({ every: v }, false)).el) : null,
      s.items.length > 1 ? h('div', { class: 'field' }, h('span', {}, 'Порядок'),
        segmented([['seq', 'По порядку'], ['random', 'Случайно']], s.order, (v) => setS({ order: v }, false)).el) : null,
    ];
  }

  // секция «Вкладка»: название с подстановками и иконка — плитки с живым превью
  function tabSettings() {
    const setTab = (patch) => setSetting('tab', { ...settings.tab, ...patch });
    const title = h('input', { type: 'text', value: settings.tab.title, placeholder: 'Новая вкладка', 'data-tab': 'title' });
    title.addEventListener('input', debounce(() => setTab({ title: title.value }), 250));
    const tokens = h('div', { class: 'tab-tokens' }, 'Вставить:', ['{время}', '{дата}', '{день}'].map(tk =>
      h('button', {
        type: 'button', class: 'chip',
        // вставляем туда, где курсор, и ставим курсор после вставки
        onclick: () => {
          const a = title.selectionStart ?? title.value.length, b = title.selectionEnd ?? a;
          title.value = title.value.slice(0, a) + tk + title.value.slice(b);
          title.focus();
          title.setSelectionRange(a + tk.length, a + tk.length);
          setTab({ title: title.value });
        },
      }, tk)));

    const tiles = h('div', { class: 'tab-icons' }, TAB_ICONS.map(([k, label]) =>
      h('button', {
        type: 'button', class: 'tab-icon' + (settings.tab.icon === k ? ' active' : ''), 'data-icon': k, title: label,
        onclick: () => { setTab({ icon: k }); renderSettings(); },
      }, h('img', { src: tabIcon(k), alt: '' }), h('span', {}, label))));

    // поле под выбранный вариант
    let extra = null;
    if (settings.tab.icon === 'emoji' || settings.tab.icon === 'letter') {
      const key = settings.tab.icon;
      const inp = h('input', { type: 'text', value: settings.tab[key], maxlength: key === 'emoji' ? 8 : 2, 'data-tab': key, class: 'tab-extra' });
      inp.addEventListener('input', () => { if (inp.value.trim()) { setTab({ [key]: inp.value }); tiles.querySelector(`[data-icon="${key}"] img`).src = tabIcon(key); } });
      extra = h('label', { class: 'field field-row' }, h('span', {}, key === 'emoji' ? 'Эмодзи' : 'Буква (1–2)'), inp);
    } else if (settings.tab.icon === 'image') {
      extra = h('div', { class: 'row' }, h('button', { type: 'button', class: 'pill small', onclick: () => pickFile('image/*', loadTabImage) }, settings.tab.image ? 'Другая картинка' : 'Выбрать картинку'));
    } else if (settings.tab.icon === 'pomodoro') {
      extra = h('p', { class: 'field-hint' }, 'Пока идёт помодоро — в иконке кольцо и минуты. Нужен виджет «Помодоро».');
    }
    return [
      h('label', { class: 'field' }, h('span', {}, 'Название'), title), tokens,
      h('div', { class: 'field' }, h('span', {}, 'Иконка'), tiles), extra,
    ];
  }

  // своя иконка вкладки: ужимаем до 64×64 PNG
  function loadTabImage(file) {
    const img = new Image();
    img.onload = () => {
      const c = h('canvas', { width: 64, height: 64 });
      const k = Math.max(64 / img.width, 64 / img.height); // заполнить квадрат
      c.getContext('2d').drawImage(img, (64 - img.width * k) / 2, (64 - img.height * k) / 2, img.width * k, img.height * k);
      URL.revokeObjectURL(img.src);
      setSetting('tab', { ...settings.tab, image: c.toDataURL('image/png') });
      renderSettings();
    };
    img.src = URL.createObjectURL(file);
  }

  // эффекты поверх любого фона
  function setFx(k, v) {
    settings.fx = { ...settings.fx, [k]: v };
    setSetting('fx', settings.fx);
    meshPreview?.set(bgParams());
  }
  function fxSlider(label, k) {
    const fmt = (v) => v ? Math.round(v * 100) + '%' : 'нет';
    const out = h('output', {}, fmt(settings.fx[k]));
    const inp = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: settings.fx[k], 'data-fx': k });
    inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); setFx(k, +inp.value); });
    return h('label', { class: 'field field-range' }, h('span', {}, label, out), inp);
  }
  function fxToggle(label, k) {
    const inp = h('input', { type: 'checkbox', 'data-fx': k });
    inp.checked = !!settings.fx[k];
    inp.addEventListener('change', () => setFx(k, inp.checked));
    return h('label', { class: 'field field-toggle' }, h('span', {}, label), h('span', { class: 'switch' }, inp, h('i')));
  }

  function section(title, ...children) {
    return h('section', { class: 'panel-sec' }, h('h4', {}, title), ...children);
  }

  function pickFile(accept, cb, multiple = false) {
    fileInput.accept = accept;
    fileInput.multiple = multiple;
    fileInput.value = '';
    fileInput.onchange = () => fileInput.files.length && cb(multiple ? [...fileInput.files] : fileInput.files[0]);
    fileInput.click();
  }

  // картинка → { full: JPEG до 2560px (чтобы не раздувать хранилище), thumb: 160×100 для списков }
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 2560 / Math.max(img.width, img.height));
        const c = h('canvas', { width: Math.round(img.width * k), height: Math.round(img.height * k) });
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const t = h('canvas', { width: 160, height: 100 });
        const s = Math.max(160 / img.width, 100 / img.height);
        t.getContext('2d').drawImage(img, (160 - img.width * s) / 2, (100 - img.height * s) / 2, img.width * s, img.height * s);
        URL.revokeObjectURL(img.src);
        resolve({ full: c.toDataURL('image/jpeg', 0.88), thumb: t.toDataURL('image/jpeg', 0.8) });
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function loadBgImage(file) {
    const { full } = await shrinkImage(file);
    setSetting('bgImage', full);
    meshOpen = true; // сразу показываем эффекты картинки
    renderSettings();
  }

  // ---------- слайд-шоу: свои картинки и фоны вперемешку ----------
  // Картинки лежат отдельными ключами slide:<id>, в настройках — только превью.
  const SLIDE_EVERY = { tab: 0, '10m': 6e5, '1h': 36e5, '1d': 864e5 }; // ключи — SLIDE_EVERY_KEYS наверху
  async function applySlide(item, fade = true) {
    let image = null;
    if (item.kind === 'image') {
      image = await Store.get('slide:' + item.id, null);
      if (!image) return;
    }
    const go = () => {
      if (item.kind === 'image') settings.bgImage = image;
      else {
        const { clear, duo, anim, animAmt } = settings.mesh; // своё оформление поверх фона слайда сохраняем
        settings.mesh = { ...cleanMesh(item.mesh), clear, duo, anim, animAmt };
        settings.bgImage = null;
      }
      applyTheme();
      sampleImage();
      saveSettings();
    };
    if (!fade || !document.body.classList.contains('mesh-on')) return go();
    // плавная смена: гасим фон, меняем, проявляем
    document.body.classList.add('bg-fade');
    setTimeout(() => { go(); setTimeout(() => document.body.classList.remove('bg-fade'), 180); }, 450);
  }
  function nextSlide(fade = true) {
    const s = settings.slides;
    if (!s.items.length) return;
    let i = s.order === 'random' && s.items.length > 1
      ? (s.idx + 1 + Math.floor(Math.random() * (s.items.length - 1))) % s.items.length // любой, кроме текущего
      : (s.idx + 1) % s.items.length;
    settings.slides = { ...s, idx: i, at: Date.now() };
    saveSettings();
    applySlide(settings.slides.items[i], fade);
  }
  // при открытии вкладки: пора — следующий слайд, нет — показываем текущий, если фон с ним разошёлся
  function slideshowOnLoad() {
    const s = settings.slides;
    if (!s.on || !s.items.length) return;
    if (!s.at || Date.now() - s.at >= SLIDE_EVERY[s.every]) nextSlide(false);
  }
  setInterval(() => {
    const s = settings.slides;
    if (s.on && s.items.length > 1 && s.every !== 'tab' && !document.hidden && Date.now() - s.at >= SLIDE_EVERY[s.every]) nextSlide();
  }, 30000);

  function resetLayout() {
    unmountAll();
    ({ widgets: layout, layouts } = defaultState());
    layout.forEach(fillDefaults);
    mountAll();
    saveLayout();
    toast('Раскладка сброшена на всех экранах');
  }

  function exportAll() {
    const data = { app: 'plitka', v: 2, settings, widgets: stripGeom(layout), layouts };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'plitka-backup.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importAll(file) {
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error('too big');
      const d = JSON.parse(await file.text());
      if (!d || d.app !== 'plitka') throw new Error('not a plitka file');
      const src = d.widgets ? d : fromLegacy(d.layout); // v1: один общий layout
      const st = cleanState(src.widgets, src.layouts);
      if (!st) throw new Error('no widgets');
      await Store.set('settings', cleanSettings(d.settings));
      await Store.set('widgets', stripGeom(st.widgets));
      await Store.set('layouts', st.layouts);
      await Store.remove('layout');
      location.reload();
    } catch (e) {
      console.info('[import]', e.message);
      toast('Это не мой бэкап, не могу прочитать');
    }
  }

  // ---------- тосты ----------
  function toast(text, actionText, action) {
    const t = h('div', { class: 'toast' }, h('span', {}, text),
      actionText ? h('button', { class: 'toast-btn', onclick: () => { action(); t.remove(); } }, actionText) : null);
    document.body.append(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, actionText ? 5000 : 2500);
  }

  // ---------- клавиатура ----------
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest('input, textarea, select, [contenteditable]');
    if (e.key === 'Escape') {
      if (modal.classList.contains('open')) return closeModal();
      if (panel.classList.contains('open')) return closeSettings();
      if (editing) return setEditing(false);
      if (typing) e.target.blur();
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || modal.classList.contains('open') || closeInspector) return;
    if (e.key === 'e' || e.key === 'E' || e.key === 'у' || e.key === 'У') { e.preventDefault(); setEditing(!editing); }
    if (e.key === '/') {
      const s = document.querySelector('[data-search]');
      if (s) { e.preventDefault(); s.focus(); }
    }
  });

  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  slideshowOnLoad(); // после всего: слайд-шоу само решит, пора ли сменить фон
  requestAnimationFrame(() => document.body.classList.remove('is-loading'));
  window.__plitka = { grid, get layout() { return layout; }, get layouts() { return layouts; }, get bucket() { return bucket; }, settings: () => settings, setEditing };
})();
