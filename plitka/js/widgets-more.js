// Вторая партия виджетов. Подключается после widgets.js и дописывает реестр Widgets.
// Общие хелперы (h, favicon, hostOf, Store, GLASS_SETTING, ICONS) — из widgets.js / store.js.

// Заголовок и иконка вкладки. Виджет может временно их «занять» (помодоро), остальное рисует app.js по настройкам.
const Tab = {
  override: null, // текст заголовка поверх настроенного
  pomo: null,     // { progress, phase, min } — для иконки-помодоро
  set(title, pomo = null) { this.override = title; this.pomo = pomo; this.update(); },
  update() {},    // подменяет app.js
};

const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayIndex = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
const plural = (n, [one, few, many]) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
};
const uid = () => Math.random().toString(36).slice(2, 9);
const SVG = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" stroke-width="3"/></svg>',
  reset: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/></svg>',
  skip: '<svg viewBox="0 0 24 24"><path d="M6 5.5v13l9-6.5zM18 5v14"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  more: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5"/></svg>',
};

// Необязательные разрешения: спрашиваем по клику (нужен жест пользователя), без них виджет показывает кнопку
// p — одно разрешение или список. ask() зовём синхронно из клика (иначе браузер не покажет запрос);
// onError — если браузер отказал не пользователем, а ошибкой (например, расширение не перезагружено после правки manifest)
const Perm = {
  has: (p) => chrome.permissions?.contains ? chrome.permissions.contains({ permissions: [].concat(p) }) : Promise.resolve(false),
  ask: (p, onError) => {
    if (!chrome.permissions?.request) { onError?.('Браузер не умеет выдавать доступ расширениям'); return Promise.resolve(false); }
    return chrome.permissions.request({ permissions: [].concat(p) }).catch((e) => {
      console.warn('[plitka] доступ не выдан:', e?.message);
      onError?.(/manifest/i.test(e?.message || '') ? 'Обнови расширение в chrome://extensions (↻) и попробуй ещё раз' : 'Браузер не дал доступ');
      return false;
    });
  },
};
function permGate(body, perm, text, ctx) {
  body.append(h('div', { class: 'w-empty' },
    h('div', { class: 'w-muted' }, text),
    h('button', { type: 'button', class: 'pill small', onclick: async () => {
      const ok = await Perm.ask(perm, ctx.toast);
      if (ok) ctx.rerender();
    } }, 'Разрешить'),
  ));
}

// сайты плитками — как в «Ссылках»
// Строка закладок браузера. У Chrome это папка с folderType 'bookmarks-bar' (раньше — просто первая в дереве).
const Bookmarks = {
  available: () => !!chrome.bookmarks?.getTree,
  bar: () => new Promise((resolve) => chrome.bookmarks.getTree((tree) => {
    const root = tree[0];
    const bar = root.children.find(c => c.folderType === 'bookmarks-bar') || root.children[0];
    resolve(bar?.children || []);
  })),
  // плоский список ссылок: прямые закладки и первый уровень папок
  flat: async () => (await Bookmarks.bar()).flatMap(n => n.url ? [n] : (n.children || []).filter(c => c.url)),
};
const FOLDER_SVG = '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor" fill-opacity=".2"/><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

// содержимое папки — всплывающим списком у кнопки; вложенные папки раскрываются внутри
let closeBmPop = null;
function openBookmarkFolder(anchor, node, newTab) {
  closeBmPop?.();
  const item = (n) => n.url
    ? h('a', { class: 'bm-item', href: n.url, target: newTab ? '_blank' : null, rel: 'noopener', title: n.url },
      h('span', { class: 'bm-ico' }, favicon(n.url, n.title, 32)), h('span', { class: 'bm-title', translate: 'no' }, n.title || hostOf(n.url)))
    : (() => {
      const sub = h('div', { class: 'bm-sub', hidden: true }, (n.children || []).map(item));
      const btn = h('button', { type: 'button', class: 'bm-item bm-folder', onclick: () => { sub.hidden = !sub.hidden; btn.classList.toggle('open', !sub.hidden); } },
        h('span', { class: 'bm-ico', html: FOLDER_SVG }), h('span', { class: 'bm-title', translate: 'no' }, n.title || 'Папка'));
      return h('div', {}, btn, sub);
    })();
  const pop = h('div', { class: 'bm-pop' }, (node.children || []).length ? node.children.map(item) : h('div', { class: 'w-muted bm-empty' }, 'Папка пустая'));
  document.body.append(pop);
  const a = anchor.getBoundingClientRect();
  const W = pop.offsetWidth, H = Math.min(pop.offsetHeight, innerHeight - 24);
  pop.style.left = Math.min(innerWidth - W - 12, Math.max(12, a.left)) + 'px';
  pop.style.top = (a.bottom + 8 + H < innerHeight ? a.bottom + 8 : Math.max(12, a.top - 8 - H)) + 'px';
  requestAnimationFrame(() => pop.classList.add('open'));
  const at0 = a.top;
  const onDown = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) close(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); } };
  const onScroll = (e) => { if (!pop.contains(e.target) && Math.abs(anchor.getBoundingClientRect().top - at0) > 2) close(); };
  function close() {
    pop.remove();
    document.removeEventListener('mousedown', onDown, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', onScroll, true);
    if (closeBmPop === close) closeBmPop = null;
  }
  document.addEventListener('mousedown', onDown, true);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', onScroll, true);
  closeBmPop = close;
}

