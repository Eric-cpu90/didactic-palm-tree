// Scenes: opening, Earth-Moon, CLEP "three steps", Chang'e timeline, Chang'e-5 step-by-step.
const { W, H, clamp, lerp, prog, ease, noise1, bezPts, polyAt, strokePoly, C, text, textReveal, panel, glowDot, arrowHead, callout, rr, flagCN, createCanvas } = require('./lib/core');
const { drawPlanet, atmosphereGlow, projectLL } = require('./lib/planet');
const A = require('./lib/art');
const U = require('./lib/ui');
const { L, after } = U;

// shared big lunar limb (cached sphere)
const LIMB = { kind: 'moon', lat: 25, lon: -40, light: [-0.3, 0.7, 0.62] };
function limb(ctx, alpha = 1) { ctx.save(); ctx.globalAlpha *= alpha; drawPlanet(ctx, 960, 1960, 1160, LIMB); ctx.restore(); }

function catmull(pts, n = 16) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  out.push(pts[pts.length - 1]); return out;
}
function dashed(ctx, pts, col, w = 2, dash = [10, 10], f0 = 0, f1 = 1) { ctx.save(); ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = w; strokePoly(ctx, pts, f0, f1); ctx.restore(); }
function trail(ctx, pts, f, col, w = 4) {
  if (f <= 0) return;
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.shadowColor = col; ctx.shadowBlur = 14; strokePoly(ctx, pts, 0, f); ctx.restore();
}
function crossMark(ctx, x, y, s, col = C.red2) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke(); ctx.restore(); }
function checkMark(ctx, x, y, s, col = C.green) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s * 0.3, y + s * 0.7); ctx.lineTo(x + s, y - s * 0.7); ctx.stroke(); ctx.restore(); }
function shake(ctx, t, amp, seed = 1) { if (amp > 0) ctx.translate((noise1(t * 30, seed) - 0.5) * amp, (noise1(t * 30, seed + 7) - 0.5) * amp); }
function flash(ctx, x, y, r, a) { if (a <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,255,240,${a})`); g.addColorStop(0.3, `rgba(255,220,150,${a * 0.5})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore(); }

// combined Chang'e-5 stacks
function orbRet(ctx, x, y, s, rot = 0, { panels = 0.7, returner = true } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); A.ce5Orbiter(ctx, 0, 0, s, { panels }); if (returner) A.ce5Returner(ctx, 0, -0.7 * s, s); ctx.restore();
}
function landAsc(ctx, x, y, s, rot = 0, opts = {}) { // (x,y) = centre of the lander body
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); A.ce5Lander(ctx, 0, 1.2 * s, s, opts); ctx.restore();
}

// ---------- icons for cards ----------
const icons = {
  atmo(ctx, x, y) { ctx.save(); ctx.strokeStyle = C.cyan; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); },
  grav(ctx, x, y) { ctx.save(); ctx.fillStyle = C.gold; rr(ctx, x - 26, y - 6, 52, 40, 8); ctx.fill(); ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y - 14, 10, Math.PI, 0); ctx.stroke(); text(ctx, '1/6', x, y + 22, { size: 22, fam: 'SansH', align: 'center', color: '#1a1206' }); ctx.restore(); },
  temp(ctx, x, y) { ctx.save(); ctx.strokeStyle = C.red2; ctx.lineWidth = 4; rr(ctx, x - 9, y - 40, 18, 60, 9); ctx.stroke(); ctx.fillStyle = C.red2; ctx.beginPath(); ctx.arc(x, y + 26, 15, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - 4, y - 20, 8, 44); ctx.restore(); },
};

const S1 = {};

