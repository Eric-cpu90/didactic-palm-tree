#!/usr/bin/env node
// Renders the video frames with transitions + subtitles.
//   node render.js --cues                 write build/cues.json (sound-effect cue list)
//   node render.js --stills 12.5,40,...   write PNG stills to build/stills/
//   node render.js --part 0 --of 4        render a contiguous quarter to build/parts/part0.mp4
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const core = require('./lib/core');
const { W, H, FPS, ROOT, createCanvas, clamp, prog, ease, C } = core;
const { textures } = require('./lib/planet');
const { S1 } = require('./scenes1');
const { S2 } = require('./scenes2');
const { MAP_NODES } = require('./lib/ui');

const SCENES = { ...S1, ...S2 };
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'timeline.json'), 'utf8'));
const TR = TL.transition;
TL.scenes.forEach((s) => { s.dur = s.end - s.start; s.lines = s.lines.map((l) => ({ ...l, t0: l.t0 - s.start, t1: l.t1 - s.start, abs0: l.t0, abs1: l.t1 })); });
const ALL_LINES = TL.scenes.flatMap((s) => s.lines);

// transition used when entering scene i (from scene i-1)
const TRANS = {
  earthmoon: 'zoom', threesteps: 'wipe', timeline: 'slide', chapter1: 'flash', ce5stack: 'iris', ce5launch: 'wipe',
  ce5loi: 'slide', ce5sep: 'slide', ce5descent: 'wipe', ce5sample: 'slide', ce5ascent: 'slide', ce5dock: 'slide', ce5return: 'slide',
  chapter2: 'flash', hardware: 'iris', progress: 'slide', crewmap: 'zoom', crew1: 'zoomin', crew2: 'slide', crew3: 'slide',
  crew4: 'slide', crew5: 'wipe', crew6: 'slide', crew7: 'slide', crew8: 'slide', crew9: 'slide', crewrecap: 'zoom', future: 'wipe', ending: 'fade',
};

const cvA = createCanvas(W, H), cvB = createCanvas(W, H);
const ctxA = cvA.getContext('2d'), ctxB = cvB.getContext('2d');

function drawScene(ctx, sc, T) {
  const def = SCENES[sc.id]; if (!def) throw new Error('missing scene ' + sc.id);
  ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  def.draw(ctx, clamp(T - sc.start, 0, sc.dur), sc);
  ctx.restore();
}
function composite(ctx, type, p, A, B, focus) {
  const e = ease.inOut(p);
  ctx.save();
  switch (type) {
    case 'fade': ctx.drawImage(A, 0, 0); ctx.globalAlpha = e; ctx.drawImage(B, 0, 0); break;
    case 'zoom': {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const sa = 1 + 0.5 * e; ctx.globalAlpha = 1 - e; ctx.drawImage(A, W / 2 - (W * sa) / 2, H / 2 - (H * sa) / 2, W * sa, H * sa);
      const sb = 0.82 + 0.18 * e; ctx.globalAlpha = e; ctx.drawImage(B, W / 2 - (W * sb) / 2, H / 2 - (H * sb) / 2, W * sb, H * sb);
      ctx.globalAlpha = 0.35 * Math.sin(Math.PI * p); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6); g.addColorStop(0, 'rgba(200,220,255,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'zoomin': {
      const [fx, fy] = focus || [W / 2, H / 2]; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const sa = 1 + 5 * ease.in(p); ctx.globalAlpha = 1 - e; ctx.drawImage(A, fx - fx * sa, fy - fy * sa, W * sa, H * sa);
      const sb = 0.9 + 0.1 * e; ctx.globalAlpha = e; ctx.drawImage(B, W / 2 - (W * sb) / 2, H / 2 - (H * sb) / 2, W * sb, H * sb);
      break;
    }
    case 'slide': {
      const off = W * e; ctx.drawImage(A, -off * 0.35, 0); ctx.fillStyle = `rgba(0,0,0,${0.5 * e})`; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 60; ctx.drawImage(B, W - off, 0); ctx.restore();
      ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(W - off - 40, 0, W - off + 6, 0); g.addColorStop(0, 'rgba(245,198,107,0)'); g.addColorStop(1, `rgba(245,198,107,${0.6 * Math.sin(Math.PI * p)})`); ctx.fillStyle = g; ctx.fillRect(W - off - 40, 0, 46, H);
      break;
    }
    case 'wipe': {
      ctx.drawImage(A, 0, 0);
      const k = 400, x = lerpN(-k, W + k, e);
      ctx.save(); ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(x + k / 2, -10); ctx.lineTo(x - k / 2, H + 10); ctx.lineTo(-10, H + 10); ctx.closePath(); ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,215,140,${0.9 * Math.sin(Math.PI * p)})`; ctx.lineWidth = 6; ctx.shadowColor = C.gold; ctx.shadowBlur = 40;
      ctx.beginPath(); ctx.moveTo(x + k / 2, -10); ctx.lineTo(x - k / 2, H + 10); ctx.stroke();
      break;
    }
    case 'iris': {
      ctx.drawImage(A, 0, 0); ctx.fillStyle = `rgba(0,0,0,${0.4 * e})`; ctx.fillRect(0, 0, W, H);
      const r = Math.hypot(W, H) * 0.55 * ease.in(p) + 1;
      ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(160,220,255,${0.8 * Math.sin(Math.PI * p)})`; ctx.lineWidth = 5; ctx.shadowColor = C.cyan; ctx.shadowBlur = 40; ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'flash': {
      ctx.drawImage(p < 0.5 ? A : B, 0, 0);
      ctx.globalAlpha = 1 - Math.abs(2 * p - 1); ctx.fillStyle = '#fff8ec'; ctx.fillRect(0, 0, W, H);
      break;
    }
    default: ctx.drawImage(B, 0, 0);
  }
  ctx.restore();
}
function lerpN(a, b, t) { return a + (b - a) * t; }