function linkTiles(list, data) {
  return h('div', { class: `w-links style-${data.style} icons-${data.icons || 'glass'} gap-${data.gap || 'auto'}` }, list.map(l => linkEl(l, data)));
}

Object.assign(Widgets, {
  todo: {
    title: 'Список дел',
    size: { w: 5, h: 5 }, min: { w: 3, h: 2 },
    defaults: { glass: true, title: 'Дела', items: [] },
    settings: [{ key: 'title', label: 'Заголовок', type: 'text' }, GLASS_SETTING],
    render(body, data, ctx) {
      const list = h('ul', { class: 'todo-list' });
      const input = h('input', { type: 'text', class: 'todo-new', placeholder: 'Новая задача — Enter', spellcheck: 'false' });
      const clear = h('button', { type: 'button', class: 'todo-clear' }, 'Убрать сделанные');
      const count = h('span', { class: 'todo-count' });
      let dragId = null;
      const save = () => { ctx.save(); paint(); };

      const edit = (it, span) => {
        const inp = h('input', { type: 'text', class: 'todo-edit', value: it.text });
        span.replaceWith(inp);
        inp.focus();
        inp.select();
        const done = (ok) => { if (ok && inp.value.trim()) it.text = inp.value.trim(); save(); };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') { e.stopPropagation(); done(false); } });
        inp.addEventListener('blur', () => done(true));
      };

      function paint() {
        // несделанные сверху, сделанные — вниз и зачёркнуты
        const items = [...data.items.filter(i => !i.done), ...data.items.filter(i => i.done)];
        list.replaceChildren(...items.map(it => {
          const text = h('span', { class: 'todo-text', title: 'Двойной клик — изменить', translate: 'no' }, it.text);
          text.addEventListener('dblclick', () => edit(it, text));
          const li = h('li', { class: 'todo-item' + (it.done ? ' done' : ''), draggable: it.done ? null : 'true' },
            h('button', { type: 'button', class: 'todo-check', 'aria-label': it.done ? 'Вернуть' : 'Готово', onclick: () => { it.done = !it.done; save(); } }),
            text,
            h('button', { type: 'button', class: 'todo-del', title: 'Удалить', html: SVG.x, onclick: () => { data.items = data.items.filter(x => x !== it); save(); } }),
          );
          // порядок — перетаскиванием
          li.addEventListener('dragstart', (e) => { dragId = it.id; e.dataTransfer.effectAllowed = 'move'; li.classList.add('dragging'); });
          li.addEventListener('dragend', () => li.classList.remove('dragging'));
          li.addEventListener('dragover', (e) => { if (dragId && dragId !== it.id) { e.preventDefault(); li.classList.add('over'); } });
          li.addEventListener('dragleave', () => li.classList.remove('over'));
          li.addEventListener('drop', (e) => {
            e.preventDefault();
            const from = data.items.findIndex(x => x.id === dragId);
            const [moved] = data.items.splice(from, 1);
            data.items.splice(data.items.indexOf(it), 0, moved);
            dragId = null;
            save();
          });
          return li;
        }));
        const left = data.items.filter(i => !i.done).length;
        count.textContent = data.items.length ? `${left} ${plural(left, ['осталась', 'осталось', 'осталось'])}` : '';
        clear.hidden = !data.items.some(i => i.done);
      }

      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !input.value.trim()) return;
        const firstDone = data.items.findIndex(i => i.done);
        const item = { id: uid(), text: input.value.trim(), done: false };
        if (firstDone < 0) data.items.push(item); else data.items.splice(firstDone, 0, item);
        input.value = '';
        save();
      });
      clear.addEventListener('click', () => { data.items = data.items.filter(i => !i.done); save(); });

      paint();
      body.append(h('div', { class: 'w-todo' },
        h('div', { class: 'w-head' }, data.title ? h('div', { class: 'w-label' }, data.title) : h('span'), count),
        list, input, clear));
    },
  },

  pomodoro: {
    title: 'Помодоро',
    size: { w: 4, h: 4 }, min: { w: 3, h: 3 },
    defaults: { glass: true, work: '25', rest: '5', sound: true, state: null, stats: { day: '', count: 0 } },
    settings: [
      { key: 'work', label: 'Работа, мин', type: 'select', options: [['15', '15'], ['20', '20'], ['25', '25'], ['30', '30'], ['45', '45'], ['50', '50']] },
      { key: 'rest', label: 'Перерыв, мин', type: 'select', options: [['5', '5'], ['10', '10'], ['15', '15']] },
      { key: 'sound', label: 'Звук в конце', type: 'toggle' },
      GLASS_SETTING,
    ],
    render(body, data, ctx) {
      // state: { phase: 'work'|'rest', endsAt (идёт) | left (пауза), owner } — owner: вкладка, которая запустила;
      // только она пищит и пишет итог, чтобы десять открытых вкладок не пищали хором
      const me = Pomo.token;
      const len = (ph) => +(ph === 'work' ? data.work : data.rest) * 60000;
      if (!data.state) data.state = { phase: 'work', left: len('work') };
      if (data.stats.day !== dayKey()) data.stats = { day: dayKey(), count: 0 };

      const R = 44, C = 2 * Math.PI * R;
      const ring = h('div', {
        class: 'pomo-ring', html: `<svg viewBox="0 0 100 100"><circle class="pomo-track" cx="50" cy="50" r="${R}"/>` +
          `<circle class="pomo-prog" cx="50" cy="50" r="${R}" stroke-dasharray="${C}" transform="rotate(-90 50 50)"/></svg>`,
      });
      const prog = ring.querySelector('.pomo-prog');
      const time = h('div', { class: 'pomo-time' });
      const phase = h('div', { class: 'pomo-phase' });
      const toggle = h('button', { type: 'button', class: 'pomo-btn main' });
      const count = h('div', { class: 'pomo-count' });
      ring.append(h('div', { class: 'pomo-center' }, phase, time));

      const left = () => {
        const s = data.state;
        return s.endsAt ? Math.max(0, s.endsAt - Date.now()) : s.left;
      };
      const running = () => !!data.state.endsAt;
      const paint = () => {
        const l = left();
        const m = Math.floor(l / 60000), s = Math.floor(l / 1000) % 60;
        time.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        phase.textContent = data.state.phase === 'work' ? 'Фокус' : 'Перерыв';
        prog.style.strokeDashoffset = C * (l / len(data.state.phase));
        body.querySelector('.w-pomo')?.classList.toggle('rest', data.state.phase === 'rest');
        toggle.innerHTML = running() ? SVG.pause : SVG.play;
        toggle.title = running() ? 'Пауза' : 'Старт';
        count.textContent = data.stats.count ? `Сегодня: ${data.stats.count}` : '';
        // пока идёт — занимаем заголовок и иконку вкладки (только вкладка, которая запустила)
        if (data.state.owner === me) Tab.set(running() ? `${time.textContent} · ${phase.textContent}` : null, running() ? { progress: 1 - l / len(data.state.phase), phase: data.state.phase, min: Math.ceil(l / 60000) } : null);
      };
      const setState = (s) => { data.state = s; ctx.save(); paint(); };
      const next = (finished) => {
        const ph = data.state.phase === 'work' ? 'rest' : 'work';
        if (finished && data.state.phase === 'work') {
          if (data.stats.day !== dayKey()) data.stats = { day: dayKey(), count: 0 };
          data.stats.count++;
        }
        if (finished && data.sound) Pomo.beep();
        Tab.set(null);
        setState({ phase: ph, left: len(ph) });
      };

      toggle.addEventListener('click', () => {
        Pomo.unlock(); // звук разрешается только после клика
        if (running()) setState({ phase: data.state.phase, left: left() });
        else setState({ phase: data.state.phase, endsAt: Date.now() + left(), owner: me });
      });
      const reset = h('button', { type: 'button', class: 'pomo-btn', title: 'Сначала', html: SVG.reset, onclick: () => { Tab.set(null); setState({ phase: data.state.phase, left: len(data.state.phase) }); } });
      const skip = h('button', { type: 'button', class: 'pomo-btn', title: 'Следующая фаза', html: SVG.skip, onclick: () => next(false) });

      const t = setInterval(() => {
        if (running() && left() <= 0 && data.state.owner === me) next(true);
        paint();
      }, 250);
      paint();
      body.append(h('div', { class: 'w-pomo' + (data.state.phase === 'rest' ? ' rest' : '') }, ring, h('div', { class: 'pomo-ctrl' }, reset, toggle, skip), count));
      return { destroy: () => { clearInterval(t); if (data.state.owner === me) Tab.set(null); } };
    },
  },

  topsites: {
    title: 'Частые сайты',
    perm: 'topSites',
    size: { w: 10, h: 2 }, min: { w: 2, h: 1 },
    defaults: { glass: true, count: '8', style: 'tiles', icons: 'glass', newTab: false },
    settings: [
      { key: 'count', label: 'Сколько', type: 'select', options: [['4', '4'], ['6', '6'], ['8', '8'], ['10', '10'], ['12', '12']] },
      { key: 'style', label: 'Вид', type: 'select', options: [['tiles', 'Плитки'], ['list', 'Список'], ['icons', 'Только иконки']] },
      ICONS_SETTING,
      GAP_SETTING,
      { key: 'newTab', label: 'Открывать в новой вкладке', type: 'toggle' },
      GLASS_SETTING,
    ],
    render(body, data, ctx) {
      let alive = true;
      Perm.has('topSites').then((ok) => {
        if (!alive) return;
        if (!ok) return permGate(body, 'topSites', 'Нужен доступ к часто посещаемым сайтам', ctx);
        if (!chrome.topSites?.get) {
          return body.append(h('div', { class: 'w-empty' }, h('div', { class: 'w-muted' }, 'Доступ есть — обнови вкладку'),
            h('button', { type: 'button', class: 'pill small', onclick: () => location.reload() }, 'Обновить')));
        }
        chrome.topSites.get((list) => {
          if (!alive) return;
          const sites = list.filter(s => /^https?:/.test(s.url)).slice(0, +data.count);
          body.append(sites.length ? linkTiles(sites, data) : h('div', { class: 'w-empty' }, h('div', { class: 'w-muted' }, 'Браузер ещё не знает твоих частых сайтов')));
        });
      });
      return { destroy: () => { alive = false; } };
    },
  },

  bookmarks: {
    title: 'Панель закладок',
    perm: 'bookmarks',
    size: { w: 12, h: 2 }, min: { w: 2, h: 1 },
    defaults: { glass: true, style: 'tiles', icons: 'glass', newTab: false },
    settings: [
      { key: 'style', label: 'Вид', type: 'select', options: [['tiles', 'Плитки'], ['list', 'Список'], ['icons', 'Только иконки']] },
      ICONS_SETTING,
      GAP_SETTING,
      { key: 'newTab', label: 'Открывать в новой вкладке', type: 'toggle' },
      GLASS_SETTING,
    ],
    render(body, data, ctx) {
      let alive = true, t = 0;
      const wrap = h('div', { class: `w-links style-${data.style} icons-${data.icons} gap-${data.gap || 'auto'}` });
      const folderEl = (n) => {
        const b = h('button', { type: 'button', class: 'link link-folder', title: n.title, onclick: () => openBookmarkFolder(b, n, data.newTab) },
          h('span', { class: 'link-ico', html: FOLDER_SVG }), h('span', { class: 'link-title' }, n.title || 'Папка'));
        return b;
      };
      const paint = () => Bookmarks.bar().then((nodes) => {
        if (!alive) return;
        wrap.replaceChildren(...nodes.map(n => n.url ? linkEl(n, data) : folderEl(n)));
        if (!nodes.length) wrap.replaceChildren(h('div', { class: 'w-muted' }, 'В строке закладок пока пусто'));
      });
      // закладки поменяли в браузере — перерисовываемся (пачкой, если правок много)
      const later = () => { clearTimeout(t); t = setTimeout(paint, 150); };
      const evs = ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered'];
      Perm.has('bookmarks').then((ok) => {
        if (!alive) return;
        if (!ok) return permGate(body, 'bookmarks', 'Нужен доступ к закладкам — покажу твою строку закладок', ctx);
        if (!Bookmarks.available()) {
          return body.append(h('div', { class: 'w-empty' }, h('div', { class: 'w-muted' }, 'Доступ есть — обнови вкладку'),
            h('button', { type: 'button', class: 'pill small', onclick: () => location.reload() }, 'Обновить')));
        }
        body.append(wrap);
        paint();
        for (const e of evs) chrome.bookmarks[e]?.addListener(later);
      });
      return {
        destroy: () => {
          alive = false;
          clearTimeout(t);
          closeBmPop?.();
          if (Bookmarks.available()) for (const e of evs) chrome.bookmarks[e]?.removeListener(later);
        },
      };
    },
  },

  recent: {
    title: 'Недавно закрытые',
    perm: ['sessions', 'tabs'], // без tabs Chrome отдаёт закрытые вкладки без адреса и заголовка
    size: { w: 5, h: 4 }, min: { w: 3, h: 2 },
    defaults: { glass: true, count: '8' },
    settings: [
      { key: 'count', label: 'Сколько', type: 'select', options: [['5', '5'], ['8', '8'], ['12', '12']] },
      GLASS_SETTING,
    ],
    render(body, data, ctx) {
      let alive = true;
      const box = h('div', { class: 'w-recent' }, h('div', { class: 'w-label' }, 'Недавно закрытые'));
      const list = h('ul', { class: 'recent-list' });
      const paint = () => chrome.sessions.getRecentlyClosed({ maxResults: 25 }, (sessions) => {
        if (!alive) return;
        const tabs = sessions.flatMap(s => s.tab ? [s.tab] : (s.window?.tabs || []))
          .filter(t => t.url && /^https?:/.test(t.url))
          .slice(0, +data.count);
        list.replaceChildren(...tabs.map(t => h('li', {},
          h('button', { type: 'button', class: 'recent-item', title: t.url, onclick: () => chrome.sessions.restore(t.sessionId) },
            h('span', { class: 'recent-ico' }, favicon(t.url, t.title, 32)),
            h('span', { class: 'recent-title', translate: 'no' }, t.title || hostOf(t.url))))));
        if (!tabs.length) list.replaceChildren(h('li', { class: 'w-muted' }, 'Пока ничего не закрывали'));
      });
      Perm.has(['sessions', 'tabs']).then((ok) => {
        if (!alive) return;
        if (!ok) return permGate(body, ['sessions', 'tabs'], 'Нужен доступ к недавно закрытым вкладкам', ctx);
        // разрешение выдали только что — API появится после перезагрузки вкладки
        if (!chrome.sessions?.getRecentlyClosed) {
          return body.append(h('div', { class: 'w-empty' }, h('div', { class: 'w-muted' }, 'Доступ есть — обнови вкладку'),
            h('button', { type: 'button', class: 'pill small', onclick: () => location.reload() }, 'Обновить')));
        }
        box.append(list);
        body.append(box);
        paint();
        chrome.sessions.onChanged.addListener(paint);
      });
      return { destroy: () => { alive = false; chrome.sessions?.onChanged?.removeListener(paint); } };
    },
  },

  rates: {
    title: 'Курсы ЦБ',
    size: { w: 4, h: 3 }, min: { w: 3, h: 2 },
    defaults: { glass: true, codes: 'USD, EUR, CNY' },
    settings: [{ key: 'codes', label: 'Валюты (коды через запятую)', type: 'text', placeholder: 'USD, EUR, CNY' }, GLASS_SETTING],
    render(body, data) {
      let alive = true;
      const box = h('div', { class: 'w-rates' }, h('div', { class: 'w-muted' }, 'Узнаю курс…'));
      body.append(box);
      const fmt = (v) => v.toLocaleString(I18N.locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      loadRates().then(({ r, stale }) => {
        if (!alive) return;
        const codes = data.codes.toUpperCase().split(/[\s,;]+/).filter(Boolean);
        const rows = codes.map(c => r.Valute[c] && { c, ...r.Valute[c] }).filter(Boolean);
        box.replaceChildren(
          h('div', { class: 'w-head' }, h('div', { class: 'w-label' }, 'Курс ЦБ'),
            h('span', { class: 'w-muted' }, stale ? 'нет сети' : new Date(r.Date).toLocaleDateString(I18N.locale(), { day: 'numeric', month: 'short' }))),
          ...rows.map(v => {
            const val = v.Value / v.Nominal, d = (v.Value - v.Previous) / v.Nominal;
            return h('div', { class: 'rate' },
              h('span', { class: 'rate-code' }, v.c),
              h('span', { class: 'rate-val' }, fmt(val) + ' ₽'),
              h('span', { class: 'rate-d ' + (d > 0 ? 'up' : d < 0 ? 'down' : '') }, (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '') + fmt(Math.abs(d))));
          }),
          ...(rows.length ? [] : [h('div', { class: 'w-muted' }, 'Не нашёл таких валют')])); // replaceChildren превратил бы null в текст
      }).catch(() => { if (alive) box.replaceChildren(h('div', { class: 'w-muted' }, 'Нет связи с ЦБ')); });
      return { destroy: () => { alive = false; } };
    },
  },

  countdown: {
    title: 'Обратный отсчёт',
    size: { w: 5, h: 3 }, min: { w: 3, h: 2 },
    defaults: { glass: false, title: 'Новый год', date: '' },
    settings: [
      { key: 'title', label: 'Событие', type: 'text' },
      { key: 'date', label: 'Дата', type: 'text', placeholder: 'ДД.ММ.ГГГГ, пусто — Новый год' },
      GLASS_SETTING,
    ],
    render(body, data) {
      const target = parseDate(data.date) || new Date(new Date().getFullYear() + 1, 0, 1);
      const big = h('div', { class: 'cd-big' });
      const unit = h('div', { class: 'cd-unit' });
      const sub = h('div', { class: 'cd-sub' });
      const tick = () => {
        const ms = target - Date.now();
        if (ms <= 0) { big.textContent = '🎉'; unit.textContent = ''; sub.textContent = `${data.title || 'Событие'} — уже!`; return; }
        const d = Math.floor(ms / 86400000), hh = Math.floor(ms / 3600000) % 24, mm = Math.floor(ms / 60000) % 60, ss = Math.floor(ms / 1000) % 60;
        if (d >= 1) {
          big.textContent = d;
          unit.textContent = plural(d, ['день', 'дня', 'дней']);
          sub.textContent = `до «${data.title || 'события'}» · ещё ${hh} ч ${mm} мин`;
        } else {
          big.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
          unit.textContent = '';
          sub.textContent = `до «${data.title || 'события'}»`;
        }
      };
      tick();
      const t = setInterval(tick, 1000);
      body.append(h('div', { class: 'w-countdown' }, h('div', { class: 'cd-row' }, big, unit), sub));
      return { destroy: () => clearInterval(t) };
    },
  },

  habits: {
    title: 'Привычки',
    size: { w: 6, h: 4 }, min: { w: 4, h: 2 },
    defaults: {
      glass: true,
      habits: [{ id: 'h1', name: 'Вода 2 л', days: {} }, { id: 'h2', name: 'Спорт', days: {} }, { id: 'h3', name: 'Чтение', days: {} }],
    },
    settings: [GLASS_SETTING],
    render(body, data, ctx) {
      const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return d; });
      const streak = (hb) => { let n = 0; const d = new Date(); if (!hb.days[dayKey(d)]) d.setDate(d.getDate() - 1); while (hb.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); } return n; };
      const grid = h('div', { class: 'hb-grid' });
      const input = h('input', { type: 'text', class: 'todo-new', placeholder: 'Новая привычка — Enter', spellcheck: 'false' });
      const save = () => {
        // храним только последние 60 дней
        const old = dayKey(new Date(Date.now() - 60 * 86400000));
        for (const hb of data.habits) for (const k in hb.days) if (k < old) delete hb.days[k];
        ctx.save();
        paint();
      };
      function paint() {
        grid.replaceChildren(
          h('span'), ...days.map((d, i) => h('span', { class: 'hb-dn' + (i === 6 ? ' today' : '') }, d.toLocaleDateString(I18N.locale(), { weekday: 'short' }).slice(0, 2))), h('span'),
          ...data.habits.flatMap(hb => [
            h('span', { class: 'hb-name', title: hb.name, translate: 'no' }, hb.name,
              h('button', { type: 'button', class: 'todo-del', title: 'Удалить', html: SVG.x, onclick: () => { data.habits = data.habits.filter(x => x !== hb); save(); } })),
            ...days.map(d => {
              const k = dayKey(d);
              return h('button', { type: 'button', class: 'hb-dot' + (hb.days[k] ? ' on' : ''), title: d.toLocaleDateString(I18N.locale()), onclick: () => { if (hb.days[k]) delete hb.days[k]; else hb.days[k] = true; save(); } });
            }),
            h('span', { class: 'hb-streak', title: 'Дней подряд' }, streak(hb) ? `${streak(hb)}🔥` : ''),
          ]));
      }
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !input.value.trim()) return;
        data.habits.push({ id: uid(), name: input.value.trim(), days: {} });
        input.value = '';
        save();
      });
      paint();
      body.append(h('div', { class: 'w-habits' }, h('div', { class: 'w-label' }, 'Привычки'), grid, input));
    },
  },

  quote: {
    title: 'Цитата',
    size: { w: 8, h: 2 }, min: { w: 4, h: 2 },
    defaults: { glass: false, shift: 0 },
    settings: [GLASS_SETTING],
    render(body, data, ctx) {
      // цитата дня; «ещё» листает дальше, на следующий день сдвиг сбрасывается
      if (data.shiftDay !== dayIndex()) { data.shift = 0; data.shiftDay = dayIndex(); }
      const [text, who, from] = QUOTES[(dayIndex() + data.shift) % QUOTES.length];
      body.append(h('figure', { class: 'w-quote', translate: 'no' },
        h('blockquote', {}, `«${text}»`),
        h('figcaption', {}, [who, from].filter(Boolean).join(', ')),
        h('button', { type: 'button', class: 'w-more', title: 'Другая цитата', html: SVG.more, onclick: () => { data.shift++; ctx.save(); ctx.rerender(); } })));
    },
  },

  word: {
    title: 'Слово дня',
    size: { w: 5, h: 2 }, min: { w: 3, h: 2 },
    defaults: { glass: true, shift: 0 },
    settings: [GLASS_SETTING],
    render(body, data, ctx) {
      if (data.shiftDay !== dayIndex()) { data.shift = 0; data.shiftDay = dayIndex(); }
      const [word, meaning] = WORDS[(dayIndex() + data.shift) % WORDS.length];
      body.append(h('div', { class: 'w-word' },
        h('div', { class: 'w-label' }, 'Слово дня'),
        h('div', { class: 'word-w', translate: 'no' }, word),
        h('div', { class: 'word-m', translate: 'no' }, meaning),
        h('button', { type: 'button', class: 'w-more', title: 'Другое слово', html: SVG.more, onclick: () => { data.shift++; ctx.save(); ctx.rerender(); } })));
    },
  },

  pic: {
    title: 'Картинка',
    size: { w: 4, h: 4 }, min: { w: 2, h: 2 },
    defaults: { glass: false, source: 'cats', fit: 'cover', cache: null },
    settings: [
      { key: 'source', label: 'Что показывать', type: 'select', options: [['cats', 'Котики'], ['anime', 'Аниме-гифки'], ['file', 'Свой файл']] },
      { key: 'fit', label: 'Как вписать', type: 'select', options: [['cover', 'Заполнить'], ['contain', 'Целиком']] },
      GLASS_SETTING,
    ],
    render(body, data, ctx) {
      let alive = true;
      const frame = h('div', { class: `w-pic fit-${data.fit}` });
      const more = h('button', { type: 'button', class: 'w-more', title: 'Ещё', html: SVG.more });
      const cap = h('div', { class: 'pic-cap' });
      body.append(frame);
      // показываем, только когда картинка целиком скачана и раскодирована — иначе она проявлялась полосами сверху вниз;
      // пока грузится — переливающаяся заглушка (или прежняя картинка, если листаем «Ещё»)
      let seq = 0;
      const show = (src, caption) => {
        const my = ++seq;
        const img = h('img', { alt: '', referrerpolicy: 'no-referrer', src, class: 'pic-in' });
        if (!frame.querySelector('img')) frame.replaceChildren(h('div', { class: 'pic-loading' }), more);
        frame.classList.add('busy');
        img.decode().then(() => {
          if (!alive || my !== seq) return;
          cap.textContent = caption || '';
          cap.hidden = !caption;
          frame.classList.remove('busy');
          frame.replaceChildren(img, cap, more);
          requestAnimationFrame(() => img.classList.add('on'));
        }).catch(() => { if (alive && my === seq) { frame.classList.remove('busy'); msg('Картинка не загрузилась'); } });
      };
      const msg = (text, btn) => frame.replaceChildren(h('div', { class: 'w-empty' }, h('div', { class: 'w-muted' }, text), btn || null), ...(data.source === 'file' ? [] : [more]));

      if (data.source === 'file') {
        // свой файл лежит отдельным ключом, чтобы не переписывать его при каждом сохранении раскладки
        const key = 'pic:' + ctx.id;
        const pick = h('button', { type: 'button', class: 'pill small', onclick: () => pickPic(key, ctx) }, 'Выбрать файл');
        more.title = 'Другой файл';
        more.onclick = () => pickPic(key, ctx);
        Store.get(key, null).then((src) => { if (alive) src ? show(src) : msg('Свою картинку или гифку', pick); });
      } else {
        // новую берём по кнопке или раз в час, иначе показываем ту же — не дёргаем сервис на каждую вкладку
        const fresh = data.cache && data.cache.source === data.source && Date.now() - data.cache.at < 3600000;
        const load = () => {
          if (!frame.querySelector('img')) frame.replaceChildren(h('div', { class: 'pic-loading' }), more);
          frame.classList.add('busy');
          fetchPic(data.source).then((p) => {
            if (!alive) return;
            data.cache = { ...p, source: data.source, at: Date.now() };
            ctx.save();
            show(p.url, p.caption);
          }).catch(() => { if (alive) { frame.classList.remove('busy'); msg('Не достучался до сервиса'); } });
        };
        more.onclick = load;
        if (fresh) show(data.cache.url, data.cache.caption); else load();
      }
      return { destroy: () => { alive = false; } };
    },
  },
});