// =========================== OPENING ===========================
S1.opening = {
  draw(ctx, t, S) {
    A.space(ctx, t, { ox: -t * 6, seed: 1 });
    const fa = ease.inOut(prog(t, 0, 3.2));
    const mr = Math.round(330 + t * 2), mx = 1380 - t * 2.5, my = 560;
    ctx.save(); ctx.globalAlpha = fa;
    const g = ctx.createRadialGradient(mx, my, mr * 0.95, mx, my, mr * 1.9); g.addColorStop(0, 'rgba(255,236,200,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawPlanet(ctx, mx, my, mr, { kind: 'moon', lat: 6, lon: Math.round((-12 + t * 0.4) * 4) / 4, light: [-0.78, 0.35, 0.52] });
    ctx.restore();
    // shooting star
    const sp = prog(t, 8.5, 9.6); if (sp > 0 && sp < 1) { const x = lerp(300, 900, sp), y = lerp(120, 330, sp); ctx.save(); const gg = ctx.createLinearGradient(x, y, x - 220, y - 77); gg.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - sp)})`); gg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.strokeStyle = gg; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 220, y - 77); ctx.stroke(); ctx.restore(); }
    // title
    const tp = ease.inOut(prog(t, 1.0, 3.0));
    if (tp > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 250 + tp * 700, H); ctx.clip();
      const tg = ctx.createLinearGradient(0, 330, 0, 580); tg.addColorStop(0, '#fff6dc'); tg.addColorStop(1, '#e2a23c');
      text(ctx, '奔月', 560, 575, { size: 260, fam: 'Brush', align: 'center', color: tg, shadow: 40, shadowColor: 'rgba(255,180,80,0.45)' });
      ctx.restore();
    }
    const sa = ease.out(prog(t, 2.6, 3.8));
    textReveal(ctx, '中国登月计划全解析', 560, 690, prog(t, 2.6, 4.2), { size: 58, fam: 'Serif', align: 'center', spacing: 14, color: '#fff' });
    ctx.save(); ctx.globalAlpha = sa; ctx.strokeStyle = C.gold; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(560 - 330 * sa, 735); ctx.lineTo(560 - 40, 735); ctx.moveTo(560 + 40, 735); ctx.lineTo(560 + 330 * sa, 735); ctx.stroke();
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(560, 735, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    text(ctx, "CHINA'S JOURNEY TO THE MOON", 560, 785, { size: 24, fam: 'Sans', align: 'center', spacing: 7, color: 'rgba(255,255,255,0.6)', alpha: ease.out(prog(t, 3.4, 4.6)) });
    A.vignette(ctx, 0.5);
  },
  cues: (S) => [[0.2, 'swell', 4], [1.0, 'chime']],
};

// =========================== EARTH-MOON ===========================
S1.earthmoon = {
  draw(ctx, t, S) {
    A.space(ctx, t, { seed: 2, ox: -t * 4 });
    const push = ease.inOut(prog(t, L(S, 3).t0 + 0.5, S.dur + 0.6));
    ctx.save(); const zx = 1560, zy = 480; const sc = 1 + push * 1.6; ctx.translate(zx, zy); ctx.scale(sc, sc); ctx.translate(-zx, -zy);
    drawPlanet(ctx, 380, 480, 200, { kind: 'earth', lat: 18, lon: Math.round((96 + t * 2.5) * 4) / 4, light: [0.62, 0.25, 0.74], cloudLon: Math.round(t * 6) / 4 });
    A.sunGlare && null; atmosphereGlow(ctx, 380, 480, 200);
    drawPlanet(ctx, 1560, 480, 55, { kind: 'moon', lat: 0, lon: 0, light: [-0.55, 0.2, 0.8] });
    text(ctx, '地球', 380, 735, { size: 34, fam: 'SansB', align: 'center', color: C.dim, alpha: 1 - push });
    text(ctx, '月球', 1560, 580, { size: 30, fam: 'SansB', align: 'center', color: C.dim, alpha: 1 - push });
    const dp = ease.inOut(prog(t, L(S, 0).t0 + 0.6, L(S, 0).t0 + 4.2));
    if (dp > 0) {
      const x0 = 610, x1 = 1480, y = 480, xe = lerp(x0, x1, dp);
      ctx.save(); ctx.globalAlpha = 1 - push; ctx.setLineDash([12, 10]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(xe, y); ctx.stroke(); ctx.setLineDash([]);
      arrowHead(ctx, x0, y, Math.PI, 14, '#fff'); if (dp >= 1) arrowHead(ctx, x1, y, 0, 14, '#fff');
      glowDot(ctx, xe, y, 5, C.cyan, 1);
      const km = Math.round(384400 * dp);
      text(ctx, km.toLocaleString('en-US') + ' km', (x0 + x1) / 2, y - 34, { size: 56, fam: 'SansH', align: 'center', color: '#fff', shadow: 12 });
      text(ctx, '地月平均距离 · 约 38 万公里', (x0 + x1) / 2, y + 62, { size: 32, fam: 'SansB', align: 'center', color: C.gold, alpha: ease.out(prog(dp, 0.85, 1)) });
      ctx.restore();
    }
    ctx.restore();
    const ca = 1 - ease.inOut(prog(t, L(S, 3).t0 + 0.2, L(S, 3).t0 + 1.2));
    ctx.save(); ctx.globalAlpha = ca;
    U.infoCard(ctx, 200, 640, 470, 175, prog(t, L(S, 1).t0, L(S, 1).t0 + 0.8), { title: '大气', value: '几乎为零', sub: '近乎真空的环境', icon: icons.atmo, color: C.cyan });
    U.infoCard(ctx, 725, 640, 470, 175, prog(t, L(S, 1).t0 + 2.2, L(S, 1).t0 + 3.0), { title: '重力', value: '地球的 1/6', sub: '约 1.62 米/秒²', icon: icons.grav, color: C.gold });
    U.infoCard(ctx, 1250, 640, 470, 175, prog(t, L(S, 2).t0, L(S, 2).t0 + 0.8), { title: '昼夜温差', value: '超过 300 ℃', sub: '白天约 127 ℃ · 夜晚约 -183 ℃', icon: icons.temp, color: C.red2 });
    ctx.restore();
    text(ctx, '示意图 · 地月距离未按比例', 1860, 1030 - 80, { size: 20, fam: 'Sans', align: 'right', color: 'rgba(255,255,255,0.35)', alpha: 1 - push });
    A.vignette(ctx, 0.45);
  },
  cues: (S) => [[L(S, 0).t0 + 0.6, 'sweep', 3.6]],
};

// =========================== THREE STEPS ===========================
S1.threesteps = {
  draw(ctx, t, S) {
    A.space(ctx, t, { seed: 3, ox: t * 5 });
    ctx.save(); ctx.globalAlpha = 0.45; drawPlanet(ctx, 960, 1560, 900, { kind: 'moon', lat: 30, lon: -20, light: [-0.3, 0.6, 0.74] }); ctx.restore();
    textReveal(ctx, '中国探月工程', 960, 200, prog(t, 0.6, 2.0), { size: 72, fam: 'SerifH', align: 'center', spacing: 10, color: '#fff' });
    text(ctx, '2004 年立项 · 命名为“嫦娥工程”', 960, 262, { size: 34, fam: 'Sans', align: 'center', color: C.gold, alpha: ease.out(prog(t, L(S, 0).t0 + 2.5, L(S, 0).t0 + 3.5)) });
    const chars = ['绕', '落', '回'], names = ['绕月探测', '落月巡视', '采样返回'], ms = ['嫦娥一号 · 嫦娥二号', '嫦娥三号 · 嫦娥四号', '嫦娥五号 · 嫦娥六号'];
    const l2 = L(S, 2), seg = (l2.t1 - l2.t0) / 3;
    for (let i = 0; i < 3; i++) {
      const cx = 480 + i * 480, cy = 520, R = 135;
      const rp = ease.outBack(prog(t, L(S, 1).t0 + 0.5 + i * 0.75, L(S, 1).t0 + 1.3 + i * 0.75));
      if (rp <= 0) continue;
      const act = t >= l2.t0 + i * seg - 0.2 ? 1 : 0; const on = (t >= l2.t0 + i * seg - 0.2 && t < l2.t0 + (i + 1) * seg - 0.2) || t > l2.t1;
      const sc = rp * (on ? 1.06 : 1);
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fillStyle = 'rgba(10,16,36,0.85)'; ctx.fill();
      ctx.lineWidth = on ? 5 : 3; ctx.strokeStyle = on ? C.gold : 'rgba(245,198,107,0.6)'; if (on) { ctx.shadowColor = C.gold; ctx.shadowBlur = 30; } ctx.stroke(); ctx.shadowBlur = 0;
      // mini animations
      if (i === 0) { const a = t * 1.6; glowDot(ctx, Math.cos(a) * (R + 18), Math.sin(a) * (R + 18) * 0.35, 6, C.cyan, 1); ctx.strokeStyle = 'rgba(95,211,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, R + 18, (R + 18) * 0.35, 0, 0, Math.PI * 2); ctx.stroke(); }
      if (i === 1) { const k = (t * 0.45) % 1; const y = lerp(-R - 50, -R + 6, ease.out(k)); ctx.save(); ctx.globalAlpha = 1 - prog(k, 0.85, 1); ctx.fillStyle = '#e8c062'; ctx.fillRect(-12, y - 10, 24, 14); ctx.strokeStyle = '#dfe3ea'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, y + 4); ctx.lineTo(-18, y + 14); ctx.moveTo(10, y + 4); ctx.lineTo(18, y + 14); ctx.stroke(); if (k < 0.8) A.plume(ctx, 0, y + 6, 8, 22, t, { color: 'blue' }); ctx.restore(); }
      if (i === 2) { const k = (t * 0.4) % 1; const a = lerp(-0.6, -2.5, k); const x = Math.cos(a) * (R + 26), y = Math.sin(a) * (R + 26); glowDot(ctx, x, y, 6, C.gold2, 1 - prog(k, 0.85, 1)); ctx.strokeStyle = 'rgba(245,198,107,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R + 26, -2.5, -0.6); ctx.stroke(); }
      text(ctx, chars[i], 0, 48, { size: 140, fam: 'SerifH', align: 'center', color: on ? C.gold2 : '#fff' });
      ctx.restore();
      text(ctx, `第${'一二三'[i]}步 · ${names[i]}`, cx, 730, { size: 40, fam: 'SansB', align: 'center', color: '#fff', alpha: ease.out(prog(t, l2.t0 + i * seg - 0.3, l2.t0 + i * seg + 0.4)) });
      text(ctx, ms[i], cx, 780, { size: 28, fam: 'Sans', align: 'center', color: C.dim, alpha: ease.out(prog(t, l2.t0 + i * seg, l2.t0 + i * seg + 0.6)) });
      if (i < 2) { const ap = ease.out(prog(t, L(S, 1).t0 + 1.2 + i * 0.75, L(S, 1).t0 + 1.8 + i * 0.75)); if (ap > 0) { ctx.save(); ctx.globalAlpha = ap; ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + R + 25, cy); ctx.lineTo(cx + R + 25 + 150 * ap, cy); ctx.stroke(); arrowHead(ctx, cx + R + 25 + 150 * ap, cy, 0, 12, C.gold); ctx.restore(); } }
    }
    A.vignette(ctx, 0.4);
  },
  cues: (S) => [0, 1, 2].map((i) => [L(S, 1).t0 + 0.5 + i * 0.75, 'tick']),
};

// =========================== TIMELINE ===========================
const NODES = [
  { y: '2007', n: '嫦娥一号', d: '首次绕月探测', view: [0, 0] },
  { y: '2010', n: '嫦娥二号', d: '7 米分辨率全月图', view: [0, 0] },
  { y: '2013', n: '嫦娥三号', d: '首次落月 · 玉兔号', view: [28, -15], site: [44.1, -19.5] },
  { y: '2018', n: '鹊桥', d: '地月 L2 点中继星', view: [-20, 172] },
  { y: '2019', n: '嫦娥四号', d: '人类首次月背软着陆', view: [-28, 178], site: [-45.5, 177.6] },
  { y: '2020', n: '嫦娥五号', d: '带回 1731 克月壤', view: [30, -45], site: [43.1, -51.8] },
  { y: '2024', n: '嫦娥六号', d: '带回 1935.3 克月背样品', view: [-30, -155], site: [-41.6, -154.0] },
];
function focusAt(t, S) {
  const keys = [[0, 0], [L(S, 0).t0 + 3.4, 1], [L(S, 1).t0 + 0.2, 2], [L(S, 2).t0 + 0.2, 3], [L(S, 2).t0 + 3.2, 4], [L(S, 3).t0 + 0.2, 5], [L(S, 4).t0 + 0.2, 6]];
  let f = 0; for (const [kt, kf] of keys) { if (t >= kt) f = lerp(f, kf, ease.inOut((t - kt) / 1.3)); }
  return f;
}
S1.timeline = {
  draw(ctx, t, S) {
    const f = focusAt(t, S);
    A.space(ctx, t, { seed: 4, ox: -f * 60 });
    U.chapterTag(ctx, '探月工程 · 二十年历程', ease.out(prog(t, 0.3, 1)));
    // moon globe with sites
    const i0 = Math.floor(f), i1 = Math.min(6, i0 + 1), fr = f - i0;
    const v0 = NODES[i0].view, v1 = NODES[i1].view; const k = ease.inOut(fr);
    const view = { kind: 'moon', lat: Math.round(lerp(v0[0], v1[0], k) * 2) / 2, lon: Math.round(lerp(v0[1], v1[1], k) * 2) / 2, light: [-0.45, 0.3, 0.84] };
    const gx = 960, gy = 350, gr = 190;
    const og = ctx.createRadialGradient(gx, gy, gr, gx, gy, gr * 1.6); og.addColorStop(0, 'rgba(255,240,210,0.1)'); og.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = og; ctx.fillRect(0, 0, W, H);
    // orbiters for CE-1/2
    const oa = 1 - prog(f, 1.4, 2.0);
    if (oa > 0) { ctx.save(); ctx.globalAlpha = oa; ctx.strokeStyle = 'rgba(95,211,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(gx, gy, gr + 60, 70, -0.25, Math.PI, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    drawPlanet(ctx, gx, gy, gr, view);
    if (oa > 0) { ctx.save(); ctx.globalAlpha = oa; ctx.strokeStyle = 'rgba(95,211,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(gx, gy, gr + 60, 70, -0.25, 0, Math.PI); ctx.stroke(); const a = t * 1.2; const px = gx + Math.cos(a) * (gr + 60) * Math.cos(-0.25) - Math.sin(a) * 70 * Math.sin(-0.25), py = gy + Math.cos(a) * (gr + 60) * Math.sin(-0.25) + Math.sin(a) * 70 * Math.cos(-0.25); if (Math.sin(a) > 0 || Math.hypot(px - gx, py - gy) > gr) glowDot(ctx, px, py, 6, C.cyan, 1); ctx.restore(); }
    NODES.forEach((n, i) => {
      if (!n.site || f < i - 0.4) return;
      const p = projectLL(gx, gy, gr, view, n.site[0], n.site[1]); if (!p.vis) return;
      const a = ease.out(prog(f, i - 0.4, i)) * clamp(p.z * 4);
      const pulse = 1 + 0.35 * Math.sin(t * 5);
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 12 * pulse, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      glowDot(ctx, p.x, p.y, 5, C.gold, a);
      text(ctx, n.n, p.x + 20, p.y - 14, { size: 24, fam: 'SansB', color: '#fff', alpha: a * clamp(1.6 - 2 * Math.abs(f - i)), shadow: 6 });
    });
    // Queqiao relay
    const qa = clamp(1 - Math.abs(f - 3.4) / 1.1);
    if (qa > 0) {
      const qx = gx + 360, qy = gy - 60; ctx.save(); ctx.globalAlpha = qa; A.queqiao(ctx, qx, qy, 16, -0.2);
      ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(95,211,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(qx - 30, qy + 10); ctx.lineTo(gx + 40, gy + 60); ctx.stroke(); ctx.beginPath(); ctx.moveTo(qx - 20, qy - 20); ctx.lineTo(gx - 700, gy - 220); ctx.stroke(); ctx.restore();
      text(ctx, '鹊桥中继', qx + 50, qy - 30, { size: 26, fam: 'SansB', color: C.cyan, alpha: qa });
      text(ctx, '← 地球方向', gx - 560, gy - 230, { size: 22, fam: 'Sans', color: 'rgba(160,220,255,0.8)', alpha: qa });
    }
    if (f > 2.6 && f < 4.9) text(ctx, '月球背面', gx, gy + gr + 46, { size: 26, fam: 'SansB', align: 'center', color: C.dim, alpha: clamp(1 - Math.abs(f - 3.7) / 1.2) });
    // track
    const ty = 700, sp = 380;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();
    const cxF = 960 - f * sp;
    ctx.strokeStyle = C.gold; ctx.beginPath(); ctx.moveTo(Math.max(0, cxF - 200), ty); ctx.lineTo(960, ty); ctx.stroke();
    NODES.forEach((n, i) => {
      const x = cxF + i * sp; if (x < -300 || x > W + 300) return;
      const d = Math.abs(i - f), on = d < 0.5, seen = f >= i - 0.5;
      const sc = 1 + 0.25 * clamp(1 - d);
      ctx.save(); ctx.translate(x, ty); ctx.scale(sc, sc);
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fillStyle = seen ? C.gold : '#1a2342'; ctx.fill(); ctx.strokeStyle = seen ? '#fff' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3; ctx.stroke();
      if (on) { ctx.shadowColor = C.gold; ctx.shadowBlur = 30; ctx.stroke(); }
      ctx.restore();
      const a = 0.35 + 0.65 * clamp(1 - d);
      text(ctx, n.y, x, ty - 46, { size: 30 + 22 * clamp(1 - d), fam: 'SerifH', align: 'center', color: seen ? C.gold2 : '#fff', alpha: a });
      text(ctx, n.n, x, ty + 70, { size: 28 + 12 * clamp(1 - d), fam: 'SansH', align: 'center', color: '#fff', alpha: a });
      text(ctx, n.d, x, ty + 116, { size: 22 + 6 * clamp(1 - d), fam: 'Sans', align: 'center', color: C.dim, alpha: a * clamp(1.4 - d) });
    });
    A.vignette(ctx, 0.4);
  },
  cues: (S) => [[L(S, 1).t0 + 0.2, 'tick'], [L(S, 2).t0 + 0.2, 'tick'], [L(S, 2).t0 + 3.2, 'tick'], [L(S, 3).t0 + 0.2, 'tick'], [L(S, 4).t0 + 0.2, 'tick']],
};

// =========================== CHAPTER CARD ===========================
function chapterCard(ctx, t, S, { num, title, sub, seed = 5, tint = '245,198,107' }) {
  A.space(ctx, t, { seed, ox: -t * 12 });
  const g = ctx.createRadialGradient(960, 540, 0, 960, 540, 900); g.addColorStop(0, `rgba(${tint},0.16)`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const out = 1 - ease.inOut(prog(t, S.dur - 1.3, S.dur - 0.3));
  ctx.save(); ctx.globalAlpha = out;
  for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate(960, 540); ctx.rotate(-0.12 + k * 0.08); ctx.strokeStyle = `rgba(${tint},${0.25 - k * 0.06})`; ctx.lineWidth = 1.5; ctx.setLineDash([3, 9]); ctx.lineDashOffset = -t * (20 + k * 10); ctx.beginPath(); ctx.ellipse(0, 0, 560 + k * 160, 120 + k * 40, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  const oa = t * 0.5; glowDot(ctx, 960 + Math.cos(oa) * 560 * Math.cos(-0.12) , 540 + Math.sin(oa) * 120 + Math.cos(oa) * 560 * Math.sin(-0.12), 5, `rgb(${tint})`, 0.9);
  textReveal(ctx, num, 960, 390, prog(t, 0.3, 1.1), { size: 44, fam: 'SansB', align: 'center', spacing: 26, color: `rgb(${tint})` });
  textReveal(ctx, title, 960, 580, prog(t, 0.6, 1.8), { size: 160, fam: 'SerifH', align: 'center', spacing: 24, color: '#fff', rise: 30, shadow: 30, shadowColor: `rgba(${tint},0.35)` });
  const la = ease.inOut(prog(t, 1.4, 2.4));
  ctx.strokeStyle = `rgb(${tint})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(960 - 420 * la, 632); ctx.lineTo(960 + 420 * la, 632); ctx.stroke();
  text(ctx, sub, 960, 700, { size: 40, fam: 'Sans', align: 'center', color: 'rgba(255,255,255,0.85)', spacing: 4, alpha: ease.out(prog(t, 1.8, 2.8)) });
  ctx.restore();
  A.vignette(ctx, 0.5);
}
S1.chapter1 = {
  draw(ctx, t, S) { chapterCard(ctx, t, S, { num: '第一篇', title: '无人登月', sub: '以嫦娥五号为例 · 23 天往返全过程', seed: 5 }); },
  cues: () => [[0.5, 'boom']],
};

