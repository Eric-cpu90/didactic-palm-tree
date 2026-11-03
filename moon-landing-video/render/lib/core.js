// Core helpers: canvas, fonts, easing, seeded randomness, text and UI widgets.
const path = require('path');
const { createCanvas, GlobalFonts, Path2D } = require('@napi-rs/canvas');

const W = 1920, H = 1080, FPS = 30;
const ROOT = path.resolve(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'build', 'assets');

const FONT_FILES = {
  Sans: 'NotoSansSC-Regular.otf', SansB: 'NotoSansSC-Bold.otf', SansH: 'NotoSansSC-Black.otf',
  Serif: 'NotoSerifSC-Bold.otf', SerifH: 'NotoSerifSC-Black.otf', Brush: 'MaShanZheng-Regular.ttf',
};
for (const [alias, f] of Object.entries(FONT_FILES)) {
  GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts', f), alias);
}

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const ease = {
  inOut: (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
  out: (x) => 1 - Math.pow(1 - clamp(x), 3),
  in: (x) => Math.pow(clamp(x), 3),
  outBack: (x) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x))),
  sine: (x) => -(Math.cos(Math.PI * clamp(x)) - 1) / 2,
};
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// cheap deterministic 1D noise for flicker
function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const h = (n) => { const s = Math.sin((n + seed * 101.3) * 127.1) * 43758.5453; return s - Math.floor(s); };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}
// cubic bezier point
function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
          u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
}
function bezTan(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
          3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])];
}
// polyline helpers (arc-length parametrised)
function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function polyAt(pts, f) {
  const L = polyLen(pts) * clamp(f); let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + d >= L || i === pts.length - 1) {
      const u = d > 0 ? clamp((L - acc) / d) : 0;
      return { x: lerp(pts[i - 1][0], pts[i][0], u), y: lerp(pts[i - 1][1], pts[i][1], u),
               a: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) };
    }
    acc += d;
  }
  const p = pts[pts.length - 1]; return { x: p[0], y: p[1], a: 0 };
}
function bezPts(p0, p1, p2, p3, n = 80) { const a = []; for (let i = 0; i <= n; i++) a.push(bez(p0, p1, p2, p3, i / n)); return a; }
function strokePoly(ctx, pts, f0 = 0, f1 = 1) {
  // draw the portion of the polyline between fractions f0..f1
  const L = polyLen(pts); const a = L * f0, b = L * f1; let acc = 0; let started = false;
  ctx.beginPath();
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const s0 = acc, s1 = acc + d; acc = s1;
    if (s1 < a || s0 > b || d === 0) continue;
    const u0 = clamp((a - s0) / d), u1 = clamp((b - s0) / d);
    const x0 = lerp(pts[i - 1][0], pts[i][0], u0), y0 = lerp(pts[i - 1][1], pts[i][1], u0);
    const x1 = lerp(pts[i - 1][0], pts[i][0], u1), y1 = lerp(pts[i - 1][1], pts[i][1], u1);
    if (!started) { ctx.moveTo(x0, y0); started = true; }
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
}

// ---------- palette ----------
const C = {
  gold: '#f5c66b', gold2: '#ffdf9e', red: '#e0392b', red2: '#ff5a47', cyan: '#5fd3ff', cyan2: '#a8e9ff',
  green: '#59e39a', ink: '#04060d', navy: '#0a1430', white: '#ffffff', dim: 'rgba(255,255,255,0.62)',
  panel: 'rgba(12,22,48,0.62)', panelLine: 'rgba(140,190,255,0.35)', orange: '#ff9a3c',
};

// ---------- text ----------
function font(ctx, size, fam = 'SansB') { ctx.font = `${size}px ${fam}`; }
function text(ctx, str, x, y, { size = 40, fam = 'SansB', color = '#fff', align = 'left', base = 'alphabetic', alpha = 1, spacing = 0, shadow = 0, shadowColor = 'rgba(0,0,0,0.7)', stroke = 0, strokeColor = 'rgba(0,0,0,0.8)' } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha; font(ctx, size, fam); ctx.textBaseline = base;
  if (shadow) { ctx.shadowColor = shadowColor; ctx.shadowBlur = shadow; }
  if (spacing) {
    const chars = [...str]; const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((s, w) => s + w, 0) + spacing * (chars.length - 1);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.textAlign = 'left';
    chars.forEach((c, i) => {
      if (stroke) { ctx.lineWidth = stroke; ctx.strokeStyle = strokeColor; ctx.lineJoin = 'round'; ctx.strokeText(c, cx, y); }
      ctx.fillStyle = color; ctx.fillText(c, cx, y); cx += widths[i] + spacing;
    });
  } else {
    ctx.textAlign = align;
    if (stroke) { ctx.lineWidth = stroke; ctx.strokeStyle = strokeColor; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  ctx.restore();
}
function measure(ctx, str, size, fam = 'SansB') { ctx.save(); font(ctx, size, fam); const w = ctx.measureText(str).width; ctx.restore(); return w; }
// reveal characters one by one (typewriter with fade), returns nothing
function textReveal(ctx, str, x, y, p, opts = {}) {
  const chars = [...str]; const n = chars.length; const size = opts.size || 40; const fam = opts.fam || 'SansB';
  ctx.save(); font(ctx, size, fam);
  const sp = opts.spacing || 0;
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((s, w) => s + w, 0) + sp * (n - 1);
  let cx = opts.align === 'center' ? x - total / 2 : opts.align === 'right' ? x - total : x;
  ctx.restore();
  chars.forEach((c, i) => {
    const a = clamp(p * (n + 3) - i, 0, 3) / 3;
    if (a > 0) text(ctx, c, cx, y + (1 - ease.out(a)) * (opts.rise ?? 18), { ...opts, align: 'left', spacing: 0, alpha: (opts.alpha ?? 1) * a });
    cx += widths[i] + sp;
  });
}
function wrapText(ctx, str, maxW, size, fam = 'SansB') {
  ctx.save(); font(ctx, size, fam);
  const lines = []; let cur = '';
  const noStart = '，。、；：？！”）》」』…—';
  for (const ch of [...str]) {
    const test = cur + ch;
    if (ctx.measureText(test).width > maxW && cur.length > 0) {
      if (noStart.includes(ch)) { cur = test; continue; }
      lines.push(cur); cur = ch;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  ctx.restore();
  // balance two lines
  if (lines.length === 2) {
    const all = [...str]; const half = Math.ceil(all.length / 2);
    let best = half;
    for (let d = 0; d < 6; d++) { for (const k of [half + d, half - d]) { if (k > 0 && k < all.length && !noStart.includes(all[k])) { best = k; d = 99; break; } } }
    return [all.slice(0, best).join(''), all.slice(best).join('')];
  }
  return lines;
}

// ---------- shapes ----------
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function panel(ctx, x, y, w, h, { alpha = 1, r = 18, fill = C.panel, line = C.panelLine, glow = 0, accent = null } = {}) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  if (glow) { ctx.shadowColor = 'rgba(80,160,255,0.45)'; ctx.shadowBlur = glow; }
  rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5; ctx.strokeStyle = line; ctx.stroke();
  if (accent) { ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip(); ctx.fillStyle = accent; ctx.fillRect(x, y, 6, h); ctx.restore(); }
  ctx.restore();
}
function glowDot(ctx, x, y, r, color, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  g.addColorStop(0, color); g.addColorStop(0.25, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function arrowHead(ctx, x, y, ang, size, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size * 0.7, size * 0.6); ctx.lineTo(-size * 0.4, 0); ctx.lineTo(-size * 0.7, -size * 0.6); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// label with leader line from point (px,py) to text at (tx,ty)
function callout(ctx, px, py, tx, ty, title, sub, p, { color = C.cyan, align = 'left', size = 34 } = {}) {
  if (p <= 0) return;
  const a = ease.out(p);
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = a;
  const mx = lerp(px, tx, a), my = lerp(py, ty, a);
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(mx, my); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const tp = prog(p, 0.4, 1);
  const dx = align === 'left' ? 12 : -12;
  text(ctx, title, tx + dx, ty - 6, { size, fam: 'SansB', color: '#fff', align, alpha: tp, shadow: 8 });
  if (sub) text(ctx, sub, tx + dx, ty + size * 0.95, { size: size * 0.62, fam: 'Sans', color: C.dim, align, alpha: tp, shadow: 6 });
}

// Chinese national flag (proportions 3:2) with the official star layout
function star(ctx, cx, cy, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.382; const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
  }
  ctx.closePath(); ctx.fill();
}
function flagCN(ctx, x, y, w, wave = 0, t = 0) {
  const h = (w * 2) / 3, u = w / 30;
  ctx.save(); ctx.translate(x, y);
  if (wave) {
    // draw in vertical strips to fake a gentle wave
    const off = createCanvas(Math.ceil(w), Math.ceil(h)); const o = off.getContext('2d');
    flagCN(o, 0, 0, w);
    const n = 30;
    for (let i = 0; i < n; i++) {
      const sx = (i * w) / n, dy = Math.sin(i / n * 5 - t * 3) * wave * (i / n) * u * 2;
      const sh = 1 - 0.12 * (i / n) * Math.max(0, Math.sin(i / n * 5 - t * 3 + 1));
      ctx.drawImage(off, sx, 0, w / n + 1, h, sx, dy, w / n + 1, h);
      ctx.fillStyle = `rgba(0,0,0,${(1 - sh) * 1.5})`; ctx.fillRect(sx, dy, w / n + 1, h);
    }
    ctx.restore(); return;
  }
  ctx.fillStyle = '#de2910'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffde00';
  star(ctx, 5 * u, 5 * u, 3 * u, 0);
  for (const [sx, sy] of [[10, 2], [12, 4], [12, 7], [10, 9]]) {
    const ang = Math.atan2(5 - sy, 5 - sx); // point toward the big star
    star(ctx, sx * u, sy * u, u, ang + Math.PI / 2);
  }
  ctx.restore();
}

// ---------- subtitles ----------
function drawSubtitle(ctx, str, alpha) {
  if (!str || alpha <= 0) return;
  const size = 44; const lines = wrapText(ctx, str, 1500, size, 'SansB');
  const lh = size * 1.42; const n = lines.length;
  const baseY = H - 70 - (n - 1) * lh;
  ctx.save(); ctx.globalAlpha = alpha;
  let maxW = 0; for (const l of lines) maxW = Math.max(maxW, measure(ctx, l, size, 'SansB'));
  const g = ctx.createLinearGradient(0, baseY - lh, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.35, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, baseY - lh * 1.1, W, H - baseY + lh * 1.1);
  ctx.restore();
  lines.forEach((l, i) => text(ctx, l, W / 2, baseY + i * lh, { size, fam: 'SansB', align: 'center', alpha, stroke: 6, strokeColor: 'rgba(0,0,0,0.75)', shadow: 10 }));
}

// stepper widget for multi-step procedures
function stepper(ctx, steps, cur, x, y, w, alpha = 1, { color = C.gold, title = '' } = {}) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  const n = steps.length, gap = w / (n - 1);
  if (title) text(ctx, title, x - 40, y + 9, { size: 22, fam: 'SansB', color: C.dim, align: 'right' });
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
  ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + gap * cur, y); ctx.stroke();
  steps.forEach((s, i) => {
    const cx = x + gap * i; const active = i === cur, done = i < cur;
    ctx.beginPath(); ctx.arc(cx, y, active ? 17 : 13, 0, Math.PI * 2);
    ctx.fillStyle = active ? color : done ? 'rgba(245,198,107,0.55)' : 'rgba(20,30,60,0.95)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = active || done ? color : 'rgba(255,255,255,0.35)'; ctx.stroke();
    if (active) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 22; ctx.stroke(); ctx.restore(); }
    text(ctx, String(i + 1), cx, y + 1, { size: active ? 20 : 16, fam: 'SansH', align: 'center', base: 'middle', color: active ? '#1a1206' : done ? '#1a1206' : '#cfd8ff' });
    text(ctx, s, cx, y + 46, { size: active ? 24 : 19, fam: active ? 'SansB' : 'Sans', align: 'center', color: active ? '#fff' : 'rgba(255,255,255,0.55)' });
  });
  ctx.restore();
}

module.exports = {
  W, H, FPS, ROOT, ASSETS, createCanvas, Path2D, clamp, lerp, prog, smooth, ease, rng, noise1, bez, bezTan, bezPts,
  polyLen, polyAt, strokePoly, C, font, text, measure, textReveal, wrapText, rr, panel, glowDot, arrowHead, callout,
  star, flagCN, drawSubtitle, stepper,
};