// ---------- меню «+ Виджет»: иконка, описание, группа ----------
// Иконки 24×24: контур currentColor + полупрозрачная заливка для объёма
const WI = (body) => `<svg viewBox="0 0 24 24">${body}</svg>`;
const F = 'fill="currentColor" fill-opacity=".18" stroke="none"';
const WIDGET_GROUPS = [['time', 'Время'], ['work', 'Дела'], ['nav', 'Навигация'], ['info', 'Информация'], ['mood', 'Настроение']];
const WIDGET_META = {
  greeting: { group: 'time', desc: 'Доброе утро — крупно и своим шрифтом', icon: '' },
  clock: { group: 'time', desc: 'Цифровые или стрелочные, приветствие', icon: WI(`<circle cx="12" cy="12" r="9" ${F}/><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>`) },
  pomodoro: { group: 'time', desc: 'Фокус и перерывы по таймеру', icon: WI(`<circle cx="12" cy="13" r="8" ${F}/><circle cx="12" cy="13" r="8"/><path d="M12 13V9M9.5 2.5h5M12 2.5V5"/><path d="M12 5a8 8 0 0 1 8 8" stroke-width="2.6" opacity=".9"/>`) },
  countdown: { group: 'time', desc: 'Сколько осталось до события', icon: WI(`<path d="M7 3h10M7 21h10" /><path d="M8 3c0 4 8 5 8 9s-8 5-8 9M16 3c0 4-8 5-8 9s8 5 8 9"/><path d="M9.5 19.5c1-1.6 4-1.6 5 0z" ${F.replace('.18', '.5')}/>`) },
  todo: { group: 'work', desc: 'Список дел с галочками', icon: WI(`<rect x="3" y="4" width="18" height="16" rx="3" ${F}/><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9l1.5 1.5L11 8M7 15l1.5 1.5L11 14M13.5 9.5H17M13.5 15.5H17"/>`) },
  notes: { group: 'work', desc: 'Быстрые заметки, сохраняются сами', icon: WI(`<path d="M5 3h10l4 4v14H5z" ${F}/><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 11h8M8 14.5h8M8 18h5"/>`) },
  habits: { group: 'work', desc: 'Отмечай привычки каждый день', icon: WI(`<rect x="3" y="4" width="18" height="17" rx="3" ${F}/><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2.5V6M16 2.5V6"/><circle cx="8" cy="13.5" r="1.3" fill="currentColor"/><circle cx="12" cy="13.5" r="1.3" fill="currentColor"/><circle cx="16" cy="13.5" r="1.3"/><circle cx="8" cy="17.5" r="1.3" fill="currentColor"/><circle cx="12" cy="17.5" r="1.3"/>`) },
  search: { group: 'nav', desc: 'Яндекс, Google, DuckDuckGo, Bing', icon: WI(`<circle cx="10.5" cy="10.5" r="6.5" ${F}/><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20.5 20.5" stroke-width="2.4"/>`) },
  links: { group: 'nav', desc: 'Свои закладки плитками', icon: WI(`<rect x="3" y="3" width="7.5" height="7.5" rx="2" ${F}/><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" ${F}/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>`) },
  bookmarks: { group: 'nav', desc: 'Твоя строка закладок, папки списком', icon: WI(`<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" ${F}/><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/><path d="M9 8h6"/>`) },
  topsites: { group: 'nav', desc: 'Сайты, куда ходишь чаще всего', icon: WI(`<path d="M12 3l2.6 5.5 6 .8-4.4 4.1 1.1 6L12 16.6 6.7 19.4l1.1-6L3.4 9.3l6-.8z" ${F}/><path d="M12 3l2.6 5.5 6 .8-4.4 4.1 1.1 6L12 16.6 6.7 19.4l1.1-6L3.4 9.3l6-.8z"/>`) },
  recent: { group: 'nav', desc: 'Вернуть случайно закрытую вкладку', icon: WI(`<path d="M4 8h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" ${F}/><path d="M4 8V6a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M9 14.5a3.5 3.5 0 1 0 1-2.4M9 10.5v2h2"/>`) },
  weather: { group: 'info', desc: 'Сейчас или на неделю', icon: WI(`<circle cx="9" cy="8" r="3.5" ${F}/><path d="M9 2.5v1.2M3.5 8h1.2M5.1 4.1l.9.9M12.9 4.1l-.9.9"/><circle cx="9" cy="8" r="3.5"/><path d="M8 20h9.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.4.9A3.1 3.1 0 0 0 8 20z" ${F}/><path d="M8 20h9.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.4.9A3.1 3.1 0 0 0 8 20z"/>`) },
  rates: { group: 'info', desc: 'Доллар, евро, юань по ЦБ', icon: WI(`<circle cx="12" cy="12" r="9" ${F}/><circle cx="12" cy="12" r="9"/><path d="M10 17V7h3.2a2.6 2.6 0 0 1 0 5.2H8.5M8.5 14.8h5"/>`) },
  quote: { group: 'mood', desc: 'Цитата из аниме каждый день', icon: WI(`<path d="M4 5h16v11H9l-5 4z" ${F}/><path d="M4 5h16v11H9l-5 4z"/><path d="M8.5 12.5c.3-1.5 1-2.5 2-3M12.5 12.5c.3-1.5 1-2.5 2-3" stroke-width="2"/>`) },
  word: { group: 'mood', desc: 'Редкое слово и что оно значит', icon: WI(`<path d="M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4z" ${F}/><path d="M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4zM20 4.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6z"/><path d="M15 9h2.5M15 12h2.5"/>`) },
  pic: { group: 'mood', desc: 'Котики, аниме-гифки или своя', icon: WI(`<rect x="3" y="4" width="18" height="16" rx="3" ${F}/><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M3.5 17l5-4.5 3.5 3 3-2.5 5.5 4.5"/>`) },
};
for (const [k, m] of Object.entries(WIDGET_META)) if (Widgets[k]) Object.assign(Widgets[k], m);

