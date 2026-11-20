#!/usr/bin/env node
/* Render frames of the stage with headless Chromium and pipe them to ffmpeg.
 *   node tools/render.js --from 0 --to 30 --out build/part.mp4      (seconds)
 *   node tools/render.js --still 12.5 --png build/still.png
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1]]]) : a), []));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/timeline.json'), 'utf8'));
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json'), 'utf8'));
  const mapsFile = path.join(ROOT, 'assets/maps.json');
  const maps = fs.existsSync(mapsFile) ? JSON.parse(fs.readFileSync(mapsFile, 'utf8')) : {};
  const fps = tl.fps;
  const still = args.still != null;
  const f0 = args.stills ? 0 : still ? Math.round(parseFloat(args.still) * fps) : Math.round(parseFloat(args.from || 0) * fps);
  const f1 = args.stills ? tl.frames : still ? f0 + 1 : Math.min(tl.frames, Math.round(parseFloat(args.to || tl.duration) * fps));

  const srv = await serve();
  const browser = await chromium.launch({ args: ['--disable-lcd-text', '--force-color-profile=srgb', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exitCode = 1; });
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/web/index.html`);
  const info = await page.evaluate(([a, b, c, r]) => window.init(a, b, c, r), [tl, man, maps, [f0 / fps, f1 / fps]]);
  const cdp = await page.context().newCDPSession(page);

  if (args.stills) {
    const dir = args.dir || path.join(ROOT, 'build/stills'); fs.mkdirSync(dir, { recursive: true });
    for (const ts of args.stills.split(',')) {
      await page.evaluate(t => window.renderAt(t), parseFloat(ts));
      await page.screenshot({ path: path.join(dir, `s_${parseFloat(ts).toFixed(2).padStart(7, '0')}.jpg`), type: 'jpeg', quality: 88 });
    }
  } else if (still) {
    await page.evaluate(t => window.renderAt(t), f0 / fps);
    await page.screenshot({ path: args.png || path.join(ROOT, 'build/still.png') });
  } else {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      '-g', String(fps * 2), args.out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = f0; f < f1; f++) {
      await page.evaluate(t => window.renderAt(t), f / fps);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
      if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - f0) % 300 === 299) console.error(`[${args.out}] ${f - f0 + 1}/${f1 - f0} frames, ${((Date.now() - t0) / (f - f0 + 1)).toFixed(0)} ms/frame`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.error(`[${args.out}] done: ${f1 - f0} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s (${info.shots} shots, ${info.images} images)`);
  }
  await browser.close();
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });
