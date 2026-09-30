// Живой фон на WebGL. Источник — меш-градиент (цветные точки) или своя картинка;
// поверх — узор (рифлёнка, полутон, матовое стекло…), «чистая область» без узора и эффекты.
// Mesh.create(canvas, { scale, onReady }) → { set(params), pointer(x, y), destroy() } или null, если WebGL нет.
// params: {
//   points: [{ x, y, color:'#rrggbb' }] (2..6, x/y в 0..1) — для меша,
//   image: dataURL | null, dim: 0..1 — своя картинка и её затемнение,
//   mode: ключ MODES, warp, speed, density — 0..1,
//   clear: { x, y, w, h } | null — область без узора (доли экрана),
//   duo: ['#тёмный', '#светлый'] — для дуотона,
//   fx: { vignette, chroma, scan, bloom, particles — 0..1; mouse, daycycle — bool }
// }
const Mesh = (() => {
  const MAX = 6;
  const MODES = {
    mesh: 'Без узора',
    frosted: 'Матовое стекло',
    ribbed: 'Рифлёное стекло',
    halftone: 'Полутон',
    duotone: 'Дуотон',
    flow: 'Неоновые линии',
    ripple: 'Рельеф',
  };
  // номер режима в шейдере (uMode) — не зависит от порядка в меню
  const MODE_NUM = { mesh: 0, ribbed: 1, halftone: 2, flow: 3, ripple: 4, frosted: 5, duotone: 6 };
  const FX_DEFAULTS = { vignette: 0.5, chroma: 0, scan: 0, bloom: 0, particles: 0, mouse: false, daycycle: false };

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
uniform sampler2D uImg;
uniform int uHasImg;
uniform float uImgAsp;
uniform float uDim;
uniform vec4 uClear;
uniform vec3 uDuoA;
uniform vec3 uDuoB;
uniform vec2 uMouse;
uniform float uMouseAmt;
uniform float uVig;
uniform float uChroma;
uniform float uScan;
uniform float uBloom;
uniform float uPart;
uniform vec3 uDayTint;
uniform float uDayAmt;

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

// «жидкое» искажение координат + линза под курсором
vec2 warp(vec2 uv, float t, float asp) {
  vec2 q = uv;
  q += uWarp * 0.32 * vec2(noise(uv * 2.2 + vec2(t * 0.07, -t * 0.05)) - 0.5,
                           noise(uv * 2.2 + vec2(5.2 - t * 0.06, 1.3 + t * 0.08)) - 0.5);
  q += uWarp * 0.06 * vec2(sin(q.y * 5.0 + t * 0.3), cos(q.x * 4.0 - t * 0.25));
  if (uMouseAmt > 0.0) {
    vec2 d = (uv - uMouse) * vec2(asp, 1.0);
    q -= (uv - uMouse) * exp(-dot(d, d) * 14.0) * uMouseAmt * 0.4;
  }
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

// картинка «cover»: заполняет экран без искажения пропорций
vec2 coverUV(vec2 q, float asp) {
  vec2 s = asp > uImgAsp ? vec2(1.0, uImgAsp / asp) : vec2(asp / uImgAsp, 1.0);
  return (q - 0.5) * s + 0.5;
}

vec3 base(vec2 q, float t, float asp) {
  if (uHasImg == 1) return texture2D(uImg, coverUV(q, asp)).rgb * (1.0 - uDim);
  return meshAt(q, t, asp);
}
// источник с хроматической аберрацией (каналы чуть разъезжаются)
vec3 src(vec2 q, float t, float asp) {
  if (uChroma > 0.0) {
    vec2 d = vec2(uChroma * 0.007, 0.0);
    return vec3(base(q + d, t, asp).r, base(q, t, asp).g, base(q - d, t, asp).b);
  }
  return base(q, t, asp);
}

// самый тёмный цвет палитры — фон для полутона и неона
vec3 darkest() {
  if (uHasImg == 1) return vec3(0.05);
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
  vec2 q = warp(uv, t, asp);
  return fbm(vec2(q.x * asp, q.y) * mix(0.8, 2.0, uDensity) + vec2(t * 0.04, -t * 0.03)) * 3.0;
}

// матовое «пупырчатое» стекло: наклон из шума высокой частоты сдвигает выборку, плюс размытие и дымка
vec3 frosted(vec2 uv, float t, float asp) {
  float f = mix(26.0, 110.0, uDensity);
  vec2 p = vec2(uv.x * asp, uv.y) * f;
  float e = 0.35;
  float n0 = noise(p) + 0.5 * noise(p * 2.3 + 7.0);
  vec2 px = p + vec2(e, 0.0), py = p + vec2(0.0, e);
  float nx = noise(px) + 0.5 * noise(px * 2.3 + 7.0);
  float ny = noise(py) + 0.5 * noise(py * 2.3 + 7.0);
  vec2 g = vec2(nx - n0, ny - n0) / e;
  vec2 q = warp(uv, t, asp) + g * 0.016;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 10; i++) {
    float fi = float(i);
    float a = fi * 2.39996;
    vec2 o = vec2(cos(a) / asp, sin(a)) * 0.03 * sqrt((fi + 0.5) / 10.0);
    acc += src(q + o, t, asp);
  }
  vec3 col = mix(acc / 10.0, vec3(0.8, 0.81, 0.84), 0.1);
  float spec = pow(max(0.0, dot(normalize(vec3(-g * 0.9, 1.0)), normalize(vec3(-0.5, -0.7, 0.9)))), 24.0);
  return col + spec * 0.05;
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
    col = src(warp(q, t, asp), t, asp);
    col *= 0.86 + 0.24 * smoothstep(-0.5, 0.5, f);
    col += 0.07 * pow(max(0.0, 1.0 - abs(f - 0.3) * 5.0), 3.0);
  } else if (uMode == 2) {
    // полутон: точка тем больше, чем ярче источник под ней
    float cell = uRes.x / mix(38.0, 130.0, uDensity);
    vec2 p = gl_FragCoord.xy / cell;
    vec2 f = fract(p) - 0.5;
    vec2 cuv = (floor(p) + 0.5) * cell / uRes;
    cuv.y = 1.0 - cuv.y;
    vec3 c = src(warp(cuv, t, asp), t, asp);
    vec3 bg = darkest() * 0.7;
    float r = 0.52 * smoothstep(lum(bg) + 0.03, lum(bg) + 0.45, lum(c));
    float aa = 1.2 / cell;
    vec3 dotc = uHasImg == 1 ? mix(vec3(lum(c)), c, 0.6) * 1.15 : vivid(c);
    col = mix(bg, dotc, 1.0 - smoothstep(r - aa, r + aa, length(f)));
  } else if (uMode == 3) {
    // неоновые ленты вдоль изолиний: расстояние до изолинии = значение / градиент — толщина везде одна
    vec2 px = 1.0 / uRes;
    float v = flowField(uv, t, asp);
    vec2 g = vec2(flowField(uv + vec2(px.x, 0.0), t, asp) - v, flowField(uv + vec2(0.0, px.y), t, asp) - v);
    float sd = (v - floor(v + 0.5)) / max(length(g), 1e-5);
    float s = clamp(sd / (uRes.y * mix(0.035, 0.018, uDensity)), -2.0, 2.0);
    vec3 c = vivid(src(warp(uv, t, asp) + vec2(s * 0.14, -s * 0.07), t, asp));
    col = mix(darkest() * 0.55, c, exp(-s * s * 1.6));
    col += 0.28 * exp(-s * s * 14.0) * vec3(1.0);
  } else if (uMode == 4) {
    // рельеф: завихрение + частые гребни, которые затеняют цвет как выдавленные волны
    vec2 q = warp(uv, t, asp);
    vec2 c0 = vec2(0.55, 0.45);
    vec2 d = (q - c0) * vec2(asp, 1.0);
    float a = 1.6 * uWarp * exp(-dot(d, d) * 2.5);
    q = c0 + mat2(cos(a), -sin(a), sin(a), cos(a)) * (q - c0);
    float fl = fbm(vec2(q.x * asp, q.y) * 1.8 + t * 0.03);
    float ridge = sin(fl * mix(55.0, 150.0, uDensity) + t * 0.6);
    col = src(q, t, asp);
    col *= 0.88 + 0.1 * ridge;
    col += 0.08 * smoothstep(0.6, 1.0, ridge) * vivid(col);
  } else if (uMode == 5) {
    col = frosted(uv, t, asp);
  } else if (uMode == 6) {
    // дуотон: яркость → градиент из двух цветов
    col = mix(uDuoA, uDuoB, smoothstep(0.06, 0.94, lum(src(warp(uv, t, asp), t, asp))));
  } else {
    col = src(warp(uv, t, asp), t, asp);
  }

  // чистая область: там узора нет, источник как есть
  if (uClear.z > 0.0) {
    vec2 a = uClear.xy, b = uClear.xy + uClear.zw;
    float e = 1.5 / uRes.y;
    float m = smoothstep(a.x - e, a.x + e, uv.x) * (1.0 - smoothstep(b.x - e, b.x + e, uv.x))
            * smoothstep(a.y - e, a.y + e, uv.y) * (1.0 - smoothstep(b.y - e, b.y + e, uv.y));
    if (m > 0.0) col = mix(col, src(uv, t, asp), m);
  }

  // свечение: светлые места источника расплываются ореолом
  if (uBloom > 0.0) {
    vec3 b = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      float a = fi * 2.39996 + 0.5;
      vec2 o = vec2(cos(a) / asp, sin(a)) * 0.07 * sqrt((fi + 0.5) / 8.0);
      b += max(src(warp(uv + o, t, asp), t, asp) - 0.5, 0.0);
    }
    col += b / 8.0 * uBloom * 2.4;
  }

  // частицы: мелкая пыль, медленно плывёт вверх и мерцает
  if (uPart > 0.0) {
    for (int L = 0; L < 2; L++) {
      float fl = float(L);
      float n = 24.0 + fl * 20.0;
      vec2 g = vec2(uv.x * asp, uv.y + t * (0.012 + fl * 0.01)) * n;
      vec2 id = floor(g);
      vec2 f = fract(g) - 0.5;
      float h = hash(id + fl * 13.1);
      if (h > 1.0 - uPart * 0.5) {
        vec2 c = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
        float d = length(f - c * 0.7);
        float tw = 0.6 + 0.4 * sin(t * 2.0 + h * 40.0);
        col += smoothstep(0.07 - fl * 0.02, 0.0, d) * tw * (0.35 + 0.5 * h);
      }
    }
  }

  if (uScan > 0.0) col *= 1.0 - uScan * 0.4 * (0.5 + 0.5 * sin(uv.y * 3.14159 * 360.0));
  col = mix(col, col * uDayTint, uDayAmt);
  vec2 vd = (uv - vec2(0.5, 0.42)) * vec2(1.0, 1.15);
  col *= 1.0 - uVig * 0.8 * smoothstep(0.3, 0.95, length(vd));

  col += (hash(gl_FragCoord.xy + t) - 0.5) / 255.0; // дизеринг против полос
  gl_FragColor = vec4(col, 1.0);
}`;

  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };

  // оттенок по времени суток: ночь — темнее и синее, утро — тёплое, вечер — розовое
  const DAY_KEYS = [ // [час, r, g, b, сила]
    [0, 0.55, 0.62, 0.9, 0.55], [5, 0.6, 0.66, 0.9, 0.5], [8, 1.1, 0.96, 0.84, 0.4],
    [12, 1, 1, 1, 0], [16, 1, 1, 1, 0], [19, 1.12, 0.84, 0.82, 0.45], [22, 0.6, 0.64, 0.9, 0.5], [24, 0.55, 0.62, 0.9, 0.55],
  ];
  function dayTint(date = new Date()) {
    const hr = date.getHours() + date.getMinutes() / 60;
    const i = DAY_KEYS.findIndex(k => k[0] > hr);
    const a = DAY_KEYS[i - 1], b = DAY_KEYS[i];
    const k = (hr - a[0]) / (b[0] - a[0]);
    return [1, 2, 3, 4].map(j => a[j] + (b[j] - a[j]) * k);
  }

  // scale — доля разрешения экрана. Пятна гладкие, им хватает 0.35; узорам и фото нужно больше.
  // size — фиксированный размер (для миниатюр), тогда канвасу не нужно быть в DOM.
  // onReady — после первого кадра с текущим источником (картинка грузится асинхронно).
  function create(canvas, { scale = 0.35, fps = 30, size = null, onReady = null } = {}) {
    const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: !!size });
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

    const u = Object.fromEntries(['uRes', 'uTime', 'uCount', 'uPos', 'uCol', 'uWarp', 'uDensity', 'uMode', 'uImg', 'uHasImg', 'uImgAsp', 'uDim',
      'uClear', 'uDuoA', 'uDuoB', 'uMouse', 'uMouseAmt', 'uVig', 'uChroma', 'uScan', 'uBloom', 'uPart', 'uDayTint', 'uDayAmt']
      .map(n => [n, gl.getUniformLocation(prog, n)]));

    // текстура своей картинки (NPOT: только CLAMP и без мипмапов)
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.uniform1i(u.uImg, 0);
    let texSrc = null, imgAsp = 1, imgReady = false;

    let params = null;
    let time = 20 + Math.random() * 80; // накопленное время: смена скорости не дёргает картинку
    let last = 0, raf = 0, ready = false;
    let mouse = [0.5, 0.5], mouseT = [0.5, 0.5];

    const loadImage = (srcUrl) => {
      texSrc = srcUrl;
      imgReady = false;
      if (!srcUrl) return;
      const img = new Image();
      img.onload = () => {
        if (texSrc !== srcUrl) return; // пока грузилась, выбрали другую
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        imgAsp = img.width / img.height;
        imgReady = true;
        if (params) draw();
      };
      img.src = srcUrl;
    };

    const detailed = () => params.image || (params.mode && params.mode !== 'mesh') || params.fx?.scan > 0 || params.fx?.particles > 0;
    const resize = () => {
      let w, h;
      if (size) [w, h] = size;
      else {
        const s = detailed() ? Math.min(1, scale * 2.4) : scale;
        w = Math.round(canvas.clientWidth * s);
        h = Math.round(canvas.clientHeight * s);
      }
      w = Math.max(2, w); h = Math.max(2, h);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
    };

    const draw = () => {
      if (params.image && !imgReady) return; // ждём картинку, старый кадр остаётся
      resize();
      const fx = { ...FX_DEFAULTS, ...(params.fx || {}) };
      const pts = (params.points || []).slice(0, MAX);
      const pos = new Float32Array(MAX * 2), col = new Float32Array(MAX * 3);
      pts.forEach((p, i) => { pos.set([p.x, p.y], i * 2); col.set(hexToRgb(p.color), i * 3); });
      const duo = params.duo || ['#120c24', '#ffd2a8'];
      const c = params.clear;
      const day = fx.daycycle ? dayTint() : [1, 1, 1, 0];
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, time);
      gl.uniform1i(u.uCount, Math.max(1, pts.length));
      gl.uniform2fv(u.uPos, pos);
      gl.uniform3fv(u.uCol, col);
      gl.uniform1f(u.uWarp, params.warp ?? 0);
      gl.uniform1f(u.uDensity, params.density ?? 0.5);
      gl.uniform1i(u.uMode, MODE_NUM[params.mode] ?? 0);
      gl.uniform1i(u.uHasImg, params.image ? 1 : 0);
      gl.uniform1f(u.uImgAsp, imgAsp);
      gl.uniform1f(u.uDim, params.image ? (params.dim ?? 0) : 0);
      gl.uniform4f(u.uClear, c ? c.x : 0, c ? c.y : 0, c ? c.w : 0, c ? c.h : 0);
      gl.uniform3fv(u.uDuoA, hexToRgb(duo[0]));
      gl.uniform3fv(u.uDuoB, hexToRgb(duo[1]));
      gl.uniform2fv(u.uMouse, mouse);
      gl.uniform1f(u.uMouseAmt, fx.mouse ? 1 : 0);
      gl.uniform1f(u.uVig, fx.vignette);
      gl.uniform1f(u.uChroma, fx.chroma);
      gl.uniform1f(u.uScan, fx.scan);
      gl.uniform1f(u.uBloom, fx.bloom);
      gl.uniform1f(u.uPart, fx.particles);
      gl.uniform3f(u.uDayTint, day[0], day[1], day[2]);
      gl.uniform1f(u.uDayAmt, day[3]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!ready) { ready = true; onReady?.(); }
    };

    const animated = () => params.speed > 0 || params.fx?.particles > 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / fps - 2) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      time += dt * Math.max(params.speed, params.fx?.particles > 0 ? 0.15 : 0) * 2.2;
      // курсор догоняется плавно
      mouse = mouse.map((v, i) => v + (mouseT[i] - v) * 0.18);
      draw();
    };
    const startStop = () => {
      if (animated() && !raf) { last = 0; raf = requestAnimationFrame(loop); }
      if (!animated() && raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    const ro = size ? null : new ResizeObserver(() => { if (params) draw(); });
    ro?.observe(canvas);

    let once = 0;
    return {
      set(p) {
        params = p;
        if ((p.image || null) !== texSrc) loadImage(p.image || null);
        startStop();
        draw();
      },
      // для миниатюр: один кадр с заданным временем
      frame(p, at) { params = p; time = at; draw(); },
      // курсор в долях экрана; без анимации — отдельный кадр
      pointer(x, y) {
        mouseT = [x, y];
        if (!params?.fx?.mouse) return;
        if (!raf && !once) once = requestAnimationFrame(() => { once = 0; mouse = mouseT; draw(); });
      },
      destroy() {
        cancelAnimationFrame(raf);
        cancelAnimationFrame(once);
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
    { id: 'flame', title: 'Пламя', mode: 'mesh', warp: 0.9, speed: 0.25, grain: 0.1, density: 0.5, points: [
      { x: 0.7, y: 0.85, color: '#050101' }, { x: 0.2, y: 0.95, color: '#0a0202' },
      { x: 0.92, y: 0.08, color: '#3a0600' }, { x: 0.55, y: 0.25, color: '#b83a06' },
      { x: 0.1, y: 0.2, color: '#ff8a12' }, { x: 0.32, y: 0.55, color: '#fff3d0' }] },
    { id: 'mono', title: 'Монохром', mode: 'mesh', warp: 0.8, speed: 0.2, grain: 0.15, density: 0.5, points: [
      { x: 0.15, y: 0.2, color: '#050608' }, { x: 0.85, y: 0.15, color: '#16181c' },
      { x: 0.25, y: 0.9, color: '#e9ecf0' }, { x: 0.8, y: 0.55, color: '#c9ced6' },
      { x: 0.9, y: 0.95, color: '#0c0d10' }] },
    { id: 'silk', title: 'Шёлк', mode: 'halftone', warp: 1, speed: 0.2, grain: 0.05, density: 0.95, points: [
      { x: 0.6, y: 0.6, color: '#0e0e0e' }, { x: 0.05, y: 0.05, color: '#d8d8d8' },
      { x: 0.35, y: 0.3, color: '#6a6a6a' }, { x: 0.7, y: 0.45, color: '#8c8c8c' },
      { x: 0.2, y: 0.8, color: '#3a3a3a' }, { x: 0.95, y: 0.9, color: '#141414' }] },
    { id: 'dusk', title: 'Закат', mode: 'mesh', warp: 0.5, speed: 0.35, grain: 0.3, density: 0.5, points: [
      { x: 0.5, y: 0.1, color: '#140812' }, { x: 0.15, y: 0.3, color: '#ff5a3c' },
      { x: 0.8, y: 0.45, color: '#b8327a' }, { x: 0.45, y: 0.9, color: '#ffb347' }] },
    { id: 'lagoon', title: 'Лагуна', mode: 'mesh', warp: 0.55, speed: 0.35, grain: 0.3, density: 0.5, points: [
      { x: 0.55, y: 0.55, color: '#03101a' }, { x: 0.12, y: 0.15, color: '#0f7bd8' },
      { x: 0.88, y: 0.3, color: '#16c79a' }, { x: 0.4, y: 0.92, color: '#1d3fa8' }] },
    { id: 'forest', title: 'Лес', mode: 'mesh', warp: 0.55, speed: 0.35, grain: 0.3, density: 0.5, points: [
      { x: 0.6, y: 0.5, color: '#050d09' }, { x: 0.12, y: 0.15, color: '#1f7a4d' },
      { x: 0.88, y: 0.3, color: '#7fb33a' }, { x: 0.4, y: 0.92, color: '#0f4f5c' }] },
    { id: 'graphite', title: 'Графит', mode: 'mesh', warp: 0.5, speed: 0.3, grain: 0.35, density: 0.5, points: [
      { x: 0.6, y: 0.5, color: '#0b0b0d' }, { x: 0.12, y: 0.15, color: '#3a3a44' },
      { x: 0.88, y: 0.3, color: '#26262d' }, { x: 0.4, y: 0.92, color: '#4a4a52' }] },
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

  // Примерная яркость фона в точке экрана (x, y в 0..1) — та же формула смешивания, что в шейдере,
  // без искажения и дрейфа. Нужна для «авто»-цвета текста в блоках.
  function lumAt(p, x, y, aspect = 16 / 9) {
    const luma = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
    let acc = [0, 0, 0], ws = 0, dark = 1;
    for (const pt of p.points) {
      const c = hexToRgb(pt.color);
      dark = Math.min(dark, luma(c));
      const dx = (x - pt.x) * aspect, dy = y - pt.y;
      const w = 1 / Math.pow(dx * dx + dy * dy + 0.003, 1.35);
      acc = acc.map((v, i) => v + c[i] * w);
      ws += w;
    }
    const c = acc.map(v => v / ws);
    const l = luma(c);
    if (p.mode === 'halftone') {
      // как в шейдере: радиус точки от яркости, фон — тёмный; яркость = доля клетки под точкой
      const bg = dark * 0.7;
      const t = Math.min(1, Math.max(0, (l - bg - 0.03) / 0.42));
      const r = 0.52 * t * t * (3 - 2 * t);
      const cover = Math.min(1, Math.PI * r * r);
      const vivid = luma(c.map(v => v / Math.max(...c, 0.001) * 0.97));
      return bg * (1 - cover) + vivid * cover;
    }
    if (p.mode === 'flow') return dark + (l - dark) * 0.2; // ленты узкие, почти всё — тёмный фон
    if (p.mode === 'frosted') return l * 0.9 + 0.08;
    if (p.mode === 'duotone') {
      const [a, b] = (p.duo || ['#120c24', '#ffd2a8']).map(x => luma(hexToRgb(x)));
      return a + (b - a) * l;
    }
    return l;
  }

  // CSS-подобие меша — для первого кадра до WebGL и если WebGL нет
  function cssPreview(p) {
    return p.points.map(pt => `radial-gradient(circle at ${pt.x * 100}% ${pt.y * 100}%, ${pt.color}, transparent 65%)`).join(', ') +
      `, ${p.points[0].color}`;
  }

  return { create, thumb, random, cssPreview, lumAt, hsl, dayTint, PRESETS, MODES, FX_DEFAULTS, MAX };
})();
