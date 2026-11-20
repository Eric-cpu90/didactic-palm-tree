'use strict';
/* Deterministic frame renderer: window.init(timeline, manifest, range) then window.renderAt(t). */
const W = 1920, H = 1080;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;
const smooth = p => { p = clamp(p); return p * p * (3 - 2 * p); };
const easeOut = p => 1 - Math.pow(1 - clamp(p), 3);
const ramp = (t, t0, d) => smooth((t - t0) / d);
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

let TL, MAN, XF;
const bitmaps = new Map();
let ctxA, ctxB, plainBg;
const NUM = { ch1: '一', ch2: '二', ch3: '三', ch4: '四', ch5: '五', ch6: '六', ch7: '七', ch8: '八', end: '终' };

async function loadBitmap(file) {
  if (bitmaps.has(file)) return;
  const r = await fetch('../assets/' + file);
  if (!r.ok) throw new Error('missing asset ' + file);
  bitmaps.set(file, await createImageBitmap(await r.blob()));
}

/* ------------------------------------------------------------------ shots */
const BOX = {
  center: [250, 136, 1420, 700],
  left: [120, 136, 880, 700],
  right: [920, 136, 880, 700],
  wide: [150, 136, 1620, 700],
};

function fitOf(shot) {
  if (!shot.img) return 'plain';
  if (shot.fit) return shot.fit;
  const m = MAN[shot.img];
  return m.cover ? 'cover' : 'frame';
}

function drawCover(ctx, bmp, z, fx, fy, dw = W, dh = H, dx = 0, dy = 0) {
  const sc = Math.max(dw / bmp.width, dh / bmp.height) * z;
  const sw = dw / sc, sh = dh / sc;
  const cx = clamp(fx * bmp.width, sw / 2, bmp.width - sw / 2);
  const cy = clamp(fy * bmp.height, sh / 2, bmp.height - sh / 2);
  ctx.drawImage(bmp, cx - sw / 2, cy - sh / 2, sw, sh, dx, dy, dw, dh);
}

function drawShot(ctx, shot, t) {
  const p = (t - shot.t0) / (shot.t1 - shot.t0);          // may run slightly outside 0..1 during fades
  const fit = fitOf(shot);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (fit === 'plain') { ctx.drawImage(plainBg, 0, 0); return; }
  const m = MAN[shot.img];
  const kb = shot.kb || {};
  const z = kb.z || (fit === 'cover' ? [1.03, 1.11] : [1.0, 1.05]);
  const f = kb.f || [[0.5, 0.42], [0.5, 0.42]];
  const zz = lerp(z[0], z[1], p), fx = lerp(f[0][0], f[1][0], p), fy = lerp(f[0][1], f[1][1], p);
  if (fit === 'cover') {
    drawCover(ctx, bitmaps.get(m.file), zz, fx, fy);
  } else if (fit === 'bg') {
    drawCover(ctx, bitmaps.get(m.bg), lerp(1.06, 1.16, p), 0.5, 0.5);
  } else {
    // framed print on a blurred backdrop
    drawCover(ctx, bitmaps.get(m.bg), lerp(1.08, 1.16, p), 0.5, 0.5);
    ctx.fillStyle = 'rgba(9,8,7,.30)'; ctx.fillRect(0, 0, W, H);
    const box = Array.isArray(shot.box) ? shot.box : BOX[shot.box || 'center'];
    const bmp = bitmaps.get(m.file);
    const crop = shot.crop || [0, 0, 1, 1];                 // visible part of the image (fractions)
    const iw = bmp.width * (crop[2] - crop[0]), ih = bmp.height * (crop[3] - crop[1]);
    const s = Math.min(box[2] / iw, box[3] / ih, shot.maxScale || 1.9) * lerp(1.0, 1.018, p);
    const fw = iw * s, fh = ih * s;
    const x = box[0] + (box[2] - fw) / 2, y = box[1] + (box[3] - fh) / 2;
    const mat = 9;
    shot._frame = { x: x - mat, y: y - mat, w: fw + 2 * mat, h: fh + 2 * mat };
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.62)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 22;
    ctx.fillStyle = '#e4dac5';
    ctx.fillRect(x - mat, y - mat, fw + 2 * mat, fh + 2 * mat);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, fw, fh); ctx.clip();
    // slow zoom inside the frame
    const vis = { x: crop[0] * bmp.width, y: crop[1] * bmp.height, w: iw, h: ih };
    const sw = vis.w / zz, sh = vis.h / zz;
    const cx = clamp(vis.x + fx * vis.w, vis.x + sw / 2, vis.x + vis.w - sw / 2);
    const cy = clamp(vis.y + fy * vis.h, vis.y + sh / 2, vis.y + vis.h - sh / 2);
    ctx.drawImage(bmp, cx - sw / 2, cy - sh / 2, sw, sh, x, y, fw, fh);
    ctx.restore();
  }
  if (shot.dim) { ctx.fillStyle = `rgba(9,8,7,${shot.dim})`; ctx.fillRect(0, 0, W, H); }
  if (shot.shade) {
    const g = ctx.createLinearGradient(0, 0, 0, 330);
    g.addColorStop(0, `rgba(6,5,4,${shot.shade})`); g.addColorStop(1, 'rgba(6,5,4,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 330);
  }
}

