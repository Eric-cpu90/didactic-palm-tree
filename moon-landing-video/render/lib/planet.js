// Procedural planet textures (equirectangular) + per-pixel sphere renderer.
// Earth land shapes come from Natural Earth (public domain); the Moon is procedurally
// generated with its major maria and craters placed at their real selenographic positions.
const fs = require('fs');
const path = require('path');
const { createCanvas, ROOT, ASSETS, clamp, rng } = require('./core');

const TEX_DIR = path.join(ROOT, 'build', 'tex');
const TW = 2048, TH = 1024;

// ---------- noise ----------
function hash3(i, j, k, s) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 2147483647) ^ Math.imul(s, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise3(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (a, b, d) => hash3(xi + a, yi + b, zi + d, s);
  const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * u, x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * u;
  const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * u, x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}
function fbm3(x, y, z, oct = 5, s = 0) {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let o = 0; o < oct; o++) { sum += a * vnoise3(x * f, y * f, z * f, s + o * 17); norm += a; a *= 0.5; f *= 2.03; }
  return sum / norm;
}
const D2R = Math.PI / 180;
function sph(lat, lon) { const cl = Math.cos(lat * D2R); return [cl * Math.sin(lon * D2R), Math.sin(lat * D2R), cl * Math.cos(lon * D2R)]; }
function angDist(lat1, lon1, lat2, lon2) {
  const a = sph(lat1, lon1), b = sph(lat2, lon2);
  return Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1)) / D2R;
}
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function boxBlur(src, w, h, r, passes = 3) {
  let a = Float32Array.from(src), b = new Float32Array(w * h);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) { // horizontal (wrapping)
      let acc = 0; const row = y * w;
      for (let k = -r; k <= r; k++) acc += a[row + ((k + w) % w)];
      for (let x = 0; x < w; x++) { b[row + x] = acc / (2 * r + 1); acc += a[row + ((x + r + 1) % w)] - a[row + ((x - r + w) % w)]; }
    }
    for (let x = 0; x < w; x++) { // vertical (clamped)
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += b[clamp(k, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) { a[y * w + x] = acc / (2 * r + 1); acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x]; }
    }
  }
  return a;
}