// =========================== CE-5 STACK ===========================
S1.ce5stack = {
  draw(ctx, t, S) {
    A.space(ctx, t, { seed: 6, ox: t * 4 });
    U.chapterTag(ctx, '第一篇 · 无人登月', 1);
    const l0 = L(S, 0).t0, l1 = L(S, 1).t0;
    const ap = (k) => ease.outBack(prog(t, l0 + 1.0 + k * 0.85, l0 + 1.9 + k * 0.85));
    const asm = ease.inOut(prog(t, l1 + 0.2, l1 + 1.6)); // assemble pairs
    const s = 64;
    // left pair: orbiter + returner
    const ox = 620, oy = 585;
    const pO = ap(0), pR = ap(1), pLd = ap(2), pA = ap(3);
    if (pO > 0) { ctx.save(); ctx.globalAlpha = clamp(pO); orbRet(ctx, ox, oy + (1 - pO) * 300, s, 0, { returner: false, panels: 0.6 }); ctx.restore(); }
    const rgap = lerp(130, 0, asm);
    if (pR > 0) { ctx.save(); ctx.globalAlpha = clamp(pR); A.ce5Returner(ctx, ox, oy - 0.7 * s - rgap - (1 - pR) * 200, s); ctx.restore(); }
    // right pair: lander + ascender
    const lx = 1300, ly = 790;
    if (pLd > 0) { ctx.save(); ctx.globalAlpha = clamp(pLd); A.ce5Lander(ctx, lx, ly + (1 - pLd) * 300, s, { ascender: false }); ctx.restore(); }
    const agap = lerp(150, 0, asm);
    if (pA > 0) { ctx.save(); ctx.globalAlpha = clamp(pA); A.ce5Ascender(ctx, lx, ly - 1.9 * s - agap - (1 - pA) * 200, s); ctx.restore(); }
    // callouts
    const ca = 1 - asm * 0.0;
    callout(ctx, ox - 50, oy + 20, 250, 740, '轨道器', '环月飞行 · 携返回器返航', prog(t, l0 + 1.4, l0 + 2.4) * ca, { color: C.cyan, align: 'left' });
    callout(ctx, ox, oy - 0.7 * s - rgap - 40, 250, 420, '返回器', '携带月球样品返回地球', prog(t, l0 + 2.2, l0 + 3.2) * ca, { color: C.cyan, align: 'left' });
    callout(ctx, lx + 80, ly - 80, 1600, 760, '着陆器', '落月 · 钻取与表取采样', prog(t, l0 + 3.0, l0 + 4.0) * ca, { color: C.gold, align: 'left' });
    callout(ctx, lx + 30, ly - 1.9 * s - agap - 40, 1600, 440, '上升器', '携样品从月面起飞', prog(t, l0 + 3.8, l0 + 4.8) * ca, { color: C.gold, align: 'left' });
    if (asm > 0) {
      text(ctx, '轨返组合体', ox, 880, { size: 32, fam: 'SansB', align: 'center', color: C.cyan, alpha: asm });
      text(ctx, '着上组合体', lx, 880, { size: 32, fam: 'SansB', align: 'center', color: C.gold, alpha: asm });
    }
    U.badge(ctx, 960, 140, '总质量约 8.2 吨', prog(t, l0 + 5.2, l0 + 6.0), { size: 38 });
    // relay flow chips
    const chips = [['着陆器', '落月采样'], ['上升器', '月面起飞'], ['轨道器', '对接返航'], ['返回器', '再入地球']];
    chips.forEach(([a, b], i) => {
      const p = ease.out(prog(t, l1 + 1.6 + i * 0.9, l1 + 2.3 + i * 0.9)); if (p <= 0) return;
      const x = 420 + i * 370, y = 205 - 470;
      ctx.save(); ctx.globalAlpha = p; ctx.translate(0, (1 - p) * 20);
      panel(ctx, x - 140, y + 470, 280, 92, { r: 46, fill: 'rgba(20,30,60,0.8)', line: i < 2 ? C.gold : C.cyan });
      text(ctx, a, x, y + 510, { size: 30, fam: 'SansH', align: 'center' }); text(ctx, b, x, y + 545, { size: 22, fam: 'Sans', align: 'center', color: C.dim });
      if (i < 3) arrowHead(ctx, x + 172, y + 516, 0, 14, C.gold);
      ctx.restore();
    });
    A.vignette(ctx, 0.4);
  },
  cues: (S) => [0, 1, 2, 3].map((k) => [L(S, 0).t0 + 1.0 + k * 0.85, 'whoosh_s']).concat([[L(S, 1).t0 + 1.2, 'clunk']]),
};

