// Scenes: chapter 2 (crewed landing), hardware, milestones, 9-step crewed flight plan, future, ending.
const { W, H, clamp, lerp, prog, ease, bezPts, polyAt, C, text, textReveal, panel, glowDot, arrowHead, callout, rr, flagCN } = require('./lib/core');
const { drawPlanet, atmosphereGlow } = require('./lib/planet');
const A = require('./lib/art');
const U = require('./lib/ui');
const { S1, chapterCard, limb, dashed, trail, flash, shake, catmull } = require('./scenes1');
const { L } = U;

const S2 = {};
const crewHeader = (ctx, t, i) => { U.stepTitle(ctx, t, i + 1, U.CREW_STEPS[i]); U.miniMap(ctx, t, i); };

// ----- helpers -----
function propModule(ctx, x, y, s, rot = 0, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(rot);
  const g = ctx.createLinearGradient(-1 * s, 0, 1 * s, 0); g.addColorStop(0, '#7c8595'); g.addColorStop(0.45, '#eef1f6'); g.addColorStop(1, '#727b8b');
  ctx.fillStyle = g; rr(ctx, -1.05 * s, -0.75 * s, 2.1 * s, 1.5 * s, 0.25 * s); ctx.fill();
  A.nozzle(ctx, 0, 0.75 * s, 0.9 * s, 0.7 * s); ctx.restore();
}
function serviceModule(ctx, x, y, s, rot = 0, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(rot);
  A.solarPanel(ctx, -0.9 * s, -2.9 * s, 1.2 * s, 1.9 * s, 3); A.solarPanel(ctx, -0.9 * s, 1.0 * s, 1.2 * s, 1.9 * s, 3);
  const g = ctx.createLinearGradient(0, -1 * s, 0, 1 * s); g.addColorStop(0, '#8c95a5'); g.addColorStop(0.4, '#f2f4f8'); g.addColorStop(1, '#7f8898');
  ctx.fillStyle = g; ctx.fillRect(-1.15 * s, -1.05 * s, 2.3 * s, 2.1 * s);
  ctx.save(); ctx.translate(-1.15 * s, 0); ctx.rotate(Math.PI / 2); A.nozzle(ctx, 0, 0, 0.9 * s, 0.8 * s); ctx.restore();
  ctx.restore();
}
// Lanyue drawn around its body centre, rot -PI/2 => docking port facing left
function lanyueAt(ctx, x, y, s, rot, opts = {}) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); A.lanyue(ctx, 0, 2.2 * s, s, opts); ctx.restore(); }
function crewLaunch(ctx, t, { payload, tod, ign = 1.2, label, sub }) {
  const lift = ign + 1.4; const dt = Math.max(0, t - lift);
  const rise = 0.5 * 80 * dt * dt + 12 * dt; const camY = Math.max(0, rise - 240);
  ctx.save(); shake(ctx, t, 7 * prog(t, ign, ign + 0.6) * (1 - prog(t, lift + 2, lift + 4)));
  const fl = ease.out(prog(t, ign, ign + 0.8));
  A.launchSite(ctx, t, { tod, camY, glow: fl * 0.7 * (1 - prog(camY, 0, 900)) });
  A.launchTower(ctx, 790, 840 + camY, 640, 44);
  A.launchSmoke(ctx, t - ign, 960, 840 + camY, { n: 70, seed: payload === 'mengzhou' ? 7 : 5, tint: tod === 'day' ? [240, 240, 244] : [215, 210, 220] });
  A.cz10(ctx, 960, 840 + camY - rise, 6.2, { payload, flame: fl, t });
  ctx.restore();
  const ip = ease.out(prog(t, 0.6, 1.4));
  if (ip > 0) { ctx.save(); ctx.globalAlpha = ip; panel(ctx, 70, 330, 470, 140, { accent: payload === 'mengzhou' ? C.cyan : C.gold }); text(ctx, label, 100, 385, { size: 34, fam: 'SansH' }); text(ctx, sub, 100, 432, { size: 26, fam: 'Sans', color: C.dim }); ctx.restore(); }
}
// Earth -> lunar orbit transfer map
function transferMap(ctx, t, { u, color, label, icon, waiting = false, orbitStart = 0 }) {
  A.space(ctx, t, { seed: 51, ox: -t * 5 });
  drawPlanet(ctx, 330, 790, 270, { kind: 'earth', lat: 18, lon: Math.round((110 + t * 1.5) * 4) / 4, light: [0.6, 0.5, 0.62], cloudLon: Math.round(t * 4) / 4 }); atmosphereGlow(ctx, 330, 790, 270);
  const mx = 1560, my = 400, mr = 100, R = 165;
  drawPlanet(ctx, mx, my, mr, { kind: 'moon', lat: 0, lon: 0, light: [-0.6, 0.25, 0.76] });
  ctx.save(); ctx.setLineDash([8, 10]); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, R, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  const path = bezPts([560, 640], [860, 380], [1200, 330], [mx - R, my], 120);
  dashed(ctx, path, 'rgba(255,255,255,0.28)', 2);
  const fu = clamp(u / 0.8); trail(ctx, path, fu, color, 4);
  let px, py, a;
  if (u <= 0.8) { const q = polyAt(path, fu); px = q.x; py = q.y; a = q.a; }
  else { const ph = Math.PI - (u - 0.8) / 0.2 * 2.4; px = mx + R * Math.cos(ph); py = my + R * Math.sin(ph); a = ph - Math.PI / 2; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(mx, my, R, ph, Math.PI); ctx.stroke(); ctx.restore(); }
  const burn = prog(u, 0.76, 0.79) * (1 - prog(u, 0.84, 0.88));
  if (burn > 0) A.jet(ctx, px + Math.cos(a) * 14, py + Math.sin(a) * 14, a, 60, 14, t, { intensity: burn });
  if (burn > 0) text(ctx, '近月制动', mx - R - 30, my + 60, { size: 30, fam: 'SansB', align: 'right', color: C.orange, alpha: burn });
  if (waiting) { const ph = orbitStart + t * 0.5; glowDot(ctx, mx + R * Math.cos(ph), my + R * Math.sin(ph), 6, C.gold, 1); text(ctx, '揽月', mx + R * Math.cos(ph) + 18, my + R * Math.sin(ph) - 12, { size: 24, fam: 'SansB', color: C.gold }); }
  icon(ctx, px, py, a);
  text(ctx, label, 900, 330, { size: 32, fam: 'SansB', color, alpha: ease.out(prog(u, 0.02, 0.12)) });
  if (u > 0.85) text(ctx, '进入环月轨道', mx, my + R + 60, { size: 30, fam: 'SansB', align: 'center', color: '#fff', alpha: prog(u, 0.85, 0.92) });
  text(ctx, '地球', 330, 480, { size: 30, fam: 'SansB', align: 'center', color: C.dim }); text(ctx, '月球', mx, my - mr - 26, { size: 30, fam: 'SansB', align: 'center', color: C.dim });
}
function orbitBackdrop(ctx, t, seed = 61) { A.space(ctx, t, { seed, ox: t * 7 }); limb(ctx); }
function earthLimb(ctx, t) {
  const ecx = 960, ecy = 2700, R = 2050, atm = 150;
  const ag = ctx.createRadialGradient(ecx, ecy, R, ecx, ecy, R + atm); ag.addColorStop(0, 'rgba(110,180,255,0.55)'); ag.addColorStop(1, 'rgba(110,180,255,0)');
  ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(ecx, ecy, R + atm, 0, Math.PI * 2); ctx.fill();
  const eg = ctx.createLinearGradient(0, 640, 0, H); eg.addColorStop(0, '#2f6fb3'); eg.addColorStop(1, '#0b2a55'); ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ecx, ecy, R, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(ecx, ecy, R, 0, Math.PI * 2); ctx.clip(); for (let k = 0; k < 18; k++) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse((k * 211 + t * 8) % (W + 300) - 150, 690 + (k % 4) * 40, 120 + (k % 3) * 60, 10, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
}
function desert(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, 800); g.addColorStop(0, '#3d7fc6'); g.addColorStop(1, '#cfe3f2'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#b79a72'; ctx.beginPath(); ctx.moveTo(0, 800); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 790 - 30 * Math.sin(x * 0.003 + 1) - 10 * Math.sin(x * 0.011)); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  const sg = ctx.createLinearGradient(0, 800, 0, H); sg.addColorStop(0, '#d8b98c'); sg.addColorStop(1, '#a88a62'); ctx.fillStyle = sg; ctx.fillRect(0, 812, W, H);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(((i * 520 + t * 12) % (W + 400)) - 200, 160 + i * 50, 140, 26, 0, 0, Math.PI * 2); ctx.fill(); }
}

// =========================== CHAPTER 2 ===========================
S2.chapter2 = {
  draw(ctx, t, S) {
    chapterCard(ctx, t, S, { num: '第二篇', title: '载人登月', sub: '2030 年前 · 实现中国人首次登陆月球', seed: 52, tint: '95,211,255' });
  },
  cues: () => [[0.5, 'boom']],
};

// =========================== HARDWARE ===========================
function cardWin(t, S, k) { const a = L(S, k + 1).t0 - 0.5, b = k < 3 ? L(S, k + 2).t0 - 0.5 : S.dur + 5; return { inP: ease.inOut(prog(t, a, a + 0.8)), outP: ease.inOut(prog(t, b, b + 0.8)) }; }
function specList(ctx, x, y, lines, p) { lines.forEach((l, i) => { const a = ease.out(prog(p, 0.25 + i * 0.12, 0.55 + i * 0.12)); ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(x + 8, y + i * 62 - 10, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); text(ctx, l, x + 30, y + i * 62, { size: 34, fam: 'Sans', color: '#fff', alpha: a }); }); }
S2.hardware = {
  draw(ctx, t, S) {
    A.space(ctx, t, { seed: 53, ox: -t * 5 });
    U.chapterTag(ctx, '第二篇 · 载人登月', 1);
    // intro row
    const introOut = ease.inOut(prog(t, L(S, 1).t0 - 0.6, L(S, 1).t0 + 0.2));
    if (introOut < 1) {
      ctx.save(); ctx.globalAlpha = 1 - introOut;
      textReveal(ctx, '全新装备', 960, 330, prog(t, 0.6, 1.6), { size: 86, fam: 'SerifH', align: 'center', spacing: 18 });
      ['长征十号', '梦舟', '揽月', '望宇', '探索'].forEach((n, i) => { const p = ease.outBack(prog(t, 1.4 + i * 0.35, 2.0 + i * 0.35)); if (p <= 0) return; const x = 400 + i * 280; ctx.save(); ctx.globalAlpha *= clamp(p); ctx.translate(x, 560); ctx.scale(p, p); panel(ctx, -115, -60, 230, 120, { r: 60, fill: 'rgba(16,28,60,0.85)', line: i < 3 ? C.gold : C.cyan }); text(ctx, n, 0, 14, { size: 40, fam: 'SansH', align: 'center' }); ctx.restore(); });
      text(ctx, ['运载火箭', '载人飞船', '着陆器', '登月服', '月球车'].join('    ·    '), 960, 690, { size: 28, fam: 'Sans', align: 'center', color: C.dim, alpha: ease.out(prog(t, 3.0, 3.8)) });
      ctx.restore();
    }
    const cards = [
      (c, p) => { // rocket
        const s = 6.4, base = 940;
        const sg = c.createRadialGradient(560, base, 0, 560, base, 500); sg.addColorStop(0, 'rgba(120,170,255,0.18)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(0, 400, 1100, 600);
        A.cz10(c, 520, base, s, { payload: 'mengzhou' }); A.cz5(c, 820, base, s);
        c.strokeStyle = C.gold; c.lineWidth = 2; c.beginPath(); c.moveTo(330, base); c.lineTo(330, base - 92.5 * s); c.stroke(); arrowHead(c, 330, base - 92.5 * s, -Math.PI / 2, 12, C.gold); arrowHead(c, 330, base, Math.PI / 2, 12, C.gold);
        text(c, '约 92.5 米', 310, base - 46 * s, { size: 32, fam: 'SansH', align: 'right', color: C.gold });
        text(c, '长征五号（约 57 米）', 820, base - 57 * s - 30, { size: 22, fam: 'Sans', align: 'center', color: C.dim });
        text(c, '长征十号运载火箭', 1060, 330, { size: 70, fam: 'SansH' }); text(c, 'LONG MARCH 10', 1064, 380, { size: 26, fam: 'Sans', spacing: 6, color: C.dim });
        specList(c, 1070, 480, ['三级半构型 · 芯级直径 5 米', '起飞质量约 2189 吨', '地月转移轨道运载能力 ≥ 27 吨', '两枚火箭分别发射揽月与梦舟'], p);
      },
      (c, p) => { // Mengzhou
        const sg = c.createRadialGradient(560, 560, 0, 560, 560, 460); sg.addColorStop(0, 'rgba(120,170,255,0.2)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(0, 100, 1100, 900);
        A.mengzhou(c, 600, 560, 72, -0.15 + Math.sin(t * 0.5) * 0.03);
        callout(c, 650, 560, 800, 800, '返回舱', '载航天员往返', clamp(p * 2 - 0.4), { color: C.cyan, size: 30 });
        callout(c, 470, 600, 260, 830, '服务舱', '提供动力与能源', clamp(p * 2 - 0.6), { color: C.gold, align: 'right', size: 30 });
        text(c, '梦舟载人飞船', 1060, 330, { size: 70, fam: 'SansH' }); text(c, 'MENGZHOU', 1064, 380, { size: 26, fam: 'Sans', spacing: 6, color: C.dim });
        specList(c, 1070, 480, ['由返回舱和服务舱组成', '把航天员送往环月轨道', '再把航天员安全带回地球', '返回舱用气囊缓冲着陆'], p);
      },
      (c, p) => { // Lanyue
        const sg = c.createRadialGradient(560, 560, 0, 560, 560, 460); sg.addColorStop(0, 'rgba(245,198,107,0.18)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(0, 100, 1100, 900);
        A.lanyue(c, 580, 820, 95, { prop: 1, legs: 1 });
        callout(c, 680, 820 - 2.6 * 95, 860, 230, '登月舱', '载 2 名航天员着陆与起飞', clamp(p * 2 - 0.4), { color: C.gold, size: 30 });
        callout(c, 520, 820 - 0.9 * 95, 230, 880, '推进舱', '负责主要的制动减速', clamp(p * 2 - 0.6), { color: C.cyan, align: 'right', size: 30 });
        text(c, '揽月着陆器', 1060, 330, { size: 70, fam: 'SansH' }); text(c, 'LANYUE', 1064, 380, { size: 26, fam: 'Sans', spacing: 6, color: C.dim });
        specList(c, 1070, 480, ['由登月舱和推进舱组成', '往返于环月轨道和月面', '可搭载两名航天员', '可携带月球车与科学载荷'], p);
      },
      (c, p) => { // suit + rover
        const sg = c.createRadialGradient(560, 760, 0, 560, 760, 520); sg.addColorStop(0, 'rgba(255,255,255,0.14)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(0, 200, 1100, 800);
        A.astronaut(c, 330, 850, 220, { phase: 0, walk: 0, face: 1, arm: 0.2 });
        A.rover(c, 800, 850, 92, t * 0.5, { driver: false });
        text(c, '望宇', 330, 905, { size: 34, fam: 'SansH', align: 'center', color: C.gold }); text(c, '探索', 800, 905, { size: 34, fam: 'SansH', align: 'center', color: C.cyan });
        text(c, '登月服与月球车', 1060, 330, { size: 70, fam: 'SansH' }); text(c, 'WANGYU · TANSUO', 1064, 380, { size: 26, fam: 'Sans', spacing: 6, color: C.dim });
        specList(c, 1070, 480, ['“望宇”登月服：月面行走与作业', '“探索”载人月球车：扩大考察范围', '支持航天员开展科学考察', '采集并带回月球样品'], p);
      },
    ];
    cards.forEach((fn, k) => {
      const { inP, outP } = cardWin(t, S, k); if (inP <= 0 || outP >= 1) return;
      ctx.save(); ctx.globalAlpha = inP * (1 - outP); ctx.translate((1 - inP) * 220 - outP * 220, 0); fn(ctx, inP); ctx.restore();
    });
    A.vignette(ctx, 0.4);
  },
  cues: (S) => [1, 2, 3, 4].map((k) => [L(S, k).t0 - 0.5, 'whoosh_s']),
};

// =========================== MILESTONES ===========================
const MS = [
  ['2023.07', '公布载人登月', '初步方案'], ['2024.02', '命名“梦舟”', '“揽月”'], ['2024.09', '发布“望宇”', '登月服'],
  ['2025.06', '梦舟零高度', '逃逸飞行试验'], ['2025.08', '揽月着陆起飞', '综合验证试验'], ['2025.08', '长征十号', '系留点火试验'],
  ['2026.02', '低空演示验证 +', '最大动压逃逸试验'], ['2030 年前', '中国人', '登陆月球'],
];
S2.progress = {
  draw(ctx, t, S) {
    A.space(ctx, t, { seed: 54, ox: t * 4 });
    U.chapterTag(ctx, '第二篇 · 载人登月', 1);
    textReveal(ctx, '关键试验 · 稳步推进', 960, 200, prog(t, 0.4, 1.4), { size: 64, fam: 'SansH', align: 'center', spacing: 6 });
    const l0 = L(S, 0), l1 = L(S, 1), l2 = L(S, 2);
    const times = [l0.t0 + 0.3, l0.t0 + 1.0, l0.t0 + 1.7, l1.t0 + 2.0, l1.t0 + 4.6, l1.t0 + 7.2, l2.t0 + 1.0, l2.t1 - 1.2];
    const ty = 560;
    const last = times.reduce((n, tt, i) => (t >= tt ? i : n), -1);
    const fx = last < 0 ? 150 : 150 + last * 232 + 232 * ease.inOut(clamp((t - times[Math.min(7, last)]) / 0.8)) * 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(110, ty); ctx.lineTo(1810, ty); ctx.stroke();
    if (last >= 0) { ctx.strokeStyle = C.gold; ctx.beginPath(); ctx.moveTo(110, ty); ctx.lineTo(fx, ty); ctx.stroke(); }
    MS.forEach(([d, a, b], i) => {
      const p = ease.outBack(prog(t, times[i], times[i] + 0.7)); if (p <= 0) return;
      const x = 150 + i * 232, up = i % 2 === 0, goal = i === 7;
      ctx.save(); ctx.globalAlpha = clamp(p);
      ctx.beginPath(); ctx.arc(x, ty, goal ? 18 : 12, 0, Math.PI * 2); ctx.fillStyle = goal ? C.red2 : C.gold; ctx.fill(); if (goal) { ctx.shadowColor = C.red2; ctx.shadowBlur = 30; ctx.fill(); ctx.shadowBlur = 0; }
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, up ? ty - 16 : ty + 16); ctx.lineTo(x, up ? ty - 60 : ty + 60); ctx.stroke();
      const cy = up ? ty - 60 - 150 : ty + 60; ctx.translate(0, (1 - p) * (up ? 30 : -30));
      panel(ctx, x - 108, cy, 216, 150, { fill: goal ? 'rgba(60,14,10,0.8)' : 'rgba(14,24,52,0.82)', line: goal ? C.red2 : C.panelLine });
      text(ctx, d, x, cy + 44, { size: 30, fam: 'SansH', align: 'center', color: goal ? C.red2 : C.gold2 });
      text(ctx, a, x, cy + 88, { size: 24, fam: 'SansB', align: 'center' }); text(ctx, b, x, cy + 124, { size: 22, fam: 'Sans', align: 'center', color: C.dim });
      if (!goal && t > times[i] + 0.5) { ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(x + 88, cy + 20, 14, 0, Math.PI * 2); ctx.fill(); text(ctx, '✓', x + 88, cy + 28, { size: 20, fam: 'SansH', align: 'center', color: '#06210f' }); }
      ctx.restore();
    });
    A.vignette(ctx, 0.4);
  },
  cues: (S) => [L(S, 0).t0 + 0.3, L(S, 0).t0 + 1.0, L(S, 0).t0 + 1.7, L(S, 1).t0 + 2.0, L(S, 1).t0 + 4.6, L(S, 1).t0 + 7.2, L(S, 2).t0 + 1.0, L(S, 2).t1 - 1.2].map((x) => [x, 'tick']),
};

// =========================== CREW MAP ===========================
function legend(ctx, a) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha = a;
  [[C.gold, '揽月着陆器'], [C.cyan, '梦舟飞船（乘组）'], ['#e9eefc', '返回地球']].forEach(([c, s], i) => { const x = 70, y = 250 + i * 46; ctx.strokeStyle = c; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 50, y); ctx.stroke(); text(ctx, s, x + 64, y + 9, { size: 26, fam: 'Sans', color: '#fff' }); });
  ctx.restore();
}
S2.crewmap = {
  draw(ctx, t, S) {
    A.space(ctx, t, { seed: 55, ox: -t * 4 });
    textReveal(ctx, '载人登月飞行方案（示意）', 960, 150, prog(t, 0.4, 1.4), { size: 56, fam: 'SansH', align: 'center', spacing: 4 });
    legend(ctx, ease.out(prog(t, 1.2, 2.0)));
    const rv = 9 * ease.inOut(prog(t, L(S, 1).t0 - 0.6, L(S, 1).t1 + 0.6));
    U.crewMap(ctx, t, { reveal: rv });
  },
  cues: (S) => [[L(S, 1).t0 - 0.4, 'sweep', 4.5]],
};

// =========================== CREW STEPS ===========================
const lyIcon = (ctx, x, y, a) => { ctx.save(); ctx.translate(x, y); ctx.scale(0.42, 0.42); A.lanyue(ctx, 0, 2.2 * 30, 30, { prop: 1 }); ctx.restore(); glowDot(ctx, x, y, 4, C.gold, 0.7); };
const mzIcon = (ctx, x, y, a) => { ctx.save(); ctx.translate(x, y); ctx.scale(0.5, 0.5); A.mengzhou(ctx, 0, 0, 22, a); ctx.restore(); glowDot(ctx, x, y, 4, C.cyan, 0.7); };

S2.crew1 = {
  draw(ctx, t, S) {
    const sw = L(S, 2).t0 - 0.2; const aB = ease.inOut(prog(t, sw - 0.4, sw + 0.5));
    if (aB < 1) crewLaunch(ctx, t, { payload: 'lanyue', tod: 'day', label: '长征十号 · 第一枚', sub: '搭载：揽月着陆器' });
    if (aB > 0) { ctx.save(); ctx.globalAlpha = aB; transferMap(ctx, t, { u: ease.inOut(prog(t, sw, S.dur - 0.3)), color: C.gold, label: '揽月 · 地月转移', icon: lyIcon }); ctx.restore(); }
    crewHeader(ctx, t, 0);
  },
  cues: (S) => [[1.2, 'launch', 8], [L(S, 2).t0 - 0.4, 'whoosh']],
};
S2.crew2 = {
  draw(ctx, t, S) {
    const sw = L(S, 2).t0 - 0.2; const aB = ease.inOut(prog(t, sw - 0.4, sw + 0.5));
    if (aB < 1) crewLaunch(ctx, t, { payload: 'mengzhou', tod: 'dusk', ign: 1.6, label: '长征十号 · 第二枚', sub: '搭载：梦舟飞船与航天员' });
    if (aB > 0) { ctx.save(); ctx.globalAlpha = aB; transferMap(ctx, t, { u: ease.inOut(prog(t, sw, S.dur - 0.3)), color: C.cyan, label: '梦舟 · 地月转移', icon: mzIcon, waiting: true, orbitStart: 1.2 }); ctx.restore(); }
    crewHeader(ctx, t, 1);
  },
  cues: (S) => [[1.6, 'launch', 8], [L(S, 2).t0 - 0.4, 'whoosh']],
};
S2.crew3 = {
  draw(ctx, t, S) {
    orbitBackdrop(ctx, t);
    const l1 = L(S, 1), l2 = L(S, 2);
    const ls = 40, ms = 34, lx = 1260, ly = 470 + Math.sin(t * 0.7) * 4;
    const portX = lx - 1.37 * ls; const dockX = portX - 1.45 * ms;
    const contact = l1.t1 - 0.2; const ap = ease.out(prog(t, 0.3, contact));
    const mx = lerp(280, dockX, ap), my = lerp(560, ly, ap);
    lanyueAt(ctx, lx, ly, ls, -Math.PI / 2, { prop: 1 });
    A.mengzhou(ctx, mx, my, ms, 0);
    if (ap < 1 && (t * 2) % 1 < 0.3) A.jet(ctx, mx + 0.6 * ms, my - 1.2 * ms, -Math.PI / 2, 20, 8, t, { intensity: 0.6, color: 'blue' });
    flash(ctx, portX, ly, 120, 0.8 * (1 - prog(t, contact, contact + 0.6)) * prog(t, contact - 0.1, contact));
    text(ctx, '梦舟', mx - 40, my + 140, { size: 30, fam: 'SansB', align: 'center', color: C.cyan, alpha: 1 - prog(t, l2.t0, l2.t0 + 0.5) });
    text(ctx, '揽月', lx, ly + 170, { size: 30, fam: 'SansB', align: 'center', color: C.gold, alpha: 1 - prog(t, l2.t0, l2.t0 + 0.5) });
    U.badge(ctx, 960, 780, '环月轨道交会对接', prog(t, contact, contact + 0.7) * (1 - prog(t, l2.t0 + 0.2, l2.t0 + 0.8)), { size: 44, color: C.cyan });
    const tr = prog(t, l2.t0 + 0.2, l2.t1 + 0.2);
    if (tr > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, tr * 4) * 0.85; panel(ctx, dockX - 40, ly - 46, lx - dockX + 120, 92, { fill: 'rgba(255,220,150,0.12)', line: C.gold, r: 46 }); ctx.restore();
      for (let k = 0; k < 2; k++) { const f = ease.inOut(prog(tr, k * 0.25, 0.65 + k * 0.25)); if (f <= 0) continue; A.astronaut(ctx, lerp(dockX + 10, lx + 30, f), ly + 30, 30, { phase: f * 3, walk: 0.6, face: 1 }); }
      text(ctx, '两名航天员进入揽月', 960, 760, { size: 38, fam: 'SansH', align: 'center', color: C.gold, alpha: ease.out(prog(tr, 0.1, 0.3)), shadow: 10 });
    }
    crewHeader(ctx, t, 2);
    A.vignette(ctx, 0.35);
  },
  cues: (S) => [[L(S, 1).t1 - 0.2, 'clunk'], [L(S, 2).t0 + 0.4, 'servo', 2]],
};
const CDES = (() => catmull([[260, 230], [700, 360], [1000, 520], [1220, 680], [1370, 760], [1420, 800]], 24))();
S2.crew4 = {
  draw(ctx, t, S) {
    const l1 = L(S, 1), l2 = L(S, 2), l3 = L(S, 3);
    const sw = l2.t0 - 0.2; const aB = ease.inOut(prog(t, sw - 0.4, sw + 0.4));
    if (aB < 1) {
      ctx.save(); orbitBackdrop(ctx, t);
      const ls = 40, ms = 34, lx0 = 1260, ly0 = 470; const portX = lx0 - 1.37 * ls, dockX = portX - 1.45 * ms;
      const d = ease.inOut(prog(t, l1.t0, l1.t1));
      A.mengzhou(ctx, dockX - 120 * d, ly0 - 80 * d, ms, 0);
      lanyueAt(ctx, lx0 + 60 * d, ly0 + 180 * d, ls, lerp(-Math.PI / 2, -0.35, d), { prop: 1, engine: prog(d, 0.5, 0.6) * 0.8, t });
      text(ctx, '分离 · 降低轨道', 960, 820, { size: 38, fam: 'SansH', align: 'center', color: C.gold, alpha: ease.out(prog(t, l1.t0 + 0.6, l1.t0 + 1.4)) });
      ctx.restore();
    }
    if (aB > 0) {
      ctx.save(); ctx.globalAlpha = aB;
      A.lunarScene(ctx, t, { hy: 830, seed: 23, starsAlpha: 0.9 });
      const sepT = l2.t0 + 2.8;
      const u = ease.inOut(prog(t, sw, l3.t1 - 0.6)); const q = polyAt(CDES, u);
      const tilt = lerp(-0.7, 0, ease.inOut(prog(u, 0.3, 0.85)));
      const s = 28;
      const hasProp = t < sepT;
      if (!hasProp) { // falling propulsion module
        const fd = t - sepT; const q0 = polyAt(CDES, ease.inOut(prog(sepT, sw, l3.t1 - 0.6)));
        propModule(ctx, q0.x + fd * 60, q0.y + 1.0 * s + 0.5 * 30 * fd * fd, s, fd * 0.9, 1 - prog(fd, 2.5, 3.5));
        if (fd < 0.6) flash(ctx, q0.x, q0.y + s, 80, 0.7 * (1 - fd / 0.6));
      }
      const landed = u >= 0.999;
      lanyueAt(ctx, q.x, q.y, s, tilt, { prop: hasProp ? 1 : 0, engine: landed ? 0 : (hasProp ? 1 : 0.7) * prog(t, sw, sw + 0.4), legs: 1, t });
      if (u > 0.8) A.dustBurst(ctx, q.x, 830 + 0, t, { power: (landed ? 1 - prog(t, l3.t1 - 0.6, l3.t1 + 0.8) : prog(u, 0.8, 0.97)) * 0.7, n: 24, seed: 12 });
      callout(ctx, q.x - 30, q.y + 30, 640, 700, '推进舱：主要制动减速', '完成任务后与登月舱分离', prog(t, l2.t0 + 0.6, l2.t0 + 1.4) * (1 - prog(t, l3.t0 + 0.4, l3.t0 + 1)), { color: C.cyan, align: 'right', size: 32 });
      callout(ctx, q.x + 30, q.y - 40, 1560, 420, '登月舱继续下降', '避障 · 稳稳落月', prog(t, l3.t0 + 0.2, l3.t0 + 1.0), { color: C.gold, size: 32 });
      ctx.restore();
    }
    crewHeader(ctx, t, 3);
    A.vignette(ctx, 0.35);
  },
  cues: (S) => [[L(S, 1).t0 + 0.2, 'clunk'], [L(S, 2).t0 - 0.2, 'burn', L(S, 3).t1 - L(S, 2).t0 - 0.4], [L(S, 2).t0 + 2.8, 'clunk'], [L(S, 3).t1 - 0.6, 'thud']],
};
S2.crew5 = {
  draw(ctx, t, S) {
    const l1 = L(S, 1), l2 = L(S, 2);
    const earth = (c) => { drawPlanet(c, 1180, 200, 70, { kind: 'earth', lat: 15, lon: 105, light: [0.8, 0.3, 0.52] }); atmosphereGlow(c, 1180, 200, 70, { strength: 0.7 }); };
    A.lunarScene(ctx, t, { hy: 640, seed: 21, earth });
    const gy = 840, lx = 1280, s = 52;
    const hatch = ease.inOut(prog(t, 0.4, 1.4)), ladder = ease.inOut(prog(t, 0.8, 1.8));
    // footprints
    const wp = ease.inOut(prog(t, l1.t0 + 1.2, l1.t1 + 0.2)); const ax = lerp(lx - 1.1 * s, 760, wp);
    for (let k = 0; k < 14; k++) { const fx = lx - 1.3 * s - k * 34; if (fx < ax + 20) continue; ctx.fillStyle = 'rgba(40,38,36,0.6)'; ctx.beginPath(); ctx.ellipse(fx, gy + 4 + (k % 2) * 10, 12, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    A.lanyue(ctx, lx, gy, s, { prop: 0, hatch, ladder, legs: 1 });
    // rover
    const rp = ease.out(prog(t, l2.t0 - 0.2, l2.t0 + 3.4)); const rx = lerp(2150, 1650, rp);
    if (rp > 0) A.rover(ctx, rx, gy + 30, 50, t * 2 * (1 - rp) + rp * 3, { driver: true, dust: 1 - rp });
    if (t > l1.t0 + 1.0) { const appear = ease.out(prog(t, l1.t0 + 1.0, l1.t0 + 1.6)); ctx.save(); ctx.globalAlpha = appear; A.astronaut(ctx, ax, gy + 10, 62, { phase: t * 0.9, walk: wp < 1 ? 1 : 0, face: -1, arm: t > l2.t0 + 1.5 ? 0.9 : 0 }); ctx.restore(); }
    if (t > l2.t0 + 1.5) { ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ax - 36, gy - 50); ctx.lineTo(ax - 70, gy + 8); ctx.stroke(); }
    // footprint inset
    const fi = ease.out(prog(t, l1.t0 + 3.2, l1.t0 + 4.0)) * (1 - prog(t, l2.t0 + 0.5, l2.t0 + 1.2));
    if (fi > 0) {
      ctx.save(); ctx.globalAlpha = fi; panel(ctx, 140, 300, 420, 300, { fill: 'rgba(40,40,40,0.9)', line: C.gold, glow: 20 });
      ctx.beginPath(); rr(ctx, 150, 310, 400, 280, 14); ctx.clip();
      const g = ctx.createLinearGradient(0, 310, 0, 590); g.addColorStop(0, '#8b8880'); g.addColorStop(1, '#6d6a64'); ctx.fillStyle = g; ctx.fillRect(150, 310, 400, 280);
      ctx.save(); ctx.translate(350, 450); ctx.rotate(-0.3); ctx.fillStyle = 'rgba(30,28,26,0.55)'; rr(ctx, -55, -120, 110, 240, 50); ctx.fill();
      ctx.strokeStyle = 'rgba(200,196,188,0.35)'; ctx.lineWidth = 6; for (let k = -100; k < 110; k += 22) { ctx.beginPath(); ctx.moveTo(-45, k); ctx.lineTo(45, k + 6); ctx.stroke(); } ctx.restore();
      ctx.restore(); text(ctx, '中国人的足迹', 350, 640, { size: 34, fam: 'SansH', align: 'center', color: C.gold, alpha: fi });
    }
    callout(ctx, ax, gy - 120, 640, 400, '“望宇”登月服', '月面行走与作业', prog(t, l1.t0 + 1.8, l1.t0 + 2.6) * (1 - prog(t, l1.t0 + 3.0, l1.t0 + 3.5)), { color: C.gold, align: 'right', size: 30 });
    callout(ctx, rx, gy - 60, 1560, 470, '“探索”载人月球车', '扩大考察范围', prog(t, l2.t0 + 2.0, l2.t0 + 2.8), { color: C.cyan, align: 'right', size: 30 });
    callout(ctx, ax - 70, gy + 8, 500, 470, '科学考察 · 采集样品', '', prog(t, l2.t0 + 2.6, l2.t0 + 3.4), { color: C.gold, align: 'right', size: 30 });
    crewHeader(ctx, t, 4);
    A.vignette(ctx, 0.35);
  },
  cues: (S) => [[0.4, 'servo', 1.4], [L(S, 2).t0, 'rover', 3.4]],
};
S2.crew6 = {
  draw(ctx, t, S) {
    const l1 = L(S, 1);
    const ign = l1.t0 + 2.4, lift = ign + 0.7; const dt = Math.max(0, t - lift);
    const rise = 0.5 * 110 * dt * dt + 20 * dt; const camY = Math.max(0, rise - 300);
    ctx.save(); shake(ctx, t, 5 * prog(t, ign, ign + 0.3) * (1 - prog(t, lift + 1, lift + 2.5))); ctx.translate(0, camY * 0.5);
    const earth = (c) => { drawPlanet(c, 1180, 200, 70, { kind: 'earth', lat: 15, lon: 105, light: [0.8, 0.3, 0.52] }); atmosphereGlow(c, 1180, 200, 70, { strength: 0.7 }); };
    A.lunarScene(ctx, t, { hy: 640, seed: 21, earth });
    const gy = 840, s = 52;
    for (let k = 0; k < 14; k++) { const fx = 1280 - 1.3 * s - k * 34; if (fx < 760) continue; ctx.fillStyle = 'rgba(40,38,36,0.6)'; ctx.beginPath(); ctx.ellipse(fx, gy + 4 + (k % 2) * 10, 12, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    A.rover(ctx, 1650, gy + 30, 50, 3, { driver: false });
    const fl = prog(t, ign, ign + 0.3) * (1 - prog(dt, 4, 5));
    const ladder = 1 - ease.inOut(prog(t, l1.t0 + 0.4, l1.t0 + 1.4)), hatch = 1 - ease.inOut(prog(t, l1.t0 + 1.0, l1.t0 + 1.8));
    A.lanyue(ctx, 1280, gy - rise, s, { prop: 0, hatch, ladder, engine: fl, t });
    if (t > ign) A.dustBurst(ctx, 1280, gy, t, { power: 0.8 * (1 - prog(dt, 0, 2.2)), n: 30, seed: 13 });
    ctx.restore();
    callout(ctx, 1280 - 60, gy - rise - 2.2 * s + camY * 0.5, 700, 380, '登月舱从月面起飞', '飞向环月轨道', prog(t, ign + 1.2, ign + 2.0), { color: C.gold, align: 'right', size: 32 });
    crewHeader(ctx, t, 5);
    A.vignette(ctx, 0.35);
  },
  cues: (S) => [[L(S, 1).t0 + 0.4, 'servo', 1.4], [L(S, 1).t0 + 2.4, 'launch_s', 5]],
};
S2.crew7 = {
  draw(ctx, t, S) {
    orbitBackdrop(ctx, t, 63);
    const l1 = L(S, 1);
    const ms = 34, ls = 40, mx = 640, my = 450 + Math.sin(t * 0.6) * 4;
    const dockLX = mx + 1.45 * ms + 1.37 * ls;
    const contact = l1.t0 + 2.8; const ap = ease.out(prog(t, 0.2, contact));
    const lx = lerp(1650, dockLX, ap), ly = lerp(680, my, ap);
    A.mengzhou(ctx, mx, my, ms, 0);
    lanyueAt(ctx, lx, ly, ls, lerp(-1.1, -Math.PI / 2, ap), { prop: 0 });
    if (ap < 1 && (t * 2) % 1 < 0.3) A.jet(ctx, lx + 0.5 * ls, ly + 1.0 * ls, Math.PI / 2, 20, 8, t, { intensity: 0.6, color: 'blue' });
    flash(ctx, mx + 1.45 * ms, my, 110, 0.8 * (1 - prog(t, contact, contact + 0.6)) * prog(t, contact - 0.1, contact));
    const tr = prog(t, contact + 0.6, l1.t1);
    if (tr > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, tr * 4) * 0.85; panel(ctx, mx - 20, my - 46, dockLX - mx + 80, 92, { fill: 'rgba(255,220,150,0.12)', line: C.gold, r: 46 }); ctx.restore();
      for (let k = 0; k < 2; k++) { const f = ease.inOut(prog(tr, k * 0.2, 0.6 + k * 0.2)); if (f > 0) A.astronaut(ctx, lerp(dockLX + 10, mx + 10, f), my + 30, 30, { phase: f * 3, walk: 0.6, face: -1 }); }
      const sf = ease.inOut(prog(tr, 0.45, 1)); if (sf > 0 && sf < 1) glowDot(ctx, lerp(dockLX, mx, sf), my - 20, 8, C.gold2, 1);
      text(ctx, '航天员携带月球样品回到梦舟', 960, 780, { size: 38, fam: 'SansH', align: 'center', color: C.gold, alpha: ease.out(prog(tr, 0.05, 0.25)), shadow: 10 });
    }
    crewHeader(ctx, t, 6);
    A.vignette(ctx, 0.35);
  },
  cues: (S) => [[L(S, 1).t0 + 2.8, 'clunk'], [L(S, 1).t0 + 3.6, 'servo', 2]],
};
S2.crew8 = {
  draw(ctx, t, S) {
    const l1 = L(S, 1);
    const sw = l1.t0 + 3.2; const aB = ease.inOut(prog(t, sw - 0.4, sw + 0.5));
    if (aB < 1) {
      orbitBackdrop(ctx, t, 63);
      const ms = 34, ls = 40, mx0 = 640, my = 450; const dockLX = mx0 + 1.45 * ms + 1.37 * ls;
      const d = ease.inOut(prog(t, l1.t0 - 0.6, l1.t0 + 1.6));
      lanyueAt(ctx, dockLX + 60 * d, my + 240 * d, ls, -Math.PI / 2 + 0.4 * d, { prop: 0 });
      text(ctx, '揽月留在轨道', dockLX + 60 * d + 150, my + 240 * d + 20, { size: 28, fam: 'SansB', align: 'center', color: C.gold, alpha: prog(d, 0.6, 1) });
      const burn = prog(t, l1.t0 + 1.3, l1.t0 + 1.6);
      const bx = mx0 - 40 * d + 900 * ease.in(prog(t, l1.t0 + 1.4, sw + 0.6));
      if (burn > 0) A.jet(ctx, bx - 3.0 * ms - 0.6 * ms, my, Math.PI, 110, 26, t, { intensity: burn });
      A.mengzhou(ctx, bx, my, ms, 0);
    }
    if (aB > 0) {
      ctx.save(); ctx.globalAlpha = aB;
      A.space(ctx, t, { seed: 64, ox: t * 5 });
      drawPlanet(ctx, 1620, 260, 95, { kind: 'moon', lat: 0, lon: 0, light: [-0.6, 0.2, 0.77] });
      drawPlanet(ctx, 330, 740, 250, { kind: 'earth', lat: 30, lon: Math.round((105 + t * 1.5) * 4) / 4, light: [0.55, 0.45, 0.7], cloudLon: Math.round(t * 4) / 4 }); atmosphereGlow(ctx, 330, 740, 250);
      const path = bezPts([1520, 300], [1200, 300], [760, 420], [545, 600], 120);
      dashed(ctx, path, 'rgba(255,255,255,0.3)', 2);
      const u = ease.inOut(prog(t, sw, S.dur - 0.2)) * 0.85; trail(ctx, path, u, '#e9eefc', 4); const q = polyAt(path, u);
      mzIcon(ctx, q.x, q.y, q.a);
      text(ctx, '月地转移轨道 · 踏上归途', 1060, 300, { size: 34, fam: 'SansB', color: '#e9eefc', alpha: ease.out(prog(t, sw + 0.4, sw + 1.2)) });
      ctx.restore();
    }
    crewHeader(ctx, t, 7);
    A.vignette(ctx, 0.35);
  },
  cues: (S) => [[L(S, 1).t0 - 0.6, 'clunk'], [L(S, 1).t0 + 1.3, 'burn', 2.5], [L(S, 1).t0 + 3.0, 'whoosh']],
};
S2.crew9 = {
  draw(ctx, t, S) {
    const l1 = L(S, 1), l2 = L(S, 2);
    const sw = l2.t0 - 0.2; const aB = ease.inOut(prog(t, sw - 0.4, sw + 0.4));
    if (aB < 1) {
      A.space(ctx, t, { seed: 65 }); earthLimb(ctx, t);
      const u = ease.inOut(prog(t, 0.3, sw + 0.4));
      const path = catmull([[160, 160], [520, 330], [860, 470], [1180, 590], [1500, 700]], 20); const q = polyAt(path, u);
      const sepT = l1.t0 + 1.2; const sp = ease.out(prog(t, sepT, sepT + 3));
      const s = 30;
      if (t < sepT) A.mengzhou(ctx, q.x, q.y, s, q.a);
      else {
        serviceModule(ctx, q.x - Math.cos(q.a) * (1.8 * s + 160 * sp) - 60 * sp, q.y - Math.sin(q.a) * (1.8 * s + 160 * sp) - 120 * sp, s, q.a + sp * 0.8, 1 - prog(sp, 0.7, 1));
        const rot = lerp(q.a, q.a + Math.PI, ease.inOut(prog(t, sepT + 0.6, sepT + 2.4)));
        A.plasma(ctx, q.x, q.y, q.a, 22, t, prog(t, sepT + 2.4, sepT + 3.4));
        A.mengzhou(ctx, q.x, q.y, s, rot, { service: false, solar: 0 });
      }
      flash(ctx, q.x, q.y, 90, (1 - prog(t, sepT, sepT + 0.5)) * prog(t, sepT - 0.1, sepT));
      callout(ctx, q.x - 60, q.y - 40, 520, 300, '服务舱分离', '', prog(t, sepT + 0.3, sepT + 1.0) * (1 - prog(t, sepT + 3.4, sepT + 4)), { color: C.cyan, align: 'right', size: 32 });
      text(ctx, '以接近第二宇宙速度再入大气层', 1300, 300, { size: 34, fam: 'SansB', align: 'center', color: C.orange, alpha: ease.out(prog(t, sepT + 2.6, sepT + 3.4)), shadow: 10 });
    }
    if (aB > 0) {
      ctx.save(); ctx.globalAlpha = aB; desert(ctx, t);
      const tl = l2.t0 + 4.3; const dp = ease.out(prog(t, sw, tl)); const y = lerp(-80, 760, dp); const x = 960 + Math.sin(t * 0.7) * 12 * (1 - dp);
      const open = ease.out(prog(t, sw + 0.2, sw + 1.2)) * (1 - prog(t, tl + 0.4, tl + 1.6));
      if (open > 0.02) A.parachute(ctx, x, y - 60, 50, open, Math.sin(t * 0.8) * 0.04);
      const bag = ease.outBack(prog(t, tl - 1.6, tl - 0.9)) * (1 - 0.35 * prog(t, tl, tl + 0.3));
      A.mengzhou(ctx, x, y - 40 * 0 - 46, 46, -Math.PI / 2, { service: false, solar: 0, airbag: bag });
      if (t > tl) A.dustBurst(ctx, x, 812, t, { power: 0.6 * (1 - prog(t, tl, tl + 2)), n: 20, seed: 3, color: '200,170,120' });
      callout(ctx, x - 60, y - 6, 640, 620, '气囊缓冲', '返回舱平稳着陆', prog(t, tl - 1.4, tl - 0.6), { color: C.gold, align: 'right', size: 32 });
      U.badge(ctx, 1400, 360, '欢迎回家', prog(t, tl + 0.6, tl + 1.4), { size: 52, color: C.gold });
      ctx.restore();
    }
    crewHeader(ctx, t, 8);
    A.vignette(ctx, 0.3);
  },
  cues: (S) => [[L(S, 1).t0 + 1.2, 'clunk'], [L(S, 1).t0 + 3.6, 'reentry', 5], [L(S, 2).t0 + 0.2, 'whoosh_s'], [L(S, 2).t0 + 4.3, 'thud']],
};
S2.crewrecap = {
  draw(ctx, t, S) {
    A.space(ctx, t, { seed: 55, ox: -t * 4 });
    textReveal(ctx, '载人登月 · 完整路线', 960, 150, prog(t, 0.3, 1.2), { size: 56, fam: 'SansH', align: 'center', spacing: 4 });
    U.crewMap(ctx, t, { reveal: 9, flow: t });
    const chips = ['2 次发射', '2 次环月对接', '1 次落月与起飞', '返回地球'];
    chips.forEach((c, i) => { const p = ease.outBack(prog(t, L(S, 0).t0 + 0.3 + i * 1.8, L(S, 0).t0 + 0.9 + i * 1.8)); if (p <= 0) return; const x = 210; ctx.save(); ctx.globalAlpha = clamp(p); ctx.translate(x, 215 + i * 60); ctx.scale(p, p); panel(ctx, -150, -28, 300, 56, { r: 28, fill: 'rgba(20,30,60,0.88)', line: C.gold }); text(ctx, c, 0, 10, { size: 28, fam: 'SansH', align: 'center', color: C.gold2 }); ctx.restore(); });
  },
  cues: (S) => [0, 1, 2, 3].map((i) => [L(S, 0).t0 + 0.3 + i * 1.8, 'tick']),
};

// =========================== FUTURE ===========================
S2.future = {
  draw(ctx, t, S) {
    A.space(ctx, t, { seed: 66, ox: t * 4 });
    U.chapterTag(ctx, '展望 · 探月工程四期', 1);
    const view = { kind: 'moon', lat: -62, lon: Math.round((10 + t * 0.5) * 2) / 2, light: [0.85, 0.3, 0.42] };
    const gx = 560, gy = 560, gr = 330;
    drawPlanet(ctx, gx, gy, gr, view);
    const pp = require('./lib/planet').projectLL(gx, gy, gr, view, -89.5, 0);
    const ma = ease.out(prog(t, L(S, 1).t0, L(S, 1).t0 + 0.8));
    if (ma > 0) {
      ctx.save(); ctx.globalAlpha = ma; ctx.setLineDash([6, 8]); ctx.strokeStyle = C.cyan; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(pp.x, pp.y, 120, 60, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      const pulse = 1 + 0.3 * Math.sin(t * 4); ctx.save(); ctx.globalAlpha = ma; ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pp.x, pp.y, 14 * pulse, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); glowDot(ctx, pp.x, pp.y, 6, C.cyan, ma);
      text(ctx, '月球南极', pp.x, pp.y + 104, { size: 32, fam: 'SansH', align: 'center', color: C.cyan, alpha: ma, shadow: 8 });
      for (let k = 0; k < 5; k++) { const a = t * 0.8 + k * 1.3; glowDot(ctx, pp.x + Math.cos(a) * 70, pp.y + Math.sin(a) * 30, 3, 'rgba(140,220,255,1)', ma * (0.5 + 0.5 * Math.sin(t * 3 + k))); }
    }
    textReveal(ctx, '探月工程四期', 1340, 190, prog(t, L(S, 0).t0, L(S, 0).t0 + 1.2), { size: 60, fam: 'SansH', align: 'center', spacing: 8 });
    const cards = [
      [1, '嫦娥七号', '前往月球南极', '勘察环境与资源 · 寻找水冰', C.cyan],
      [2, '嫦娥八号', '月球资源原位利用', '等关键技术验证', C.gold],
      [3, '科研站基本型', '嫦娥七号 + 嫦娥八号', '为国际月球科研站奠定基础', C.green],
    ];
    cards.forEach(([k, n, a, b, col], i) => {
      const p = ease.out(prog(t, L(S, k).t0 - 0.2, L(S, k).t0 + 0.6)); if (p <= 0) return;
      const y = 270 + i * 200; ctx.save(); ctx.globalAlpha = p; ctx.translate((1 - p) * 60, 0);
      panel(ctx, 1000, y, 820, 170, { accent: col, glow: 16 });
      text(ctx, n, 1040, y + 62, { size: 44, fam: 'SansH', color: col }); text(ctx, a, 1040, y + 112, { size: 30, fam: 'SansB' }); text(ctx, b, 1040, y + 150, { size: 26, fam: 'Sans', color: C.dim });
      ctx.restore();
    });
    A.vignette(ctx, 0.4);
  },
  cues: (S) => [1, 2, 3].map((k) => [L(S, k).t0 - 0.2, 'tick']),
};

// =========================== ENDING ===========================
S2.ending = {
  draw(ctx, t, S) {
    const l0 = L(S, 0), l1 = L(S, 1);
    const er = 170, ex = 1380, ey = lerp(780, 470, ease.out(prog(t, 0, 8)));
    const earth = (c) => { const g = c.createRadialGradient(ex, ey, er, ex, ey, er * 2.2); g.addColorStop(0, 'rgba(110,170,255,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); drawPlanet(c, ex, ey, er, { kind: 'earth', lat: 20, lon: 108, light: [-0.75, 0.35, 0.55], cloudLon: 0 }); atmosphereGlow(c, ex, ey, er); };
    A.lunarScene(ctx, t, { hy: 720, seed: 31, earth });
    for (let k = 0; k < 10; k++) { ctx.fillStyle = 'rgba(35,33,31,0.55)'; ctx.beginPath(); ctx.ellipse(380 + k * 34, 900 + (k % 2) * 12 - k * 4, 13, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    const fx = 690, fgy = 860;
    ctx.strokeStyle = '#d9dde4'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(fx, fgy); ctx.lineTo(fx, fgy - 260); ctx.stroke();
    flagCN(ctx, fx, fgy - 260, 170, 0.0, t);
    A.astronaut(ctx, 560, 870, 125, { phase: 0, walk: 0, face: 1, arm: 0.5 });
    const tp = ease.inOut(prog(t, l0.t0 + 0.2, l0.t0 + 2.6));
    if (tp > 0) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 360 + tp * 1300, H); ctx.clip(); const tg = ctx.createLinearGradient(0, 140, 0, 320); tg.addColorStop(0, '#fff6dc'); tg.addColorStop(1, '#e2a23c'); text(ctx, '可上九天揽月', 960, 300, { size: 170, fam: 'Brush', align: 'center', color: tg, shadow: 30, shadowColor: 'rgba(255,180,80,0.45)' }); ctx.restore(); }
    const fin = ease.inOut(prog(t, l1.t1 + 0.4, l1.t1 + 1.8));
    if (fin > 0) {
      ctx.save(); ctx.globalAlpha = fin * 0.78; ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H); ctx.restore();
      text(ctx, '奔月', 960, 520, { size: 150, fam: 'Brush', align: 'center', color: C.gold2, alpha: fin, shadow: 30, shadowColor: 'rgba(255,180,80,0.4)' });
      text(ctx, '中国登月计划全解析', 960, 620, { size: 48, fam: 'Serif', align: 'center', spacing: 12, alpha: fin });
      text(ctx, '致敬每一位中国航天人', 960, 700, { size: 32, fam: 'Sans', align: 'center', color: C.dim, spacing: 6, alpha: ease.out(prog(t, l1.t1 + 1.4, l1.t1 + 2.4)) });
    }
    A.vignette(ctx, 0.45);
  },
  cues: (S) => [[L(S, 0).t0 + 0.2, 'swell', 5], [L(S, 1).t1 + 0.4, 'chime']],
};

module.exports = { S2 };
