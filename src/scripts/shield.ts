// Code-drawn scroll scene: a glass padlock cracks, shatters and re-forms as a
// shield. Everything is a function of scroll progress p (0..1), so scrubbing
// up and down always shows the frame that belongs to that position.
//
//   0.00 – 0.30  detect   the lock turns from ice to red and cracks spread from the keyhole
//   0.30 – 0.56  triage   it shatters; fragments fly out and fall to the floor
//   0.50 – 0.86  contain  the fragments swirl together into a shield
//   0.86 – 1.00  secured  the shield and the floor settle into blue
//
// Reference: two Pinterest motion pins (cracked padlock → shield, red → blue).
// No video, no images: particles, vector shapes and a perspective circuit floor.
import { motionOff } from './motion';
import { A, R, F } from './palette';

type RGB = [number, number, number];
const toRgb = (s: string): RGB => { const [r, g, b] = s.split(',').map(Number); return [r, g, b]; };
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

const ACC = toRgb(A);
const ALR = toRgb(R);
const ICE = mix(toRgb(F), ACC, 0.28);
const RED_ICE = mix(ICE, ALR, 0.82);

const TAU = Math.PI * 2;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eo3 = (t: number) => 1 - Math.pow(1 - t, 3);
const eio3 = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Shapes, in "units" (1 unit ≈ 1 px at scale 1). Origin = middle of the lock body.
const T0 = 0.30, T1 = 0.56;   // shatter window
const FLOOR_U = 150;          // lock bottom / floor line, in units
const HOVER = 36;             // the shield floats this far above where the lock stood

const bodyPath = (g: CanvasRenderingContext2D) => { g.beginPath(); g.roundRect(-110, -20, 220, 170, 18); };
const shacklePath = (g: CanvasRenderingContext2D) => {
  g.beginPath(); g.moveTo(-63, -20); g.lineTo(-63, -60); g.arc(0, -60, 63, Math.PI, 0); g.lineTo(63, -20);
};
const keyholePath = (g: CanvasRenderingContext2D) => {
  g.beginPath(); g.arc(0, 48, 18, 0, TAU); g.moveTo(-9, 58); g.lineTo(9, 58); g.lineTo(15, 104); g.lineTo(-15, 104); g.closePath();
};
const shieldPath = (g: CanvasRenderingContext2D) => {
  g.beginPath();
  g.moveTo(0, -150);
  g.bezierCurveTo(55, -122, 100, -112, 130, -112);
  g.lineTo(130, 20);
  g.bezierCurveTo(130, 92, 72, 138, 0, 162);
  g.bezierCurveTo(-72, 138, -130, 92, -130, 20);
  g.lineTo(-130, -112);
  g.bezierCurveTo(-100, -112, -55, -122, 0, -150);
  g.closePath();
};
// Small padlock inside the shield.
const glyphBody = (g: CanvasRenderingContext2D) => { g.beginPath(); g.roundRect(-32, -2, 64, 52, 8); };
const glyphShackle = (g: CanvasRenderingContext2D) => {
  g.beginPath(); g.moveTo(-19, -2); g.lineTo(-19, -26); g.arc(0, -26, 19, Math.PI, 0); g.lineTo(19, -2);
};
const glyphKey = (g: CanvasRenderingContext2D) => { g.beginPath(); g.arc(0, 20, 6, 0, TAU); g.moveTo(-3, 24); g.lineTo(3, 24); g.lineTo(5, 38); g.lineTo(-5, 38); g.closePath(); };

function sampleShape(w: number, h: number, cx: number, cy: number, stride: number, rand: () => number, paint: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.translate(cx, cy);
  g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  paint(g);
  const d = g.getImageData(0, 0, w, h).data;
  const out: [number, number][] = [];
  for (let y = 0; y < h; y += stride)
    for (let x = 0; x < w; x += stride)
      if (d[(y * w + x) * 4 + 3] > 128) out.push([x - cx + (rand() - 0.5) * stride, y - cy + (rand() - 0.5) * stride]);
  return out;
}