// ---------- Earth ----------
function genEarth() {
  const gj = JSON.parse(fs.readFileSync(path.join(ASSETS, 'ne_50m_land.geojson'), 'utf8'));
  const cv = createCanvas(TW, TH); const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, TW, TH); c.fillStyle = '#fff';
  const X = (lon) => ((lon + 180) / 360) * TW, Y = (lat) => ((90 - lat) / 180) * TH;
  for (const f of gj.features) {
    const g = f.geometry; const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      c.beginPath();
      for (const ring of poly) { ring.forEach(([lo, la], i) => (i ? c.lineTo(X(lo), Y(la)) : c.moveTo(X(lo), Y(la)))); c.closePath(); }
      c.fill('evenodd');
    }
  }
  const md = c.getImageData(0, 0, TW, TH).data;
  const land = new Float32Array(TW * TH);
  for (let i = 0; i < TW * TH; i++) land[i] = md[i * 4] / 255;
  const coast = boxBlur(land, TW, TH, 6, 2);
  const out = new Uint8ClampedArray(TW * TH * 4);
  const deserts = [[15, 33, -17, 60], [36, 46, 75, 118], [-32, -18, 118, 146], [25, 37, -118, -103], [-28, -17, 12, 26], [-30, -16, -72, -67], [24, 36, 44, 70]];
  for (let y = 0; y < TH; y++) {
    const lat = 90 - ((y + 0.5) / TH) * 180;
    for (let x = 0; x < TW; x++) {
      const lon = ((x + 0.5) / TW) * 360 - 180; const i = y * TW + x;
      const p = sph(lat, lon);
      const n1 = fbm3(p[0] * 4, p[1] * 4, p[2] * 4, 5, 3);
      const n2 = fbm3(p[0] * 18, p[1] * 18, p[2] * 18, 3, 9);
      let r, g, b, ocean = 0;
      const L = land[i];
      if (L < 0.5) {
        const sh = smoothstep(0.0, 0.5, coast[i]);
        r = 4 + 8 * n1 + 18 * sh; g = 18 + 16 * n1 + 52 * sh; b = 52 + 28 * n1 + 50 * sh; ocean = 1;
        if (Math.abs(lat) > 74) { const ice = smoothstep(0.55, 0.75, (Math.abs(lat) - 74) / 12 + 0.5 * n1) * 0.9; r += (220 - r) * ice; g += (230 - g) * ice; b += (240 - b) * ice; ocean = 1 - ice; }
      } else {
        const al = Math.abs(lat);
        // vegetation by latitude
        const bl = (a, b, x) => smoothstep(a, b, al + 6 * (n1 - 0.5));
        const t1 = bl(14, 24), t2 = bl(42, 50), t3 = bl(58, 68);
        let vr = 30 + (70 - 30) * t1, vg = 74 + (96 - 74) * t1, vb = 30 + (50 - 30) * t1;
        vr += (46 - vr) * t2; vg += (72 - vg) * t2; vb += (44 - vb) * t2;
        vr += (104 - vr) * t3; vg += (104 - vg) * t3; vb += (92 - vb) * t3;
        let des = 0;
        for (const [a0, a1, o0, o1] of deserts) {
          const e = 5 + 4 * n1;
          const dl = Math.min(lat - a0, a1 - lat), dn = Math.min(lon - o0, o1 - lon);
          des = Math.max(des, smoothstep(-e, e, Math.min(dl, dn)) * (0.75 + 0.5 * (n1 - 0.5)));
        }
        des = clamp(des);
        const sr = 200, sg = 168, sb = 118;
        r = vr + (sr - vr) * des; g = vg + (sg - vg) * des; b = vb + (sb - vb) * des;
        { const tib = smoothstep(7, 2, Math.max(Math.abs(lat - 33) - 5, Math.abs(lon - 88) - 11) + 3 * (n1 - 0.5)); r += (118 - r) * tib * 0.55; g += (100 - g) * tib * 0.55; b += (80 - b) * tib * 0.55; }
        const v = 1.05 + 0.4 * (n2 - 0.5) + 0.3 * (n1 - 0.5); r *= v; g *= v; b *= v;
        const ice = Math.max(smoothstep(-62, -70, lat), (lat > 60 && lon > -75 && lon < -10) ? smoothstep(60, 68, lat + 6 * (n1 - 0.5)) : 0, smoothstep(74, 80, lat));
        r += (236 - r) * ice; g += (240 - g) * ice; b += (246 - b) * ice;
      }
      out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = ocean * 255;
    }
  }
  return out;
}
function genClouds() {
  const out = new Uint8ClampedArray(TW * TH);
  for (let y = 0; y < TH; y++) {
    const lat = 90 - ((y + 0.5) / TH) * 180; const al = Math.abs(lat);
    const band = 0.5 + 0.22 * Math.exp(-Math.pow((al - 5) / 8, 2)) + 0.25 * Math.exp(-Math.pow((al - 55) / 14, 2)) - 0.18 * Math.exp(-Math.pow((al - 25) / 8, 2));
    for (let x = 0; x < TW; x++) {
      const lon = ((x + 0.5) / TW) * 360 - 180; const p = sph(lat, lon);
      const wx = fbm3(p[0] * 2 + 3, p[1] * 2, p[2] * 2, 3, 41) - 0.5;
      const n = fbm3(p[0] * 9 + wx * 3.0, p[1] * 12 + wx * 2.0, p[2] * 9, 6, 77);
      const v = Math.pow(smoothstep(0.6 - 0.16 * band, 0.8 - 0.16 * band, n), 1.3);
      out[y * TW + x] = v * 225;
    }
  }
  return out;
}