// =========================== CE-5 STEP 1: LAUNCH ===========================
S1.ce5launch = {
  draw(ctx, t, S) {
    const sw = L(S, 2).t0 + 0.2; const aA = 1 - ease.inOut(prog(t, sw - 0.4, sw + 0.6));
    if (aA > 0) {
      ctx.save();
      const ign = 1.2, lift = 2.6; const dt = Math.max(0, t - lift);
      const rise = 0.5 * 90 * dt * dt + 15 * dt; const camY = Math.max(0, rise - 260);
      shake(ctx, t, 8 * prog(t, ign, ign + 0.6) * (1 - prog(t, lift + 2, lift + 4)));
      const fl = ease.out(prog(t, ign, ign + 0.8));
      A.launchSite(ctx, t, { tod: 'night', camY, glow: fl * (1 - prog(camY, 0, 900)) });
      A.launchTower(ctx, 820, 840 + camY, 580, 44);
      A.launchSmoke(ctx, t - ign, 960, 840 + camY, { n: 70, seed: 4 });
      A.cz5(ctx, 960, 840 + camY - rise, 10, { flame: fl, t });
      ctx.restore();
      ctx.save(); ctx.globalAlpha = aA;
      const ip = ease.out(prog(t, L(S, 1).t0, L(S, 1).t0 + 0.8));
      if (ip > 0) {
        ctx.save(); ctx.globalAlpha = aA * ip; panel(ctx, 70, 330, 470, 190, { accent: C.gold });
        text(ctx, '2020 年 11 月 24 日 4 时 30 分', 100, 382, { size: 30, fam: 'SansB' });
        text(ctx, '中国文昌航天发射场', 100, 432, { size: 30, fam: 'Sans', color: C.dim });
        text(ctx, '长征五号遥五运载火箭', 100, 482, { size: 30, fam: 'Sans', color: C.gold });
        ctx.restore();
      }
      ctx.restore();
    }
    if (aA < 1) {
      ctx.save(); ctx.globalAlpha = 1 - aA;
      A.space(ctx, t, { seed: 8, ox: -t * 6 });
      drawPlanet(ctx, 330, 800, 290, { kind: 'earth', lat: 15, lon: Math.round((110 + t * 1.5) * 4) / 4, light: [0.6, 0.5, 0.62], cloudLon: Math.round(t * 4) / 4 }); atmosphereGlow(ctx, 330, 800, 290);
      drawPlanet(ctx, 1650, 330, 78, { kind: 'moon', lat: 0, lon: 0, light: [-0.6, 0.2, 0.77] });
      const path = bezPts([560, 620], [900, 330], [1300, 230], [1560, 330], 120);
      const u = ease.inOut(prog(t, sw, S.dur - 0.4));
      dashed(ctx, path, 'rgba(255,255,255,0.3)', 2);
      trail(ctx, path, u, C.gold, 4);
      const q = polyAt(path, u); glowDot(ctx, q.x, q.y, 7, C.gold2, 1);
      ctx.save(); ctx.translate(q.x, q.y - 26); ctx.scale(0.5, 0.5); orbRet(ctx, 0, 0, 22, q.a + Math.PI / 2, { panels: 0.5 }); ctx.restore();
      text(ctx, '地月转移轨道', 900, 300, { size: 34, fam: 'SansB', color: C.gold, alpha: ease.out(prog(t, sw + 0.4, sw + 1.2)) });
      text(ctx, '地球', 330, 470, { size: 30, fam: 'SansB', align: 'center', color: C.dim, alpha: 1 - aA });
      text(ctx, '月球', 1650, 450, { size: 30, fam: 'SansB', align: 'center', color: C.dim, alpha: 1 - aA });
      for (const [fu, lab] of [[0.34, '第一次轨道修正'], [0.6, '第二次轨道修正']]) {
        const pq = polyAt(path, fu); const pa = prog(u, fu - 0.01, fu + 0.03);
        if (pa > 0) { flash(ctx, pq.x, pq.y, 90, (1 - prog(u, fu, fu + 0.08)) * 0.9); ctx.save(); ctx.globalAlpha = pa; ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pq.x, pq.y, 16, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); text(ctx, lab, pq.x, pq.y + 62, { size: 28, fam: 'SansB', align: 'center', color: C.cyan, alpha: pa, shadow: 8 }); }
      }
      const hrs = Math.round(112 * u);
      panel(ctx, 1450, 560, 400, 130, { alpha: ease.out(prog(t, L(S, 3).t0, L(S, 3).t0 + 0.6)), accent: C.cyan });
      text(ctx, '奔月飞行时间', 1480, 610, { size: 26, fam: 'Sans', color: C.dim, alpha: ease.out(prog(t, L(S, 3).t0, L(S, 3).t0 + 0.6)) });
      text(ctx, `约 ${hrs} 小时`, 1480, 666, { size: 46, fam: 'SansH', color: '#fff', alpha: ease.out(prog(t, L(S, 3).t0, L(S, 3).t0 + 0.6)) });
      A.vignette(ctx, 0.4);
      ctx.restore();
    }
    U.ce5Header(ctx, t, 0, S);
  },
  cues: (S) => [[1.2, 'launch', 9], [L(S, 2).t0 - 0.2, 'whoosh'], [L(S, 3).t0 + 1.5, 'puff'], [L(S, 3).t0 + 4.2, 'puff']],
};

// =========================== CE-5 STEP 2: LUNAR ORBIT INSERTION ===========================
S1.ce5loi = {
  draw(ctx, t, S) {
    A.space(ctx, t, { seed: 9, ox: -t * 3 });
    const cx = 980, cy = 560, mr = 230, R0 = 330;
    drawPlanet(ctx, cx, cy, mr, { kind: 'moon', lat: 0, lon: 0, light: [-0.6, 0.35, 0.72] });
    const inPath = bezPts([-60, 40], [300, 110], [cx - R0, cy - 300], [cx - R0, cy], 100);
    const tArr = L(S, 1).t0 + 4.0, tB0 = tArr - 0.6, tB1 = L(S, 2).t0 + 0.8;
    const u = ease.out(prog(t, L(S, 0).t0 - 0.6, tArr));
    // orbit phase after arrival
    const om = (tt) => tt <= tArr ? 0 : (tt - tArr) * 0.55 - Math.max(0, Math.min(tt, tB1) - tArr) * 0.25;
    const phi = Math.PI - om(t);
    dashed(ctx, inPath, 'rgba(255,255,255,0.25)', 2);
    trail(ctx, inPath, u, C.gold, 4);
    let px, py, ang;
    if (t <= tArr) { const q = polyAt(inPath, u); px = q.x; py = q.y; ang = q.a; }
    else {
      px = cx + R0 * Math.cos(phi); py = cy + R0 * Math.sin(phi); ang = phi - Math.PI / 2;
      ctx.save(); ctx.strokeStyle = C.green; ctx.lineWidth = 4; ctx.shadowColor = C.green; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(cx, cy, R0, phi, Math.PI); ctx.stroke(); ctx.restore();
    }
    const okp = ease.out(prog(t, L(S, 2).t0, L(S, 2).t0 + 0.8));
    if (okp > 0) { ctx.save(); ctx.globalAlpha = okp * 0.6; ctx.setLineDash([6, 10]); ctx.strokeStyle = C.green; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); text(ctx, '环月轨道', cx + R0 + 20, cy - 150, { size: 34, fam: 'SansB', color: C.green, alpha: okp }); }
    // burn
    const burn = prog(t, tB0, tB0 + 0.3) * (1 - prog(t, tB1 - 0.3, tB1));
    if (burn > 0) A.jet(ctx, px + Math.cos(ang) * 18, py + Math.sin(ang) * 18, ang, 90, 18, t, { intensity: burn, color: 'orange', seed: 3 });
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang - Math.PI / 2); A.ce5Orbiter(ctx, 0, 0, 18, { panels: 0.5 }); ctx.restore();
    glowDot(ctx, px, py, 4, '#fff', 0.6);
    const lb = ease.out(prog(t, tB0, tB0 + 0.6)) * (1 - prog(t, L(S, 3).t0, L(S, 3).t0 + 0.5));
    text(ctx, '近月制动', 380, 560, { size: 48, fam: 'SansH', align: 'right', color: C.orange, alpha: lb });
    text(ctx, '点火减速 ·“踩刹车”', 380, 610, { size: 28, fam: 'SansB', align: 'right', color: '#fff', alpha: lb });
    // speed gauge
    const ga = ease.out(prog(t, L(S, 1).t0, L(S, 1).t0 + 0.6)) * (1 - prog(t, L(S, 3).t0, L(S, 3).t0 + 0.5));
    if (ga > 0) {
      const v = 1 - 0.45 * ease.inOut(prog(t, tB0, tB1));
      ctx.save(); ctx.globalAlpha = ga; panel(ctx, 1460, 180, 400, 150, { accent: C.orange });
      text(ctx, '探测器速度', 1490, 228, { size: 26, fam: 'Sans', color: C.dim });
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, 1490, 258, 340, 26, 13); ctx.fill();
      const gg = ctx.createLinearGradient(1490, 0, 1830, 0); gg.addColorStop(0, C.green); gg.addColorStop(1, C.orange);
      ctx.fillStyle = gg; rr(ctx, 1490, 258, 340 * v, 26, 13); ctx.fill();
      text(ctx, burn > 0.2 ? '制动中 ↓' : v < 0.6 ? '已减速 ✓' : '高速接近', 1490, 314, { size: 24, fam: 'SansB', color: burn > 0.2 ? C.orange : '#fff' });
      ctx.restore();
    }
    // alternatives
    const l3 = L(S, 3); const p1 = ease.inOut(prog(t, l3.t0 + 0.2, l3.t0 + 2.2)), p2 = ease.inOut(prog(t, l3.t0 + 2.8, l3.t0 + 4.6)), p3 = ease.out(prog(t, l3.t0 + 5.0, l3.t0 + 5.8));
    const light = bezPts([cx - R0, cy], [cx - R0, cy + 330], [cx + 120, cy + 450], [1820, 860], 80);
    const heavy = bezPts([cx - R0, cy], [cx - R0 + 10, cy + 110], [cx - 230, cy + 190], [cx + 230 * Math.cos(2.35), cy + 230 * Math.sin(2.35)], 60);
    if (p1 > 0) { dashed(ctx, light, C.red2, 4, [14, 10], 0, p1); if (p1 >= 1) { crossMark(ctx, 1700, 830, 16); } text(ctx, '刹车太轻：掠月而过', 1380, 790, { size: 32, fam: 'SansB', color: C.red2, alpha: prog(p1, 0.6, 1), shadow: 8 }); }
    if (p2 > 0) { dashed(ctx, heavy, C.red2, 4, [14, 10], 0, p2); if (p2 >= 1) { flash(ctx, heavy[heavy.length - 1][0], heavy[heavy.length - 1][1], 70, 0.5 * (1 - prog(t, l3.t0 + 4.6, l3.t0 + 5.4))); crossMark(ctx, heavy[heavy.length - 1][0] - 40, heavy[heavy.length - 1][1] + 40, 14); } text(ctx, '刹车太重：撞向月面', 560, 850, { size: 32, fam: 'SansB', align: 'right', color: C.red2, alpha: prog(p2, 0.6, 1), shadow: 8 }); }
    if (p3 > 0) { checkMark(ctx, cx + R0 + 44, cy - 108, 18 * p3); text(ctx, '恰到好处', cx + R0 + 74, cy - 96, { size: 34, fam: 'SansB', color: C.green, alpha: p3, shadow: 8 }); }
    U.ce5Header(ctx, t, 1, S);
    A.vignette(ctx, 0.35);
  },
  cues: (S) => [[L(S, 1).t0 + 3.4, 'burn', 3.6]],
};

