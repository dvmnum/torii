// Меш-градиент на WebGL: цветные точки + искажение шумом + медленный дрейф, поверх — узор.
// Mesh.create(canvas, { scale }) → { set(params), destroy() } или null, если WebGL нет.
// params: {
//   points: [{ x, y, color:'#rrggbb' }] (2..6, x/y в 0..1),
//   warp, speed, grain, density — 0..1,
//   mode: 'mesh' | 'ribbed' | 'halftone' | 'flow' | 'ripple'
// }
const Mesh = (() => {
  const MAX = 6;
  const MODES = {
    mesh: 'Пятна',
    ribbed: 'Рифлёное стекло',
    halftone: 'Полутон',
    flow: 'Неоновые линии',
    ripple: 'Рельеф',
  };
  const MODE_IDS = Object.keys(MODES);

  const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform int uCount;
uniform vec2 uPos[${MAX}];
uniform vec3 uCol[${MAX}];
uniform float uWarp;
uniform float uDensity;
uniform int uMode;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// «жидкое» искажение координат
vec2 warp(vec2 uv, float t) {
  vec2 q = uv;
  q += uWarp * 0.32 * vec2(noise(uv * 2.2 + vec2(t * 0.07, -t * 0.05)) - 0.5,
                           noise(uv * 2.2 + vec2(5.2 - t * 0.06, 1.3 + t * 0.08)) - 0.5);
  q += uWarp * 0.06 * vec2(sin(q.y * 5.0 + t * 0.3), cos(q.x * 4.0 - t * 0.25));
  return q;
}

// цвет меша в точке: смешивание цветов по обратному расстоянию (в sRGB — так глубже)
vec3 meshAt(vec2 q, float t, float asp) {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uCount) break;
    vec2 p = uPos[i] + 0.05 * vec2(sin(t * 0.21 + float(i) * 1.7), cos(t * 0.17 + float(i) * 2.3));
    vec2 d = (q - p) * vec2(asp, 1.0);
    float w = 1.0 / pow(dot(d, d) + 0.003, 1.35);
    acc += uCol[i] * w;
    wsum += w;
  }
  return acc / wsum;
}

// самый тёмный цвет палитры — фон для полутона и неона
vec3 darkest() {
  vec3 d = uCol[0];
  for (int i = 1; i < ${MAX}; i++) {
    if (i >= uCount) break;
    if (lum(uCol[i]) < lum(d)) d = uCol[i];
  }
  return d;
}
vec3 vivid(vec3 c) { return c / max(max(c.r, max(c.g, c.b)), 0.001) * 0.97; }