// ---------- Moon ----------
const MARIA = [
  // [lat, lon, radius(deg), darkness]
  [33, -16, 17, 1], [45, -31, 4, 1], [28, 17.5, 10, 1], [8.5, 31, 11, 1.05], [2, 24, 7, 1], [-3, 38, 6, 1], [17, 59, 7.5, 1.05],
  [-7.5, 51, 10, 0.95], [-15, 35, 5.5, 0.95], [-21, -17, 10, 0.9], [-24, -39, 6.5, 1], [-10, -23, 6, 0.9], [8, -31, 7, 0.95],
  [13.3, 4, 4, 0.9], [57, -20, 5, 0.85], [56, 0, 5, 0.85], [58, 22, 5, 0.85], [55, -40, 5, 0.85], [52, 38, 4.5, 0.8],
  // Oceanus Procellarum (irregular)
  [20, -57, 14, 1], [5, -55, 12, 1], [30, -50, 11, 1], [-5, -45, 9, 0.95], [10, -42, 10, 0.95], [40, -45, 8, 0.95], [-15, -50, 7, 0.9], [25, -65, 9, 0.95],
  [22, -30, 9, 0.95], [18, 8, 6, 0.9], [20, 25, 6, 0.95], [-2, -10, 5, 0.7], [-12, 12, 4, 0.6], [40, 0, 6, 0.9],
  // far side / limb
  [27, 147, 4, 0.9], [-34, 163, 3, 0.7], [-20, -95, 3.5, 0.9], [-36, -151, 4, 0.55], [-5, 87, 4, 0.8], [-15, 85, 4, 0.75], [20, 87, 4.5, 0.8],
];
const FEATURED = [
  // [lat, lon, radius(deg), freshness(0..1), rays, darkFloor]
  [-43.3, -11.2, 1.45, 1, 1, 0], [9.6, -20.1, 1.55, 0.9, 1, 0], [8.1, -38, 0.55, 0.9, 1, 0], [23.7, -47.4, 0.55, 1, 0.6, 0],
  [51.6, -9.4, 1.7, 0.2, 0, 0.8], [-5.2, -68.6, 3, 0.1, 0, 1], [-58.4, -14.4, 3.7, 0.2, 0, 0], [-44.8, 175.9, 3, 0.1, 0, 0.5],
  [-11.6, -1.8, 2.5, 0.2, 0, 0], [-3.6, -16.8, 1.9, 0.2, 0, 0], [21.7, 52.9, 0.7, 0.8, 0.5, 0], [-28.1, 64.6, 0.6, 0.9, 0.6, 0],
  [-26.5, 68, 1.5, 0.3, 0, 0], [26.8, 30.7, 0.6, 0.6, 0, 0], [-89, 0, 0.7, 0.1, 0, 0.6],
];
function genMoon() {
  const N = TW * TH;
  const alb = new Float32Array(N), hgt = new Float32Array(N);
  // base albedo + maria
  const mareTex = new Float32Array(N);
  for (let y = 0; y < TH; y++) {
    const lat = 90 - ((y + 0.5) / TH) * 180;
    for (let x = 0; x < TW; x++) {
      const lon = ((x + 0.5) / TW) * 360 - 180; const i = y * TW + x; const p = sph(lat, lon);
      const n1 = fbm3(p[0] * 3, p[1] * 3, p[2] * 3, 5, 5), n2 = fbm3(p[0] * 25, p[1] * 25, p[2] * 25, 3, 13);
      let mare = 0;
      for (const [la, lo, rad, dk] of MARIA) {
        const ca = Math.cos(la * D2R) * Math.cos(lat * D2R) * Math.cos((lon - lo) * D2R) + Math.sin(la * D2R) * Math.sin(lat * D2R);
        const d = Math.acos(clamp(ca, -1, 1)) / D2R;
        if (d > rad * 1.6) continue;
        const wob = rad * 1.12 * (1 + 0.55 * (fbm3(p[0] * 7 + la * 0.1, p[1] * 7, p[2] * 7 + lo * 0.01, 5, 21) - 0.5) + 0.25 * (fbm3(p[0] * 22, p[1] * 22, p[2] * 22, 3, 31) - 0.5));
        mare = Math.max(mare, dk * smoothstep(wob * 1.18, wob * 0.62, d));
      }
      mareTex[i] = mare;
      const n3 = fbm3(p[0] * 10, p[1] * 10, p[2] * 10, 4, 41);
      const high = 0.68 + 0.12 * (n1 - 0.5) + 0.08 * (n2 - 0.5);
      const marea = 0.40 + 0.12 * (n3 - 0.5) + 0.05 * (n2 - 0.5);
      alb[i] = high + (marea - high) * clamp(mare);
      hgt[i] = 0.4 * (n2 - 0.5) * (1 - 0.7 * clamp(mare)) - 0.3 * clamp(mare);
    }
  }
  const R = rng(20201201);
  const stamp = (lat, lon, rad, fresh, darkFloor) => {
    const pxPerDeg = TW / 360; const ext = rad * 2.6;
    const y0 = Math.floor((90 - lat - ext) * TH / 180), y1 = Math.ceil((90 - lat + ext) * TH / 180);
    for (let y = Math.max(0, y0); y <= Math.min(TH - 1, y1); y++) {
      const plat = 90 - ((y + 0.5) / TH) * 180; const cl = Math.max(0.05, Math.cos(plat * D2R));
      const xs = ext / cl * pxPerDeg; const cx = ((lon + 180) / 360) * TW;
      for (let xx = Math.floor(cx - xs); xx <= Math.ceil(cx + xs); xx++) {
        const x = ((xx % TW) + TW) % TW; const plon = ((x + 0.5) / TW) * 360 - 180;
        let dlon = plon - lon; if (dlon > 180) dlon -= 360; if (dlon < -180) dlon += 360;
        const dx = dlon * cl, dy = plat - lat; const u = Math.sqrt(dx * dx + dy * dy) / rad;
        if (u > 2.6) continue;
        const i = y * TW + x;
        // height profile: bowl + rim + ejecta falloff
        let h = 0;
        if (u < 1) h = -0.9 * (1 - u * u) + 0.25; else h = 0.25 * Math.exp(-Math.pow((u - 1) / 0.35, 2));
        if (u < 0.35 && rad > 1.2) h += 0.25 * (1 - u / 0.35); // central peak for big craters
        hgt[i] += h * Math.min(1.2, 0.35 + rad * 0.5) * 0.55;
        if (u < 0.85 && darkFloor) alb[i] = alb[i] * (1 - 0.45 * darkFloor) + 0.0;
        if (fresh > 0) alb[i] += fresh * 0.2 * Math.exp(-Math.pow((u - 1) / 0.5, 2)) + fresh * 0.08 * clamp(2.2 - u);
      }
    }
  };
  // random craters (power-law sizes)
  for (let k = 0; k < 9000; k++) {
    const lat = Math.asin(R() * 2 - 1) / D2R, lon = R() * 360 - 180;
    let rad = 0.08 * Math.pow(1 / (0.015 + R()), 0.8); if (rad > 6) rad = 4 + R() * 2;
    const yi = Math.floor((90 - lat) / 180 * TH), xi = Math.floor((lon + 180) / 360 * TW);
    const inMare = mareTex[Math.min(TH - 1, yi) * TW + Math.min(TW - 1, xi)] > 0.5;
    if (inMare && (R() < 0.75 || rad > 1.5)) continue;
    stamp(lat, lon, rad, R() < 0.06 ? 0.6 : 0.05 * R(), 0);
  }
  for (const [la, lo, rad, fresh, , dark] of FEATURED) stamp(la, lo, rad, fresh, dark);
  // bright ray systems
  for (const [la, lo, rad, fresh, rays] of FEATURED) {
    if (!rays) continue;
    const n = 16; const rr = rng(Math.floor(la * 100 + lo));
    for (let k = 0; k < n; k++) {
      const az = rr() * Math.PI * 2, len = rad * (5 + rr() * 14) * rays, wid = rad * (0.7 + rr() * 0.8);
      for (let s = rad; s < len; s += wid * 0.5) {
        const fade = Math.pow(1 - s / len, 1.5) * 0.035 * rays;
        const plat = la + Math.cos(az) * s, plon = lo + Math.sin(az) * s / Math.max(0.2, Math.cos(plat * D2R));
        const y0 = Math.floor((90 - plat - wid) * TH / 180), y1 = Math.ceil((90 - plat + wid) * TH / 180);
        for (let y = Math.max(0, y0); y <= Math.min(TH - 1, y1); y++) {
          const yl = 90 - ((y + 0.5) / TH) * 180; const cl = Math.max(0.1, Math.cos(yl * D2R));
          const cx = ((plon + 180) / 360) * TW; const xs = wid / cl * TW / 360;
          for (let xx = Math.floor(cx - xs); xx <= Math.ceil(cx + xs); xx++) {
            const x = ((xx % TW) + TW) % TW; const xl = ((x + 0.5) / TW) * 360 - 180;
            let dl = xl - plon; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
            const d = Math.hypot(dl * cl, yl - plat) / wid; if (d > 1) continue;
            alb[y * TW + x] += fade * (1 - d * d);
          }
        }
      }
    }
  }
  // bake relief shading (light from upper-left) into the albedo
  const out = new Uint8ClampedArray(N * 4);
  for (let y = 0; y < TH; y++) {
    const cl = Math.max(0.15, Math.cos((90 - ((y + 0.5) / TH) * 180) * D2R));
    for (let x = 0; x < TW; x++) {
      const i = y * TW + x;
      const hx = (hgt[y * TW + ((x + 1) % TW)] - hgt[y * TW + ((x - 1 + TW) % TW)]) / cl;
      const hy = hgt[Math.min(TH - 1, y + 1) * TW + x] - hgt[Math.max(0, y - 1) * TW + x];
      const sh = clamp(1 - 0.75 * hx - 0.5 * hy, 0.55, 1.45);
      const v = clamp(alb[i] * sh, 0, 1.2) * 215;
      out[i * 4] = v * 1.0; out[i * 4 + 1] = v * 0.985; out[i * 4 + 2] = v * 0.955; out[i * 4 + 3] = 255;
    }
  }
  return out;
}