export function shieldScene(canvas: HTMLCanvasElement, host: HTMLElement, getProgress: () => number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const g = ctx;

  // ---- Static geometry (built once)
  const rand = rng(11);
  const lockPts = sampleShape(300, 340, 150, 170, 2, rand, (c) => {
    bodyPath(c); c.fill();
    shacklePath(c); c.lineWidth = 30; c.stroke();
    c.globalCompositeOperation = 'destination-out'; keyholePath(c); c.fill();
  });
  const edgePts = sampleShape(340, 360, 170, 180, 1, rand, (c) => {
    shieldPath(c); c.lineWidth = 13; c.lineJoin = 'round'; c.stroke();
    glyphShackle(c); c.lineWidth = 8; c.stroke();
    glyphBody(c); c.fill();
  });
  const fillPts = sampleShape(340, 360, 170, 180, 3, rand, (c) => { shieldPath(c); c.fill(); });

  // Cracks spread from the keyhole across the lock body.
  type Crack = { pts: [number, number][]; len: number[]; total: number };
  const cracks: Crack[] = [];
  const inBody = (x: number, y: number) => x > -104 && x < 104 && y > -14 && y < 144;
  const grow = (x: number, y: number, a: number, steps: number): [number, number][] => {
    const pts: [number, number][] = [[x, y]];
    for (let s = 0; s < steps; s++) {
      a += (rand() - 0.5) * 0.9;
      const l = 14 + rand() * 20;
      x += Math.cos(a) * l; y += Math.sin(a) * l;
      if (!inBody(x, y)) break;
      pts.push([x, y]);
    }
    return pts;
  };
  const addCrack = (pts: [number, number][]) => {
    if (pts.length < 2) return;
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    cracks.push({ pts, len, total: len[len.length - 1] });
  };
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * TAU + rand() * 0.4;
    const main = grow(0, 48, a, 6 + ((rand() * 4) | 0));
    addCrack(main);
    for (let b = 0; b < 2; b++) {
      const at = main[1 + ((rand() * (main.length - 1)) | 0)];
      if (at) addCrack(grow(at[0], at[1], a + (rand() - 0.5) * 2, 3 + ((rand() * 3) | 0)));
    }
  }

  // Floor: random circuit traces on the ground plane (X sideways, Z into the screen).
  type Trace = { pts: [number, number][]; z: number; pulse: boolean; speed: number; off: number; len: number[]; total: number };
  const traces: Trace[] = [];
  for (let k = 0; k < 84; k++) {
    let x = (rand() - 0.5) * 12, z = 1 + rand() * 12;
    const pts: [number, number][] = [[x, z]];
    let horiz = rand() < 0.5;
    const segs = 5 + ((rand() * 5) | 0);
    for (let s = 0; s < segs; s++) {
      const l = 0.5 + rand() * 2;
      const dir = rand() < 0.5 ? -1 : 1;
      if (horiz) x += dir * l; else z = Math.max(1, Math.min(15, z + dir * l * 1.4));
      pts.push([x, z]);
      if (rand() < 0.35) { // 45° chamfer
        const c = 0.3 + rand() * 0.3;
        if (horiz) { x += dir * c; z += c * (rand() < 0.5 ? -1 : 1); } else { z += dir * c; x += c * (rand() < 0.5 ? -1 : 1); }
        z = Math.max(1, Math.min(15, z));
        pts.push([x, z]);
      }
      horiz = !horiz;
    }
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    traces.push({
      pts, len, total: len[len.length - 1] || 1,
      z: pts.reduce((a, q) => a + q[1], 0) / pts.length,
      pulse: rand() < 0.22, speed: 0.04 + rand() * 0.06, off: rand(),
    });
  }

  // Glass shards that fly out when the lock breaks.
  const shards = Array.from({ length: 36 }, () => {
    const c = lockPts[(rand() * lockPts.length) | 0];
    const size = 12 + rand() * 30;
    const a = Math.atan2(c[1] - 40, c[0]) + (rand() - 0.5) * 0.9;
    const sp = 0.4 + rand() * 1.1;
    return {
      x: c[0], y: c[1], size, rot: rand() * TAU, spin: (rand() - 0.5) * 9,
      v: [rand() - 0.5, rand() - 0.5, rand() - 0.5, rand() - 0.5, rand() - 0.5, rand() - 0.5],
      dx: Math.cos(a) * 190 * sp, dy: Math.sin(a) * 140 * sp - 30, gd: 150 + rand() * 150, fl: FLOOR_U + (rand() - 0.5) * 24,
    };
  });

  const streaks = Array.from({ length: 7 }, () => ({ y: rand(), len: 120 + rand() * 260, v: 30 + rand() * 60, o: rand() }));

  // ---- Particles (built when the first size is known, rebuilt if quality drops)
  let n = 0;
  let LX: Float32Array, LY: Float32Array, SX: Float32Array, SY: Float32Array, DX: Float32Array, DY: Float32Array,
    GD: Float32Array, FL: Float32Array, RS: Float32Array, SZ: Float32Array, PH: Float32Array, SW: Float32Array;
  function makeParticles(count: number) {
    n = count;
    const f = () => new Float32Array(n);
    LX = f(); LY = f(); SX = f(); SY = f(); DX = f(); DY = f(); GD = f(); FL = f(); RS = f(); SZ = f(); PH = f(); SW = f();
    const r = rng(23);
    for (let i = 0; i < n; i++) {
      const l = lockPts[(r() * lockPts.length) | 0];
      const s = i < n * 0.74 ? edgePts[(r() * edgePts.length) | 0] : fillPts[(r() * fillPts.length) | 0];
      LX[i] = l[0]; LY[i] = l[1];
      SX[i] = s[0]; SY[i] = s[1] - HOVER;
      const a = Math.atan2(l[1] - 40, l[0]) + (r() - 0.5) * 1.1;
      const sp = 0.35 + r() * 1.25;
      DX[i] = Math.cos(a) * 190 * sp;
      DY[i] = Math.sin(a) * 140 * sp - 40 * r();
      GD[i] = 170 + r() * 190;
      FL[i] = FLOOR_U + (r() - 0.5) * 30;
      RS[i] = 0.5 + r() * 0.13;
      SZ[i] = 1 + r() * 1.6;
      PH[i] = r() * TAU;
      SW[i] = (r() - 0.5) * 2;
    }
  }

  // ---- Layout
  let W = 0, H = 0, sc = 1, ox = 0, oy = 0, floorY = 0, horizonY = 0, z0 = 1, pad = 0;
  let quality = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4 ? 0.6 : 1;
  let lowFx = false;
  function layout() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(5e6 / (W * H)));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const portrait = H > W * 1.1;
    sc = Math.min((H * (portrait ? 0.34 : 0.46)) / 300, (W * 0.62) / 260);
    ox = W / 2;
    floorY = H * (portrait ? 0.7 : 0.74);
    oy = floorY - FLOOR_U * sc;
    horizonY = H * 0.3;
    z0 = (H - horizonY) / (floorY - horizonY);
    pad = 200 * sc;
    const count = Math.round((W < 760 ? 1500 : 2800) * quality);
    if (count !== n) makeParticles(count);
  }
  const project = (X: number, Z: number): [number, number] => [ox + (X * W * 0.3) / Z, horizonY + (H - horizonY) / Z];

  // ---- One frame
  function draw(p: number, t: number) {
    if (!W || !n) return;
    g.clearRect(0, 0, W, H);
    const th = smooth(0, 0.3, p);               // how red the lock is
    const floorMix = smooth(0.5, 0.88, p);       // floor and ring: red → blue
    const floorCol = mix(ALR, ACC, floorMix);
    const amp = smooth(0.08, 0.3, p) * (p < T0 ? 2.4 : 0);
    const jx = Math.sin(t * 61) * amp, jy = Math.cos(t * 53) * amp;
    const cy = oy + 6 * sc;                      // visual centre of the object

    // Ambient glow behind the object
    const amb = g.createRadialGradient(ox, cy, 0, ox, cy, 460 * sc);
    amb.addColorStop(0, css(floorCol, 0.2));
    amb.addColorStop(1, css(floorCol, 0));
    g.fillStyle = amb; g.fillRect(0, 0, W, H);

    // Circuit floor
    g.lineWidth = 1;
    g.lineJoin = 'round';
    for (const tr of traces) {
      g.beginPath();
      tr.pts.forEach(([X, Z], i) => { const [sx, sy] = project(X, Z); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); });
      g.strokeStyle = css(floorCol, Math.min(0.55, 0.1 + 0.6 / tr.z));
      g.stroke();
    }
    for (const tr of traces) {
      if (!tr.pulse) continue;
      const d = (((t * tr.speed + tr.off) % 1) + 1) % 1 * tr.total;
      let i = 1;
      while (i < tr.len.length - 1 && tr.len[i] < d) i++;
      const k = (d - tr.len[i - 1]) / Math.max(0.0001, tr.len[i] - tr.len[i - 1]);
      const [sx, sy] = project(tr.pts[i - 1][0] + (tr.pts[i][0] - tr.pts[i - 1][0]) * k, tr.pts[i - 1][1] + (tr.pts[i][1] - tr.pts[i - 1][1]) * k);
      g.fillStyle = css(mix(floorCol, [255, 255, 255], 0.5), 0.9);
      g.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      g.fillStyle = css(floorCol, 0.18);
      g.fillRect(sx - 5, sy - 5, 10, 10);
    }

    // Pad rings under the object, with a shockwave when the lock breaks
    const ry = 0.2;
    g.setLineDash([]);
    g.strokeStyle = css(floorCol, 0.95); g.lineWidth = 2;
    g.beginPath(); g.ellipse(ox, floorY, pad, pad * ry, 0, 0, TAU); g.stroke();
    g.strokeStyle = css(floorCol, 0.5); g.lineWidth = 1;
    g.beginPath(); g.ellipse(ox, floorY, pad * 0.7, pad * 0.7 * ry, 0, 0, TAU); g.stroke();
    g.setLineDash([3, 9]); g.lineDashOffset = -t * 14; g.strokeStyle = css(floorCol, 0.4);
    g.beginPath(); g.ellipse(ox, floorY, pad * 1.22, pad * 1.22 * ry, 0, 0, TAU); g.stroke();
    g.setLineDash([]);
    if (p > T0 - 0.01 && p < 0.5) {
      const k = clamp01((p - (T0 - 0.01)) / 0.2);
      g.strokeStyle = css(mix(ALR, [255, 255, 255], 0.35), (1 - k) * 0.8); g.lineWidth = 2;
      g.beginPath(); g.ellipse(ox, floorY, pad * (0.9 + k * 2.2), pad * (0.9 + k * 2.2) * ry, 0, 0, TAU); g.stroke();
    }
    const padGlow = g.createRadialGradient(ox, floorY, 0, ox, floorY, pad * 1.1);
    padGlow.addColorStop(0, css(floorCol, 0.22)); padGlow.addColorStop(1, css(floorCol, 0));
    g.save(); g.translate(0, floorY); g.scale(1, ry); g.translate(0, -floorY);
    g.fillStyle = padGlow; g.fillRect(ox - pad * 1.2, floorY - pad * 1.2, pad * 2.4, pad * 2.4); g.restore();

    // Particles → colour buckets
    const BUCKETS = 9;
    const bucketCol: RGB[] = Array.from({ length: BUCKETS }, (_, k) => {
      const m = k / (BUCKETS - 1);
      return m < 0.5 ? mix(ICE, RED_ICE, m / 0.5) : mix(RED_ICE, ACC, (m - 0.5) / 0.5);
    });
    const paths = bucketCol.map(() => new Path2D());
    const PI = Math.PI;
    for (let i = 0; i < n; i++) {
      const pe = Math.min(p, RS[i]);
      const gt = clamp01((pe - T0) / (T1 - T0));
      const ts = eo3(gt);
      let x = LX[i] + DX[i] * ts, y = LY[i] + DY[i] * ts + GD[i] * gt * gt;
      if (y > FL[i]) y = FL[i];
      if (p < T0) { x += jx + Math.sin(t * 40 + PH[i]) * amp * 0.6; y += jy + Math.cos(t * 37 + PH[i] * 1.3) * amp * 0.6; }
      const u = clamp01((p - RS[i]) / 0.24);
      let m = th * 0.5;
      if (u > 0) {
        const e = eio3(u);
        const dx = SX[i] - x, dy = SY[i] - y, len = Math.hypot(dx, dy) || 1;
        const sw = Math.sin(PI * e) * SW[i] * 70;
        x += dx * e - (dy / len) * sw;
        y += dy * e + (dx / len) * sw;
        if (u >= 1) { x += Math.sin(t * 1.8 + PH[i]) * 0.9; y += Math.cos(t * 1.5 + PH[i]) * 0.9; }
        m = 0.5 + 0.5 * e;
      } else if (p >= T0) m = 0.5;
      const s = Math.max(1.1, SZ[i] * sc * 0.85);
      paths[Math.min(BUCKETS - 1, (m * BUCKETS) | 0)].rect(ox + x * sc, oy + y * sc, s, s);
    }
    const coreAlpha = p < T0 ? 0.42 : 1;

    // Reflection on the floor
    if (!lowFx) {
      g.save();
      g.translate(0, 2 * floorY); g.scale(1, -1);
      g.globalAlpha = 0.13;
      bucketCol.forEach((c, k) => { g.fillStyle = css(c); g.fill(paths[k]); });
      g.restore();
    }

    // Lock (solid glass) until it breaks
    const lockA = 1 - smooth(T0, T0 + 0.035, p);
    if (lockA > 0.01) {
      g.save();
      g.translate(ox + jx * sc, oy + jy * sc); g.scale(sc, sc);
      g.globalAlpha = lockA;
      const edge = mix(ICE, ALR, th * 0.75);
      const glass = g.createLinearGradient(0, -20, 0, 150);
      glass.addColorStop(0, css(mix(ICE, ALR, th * 0.3), 0.26));
      glass.addColorStop(1, css(mix(ACC, ALR, th * 0.5), 0.1));
      bodyPath(g); g.fillStyle = glass; g.fill();
      g.lineWidth = 2; g.strokeStyle = css(edge, 0.9); g.stroke();
      // sheen
      g.beginPath(); g.moveTo(-96, -12); g.lineTo(-40, -12); g.lineTo(-96, 70); g.closePath();
      g.fillStyle = css(ICE, 0.07); g.fill();
      // shackle: bright outer tube with a dark core
      shacklePath(g); g.lineWidth = 30; g.strokeStyle = css(edge, 0.55); g.stroke();
      shacklePath(g); g.lineWidth = 24; g.strokeStyle = 'rgba(2,6,14,.92)'; g.stroke();
      shacklePath(g); g.lineWidth = 3; g.strokeStyle = css(ICE, 0.5); g.translate(-7, -2); g.stroke(); g.translate(7, 2);
      // keyhole with a red breach glow
      const kg = g.createRadialGradient(0, 56, 0, 0, 56, 90);
      kg.addColorStop(0, css(ALR, th * 0.75)); kg.addColorStop(1, css(ALR, 0));
      g.fillStyle = kg; g.fillRect(-100, -20, 200, 170);
      keyholePath(g); g.fillStyle = 'rgba(2,6,14,.95)'; g.fill();
      g.lineWidth = 2; g.strokeStyle = css(mix(ICE, ALR, th), 0.9); g.stroke();
      // cracks
      const grown = smooth(0.03, 0.3, p);
      if (grown > 0) {
        g.lineCap = 'round';
        for (const pass of [0, 1]) {
          g.lineWidth = pass ? 1.3 : 5;
          g.strokeStyle = pass ? 'rgba(255,255,255,.95)' : css(ALR, 0.3);
          for (const c of cracks) {
            const upTo = c.total * grown;
            g.beginPath();
            g.moveTo(c.pts[0][0], c.pts[0][1]);
            for (let i = 1; i < c.pts.length; i++) {
              if (c.len[i] <= upTo) g.lineTo(c.pts[i][0], c.pts[i][1]);
              else {
                const k = (upTo - c.len[i - 1]) / (c.len[i] - c.len[i - 1]);
                if (k > 0) g.lineTo(c.pts[i - 1][0] + (c.pts[i][0] - c.pts[i - 1][0]) * k, c.pts[i - 1][1] + (c.pts[i][1] - c.pts[i - 1][1]) * k);
                break;
              }
            }
            g.stroke();
          }
        }
      }
      g.restore();
    }

    // Glass shards
    if (p > T0 && p < 0.6) {
      const gt = clamp01((p - T0) / (T1 - T0));
      const a = smooth(0.6, 0.44, p) * smooth(T0, T0 + 0.01, p);
      g.lineJoin = 'miter';
      for (const sh of shards) {
        const ts = eo3(gt);
        let x = sh.x + sh.dx * ts, y = sh.y + sh.dy * ts + sh.gd * gt * gt;
        if (y > sh.fl) y = sh.fl;
        g.save();
        g.translate(ox + x * sc, oy + y * sc);
        g.rotate(sh.rot + sh.spin * gt);
        g.scale(sc, sc);
        g.beginPath();
        g.moveTo(sh.v[0] * sh.size, sh.v[1] * sh.size - sh.size * 0.7);
        g.lineTo(sh.size * 0.6 + sh.v[2] * 8, sh.size * 0.5 + sh.v[3] * 8);
        g.lineTo(-sh.size * 0.6 + sh.v[4] * 8, sh.size * 0.4 + sh.v[5] * 8);
        g.closePath();
        g.fillStyle = css(mix(ICE, ALR, 0.35), 0.12 * a);
        g.fill();
        g.lineWidth = 1.2; g.strokeStyle = css(mix(ICE, ALR, 0.2), 0.75 * a);
        g.stroke();
        g.restore();
      }
    }

    // Particles on top (additive, so dense areas glow)
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineJoin = 'round';
    bucketCol.forEach((c, k) => {
      g.globalAlpha = coreAlpha;
      g.fillStyle = css(c); g.fill(paths[k]);
      if (!lowFx) { g.globalAlpha = coreAlpha * 0.09; g.lineWidth = 5; g.strokeStyle = css(c); g.stroke(paths[k]); }
    });
    g.restore();

    // Flash when it breaks
    const fl = p > 0.28 && p < 0.4 ? (p < 0.31 ? (p - 0.28) / 0.03 : (0.4 - p) / 0.09) : 0;
    if (fl > 0) {
      const fg = g.createRadialGradient(ox, cy, 0, ox, cy, 300 * sc);
      fg.addColorStop(0, `rgba(255,255,255,${0.5 * fl})`);
      fg.addColorStop(0.35, css(mix(ALR, ICE, 0.4), 0.28 * fl));
      fg.addColorStop(1, css(ALR, 0));
      g.fillStyle = fg; g.fillRect(0, 0, W, H);
    }

    // Shield (solid) once it has formed
    const sv = smooth(0.8, 0.97, p);
    if (sv > 0.01) {
      g.save();
      g.translate(ox, oy + -HOVER * sc + Math.sin(t * 1.6) * 2 * sc); g.scale(sc, sc);
      g.globalAlpha = sv;
      const fill = g.createLinearGradient(0, -150, 0, 162);
      fill.addColorStop(0, css(ACC, 0.2)); fill.addColorStop(1, css(ACC, 0.04));
      shieldPath(g); g.fillStyle = fill; g.fill();
      g.lineJoin = 'round';
      for (const [w, a] of [[22, 0.05], [12, 0.1], [5, 0.95]] as const) {
        shieldPath(g); g.lineWidth = w; g.strokeStyle = css(mix(ACC, [255, 255, 255], w === 5 ? 0.35 : 0), a); g.stroke();
      }
      // padlock glyph
      glyphShackle(g); g.lineWidth = 7; g.strokeStyle = css(mix(ACC, [255, 255, 255], 0.3), 0.95); g.stroke();
      glyphBody(g); g.fillStyle = css(ACC, 0.18); g.fill(); g.lineWidth = 4; g.stroke();
      glyphKey(g); g.fillStyle = css(mix(ACC, [255, 255, 255], 0.5), 0.95); g.fill();
      g.restore();

      // ring of ticks around the shield
      const ring = smooth(0.88, 1, p);
      if (ring > 0) {
        g.save();
        g.translate(ox, cy - HOVER * sc); g.rotate(t * 0.08);
        g.strokeStyle = css(ACC, 0.55 * ring); g.lineWidth = 1.2;
        const R0 = 205 * sc;
        g.beginPath();
        for (let i = 0; i < 90; i++) {
          const a = (i / 90) * TAU, l = (i % 5 === 0 ? 14 : 6) * sc;
          g.moveTo(Math.cos(a) * R0, Math.sin(a) * R0);
          g.lineTo(Math.cos(a) * (R0 + l), Math.sin(a) * (R0 + l));
        }
        g.stroke();
        g.restore();
      }
    }

    // Light streaks once everything is secure
    const stv = smooth(0.72, 0.95, p);
    if (stv > 0.01) {
      for (const s of streaks) {
        const x = (((t * s.v + s.o * (W + s.len)) % (W + s.len)) + (W + s.len)) % (W + s.len) - s.len;
        const y = H * (0.18 + s.y * 0.6);
        const lg = g.createLinearGradient(x, 0, x + s.len, 0);
        lg.addColorStop(0, css(ACC, 0)); lg.addColorStop(1, css(ACC, 0.32 * stv));
        g.fillStyle = lg; g.fillRect(x, y, s.len, 2);
      }
    }
  }

  // ---- Loop
  let visible = true, cur = 0, last = performance.now(), t = 0, frames = 0, slow = 0, started = false, paintedStatic = false;
  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden || !W) return;
    if (motionOff()) {
      if (!paintedStatic) { draw(1, 0); paintedStatic = true; }
      return;
    }
    paintedStatic = false;
    t += dt;
    const target = getProgress();
    cur += (target - cur) * Math.min(1, dt * 9);
    if (Math.abs(target - cur) < 0.0004) cur = target;
    draw(cur, t);
    // Below ~42 fps for the first 90 frames: drop the reflection and halos.
    if (!lowFx && frames < 90 && t > 1) { frames++; slow += dt; if (frames === 90 && slow / 90 > 1 / 42) lowFx = true; }
  }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '10% 0px' }).observe(host);
  let rt = 0;
  new ResizeObserver(() => {
    if (!started) return;
    clearTimeout(rt);
    rt = window.setTimeout(() => { layout(); paintedStatic = false; }, 120);
  }).observe(canvas);
  addEventListener('jd:motion', () => { paintedStatic = false; });

  layout();
  started = true;
  requestAnimationFrame(frame);
}