// поле для неоновых лент: целые значения — изолинии, по ним идут ленты (обычно 1–3 штуки)
float flowField(vec2 uv, float t, float asp) {
  vec2 q = warp(uv, t);
  return fbm(vec2(q.x * asp, q.y) * mix(0.8, 2.0, uDensity) + vec2(t * 0.04, -t * 0.03)) * 3.0;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y; // (0,0) — левый верх, как в CSS
  float asp = uRes.x / uRes.y;
  float t = uTime;
  vec3 col;

  if (uMode == 1) {
    // рифлёное стекло: каждая полоска — линза, показывает растянутый и отражённый кусок под собой
    float n = mix(14.0, 60.0, uDensity);
    float sx = uv.x * n;
    float f = fract(sx) - 0.5;
    vec2 q = vec2((floor(sx) + 0.5 - f * 3.0) / n, uv.y + f * 0.11);
    col = meshAt(warp(q, t), t, asp);
    col *= 0.86 + 0.24 * smoothstep(-0.5, 0.5, f);      // одна грань полоски темнее
    col += 0.07 * pow(max(0.0, 1.0 - abs(f - 0.3) * 5.0), 3.0); // блик
  } else if (uMode == 2) {
    // полутон: точка тем больше, чем ярче меш под ней
    float cell = uRes.x / mix(38.0, 130.0, uDensity);
    vec2 p = gl_FragCoord.xy / cell;
    vec2 f = fract(p) - 0.5;
    vec2 cuv = (floor(p) + 0.5) * cell / uRes;
    cuv.y = 1.0 - cuv.y;
    vec3 c = meshAt(warp(cuv, t), t, asp);
    vec3 bg = darkest() * 0.7;
    float r = 0.52 * smoothstep(lum(bg) + 0.03, lum(bg) + 0.45, lum(c));
    float aa = 1.2 / cell;
    col = mix(bg, vivid(c), 1.0 - smoothstep(r - aa, r + aa, length(f)));
  } else if (uMode == 3) {
    // неоновые ленты вдоль изолиний шумового поля. Расстояние до изолинии = значение / градиент —
    // так лента одной толщины и там, где поле пологое (иначе расплывается в пятно)
    vec2 px = 1.0 / uRes;
    float v = flowField(uv, t, asp);
    vec2 g = vec2(flowField(uv + vec2(px.x, 0.0), t, asp) - v, flowField(uv + vec2(0.0, px.y), t, asp) - v);
    float sd = (v - floor(v + 0.5)) / max(length(g), 1e-5); // знаковое расстояние в пикселях
    float s = clamp(sd / (uRes.y * mix(0.035, 0.018, uDensity)), -2.0, 2.0); // в полуширинах ленты
    // поперёк ленты цвет берём из соседних мест меша — края уходят в другие оттенки
    vec3 c = vivid(meshAt(warp(uv, t) + vec2(s * 0.14, -s * 0.07), t, asp));
    vec3 bg = darkest() * 0.55;
    col = mix(bg, c, exp(-s * s * 1.6));
    col += 0.28 * exp(-s * s * 14.0) * vec3(1.0); // светлая сердцевина
  } else if (uMode == 4) {
    // рельеф: завихрение + частые гребни, которые затеняют цвет как выдавленные волны
    vec2 q = warp(uv, t);
    vec2 c0 = vec2(0.55, 0.45);
    vec2 d = (q - c0) * vec2(asp, 1.0);
    float a = 1.6 * uWarp * exp(-dot(d, d) * 2.5);
    q = c0 + mat2(cos(a), -sin(a), sin(a), cos(a)) * (q - c0);
    float fl = fbm(vec2(q.x * asp, q.y) * 1.8 + t * 0.03);
    float ridge = sin(fl * mix(55.0, 150.0, uDensity) + t * 0.6);
    col = meshAt(q, t, asp);
    col *= 0.88 + 0.1 * ridge;
    col += 0.08 * smoothstep(0.6, 1.0, ridge) * vivid(col);
  } else {
    col = meshAt(warp(uv, t), t, asp);
  }

  col += (hash(gl_FragCoord.xy + t) - 0.5) / 255.0; // дизеринг против полос
  gl_FragColor = vec4(col, 1.0);
}`;

  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };

  // scale — доля разрешения экрана. Пятна гладкие, им хватает 0.35; узорам (точки, полоски) нужно больше.
  // size — фиксированный размер (для миниатюр), тогда канвасу не нужно быть в DOM.
  function create(canvas, { scale = 0.35, fps = 30, size = null } = {}) {
    const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return null;

    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    try {
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) {
      console.warn('[mesh] шейдер не собрался', e);
      return null;
    }
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // один треугольник на весь экран
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = Object.fromEntries(['uRes', 'uTime', 'uCount', 'uPos', 'uCol', 'uWarp', 'uDensity', 'uMode']
      .map(n => [n, gl.getUniformLocation(prog, n)]));

    let params = null;
    let time = 20 + Math.random() * 80; // накопленное время: смена скорости не дёргает картинку
    let last = 0, raf = 0;

    const resize = () => {
      let w, h;
      if (size) [w, h] = size;
      else {
        const s = params.mode && params.mode !== 'mesh' ? Math.min(1, scale * 2.2) : scale;
        w = Math.round(canvas.clientWidth * s);
        h = Math.round(canvas.clientHeight * s);
      }
      w = Math.max(2, w); h = Math.max(2, h);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
    };

    const draw = () => {
      resize();
      const pts = params.points.slice(0, MAX);
      const pos = new Float32Array(MAX * 2), col = new Float32Array(MAX * 3);
      pts.forEach((p, i) => { pos.set([p.x, p.y], i * 2); col.set(hexToRgb(p.color), i * 3); });
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, time);
      gl.uniform1i(u.uCount, pts.length);
      gl.uniform2fv(u.uPos, pos);
      gl.uniform3fv(u.uCol, col);
      gl.uniform1f(u.uWarp, params.warp);
      gl.uniform1f(u.uDensity, params.density ?? 0.5);
      gl.uniform1i(u.uMode, Math.max(0, MODE_IDS.indexOf(params.mode)));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / fps - 2) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      time += dt * params.speed * 2.2;
      draw();
    };

    const ro = size ? null : new ResizeObserver(() => { if (params) draw(); });
    ro?.observe(canvas);

    return {
      set(p) {
        params = p;
        if (p.speed > 0 && !raf) { last = 0; raf = requestAnimationFrame(loop); }
        if (!(p.speed > 0) && raf) { cancelAnimationFrame(raf); raf = 0; }
        draw();
      },
      // для миниатюр: один кадр с заданным временем
      frame(p, at) { params = p; time = at; draw(); },
      destroy() {
        cancelAnimationFrame(raf);
        raf = 0;
        ro?.disconnect();
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      },
    };
  }

  // миниатюры пресетов: один общий невидимый канвас, картинку забираем сразу после отрисовки
  let thumbCtx = null;
  const thumbCanvas = document.createElement('canvas');
  function thumb(p, w = 160, h = 100) {
    thumbCtx ??= create(thumbCanvas, { size: [w, h] }) || false;
    if (!thumbCtx) return null;
    thumbCtx.frame(p, 30);
    return thumbCanvas.toDataURL('image/jpeg', 0.85);
  }

  // Заготовки. Точка 0 — обычно самая тёмная: она же фон у полутона и неона.
  const PRESETS = [
    { id: 'aurora', title: 'Аврора', mode: 'mesh', warp: 0.55, speed: 0.35, grain: 0.3, density: 0.5, points: [
      { x: 0.62, y: 0.5, color: '#0a0820' }, { x: 0.12, y: 0.12, color: '#5b3cff' },
      { x: 0.88, y: 0.28, color: '#00b3c7' }, { x: 0.42, y: 0.92, color: '#c2359d' }] },
    { id: 'reeded', title: 'Рифлёнка', mode: 'ribbed', warp: 0.85, speed: 0.25, grain: 0.75, density: 0.5, points: [
      { x: 0.78, y: 0.72, color: '#1a0626' }, { x: 0.25, y: 0.1, color: '#9d88ab' },
      { x: 0.8, y: 0.12, color: '#b9a2c6' }, { x: 0.3, y: 0.55, color: '#ff4655' },
      { x: 0.2, y: 0.9, color: '#2a0b33' }, { x: 0.58, y: 0.85, color: '#12041c' }] },
    { id: 'petal', title: 'Лепесток', mode: 'mesh', warp: 0.8, speed: 0.2, grain: 0.6, density: 0.5, points: [
      { x: 0.3, y: 0.42, color: '#231a2c' }, { x: 0.72, y: 0.78, color: '#2a1c30' },
      { x: 0.55, y: 0.3, color: '#e3437a' }, { x: 0.15, y: 0.78, color: '#e6507f' },
      { x: 0.04, y: 0.06, color: '#dedbd7' }, { x: 0.96, y: 0.35, color: '#d8d5d1' }] },
    { id: 'relief', title: 'Рельеф', mode: 'ripple', warp: 0.75, speed: 0.2, grain: 0.35, density: 0.5, points: [
      { x: 0.75, y: 0.3, color: '#1c070c' }, { x: 0.2, y: 0.4, color: '#ff1a78' },
      { x: 0.25, y: 0.85, color: '#a8a0a4' }, { x: 0.85, y: 0.8, color: '#ff4f95' }] },
    { id: 'dots', title: 'Полутон', mode: 'halftone', warp: 0.8, speed: 0.3, grain: 0.1, density: 0.4, points: [
      { x: 0.5, y: 0.5, color: '#141414' }, { x: 0.2, y: 0.2, color: '#ff1aa8' },
      { x: 0.8, y: 0.35, color: '#c40f86' }, { x: 0.35, y: 0.85, color: '#ff3cc0' }] },
    { id: 'neon', title: 'Неон', mode: 'flow', warp: 0.6, speed: 0.3, grain: 0.35, density: 0.1, points: [
      { x: 0.5, y: 0.5, color: '#0b0b0b' }, { x: 0.1, y: 0.6, color: '#ff5a1a' },
      { x: 0.55, y: 0.35, color: '#3a6aff' }, { x: 0.85, y: 0.75, color: '#b04aff' }] },
    { id: 'haze', title: 'Дымка', mode: 'mesh', warp: 0.45, speed: 0.3, grain: 1, density: 0.5, points: [
      { x: 0.2, y: 0.95, color: '#0d0d16' }, { x: 0.12, y: 0.1, color: '#e6b4ea' },
      { x: 0.5, y: 0.38, color: '#5a5ae6' }, { x: 0.9, y: 0.12, color: '#141426' },
      { x: 0.78, y: 0.88, color: '#10101c' }, { x: 0.2, y: 0.6, color: '#16162a' }] },
    { id: 'dusk', title: 'Закат', mode: 'mesh', warp: 0.5, speed: 0.35, grain: 0.3, density: 0.5, points: [
      { x: 0.5, y: 0.1, color: '#140812' }, { x: 0.15, y: 0.3, color: '#ff5a3c' },
      { x: 0.8, y: 0.45, color: '#b8327a' }, { x: 0.45, y: 0.9, color: '#ffb347' }] },
  ];

  // случайная, но гармоничная палитра под тёмную эстетику:
  // соседние тона (±55° от базового), одна почти чёрная точка и одна тёмная — для глубины
  function random() {
    const base = Math.random() * 360;
    const n = 4 + Math.floor(Math.random() * 2);
    const points = [];
    for (let i = 0; i < n; i++) {
      const hue = (base + (i === 0 ? 0 : (Math.random() - 0.5) * 110) + 360) % 360;
      const [sat, lig] = i === 0 ? [50 + Math.random() * 20, 5 + Math.random() * 5]
        : i === 1 ? [70 + Math.random() * 20, 18 + Math.random() * 10]
        : [70 + Math.random() * 25, 38 + Math.random() * 16];
      points.push({ x: +(0.05 + Math.random() * 0.9).toFixed(3), y: +(0.05 + Math.random() * 0.9).toFixed(3), color: hsl(hue, sat, lig) });
    }
    return points;
  }

  function hsl(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  }

  // CSS-подобие меша — для первого кадра до WebGL и если WebGL нет
  function cssPreview(p) {
    return p.points.map(pt => `radial-gradient(circle at ${pt.x * 100}% ${pt.y * 100}%, ${pt.color}, transparent 65%)`).join(', ') +
      `, ${p.points[0].color}`;
  }

  return { create, thumb, random, cssPreview, PRESETS, MODES, MAX };
})();
