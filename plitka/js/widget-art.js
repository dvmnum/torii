// Картинки для меню «+ Виджет»: мини-макет каждого виджета, 160×96.
// Цвета — классами (css: .add-art): gl — стеклянная карточка, fg — текст, mu — приглушённое, ac — акцент, ln — линии.
// Текста со словами нет (только цифры и знаки) — чтобы не переводить картинки.
const WIDGET_ART = (() => {
  const svg = (body) => `<svg viewBox="0 0 160 96" aria-hidden="true">${body}</svg>`;
  const card = (x = 14, y = 12, w = 132, h = 72) => `<rect class="gl" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>`;
  const bar = (x, y, w, cls = 'mu', hh = 5) => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${hh}" rx="${hh / 2}"/>`;
  const check = (x, y) => `<rect class="ac" x="${x}" y="${y}" width="11" height="11" rx="3.5"/><path class="ck" d="M${x + 2.8} ${y + 5.8}l2.2 2.2 3.6-4.4"/>`;
  const box = (x, y) => `<rect class="ln" x="${x + .6}" y="${y + .6}" width="9.8" height="9.8" rx="3"/>`;
  // плитка-ссылка «фирменного» цвета
  // плитка-ссылка: монохром разной плотности (цвета брендов в меню рябили)
  const tile = (x, y, o, s = 20) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="6" fill="#fff" fill-opacity="${o}"/>`;

  return {
    clock: svg(`<text class="fg t-clock" x="80" y="56" text-anchor="middle">21:07</text>${bar(50, 66, 60)}<circle class="ac" cx="45" cy="68.5" r="2"/>`),

    greeting: svg(`<path class="ac" d="M42 30c1.2 7 3 8.8 10 10-7 1.2-8.8 3-10 10-1.2-7-3-8.8-10-10 7-1.2 8.8-3 10-10z"/><path class="ac" d="M30 56c.6 3.4 1.4 4.2 4.8 4.8-3.4.6-4.2 1.4-4.8 4.8-.6-3.4-1.4-4.2-4.8-4.8 3.4-.6 4.2-1.4 4.8-4.8z" opacity=".7"/>${bar(66, 34, 66, 'fg', 9)}${bar(66, 49, 46, 'fg', 9)}${bar(66, 66, 34, 'ac', 4)}`),

    pomodoro: svg(`${card(40, 8, 80, 80)}<circle class="ring" cx="80" cy="44" r="22"/><path class="arc" d="M80 22a22 22 0 1 1-20.9 28.8"/>` +
      `<text class="fg t-sm" x="80" y="48" text-anchor="middle">25:00</text><circle class="fg" cx="80" cy="76" r="5"/><path class="play" d="M78.6 73.6v4.8l3.8-2.4z"/>`),

    countdown: svg(`${card()}<text class="ac t-big" x="30" y="60">12</text>${bar(78, 36, 50, 'fg', 6)}${bar(78, 48, 36)}` +
      `<path class="ln" d="M80 62h10M80 74h10M81 62c0 4 8 4 8 6s-8 2-8 6M89 62c0 4-8 4-8 6s8 2 8 6"/>`),

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

    recent: svg(`${card()}` + [.6, .4, .5].map((c, i) => `<circle cx="32" cy="${30 + i * 18}" r="5" fill="#fff" fill-opacity="${c}"/>${bar(44, 27.5 + i * 18, [70, 52, 62][i], i ? 'mu' : 'fg')}`).join('') +
      `<path class="arc2" d="M128 40a10 10 0 1 1-9 -6"/><path class="arc2" d="M117 29l2 5 5-2"/>`),

    weather: svg(`<g class="sun"><circle class="ac" cx="54" cy="40" r="12"/>${[...Array(8)].map((_, i) => `<path class="ray" d="M54 22v-5" transform="rotate(${i * 45} 54 40)"/>`).join('')}</g>` +
      `<path class="fg" d="M48 70h30a11 11 0 0 0 1.3-21.9 15 15 0 0 0-28.7 3.4A9.3 9.3 0 0 0 48 70z"/><text class="fg t-mid" x="96" y="62">11°</text>`),

    rates: svg(`${card()}` + [['$', '81.2', 'up'], ['€', '94.6', 'dn'], ['¥', '11.3', 'up']].map(([c, v, d], i) =>
      `<text class="mu-t t-xs" x="26" y="${33 + i * 18}">${c}</text><text class="fg t-xs" x="38" y="${33 + i * 18}">${v}</text><path class="${d}" d="${d === 'up' ? `M84 ${31 + i * 18}l4-5 4 5z` : `M84 ${26 + i * 18}l4 5 4-5z`}"/>`).join('') +
      `<polyline class="spark" points="100,60 108,52 115,56 123,40 131,44 136,32"/>`),

    quote: svg(`${card()}<text class="ac t-quote" x="24" y="52">“</text>${bar(52, 32, 76, 'fg', 6)}${bar(52, 44, 60, 'fg', 6)}${bar(52, 60, 40)}`),

    word: svg(`${card()}<text class="fg t-serif" x="28" y="56">Aa</text>${bar(80, 34, 48, 'fg', 7)}${bar(80, 48, 40)}${bar(80, 58, 30)}<rect class="ac" x="28" y="64" width="18" height="3" rx="1.5"/>`),

    pic: svg(`<clipPath id="wa-pic"><rect x="24" y="10" width="112" height="76" rx="12"/></clipPath><g clip-path="url(#wa-pic)">` +
      `<rect x="24" y="10" width="112" height="76" class="sky"/><circle class="ac" cx="110" cy="32" r="9"/>` +
      `<path d="M24 86l30-34 18 20 14-12 26 26z" fill="rgba(255,255,255,.55)"/><path d="M60 86l26-22 24 22z" fill="rgba(255,255,255,.8)"/></g>` +
      `<rect x="24.5" y="10.5" width="111" height="75" rx="11.5" class="edge"/>`),
  };
})();