// =========================== CE-5 STEP 3: SEPARATION ===========================
S1.ce5sep = {
  draw(ctx, t, S) {
    A.space(ctx, t, { seed: 10, ox: t * 8 });
    limb(ctx);
    const l1 = L(S, 1), l2 = L(S, 2);
    const d = ease.inOut(prog(t, l2.t0 - 0.2, l2.t0 + 4.5));
    const s = 46; const bob = Math.sin(t * 0.8) * 6;
    const ox = 960 + 260 * d, oy = 330 - 70 * d + bob;
    const lx = 960 - 300 * d, ly = 330 + 0.7 * s + 0.5 * s + 1.0 * s + 1.45 * s + 22 + 150 * d + bob;
    // highlight groups
    const hl = ease.out(prog(t, l1.t0 + 1.0, l1.t0 + 2.0));
    if (hl > 0) {
      ctx.save(); ctx.globalAlpha = hl * (1 - d * 0.7); ctx.setLineDash([8, 8]); ctx.lineWidth = 2.5;
      ctx.strokeStyle = C.cyan; rr(ctx, ox - 170, oy - 1.9 * s, 340, 2.9 * s, 20); ctx.stroke();
      ctx.strokeStyle = C.gold; rr(ctx, lx - 190, ly - 2.4 * s, 380, 3.4 * s, 20); ctx.stroke(); ctx.restore();
    }
    orbRet(ctx, ox, oy, s, 0, { panels: 0.55 });
    landAsc(ctx, lx, ly - 1.2 * s, s, -0.15 * d, { ascender: true });
    flash(ctx, 960, 330 + 1.3 * s, 160, (1 - prog(t, l2.t0 - 0.2, l2.t0 + 0.6)) * prog(t, l2.t0 - 0.4, l2.t0 - 0.2));
    if (d > 0.05) {
      A.jet(ctx, lx, ly + 0.2 * s, Math.PI / 2 - 0.15, 40, 12, t, { intensity: 0.4 * (1 - prog(d, 0.6, 1)), color: 'blue' });
    }
    callout(ctx, ox + 120, oy + 10, ox + 260, oy + 110, '轨返组合体', '留在环月轨道等待', prog(t, l2.t0 + 2.0, l2.t0 + 3.0), { color: C.cyan, size: 34 });
    callout(ctx, lx - 120, ly - 60, lx - 160, ly + 120, '着上组合体', '降低轨道，准备落月', prog(t, l2.t0 + 3.0, l2.t0 + 4.0), { color: C.gold, align: 'right', size: 34 });
    text(ctx, '一分为二', 960, 250 - 60, { size: 40, fam: 'SansH', align: 'center', color: '#fff', alpha: ease.out(prog(t, l1.t0 + 0.8, l1.t0 + 1.6)) * (1 - prog(t, l2.t0 + 1, l2.t0 + 2)) });
    U.ce5Header(ctx, t, 2, S);
    A.vignette(ctx, 0.35);
  },
  cues: (S) => [[L(S, 2).t0 - 0.3, 'clunk'], [L(S, 2).t0 + 0.2, 'whoosh_s']],
};