/* --------------------------------------------------------------- overlays */
function buildOverlay(shot) {
  const o = shot.overlay; if (!o) return null;
  const root = el('div', 'ov'); root.style.display = 'none';
  const parts = [];
  const list = Array.isArray(o) ? o : [o];
  for (const ov of list) parts.push(BUILD[ov.type](root, ov, shot));
  shot._ov = root; shot._parts = parts;
  $('#overlays').appendChild(root);
}

const BUILD = {
  vquote(root, o) {
    const size = o.size || 78, gap = o.gap || 62;
    const n = o.lines.length, width = n * size + (n - 1) * gap;
    const box = el('div', 'vquote');
    box.style.left = ((o.x || 960) - width / 2) + 'px'; box.style.top = (o.y || 230) + 'px'; box.style.gap = gap + 'px';
    const cols = o.lines.map(ln => { const c = el('div', 'col', ln.text); c.style.fontSize = size + 'px'; c.style.width = size + 'px'; box.appendChild(c); return c; });
    root.appendChild(box);
    let at = null;
    if (o.attrib) { at = el('div', 'attrib', o.attrib); at.style.left = (o.ax != null ? o.ax : (o.x || 960) - width / 2) + 'px'; at.style.top = (o.ay || 850) + 'px'; root.appendChild(at); }
    return (t, shot) => {
      o.lines.forEach((ln, i) => {
        const p = easeOut((t - ln.t) / (o.dur || 1.1));
        cols[i].style.opacity = smooth((t - ln.t) / 0.5);
        cols[i].style.clipPath = `inset(0 0 ${(1 - p) * 100}% 0)`;
      });
      if (at) at.style.opacity = ramp(t, (o.attribT != null ? o.attribT : o.lines[o.lines.length - 1].t + 0.9), 0.8);
    };
  },
  hquote(root, o) {
    const box = el('div', 'hquote'); box.style.top = (o.y || 380) + 'px';
    const lns = o.lines.map(ln => { const d = el('div', 'ln', ln.text); d.style.fontSize = (ln.size || o.size || 62) + 'px'; if (ln.color) d.style.color = ln.color; if (ln.font) { d.style.fontFamily = ln.font; d.style.fontWeight = 400; d.style.lineHeight = 1.28; } box.appendChild(d); return d; });
    root.appendChild(box);
    let at = null;
    if (o.attrib) { at = el('div', 'attrib', o.attrib); at.style.left = (o.ax || 1180) + 'px'; at.style.top = (o.ay || 800) + 'px'; root.appendChild(at); }
    return (t) => {
      o.lines.forEach((ln, i) => {
        const p = easeOut((t - ln.t) / 0.9);
        lns[i].style.opacity = p; lns[i].style.transform = `translateY(${(1 - p) * 16}px)`;
      });
      if (at) at.style.opacity = ramp(t, o.lines[o.lines.length - 1].t + 0.9, 0.8);
    };
  },
  side(root, o) {
    const box = el('div', 'side'); box.style.left = o.x + 'px'; box.style.top = o.y + 'px'; if (o.w) box.style.width = o.w + 'px';
    const items = [];
    if (o.kicker) items.push(box.appendChild(el('div', 'kicker', o.kicker)));
    if (o.head) items.push(box.appendChild(el('div', 'head', o.head)));
    if (o.quote) { items.push(box.appendChild(el('div', 'rule'))); items.push(box.appendChild(el('div', 'quote', o.quote))); }
    if (o.body) { items.push(box.appendChild(el('div', 'rule'))); items.push(box.appendChild(el('div', 'body', o.body))); }
    root.appendChild(box);
    return (t, shot) => {
      const base = (o.t != null ? o.t : shot.t0 + 0.5);
      items.forEach((it, i) => { const p = easeOut((t - base - i * 0.28) / 0.9); it.style.opacity = p; it.style.transform = `translateY(${(1 - p) * 14}px)`; });
    };
  },
  big(root, o) {
    const box = el('div', 'big'); box.style.fontSize = (o.size || 280) + 'px'; box.style.top = o.y + 'px';
    if (o.x != null) box.style.left = o.x + 'px'; else { box.style.left = '0'; box.style.width = W + 'px'; box.style.textAlign = 'center'; }
    if (o.color) box.style.color = o.color;
    if (o.font) box.style.fontFamily = o.font;
    if (o.ls) { box.style.letterSpacing = o.ls; if (o.x == null) box.style.textIndent = o.ls; }
    if (o.weight) box.style.fontWeight = o.weight;
    const spans = [...o.text].map(ch => { const s = el('span', null, ch); s.style.display = 'inline-block'; box.appendChild(s); return s; });
    root.appendChild(box);
    return (t, shot) => {
      const base = (o.t != null ? o.t : shot.t0 + 0.4), st = o.stagger != null ? o.stagger : 0.26;
      spans.forEach((s, i) => { const p = easeOut((t - base - i * st) / 1.0); s.style.opacity = p; s.style.transform = `scale(${lerp(1.08, 1, p)})`; });
    };
  },
  triad(root, o) {
    const box = el('div', 'triad'); box.style.top = (o.y || 380) + 'px';
    const its = o.items.map(it => { const d = el('div', 'item', `<div class="zi">${it.zi}</div><div class="sub">${it.sub || ''}</div>`); box.appendChild(d); return d; });
    root.appendChild(box);
    return (t) => { o.items.forEach((it, i) => { const p = easeOut((t - it.t) / 0.9); its[i].style.opacity = p; its[i].style.transform = `translateY(${(1 - p) * 18}px)`; }); };
  },
  seal(root, o) {
    const s = el('div', 'seal', o.text); s.style.left = o.x + 'px'; s.style.top = o.y + 'px'; s.style.width = (o.w || 64) + 'px'; s.style.height = (o.h || 150) + 'px'; s.style.fontSize = (o.size || 34) + 'px';
    root.appendChild(s);
    return (t, shot) => { const p = easeOut((t - (o.t != null ? o.t : shot.t0 + 1.2)) / 0.7); s.style.opacity = p; s.style.transform = `scale(${lerp(1.25, 1, p)})`; };
  },
  map(root, o) {
    const md = MAPS[o.map];
    const wrap = el('div', 'mapwrap');
    const ns = 'http://www.w3.org/2000/svg';
    const [clon, clat] = o.center, sc = o.scale, kx = o.kx || 1;
    const ox = o.ox != null ? o.ox : W / 2, oy = o.oy != null ? o.oy : H / 2;
    const proj = (lon, lat) => [ox + ((((lon - clon + 540) % 360) + 360) % 360 - 180) * sc * kx, oy - (lat - clat) * sc];
    const cv = el('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.fillStyle = o.dotColor || 'rgba(236,228,210,.44)';
    const r = o.dot || 2.3;
    for (const [lon, lat] of md.dots) {
      const [x, y] = proj(lon, lat);
      if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
      g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
    }
    wrap.appendChild(cv);
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    wrap.appendChild(svg);
    const P = id => o.points.find(p => p.id === id);
    const routes = (o.routes || []).map(rt => {
      const a = P(rt.from), b = P(rt.to);
      const [x0, y0] = proj(a.lon, a.lat), [x1, y1] = proj(b.lon, b.lat);
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, len = Math.hypot(x1 - x0, y1 - y0);
      const bend = (rt.bend != null ? rt.bend : 0.18) * len;
      const nx = (y1 - y0) / len, ny = -(x1 - x0) / len;
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M${x0},${y0} Q${mx + nx * bend},${my + ny * bend} ${x1},${y1}`);
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#c9a567'); path.setAttribute('stroke-width', o.stroke || 3); path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
      const L = path.getTotalLength(); path.setAttribute('stroke-dasharray', L); path.setAttribute('stroke-dashoffset', L);
      return { rt, path, L };
    });
    const pts = o.points.map(pt => {
      const [x, y] = proj(pt.lon, pt.lat);
      const halo = document.createElementNS(ns, 'circle'); halo.setAttribute('cx', x); halo.setAttribute('cy', y); halo.setAttribute('fill', 'none'); halo.setAttribute('stroke', '#c9a567'); halo.setAttribute('stroke-width', 1.6);
      const dot = document.createElementNS(ns, 'circle'); dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('fill', pt.hidden ? 'none' : '#f0e4c8');
      svg.appendChild(halo); svg.appendChild(dot);
      let lab = null;
      if (pt.name) {
        lab = el('div', 'maplabel', pt.name + (pt.sub ? `<small>${pt.sub}</small>` : ''));
        if (o.labelSize) lab.style.fontSize = o.labelSize + 'px';
        const dxp = pt.dx != null ? pt.dx : 20, dyp = pt.dy != null ? pt.dy : -18;
        if (pt.align === 'right') { lab.style.right = (W - x + dxp) + 'px'; lab.style.textAlign = 'right'; } else lab.style.left = (x + dxp) + 'px';
        lab.style.top = (y + dyp) + 'px';
        wrap.appendChild(lab);
      }
      return { pt, halo, dot, lab };
    });
    if (o.title) { const tt = el('div', 'maptitle', o.title); tt.style.left = (o.tx || 120) + 'px'; tt.style.top = (o.ty || 800) + 'px'; wrap.appendChild(tt); }
    root.appendChild(wrap);
    return (t, shot) => {
      cv.style.opacity = ramp(t, shot.t0 - 0.3, 1.2);
      for (const { pt, halo, dot, lab } of pts) {
        const tt = pt.t != null ? pt.t : shot.t0 + 0.6;
        const p = easeOut((t - tt) / 0.8), R = pt.r || 7;
        dot.setAttribute('opacity', p); dot.setAttribute('r', lerp(1, R, p));
        const q = clamp((t - tt) / 1.8);
        halo.setAttribute('opacity', (t < tt || pt.hidden) ? 0 : lerp(0.95, 0.38, q)); halo.setAttribute('r', lerp(R, R * 2.6, easeOut(q)));
        if (lab) { lab.style.opacity = p; lab.style.transform = `translateY(${(1 - p) * 8}px)`; }
      }
      for (const { rt, path, L } of routes) {
        const t0 = rt.t != null ? rt.t : shot.t0 + 1.2;
        const p = smooth((t - t0) / (rt.dur || 2.2));
        path.setAttribute('stroke-dashoffset', L * (1 - p)); path.setAttribute('opacity', t > t0 ? 0.95 : 0);
      }
    };
  },
  row(root, o) {
    // a row of small framed prints (processed images) with labels
    const n = o.items.length, hgt = o.h || 420, gap = o.gap || 44;
    const ws = o.items.map(it => { const m = MAN[it.img]; const c = it.crop || [0, 0, 1, 1]; return hgt * (m.w * (c[2] - c[0])) / (m.h * (c[3] - c[1])); });
    const total = ws.reduce((a, b) => a + b, 0) + gap * (n - 1);
    let x = (W - total) / 2;
    const cells = o.items.map((it, i) => {
      const m = MAN[it.img], c = it.crop || [0, 0, 1, 1];
      const cell = el('div', 'rowcell'); cell.style.left = x + 'px'; cell.style.top = (o.y || 250) + 'px'; cell.style.width = ws[i] + 'px';
      const fr = el('div', 'rowframe'); fr.style.width = ws[i] + 'px'; fr.style.height = hgt + 'px';
      const im = el('img'); im.src = '../assets/' + m.file;
      const sc = hgt / (m.h * (c[3] - c[1]));
      im.style.width = (m.w * sc) + 'px'; im.style.height = (m.h * sc) + 'px'; im.style.left = (-c[0] * m.w * sc) + 'px'; im.style.top = (-c[1] * m.h * sc) + 'px';
      fr.appendChild(im); cell.appendChild(fr);
      cell.appendChild(el('div', 'rowyear', it.year || '')); cell.appendChild(el('div', 'rowcap', it.cap || ''));
      root.appendChild(cell); x += ws[i] + gap;
      return cell;
    });
    return (t, shot) => {
      const base = o.t != null ? o.t : shot.t0 + 0.3, st = o.stagger != null ? o.stagger : 0.5;
      cells.forEach((c, i) => { const p = easeOut((t - base - i * st) / 1.0); c.style.opacity = p; c.style.transform = `translateY(${(1 - p) * 22}px)`; });
    };
  },
};
let MAPS = {};

/* --------------------------------------------------------------- segments */
function buildSegment(seg) {
  const root = el('div', 'seg'); root.style.display = 'none';
  if (seg.type === 'card') {
    root.classList.add('card');
    root.appendChild(el('div', 'glow'));
    root.appendChild(el('div', 'wm', NUM[seg.chapter] || ''));
    const label = root.appendChild(el('div', 'label', seg.label));
    const title = root.appendChild(el('div', 'title'));
    const chars = [...seg.title].map(c => title.appendChild(el('span', null, c)));
    const line = root.appendChild(el('div', 'line'));
    const years = root.appendChild(el('div', 'years', seg.years));
    seg._upd = (t) => {
      const u = t - seg.t0, out = 1 - ramp(t, seg.t1 - 0.75, 0.6);
      label.style.opacity = ramp(u, 0.35, 0.8) * out;
      chars.forEach((c, i) => { const p = easeOut((u - 0.55 - i * 0.13) / 1.0); c.style.opacity = p * out; c.style.transform = `translateY(${(1 - p) * 26}px)`; });
      const lw = 360 * easeOut((u - 1.0) / 1.2); line.style.width = lw + 'px'; line.style.marginLeft = (-lw / 2) + 'px'; line.style.opacity = out;
      years.style.opacity = ramp(u, 1.35, 0.9) * out;
    };
  } else if (seg.type === 'title') {
    root.classList.add('titleSeg');
    const pm = MAN.title_portrait;
    const pw = el('div', 'portrait'); const img = el('img'); img.src = '../assets/' + pm.file; pw.appendChild(img); root.appendChild(pw);
    root.appendChild(el('div', 'shade'));
    let calli;
    if (MAN.calli_txwg) { calli = el('div', 'calli'); const ci = el('img'); ci.src = '../assets/' + MAN.calli_txwg.file; calli.appendChild(ci); }
    else calli = el('div', 'bigtitle', '天下为公');
    root.appendChild(calli);
    const rule = root.appendChild(el('div', 'rule'));
    const sub = root.appendChild(el('div', 'sub', '纪念孙中山先生诞辰一百六十周年'));
    const dates = root.appendChild(el('div', 'dates', '1866 — 1925'));
    seg._img = img;
    seg._upd = (t) => {
      const u = t - seg.t0, d = seg.t1 - seg.t0, out = 1 - ramp(t, seg.t1 - 1.0, 0.9);
      const f = pm.focus || [0.5, 0.36], zoom = lerp(1.0, 1.07, u / d);
      const sc = Math.max(920 / pm.w, 1080 / pm.h) * (pm.zoom || 1.0) * zoom;
      const x = Math.min(0, Math.max(920 - pm.w * sc, 460 - f[0] * pm.w * sc)), y = Math.min(0, Math.max(1080 - pm.h * sc, 500 - f[1] * pm.h * sc));
      img.style.transform = `translate(${x}px,${y}px) scale(${sc})`;
      pw.style.opacity = ramp(u, 0.2, 2.2) * out * 0.92;
      const cp = easeOut((u - 1.2) / 1.8);
      calli.style.opacity = cp * out; calli.style.clipPath = MAN.calli_txwg ? `inset(0 0 0 ${(1 - cp) * 100}%)` : 'none';
      const lw = 620 * easeOut((u - 2.4) / 1.4); rule.style.width = lw + 'px'; rule.style.opacity = out;
      sub.style.opacity = ramp(u, 2.8, 1.0) * out; dates.style.opacity = ramp(u, 3.4, 1.0) * out;
    };
  } else if (seg.type === 'outro') {
    root.classList.add('outro');
    root.appendChild(el('div', 'glow'));
    const c = root.appendChild(el('div', 'center'));
    let calli;
    if (MAN.calli_txwg) { calli = el('div', 'calli'); const ci = el('img'); ci.src = '../assets/' + MAN.calli_txwg.file; calli.appendChild(ci); }
    else calli = el('div', 'bigtitle', '天下为公');
    c.appendChild(calli);
    const name = c.appendChild(el('div', 'name', '孙中山先生'));
    const dates = c.appendChild(el('div', 'dates', '1866 — 1925'));
    const cr = root.appendChild(el('div', 'credits', TL.credits_html || ''));
    seg._upd = (t) => {
      const u = t - seg.t0, d = seg.t1 - seg.t0, split = d * 0.47;
      const out1 = 1 - ramp(u, split - 0.9, 0.9);
      calli.style.opacity = ramp(u, 0.8, 1.8) * out1; name.style.opacity = ramp(u, 2.2, 1.2) * out1; dates.style.opacity = ramp(u, 2.9, 1.2) * out1;
      cr.style.opacity = ramp(u, split + 0.1, 1.0);
    };
  }
  seg._el = root;
  $('#segments').appendChild(root);
}

/* ------------------------------------------------------------------- init */
window.init = async function (tl, man, maps, range) {
  TL = tl; MAN = man; MAPS = maps || {}; XF = tl.xfade;
  const [ra, rb] = range || [0, tl.duration];
  ctxA = $('#cvA').getContext('2d', { alpha: false }); ctxB = $('#cvB').getContext('2d', { alpha: false });
  plainBg = new OffscreenCanvas(W, H);
  const g = plainBg.getContext('2d');
  const grad = g.createRadialGradient(W / 2, H * 0.46, 80, W / 2, H * 0.46, 1150);
  grad.addColorStop(0, '#1d1814'); grad.addColorStop(0.55, '#110f0c'); grad.addColorStop(1, '#0a0908');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);

  for (const fam of ['400 40px Song', '600 40px Song', '800 40px Song', '500 40px Hei', '40px Brush', '400 40px Garamond'])
    await document.fonts.load(fam, '天下为公孙中山1866—');
  await document.fonts.ready;

  const need = new Set();
  TL.shots.forEach((s, i) => {
    s._i = i;
    if (s.t1 + XF < ra || s.t0 - XF > rb) return;
    s._live = true;
    if (s.img) { const m = MAN[s.img]; if (!m) throw new Error('unknown image ' + s.img); const fit = fitOf(s); if (fit !== 'bg') need.add(m.file); if (fit !== 'cover') need.add(m.bg); }
    buildOverlay(s);
  });
  await Promise.all([...need].map(loadBitmap));
  for (const seg of TL.segments) {
    if (seg.t1 + 1 < ra || seg.t0 - 1 > rb) continue;
    buildSegment(seg);
  }
  await Promise.all([...document.images].map(im => im.decode ? im.decode().catch(() => 0) : 0));
  return { shots: TL.shots.filter(s => s._live).length, images: need.size };
};

/* ------------------------------------------------------------ renderAt(t) */
window.renderAt = function (t) {
  // --- photo shots on the two canvases
  const live = TL.shots.filter(s => s._live && t >= s.t0 - XF / 2 && t < s.t1 + XF / 2);
  const cvA = $('#cvA'), cvB = $('#cvB');
  cvA.style.visibility = cvB.style.visibility = 'hidden';
  live.forEach((s, k) => {
    const cv = (s._i % 2 === 0) ? cvA : cvB, ctx = (s._i % 2 === 0) ? ctxA : ctxB;
    drawShot(ctx, s, t);
    cv.style.visibility = 'visible';
    cv.style.zIndex = k;                                   // later shot on top
    cv.style.opacity = k === 0 ? 1 : ramp(t, s.t0 - XF / 2, XF);
  });
  for (const s of TL.shots) {
    if (!s._ov) continue;
    const a = Math.min(ramp(t, s.t0 - XF / 2 + 0.1, XF), 1 - ramp(t, s.t1 - XF / 2, XF * 0.8));
    if (a <= 0 || t < s.t0 - XF / 2 || t > s.t1 + XF / 2) { s._ov.style.display = 'none'; continue; }
    s._ov.style.display = 'block'; s._ov.style.opacity = a;
    for (const upd of s._parts) upd(t, s);
  }

  // --- HUD
  const ch = TL.chapters.find(c => t >= c.t0 && t < c.t1) || TL.chapters[TL.chapters.length - 1];
  const tag = $('#chapterTag');
  let tagA = 0;
  if (ch.title) tagA = Math.min(ramp(t, ch.narr_t0 - 0.1, 0.9), 1 - ramp(t, ch.t1 - 0.9, 0.7));
  tag.style.opacity = tagA;
  if (tagA > 0) { tag.querySelector('.no').textContent = ch.label; tag.querySelector('.ttl').textContent = ch.title; }

  const cur = TL.shots.find(s => t >= s.t0 && t < s.t1);
  const yearEl = $('#year'), capEl = $('#caption');
  let ya = 0, ca = 0;
  if (cur) {
    const idx = cur._i, prev = TL.shots[idx - 1], next = TL.shots[idx + 1];
    const same = (a, b, k) => a && b && a.chapter === b.chapter && (a[k] || '') === (b[k] || '');
    ya = cur.year ? Math.min(same(prev, cur, 'year') ? 1 : ramp(t, cur.t0 + 0.1, 0.7), same(cur, next, 'year') ? 1 : 1 - ramp(t, cur.t1 - 0.5, 0.45)) : 0;
    ca = cur.cap ? Math.min(same(prev, cur, 'cap') ? 1 : ramp(t, cur.t0 + 0.35, 0.8), same(cur, next, 'cap') ? 1 : 1 - ramp(t, cur.t1 - 0.5, 0.45)) : 0;
    if (cur.year) yearEl.textContent = cur.year;
    if (cur.cap) {
      const fr = fitOf(cur) === 'frame' ? cur._frame : null;
      if (fr) { capEl.textContent = cur.cap.replace(/\n/g, '　'); capEl.style.whiteSpace = 'nowrap'; capEl.style.left = (fr.x + 2) + 'px'; capEl.style.top = (fr.y + fr.h + 20) + 'px'; capEl.style.bottom = 'auto'; }
      else { capEl.textContent = cur.cap; capEl.style.whiteSpace = 'pre-line'; capEl.style.left = '84px'; capEl.style.top = 'auto'; capEl.style.bottom = '146px'; }
    }
  }
  yearEl.style.opacity = ya; capEl.style.opacity = ca;

  // --- subtitles
  const sub = $('#subs span');
  const cue = TL.cues.find(c => t >= c.t0 && t < c.t1 && c.chapter !== 'open');
  if (cue) {
    const i = TL.cues.indexOf(cue), prev = TL.cues[i - 1], next = TL.cues[i + 1];
    const contIn = prev && Math.abs(prev.t1 - cue.t0) < 0.02, contOut = next && Math.abs(next.t0 - cue.t1) < 0.02;
    sub.textContent = cue.text;
    sub.style.opacity = Math.min(contIn ? 1 : ramp(t, cue.t0, 0.14), contOut ? 1 : 1 - ramp(t, cue.t1 - 0.16, 0.16));
  } else sub.style.opacity = 0;
  $('#scrimBottom').style.opacity = 1;

  // --- segments (title / chapter cards / outro)
  for (const seg of TL.segments) {
    if (!seg._el) continue;
    const a = seg.type === 'outro'
      ? ramp(t, seg.t0 - 0.9, 1.3)
      : Math.min(ramp(t, seg.t0 - 0.55, 0.9), 1 - ramp(t, seg.t1 - 0.15, 0.85));
    if (a <= 0) { seg._el.style.display = 'none'; continue; }
    seg._el.style.display = 'block'; seg._el.style.opacity = a;
    seg._upd(t);
  }

  // --- global fades
  $('#blackout').style.opacity = Math.max(1 - ramp(t, 0.3, 1.8), ramp(t, TL.duration - 2.8, 2.4));
  return true;
};
