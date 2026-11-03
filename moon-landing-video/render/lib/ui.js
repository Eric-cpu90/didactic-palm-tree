// Shared scene-level UI: step headers, chapter tags, info cards, crewed-mission route map.
const { W, H, clamp, lerp, prog, ease, C, text, textReveal, panel, glowDot, arrowHead, bezPts, strokePoly, polyAt, rr } = require('./core');
const { drawPlanet, atmosphereGlow } = require('./planet');

const CE5_STEPS = ['发射奔月', '近月制动', '组合体分离', '动力下降', '月面采样', '月面起飞', '交会对接', '再入返回'];
const CREW_STEPS = ['揽月先行', '梦舟出发', '环月对接', '下降着陆', '月面活动', '月面起飞', '再次对接', '月地返回', '再入着陆'];

const L = (S, k) => S.lines[Math.min(k, S.lines.length - 1)];
const after = (t, S, k, d = 0.7, off = 0) => ease.out(prog(t, L(S, k).t0 + off, L(S, k).t0 + off + d));
const fadeOut = (t, S, d = 0.6) => 1 - prog(t, S.dur - d - 0.2, S.dur - 0.2);

function chapterTag(ctx, label, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = C.gold; ctx.fillRect(64, 54, 6, 34);
  text(ctx, label, 84, 82, { size: 28, fam: 'SansB', color: 'rgba(255,255,255,0.85)', spacing: 2 });
  ctx.restore();
}
// big numbered step heading (top-left), used in crewed scenes
function stepTitle(ctx, t, num, title, { color = C.cyan, total = 9, alpha = 1 } = {}) {
  const a = ease.out(prog(t, 0.3, 1.1)) * alpha; if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const x = 70, y = 70;
  ctx.beginPath(); ctx.arc(x + 44, y + 44, 44, 0, Math.PI * 2); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 24; ctx.fill(); ctx.shadowBlur = 0;
  text(ctx, String(num), x + 44, y + 46, { size: 52, fam: 'SansH', align: 'center', base: 'middle', color: '#071022' });
  text(ctx, `第 ${num} 步 / 共 ${total} 步`, x + 110, y + 30, { size: 24, fam: 'Sans', color: 'rgba(255,255,255,0.7)' });
  textReveal(ctx, title, x + 110, y + 80, prog(t, 0.4, 1.4), { size: 50, fam: 'SansH', color: '#fff', rise: 10 });
  ctx.restore();
}
function ce5Header(ctx, t, cur, S, pos = [80, 190]) {
  const a = ease.out(prog(t, 0.2, 1.0));
  stepper(ctx, cur, a);
  if (!S) return;
  const b = ease.out(prog(t, 0.35, 0.9)) * (1 - prog(t, L(S, 0).t1 + 1.0, L(S, 0).t1 + 1.6));
  if (b <= 0) return;
  const [x, y] = pos; ctx.save(); ctx.globalAlpha = b;
  ctx.fillStyle = C.gold; ctx.fillRect(x, y - 26, 6, 92);
  text(ctx, `第 ${cur + 1} 步`, x + 22, y, { size: 30, fam: 'SansB', color: C.gold, shadow: 8 });
  textReveal(ctx, CE5_STEPS[cur], x + 22, y + 62, prog(t, 0.45, 1.2), { size: 60, fam: 'SansH', color: '#fff', rise: 10, shadow: 12 });
  ctx.restore();
}
function stepper(ctx, cur, a) {
  require('./core').stepper(ctx, CE5_STEPS, cur, 560, 74, 1240, a, { title: '嫦娥五号 · 任务流程' });
}
function infoCard(ctx, x, y, w, h, p, { title, value, sub, icon, color = C.gold } = {}) {
  if (p <= 0) return;
  const a = ease.out(p); ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * 30);
  panel(ctx, x, y, w, h, { glow: 20, accent: color });
  if (icon) icon(ctx, x + 70, y + h / 2);
  const tx = icon ? x + 140 : x + 34;
  text(ctx, title, tx, y + 50, { size: 28, fam: 'Sans', color: C.dim });
  text(ctx, value, tx, y + 108, { size: 52, fam: 'SansH', color });
  if (sub) text(ctx, sub, tx, y + 146, { size: 22, fam: 'Sans', color: 'rgba(255,255,255,0.5)' });
  ctx.restore();
}
function badge(ctx, x, y, str, p, { color = C.gold, size = 40, sub = '' } = {}) {
  if (p <= 0) return;
  const a = ease.outBack(clamp(p)); ctx.save(); ctx.globalAlpha = clamp(p * 1.5); ctx.translate(x, y); ctx.scale(0.8 + 0.2 * a, 0.8 + 0.2 * a);
  ctx.font = `${size}px SansH`; const w = ctx.measureText(str).width + 90; const h = size * 1.9 + (sub ? size * 0.8 : 0);
  panel(ctx, -w / 2, -h / 2, w, h, { fill: 'rgba(20,16,6,0.75)', line: color, glow: 30, r: h / 2 });
  text(ctx, str, 0, sub ? -size * 0.15 : size * 0.35, { size, fam: 'SansH', align: 'center', color });
  if (sub) text(ctx, sub, 0, size * 0.95, { size: size * 0.55, fam: 'Sans', align: 'center', color: 'rgba(255,255,255,0.8)' });
  ctx.restore();
}