function renderFrame(ctx, T) {
  const act = TL.scenes.filter((s) => T >= s.start && T < s.end);
  if (act.length === 0) act.push(TL.scenes[TL.scenes.length - 1]);
  if (act.length === 1) drawScene(ctx, act[0], T);
  else {
    const [a, b] = act; drawScene(ctxA, a, T); drawScene(ctxB, b, T);
    const p = clamp((T - b.start) / TR);
    let focus = null; if (TRANS[b.id] === 'zoomin') focus = MAP_NODES()[0].p;
    composite(ctx, TRANS[b.id] || 'fade', p, cvA, cvB, focus);
  }
  // subtitles
  let best = null, ba = 0;
  for (const l of ALL_LINES) { const a = Math.min(prog(T, l.abs0 - 0.15, l.abs0 + 0.1), 1 - prog(T, l.abs1 + 0.1, l.abs1 + 0.35)); if (a > ba) { ba = a; best = l; } }
  if (best) core.drawSubtitle(ctx, best.s, ba);
  // progress bar
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, H - 4, W, 4);
  ctx.fillStyle = 'rgba(245,198,107,0.75)'; ctx.fillRect(0, H - 4, W * (T / TL.duration), 4);
  // global fades
  const fin = 1 - prog(T, 0, 0.8), fout = prog(T, TL.duration - 1.8, TL.duration - 0.1);
  const k = Math.max(fin, fout); if (k > 0) { ctx.fillStyle = `rgba(0,0,0,${k})`; ctx.fillRect(0, 0, W, H); }
}

async function main() {
  const args = process.argv.slice(2); const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
  if (args.includes('--prep')) { textures(); return; }
  if (args.includes('--cues')) {
    const cues = []; for (const s of TL.scenes) { const def = SCENES[s.id]; if (def.cues) for (const c of def.cues(s)) cues.push({ t: +(s.start + c[0]).toFixed(3), type: c[1], dur: c[2] || 0 }); }
    for (const s of TL.scenes.slice(1)) cues.push({ t: s.start, type: 'trans_' + (TRANS[s.id] || 'fade'), dur: TR });
    cues.sort((a, b) => a.t - b.t);
    fs.writeFileSync(path.join(ROOT, 'build', 'cues.json'), JSON.stringify({ duration: TL.duration, cues, scenes: TL.scenes.map((s) => ({ id: s.id, start: s.start, end: s.end, lines: s.lines.map((l) => [l.abs0, l.abs1]) })) }, null, 1));
    console.log(`cues: ${cues.length}`); return;
  }
  const main = createCanvas(W, H); const ctx = main.getContext('2d');
  if (args.includes('--stills')) {
    const out = path.join(ROOT, 'build', 'stills'); fs.mkdirSync(out, { recursive: true });
    const scale = +(arg('scale', '0.5'));
    for (const ts of arg('stills').split(',')) {
      let T; if (/^[a-z0-9]+@/.test(ts)) { const [id, off] = ts.split('@'); const s = TL.scenes.find((x) => x.id === id); T = s.start + +off; } else T = +ts;
      const t0 = Date.now(); renderFrame(ctx, T);
      const sm = createCanvas(Math.round(W * scale), Math.round(H * scale)); sm.getContext('2d').drawImage(main, 0, 0, sm.width, sm.height);
      const f = path.join(out, `still_${ts.replace(/[@.]/g, '_')}.png`); fs.writeFileSync(f, sm.toBuffer('image/png'));
      console.log(`${f} T=${T.toFixed(2)} ${Date.now() - t0}ms`);
    }
    return;
  }
  const part = +arg('part', '0'), of = +arg('of', '1');
  const N = Math.ceil(TL.duration * FPS); const per = Math.ceil(N / of); const f0 = part * per, f1 = Math.min(N, f0 + per);
  const outDir = path.join(ROOT, 'build', 'parts'); fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `part${part}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', arg('preset', 'medium'), '-crf', arg('crf', '20'), '-tune', 'animation', '-pix_fmt', 'yuv420p', '-threads', arg('threads', '2'), '-g', '60', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    renderFrame(ctx, f / FPS);
    const buf = Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - f0) % 150 === 0) { const el = (Date.now() - t0) / 1000; const done = f - f0 + 1; console.log(`[part ${part}] ${done}/${f1 - f0} frames, ${(done / el).toFixed(1)} fps, eta ${(((f1 - f0 - done) / done) * el / 60).toFixed(1)} min`); }
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  console.log(`[part ${part}] done in ${((Date.now() - t0) / 60000).toFixed(1)} min -> ${out}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
