// Картинки для меню «+ Виджет»: мини-макет каждого виджета, 160×96.
// Цвета — классами (css: .add-art): gl — стеклянная карточка, fg — текст, mu — приглушённое, ac — акцент, ln — линии.
// Текста со словами нет (только цифры и знаки) — чтобы не переводить картинки.
const WIDGET_ART = (() => {
  const svg = (body) => `<svg viewBox="0 0 160 96" aria-hidden="true">${body}</svg>`;
  const card = (x = 14, y = 12, w = 132, h = 72) => `<rect class="gl" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>`;
  const bar = (x, y, w, cls = 'mu', hh = 5) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${hh}" rx="${hh / 2}"/>`;
  const check = (x, y) => `<rect class="ac" x="${x}" y="${y}" width="11" height="11" rx="3.5"/><path class="ck" d="M${x + 2.8} ${y + 5.8}l2.2 2.2 3.6-4.4"/>`;
  const box = (x, y) => `<rect class="ln" x="${x + .6}" y="${y + .6}" width="9.8" height="9.8" rx="3"/>`;
  // контурные иконки Lucide (ISC), сетка 24×24 — масштабируем; толщина линии не растёт (vector-effect в CSS, класс ol)
  const LUCIDE = {
    hourglass: 'M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2',
    cloudSun: 'M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.947 12.65a4 4 0 0 0-5.925-4.128M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z',
    undo: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5',
  };
  const icon = (d, x, y, s, cls = 'ol') => `<path class="${cls}" d="${d}" transform="translate(${x} ${y}) scale(${s})"/>`;
  // плитка-ссылка: монохром разной плотности (цвета брендов в меню рябили)
  const tile = (x, y, o, s = 20) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="6" fill="#fff" fill-opacity="${o}"/>`;

  return {
    clock: svg(`<text class="fg t-clock" x="80" y="56" text-anchor="middle">21:07</text>${bar(50, 66, 60)}<circle class="ac" cx="45" cy="68.5" r="2"/>`),

    greeting: svg(`<path class="ac" d="M42 30c1.2 7 3 8.8 10 10-7 1.2-8.8 3-10 10-1.2-7-3-8.8-10-10 7-1.2 8.8-3 10-10z"/><path class="ac" d="M30 56c.6 3.4 1.4 4.2 4.8 4.8-3.4.6-4.2 1.4-4.8 4.8-.6-3.4-1.4-4.2-4.8-4.8 3.4-.6 4.2-1.4 4.8-4.8z" opacity=".7"/>${bar(66, 34, 66, 'fg', 9)}${bar(66, 49, 46, 'fg', 9)}${bar(66, 66, 34, 'ac', 4)}`),

    // кольцо прогресса и кнопка — без цифр
    pomodoro: svg(`<circle class="ring" cx="80" cy="42" r="24"/><path class="arc" d="M80 18a24 24 0 1 1-22.8 31.4"/>` +
      `<circle class="fg" cx="80" cy="42" r="9"/><path class="play" d="M77.6 38.2v7.6l6-3.8z"/>`),

    // песочные часы и полоска «сколько прошло» — без цифр
    countdown: svg(icon(LUCIDE.hourglass, 34, 22, 2.1) + bar(92, 36, 40, 'fg', 7) + bar(92, 52, 40, 'mu', 5) + bar(92, 52, 24, 'ac', 5)),

    todo: svg(`${card()}${check(28, 24)}${bar(46, 27, 62, 'mu')}<rect class="mu" x="46" y="29" width="62" height="1" />${check(28, 42)}${bar(46, 45, 44, 'mu')}${box(28, 60)}${bar(46, 63, 72, 'fg')}`),

    notes: svg(`${card()}${bar(28, 26, 92, 'fg')}${bar(28, 38, 104)}${bar(28, 50, 80)}${bar(28, 62, 54)}<rect class="ac" x="85" y="59" width="2" height="11" rx="1"/>`),

    habits: svg(`${card()}` + [0, 1, 2].map(r => bar(26, 28 + r * 16, 20, r ? 'mu' : 'fg', 5) +
      [...Array(6)].map((_, i) => `<circle class="${(r * 7 + i * 3) % 4 ? 'ac' : 'ring2'}" cx="${62 + i * 13}" cy="${30.5 + r * 16}" r="4.6"/>`).join('')).join('')),

    search: svg(`<rect class="gl" x="10" y="33" width="140" height="30" rx="15"/><circle class="ln2" cx="28" cy="47" r="5.5"/><path class="ln2" d="M32 51l4 4"/>` +
      `${bar(44, 45.5, 58)}<circle class="ac" cx="134" cy="48" r="9"/><path class="ck" d="M130.5 48h6M134 45l3 3-3 3"/>`),

    links: svg(`${card(10, 22, 140, 52)}` + [.5, .3, .42, .26, .36].map((c, i) => tile(22 + i * 25, 32, c, 18) + bar(24 + i * 25, 56, 14, 'mu', 3)).join('')),

    topsites: svg(`${card()}` + [.5, .28, .4, .32, .24, .44, .3, .36]
      .map((c, i) => tile(31 + (i % 4) * 26, 22 + Math.floor(i / 4) * 28, c, 18)).join('') +
      `<path class="ac" d="M131 18l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>`),

    bookmarks: svg(`${card(8, 30, 144, 36)}<path class="ac" d="M18 40a2 2 0 0 1 2-2h5l2 2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2z" fill-opacity=".85"/>` +
      [.6, .4, .5].map((c, i) => `<circle cx="${52 + i * 34}" cy="48" r="5" fill="#fff" fill-opacity="${c}"/>${bar(60 + i * 34, 45.5, 18)}`).join('')),

    recent: svg(`${card()}` + [.6, .4, .5].map((c, i) => `<circle cx="32" cy="${30 + i * 18}" r="5" fill="#fff" fill-opacity="${c}"/>${bar(44, 27.5 + i * 18, [56, 40, 48][i], i ? 'mu' : 'fg')}`).join('') +
      icon(LUCIDE.undo, 112, 34, 1.15, 'ol ol-ac')),

    // контурные облако с солнцем — как иконка в самом виджете
    weather: svg(icon(LUCIDE.cloudSun, 50, 14, 2.6)),

    // строки курсов — без подписей валют: полоска, значение, стрелка; справа график
    rates: svg(`${card()}` + ['up', 'dn', 'up'].map((d, i) =>
      bar(28, 27 + i * 16, 10, 'mu', 5) + bar(44, 27 + i * 16, 28, 'fg', 5) +
      `<path class="${d}" d="${d === 'up' ? `M82 ${33 + i * 16}l4-5 4 5z` : `M82 ${28 + i * 16}l4 5 4-5z`}"/>`).join('') +
      `<polyline class="spark" points="100,62 108,54 115,58 123,42 131,46 136,34"/>`),

    quote: svg(`<text class="ac t-quote" x="40" y="62">“</text>${bar(70, 38, 54, 'fg', 6)}${bar(70, 51, 38, 'mu', 5)}`),

    word: svg(`<text class="fg t-serif" x="38" y="60">Aa</text>${bar(94, 40, 32, 'fg', 6)}${bar(94, 52, 22, 'mu', 5)}`),

    pic: svg(`<clipPath id="wa-pic"><rect x="24" y="10" width="112" height="76" rx="12"/></clipPath><g clip-path="url(#wa-pic)">` +
      `<rect x="24" y="10" width="112" height="76" class="sky"/><circle class="ac" cx="110" cy="32" r="9"/>` +
      `<path d="M24 86l30-34 18 20 14-12 26 26z" fill="rgba(255,255,255,.55)"/><path d="M60 86l26-22 24 22z" fill="rgba(255,255,255,.8)"/></g>` +
      `<rect x="24.5" y="10.5" width="111" height="75" rx="11.5" class="edge"/>`),
  };
})();