// --------- crewed mission route map (in a 1920x1080 frame; transform for mini version) ---------
const MAP = {
  earth: [330, 560, 150], moon: [1520, 540, 92], orbitR: 150,
};
function mapRoutes() {
  const [ex, ey] = MAP.earth, [mx, my] = MAP.moon, R = MAP.orbitR;
  return {
    lanyue: bezPts([ex + 120, ey - 90], [700, 160], [1150, 150], [mx - R * 0.7, my - R * 0.72]),
    mengzhou: bezPts([ex + 140, ey - 40], [760, 330], [1180, 330], [mx - R * 0.98, my - R * 0.2]),
    back: bezPts([mx - R * 0.5, my + R * 0.86], [1150, 980], [700, 960], [ex + 110, ey + 100]),
  };
}
const MAP_NODES = () => {
  const [ex, ey] = MAP.earth, [mx, my] = MAP.moon, R = MAP.orbitR; const r = mapRoutes();
  const p = (pts, f) => { const q = polyAt(pts, f); return [q.x, q.y]; };
  return [
    { p: p(r.lanyue, 0.32), label: '揽月先行', off: [0, -46] },
    { p: p(r.mengzhou, 0.36), label: '梦舟出发', off: [0, 54] },
    { p: [mx - R * 0.93, my - R * 0.38], label: '环月对接', off: [-96, -28] },
    { p: [mx - 30, my - 30], label: '下降着陆', off: [0, -132] },
    { p: [mx + 10, my + 10], label: '月面活动', off: [210, -36] },
    { p: [mx + 60, my - 10], label: '月面起飞', off: [170, -112] },
    { p: [mx + R * 0.86, my + R * 0.5], label: '再次对接', off: [118, 34] },
    { p: p(r.back, 0.3), label: '月地返回', off: [0, 52] },
    { p: p(r.back, 0.86), label: '再入着陆', off: [40, 54] },
  ];
};
// reveal: number of nodes shown (fractional); hi: highlighted node index; flow: animated pulses phase
function crewMap(ctx, t, { reveal = 9, hi = -1, flow = 0, alpha = 1, labels = true, planets = true } = {}) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  const [ex, ey, er] = MAP.earth, [mx, my, mr] = MAP.moon, R = MAP.orbitR;
  if (planets) {
    drawPlanet(ctx, ex, ey, er, { kind: 'earth', lat: 18, lon: 112, light: [0.55, 0.25, 0.8], cloudLon: t * 2 }); atmosphereGlow(ctx, ex, ey, er);
    drawPlanet(ctx, mx, my, mr, { kind: 'moon', lat: 0, lon: 0, light: [-0.4, 0.2, 0.9] });
    text(ctx, '地球', ex, ey + er + 50, { size: 30, fam: 'SansB', align: 'center', color: C.dim });
    text(ctx, '月球', mx, my + mr + 92, { size: 30, fam: 'SansB', align: 'center', color: C.dim });
  }
  // lunar orbit
  ctx.setLineDash([8, 10]); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  const r = mapRoutes();
  const segs = [[r.lanyue, C.gold, 0], [r.mengzhou, C.cyan, 1], [r.back, '#e9eefc', 7]];
  for (const [pts, col, node] of segs) {
    const f = clamp(reveal - node); if (f <= 0) continue;
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.globalAlpha = alpha * 0.9; strokePoly(ctx, pts, 0, ease.inOut(clamp(f * 1.2))); ctx.globalAlpha = alpha;
    const tip = polyAt(pts, ease.inOut(clamp(f * 1.2))); if (f * 1.2 >= 1) arrowHead(ctx, tip.x, tip.y, tip.a, 14, col);
    if (flow > 0) for (let k = 0; k < 3; k++) { const q = polyAt(pts, ((flow * 0.25 + k / 3) % 1)); glowDot(ctx, q.x, q.y, 5, col, 0.9); }
  }
  // descent / ascent arrows near the moon
  if (reveal > 3) { ctx.strokeStyle = C.gold; ctx.lineWidth = 3; const f = clamp(reveal - 3); ctx.beginPath(); ctx.moveTo(mx - R * 0.6, my - R * 0.8); ctx.quadraticCurveTo(mx - 60, my - 110, lerp(mx - R * 0.6, mx - 26, f), lerp(my - R * 0.8, my - 26, f)); ctx.stroke(); if (f >= 1) arrowHead(ctx, mx - 26, my - 26, 1.2, 10, C.gold); }
  if (reveal > 5) { ctx.strokeStyle = '#ffd38a'; ctx.lineWidth = 3; const f = clamp(reveal - 5); ctx.beginPath(); ctx.moveTo(mx + 40, my - 10); ctx.quadraticCurveTo(mx + 120, my - 40, lerp(mx + 40, mx + R * 0.86, f), lerp(my - 10, my + R * 0.5, f)); ctx.stroke(); if (f >= 1) arrowHead(ctx, mx + R * 0.86, my + R * 0.5, 1.6, 10, '#ffd38a'); }
  MAP_NODES().forEach((n, i) => {
    const f = clamp(reveal - i); if (f <= 0) return;
    const [x, y] = n.p; const on = i === hi; const s = ease.outBack(f) * (on ? 1.25 : 1);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (on) { ctx.shadowColor = C.gold; ctx.shadowBlur = 30; }
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fillStyle = on ? C.gold : 'rgba(10,20,44,0.95)'; ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = 3; ctx.strokeStyle = on ? '#fff' : C.gold; ctx.stroke();
    text(ctx, String(i + 1), 0, 1, { size: 24, fam: 'SansH', align: 'center', base: 'middle', color: on ? '#1b1205' : '#fff' });
    ctx.restore();
    if (labels) text(ctx, n.label, x + n.off[0], y + n.off[1], { size: on ? 30 : 26, fam: 'SansB', align: 'center', color: on ? '#fff' : 'rgba(255,255,255,0.8)', alpha: f, shadow: 8 });
  });
  ctx.restore();
}
function miniMap(ctx, t, hi, alpha = 1) {
  if (alpha <= 0) return;
  const a = ease.out(prog(t, 0.3, 1.0)) * alpha;
  ctx.save(); ctx.globalAlpha = a;
  const x = 1440, y = 40, w = 440, h = 250;
  panel(ctx, x, y, w, h, { fill: 'rgba(6,12,30,0.7)' });
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  ctx.translate(x + 10, y + 6); ctx.scale(0.222, 0.222);
  crewMap(ctx, t, { reveal: 9, hi, labels: false });
  ctx.restore();
  text(ctx, '飞行路线', x + 22, y + 36, { size: 22, fam: 'SansB', color: 'rgba(255,255,255,0.7)', alpha: a });
}

module.exports = { CE5_STEPS, CREW_STEPS, L, after, fadeOut, chapterTag, stepTitle, ce5Header, infoCard, badge, crewMap, miniMap, MAP, MAP_NODES, mapRoutes };
