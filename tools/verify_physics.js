#!/usr/bin/env node
// Numerical checks for the physics used in index.html (units G = c = M = 1).
//   node tools/verify_physics.js
// 1. Closed-form Page–Thorne flux of a Schwarzschild thin disk vs. direct numerical evaluation of the
//    Page–Thorne integral  F ∝ (-Ω_,r)/(E-ΩL)² ∫ (E-ΩL) L_,r dr.
// 2. Adaptive RK4 integration of the Binet equation u'' = -u + 3u² vs. a high-resolution reference.
// 3. Weak-field light deflection vs. the post-Newtonian series 4M/b + (15π/4) M²/b².
// 4. Shadow size: critical impact parameter b = 3√3 M from the integrator.
'use strict';
let failures = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); if (!ok) failures++; };

// ---------------------------------------------------------------- 1. Page–Thorne flux
const E = (r) => (1 - 2 / r) / Math.sqrt(1 - 3 / r);
const L = (r) => Math.sqrt(r) / Math.sqrt(1 - 3 / r);
const Om = (r) => Math.pow(r, -1.5);
const D = (f, r, h = 1e-5) => (f(r + h) - f(r - h)) / (2 * h);
function fluxNumeric(r, rin) {
  const n = 20000, h = (r - rin) / n;
  let s = 0;
  for (let i = 0; i < n; i++) { const x = rin + (i + 0.5) * h; s += (E(x) - Om(x) * L(x)) * D(L, x) * h; }
  return (1 / (4 * Math.PI * r)) * (-D(Om, r)) / Math.pow(E(r) - Om(r) * L(r), 2) * s;
}
function fluxClosed(r, rin) {   // identical to ntFlux() in the shader
  const x = Math.sqrt(r), x0 = Math.sqrt(rin), s3 = Math.sqrt(3);
  return (x - x0 + 0.5 * s3 * Math.log((x + s3) * (x0 - s3) / ((x0 + s3) * (x - s3)))) / (r * r * x * (r - 3));
}
for (const rin of [6, 9]) {
  const ratios = [rin + 0.3, rin + 2, 12, 20, 40].map((r) => fluxNumeric(r, rin) / fluxClosed(r, rin));
  const spread = (Math.max(...ratios) - Math.min(...ratios)) / ratios[0];
  check(`Page–Thorne closed form, r_in = ${rin}M`, spread < 1e-5, `ratio const to ${spread.toExponential(1)} (expected 3/8π = ${(3 / 8 / Math.PI).toFixed(6)}, got ${ratios[0].toFixed(6)})`);
}
let best = 0, rPeak = 0;
for (let r = 6.001; r < 30; r += 0.001) { const f = fluxClosed(r, 6); if (f > best) { best = f; rPeak = r; } }
check('flux peak radius ≈ 9.55M (r_in = ISCO)', Math.abs(rPeak - 9.55) < 0.01, `r_peak = ${rPeak.toFixed(3)}M`);

// ---------------------------------------------------------------- 2–4. geodesics
// Same scheme as the shader: RK4 in φ with Δφ = min(0.15, Δφ₀·5/(1+12u)); escape angle from the Hermite root.
function trace(r0, b, hfun, phiMax = 12 * Math.PI) {
  let u = 1 / r0, up = Math.sqrt(Math.max(0, 1 / (b * b) - u * u + 2 * u * u * u)), phi = 0, steps = 0;
  const F = (u, v) => [v, -u + 3 * u * u];
  while (phi < phiMax) {
    steps++;
    const h = hfun(u);
    const [a1, b1] = F(u, up), [a2, b2] = F(u + 0.5 * h * a1, up + 0.5 * h * b1);
    const [a3, b3] = F(u + 0.5 * h * a2, up + 0.5 * h * b2), [a4, b4] = F(u + h * a3, up + h * b3);
    const un = u + h / 6 * (a1 + 2 * a2 + 2 * a3 + a4), upn = up + h / 6 * (b1 + 2 * b2 + 2 * b3 + b4);
    if (un <= 0) {
      let t = u / (u - un);
      for (let k = 0; k < 3; k++) {
        const t2 = t * t, t3 = t2 * t;
        const H = (2 * t3 - 3 * t2 + 1) * u + (t3 - 2 * t2 + t) * h * up + (-2 * t3 + 3 * t2) * un + (t3 - t2) * h * upn;
        const dH = (6 * t2 - 6 * t) * u + (3 * t2 - 4 * t + 1) * h * up + (-6 * t2 + 6 * t) * un + (3 * t2 - 2 * t) * h * upn;
        t -= H / dH;
      }
      return { phi: phi + t * h, steps };
    }
    if (un >= 0.5 || (un > 1 / 3 && upn > 0)) return { phi: null, steps };   // captured
    u = un; up = upn; phi += h;
  }
  return { phi: null, steps };
}
const adaptive = (u) => Math.min(0.15, 0.05 * 5 / (1 + 12 * u));
const bc = 3 * Math.sqrt(3);
// one pixel at 1080p with a 55° FOV is ~1e-3 rad
for (const [label, dbs, tol] of [['primary-image rays, b ≥ 3√3M + 3M', [40, 20, 8, 3], 1.2e-5],
                                 ['near-critical rays, b ∈ [3√3M + 0.3M, 3√3M + 3M)', [2, 1, 0.3], 2e-4]]) {
  let worst = 0, stepsSum = 0, nRays = 0;
  for (const r0 of [10, 30, 100, 300]) for (const db of dbs) {
    const b = bc + db, ref = trace(r0, b, () => 1e-4), t = trace(r0, b, adaptive);
    if (ref.phi === null) continue;   // ray from a close camera cannot have this b
    worst = Math.max(worst, Math.abs(t.phi - ref.phi)); stepsSum += t.steps; nRays++;
  }
  check(`adaptive RK4 escape direction, ${label}`, worst <= tol, `max error ${worst.toExponential(2)} rad (< ${tol}), mean ${(stepsSum / nRays).toFixed(0)} steps/ray`);
}

for (const b of [200, 1000]) {
  const r0 = 1e7, t = trace(r0, b, () => 1e-3);
  const defl = t.phi - Math.PI + Math.asin(b / r0);
  const pn = 4 / b + (15 * Math.PI / 4) / (b * b);
  check(`weak-field deflection, b = ${b}M`, Math.abs(defl - pn) / pn < 2e-3, `δ = ${defl.toExponential(6)}, PN = ${pn.toExponential(6)}`);
}

const r0 = 1e4;
const escapes = (b) => trace(r0, b, (u) => Math.min(0.3, 0.01 * 5 / (1 + 12 * u)), 40 * Math.PI).phi !== null;
let lo = 4, hi = 6;
for (let i = 0; i < 40; i++) { const m = 0.5 * (lo + hi); if (escapes(m)) hi = m; else lo = m; }
check('critical impact parameter = 3√3 M', Math.abs(hi - bc) < 1e-3, `bisection → ${hi.toFixed(5)} (3√3 = ${bc.toFixed(5)})`);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
