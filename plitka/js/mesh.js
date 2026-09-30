// Меш-градиент на WebGL: цветные точки + искажение шумом + медленный дрейф.
// Mesh.create(canvas, { scale }) → { set(params), destroy() } или null, если WebGL нет.
// params: { points: [{ x, y, color:'#rrggbb' }] (2..6, x/y в 0..1), warp 0..1, speed 0..1, grain 0..1 }
const Mesh = (() => {
  const MAX = 6;

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

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y; // (0,0) — левый верх, как в CSS
  float asp = uRes.x / uRes.y;
  float t = uTime;

  // «жидкое» искажение: шум + лёгкий завиток
  vec2 q = uv;
  q += uWarp * 0.32 * vec2(noise(uv * 2.2 + vec2(t * 0.07, -t * 0.05)) - 0.5,
                           noise(uv * 2.2 + vec2(5.2 - t * 0.06, 1.3 + t * 0.08)) - 0.5);
  q += uWarp * 0.06 * vec2(sin(q.y * 5.0 + t * 0.3), cos(q.x * 4.0 - t * 0.25));

  // смешиваем цвета точек по обратному расстоянию; в sRGB, а не в линейном — так глубже и темнее
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
  vec3 col = acc / wsum;
  col += (hash(gl_FragCoord.xy + t) - 0.5) / 255.0; // дизеринг против полос
  gl_FragColor = vec4(col, 1.0);
}`;

  const hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };

  function create(canvas, { scale = 0.35, fps = 30 } = {}) {
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

    const u = Object.fromEntries(['uRes', 'uTime', 'uCount', 'uPos', 'uCol', 'uWarp'].map(n => [n, gl.getUniformLocation(prog, n)]));

    let params = null;
    let time = Math.random() * 100; // накопленное время: смена скорости не дёргает картинку
    let last = 0, raf = 0;

    const resize = () => {
      // градиент гладкий — рендерим в пониженном разрешении, браузер растянет
      const w = Math.max(2, Math.round(canvas.clientWidth * scale));
      const h = Math.max(2, Math.round(canvas.clientHeight * scale));
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

    const ro = new ResizeObserver(() => { if (params) draw(); });
    ro.observe(canvas);

    return {
      set(p) {
        params = p;
        if (p.speed > 0 && !raf) { last = 0; raf = requestAnimationFrame(loop); }
        if (!(p.speed > 0) && raf) { cancelAnimationFrame(raf); raf = 0; }
        draw();
      },
      destroy() {
        cancelAnimationFrame(raf);
        raf = 0;
        ro.disconnect();
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      },
    };
  }

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

  // CSS-подобие меша — для свотча и первого кадра до WebGL
  function cssPreview(p) {
    return p.points.map(pt => `radial-gradient(circle at ${pt.x * 100}% ${pt.y * 100}%, ${pt.color}, transparent 65%)`).join(', ') +
      `, ${p.points[0].color}`;
  }

  return { create, random, cssPreview, MAX };
})();
