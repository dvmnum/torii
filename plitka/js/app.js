(async () => {
  const COLS = 24;
  const ROWS = 12;
  const MARGIN = 6;
  const PAD = 14; // отступ сетки от краёв экрана

  const ACCENTS = ['#9b8cff', '#5cc8ff', '#b4f05a', '#ff7a9c', '#ffc35c', '#f2f2f2'];

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
    clear: { x: 0.3, y: 0.34, w: 0.4, h: 0.16 }, duo: DEFAULT_DUO,
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
    radius: 22,
    motion: true,
    mesh: DEFAULT_MESH,
    photo: DEFAULT_PHOTO,
    fx: Mesh.FX_DEFAULTS,
  };

  // оформление, общее для всех виджетов: цвет текста и подложки
  const STYLE_DEFAULTS = { ink: 'auto', tint: null };
  const STYLE_SETTINGS = [
    { key: 'ink', label: 'Текст', type: 'select', options: [['auto', 'Авто'], ['light', 'Светлый'], ['dark', 'Тёмный']] },
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
  }

  // ---------- тема ----------
  function applyTheme() {
    const r = document.documentElement.style;
    r.setProperty('--accent', settings.accent);
    r.setProperty('--glass-blur', settings.glassBlur + 'px');
    r.setProperty('--glass-alpha', settings.glassAlpha);
    r.setProperty('--radius', settings.radius + 'px');
    r.setProperty('--bg-dim', settings.bgDim);
    document.body.classList.toggle('has-image', !!settings.bgImage);
    document.body.classList.toggle('no-motion', !settings.motion);
    document.querySelector('#bg .bg-image').style.backgroundImage = settings.bgImage ? `url("${settings.bgImage}")` : '';
    applyMesh();
    // фон поменялся — пересчитать «авто»-цвет текста у блоков (после инициализации сетки)
    setTimeout(refreshInk, 60);
  }

  // Живой фон на WebGL — и для меша, и для своей картинки (она становится текстурой, узоры работают поверх).
  // Без WebGL: CSS-градиенты из точек меша или обычная картинка (.bg-image).
  let meshBg = null;
  const look = () => settings.bgImage ? settings.photo : settings.mesh; // что сейчас редактируем
  function bgParams() {
    const p = settings.bgImage
      ? { ...settings.photo, image: settings.bgImage, dim: settings.bgDim, fx: settings.fx }
      : { ...settings.mesh, fx: settings.fx };
    // «Живой фон» выключен — всё стоит на месте, включая частицы
    return settings.motion ? p : { ...p, speed: 0, fx: { ...p.fx, still: true } };
  }
  function applyMesh() {
    const bg = document.getElementById('bg');
    bg.style.setProperty('--grain', look().grain * 0.4);
    bg.style.background = settings.bgImage ? '' : Mesh.cssPreview(settings.mesh);
    meshBg ??= Mesh.create(document.getElementById('bg-mesh'), { onReady: () => document.body.classList.add('mesh-on') });
    meshBg?.set(bgParams());
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
  function lumUnder(el) {
    const r = el.getBoundingClientRect();
    let sum = 0;
    for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.2, 0.5, 0.8]) {
      sum += bgLum((r.left + r.width * fx) / innerWidth, (r.top + r.height * fy) / innerHeight);
    }
    return sum / 9;
  }
  const hexLum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };

  function applyInk(item) {
    const rec = live.get(item.id);
    if (!rec) return;
    let dark = item.data.ink === 'dark';
    if (item.data.ink === 'auto') {
      let l = lumUnder(rec.el);
      if (item.data.glass && item.data.tint) l = 0.35 * l + 0.65 * hexLum(item.data.tint);
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
  for (const [type, def] of Object.entries(Widgets)) {
    addMenu.append(h('button', { class: 'add-item', onclick: () => { addWidget(type); closeAddMenu(); } }, def.title));
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
          )), h('button', { type: 'button', class: 'pill small', onclick: () => { list.push({ title: '', url: 'https://' }); paint(); box.querySelector('.le-row:last-of-type .le-url')?.focus(); } }, '+ Ссылка'));
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
    function open() {
      closeDropdown?.();
      const r = btn.getBoundingClientRect();
      const below = window.innerHeight - r.bottom > options.length * 40 + 16;
      list.style.cssText = `left:${r.left}px;width:${r.width}px;` + (below ? `top:${r.bottom + 6}px` : `bottom:${window.innerHeight - r.top + 6}px`);
      items.forEach((it, i) => it.classList.toggle('sel', options[i][0] === cur));
      highlight(options.findIndex(([v]) => v === cur));
      document.body.append(list);
      requestAnimationFrame(() => list.classList.add('open'));
      btn.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      document.addEventListener('mousedown', onOutside, true);
      closeDropdown = close;
    }
    function close() {
      list.classList.remove('open');
      list.remove();
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', onOutside, true);
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
    function close() {
      pop.remove();
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onOutside, true);
      if (closePicker === close) closePicker = null;
      if (anchor.closest?.("#settings")) panelPeek(null);
    }
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onOutside, true);
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

  // миниатюры пресетов рисуются WebGL один раз и кэшируются
  const thumbs = new Map();
  function presetThumb(p) {
    if (!thumbs.has(p.id)) thumbs.set(p.id, Mesh.thumb(p));
    return thumbs.get(p.id);
  }

  function renderSettings() {
    meshPreview?.destroy();
    meshPreview = null;
    const nameInp = h('input', { type: 'text', value: settings.name, placeholder: 'Как к тебе обращаться?' });
    nameInp.addEventListener('input', debounce(() => setSetting('name', nameInp.value.trim(), true), 300));

    const img = !!settings.bgImage;
    const bgRow = h('div', { class: 'row' },
      h('button', {
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

    const accents = h('div', { class: 'swatches' }, ACCENTS.map(c =>
      h('button', { class: 'accent-swatch' + (settings.accent === c ? ' active' : ''), style: `--c:${c}`, title: c, onclick: () => { setSetting('accent', c); renderSettings(); } })));

    const motion = h('input', { type: 'checkbox' });
    motion.checked = settings.motion;
    motion.addEventListener('change', () => setSetting('motion', motion.checked));

    panelBody.replaceChildren(
      section('Ты',
        h('label', { class: 'field' }, h('span', {}, 'Имя для приветствия'), nameInp)),
      section('Фон', meshPresets(), bgRow,
        img ? slider('Затемнение картинки', 'bgDim', 0, 0.8, 0.05, v => Math.round(v * 100) + '%') : null,
        meshOpen ? bgEditor() : null,
        h('label', { class: 'field field-toggle' }, h('span', {}, 'Живой фон'), h('span', { class: 'switch' }, motion, h('i')))),
      section('Эффекты',
        fxSlider('Виньетка', 'vignette'),
        fxSlider('Свечение', 'bloom'),
        fxSlider('Частицы', 'particles'),
        fxSlider('Аберрация', 'chroma'),
        fxSlider('Сканлайны', 'scan'),
        fxToggle('Линза за курсором', 'mouse'),
        fxToggle('Оттенок по времени суток', 'daycycle')),
      section('Стекло',
        slider('Размытие', 'glassBlur', 0, 40, 1, v => v + 'px'),
        slider('Плотность', 'glassAlpha', 0, 0.3, 0.01, v => Math.round(v * 100) + '%'),
        slider('Скругление', 'radius', 0, 36, 1, v => v + 'px')),
      section('Акцент', accents),
      section('Раскладка',
        h('div', { class: 'row' },
          h('button', { class: 'pill small', onclick: () => { closeSettings(); setEditing(true); } }, 'Редактировать'),
          h('button', { class: 'pill small', onclick: resetLayout }, 'Сбросить')),
        h('div', { class: 'row' },
          h('button', { class: 'pill small', onclick: exportAll }, 'Экспорт'),
          h('button', { class: 'pill small', onclick: () => pickFile('application/json', importAll) }, 'Импорт'))),
      h('p', { class: 'panel-foot' }, 'Plitka 0.1 · E — редактор, / — поиск'),
    );
    // превью создаём, когда канвас уже в DOM и у него есть размер
    const mc = panelBody.querySelector('.mesh-canvas');
    if (mc) {
      meshPreview = Mesh.create(mc, { scale: 1 });
      meshPreview?.set(bgParams());
    }
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

  function pickFile(accept, cb) {
    fileInput.accept = accept;
    fileInput.value = '';
    fileInput.onchange = () => fileInput.files[0] && cb(fileInput.files[0]);
    fileInput.click();
  }

  function loadBgImage(file) {
    const img = new Image();
    img.onload = () => {
      // ужимаем до 2560px по длинной стороне, чтобы не раздувать хранилище
      const k = Math.min(1, 2560 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      setSetting('bgImage', c.toDataURL('image/jpeg', 0.88));
      URL.revokeObjectURL(img.src);
      meshOpen = true; // сразу показываем эффекты картинки
      renderSettings();
    };
    img.src = URL.createObjectURL(file);
  }

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

  requestAnimationFrame(() => document.body.classList.remove('is-loading'));
  window.__plitka = { grid, get layout() { return layout; }, get layouts() { return layouts; }, get bucket() { return bucket; }, settings: () => settings, setEditing };
})();