// =========================== CE-5 STEP 4: POWERED DESCENT ===========================
const ALT = [[15000, 230], [3000, 560], [100, 742], [30, 782], [0, 812]];
function yOfH(h) { for (let i = 0; i < ALT.length - 1; i++) { const [h0, y0] = ALT[i], [h1, y1] = ALT[i + 1]; if (h <= h0 && h >= h1) return lerp(y0, y1, (h0 - h) / (h0 - h1)); } return h > 15000 ? 230 : 812; }
function hOfY(y) { for (let i = 0; i < ALT.length - 1; i++) { const [h0, y0] = ALT[i], [h1, y1] = ALT[i + 1]; if (y >= y0 && y <= y1) return lerp(h0, h1, (y - y0) / (y1 - y0)); } return y < 230 ? 15000 : 0; }
const GROUND = (x) => 812 + Math.pow((x - 1560) / 1500, 2) * 260;
const DSEG = (() => {
  const P = (x, h) => [x, yOfH(h)];
  const seg0 = bezPts(P(200, 15000), P(560, 14600), P(820, 8000), P(1000, 3000), 120);
  const seg1 = bezPts(P(1000, 3000), P(1040, 2500), P(1080, 2300), P(1110, 2100), 30);
  const seg2 = bezPts(P(1110, 2100), P(1200, 1200), P(1300, 400), P(1350, 100), 60);
  const seg4 = bezPts(P(1350, 100), P(1430, 95), P(1520, 60), P(1560, 30), 40);
  const seg5 = bezPts(P(1560, 30), P(1560, 20), P(1560, 8), P(1560, 0), 20);
  return [seg0, seg1, seg2, [P(1350, 100), P(1350, 100)], seg4, seg5];
})();
const PHASES = [['主减速段', C.gold], ['快速调整段', C.orange], ['接近段', C.cyan], ['悬停段', C.green], ['避障段', '#c79bff'], ['缓速下降段', '#ffffff']];
function descentState(t, S) {
  const l = (k) => L(S, k);
  const ign = l(1).t0 + 2.6;
  const tl = [[ign, l(2).t1 + 0.2], [l(3).t0, l(3).t1], [l(4).t0, l(4).t1], [l(5).t0, l(5).t1], [l(6).t0, l(6).t1], [l(7).t0, l(7).t1 - 0.9]];
  let seg = 0, f = 0;
  if (t < ign) { seg = 0; f = 0; }
  else { for (let i = 0; i < 6; i++) { if (t >= tl[i][0]) { seg = i; f = prog(t, tl[i][0], tl[i][1]); } } }
  if (seg === 0) f = ease.sine(f) * 0.98 + 0.02 * f;
  else if (seg === 5) f = ease.out(f);
  else f = ease.inOut(f);
  const q = polyAt(DSEG[seg], f);
  let rot; // 0 = upright (engine down); -PI/2 = engine pointing forward (+x)
  if (seg === 0) rot = -Math.PI / 2 + 0.25 * f; else if (seg === 1) rot = lerp(-Math.PI / 2 + 0.25, 0, ease.inOut(f)); else rot = 0;
  if (seg === 4) rot = -0.12 * Math.sin(f * Math.PI);
  const landed = seg === 5 && f >= 0.999;
  const engine = t < ign ? 0 : (seg === 5 ? (f < 0.86 ? 0.7 : 0) : seg === 0 ? 1 : 0.7);
  return { x: q.x, y: q.y, rot, seg, f, engine: engine * prog(t, ign, ign + 0.4), landed, ign };
}
S1.ce5descent = {
  draw(ctx, t, S) {
    const st = descentState(t, S);
    const l8 = L(S, 8);
    const zoom = ease.inOut(prog(t, l8.t0 - 0.4, l8.t0 + 1.8));
    ctx.save();
    const zx = 1560, zy = 790, zs = 1 + zoom * 1.8; ctx.translate(lerp(zx, 960, zoom), lerp(zy, 600, zoom)); ctx.scale(zs, zs); ctx.translate(-zx, -zy);
    A.space(ctx, t, { seed: 12, alpha: 0.8 });
    // ground with curvature + craters/rocks near the landing zone
    ctx.fillStyle = '#56544f'; ctx.beginPath(); ctx.moveTo(-200, GROUND(-200)); for (let x = -200; x <= W + 200; x += 20) ctx.lineTo(x, GROUND(x) + (x > 1200 && x < 1900 ? Math.sin(x * 0.05) * 1.5 : 0)); ctx.lineTo(W + 200, H + 400); ctx.lineTo(-200, H + 400); ctx.closePath();
    const gg = ctx.createLinearGradient(0, 780, 0, 1100); gg.addColorStop(0, '#77746d'); gg.addColorStop(1, '#3d3c39'); ctx.fillStyle = gg; ctx.fill();
    const hazards = [[1290, 26, 'c'], [1420, 18, 'r'], [1660, 30, 'c'], [1500, 10, 'r'], [1760, 14, 'r']];
    for (const [hx, hr, ty] of hazards) { const gy = GROUND(hx); if (ty === 'c') { ctx.fillStyle = '#2d2c2a'; ctx.beginPath(); ctx.ellipse(hx, gy + 2, hr, hr * 0.28, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#9a968e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(hx, gy, hr * 1.08, hr * 0.32, 0, Math.PI, 0); ctx.stroke(); } else { ctx.fillStyle = '#8d8981'; ctx.beginPath(); ctx.ellipse(hx, gy - hr * 0.3, hr * 0.8, hr * 0.55, 0, 0, Math.PI * 2); ctx.fill(); } }
    // altitude axis
    const ax = ease.out(prog(t, 0.6, 1.6)) * (1 - zoom);
    if (ax > 0) {
      ctx.save(); ctx.globalAlpha = ax; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(110, 220); ctx.lineTo(110, 812); ctx.stroke();
      for (const [h, lab] of [[15000, '15 km'], [3000, '3 km'], [100, '100 m'], [0, '0']]) { const y = yOfH(h); ctx.beginPath(); ctx.moveTo(100, y); ctx.lineTo(120, y); ctx.stroke(); text(ctx, lab, 92, y + 9, { size: 24, fam: 'SansB', align: 'right', color: C.dim }); ctx.setLineDash([4, 10]); ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.moveTo(120, y); ctx.lineTo(1880, y); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; }
      text(ctx, '高度（非线性刻度示意）', 140, 205, { size: 22, fam: 'Sans', color: 'rgba(255,255,255,0.45)' });
      ctx.restore();
    }
    // path: ghost then coloured segments as phases begin
    const pa = ease.out(prog(t, L(S, 0).t0, L(S, 0).t0 + 1.5));
    DSEG.forEach((seg) => dashed(ctx, seg, `rgba(255,255,255,${0.25 * pa})`, 2, [8, 8]));
    DSEG.forEach((seg, i) => {
      if (i === 3) return;
      const done = i < st.seg ? 1 : i === st.seg ? st.f : 0; if (done <= 0) return;
      ctx.save(); ctx.strokeStyle = PHASES[i][1]; ctx.lineWidth = 5; ctx.shadowColor = PHASES[i][1]; ctx.shadowBlur = 12; strokePoly(ctx, seg, 0, done); ctx.restore();
    });
    // phase labels along path
    const labPos = [[520, 300], [1060, 515], [1150, 680], [1350, 690], [1455, 715], [1610, 745]];
    PHASES.forEach(([name, col], i) => {
      const lk = i === 0 ? 2 : i + 2; const a = ease.out(prog(t, L(S, lk).t0, L(S, lk).t0 + 0.6)) * (1 - zoom);
      if (a <= 0) return; const [x, y] = labPos[i];
      const cur = st.seg === i && !st.landed;
      text(ctx, `${i + 1} ${name}`, x, y, { size: cur ? 30 : 24, fam: 'SansB', align: i >= 3 ? 'center' : 'left', color: col, alpha: a * (cur ? 1 : 0.75), shadow: 8 });
    });
    // approach camera cone / hover laser scan
    const l4 = L(S, 4), l5 = L(S, 5), l6 = L(S, 6);
    const cone = prog(t, l4.t0 + 0.4, l4.t0 + 1) * (1 - prog(t, l4.t1 - 0.3, l4.t1 + 0.3));
    if (cone > 0) {
      ctx.save(); ctx.globalAlpha = cone * 0.5; const cg = ctx.createLinearGradient(st.x, st.y, 1500, 812); cg.addColorStop(0, 'rgba(255,230,140,0.6)'); cg.addColorStop(1, 'rgba(255,230,140,0.05)'); ctx.fillStyle = cg;
      ctx.beginPath(); ctx.moveTo(st.x, st.y + 10); ctx.lineTo(1250, GROUND(1250)); ctx.lineTo(1800, GROUND(1800)); ctx.closePath(); ctx.fill(); ctx.restore();
      for (const [hx, hr] of hazards) { const gy = GROUND(hx); ctx.save(); ctx.globalAlpha = cone; ctx.strokeStyle = C.red2; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, gy - 4, hr + 10, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      text(ctx, '光学成像 · 粗避障', 1560, 560, { size: 30, fam: 'SansB', align: 'center', color: '#ffe38f', alpha: cone, shadow: 8 });
    }
    const scan = prog(t, l5.t0 + 0.3, l5.t0 + 0.8) * (1 - prog(t, l6.t1 - 0.3, l6.t1 + 0.2));
    if (scan > 0 && !st.landed) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 14; k++) { const sweep = Math.sin(t * 2.6 + k * 0.45); const gx = st.x + sweep * 220 + (k - 7) * 6; const a = 0.18 * scan; ctx.strokeStyle = `rgba(90,255,170,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(st.x, st.y + 8); ctx.lineTo(gx, GROUND(gx)); ctx.stroke(); }
      ctx.restore();
    }
    // lander
    const s = 15;
    ctx.save(); ctx.translate(st.x, st.y); ctx.rotate(st.rot);
    if (st.engine > 0) A.plume(ctx, 0, 0.55 * s, 0.6 * s, (st.seg === 0 ? 8 : 4) * s, t, { intensity: st.engine, color: 'blue', seed: 6 });
    A.ce5Lander(ctx, 0, 1.2 * s, s, { ascender: true, legs: 1 });
    ctx.restore();
    if (st.seg === 5 && st.f > 0.5) A.dustBurst(ctx, st.x, GROUND(st.x), t, { power: (st.landed ? 1 - prog(t, L(S, 7).t1 - 0.9, L(S, 7).t1 + 0.6) : prog(st.f, 0.5, 0.9)) * 0.8, n: 26, seed: 4 });
    ctx.restore(); // end zoom transform
    // ignition label
    const il = ease.out(prog(t, st.ign - 0.3, st.ign + 0.4)) * (1 - prog(t, L(S, 2).t0 + 0.5, L(S, 2).t0 + 1.2));
    if (il > 0) callout(ctx, 220, 240, 330, 380, '点火！7500 牛变推力发动机', '全程自主完成着陆', il, { color: C.orange, size: 34 });
    // hazard map inset during hover / avoidance
    const ins = prog(t, l5.t0 + 0.6, l5.t0 + 1.3) * (1 - prog(t, l6.t1, l6.t1 + 0.5));
    if (ins > 0) {
      const x0 = 190, y0 = 400, w = 380, h = 250; ctx.save(); ctx.globalAlpha = ins; panel(ctx, x0, y0, w, h, { fill: 'rgba(4,14,20,0.85)', line: C.green, glow: 18 });
      text(ctx, '激光三维成像 · 精避障', x0 + 20, y0 + 40, { size: 24, fam: 'SansB', color: C.green });
      const gx0 = x0 + 30, gy0 = y0 + 60, cs = 40; const bad = new Set(['0,1', '1,1', '2,3', '3,0', '4,2', '5,3', '6,1', '1,3', '5,0', '7,2', '7,3']);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) {
        const isBad = bad.has(`${i},${j}`); const safe = i === 6 && j === 2;
        ctx.fillStyle = isBad ? 'rgba(255,80,60,0.55)' : 'rgba(60,200,140,0.18)';
        const reveal = prog(t, l5.t0 + 1.0 + (i + j) * 0.18, l5.t0 + 1.4 + (i + j) * 0.18); if (reveal <= 0) continue;
        ctx.globalAlpha = ins * reveal; ctx.fillRect(gx0 + i * cs + 2, gy0 + j * cs + 2, cs - 4, cs - 4);
        if (safe && t > l6.t0) { ctx.globalAlpha = ins; ctx.strokeStyle = C.green; ctx.lineWidth = 4; ctx.strokeRect(gx0 + i * cs, gy0 + j * cs, cs, cs); ctx.shadowColor = C.green; ctx.shadowBlur = 16; ctx.strokeRect(gx0 + i * cs, gy0 + j * cs, cs, cs); ctx.shadowBlur = 0; }
      }
      ctx.globalAlpha = ins; text(ctx, t > l6.t0 ? '✓ 已选定安全着陆点' : '扫描地形中…', x0 + w - 20, y0 + h - 16, { size: 22, fam: 'SansB', align: 'right', color: t > l6.t0 ? C.green : C.dim });
      ctx.restore();
    }
    // HUD
    const hud = ease.out(prog(t, L(S, 0).t0 + 0.6, L(S, 0).t0 + 1.4)) * (1 - zoom);
    if (hud > 0) {
      const h = st.landed ? 0 : hOfY(st.y); const hs = h >= 1000 ? `${(h / 1000).toFixed(1)} km` : `${Math.max(0, Math.round(h))} m`;
      const vFrac = [[1, 0.05], [0.05, 0.035], [0.035, 0.01], [0, 0], [0.008, 0.004], [0.004, 0]][st.seg]; const v = st.landed ? 0 : t < st.ign ? 1 : lerp(vFrac[0], vFrac[1], st.f);
      ctx.save(); ctx.globalAlpha = hud; panel(ctx, 1480, 160, 380, 230, { fill: 'rgba(4,10,24,0.78)', accent: PHASES[st.seg][1] });
      text(ctx, '高度', 1510, 205, { size: 24, fam: 'Sans', color: C.dim }); text(ctx, hs, 1840, 212, { size: 44, fam: 'SansH', align: 'right' });
      text(ctx, '速度', 1510, 262, { size: 24, fam: 'Sans', color: C.dim });
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, 1590, 244, 250, 20, 10); ctx.fill(); ctx.fillStyle = C.cyan; rr(ctx, 1590, 244, Math.max(4, 250 * Math.pow(v, 0.5)), 20, 10); ctx.fill();
      if (t < L(S, 3).t0) text(ctx, '初始约 1.7 km/s', 1840, 296, { size: 20, fam: 'Sans', align: 'right', color: 'rgba(255,255,255,0.5)' });
      text(ctx, '阶段', 1510, 350, { size: 24, fam: 'Sans', color: C.dim });
      text(ctx, st.landed ? '已着陆' : t < st.ign ? '准备点火' : PHASES[st.seg][0], 1840, 354, { size: 34, fam: 'SansH', align: 'right', color: st.landed ? C.green : PHASES[st.seg][1] });
      ctx.restore();
    }
    U.badge(ctx, 960, 250, '着陆成功', prog(t, l8.t0 + 1.2, l8.t0 + 2.0), { size: 54, color: C.green, sub: '2020.12.01 · 月球正面风暴洋北部' });
    U.ce5Header(ctx, t, 3, S, [700, 170]);
    A.vignette(ctx, 0.35);
  },
  cues: (S) => { const ign = L(S, 1).t0 + 2.6; return [[ign, 'burn', L(S, 7).t1 - 1.6 - ign], [L(S, 5).t0 + 0.4, 'scan'], [L(S, 7).t1 - 0.9, 'thud'], [L(S, 8).t0 + 1.2, 'chime']]; },
};

// =========================== CE-5 STEP 5: SAMPLING ===========================
S1.ce5sample = {
  draw(ctx, t, S) {
    const earth = (c) => { drawPlanet(c, 1600, 190, 38, { kind: 'earth', lat: 10, lon: 100, light: [0.9, 0.3, 0.3] }); atmosphereGlow(c, 1600, 190, 38, { strength: 0.6 }); };
    A.lunarScene(ctx, t, { hy: 600, seed: 12, earth });
    const gx = 820, gy = 770, s = 62;
    const l1 = L(S, 1), l2 = L(S, 2), l3 = L(S, 3);
    const mid = (l1.t0 + l1.t1) / 2;
    // cutaway
    const cw = ease.out(prog(t, l1.t0 - 0.3, l1.t0 + 0.4));
    if (cw > 0) {
      ctx.save(); ctx.globalAlpha = cw; ctx.beginPath(); rr(ctx, 540, gy + 6, 560, 150, 14); ctx.clip();
      const sg = ctx.createLinearGradient(0, gy, 0, gy + 160); sg.addColorStop(0, '#6d6a63'); sg.addColorStop(0.4, '#5a5148'); sg.addColorStop(1, '#3b342d'); ctx.fillStyle = sg; ctx.fillRect(540, gy, 560, 160);
      for (let k = 0; k < 40; k++) { ctx.fillStyle = `rgba(${k % 2 ? '30,26,22' : '140,130,118'},0.45)`; ctx.beginPath(); ctx.ellipse(560 + ((k * 137) % 520), gy + 20 + ((k * 53) % 125), 6 + (k % 4) * 3, 4 + (k % 3) * 2, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore(); ctx.save(); ctx.globalAlpha = cw; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; rr(ctx, 540, gy + 6, 560, 150, 14); ctx.stroke(); ctx.restore();
      text(ctx, '剖面示意', 560, gy + 40, { size: 20, fam: 'Sans', color: 'rgba(255,255,255,0.6)', alpha: cw });
    }
    // drill
    const dIn = ease.inOut(prog(t, l1.t0 + 0.2, mid - 0.4)), dOut = ease.inOut(prog(t, mid - 0.2, mid + 0.8));
    const drill = 3.4 * dIn * (1 - dOut * 0.95);
    // arm
    const ar = ease.inOut(prog(t, mid + 0.2, l1.t1 - 0.8)), back = ease.inOut(prog(t, l1.t1 - 0.6, l2.t0 + 1.0));
    const arm = { a1: lerp(lerp(-1.25, 0.35, ar), -1.25, back), a2: lerp(lerp(-2.6, 1.25, ar), -2.6, back) };
    A.ce5Lander(ctx, gx, gy, s, { ascender: true, drill, arm, flagUp: ease.inOut(prog(t, l3.t0 + 0.4, l3.t0 + 2.4)), t });
    if (dIn > 0 && dOut < 1) { const tipY = gy - 1.45 * s + 0.6 * s + drill * s; ctx.save(); ctx.globalAlpha = 0.8; for (let k = 0; k < 6; k++) { const yy = tipY - k * 12 - ((t * 120) % 12); if (yy > gy) { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.moveTo(gx - 0.85 * s - 8, yy); ctx.lineTo(gx - 0.85 * s + 13, yy + 5); ctx.stroke(); } } ctx.restore(); if (dIn > 0.98 && dOut < 0.1) flash(ctx, gx - 0.81 * s, tipY, 40, 0.5); }
    // labels
    callout(ctx, gx - 0.81 * s, gy + 90, 380, gy + 70, '钻取', '采集月面以下的样品', prog(t, l1.t0 + 0.8, l1.t0 + 1.6) * (1 - prog(t, l2.t0 + 0.5, l2.t0 + 1.2)), { color: C.cyan, align: 'right' });
    if (arm.tip) callout(ctx, arm.tip[0], arm.tip[1], 1320, 640, '表取', '机械臂铲取表层月壤', prog(t, mid + 0.8, mid + 1.6) * (1 - prog(t, l2.t0 + 0.5, l2.t0 + 1.2)), { color: C.gold });
    // sample container to ascender
    const sp = ease.inOut(prog(t, l2.t0 + 0.6, l2.t1 - 0.6));
    if (sp > 0 && sp < 1) { const x = lerp(gx + 1.6 * s, gx, sp), y = lerp(gy - 1.6 * s, gy - 2.6 * s, sp) - Math.sin(sp * Math.PI) * 80; glowDot(ctx, x, y, 9, C.gold2, 1); }
    if (sp >= 1) flash(ctx, gx, gy - 2.7 * s, 80, 0.6 * (1 - prog(t, l2.t1 - 0.6, l2.t1 + 0.4)));
    callout(ctx, gx + 20, gy - 2.6 * s, 1180, 300, '密封封装', '样品转移至上升器', prog(t, l2.t0 + 1.0, l2.t0 + 1.8) * (1 - prog(t, l3.t0 + 0.4, l3.t0 + 1.0)), { color: C.gold });
    callout(ctx, gx - 1.25 * s - 0.4 * s, gy - 1.9 * s - 1.1 * s, 380, 330, '五星红旗', '在月面展开', prog(t, l3.t0 + 2.0, l3.t0 + 2.8), { color: C.red2, align: 'right' });
    U.ce5Header(ctx, t, 4, S);
    A.vignette(ctx, 0.35);
  },
  cues: (S) => [[L(S, 1).t0 + 0.2, 'drill', 3.0], [(L(S, 1).t0 + L(S, 1).t1) / 2 + 0.3, 'servo', 2.2], [L(S, 2).t1 - 0.6, 'clunk'], [L(S, 3).t0 + 0.6, 'flag']],
};

// =========================== CE-5 STEP 6: LUNAR ASCENT ===========================
S1.ce5ascent = {
  draw(ctx, t, S) {
    const l1 = L(S, 1), l2 = L(S, 2);
    const ign = l1.t0 + 1.0, lift = ign + 0.6; const dt = Math.max(0, t - lift);
    const rise = 0.5 * 160 * dt * dt + 30 * dt; const camY = Math.max(0, rise - 330);
    ctx.save(); shake(ctx, t, 5 * prog(t, ign, ign + 0.3) * (1 - prog(t, lift + 1, lift + 2.5)));
    ctx.translate(0, camY * 0.6);
    const earth = (c) => { drawPlanet(c, 1580, 210 - camY * 0.2, 44, { kind: 'earth', lat: 10, lon: 120, light: [0.9, 0.3, 0.3] }); atmosphereGlow(c, 1580, 210 - camY * 0.2, 44, { strength: 0.6 }); };
    A.lunarScene(ctx, t, { hy: 640, seed: 13, earth });
    const gx = 960, gy = 860, s = 55;
    A.ce5Lander(ctx, gx, gy, s, { ascender: false, flagUp: 1, t });
    const fl = prog(t, ign, ign + 0.3) * (1 - prog(dt, 3.5, 4.5));
    const ay = gy - 1.9 * s - rise;
    if (fl > 0) { A.plume(ctx, gx, ay + 0.1 * s, 0.4 * s, (rise < 20 ? 1.2 : 3.5) * s, t, { intensity: fl, color: 'orange', seed: 9 }); flash(ctx, gx, gy - 1.9 * s, 200, fl * 0.5 * (1 - prog(dt, 0, 1.5))); }
    A.ce5Ascender(ctx, gx, ay, s);
    if (t > ign) A.dustBurst(ctx, gx, gy, t, { power: 0.6 * (1 - prog(dt, 0, 2)), n: 30, seed: 9 });
    ctx.restore();
    callout(ctx, gx + 150, gy - 1.6 * s + camY * 0.6, 1300, 700 + camY * 0.6 * 0, '以着陆器为“发射台”', '上升器点火起飞', prog(t, l1.t0 + 2.0, l1.t0 + 2.8) * (1 - prog(t, l2.t0 + 0.3, l2.t0 + 1)), { color: C.gold });
    if (t > l2.t0 - 0.2) { ctx.save(); ctx.globalAlpha = ease.out(prog(t, l2.t0 - 0.2, l2.t0 + 0.6)) * 0.55; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    U.badge(ctx, 960, 470, '我国航天器首次地外天体起飞', prog(t, l2.t0, l2.t0 + 0.8), { size: 50 });
    U.ce5Header(ctx, t, 5, S);
    A.vignette(ctx, 0.35);
  },
  cues: (S) => [[L(S, 1).t0 + 1.0, 'launch_s', 4.5], [L(S, 2).t0, 'chime']],
};

// =========================== CE-5 STEP 7: DOCKING ===========================
S1.ce5dock = {
  draw(ctx, t, S) {
    A.space(ctx, t, { seed: 14, ox: t * 6 });
    limb(ctx);
    const l1 = L(S, 1), l2 = L(S, 2), l3 = L(S, 3);
    const s = 48, tx = 1180, ty = 440 + Math.sin(t * 0.7) * 4;
    orbRet(ctx, tx, ty, s, -Math.PI / 2, { panels: 0.7 });
    const contact = l1.t0 + 3.6;
    const ap = ease.out(prog(t, 0.4, contact));
    const sep = ease.inOut(prog(t, l3.t0 + 0.2, S.dur));
    const ax = lerp(240, tx - 1.7 * s - 1.06 * s, ap) - sep * 260, ay = ty + sep * 120;
    ctx.save(); ctx.globalAlpha = 1 - sep * 0.6; ctx.translate(ax, ay); ctx.rotate(Math.PI / 2 + sep * 0.6); A.ce5Ascender(ctx, 0, 0, s); ctx.restore();
    if (ap < 1) { const pf = (t * 2) % 1; if (pf < 0.3) A.jet(ctx, ax + 0.4 * s, ay - 0.45 * s, -Math.PI / 2, 22, 8, t, { intensity: 0.6, color: 'blue' }); }
    flash(ctx, tx - 1.7 * s, ty, 120, 0.8 * (1 - prog(t, contact, contact + 0.6)) * prog(t, contact - 0.1, contact));
    callout(ctx, tx - 1.7 * s, ty - 30, 820, 230, '抱爪式对接', '上升器被牢牢“抓住”', prog(t, contact + 0.2, contact + 1.0) * (1 - prog(t, l2.t0, l2.t0 + 0.6)), { color: C.cyan });
    const tp = ease.inOut(prog(t, contact + 1.4, l1.t1 - 0.2));
    if (tp > 0 && tp < 1) glowDot(ctx, lerp(ax + 0.4 * s, tx - 1.2 * s, tp), ty, 8, C.gold2, 1);
    if (tp > 0) callout(ctx, tx - 1.2 * s, ty + 30, 1320, 700, '样品容器 → 返回器', '', prog(t, contact + 1.6, contact + 2.4) * (1 - prog(t, l2.t0, l2.t0 + 0.6)), { color: C.gold });
    U.badge(ctx, 960, 760, '我国首次月球轨道交会对接', prog(t, l2.t0, l2.t0 + 0.8) * (1 - prog(t, l3.t0, l3.t0 + 0.5)), { size: 48 });
    text(ctx, '上升器分离', ax, ay + 110, { size: 30, fam: 'SansB', align: 'center', color: C.dim, alpha: prog(t, l3.t0 + 0.6, l3.t0 + 1.2) });
    U.ce5Header(ctx, t, 6, S);
    A.vignette(ctx, 0.35);
  },
  cues: (S) => [[L(S, 1).t0 + 3.6, 'clunk'], [L(S, 1).t0 + 5.2, 'servo', 2], [L(S, 2).t0, 'chime'], [L(S, 3).t0 + 0.2, 'whoosh_s']],
};

// =========================== CE-5 STEP 8: RETURN & REENTRY ===========================
function snowField(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, 780); g.addColorStop(0, '#02040c'); g.addColorStop(1, '#102040'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  A.space(ctx, t, { alpha: 0.7, top: 'rgba(0,0,0,0)', bottom: 'rgba(0,0,0,0)', seed: 41 });
  const sg = ctx.createLinearGradient(0, 780, 0, H); sg.addColorStop(0, '#9fb3cf'); sg.addColorStop(1, '#5f7290'); ctx.fillStyle = sg; ctx.fillRect(0, 780, W, H);
  ctx.fillStyle = '#20283a'; ctx.beginPath(); ctx.moveTo(0, 790); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 782 - 14 * Math.sin(x * 0.004) - 6 * Math.sin(x * 0.02)); ctx.lineTo(W, 795); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 4; i++) { const x = 300 + i * 420 + Math.sin(t * 0.3 + i) * 20; glowDot(ctx, x, 800, 3, 'rgba(255,240,200,1)', 0.8); glowDot(ctx, x + 14, 800, 3, 'rgba(255,240,200,1)', 0.8); }
  for (let i = 0; i < 120; i++) { const x = (i * 97 + t * 20) % W, y = (i * 61 + t * 40 + i * i) % H; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, 2, 2); }
}
S1.ce5return = {
  draw(ctx, t, S) {
    const l1 = L(S, 1), l2 = L(S, 2), l3 = L(S, 3), l4 = L(S, 4);
    const aB = prog(t, l3.t0 - 0.5, l3.t0 + 0.3), aC = prog(t, l4.t0 - 0.5, l4.t0 + 0.3);
    // Part A: Moon -> Earth
    if (aB < 1) {
      ctx.save();
      A.space(ctx, t, { seed: 15, ox: t * 5 });
      drawPlanet(ctx, 1620, 250, 95, { kind: 'moon', lat: 0, lon: 0, light: [-0.6, 0.2, 0.77] });
      drawPlanet(ctx, 330, 740, 250, { kind: 'earth', lat: 40, lon: Math.round((110 + t * 1.5) * 4) / 4, light: [0.55, 0.45, 0.7], cloudLon: Math.round(t * 4) / 4 }); atmosphereGlow(ctx, 330, 740, 250);
      const path = bezPts([1520, 300], [1200, 300], [760, 420], [545, 600], 120);
      dashed(ctx, path, 'rgba(255,255,255,0.3)', 2);
      const u = ease.inOut(prog(t, l1.t0 - 0.3, l1.t1 - 0.2)) * 0.82 + 0.18 * ease.in(prog(t, l2.t0, l2.t1));
      trail(ctx, path, u, '#e9eefc', 4);
      const q = polyAt(path, u);
      const sepT = l1.t1 - 0.6; const sp = prog(t, sepT, sepT + 2.5);
      if (t < l1.t0 + 1.5) A.jet(ctx, q.x - Math.cos(q.a) * 20, q.y - Math.sin(q.a) * 20, q.a + Math.PI, 50, 14, t, { intensity: prog(t, l1.t0 - 0.2, l1.t0 + 0.2) * (1 - prog(t, l1.t0 + 1.0, l1.t0 + 1.5)) });
      if (sp <= 0) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a - Math.PI / 2); orbRet(ctx, 0, 0, 18, 0, { panels: 0.5 }); ctx.restore(); }
      else {
        const qo = polyAt(path, Math.min(u, 0.82)); const ox = qo.x - 30 * sp - 10, oy = qo.y - 180 * ease.out(sp);
        ctx.save(); ctx.globalAlpha = 1 - prog(sp, 0.6, 1); ctx.translate(ox, oy); A.ce5Orbiter(ctx, 0, 0, 18, { panels: 0.5 }); ctx.restore();
        text(ctx, '轨道器', ox + 60, oy - 20, { size: 26, fam: 'SansB', color: C.dim, alpha: prog(sp, 0.1, 0.3) * (1 - prog(sp, 0.7, 1)) });
        A.plasma(ctx, q.x, q.y, q.a, 16, t, prog(t, l2.t0 + 1.0, l2.t1));
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a + Math.PI / 2); A.ce5Returner(ctx, 0, 10, 18); ctx.restore();
        text(ctx, '返回器分离', q.x + 30, q.y - 50, { size: 30, fam: 'SansB', color: C.gold, alpha: prog(sp, 0.05, 0.25) });
      }
      text(ctx, '月地转移', 1080, 300, { size: 34, fam: 'SansB', color: '#e9eefc', alpha: ease.out(prog(t, l1.t0, l1.t0 + 0.8)) });
      U.badge(ctx, 1220, 640, '≈ 11 km/s', prog(t, l2.t0, l2.t0 + 0.7), { size: 44, sub: '接近第二宇宙速度', color: C.orange });
      A.vignette(ctx, 0.35);
      ctx.restore();
    }
    // Part B: skip reentry diagram
    if (aB > 0 && aC < 1) {
      ctx.save(); ctx.globalAlpha = aB;
      A.space(ctx, t, { seed: 16 });
      const ecx = 960, ecy = 2700, R = 2050, atm = 150;
      const ag = ctx.createRadialGradient(ecx, ecy, R, ecx, ecy, R + atm); ag.addColorStop(0, 'rgba(110,180,255,0.55)'); ag.addColorStop(1, 'rgba(110,180,255,0)');
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(ecx, ecy, R + atm, 0, Math.PI * 2); ctx.fill();
      const eg = ctx.createLinearGradient(0, 640, 0, H); eg.addColorStop(0, '#2f6fb3'); eg.addColorStop(1, '#0b2a55'); ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ecx, ecy, R, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(ecx, ecy, R, 0, Math.PI * 2); ctx.clip(); for (let k = 0; k < 18; k++) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse((k * 211 + t * 8) % (W + 300) - 150, 690 + (k % 4) * 40, 120 + (k % 3) * 60, 10, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
      text(ctx, '大气层', 1840, 600, { size: 26, fam: 'SansB', align: 'right', color: 'rgba(160,210,255,0.9)' });
      const pts = catmull([[60, 120], [380, 380], [600, 560], [760, 610], [940, 520], [1090, 440], [1240, 470], [1480, 590], [1760, 740]], 18);
      dashed(ctx, pts, 'rgba(255,255,255,0.3)', 2);
      const u = ease.inOut(prog(t, l3.t0, l3.t1 + 0.2)); trail(ctx, pts, u, C.orange, 4);
      const q = polyAt(pts, u); const inAtm = Math.hypot(q.x - ecx, q.y - ecy) < R + atm * 0.75;
      A.plasma(ctx, q.x, q.y, q.a, 18, t, inAtm ? 1 : 0.15);
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a + Math.PI / 2); A.ce5Returner(ctx, 0, 10, 20); ctx.restore();
      const lab = (f, s1, x, y, col = '#fff') => text(ctx, s1, x, y, { size: 32, fam: 'SansB', align: 'center', color: col, alpha: prog(u, f - 0.05, f + 0.05), shadow: 10 });
      lab(0.3, '① 第一次再入 · 减速', 720, 700);
      lab(0.5, '② 跃出大气层', 1090, 400);
      lab(0.72, '③ 第二次再入', 1500, 680);
      text(ctx, '像在大气层上“打水漂”', 1090, 340, { size: 40, fam: 'SansH', align: 'center', color: C.gold, alpha: ease.out(prog(t, l3.t0 + 6.2, l3.t0 + 7.0)), shadow: 10 });
      text(ctx, '半弹道跳跃式再入', 960, 230, { size: 50, fam: 'SansH', align: 'center', color: '#fff', alpha: ease.out(prog(t, l3.t0, l3.t0 + 0.8)) });
      ctx.restore();
    }
    // Part C: landing in Siziwang Banner
    if (aC > 0) {
      ctx.save(); ctx.globalAlpha = aC;
      snowField(ctx, t);
      const dp = ease.out(prog(t, l4.t0 + 0.2, l4.t0 + 5.0)); const y = lerp(-60, 772, dp); const x = 1000 + Math.sin(t * 0.8) * 10 * (1 - dp);
      const open = ease.out(prog(t, l4.t0 + 0.4, l4.t0 + 1.4)) * (1 - prog(t, l4.t0 + 5.3, l4.t0 + 6.5));
      if (open > 0.02) A.parachute(ctx, x, y - 34, 42, open, Math.sin(t) * 0.04);
      A.ce5Returner(ctx, x, y, 40);
      if (dp >= 1) A.dustBurst(ctx, x, 785, t, { power: 0.5 * (1 - prog(t, l4.t0 + 5, l4.t0 + 7)), n: 16, color: '230,240,255' });
      U.badge(ctx, 960, 300, '任务圆满成功', prog(t, l4.t0 + 5.4, l4.t0 + 6.2), { size: 56, sub: '2020.12.17 · 内蒙古四子王旗' });
      ctx.restore();
    }
    U.ce5Header(ctx, t, 7, S);
  },
  cues: (S) => [[L(S, 1).t0 - 0.2, 'burn', 1.6], [L(S, 1).t1 - 0.6, 'clunk'], [L(S, 3).t0 + 1.2, 'reentry', 6], [L(S, 4).t0 + 0.4, 'whoosh_s'], [L(S, 4).t0 + 5.4, 'chime']],
};

module.exports = { S1, chapterCard, limb, catmull, dashed, trail, flash, shake, crossMark, checkMark, orbRet, landAsc, snowField };