// ---------- данные для виджетов ----------

// Курс ЦБ через cbr-xml-daily.ru (зеркало официального XML, отдаёт JSON с CORS). Кэш — час, без сети — до трёх дней.
async function loadRates() {
  const cached = await Store.get('cbr', null);
  if (cached && Date.now() - cached.at < 3600000) return { r: cached.r, stale: false };
  try {
    const r = await fetch('https://www.cbr-xml-daily.ru/daily_json.js', { signal: AbortSignal.timeout(8000) }).then(x => { if (!x.ok) throw new Error('http ' + x.status); return x.json(); });
    if (!r.Valute) throw new Error('bad data');
    Store.set('cbr', { at: Date.now(), r });
    return { r, stale: false };
  } catch (e) {
    if (cached && Date.now() - cached.at < 3 * 86400000) return { r: cached.r, stale: true };
    throw e;
  }
}

// «31.12.2026», «31.12» (ближайшее), «2026-12-31» → Date | null
function parseDate(s) {
  s = (s || '').trim();
  let m = s.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);
  if (m) {
    const now = new Date();
    let d = new Date(m[3] ? +m[3] : now.getFullYear(), +m[2] - 1, +m[1]);
    if (!m[3] && d < now) d = new Date(now.getFullYear() + 1, +m[2] - 1, +m[1]);
    return isNaN(d) ? null : d;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

// Котики — cataas.com (случайный кот), аниме — nekos.best (реакции-гифки из аниме, SFW)
const ANIME_GIFS = ['happy', 'dance', 'wave', 'smile', 'thumbsup', 'sleep', 'think', 'nod', 'yawn', 'laugh', 'smug', 'shrug'];
async function fetchPic(source) {
  if (source === 'cats') {
    const gif = Math.random() < 0.35;
    return { url: `https://cataas.com/cat${gif ? '/gif' : ''}?_=${Date.now()}`, caption: '' };
  }
  const kind = ANIME_GIFS[Math.floor(Math.random() * ANIME_GIFS.length)];
  const j = await fetch(`https://nekos.best/api/v2/${kind}`, { signal: AbortSignal.timeout(8000) }).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  const p = j.results?.[0];
  if (!p?.url) throw new Error('bad data');
  return { url: p.url, caption: p.anime_name || '' };
}

// Свой файл для «Картинки»: гифка — как есть (до 5 МБ, иначе потеряет анимацию), остальное ужимаем до 1200px
function pickPic(key, ctx) {
  const inp = h('input', { type: 'file', accept: 'image/*' });
  inp.addEventListener('change', () => {
    const f = inp.files[0];
    if (!f) return;
    if (f.type === 'image/gif') {
      if (f.size > 5 * 1024 * 1024) { ctx.toast('Гифка больше 5 МБ — возьми поменьше'); return; }
      const fr = new FileReader();
      fr.onload = () => Store.set(key, fr.result).then(() => ctx.rerender());
      fr.readAsDataURL(f);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1200 / Math.max(img.width, img.height));
      const c = h('canvas', { width: Math.round(img.width * k), height: Math.round(img.height * k) });
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      Store.set(key, c.toDataURL('image/webp', 0.9)).then(() => ctx.rerender());
    };
    img.src = URL.createObjectURL(f);
  });
  inp.click();
}

// Помодоро: метка вкладки и звук (WebAudio: три коротких сигнала)
const Pomo = {
  token: uid(),
  ac: null,
  unlock() { this.ac ??= new AudioContext(); this.ac.resume?.(); },
  beep() {
    const ac = this.ac;
    if (!ac) return;
    [0, 0.28, 0.56].forEach((t) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.22);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + t);
      o.stop(ac.currentTime + t + 0.25);
    });
  },
};