// ---------- cache on disk ----------
function cached(name, bytesPer, gen) {
  const f = path.join(TEX_DIR, name + '.raw');
  if (fs.existsSync(f)) return new Uint8ClampedArray(fs.readFileSync(f).buffer.slice(0));
  fs.mkdirSync(TEX_DIR, { recursive: true });
  const t0 = Date.now(); const d = gen();
  fs.writeFileSync(f, Buffer.from(d.buffer)); console.error(`generated ${name} in ${Date.now() - t0}ms`);
  return d;
}
let TEX = null;
function textures() {
  if (!TEX) TEX = { earth: cached('earth', 4, genEarth), clouds: cached('clouds', 1, genClouds), moon: cached('moon', 4, genMoon) };
  return TEX;
}

// ---------- sphere renderer ----------
// opts: kind 'earth'|'moon', size (diameter px), lat, lon (sub-viewer point), roll (deg),
// light [x,y,z] (view space, y up, z toward viewer), cloudLon (deg offset), amb
const cache = new Map(); let cacheBytes = 0;
function sphereCanvas(o) {
  const key = JSON.stringify([o.kind, Math.round(o.size), +(o.lat || 0).toFixed(2), +(o.lon || 0).toFixed(2), +(o.roll || 0).toFixed(1), (o.light || []).map((v) => +v.toFixed(3)), +(o.cloudLon || 0).toFixed(2), o.amb || 0]);
  if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
  const T = textures();
  const S = Math.max(4, Math.round(o.size)); const R = S / 2;
  const cv = createCanvas(S, S); const c = cv.getContext('2d');
  const img = c.createImageData(S, S); const d = img.data;
  const lat0 = (o.lat || 0) * D2R, lon0 = (o.lon || 0) * D2R, roll = (o.roll || 0) * D2R;
  const cL = Math.cos(lat0), sL = Math.sin(lat0), cO = Math.cos(lon0), sO = Math.sin(lon0), cR = Math.cos(roll), sR = Math.sin(roll);
  let [lx, ly, lz] = o.light || [-0.6, 0.3, 0.75]; const ln = Math.hypot(lx, ly, lz); lx /= ln; ly /= ln; lz /= ln;
  const hxv = lx, hyv = ly, hzv = lz + 1; const hn = Math.hypot(hxv, hyv, hzv);
  const isE = o.kind === 'earth'; const tex = isE ? T.earth : T.moon; const cl = T.clouds;
  const cOff = ((o.cloudLon || 0) / 360) * TW; const amb = o.amb ?? (isE ? 0.015 : 0.03);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      let x = (px + 0.5 - R) / R, y = (R - py - 0.5) / R; const d2 = x * x + y * y;
      const edge = (1 - Math.sqrt(d2)) * R; if (edge <= -0.5) continue;
      const z = Math.sqrt(Math.max(0, 1 - d2));
      // un-roll
      const xr = x * cR + y * sR, yr = -x * sR + y * cR;
      // Rx(-lat0)
      const y1 = yr * cL + z * sL, z1 = -yr * sL + z * cL;
      // Ry(lon0)
      const bx = xr * cO + z1 * sO, bz = -xr * sO + z1 * cO;
      const lat = Math.asin(clamp(y1, -1, 1)), lon = Math.atan2(bx, bz);
      const fu = ((lon / Math.PI + 1) / 2) * TW - 0.5, fv = (0.5 - lat / Math.PI) * TH - 0.5;
      const u0 = Math.floor(fu), v0 = Math.max(0, Math.min(TH - 2, Math.floor(fv))); const au = fu - u0, av = clamp(fv - v0);
      const ua = ((u0 % TW) + TW) % TW, ub = (ua + 1) % TW;
      const i00 = (v0 * TW + ua) * 4, i10 = (v0 * TW + ub) * 4, i01 = ((v0 + 1) * TW + ua) * 4, i11 = ((v0 + 1) * TW + ub) * 4;
      const bil = (k) => (tex[i00 + k] * (1 - au) + tex[i10 + k] * au) * (1 - av) + (tex[i01 + k] * (1 - au) + tex[i11 + k] * au) * av;
      let r = bil(0), g = bil(1), b = bil(2);
      const dot = x * lx + y * ly + z * lz;
      let shade;
      if (isE) {
        const ocean = bil(3) / 255;
        // clouds
        const cu = ((((fu + cOff) % TW) + TW) % TW) | 0; const cv2 = Math.round(fv); const ca = cl[Math.max(0, Math.min(TH - 1, cv2)) * TW + cu] / 255;
        r = r + (245 - r) * ca; g = g + (248 - g) * ca; b = b + (255 - b) * ca;
        shade = clamp((dot + 0.08) / 0.5) * (0.35 + 0.65 * clamp(dot)) ;
        shade = Math.pow(shade, 0.85);
        const nh = (x * hxv + y * hyv + z * hzv) / hn;
        const spec = ocean * (1 - ca) * Math.pow(Math.max(0, nh), 70) * 230 * clamp(dot * 3);
        // atmosphere tint towards the limb
        const rim = Math.pow(1 - z, 3.2); const rl = clamp(dot + 0.25);
        r = r * shade * (1 - rim * 0.5) + spec + rim * 70 * rl; g = g * shade * (1 - rim * 0.5) + spec + rim * 130 * rl; b = b * shade * (1 - rim * 0.5) + spec + rim * 255 * rl;
        r += amb * 255 * 0.2; g += amb * 255 * 0.3; b += amb * 255 * 0.6;
      } else {
        shade = clamp((dot + 0.02) / 0.14) * (0.25 + 0.75 * Math.pow(clamp(dot), 0.55));
        shade = shade + amb;
        r *= shade; g *= shade; b *= shade;
      }
      const k = (py * S + px) * 4;
      d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255 * clamp(edge + 0.5);
    }
  }
  c.putImageData(img, 0, 0);
  cache.set(key, cv); cacheBytes += S * S * 4;
  while ((cacheBytes > 6e8 || cache.size > 60) && cache.size > 1) { const k0 = cache.keys().next().value; const c0 = cache.get(k0); cacheBytes -= c0.width * c0.height * 4; cache.delete(k0); }
  return cv;
}
// draw a planet centred at (x,y) with radius r
function drawPlanet(ctx, x, y, r, o) {
  const cv = sphereCanvas({ ...o, size: r * 2 });
  ctx.drawImage(cv, x - cv.width / 2, y - cv.height / 2, cv.width, cv.height);
}
function atmosphereGlow(ctx, x, y, r, { color = [90, 170, 255], strength = 1, light = null } = {}) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const R2 = r * 1.25, g = ctx.createRadialGradient(x, y, 0, x, y, R2), k = r / R2;
  g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(k * 0.9, `rgba(${color},0)`); g.addColorStop(k * 0.995, `rgba(${color},${0.42 * strength})`);
  g.addColorStop(k * 1.03, `rgba(${color},${0.22 * strength})`); g.addColorStop(k * 1.1, `rgba(${color},${0.07 * strength})`); g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// project a lat/lon on a rendered sphere to screen coords (returns {x,y,vis})
function projectLL(cx, cy, r, o, lat, lon) {
  const p = sph(lat, lon); // body coords
  const lat0 = (o.lat || 0) * D2R, lon0 = (o.lon || 0) * D2R, roll = (o.roll || 0) * D2R;
  // inverse of Ry(lon0): rotate by -lon0
  const x1 = p[0] * Math.cos(-lon0) + p[2] * Math.sin(-lon0), z1 = -p[0] * Math.sin(-lon0) + p[2] * Math.cos(-lon0);
  // inverse of Rx(-lat0) = Rx(lat0)
  const y2 = p[1] * Math.cos(lat0) - z1 * Math.sin(lat0), z2 = p[1] * Math.sin(lat0) + z1 * Math.cos(lat0);
  // roll back
  const xs = x1 * Math.cos(roll) - y2 * Math.sin(roll), ys = x1 * Math.sin(roll) + y2 * Math.cos(roll);
  return { x: cx + xs * r, y: cy - ys * r, vis: z2 > 0, z: z2 };
}

module.exports = { textures, sphereCanvas, drawPlanet, atmosphereGlow, projectLL, fbm3, vnoise3 };
