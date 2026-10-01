// «Жидкое стекло» как в iOS 26: у кромки блока фон преломляется (изгибается внутрь, как в толстой линзе).
// Делается SVG-фильтром feDisplacementMap внутри backdrop-filter: url(#…) — работает в Chrome/Edge/Яндексе;
// где не работает (Firefox, Safari), остаётся обычное размытое стекло.
// Карта смещений рисуется под размер и скругление блока и перерисовывается при ресайзе.
// Liquid.attach(el) / Liquid.detach(el) — el — элемент со стеклом; фильтр ставится ему инлайном (style.backdropFilter).
const Liquid = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  let defs = null, seq = 0;
  const live = new Map(); // el → { id, filter, ro, key }

  const ensureDefs = () => {
    if (defs) return defs;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    defs = document.createElementNS(NS, 'defs');
    svg.append(defs);
    document.body.append(svg);
    return defs;
  };

  // Карта: R — смещение по x, G — по y (128 — ноль). Внутри кромки шириной bezel смещение растёт к краю
  // по профилю «выпуклой линзы» и направлено внутрь — край показывает фон, который ближе к центру.
  function makeMap(w, h, r) {
    const k = Math.min(1, 320 / Math.max(w, h)); // карта мельче блока — растянется, она гладкая
    const W = Math.max(8, Math.round(w * k)), H = Math.max(8, Math.round(h * k));
    const R = Math.min(r * k, W / 2, H / 2);
    const bezel = Math.max(4, Math.min(Math.min(W, H) * 0.38, 46 * k));
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const hx = W / 2 - R, hy = H / 2 - R;
    // знаковое расстояние до скруглённого прямоугольника (отрицательное внутри)
    const sdf = (x, y) => {
      const qx = Math.abs(x - W / 2) - hx, qy = Math.abs(y - H / 2) - hy;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - R;
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x + 0.5, py = y + 0.5;
        const d = -sdf(px, py); // расстояние до края внутрь
        let dx = 0, dy = 0;
        if (d < bezel) {
          const t = 1 - Math.max(0, d) / bezel;      // 0 — внутренняя граница кромки, 1 — край
          const mag = Math.pow(t, 1.6);                // к краю сильнее; плавно гаснет к центру
          let nx = sdf(px + 1, py) - sdf(px - 1, py), ny = sdf(px, py + 1) - sdf(px, py - 1);
          const l = Math.hypot(nx, ny) || 1;
          dx = -nx / l * mag; dy = -ny / l * mag;      // внутрь
        }
        const i = (y * W + x) * 4;
        img.data[i] = 128 + dx * 127;
        img.data[i + 1] = 128 + dy * 127;
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  // Каждая перестройка — новый <filter> с новым id: Chrome не перерисовывает backdrop-filter,
  // если поменялось только содержимое уже подключённого фильтра (карта «залипала» пустой).
  function build(el, entry) {
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w < 8 || h < 8) return;
    const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    // координаты фильтра в backdrop-filter — от угла самого блока; позиция — только в ключе (переложить при перемещении)
    const x = Math.round(r.left), y = Math.round(r.top);
    const key = `${x},${y} ${w}x${h}r${rad}`;
    if (entry.key === key) return;
    entry.key = key;
    const strength = Math.min(110, Math.min(w, h) * 0.6); // насколько сильно тянет край, px
    const filter = document.createElementNS(NS, 'filter');
    filter.id = 'lq' + (++seq);
    // без color-interpolation-filters="sRGB": с ним Chrome в backdrop-filter портит карту (сдвигает весь фон, линзы нет)
    for (const [a, v] of [['filterUnits', 'userSpaceOnUse'], ['primitiveUnits', 'userSpaceOnUse'],
      ['x', 0], ['y', 0], ['width', w], ['height', h]]) filter.setAttribute(a, v);
    filter.innerHTML =
      `<feImage href="${makeMap(w, h, rad)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="map" scale="${strength.toFixed(1)}" xChannelSelector="R" yChannelSelector="G"/>`;
    ensureDefs().append(filter);
    // карта-картинка грузится асинхронно — подключаем фильтр, когда она готова
    const img = new Image();
    img.onload = img.onerror = () => {
      if (live.get(el) !== entry) return filter.remove();
      // фильтр — прямо в инлайн-стиль: url(#…) из внешнего CSS (через переменную) Chrome ищет в файле стилей, а не на странице
      const f = `url(#${filter.id}) blur(calc(var(--glass-blur) * .25)) var(--tone-f) saturate(150%) brightness(1.04)`;
      el.style.backdropFilter = f;
      el.style.webkitBackdropFilter = f;
      entry.filter?.remove();
      entry.filter = filter;
    };
    img.src = filter.querySelector('feImage').getAttribute('href');
  }

  function attach(el) {
    if (!el) return;
    let e = live.get(el);
    if (!e) {
      e = { filter: null, key: '' };
      let t = 0;
      e.ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => build(el, e), 60); });
      e.ro.observe(el);
      live.set(el, e);
    }
    build(el, e);
  }

  function detach(el) {
    const e = el && live.get(el);
    if (!e) return;
    e.ro.disconnect();
    e.filter?.remove();
    el.style.backdropFilter = '';
    el.style.webkitBackdropFilter = '';
    live.delete(el);
  }

  // блоки удалены из DOM — подчищаем фильтры
  function gc() { for (const el of [...live.keys()]) if (!el.isConnected) detach(el); }

  // блоки подвинули (drag, смена раскладки, ресайз окна) — переложить карты на новое место
  function refresh() { for (const [el, e] of live) build(el, e); }

  return { attach, detach, gc, refresh };
})();
