(async () => {
  const COLS = 24;
  const ROWS = 12;
  const MARGIN = 6;
  const PAD = 14; // отступ сетки от краёв экрана

  const BACKGROUNDS = {
    aurora: 'Аврора',
    dusk: 'Закат',
    lagoon: 'Лагуна',
    forest: 'Лес',
    mono: 'Графит',
  };
  const ACCENTS = ['#9b8cff', '#5cc8ff', '#b4f05a', '#ff7a9c', '#ffc35c', '#f2f2f2'];

  const DEFAULT_SETTINGS = {
    name: '',
    bg: 'aurora',
    bgImage: null,
    bgDim: 0.35,
    accent: ACCENTS[0],
    glassBlur: 22,
    glassAlpha: 0.08,
    radius: 22,
    motion: true,
  };

  const DEFAULT_LAYOUT = [
    { id: 'w-clock', type: 'clock', x: 6, y: 2, w: 12, h: 4 },
    { id: 'w-search', type: 'search', x: 6, y: 6, w: 12, h: 1 },
    { id: 'w-links', type: 'links', x: 6, y: 8, w: 12, h: 2 },
    { id: 'w-weather', type: 'weather', x: 0, y: 0, w: 6, h: 2 },
    { id: 'w-notes', type: 'notes', x: 19, y: 0, w: 5, h: 6 },
  ];

  let settings = { ...DEFAULT_SETTINGS, ...(await Store.get('settings', {})) };
  let layout = await Store.get('layout', null);
  if (!Array.isArray(layout) || !layout.length) layout = structuredClone(DEFAULT_LAYOUT);
  layout.forEach(fillDefaults);

  function fillDefaults(item) {
    const def = Widgets[item.type];
    item.data = { ...structuredClone(def.defaults), ...(item.data || {}) };
  }

  // ---------- тема ----------
  function applyTheme() {
    const r = document.documentElement.style;
    r.setProperty('--accent', settings.accent);
    r.setProperty('--glass-blur', settings.glassBlur + 'px');
    r.setProperty('--glass-alpha', settings.glassAlpha);
    r.setProperty('--radius', settings.radius + 'px');
    r.setProperty('--bg-dim', settings.bgDim);
    document.body.dataset.bg = settings.bg;
    document.body.classList.toggle('has-image', !!settings.bgImage);
    document.body.classList.toggle('no-motion', !settings.motion);
    document.querySelector('#bg .bg-image').style.backgroundImage = settings.bgImage ? `url("${settings.bgImage}")` : '';
  }
  applyTheme();

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

  const saveLayout = debounce(() => Store.set('layout', layout), 250);
  const saveSettings = debounce(() => Store.set('settings', settings), 250);

  function ctxFor(item) {
    return {
      settings: () => settings,
      save: saveLayout,
      rerender: () => renderWidget(item),
      modal: openModal,
    };
  }

  function renderWidget(item) {
    const rec = live.get(item.id);
    if (!rec) return;
    rec.inst?.destroy?.();
    rec.body.replaceChildren();
    rec.shell.classList.toggle('glass', !!item.data.glass);
    rec.shell.dataset.type = item.type;
    rec.inst = Widgets[item.type].render(rec.body, item.data, ctxFor(item)) || null;
  }

  function mountWidget(item, autoPosition = false) {
    const def = Widgets[item.type];
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

  grid.batchUpdate();
  layout.forEach((it) => mountWidget(it));
  grid.batchUpdate(false);

  grid.on('change', (_e, nodes) => {
    for (const n of nodes || []) {
      const it = layout.find(i => i.id === n.id);
      if (it) Object.assign(it, { x: n.x, y: n.y, w: n.w, h: n.h });
    }
    saveLayout();
  });

  window.addEventListener('resize', debounce(() => {
    grid.cellHeight(cellH());
    drawGuides();
  }, 80));

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
    editing = on;
    document.body.classList.toggle('editing', on);
    grid.setStatic(!on);
    if (on) drawGuides();
    else closeAddMenu();
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
    const item = { id: 'w-' + Math.random().toString(36).slice(2, 9), type, w: def.size.w, h: def.size.h };
    fillDefaults(item);
    if (!grid.willItFit({ w: item.w, h: item.h })) {
      item.w = def.min.w; item.h = def.min.h;
      if (!grid.willItFit({ w: item.w, h: item.h })) { toast('Места нет — освободи немного'); return; }
    }
    layout.push(item);
    const el = mountWidget(item, true);
    const n = el.gridstackNode;
    Object.assign(item, { x: n.x, y: n.y, w: n.w, h: n.h });
    saveLayout();
    el.classList.add('just-added');
    setTimeout(() => el.classList.remove('just-added'), 900);
  }

  function removeWidget(item) {
    const rec = live.get(item.id);
    if (!rec) return;
    rec.inst?.destroy?.();
    grid.removeWidget(rec.el);
    live.delete(item.id);
    layout = layout.filter(i => i.id !== item.id);
    saveLayout();
    toast(`«${Widgets[item.type].title}» удалён`, 'Вернуть', () => {
      layout.push(item);
      mountWidget(item);
      saveLayout();
    });
  }

  function openWidgetSettings(item) {
    const def = Widgets[item.type];
    openModal({
      title: def.title,
      fields: def.settings.map(s => ({ ...s, value: structuredClone(item.data[s.key]) })),
      submit: 'Сохранить',
      onSubmit: (v) => {
        Object.assign(item.data, v);
        saveLayout();
        renderWidget(item);
      },
    });
  }

  // ---------- модалка ----------
  const modal = document.getElementById('modal');
  const modalForm = document.getElementById('modal-form');

  function openModal({ title, fields, submit = 'OK', onSubmit }) {
    document.getElementById('modal-title').textContent = title;
    modalForm.replaceChildren();
    const getters = {};
    for (const f of fields) {
      const id = 'f-' + f.key;
      let control;
      if (f.type === 'toggle') {
        const inp = h('input', { type: 'checkbox', id });
        inp.checked = !!f.value;
        control = h('label', { class: 'field field-toggle', for: id }, h('span', {}, f.label), h('span', { class: 'switch' }, inp, h('i')));
        getters[f.key] = () => inp.checked;
      } else if (f.type === 'select') {
        const sel = h('select', { id }, f.options.map(([v, t]) => h('option', { value: v }, t)));
        sel.value = f.value ?? f.options[0][0];
        control = h('label', { class: 'field', for: id }, h('span', {}, f.label), sel);
        getters[f.key] = () => sel.value;
      } else if (f.type === 'links') {
        const list = structuredClone(f.value || []);
        const box = h('div', { class: 'links-editor' });
        const paint = () => {
          box.replaceChildren(...list.map((l, i) => h('div', { class: 'le-row' },
            h('span', { class: 'le-ico' }, favicon(l.url, l.title, 32)),
            h('input', { type: 'text', value: l.title, placeholder: hostOf(l.url), oninput: (e) => { l.title = e.target.value; } }),
            h('input', { type: 'text', value: l.url, class: 'le-url', oninput: (e) => { l.url = e.target.value; } }),
            h('button', { type: 'button', class: 'tool', title: 'Выше', disabled: i === 0, onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; paint(); }, html: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>' }),
            h('button', { type: 'button', class: 'tool danger', title: 'Удалить', onclick: () => { list.splice(i, 1); paint(); }, html: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>' }),
          )), h('button', { type: 'button', class: 'pill small', onclick: () => { list.push({ title: '', url: 'https://' }); paint(); box.querySelector('.le-row:last-of-type .le-url')?.focus(); } }, '+ Ссылка'));
        };
        paint();
        control = h('div', { class: 'field field-block' }, h('span', {}, f.label), box);
        getters[f.key] = () => list.filter(l => l.url && l.url !== 'https://').map(l => ({ title: l.title.trim(), url: normalizeUrl(l.url) }));
      } else {
        const inp = h('input', { type: 'text', id, placeholder: f.placeholder || '', required: f.required });
        inp.value = f.value ?? '';
        control = h('label', { class: 'field', for: id }, h('span', {}, f.label), inp);
        getters[f.key] = () => inp.value;
      }
      modalForm.append(control);
    }
    modalForm.append(h('div', { class: 'modal-actions' },
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
    setTimeout(() => modalForm.querySelector('input[type=text], select')?.focus(), 30);
  }
  function closeModal() { modal.classList.remove('open'); }
  modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeModal(); });

  // ---------- настройки ----------
  const panel = document.getElementById('settings');
  const panelBody = document.getElementById('settings-body');
  const fileInput = document.getElementById('file-input');

  function openSettings() { renderSettings(); panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); }
  function closeSettings() { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }
  document.getElementById('btn-settings').addEventListener('click', () => panel.classList.contains('open') ? closeSettings() : openSettings());
  panel.querySelector('[data-close]').addEventListener('click', closeSettings);

  function setSetting(k, v, rerenderWidgets = false) {
    settings[k] = v;
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

  function renderSettings() {
    const nameInp = h('input', { type: 'text', value: settings.name, placeholder: 'Как к тебе обращаться?' });
    nameInp.addEventListener('input', debounce(() => setSetting('name', nameInp.value.trim(), true), 300));

    const bgs = h('div', { class: 'swatches bg-swatches' }, Object.entries(BACKGROUNDS).map(([k, t]) =>
      h('button', {
        class: 'bg-swatch' + (settings.bg === k && !settings.bgImage ? ' active' : ''), 'data-bg': k, title: t,
        onclick: () => { settings.bgImage = null; setSetting('bg', k); renderSettings(); },
      }, h('span', {}, t))));

    const imgRow = h('div', { class: 'row' },
      h('button', { class: 'pill small', onclick: () => pickFile('image/*', loadBgImage) }, settings.bgImage ? 'Сменить картинку' : 'Своя картинка'),
      settings.bgImage ? h('button', { class: 'pill small', onclick: () => { setSetting('bgImage', null); renderSettings(); } }, 'Убрать') : null,
    );

    const accents = h('div', { class: 'swatches' }, ACCENTS.map(c =>
      h('button', { class: 'accent-swatch' + (settings.accent === c ? ' active' : ''), style: `--c:${c}`, title: c, onclick: () => { setSetting('accent', c); renderSettings(); } })));

    const motion = h('input', { type: 'checkbox' });
    motion.checked = settings.motion;
    motion.addEventListener('change', () => setSetting('motion', motion.checked));

    panelBody.replaceChildren(
      section('Ты',
        h('label', { class: 'field' }, h('span', {}, 'Имя для приветствия'), nameInp)),
      section('Фон', bgs, imgRow,
        settings.bgImage ? slider('Затемнение картинки', 'bgDim', 0, 0.8, 0.05, v => Math.round(v * 100) + '%') : null,
        h('label', { class: 'field field-toggle' }, h('span', {}, 'Живой фон'), h('span', { class: 'switch' }, motion, h('i')))),
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
      renderSettings();
    };
    img.src = URL.createObjectURL(file);
  }

  function resetLayout() {
    for (const rec of live.values()) rec.inst?.destroy?.();
    live.clear();
    grid.removeAll();
    layout = structuredClone(DEFAULT_LAYOUT);
    layout.forEach(fillDefaults);
    grid.batchUpdate();
    layout.forEach((it) => mountWidget(it));
    grid.batchUpdate(false);
    saveLayout();
    toast('Раскладка сброшена');
  }

  function exportAll() {
    const blob = new Blob([JSON.stringify({ app: 'plitka', v: 1, settings, layout }, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'plitka-backup.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importAll(file) {
    try {
      const d = JSON.parse(await file.text());
      if (d.app !== 'plitka') throw new Error('not a plitka file');
      await Store.set('settings', d.settings);
      await Store.set('layout', d.layout);
      location.reload();
    } catch (e) {
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
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
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
  window.__plitka = { grid, get layout() { return layout; }, settings: () => settings, setEditing };
})();
