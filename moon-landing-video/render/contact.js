// Contact sheet of stills: node contact.js out.png id@t,id@t,...  (cols=3)
const { execFileSync } = require('child_process');
const path = require('path'); const fs = require('fs');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
(async () => {
  const [out, list] = process.argv.slice(2);
  execFileSync('node', [path.join(__dirname, 'render.js'), '--stills', list, '--scale', '0.3333'], { stdio: 'inherit' });
  const items = list.split(','); const cols = 3, w = 640, h = 360;
  const cv = createCanvas(cols * w, Math.ceil(items.length / cols) * h); const c = cv.getContext('2d');
  for (let i = 0; i < items.length; i++) {
    const f = path.join(__dirname, '..', 'build', 'stills', `still_${items[i].replace(/[@.]/g, '_')}.png`);
    const img = await loadImage(fs.readFileSync(f)); c.drawImage(img, (i % cols) * w, Math.floor(i / cols) * h, w, h);
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect((i % cols) * w, Math.floor(i / cols) * h, 200, 26); c.fillStyle = '#0f0'; c.font = '18px Sans'; c.fillText(items[i], (i % cols) * w + 6, Math.floor(i / cols) * h + 19);
  }
  fs.writeFileSync(out, cv.toBuffer('image/png'));
})();
