// Vector illustrations: space backgrounds, rockets, spacecraft, astronauts, terrain, effects.
const { createCanvas, W, H, clamp, lerp, prog, ease, rng, noise1, C, rr, text, flagCN } = require('./core');

// ---------------- space background ----------------
const starCache = new Map();
function starLayer(seed, w, h, n) {
  const key = `${seed}|${w}|${h}|${n}`;
  if (starCache.has(key)) return starCache.get(key);
  const cv = createCanvas(w, h); const c = cv.getContext('2d'); const R = rng(seed);
  // faint milky-way band
  for (let i = 0; i < 260; i++) {
    const u = R(); const x = u * w, y = h * 0.35 + (u - 0.5) * h * 0.5 + (R() - 0.5) * h * 0.22;
    const r = 40 + R() * 140; const g = c.createRadialGradient(x, y, 0, x, y, r);
    const hue = R() < 0.5 ? '120,140,255' : '255,170,200';
    g.addColorStop(0, `rgba(${hue},${0.018 + R() * 0.02})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h, m = Math.pow(R(), 3); const r = 0.4 + m * 1.6;
    const tint = R(); const col = tint < 0.15 ? '255,220,190' : tint < 0.3 ? '190,210,255' : '255,255,255';
    c.fillStyle = `rgba(${col},${0.25 + m * 0.75})`; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  const bright = []; for (let i = 0; i < 40; i++) bright.push([R() * w, R() * h, 1 + R() * 1.6, R() * 10]);
  const o = { cv, bright }; starCache.set(key, o); return o;
}
function space(ctx, t, { seed = 7, ox = 0, oy = 0, alpha = 1, top = '#02040b', bottom = '#071027', density = 1 } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (alpha <= 0) return;
  const L = starLayer(seed, W + 400, H + 300, Math.round(1400 * density));
  ctx.save(); ctx.globalAlpha = alpha;
  const x = -200 + (((ox % 400) + 400) % 400) - 200, y = -150 + oy;
  ctx.drawImage(L.cv, x, y);
  for (const [bx, by, r, ph] of L.bright) {
    const tw = 0.55 + 0.45 * Math.sin(t * 2.2 + ph * 7);
    const px = bx + x, py = by + y; if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;
    ctx.globalAlpha = alpha * tw; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = alpha * tw * 0.35; ctx.fillRect(px - r * 4, py - 0.5, r * 8, 1); ctx.fillRect(px - 0.5, py - r * 4, 1, r * 8);
  }
  ctx.restore();
}
function vignette(ctx, strength = 0.55) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function sunGlare(ctx, x, y, r, alpha = 1) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(0.08, 'rgba(255,240,200,0.8)'); g.addColorStop(0.3, 'rgba(255,200,140,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------------- effects ----------------
// rocket plume pointing down (+y) from (x,y)
function plume(ctx, x, y, w, len, t, { intensity = 1, seed = 0, color = 'orange' } = {}) {
  if (intensity <= 0) return;
  const fl = 0.85 + 0.3 * noise1(t * 24, seed); const L = len * fl * intensity;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const outer = color === 'blue' ? ['rgba(120,180,255,0.0)', 'rgba(140,190,255,0.55)', 'rgba(220,235,255,0.95)'] : ['rgba(255,120,30,0)', 'rgba(255,150,50,0.6)', 'rgba(255,240,200,1)'];
  const g = ctx.createLinearGradient(x, y, x, y + L);
  g.addColorStop(0, outer[2]); g.addColorStop(0.25, outer[1]); g.addColorStop(1, outer[0]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w / 2, y);
  ctx.bezierCurveTo(x - w * 0.9, y + L * 0.3, x - w * 0.35, y + L * 0.8, x, y + L);
  ctx.bezierCurveTo(x + w * 0.35, y + L * 0.8, x + w * 0.9, y + L * 0.3, x + w / 2, y); ctx.closePath(); ctx.fill();
  const g2 = ctx.createLinearGradient(x, y, x, y + L * 0.45);
  g2.addColorStop(0, 'rgba(255,255,255,1)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g2; ctx.beginPath(); ctx.moveTo(x - w * 0.3, y); ctx.quadraticCurveTo(x, y + L * 0.55, x + w * 0.3, y); ctx.fill();
  const g3 = ctx.createRadialGradient(x, y + L * 0.2, 0, x, y + L * 0.2, w * 2.2);
  g3.addColorStop(0, color === 'blue' ? 'rgba(120,170,255,0.35)' : 'rgba(255,170,80,0.35)'); g3.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g3; ctx.fillRect(x - w * 2.2, y + L * 0.2 - w * 2.2, w * 4.4, w * 4.4);
  ctx.restore();
}
// small engine jet in arbitrary direction (angle a = direction of exhaust)
function jet(ctx, x, y, a, len, w, t, { color = 'blue', intensity = 1, seed = 1 } = {}) {
  if (intensity <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a - Math.PI / 2); plume(ctx, 0, 0, w, len, t, { intensity, seed, color }); ctx.restore();
}
// deterministic smoke clouds at launch
function launchSmoke(ctx, t, x, groundY, { n = 90, seed = 3, spread = 1, glow = 1, tint = [235, 235, 240] } = {}) {
  if (t <= 0) return;
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const ts = R() * 6.0, dir = R() < 0.5 ? -1 : 1, v = (120 + R() * 380) * spread, up = 10 + R() * 120, r0 = 30 + R() * 50;
    const age = t - ts; if (age <= 0) continue;
    const k = 1 - Math.exp(-age * 0.9);
    const px = x + dir * v * k * 2.2 + (R() - 0.5) * 60, py = groundY - 20 - up * k - age * 6;
    const r = r0 + age * 38 + k * 90;
    const a = clamp(age * 2) * clamp(1 - age / 14) * 0.5;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    const lit = clamp(1 - Math.abs(px - x) / 700) * glow;
    const cr = Math.round(lerp(tint[0], 255, lit)), cg = Math.round(lerp(tint[1], 190, lit)), cb = Math.round(lerp(tint[2], 130, lit));
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`); g.addColorStop(0.6, `rgba(${cr - 30},${cg - 30},${cb - 30},${a * 0.6})`); g.addColorStop(1, `rgba(${cr - 60},${cg - 60},${cb - 60},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }
}
// radial dust burst on the lunar surface
function dustBurst(ctx, x, y, t, { power = 1, seed = 5, n = 60, color = '180,175,165' } = {}) {
  if (power <= 0) return;
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const dir = R() < 0.5 ? -1 : 1; const sp = (60 + R() * 260) * power; const ph = R();
    const age = ((t * 0.9 + ph) % 1);
    const px = x + dir * sp * age * 1.6, py = y - 4 - R() * 18 * power * (1 - age) - 6 * age;
    const r = 10 + age * 40 * power;
    ctx.fillStyle = `rgba(${color},${0.32 * (1 - age) * power})`;
    ctx.beginPath(); ctx.ellipse(px, py, r * 1.6, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  }
}
function plasma(ctx, x, y, a, s, t, intensity = 1) { // reentry glow; a = direction of travel
  if (intensity <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalCompositeOperation = 'lighter';
  const fl = 0.85 + 0.3 * noise1(t * 18, 4);
  const g = ctx.createRadialGradient(s * 0.3, 0, 0, s * 0.3, 0, s * 1.6 * fl);
  g.addColorStop(0, `rgba(255,255,230,${0.95 * intensity})`); g.addColorStop(0.3, `rgba(255,170,70,${0.7 * intensity})`); g.addColorStop(1, 'rgba(255,60,20,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s * 0.3, 0, s * 1.6 * fl, 0, Math.PI * 2); ctx.fill();
  const g2 = ctx.createLinearGradient(0, 0, -s * 6, 0);
  g2.addColorStop(0, `rgba(255,170,80,${0.6 * intensity})`); g2.addColorStop(1, 'rgba(255,80,30,0)');
  ctx.fillStyle = g2; ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.9); ctx.quadraticCurveTo(-s * 3, -s * 0.6 * fl, -s * 6.5 * fl, 0); ctx.quadraticCurveTo(-s * 3, s * 0.6 * fl, s * 0.2, s * 0.9); ctx.fill();
  ctx.restore();
}

// ---------------- materials ----------------
function goldFoil(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#8a5a12'); g.addColorStop(0.25, '#f2c25a'); g.addColorStop(0.45, '#b9822a'); g.addColorStop(0.7, '#ffe08a'); g.addColorStop(1, '#7a4c10');
  return g;
}
function metal(ctx, x0, x1, light = '#f4f6fa', dark = '#9aa3b2') {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, dark); g.addColorStop(0.35, light); g.addColorStop(0.6, light); g.addColorStop(1, dark);
  return g;
}
function solarPanel(ctx, x, y, w, h, cols = 6) {
  ctx.fillStyle = '#c9ced8'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#16306e'); g.addColorStop(0.5, '#2a5bb8'); g.addColorStop(1, '#122656');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(160,200,255,0.35)'; ctx.lineWidth = 1;
  for (let i = 1; i < cols; i++) { ctx.beginPath(); ctx.moveTo(x + (w * i) / cols, y); ctx.lineTo(x + (w * i) / cols, y + h); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
}
function nozzle(ctx, x, y, w, h, flip = false) { // bell nozzle opening downward from (x,y)
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(1, -1);
  const g = metal(ctx, -w / 2, w / 2, '#d8dbe2', '#3c3f47');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-w * 0.22, 0); ctx.lineTo(w * 0.22, 0); ctx.quadraticCurveTo(w * 0.3, h * 0.6, w / 2, h); ctx.lineTo(-w / 2, h); ctx.quadraticCurveTo(-w * 0.3, h * 0.6, -w * 0.22, 0); ctx.fill();
  ctx.restore();
}

// ---------------- rockets (side view, base at (x,y), s = px per metre) ----------------
function noseCone(ctx, x, yBase, w, h, fill) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(x - w / 2, yBase); ctx.bezierCurveTo(x - w / 2, yBase - h * 0.6, x - w * 0.12, yBase - h, x, yBase - h);
  ctx.bezierCurveTo(x + w * 0.12, yBase - h, x + w / 2, yBase - h * 0.6, x + w / 2, yBase); ctx.closePath(); ctx.fill();
}
function bodyTube(ctx, x, yTop, w, h, { bands = [], light = '#ffffff', dark = '#a9b1bf' } = {}) {
  ctx.fillStyle = metal(ctx, x - w / 2, x + w / 2, light, dark); ctx.fillRect(x - w / 2, yTop, w, h);
  for (const [f, bh, col] of bands) { ctx.fillStyle = col; ctx.fillRect(x - w / 2, yTop + h * f, w, bh); }
}
function cz5(ctx, x, y, s, { flame = 0, t = 0 } = {}) {
  const core = 5 * s, bw = 3.35 * s;
  // boosters (two visible)
  for (const d of [-1, 1]) {
    const bx = x + d * (core / 2 + bw / 2 - 0.2 * s);
    bodyTube(ctx, bx, y - 27.6 * s, bw, 27.6 * s, { bands: [[0.02, 2, 'rgba(0,0,0,0.15)']] });
    noseCone(ctx, bx, y - 27.6 * s, bw, 6 * s, metal(ctx, bx - bw / 2, bx + bw / 2));
    nozzle(ctx, bx, y, bw * 0.7, 2 * s);
  }
  // core + second stage + fairing
  bodyTube(ctx, x, y - 33 * s, core, 33 * s, { bands: [[0.0, 2, 'rgba(0,0,0,0.18)'], [0.5, 1.5, 'rgba(0,0,0,0.12)']] });
  bodyTube(ctx, x, y - 44 * s, core, 11 * s, { bands: [[0.0, 2, 'rgba(0,0,0,0.2)']] });
  const fw = 5.2 * s; bodyTube(ctx, x, y - 50 * s, fw, 6 * s);
  noseCone(ctx, x, y - 50 * s, fw, 7 * s, metal(ctx, x - fw / 2, x + fw / 2));
  // markings
  ctx.save(); ctx.beginPath(); ctx.rect(x - core / 2, y - 44 * s, core, 44 * s); ctx.clip();
  flagCN(ctx, x - core * 0.28, y - 31 * s, core * 0.56);
  ctx.restore();
  text(ctx, '中', x, y - 22 * s, { size: core * 0.42, fam: 'SansH', color: '#c8102e', align: 'center' });
  text(ctx, '国', x, y - 18.5 * s, { size: core * 0.42, fam: 'SansH', color: '#c8102e', align: 'center' });
  text(ctx, '航', x, y - 15 * s, { size: core * 0.42, fam: 'SansH', color: '#c8102e', align: 'center' });
  text(ctx, '天', x, y - 11.5 * s, { size: core * 0.42, fam: 'SansH', color: '#c8102e', align: 'center' });
  nozzle(ctx, x - core * 0.2, y, core * 0.38, 2.4 * s); nozzle(ctx, x + core * 0.2, y, core * 0.38, 2.4 * s);
  if (flame > 0) {
    for (const d of [-1, 1]) plume(ctx, x + d * (core / 2 + bw / 2), y + 2 * s, bw * 1.0, 26 * s, t, { intensity: flame, seed: 3 + d });
    plume(ctx, x, y + 2.4 * s, core * 1.1, 30 * s, t, { intensity: flame, seed: 9 });
  }
  return { top: y - 57 * s };
}
// Long March 10: three 5 m cores (crewed version carries Mengzhou + escape tower)
function cz10(ctx, x, y, s, { payload = 'mengzhou', flame = 0, t = 0, boosters = true } = {}) {
  const core = 5 * s;
  if (boosters) for (const d of [-1, 1]) {
    const bx = x + d * core * 0.98;
    bodyTube(ctx, bx, y - 52 * s, core, 52 * s, { bands: [[0.03, 2, 'rgba(0,0,0,0.15)'], [0.6, 1.5, 'rgba(0,0,0,0.1)']] });
    noseCone(ctx, bx, y - 52 * s, core, 9 * s, metal(ctx, bx - core / 2, bx + core / 2));
    for (const k of [-0.25, 0.25]) nozzle(ctx, bx + k * core, y, core * 0.34, 2.4 * s);
  }
  bodyTube(ctx, x, y - 56 * s, core, 56 * s, { bands: [[0.0, 2, 'rgba(0,0,0,0.18)'], [0.55, 1.5, 'rgba(0,0,0,0.12)']] });
  bodyTube(ctx, x, y - 70 * s, core, 14 * s, { bands: [[0.0, 2, 'rgba(0,0,0,0.2)']] });
  bodyTube(ctx, x, y - 77 * s, core, 7 * s, { bands: [[0.0, 2, 'rgba(0,0,0,0.2)']] });
  ctx.save(); ctx.beginPath(); ctx.rect(x - core / 2, y - 56 * s, core, 56 * s); ctx.clip();
  flagCN(ctx, x - core * 0.28, y - 50 * s, core * 0.56); ctx.restore();
  ['中', '国', '航', '天'].forEach((ch, i) => text(ctx, ch, x, y - (40 - i * 3.5) * s, { size: core * 0.42, fam: 'SansH', color: '#c8102e', align: 'center' }));
  if (payload === 'mengzhou') {
    const fw = 5.2 * s; bodyTube(ctx, x, y - 84 * s, fw, 7 * s);
    ctx.fillStyle = metal(ctx, x - fw / 2, x + fw / 2); ctx.beginPath(); ctx.moveTo(x - fw / 2, y - 84 * s); ctx.lineTo(x - fw * 0.18, y - 89 * s); ctx.lineTo(x + fw * 0.18, y - 89 * s); ctx.lineTo(x + fw / 2, y - 84 * s); ctx.fill();
    // escape tower
    ctx.fillStyle = '#e9ecf2'; ctx.fillRect(x - 0.45 * s, y - 92.5 * s, 0.9 * s, 3.6 * s);
    ctx.fillStyle = '#c03a2b'; ctx.fillRect(x - 0.55 * s, y - 90.2 * s, 1.1 * s, 0.8 * s);
    noseCone(ctx, x, y - 92.4 * s, 0.9 * s, 1.2 * s, '#e9ecf2');
  } else {
    const fw = 6 * s; bodyTube(ctx, x, y - 86 * s, fw, 9 * s);
    noseCone(ctx, x, y - 86 * s, fw, 6.5 * s, metal(ctx, x - fw / 2, x + fw / 2));
  }
  for (const k of [-0.3, 0, 0.3]) nozzle(ctx, x + k * core, y, core * 0.3, 2.4 * s);
  if (flame > 0) {
    if (boosters) for (const d of [-1, 1]) plume(ctx, x + d * core * 0.98, y + 2.4 * s, core * 1.1, 30 * s, t, { intensity: flame, seed: 5 + d });
    plume(ctx, x, y + 2.4 * s, core * 1.15, 32 * s, t, { intensity: flame, seed: 11 });
  }
}
function launchTower(ctx, x, y, h, w) {
  ctx.save(); ctx.strokeStyle = '#3a3f4d'; ctx.fillStyle = '#2b2f3a'; ctx.lineWidth = 3;
  ctx.fillRect(x - w / 2, y - h, 6, h); ctx.fillRect(x + w / 2 - 6, y - h, 6, h);
  for (let yy = y; yy > y - h; yy -= w) { ctx.beginPath(); ctx.moveTo(x - w / 2, yy); ctx.lineTo(x + w / 2, yy - w); ctx.moveTo(x + w / 2, yy); ctx.lineTo(x - w / 2, yy - w); ctx.moveTo(x - w / 2, yy); ctx.lineTo(x + w / 2, yy); ctx.stroke(); }
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(x, y - h - 6, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function palm(ctx, x, y, h, lean = 0.1, sway = 0) {
  ctx.save(); ctx.fillStyle = '#05070d'; ctx.strokeStyle = '#05070d'; ctx.lineCap = 'round';
  const tx = x + lean * h, ty = y - h;
  ctx.lineWidth = h * 0.04; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * h * 0.15, y - h * 0.55, tx, ty); ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + 0.25 + (i / 8) * (Math.PI - 0.5) + sway * 0.03; const Lf = h * (0.42 + 0.08 * Math.sin(i * 2.3));
    const droop = 0.55 + 0.25 * Math.abs(Math.cos(a));
    const P = (f) => [tx + Math.cos(a) * Lf * f, ty + Math.sin(a) * Lf * f + droop * Lf * f * f];
    const left = [], right = []; const n = 14;
    for (let k = 0; k <= n; k++) {
      const f = k / n, p = P(f), q = P(Math.min(1, f + 0.02)); const dx = q[0] - p[0], dy = q[1] - p[1], dl = Math.hypot(dx, dy) || 1;
      const w = Lf * 0.09 * Math.pow(Math.sin(Math.PI * Math.min(1, f * 1.15)), 0.7) * (k % 2 ? 1 : 0.55);
      left.push([p[0] - (dy / dl) * w, p[1] + (dx / dl) * w]); right.push([p[0] + (dy / dl) * w, p[1] - (dx / dl) * w]);
    }
    ctx.beginPath(); left.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); for (let k = right.length - 1; k >= 0; k--) ctx.lineTo(right[k][0], right[k][1]); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// coastal launch site backdrop (Wenchang). tod: 'night' | 'day' | 'dusk'
function launchSite(ctx, t, { tod = 'night', camY = 0, glow = 0 } = {}) {
  const sky = tod === 'night' ? ['#02030a', '#0b1a3a', '#1d3560'] : tod === 'dusk' ? ['#14183a', '#7a3b5c', '#f39a5b'] : ['#2f6fb8', '#76abdf', '#cfe5f5'];
  const g = ctx.createLinearGradient(0, -camY, 0, H - camY * 0.2);
  g.addColorStop(0, sky[0]); g.addColorStop(0.6, sky[1]); g.addColorStop(1, sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (tod === 'night') space(ctx, t, { alpha: 0.8, top: 'rgba(0,0,0,0)', bottom: 'rgba(0,0,0,0)', seed: 21, oy: camY * 0.05 });
  const hy = 800 + camY; // horizon
  if (hy < H + 400) {
    ctx.fillStyle = tod === 'day' ? '#2a5a86' : tod === 'dusk' ? '#2b2440' : '#06101f'; ctx.fillRect(0, hy, W, H + 400);
    // sea glints
    ctx.fillStyle = tod === 'dusk' ? 'rgba(255,170,110,0.35)' : 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 40; i++) { const xx = (i * 173) % W, yy = hy + 8 + ((i * 37) % 60); ctx.fillRect(xx, yy, 40 + (i % 5) * 12, 2); }
    // land strip
    ctx.fillStyle = tod === 'day' ? '#1d2e22' : '#03060b';
    ctx.beginPath(); ctx.moveTo(0, hy + 70); ctx.lineTo(W, hy + 40); ctx.lineTo(W, H + 400); ctx.lineTo(0, H + 400); ctx.fill();
    if (glow > 0) { const gg = ctx.createRadialGradient(W / 2, hy + 40, 0, W / 2, hy + 40, 900); gg.addColorStop(0, `rgba(255,170,80,${0.45 * glow})`); gg.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = gg; ctx.fillRect(0, hy - 900, W, 1800); }
    palm(ctx, 140, hy + 120, 330, 0.12, Math.sin(t)); palm(ctx, 260, hy + 140, 260, -0.08, Math.sin(t + 1));
    palm(ctx, 1720, hy + 120, 300, -0.14, Math.sin(t + 2)); palm(ctx, 1830, hy + 140, 240, 0.1, Math.sin(t + 3));
  }
  return hy;
}

// ---------------- Chang'e-5 modules (s = px per unit, ~ 1 unit = 1 m) ----------------
function ce5Orbiter(ctx, x, y, s, { panels = 1 } = {}) {
  ctx.save(); ctx.translate(x, y);
  if (panels > 0) { const pw = 2.6 * s * panels; ctx.fillStyle = '#9aa3b2'; ctx.fillRect(-1.0 * s - pw * 0.15, -0.04 * s, pw * 0.15 + 2 * s, 0.08 * s); solarPanel(ctx, -1.0 * s - pw, -0.32 * s, pw, 0.64 * s); solarPanel(ctx, 1.0 * s, -0.32 * s, pw, 0.64 * s); }
  ctx.fillStyle = goldFoil(ctx, -1.0 * s, -0.7 * s, 2 * s, 1.4 * s); rr(ctx, -1.0 * s, -0.7 * s, 2 * s, 1.4 * s, 0.08 * s); ctx.fill();
  ctx.strokeStyle = 'rgba(90,50,0,0.5)'; ctx.lineWidth = 1; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-1.0 * s, -0.7 * s + i * 0.35 * s); ctx.lineTo(1.0 * s, -0.7 * s + i * 0.35 * s + 0.05 * s); ctx.stroke(); }
  nozzle(ctx, 0, 0.7 * s, 0.6 * s, 0.5 * s);
  ctx.restore();
}
function ce5Returner(ctx, x, y, s) { // bell capsule, base at y
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createLinearGradient(-0.6 * s, 0, 0.6 * s, 0); g.addColorStop(0, '#3a2c22'); g.addColorStop(0.4, '#8b6a4f'); g.addColorStop(1, '#2a1e16');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-0.62 * s, 0); ctx.lineTo(-0.3 * s, -0.95 * s); ctx.quadraticCurveTo(0, -1.05 * s, 0.3 * s, -0.95 * s); ctx.lineTo(0.62 * s, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#20170f'; ctx.beginPath(); ctx.ellipse(0, 0, 0.62 * s, 0.1 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function ce5Ascender(ctx, x, y, s) { // bottom-centre at (x,y)
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = metal(ctx, -0.6 * s, 0.6 * s, '#e8ebf0', '#8d96a6'); rr(ctx, -0.6 * s, -0.8 * s, 1.2 * s, 0.8 * s, 0.06 * s); ctx.fill();
  ctx.fillStyle = goldFoil(ctx, -0.6 * s, -0.8 * s, 1.2 * s, 0.8 * s); ctx.fillRect(-0.6 * s, -0.55 * s, 1.2 * s, 0.3 * s);
  ctx.fillStyle = '#6d7686'; ctx.fillRect(-0.18 * s, -1.0 * s, 0.36 * s, 0.2 * s); // docking/capture rods
  ctx.fillStyle = '#c2c7d0'; ctx.fillRect(-0.32 * s, -1.06 * s, 0.64 * s, 0.07 * s);
  ctx.restore();
}
function ce5Lander(ctx, x, y, s, { ascender = true, legs = 1, drill = 0, arm = null, flagUp = 0, t = 0 } = {}) {
  // (x,y) = ground contact point of footpads
  ctx.save(); ctx.translate(x, y);
  const bodyY = -1.45 * s;
  // far legs
  ctx.strokeStyle = '#7d8594'; ctx.lineWidth = 0.09 * s; ctx.lineCap = 'round';
  for (const d of [-0.55, 0.55]) { ctx.beginPath(); ctx.moveTo(d * 0.9 * s, bodyY + 0.3 * s); ctx.lineTo(d * 2.0 * s, -0.08 * s); ctx.stroke(); }
  // solar wings (folded up)
  solarPanel(ctx, -2.3 * s, bodyY - 0.15 * s, 0.9 * s, 0.6 * s, 3); solarPanel(ctx, 1.4 * s, bodyY - 0.15 * s, 0.9 * s, 0.6 * s, 3);
  // body
  ctx.fillStyle = goldFoil(ctx, -1.4 * s, bodyY - 0.4 * s, 2.8 * s, 0.9 * s);
  ctx.beginPath(); ctx.moveTo(-1.4 * s, bodyY - 0.2 * s); ctx.lineTo(-1.2 * s, bodyY - 0.45 * s); ctx.lineTo(1.2 * s, bodyY - 0.45 * s); ctx.lineTo(1.4 * s, bodyY - 0.2 * s); ctx.lineTo(1.4 * s, bodyY + 0.35 * s); ctx.lineTo(-1.4 * s, bodyY + 0.35 * s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(90,50,0,0.45)'; ctx.lineWidth = 1; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 0.4 * s, bodyY - 0.45 * s); ctx.lineTo(i * 0.4 * s + 0.1 * s, bodyY + 0.35 * s); ctx.stroke(); }
  nozzle(ctx, 0, bodyY + 0.35 * s, 0.5 * s, 0.35 * s);
  // near legs
  ctx.strokeStyle = '#b8bfcc'; ctx.lineWidth = 0.12 * s;
  for (const d of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(d * 1.25 * s, bodyY + 0.1 * s); ctx.lineTo(d * 2.15 * s * (0.6 + 0.4 * legs), -0.08 * s * legs - (1 - legs) * 0.8 * s); ctx.stroke();
    ctx.lineWidth = 0.06 * s; ctx.beginPath(); ctx.moveTo(d * 1.35 * s, bodyY + 0.33 * s); ctx.lineTo(d * 1.9 * s * (0.6 + 0.4 * legs), -0.3 * s * legs - (1 - legs) * 0.8 * s); ctx.stroke(); ctx.lineWidth = 0.12 * s;
    ctx.fillStyle = '#9aa1ad'; ctx.beginPath(); ctx.ellipse(d * 2.15 * s * (0.6 + 0.4 * legs), -0.05 * s * legs - (1 - legs) * 0.8 * s, 0.28 * s, 0.08 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  // drill
  if (drill > 0) {
    ctx.fillStyle = '#c9ced6'; ctx.fillRect(-0.9 * s, bodyY + 0.35 * s, 0.18 * s, 0.25 * s);
    ctx.fillStyle = '#8f96a3'; ctx.fillRect(-0.85 * s, bodyY + 0.6 * s, 0.08 * s, drill * s);
  }
  // robotic arm: arm = {a1, a2} angles
  if (arm) {
    const bx = 1.2 * s, by = bodyY - 0.1 * s; const l1 = 1.5 * s, l2 = 1.3 * s;
    const ex = bx + Math.cos(arm.a1) * l1, ey = by + Math.sin(arm.a1) * l1;
    const hx = ex + Math.cos(arm.a2) * l2, hy = ey + Math.sin(arm.a2) * l2;
    ctx.strokeStyle = '#dfe3ea'; ctx.lineWidth = 0.12 * s; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = '#6f7787'; ctx.beginPath(); ctx.arc(ex, ey, 0.1 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0c6d0'; ctx.save(); ctx.translate(hx, hy); ctx.rotate(arm.a2); ctx.fillRect(-0.05 * s, -0.16 * s, 0.32 * s, 0.32 * s); ctx.restore();
    arm.tip = [x + hx, y + hy];
  }
  if (flagUp > 0) {
    const fx = -1.25 * s, fy = bodyY - 0.45 * s;
    ctx.strokeStyle = '#d9dde4'; ctx.lineWidth = 0.05 * s; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 1.1 * s * flagUp); ctx.stroke();
    if (flagUp > 0.4) { ctx.save(); const fw = 0.9 * s * ease.out(prog(flagUp, 0.4, 1)); if (fw > 2) { ctx.translate(fx - fw, fy - 1.1 * s * flagUp); flagCN(ctx, 0, 0, fw); } ctx.restore(); }
  }
  ctx.restore();
  if (ascender) ce5Ascender(ctx, x, y + bodyY - 0.45 * s, s);
}
function queqiao(ctx, x, y, s, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  solarPanel(ctx, -2.2 * s, -0.25 * s, 1.4 * s, 0.5 * s, 4); solarPanel(ctx, 0.8 * s, -0.25 * s, 1.4 * s, 0.5 * s, 4);
  ctx.fillStyle = goldFoil(ctx, -0.6 * s, -0.5 * s, 1.2 * s, 1 * s); ctx.fillRect(-0.6 * s, -0.5 * s, 1.2 * s, 1 * s);
  ctx.fillStyle = '#e8ebf0'; ctx.beginPath(); ctx.ellipse(0, -1.0 * s, 1.3 * s, 0.45 * s, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#b4bac6'; ctx.lineWidth = 0.05 * s; ctx.beginPath(); ctx.moveTo(0, -0.5 * s); ctx.lineTo(0, -1.4 * s); ctx.stroke();
  ctx.restore();
}

// ---------------- crewed vehicles ----------------
// Mengzhou: capsule + service module. (x,y) = centre, oriented along +x (nose to the right) when rot=0
function mengzhou(ctx, x, y, s, rot = 0, { solar = 1, service = true, airbag = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  if (service) {
    if (solar > 0) { ctx.fillStyle = '#9aa3b2'; ctx.fillRect(-1.7 * s, -2.9 * s * solar, 0.12 * s, 5.8 * s * solar); solarPanel(ctx, -2.3 * s, -2.9 * s * solar, 1.2 * s, 1.9 * s * solar, 3); solarPanel(ctx, -2.3 * s, 1.0 * s * solar, 1.2 * s, 1.9 * s * solar, 3); }
    ctx.fillStyle = metal(ctx, 0, 0); const g = ctx.createLinearGradient(0, -1 * s, 0, 1 * s); g.addColorStop(0, '#8c95a5'); g.addColorStop(0.4, '#f2f4f8'); g.addColorStop(1, '#7f8898');
    ctx.fillStyle = g; ctx.fillRect(-3.0 * s, -1.05 * s, 2.3 * s, 2.1 * s);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-3.0 * s, -1.05 * s, 0.2 * s, 2.1 * s); ctx.fillRect(-1.6 * s, -1.05 * s, 0.08 * s, 2.1 * s);
    ctx.save(); ctx.translate(-3.0 * s, 0); ctx.rotate(Math.PI / 2); nozzle(ctx, 0, 0, 0.9 * s, 0.8 * s); ctx.restore();
  }
  // capsule (truncated cone, heat shield at back)
  const g2 = ctx.createLinearGradient(0, -1.2 * s, 0, 1.2 * s); g2.addColorStop(0, '#9aa2b0'); g2.addColorStop(0.35, '#ffffff'); g2.addColorStop(1, '#8b93a2');
  ctx.fillStyle = g2; ctx.beginPath(); ctx.moveTo(-0.7 * s, -1.2 * s); ctx.lineTo(1.1 * s, -0.55 * s); ctx.quadraticCurveTo(1.3 * s, 0, 1.1 * s, 0.55 * s); ctx.lineTo(-0.7 * s, 1.2 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3b3530'; ctx.fillRect(-0.82 * s, -1.2 * s, 0.14 * s, 2.4 * s);
  ctx.fillStyle = '#1a2c4a'; rr(ctx, 0.15 * s, -0.55 * s, 0.32 * s, 0.24 * s, 0.05 * s); ctx.fill();
  ctx.fillStyle = '#c8102e'; ctx.fillRect(-0.4 * s, 0.25 * s, 0.9 * s, 0.1 * s);
  ctx.fillStyle = '#b8bec9'; ctx.fillRect(1.2 * s, -0.3 * s, 0.25 * s, 0.6 * s); // docking port
  if (airbag > 0) { ctx.fillStyle = `rgba(235,235,225,${clamp(airbag)})`; for (const k of [-0.7, 0, 0.7]) { ctx.beginPath(); ctx.ellipse(-1.0 * s - 0.3 * s * airbag, k * s, 0.45 * s * airbag, 0.38 * s * airbag + 0.01, 0, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
}
// Lanyue lander: lunar module on top, propulsion module beneath. (x,y) = footpad ground point
function lanyue(ctx, x, y, s, { prop = 1, propDrop = 0, propRot = 0, legs = 1, hatch = 0, ladder = 0, engine = 0, t = 0 } = {}) {
  ctx.save(); ctx.translate(x, y);
  const bodyY = -2.2 * s;
  // propulsion module (hangs below the cabin, between the legs)
  if (prop > 0) {
    ctx.save(); ctx.translate(0, bodyY + 1.25 * s + propDrop * s); ctx.rotate(propRot); ctx.globalAlpha *= prop;
    const g = ctx.createLinearGradient(-1 * s, 0, 1 * s, 0); g.addColorStop(0, '#7c8595'); g.addColorStop(0.45, '#eef1f6'); g.addColorStop(1, '#727b8b');
    ctx.fillStyle = g; rr(ctx, -1.05 * s, -0.75 * s, 2.1 * s, 1.5 * s, 0.25 * s); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-1.05 * s, -0.1 * s, 2.1 * s, 0.12 * s);
    nozzle(ctx, 0, 0.75 * s, 0.9 * s, 0.7 * s);
    if (engine > 0) plume(ctx, 0, 1.45 * s, 0.9 * s, 3.2 * s, t, { intensity: engine, color: 'blue', seed: 31 });
    ctx.restore();
  } else if (engine > 0) { // lunar-module descent engines
    for (const k of [-0.5, 0.5]) { nozzle(ctx, k * s, bodyY + 0.55 * s, 0.35 * s, 0.3 * s); plume(ctx, k * s, bodyY + 0.85 * s, 0.35 * s, 1.6 * s, t, { intensity: engine, color: 'blue', seed: 40 + k * 4 }); }
  }
  // legs
  const spread = 0.55 + 0.45 * legs;
  ctx.lineCap = 'round';
  for (const [d, col, w] of [[-0.6, '#7d8594', 0.1], [0.6, '#7d8594', 0.1], [-1, '#c3c9d3', 0.14], [1, '#c3c9d3', 0.14]]) {
    ctx.strokeStyle = col; ctx.lineWidth = w * s;
    const fx = d * 2.4 * s * spread, fy = -0.1 * s - (1 - legs) * 1.2 * s;
    ctx.beginPath(); ctx.moveTo(d * 1.05 * s, bodyY + 0.2 * s); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.lineWidth = w * 0.5 * s; ctx.beginPath(); ctx.moveTo(d * 0.9 * s, bodyY + 0.55 * s); ctx.lineTo(fx * 0.92, fy - 0.4 * s); ctx.stroke();
    if (Math.abs(d) === 1) { ctx.fillStyle = '#9aa1ad'; ctx.beginPath(); ctx.ellipse(fx, fy + 0.04 * s, 0.34 * s, 0.1 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  // cabin
  const g = ctx.createLinearGradient(-1.3 * s, 0, 1.3 * s, 0); g.addColorStop(0, '#8b93a2'); g.addColorStop(0.4, '#fbfcfe'); g.addColorStop(1, '#868e9d');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-1.3 * s, bodyY + 0.55 * s); ctx.lineTo(-1.3 * s, bodyY - 0.6 * s); ctx.lineTo(-0.8 * s, bodyY - 1.15 * s); ctx.lineTo(0.8 * s, bodyY - 1.15 * s); ctx.lineTo(1.3 * s, bodyY - 0.6 * s); ctx.lineTo(1.3 * s, bodyY + 0.55 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = goldFoil(ctx, -1.3 * s, bodyY + 0.1 * s, 2.6 * s, 0.45 * s); ctx.fillRect(-1.3 * s, bodyY + 0.12 * s, 2.6 * s, 0.43 * s);
  ctx.fillStyle = '#1b2d4d'; rr(ctx, 0.3 * s, bodyY - 0.85 * s, 0.6 * s, 0.38 * s, 0.08 * s); ctx.fill();
  ctx.fillStyle = 'rgba(160,210,255,0.35)'; rr(ctx, 0.36 * s, bodyY - 0.8 * s, 0.2 * s, 0.12 * s, 0.04 * s); ctx.fill();
  // hatch
  ctx.fillStyle = '#6a7282'; rr(ctx, -0.95 * s, bodyY - 0.55 * s, 0.7 * s, 0.85 * s, 0.1 * s); ctx.fill();
  if (hatch > 0) { ctx.fillStyle = '#0c0f16'; rr(ctx, -0.92 * s, bodyY - 0.52 * s, 0.64 * s * hatch, 0.79 * s, 0.08 * s); ctx.fill(); ctx.fillStyle = 'rgba(255,220,150,0.35)'; rr(ctx, -0.92 * s, bodyY - 0.52 * s, 0.64 * s * hatch, 0.79 * s, 0.08 * s); ctx.fill(); }
  ctx.fillStyle = '#c8102e'; ctx.fillRect(-1.3 * s, bodyY - 0.62 * s, 2.6 * s, 0.07 * s);
  if (ladder > 0) { ctx.strokeStyle = '#cfd4dc'; ctx.lineWidth = 0.05 * s; const lx0 = -0.85 * s, lx1 = -0.4 * s, y0 = bodyY + 0.3 * s, y1 = lerp(y0, -0.1 * s, ladder); ctx.beginPath(); ctx.moveTo(lx0 - 0.3 * s * ladder, y1); ctx.lineTo(lx0, y0); ctx.moveTo(lx1 - 0.3 * s * ladder, y1); ctx.lineTo(lx1, y0); ctx.stroke(); for (let k = 1; k < 6; k++) { const f = k / 6; ctx.beginPath(); ctx.moveTo(lerp(lx0, lx0 - 0.3 * s * ladder, f), lerp(y0, y1, f)); ctx.lineTo(lerp(lx1, lx1 - 0.3 * s * ladder, f), lerp(y0, y1, f)); ctx.stroke(); } }
  // docking port on top
  ctx.fillStyle = '#b8bec9'; ctx.fillRect(-0.35 * s, bodyY - 1.35 * s, 0.7 * s, 0.22 * s);
  ctx.restore();
}
function astronaut(ctx, x, y, s, { phase = 0, walk = 0, face = 1, arm = 0 } = {}) {
  // (x,y) = feet on ground; s = px per metre (height ~1.9 m)
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  const sw = Math.sin(phase * Math.PI * 2) * walk; const bob = Math.abs(Math.cos(phase * Math.PI * 2)) * walk * 0.05 * s;
  ctx.translate(0, -bob);
  const suit = ctx.createLinearGradient(-0.4 * s, 0, 0.4 * s, 0); suit.addColorStop(0, '#b9bfca'); suit.addColorStop(0.5, '#ffffff'); suit.addColorStop(1, '#aab1bd');
  ctx.lineCap = 'round';
  // legs
  for (const [k, sh] of [[-1, 0.85], [1, 1]]) {
    const a = sw * 0.45 * k; ctx.strokeStyle = sh === 1 ? '#f3f5f8' : '#c5cbd5'; ctx.lineWidth = 0.24 * s;
    const hx = 0.05 * s * k, hy = -0.85 * s; const kx = hx + Math.sin(a) * 0.42 * s, ky = hy + Math.cos(a) * 0.42 * s; const fx = kx + Math.sin(a * 0.4) * 0.42 * s, fy = ky + 0.42 * s;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, Math.min(-0.04 * s, fy)); ctx.stroke();
    ctx.fillStyle = '#7d8594'; ctx.beginPath(); ctx.ellipse(fx + 0.06 * s, -0.04 * s, 0.16 * s, 0.07 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  // backpack
  ctx.fillStyle = '#d7dbe2'; rr(ctx, -0.52 * s, -1.62 * s, 0.32 * s, 0.7 * s, 0.06 * s); ctx.fill();
  // torso
  ctx.fillStyle = suit; rr(ctx, -0.3 * s, -1.6 * s, 0.62 * s, 0.82 * s, 0.16 * s); ctx.fill();
  ctx.fillStyle = '#c8102e'; ctx.fillRect(-0.3 * s, -1.2 * s, 0.62 * s, 0.06 * s);
  ctx.save(); flagCN(ctx, 0.02 * s, -1.5 * s, 0.2 * s); ctx.restore();
  // arm
  const aa = -0.3 + sw * -0.4 + arm; ctx.strokeStyle = '#eef0f4'; ctx.lineWidth = 0.19 * s;
  ctx.beginPath(); ctx.moveTo(0.05 * s, -1.45 * s); ctx.lineTo(0.05 * s + Math.sin(aa) * 0.4 * s, -1.45 * s + Math.cos(aa) * 0.4 * s); ctx.lineTo(0.05 * s + Math.sin(aa + 0.5) * 0.75 * s, -1.45 * s + Math.cos(aa + 0.3) * 0.72 * s); ctx.stroke();
  // helmet
  ctx.fillStyle = '#f7f8fa'; ctx.beginPath(); ctx.arc(0.02 * s, -1.85 * s, 0.27 * s, 0, Math.PI * 2); ctx.fill();
  const vg = ctx.createLinearGradient(0, -2.05 * s, 0.3 * s, -1.7 * s); vg.addColorStop(0, '#ffe39a'); vg.addColorStop(0.5, '#c28a2c'); vg.addColorStop(1, '#5b3a0d');
  ctx.fillStyle = vg; ctx.beginPath(); ctx.ellipse(0.1 * s, -1.85 * s, 0.17 * s, 0.17 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function rover(ctx, x, y, s, t = 0, { driver = true, dust = 0 } = {}) {
  // (x,y) = ground under the rover centre; s = px per metre (length ~3.4 m)
  ctx.save(); ctx.translate(x, y);
  if (driver) astronaut(ctx, -0.2 * s, -0.85 * s, s * 0.82, { phase: 0, walk: 0, face: 1, arm: 0.8 });
  ctx.fillStyle = '#d9dde4'; rr(ctx, -1.8 * s, -1.05 * s, 3.6 * s, 0.32 * s, 0.08 * s); ctx.fill();
  ctx.fillStyle = goldFoil(ctx, -1.6 * s, -1.0 * s, 1 * s, 0.25 * s); ctx.fillRect(0.6 * s, -1.0 * s, 1.0 * s, 0.22 * s);
  solarPanel(ctx, 0.5 * s, -1.38 * s, 1.3 * s, 0.25 * s, 4);
  ctx.strokeStyle = '#c8ccd4'; ctx.lineWidth = 0.05 * s; ctx.beginPath(); ctx.moveTo(1.5 * s, -1.38 * s); ctx.lineTo(1.5 * s, -2.1 * s); ctx.stroke();
  ctx.fillStyle = '#e8ebf0'; ctx.beginPath(); ctx.ellipse(1.5 * s, -2.15 * s, 0.32 * s, 0.1 * s, -0.3, 0, Math.PI * 2); ctx.fill();
  for (const wx of [-1.3, 1.3]) {
    ctx.fillStyle = '#3a3e47'; ctx.beginPath(); ctx.arc(wx * s, -0.42 * s, 0.42 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9aa1ad'; ctx.lineWidth = 0.04 * s; for (let k = 0; k < 6; k++) { const a = -t * 3 + (k * Math.PI) / 3; ctx.beginPath(); ctx.moveTo(wx * s, -0.42 * s); ctx.lineTo(wx * s + Math.cos(a) * 0.38 * s, -0.42 * s + Math.sin(a) * 0.38 * s); ctx.stroke(); }
    ctx.fillStyle = '#c3c8d0'; ctx.beginPath(); ctx.arc(wx * s, -0.42 * s, 0.1 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (dust > 0) dustBurst(ctx, x - 1.6 * s, y, t, { power: dust * 0.4, n: 14, seed: 8 });
}
function parachute(ctx, x, y, s, open = 1, sway = 0) { // canopy above (x,y)
  if (open <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(sway);
  const w = 4.5 * s * open, h = 2.4 * s * (0.4 + 0.6 * open), top = -6 * s;
  ctx.strokeStyle = 'rgba(230,230,230,0.8)'; ctx.lineWidth = 1;
  for (let k = -4; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo((k / 4) * w / 2, top); ctx.stroke(); }
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, top, w / 2, h, 0, Math.PI, 0); ctx.closePath(); ctx.clip();
  for (let k = 0; k < 8; k++) {
    ctx.fillStyle = k % 2 ? '#f4f4f4' : '#e0392b';
    const a0 = Math.PI + (k * Math.PI) / 8, a1 = a0 + Math.PI / 8;
    ctx.beginPath(); ctx.moveTo(0, top + h * 0.2); ctx.lineTo(Math.cos(a0) * w, top + Math.sin(a0) * h * 2); ctx.lineTo(Math.cos(a1) * w, top + Math.sin(a1) * h * 2); ctx.closePath(); ctx.fill();
  }
  const sh = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); sh.addColorStop(0, 'rgba(0,0,0,0.3)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.1)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = sh; ctx.fillRect(-w / 2, top - h, w, h);
  ctx.restore();
  ctx.restore();
}

// ---------------- lunar terrain ----------------
const surfCache = new Map();
function lunarGround(seed, hy, { w = W + 400, h = H, rough = 1, light = 1 } = {}) {
  const key = `${seed}|${hy}|${w}|${rough}|${light}`; if (surfCache.has(key)) return surfCache.get(key);
  const cv = createCanvas(w, h); const c = cv.getContext('2d'); const R = rng(seed);
  // ground gradient
  const g = c.createLinearGradient(0, hy, 0, h); g.addColorStop(0, '#5d5b58'); g.addColorStop(0.3, '#7d7a74'); g.addColorStop(1, '#9b978f');
  c.fillStyle = g; c.beginPath(); c.moveTo(0, hy);
  for (let x = 0; x <= w; x += 20) c.lineTo(x, hy - 10 * rough * Math.sin(x * 0.004 + seed) - 6 * rough * Math.sin(x * 0.013 + seed * 2));
  c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
  // distant ridge
  c.fillStyle = '#4a4946'; c.beginPath(); c.moveTo(0, hy + 2);
  for (let x = 0; x <= w; x += 30) c.lineTo(x, hy - 18 * rough - 26 * rough * Math.max(0, Math.sin(x * 0.0021 + seed * 3)) - 8 * Math.sin(x * 0.01));
  c.lineTo(w, hy + 6); c.closePath(); c.fill();
  // craters in perspective
  for (let i = 0; i < 70; i++) {
    const yy = hy + 20 + Math.pow(R(), 1.6) * (h - hy); const depth = (yy - hy) / (h - hy);
    const rx = (8 + R() * 70) * (0.3 + depth * 1.6), ry = rx * (0.18 + depth * 0.22); const xx = R() * w;
    const cg = c.createLinearGradient(xx - rx, yy, xx + rx, yy); cg.addColorStop(0, 'rgba(30,30,32,0.55)'); cg.addColorStop(0.6, 'rgba(70,70,72,0.25)'); cg.addColorStop(1, 'rgba(200,198,190,0.4)');
    c.fillStyle = cg; c.beginPath(); c.ellipse(xx, yy, rx, ry, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = `rgba(210,206,198,${0.25 * light})`; c.lineWidth = 1.5; c.beginPath(); c.ellipse(xx, yy - ry * 0.1, rx * 1.05, ry * 1.1, 0, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
  }
  // pebbles
  for (let i = 0; i < 500; i++) {
    const yy = hy + 10 + Math.pow(R(), 1.4) * (h - hy); const depth = (yy - hy) / (h - hy); const r = (0.6 + R() * 2.5) * (0.3 + depth * 2);
    const xx = R() * w; c.fillStyle = `rgba(${R() < 0.5 ? '40,40,42' : '190,186,178'},${0.35 + R() * 0.4})`; c.beginPath(); c.ellipse(xx, yy, r, r * 0.6, 0, 0, Math.PI * 2); c.fill();
  }
  // grain
  for (let i = 0; i < 3000; i++) { const yy = hy + R() * (h - hy), xx = R() * w; c.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},0.05)`; c.fillRect(xx, yy, 2, 1); }
  surfCache.set(key, cv); return cv;
}
function lunarScene(ctx, t, { hy = 760, seed = 11, ox = 0, earth = null, starsAlpha = 0.9, sun = null } = {}) {
  space(ctx, t, { alpha: starsAlpha, top: '#000000', bottom: '#05070d', seed: 33 + seed });
  if (sun) sunGlare(ctx, sun[0], sun[1], sun[2] || 260, 0.9);
  if (earth) earth(ctx);
  const gcv = lunarGround(seed, hy);
  ctx.drawImage(gcv, -200 - ox, 0);
}

module.exports = {
  space, vignette, sunGlare, plume, jet, launchSmoke, dustBurst, plasma, goldFoil, metal, solarPanel, nozzle,
  cz5, cz10, launchTower, palm, launchSite, ce5Orbiter, ce5Returner, ce5Ascender, ce5Lander, queqiao, mengzhou, lanyue,
  astronaut, rover, parachute, lunarGround, lunarScene,
};
