// Code-drawn scroll scene: a glass padlock cracks, shatters and re-forms as a
// shield. Everything is a function of scroll progress p (0..1), so scrubbing
// up and down always shows the frame that belongs to that position.
//
//   0.00 – 0.30  detect   the lock turns from ice to red and cracks spread from the keyhole
//   0.30 – 0.56  triage   it shatters; a blue scan line sweeps the debris and every fragment it passes turns white
//   0.42 – 0.84  contain  scanned fragments lift off, left to right, and swirl into a shield
//   0.60 – 0.88  secured  blue spreads across the floor from under the shield, then the tick ring appears
//
// Reference: two Pinterest motion pins (cracked padlock → shield, red → blue).
// No video, no images: particles, vector shapes and a perspective circuit floor.
import { motionOff } from './motion';
import { A, R, F } from './palette';

type RGB = [number, number, number];
type P2 = [number, number];
const toRgb = (s: string): RGB => { const [r, g, b] = s.split(',').map(Number); return [r, g, b]; };
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

const WHITE: RGB = [255, 255, 255];
const ACC = toRgb(A);
const ALR = toRgb(R);
const SNOW = toRgb(F);
const ICE = mix(SNOW, ACC, 0.28);
const RED_ICE = mix(ICE, ALR, 0.82);
const HOT = mix(ACC, WHITE, 0.45); // bright core of the blue neon lines

// Particle colours, in the order a fragment lives through them:
// ice (calm lock) → red (breached) → snow white (scanned) → blue (part of the shield).
// Red never blends straight into blue, so nothing turns purple (BRAND-shield.md).
const STOPS = [ICE, RED_ICE, SNOW, ACC];
const PER = 4;
const BUCKETS = (STOPS.length - 1) * PER + 1;
const RAMP = Array.from({ length: BUCKETS }, (_, k) => {
  const i = Math.min(STOPS.length - 2, (k / PER) | 0);
  return css(mix(STOPS[i], STOPS[i + 1], k / PER - i));
});

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

// ---- Timeline (scroll progress)
const T0 = 0.30, T1 = 0.56;        // shatter: fragments fly out and fall
const SCAN0 = 0.37, SCAN1 = 0.53;  // the triage scan crosses the debris, left to right
const LIFT = 0.22;                 // how long one fragment takes to fly into the shield
const WAVE0 = 0.60, WAVE1 = 0.88;  // blue spreads across the floor

// ---- Shapes, in "units" (1 unit ≈ 1 px at scale 1). Origin = middle of the lock body.
const FLOOR_U = 150;          // lock bottom / floor line, in units
const HOVER = 36;             // the shield floats this far above where the lock stood
const SHIELD_LEN = 952;       // outline length in units (measured: 950.3), for the draw-on trace
const SHACKLE_DY = -7;        // the shackle sits in the middle of the block's top face
const RY = 0.2;               // how flat circles on the floor look

const bodyPath = (g: CanvasRenderingContext2D) => { g.beginPath(); g.roundRect(-110, -20, 220, 170, 18); };
const backPath = (g: CanvasRenderingContext2D) => { g.beginPath(); g.roundRect(-102, -34, 204, 158, 16); }; // back face of the glass block
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
  const out: P2[] = [];
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
    c.save(); c.translate(0, SHACKLE_DY); shacklePath(c); c.lineWidth = 30; c.stroke(); c.restore();
    c.globalCompositeOperation = 'destination-out'; keyholePath(c); c.fill();
  });
  const edgePts = sampleShape(340, 360, 170, 180, 1, rand, (c) => {
    shieldPath(c); c.lineWidth = 11; c.lineJoin = 'round'; c.stroke();
    glyphShackle(c); c.lineWidth = 8; c.stroke();
    glyphBody(c); c.fill();
  });
  const fillPts = sampleShape(340, 360, 170, 180, 3, rand, (c) => { shieldPath(c); c.fill(); });

  // Cracks spread from the keyhole across the lock body. Short chords join neighbouring
  // cracks, so the damage reads as broken glass (a web) and not as scribbles.
  type Crack = { pts: P2[]; len: number[]; total: number };
  const cracks: Crack[] = [];
  const mains: Crack[] = [];
  const inBody = (x: number, y: number) => x > -104 && x < 104 && y > -14 && y < 144;
  const grow = (x: number, y: number, a: number, steps: number): P2[] => {
    const pts: P2[] = [[x, y]];
    for (let s = 0; s < steps; s++) {
      a += (rand() - 0.5) * 0.9;
      const l = 14 + rand() * 20;
      x += Math.cos(a) * l; y += Math.sin(a) * l;
      if (!inBody(x, y)) break;
      pts.push([x, y]);
    }
    return pts;
  };
  const addCrack = (pts: P2[]) => {
    if (pts.length < 2) return null;
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const c: Crack = { pts, len, total: len[len.length - 1] };
    cracks.push(c);
    return c;
  };
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * TAU + rand() * 0.4;
    const main = addCrack(grow(0, 48, a, 6 + ((rand() * 4) | 0)));
    if (!main) continue;
    mains.push(main);
    for (let b = 0; b < 2; b++) {
      const at = main.pts[1 + ((rand() * (main.pts.length - 1)) | 0)];
      if (at) addCrack(grow(at[0], at[1], a + (rand() - 0.5) * 2, 3 + ((rand() * 3) | 0)));
    }
  }
  const chords: { a: P2; b: P2; at: number }[] = [];
  for (let k = 0; k < mains.length; k++) {
    const m1 = mains[k], m2 = mains[(k + 1) % mains.length];
    for (let j = 1; j < Math.min(m1.pts.length, m2.pts.length, 5); j++) {
      const a = m1.pts[j], b = m2.pts[j];
      if (rand() < 0.25 || Math.hypot(a[0] - b[0], a[1] - b[1]) > 62) continue;
      chords.push({ a, b, at: Math.max(m1.len[j] / m1.total, m2.len[j] / m2.total) });
    }
  }

  // Floor: circuit traces on the ground plane, stored as [xs, v, j]:
  //   xs = sideways position as a share of the canvas width (0 = centre)
  //   v  = closeness, 0 at the horizon and 1 at the bottom edge of the canvas
  //   j  = extra sideways offset as a share of the floor height, so a jog is 45° on any screen shape
  // A trace runs either across (v fixed) or away from the viewer (towards the vanishing point),
  // with short 45° jogs, like tracks on a circuit board. Step sizes are chosen in screen space
  // so the floor is evenly busy near and far.
  type P3 = [number, number, number];
  const V_MIN = 0.07, V_MAX = 1.25;
  // A step that would leave the floor goes the other way instead. (Clamping would pile many
  // traces onto the same far line and draw a hard stripe at the horizon.)
  const stepV = (v: number, d: number) => (v + d < V_MIN || v + d > V_MAX ? v - d : v + d);
  type Trace = { pts: P3[]; len: number[]; total: number; speed: number; off: number };
  const traces: P3[][] = [];
  const pulses: Trace[] = [];
  for (let k = 0; k < 120; k++) {
    let v = V_MIN + (1 - V_MIN) * Math.pow(rand(), 1.25);
    let xs = (rand() - 0.5) * 1.7, j = 0;
    const pts: P3[] = [[xs, v, j]];
    let across = rand() < 0.5;
    const steps = 3 + ((rand() * 5) | 0);
    for (let s = 0; s < steps; s++) {
      const dir = rand() < 0.5 ? -1 : 1;
      if (across) xs += dir * (0.05 + rand() * 0.2);
      else { const v2 = stepV(v, dir * (0.05 + rand() * 0.2)); xs *= v2 / v; j *= v2 / v; v = v2; }
      pts.push([xs, v, j]);
      if (rand() < 0.4) {
        const d = 0.02 + rand() * 0.022;
        const v2 = stepV(v, rand() < 0.5 ? -d : d);
        xs *= v2 / v; j = j * (v2 / v) + (rand() < 0.5 ? -1 : 1) * Math.abs(v2 - v);
        v = v2;
        pts.push([xs, v, j]);
      }
      across = !across;
    }
    traces.push(pts);
    if (rand() < 0.24) pulses.push({ pts, len: [], total: 1, speed: 0.04 + rand() * 0.06, off: rand() });
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

  // Dot matrix inside the shield (a hologram texture), with a clear patch behind the padlock.
  const dots = new Path2D();
  for (let row = 0, y = -146; y < 162; y += 9, row++)
    for (let x = -128 + (row % 2) * 5.2; x < 130; x += 10.4)
      if (!(Math.abs(x) < 46 && y > -44 && y < 64)) dots.rect(x - 1, y - 1, 2, 2);

  // Rays around the finished shield: [angle step, length].
  const rays = Array.from({ length: 72 }, () => 5 + rand() * rand() * 30);

  // ---- Particles (built when the first size is known, rebuilt if quality drops)
  let n = 0;
  let scanX = 380; // the scan runs from -scanX to +scanX units: the debris field, or the screen if that is narrower
  let LX: Float32Array, LY: Float32Array, SX: Float32Array, SY: Float32Array, DX: Float32Array, DY: Float32Array,
    GD: Float32Array, FL: Float32Array, RS: Float32Array, SZ: Float32Array, PH: Float32Array, SW: Float32Array;
  function makeParticles(count: number) {
    n = count;
    const f = () => new Float32Array(n);
    LX = f(); LY = f(); SX = f(); SY = f(); DX = f(); DY = f(); GD = f(); FL = f(); RS = f(); SZ = f(); PH = f(); SW = f();
    const r = rng(23);
    for (let i = 0; i < n; i++) {
      const l = lockPts[(r() * lockPts.length) | 0];
      const s = i < n * 0.7 ? edgePts[(r() * edgePts.length) | 0] : fillPts[(r() * fillPts.length) | 0];
      LX[i] = l[0]; LY[i] = l[1];
      SX[i] = s[0]; SY[i] = s[1] - HOVER;
      const a = Math.atan2(l[1] - 40, l[0]) + (r() - 0.5) * 1.1;
      const sp = 0.35 + r() * 1.25;
      DX[i] = Math.cos(a) * 190 * sp;
      DY[i] = Math.sin(a) * 140 * sp - 40 * r();
      GD[i] = 170 + r() * 190;
      FL[i] = FLOOR_U + (r() - 0.5) * 30;
      // A fragment lifts off shortly after the scan has passed the place where it comes to rest.
      const rest = clamp01((l[0] + DX[i] + scanX) / (2 * scanX));
      RS[i] = SCAN0 + (SCAN1 - SCAN0) * rest + 0.05 + r() * 0.04;
      SZ[i] = 1 + r() * 1.6;
      PH[i] = r() * TAU;
      SW[i] = (r() - 0.5) * 2;
    }
  }

  // ---- Layout
  let W = 0, H = 0, sc = 1, ox = 0, oy = 0, floorY = 0, horizonY = 0, fh = 1, z0 = 1, pad = 0, ax = 1, az = 1;
  let floorPaths: Path2D[] = [];
  let padPath = new Path2D();
  const FLOOR_A = [0.52, 0.36, 0.24, 0.15]; // line alpha, nearest band first
  let quality = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4 ? 0.6 : 1;
  let lowFx = false;

  // The floor and the finished shield never change shape, so each is drawn once into its own
  // off-screen canvas and copied in on every frame. That keeps the frame rate up: the scene
  // only re-draws what actually moves (particles, the lock, the scan, the wave rim).
  let dpr = 1, floorTopPx = 0, marginPx = 0;
  let floorImg: (HTMLCanvasElement | null)[] = [null, null]; // 0 = red (threat), 1 = blue (secure)
  let shieldImg: HTMLCanvasElement | null = null;
  const SBOX = { x: -152, y: -172, w: 304, h: 356 };         // shield sprite, in units
  function floorLayer(i: number) {
    let c = floorImg[i];
    if (!c) {
      const col = i ? ACC : ALR;
      c = document.createElement('canvas');
      c.width = canvas.width + marginPx * 2;   // a little wider than the screen, for the mouse shear
      c.height = Math.max(1, canvas.height - floorTopPx);
      const x = c.getContext('2d')!;
      x.setTransform(dpr, 0, 0, dpr, marginPx, -floorTopPx);
      x.lineJoin = 'round'; x.lineCap = 'round';
      for (let b = 0; b < floorPaths.length; b++) {
        x.lineWidth = b ? 1 : 1.3;
        x.strokeStyle = css(col, FLOOR_A[b]);
        x.stroke(floorPaths[b]);
      }
      x.lineWidth = 5; x.strokeStyle = css(col, 0.06); // soft glow on the two nearest bands
      x.stroke(floorPaths[0]); x.stroke(floorPaths[1]);
      x.fillStyle = css(mix(col, WHITE, 0.3), 0.6); x.fill(padPath);
      floorImg[i] = c;
    }
    return c;
  }
  function shieldLayer() {
    if (!shieldImg) {
      const k = sc * dpr;
      const c = document.createElement('canvas');
      c.width = Math.ceil(SBOX.w * k); c.height = Math.ceil(SBOX.h * k);
      const x = c.getContext('2d')!;
      x.setTransform(k, 0, 0, k, -SBOX.x * k, -SBOX.y * k);
      x.lineJoin = 'round';
      const fill = x.createLinearGradient(0, -150, 0, 162);
      fill.addColorStop(0, css(ACC, 0.22)); fill.addColorStop(1, css(ACC, 0.05));
      shieldPath(x); x.fillStyle = fill; x.fill();
      // hologram body: a dot matrix, and light gathering at the rim
      x.save(); shieldPath(x); x.clip();
      x.fillStyle = css(ACC, 0.22); x.fill(dots);
      shieldPath(x); x.lineWidth = 46; x.strokeStyle = css(ACC, 0.07); x.stroke();
      shieldPath(x); x.lineWidth = 22; x.strokeStyle = css(ACC, 0.09); x.stroke();
      x.restore();
      // inner line
      x.save(); x.translate(0, 6); x.scale(0.87, 0.87); x.translate(0, -6); shieldPath(x); x.restore();
      x.lineWidth = 1.2; x.strokeStyle = css(ACC, 0.55); x.stroke();
      // neon edge: soft layers, then a thin bright core
      for (const [w, a] of [[26, 0.045], [13, 0.1], [6.5, 0.24]] as const) {
        shieldPath(x); x.lineWidth = w; x.strokeStyle = css(ACC, a); x.stroke();
      }
      shieldPath(x); x.lineWidth = 3.2; x.strokeStyle = css(HOT); x.stroke();
      // padlock glyph
      glyphShackle(x); x.lineWidth = 7; x.strokeStyle = css(HOT, 0.95); x.stroke();
      glyphBody(x); x.fillStyle = css(ACC, 0.2); x.fill(); x.lineWidth = 3.5; x.stroke();
      glyphKey(x); x.fillStyle = css(mix(ACC, WHITE, 0.6), 0.95); x.fill();
      shieldImg = c;
    }
    return shieldImg;
  }
  const sxOf = (xs: number, j: number) => ox + xs * W + j * fh;
  const syOf = (v: number) => horizonY + fh * v;
  function layout() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(5e6 / (W * H)));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const portrait = H > W * 1.1;
    sc = Math.min((H * (portrait ? 0.34 : 0.46)) / 300, (W * 0.62) / 260);
    ox = W / 2;
    floorY = H * (portrait ? 0.7 : 0.74);
    oy = floorY - FLOOR_U * sc;
    horizonY = H * 0.3;
    fh = H - horizonY;
    z0 = fh / (floorY - horizonY);
    pad = 200 * sc;
    // The pad ring in ground-plane terms (see wavePath).
    ax = (pad * z0) / (0.3 * W);
    az = (RY * pad * z0 * z0) / fh;

    // The floor never moves, so its lines are projected once here and stroked as four paths
    // (one per depth band) on every frame, instead of line by line.
    floorPaths = FLOOR_A.map(() => new Path2D());
    padPath = new Path2D();
    for (const pts of traces) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], vm = (a[1] + b[1]) / 2;
        const path = floorPaths[vm > 0.6 ? 0 : vm > 0.36 ? 1 : vm > 0.2 ? 2 : 3];
        path.moveTo(sxOf(a[0], a[2]), syOf(a[1])); path.lineTo(sxOf(b[0], b[2]), syOf(b[1]));
      }
      for (const e of [pts[0], pts[pts.length - 1]]) { // solder pads at both ends
        const r = Math.max(1.3, Math.min(4.5, 5.5 * e[1]));
        padPath.moveTo(sxOf(e[0], e[2]) + r, syOf(e[1]));
        padPath.ellipse(sxOf(e[0], e[2]), syOf(e[1]), r, r * 0.45, 0, 0, TAU);
      }
    }
    for (const pu of pulses) {
      pu.len = [0];
      for (let i = 1; i < pu.pts.length; i++) {
        const a = pu.pts[i - 1], b = pu.pts[i];
        pu.len.push(pu.len[i - 1] + Math.hypot(sxOf(b[0], b[2]) - sxOf(a[0], a[2]), syOf(b[1]) - syOf(a[1])));
      }
      pu.total = pu.len[pu.len.length - 1] || 1;
    }

    // Off-screen layers are rebuilt for the new size: red floor now (it is on screen first),
    // the blue floor and the shield when the browser is idle, or the first time they are needed.
    floorTopPx = Math.floor(horizonY * dpr); marginPx = Math.round(24 * dpr);
    floorImg = [null, null]; shieldImg = null;
    floorLayer(0);
    const later = () => { if (W) { floorLayer(1); shieldLayer(); } };
    if ('requestIdleCallback' in window) requestIdleCallback(later, { timeout: 3000 }); else setTimeout(later, 600);

    const count = Math.round((W < 760 ? 1500 : 2800) * quality);
    const reach = Math.round(Math.min(380, W / 2 / sc + 30));
    if (count !== n || reach !== scanX) { scanX = reach; makeParticles(count); }
  }

  // A circle on the floor around the pad, `rho` pad-radii wide, as it looks in perspective.
  // Used for the blue wave that spreads when the shield is up.
  function wavePath(rho: number) {
    const path = new Path2D();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * TAU;
      const Z = Math.max(0.12, z0 + Math.sin(a) * rho * az);
      const x = ox + (Math.cos(a) * rho * ax * 0.3 * W) / Z, y = horizonY + fh / Z;
      if (i) path.lineTo(x, y); else path.moveTo(x, y);
    }
    path.closePath();
    return path;
  }

  // ---- One frame
  function draw(p: number, t: number, lean: number) {
    if (!W || !n) return;
    g.clearRect(0, 0, W, H);
    const th = smooth(0, 0.3, p);                 // how red the lock is
    const wk = clamp01((p - WAVE0) / (WAVE1 - WAVE0));
    const rho = 0.55 * Math.pow(130, wk);         // radius of the blue wave, in pad radii
    const blue = smooth(WAVE0, WAVE0 + 0.07, p);  // glows around the object: red fades out, blue fades in
    const amp = smooth(0.08, 0.3, p) * (p < T0 ? 2.4 : 0);
    const jx = Math.sin(t * 61) * amp, jy = Math.cos(t * 53) * amp;
    const cy = oy + 6 * sc;                       // visual centre of the object
    const sv = smooth(0.74, 0.92, p);             // solid shield
    const bob = Math.sin(t * 1.6) * 2;            // the shield floats, in units
    const shY = oy + (bob - HOVER) * sc;          // shield origin on screen

    // Ambient glow behind the object
    const glow = (col: RGB, a: number, x: number, y: number, r: number) => {
      if (a <= 0.003) return;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, css(col, a)); gr.addColorStop(1, css(col, 0));
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    glow(ALR, 0.2 * (1 - blue), ox, cy, 460 * sc);
    glow(ACC, 0.22 * blue, ox, cy, 460 * sc);

    // ---- Floor. Moving the mouse sideways shears it around the pad, like a small camera move.
    g.save();
    g.transform(1, 0, lean, 1, -lean * floorY, 0);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const floor = (i: number) => {
      const c = floorLayer(i);
      g.drawImage(c, -marginPx / dpr, floorTopPx / dpr, c.width / dpr, c.height / dpr);
    };
    if (wk <= 0) floor(0);
    else if (wk >= 1) floor(1);
    else {
      // Red outside the wave, blue inside it, and a bright rim where they meet.
      const wave = wavePath(rho);
      const outside = new Path2D();
      outside.rect(-80, -80, W + 160, H + 160); outside.addPath(wave);
      g.save(); g.clip(outside, 'evenodd'); floor(0); g.restore();
      g.save(); g.clip(wave); floor(1); g.restore();
      const fade = Math.pow(1 - wk, 1.6); // the rim dims as it runs out towards the horizon
      if (!lowFx) { g.lineWidth = 9; g.strokeStyle = css(ACC, 0.22 * fade); g.stroke(wave); }
      g.lineWidth = 2; g.strokeStyle = css(HOT, 0.95 * fade); g.stroke(wave);
    }
    // Signals running along some of the traces
    for (const pu of pulses) {
      const d = (((t * pu.speed + pu.off) % 1) + 1) % 1 * pu.total;
      let i = 1;
      while (i < pu.len.length - 1 && pu.len[i] < d) i++;
      const k = (d - pu.len[i - 1]) / Math.max(0.0001, pu.len[i] - pu.len[i - 1]);
      const a = pu.pts[i - 1], b = pu.pts[i];
      const v = a[1] + (b[1] - a[1]) * k;
      const x = sxOf(a[0] + (b[0] - a[0]) * k, a[2] + (b[2] - a[2]) * k), y = syOf(v), s = 1.2 + v * 1.6;
      let col = ALR;
      if (wk >= 1) col = ACC;
      else if (wk > 0) { // inside the wave yet?
        const ex = (x - ox) / (0.3 * W * v) / (rho * ax), ez = (1 / v - z0) / (rho * az);
        if (ex * ex + ez * ez < 1) col = ACC;
      }
      g.fillStyle = css(col, 0.2); g.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
      g.fillStyle = css(mix(col, WHITE, 0.55), 0.95); g.fillRect(x - s, y - s, s * 2, s * 2);
    }

    // Pad rings under the object. Each ring turns blue when the wave reaches it.
    const ringCol = (r: number) => (wk > 0 && rho > r ? ACC : ALR);
    g.setLineDash([]);
    g.strokeStyle = css(ringCol(1), 0.95); g.lineWidth = 2;
    g.beginPath(); g.ellipse(ox, floorY, pad, pad * RY, 0, 0, TAU); g.stroke();
    g.strokeStyle = css(ringCol(0.7), 0.5); g.lineWidth = 1;
    g.beginPath(); g.ellipse(ox, floorY, pad * 0.7, pad * 0.7 * RY, 0, 0, TAU); g.stroke();
    g.setLineDash([3, 9]); g.lineDashOffset = -t * 14; g.strokeStyle = css(ringCol(1.22), 0.4);
    g.beginPath(); g.ellipse(ox, floorY, pad * 1.22, pad * 1.22 * RY, 0, 0, TAU); g.stroke();
    g.setLineDash([]);
    if (p > T0 - 0.01 && p < 0.5) { // shockwave when the lock breaks
      const k = clamp01((p - (T0 - 0.01)) / 0.2);
      g.strokeStyle = css(mix(ALR, WHITE, 0.35), (1 - k) * (1 - k) * 0.85); g.lineWidth = 2;
      g.beginPath(); g.ellipse(ox, floorY, pad * (0.9 + k * 2.2), pad * (0.9 + k * 2.2) * RY, 0, 0, TAU); g.stroke();
    }
    g.save(); g.translate(0, floorY); g.scale(1, RY); g.translate(0, -floorY);
    glow(ALR, 0.22 * (1 - blue), ox, floorY, pad * 1.1);
    glow(ACC, (0.24 + 0.1 * sv) * blue, ox, floorY, pad * 1.1);
    g.restore();
    g.restore(); // end of floor

    // Projector light from the pad up to the shield
    if (sv > 0.01 && !lowFx) {
      const top = shY - 70 * sc;
      const beam = g.createLinearGradient(0, floorY, 0, top);
      beam.addColorStop(0, css(ACC, 0.055 * sv)); beam.addColorStop(1, css(ACC, 0));
      g.fillStyle = beam;
      for (const k of [1, 0.8, 0.6, 0.4, 0.2]) { // stacked cones: bright in the middle, soft at the sides
        g.beginPath();
        g.moveTo(ox - pad * 0.3 * k, floorY); g.lineTo(ox + pad * 0.3 * k, floorY);
        g.lineTo(ox + 124 * sc * k, top); g.lineTo(ox - 124 * sc * k, top);
        g.closePath();
        g.fill();
      }
    }

    // ---- Particles → colour buckets
    const paths = RAMP.map(() => new Path2D());
    const swarm = new Path2D(); // fragments on their way into the shield: bigger and brighter, so the eye follows them
    const PI = Math.PI;
    const scanning = p > SCAN0;
    const scanU = p >= SCAN1 ? 1e6 : -scanX + 2 * scanX * clamp01((p - SCAN0) / (SCAN1 - SCAN0));
    for (let i = 0; i < n; i++) {
      const pe = Math.min(p, RS[i]);
      const gt = clamp01((pe - T0) / (T1 - T0));
      const ts = eo3(gt);
      let x = LX[i] + DX[i] * ts, y = LY[i] + DY[i] * ts + GD[i] * gt * gt;
      if (y > FL[i]) y = FL[i];
      let m: number, u = 0;
      if (p < T0) {
        x += jx + Math.sin(t * 40 + PH[i]) * amp * 0.6; y += jy + Math.cos(t * 37 + PH[i] * 1.3) * amp * 0.6;
        m = th;
      } else {
        m = scanning ? 1 + clamp01((scanU - x) / 46) : 1; // red until the scan has passed, then white
        u = clamp01((p - RS[i]) / LIFT);
        if (u > 0) {
          const e = eio3(u);
          const dx = SX[i] - x, dy = SY[i] - y, len = Math.hypot(dx, dy) || 1;
          const sw = Math.sin(PI * e) * SW[i] * 70;
          x += dx * e - (dy / len) * sw;
          y += dy * e + (dx / len) * sw + bob * e;
          if (u >= 1) { x += Math.sin(t * 1.8 + PH[i]) * 0.7; y += Math.cos(t * 1.5 + PH[i]) * 0.7; }
          m = Math.max(m, 2 + e);
        }
      }
      const s = Math.max(1.1, SZ[i] * sc * 0.85);
      if (u > 0 && u < 1) { const s2 = s * 1.7; swarm.rect(ox + x * sc - (s2 - s) / 2, oy + y * sc - (s2 - s) / 2, s2, s2); }
      else paths[Math.min(BUCKETS - 1, Math.round(m * PER))].rect(ox + x * sc, oy + y * sc, s, s);
    }
    // Inside the intact lock the particles are only a faint grain that grows as it destabilises.
    // In the finished shield they step back so the clean outline leads.
    const alphaOf = (k: number) => (p < T0 ? 0.1 + 0.36 * smooth(0.04, 0.3, p) : k === BUCKETS - 1 ? 1 - 0.5 * sv : 1);

    // Reflection of the particles on the floor
    if (!lowFx) {
      g.save();
      g.translate(0, 2 * floorY); g.scale(1, -1);
      g.globalAlpha = 0.13;
      RAMP.forEach((c, k) => { g.fillStyle = c; g.fill(paths[k]); });
      g.restore();
    }

    // ---- Lock (a block of glass) until it breaks
    const lockA = 1 - smooth(T0, T0 + 0.035, p);
    if (lockA > 0.01) {
      const edge = mix(ICE, ALR, th * 0.75);
      const tint = mix(ICE, ALR, th * 0.3);
      if (!lowFx) { // its reflection on the floor
        g.save();
        g.translate(ox + jx * sc, 2 * floorY - oy - jy * sc); g.scale(sc, -sc);
        g.globalAlpha = lockA;
        const rg = g.createLinearGradient(0, 150, 0, 40);
        rg.addColorStop(0, css(edge, 0.22)); rg.addColorStop(1, css(edge, 0));
        bodyPath(g); g.fillStyle = rg; g.fill();
        g.lineWidth = 1.5; g.strokeStyle = rg; g.stroke();
        g.restore();
      }
      g.save();
      g.translate(ox + jx * sc, oy + jy * sc); g.scale(sc, sc);
      g.globalAlpha = lockA;
      g.lineJoin = 'round';
      // The block has depth. Its back face is a little smaller and higher (we look slightly down,
      // as on the floor): the strip that shows above the front face is the top of the block,
      // and the rest of the back edge shows faintly through the glass.
      backPath(g); g.fillStyle = css(tint, 0.07); g.fill();
      g.save(); g.beginPath(); g.rect(-120, -40, 240, 21.5); g.clip();
      const tg = g.createLinearGradient(0, -34, 0, -19);
      tg.addColorStop(0, css(tint, 0.4)); tg.addColorStop(1, css(tint, 0.18));
      backPath(g); g.fillStyle = tg; g.fill();
      g.restore();
      backPath(g); g.lineWidth = 1.4; g.strokeStyle = css(edge, 0.5); g.stroke();
      // shackle: bright outer tube with a dark core, entering the top face
      g.save(); g.translate(0, SHACKLE_DY);
      for (const hx of [-63, 63]) {
        g.beginPath(); g.ellipse(hx, -19.5, 17.5, 4.5, 0, 0, TAU);
        g.fillStyle = 'rgba(2,6,14,.9)'; g.fill();
        g.lineWidth = 1.2; g.strokeStyle = css(edge, 0.7); g.stroke();
      }
      shacklePath(g); g.lineWidth = 30; g.strokeStyle = css(edge, 0.55); g.stroke();
      shacklePath(g); g.lineWidth = 24; g.strokeStyle = 'rgba(2,6,14,.92)'; g.stroke();
      g.translate(-7, -2); shacklePath(g); g.lineWidth = 3; g.strokeStyle = css(ICE, 0.5); g.stroke(); // highlight on the tube's lit side
      g.restore();
      // front face
      const glass = g.createLinearGradient(0, -20, 0, 150);
      glass.addColorStop(0, css(tint, 0.3));
      glass.addColorStop(0.55, css(tint, 0.13));
      glass.addColorStop(1, css(mix(ACC, ALR, th * 0.5), 0.16));
      bodyPath(g); g.fillStyle = glass; g.fill();
      g.save(); bodyPath(g); g.clip();
      // light caught in the glass
      g.beginPath(); g.moveTo(-110, -20); g.lineTo(-30, -20); g.lineTo(-110, 96); g.closePath();
      g.fillStyle = css(SNOW, 0.08); g.fill();
      g.beginPath(); g.moveTo(2, -20); g.lineTo(22, -20); g.lineTo(-95, 150); g.lineTo(-115, 150); g.closePath();
      g.fillStyle = css(SNOW, 0.05); g.fill();
      // red breach glow around the keyhole
      const kg = g.createRadialGradient(0, 56, 0, 0, 56, 96);
      kg.addColorStop(0, css(ALR, th * 0.75)); kg.addColorStop(1, css(ALR, 0));
      g.fillStyle = kg; g.fillRect(-110, -20, 220, 170);
      g.restore();
      // edges
      bodyPath(g); g.lineWidth = 2; g.strokeStyle = css(edge, 0.92); g.stroke();
      g.beginPath(); g.moveTo(-94, -20); g.lineTo(94, -20);
      g.lineWidth = 2.2; g.strokeStyle = css(SNOW, 0.55); g.stroke();
      // keyhole
      keyholePath(g); g.fillStyle = 'rgba(2,6,14,.95)'; g.fill();
      g.lineWidth = 2; g.strokeStyle = css(mix(ICE, ALR, th), 0.9); g.stroke();
      // cracks
      const grown = smooth(0.03, 0.3, p);
      if (grown > 0) {
        g.lineCap = 'round';
        for (const pass of [0, 1]) {
          g.lineWidth = pass ? 1.3 : 5;
          g.strokeStyle = pass ? 'rgba(255,255,255,.95)' : css(ALR, 0.3);
          g.beginPath();
          for (const c of cracks) {
            const upTo = c.total * grown;
            g.moveTo(c.pts[0][0], c.pts[0][1]);
            for (let i = 1; i < c.pts.length; i++) {
              if (c.len[i] <= upTo) g.lineTo(c.pts[i][0], c.pts[i][1]);
              else {
                const k = (upTo - c.len[i - 1]) / (c.len[i] - c.len[i - 1]);
                if (k > 0) g.lineTo(c.pts[i - 1][0] + (c.pts[i][0] - c.pts[i - 1][0]) * k, c.pts[i - 1][1] + (c.pts[i][1] - c.pts[i - 1][1]) * k);
                break;
              }
            }
          }
          g.stroke();
        }
        g.lineWidth = 0.9; g.strokeStyle = 'rgba(255,255,255,.7)';
        g.beginPath();
        for (const c of chords) {
          const k = clamp01((grown - c.at) / 0.12);
          if (k <= 0) continue;
          g.moveTo(c.a[0], c.a[1]);
          g.lineTo(c.a[0] + (c.b[0] - c.a[0]) * k, c.a[1] + (c.b[1] - c.a[1]) * k);
        }
        g.stroke();
        g.lineCap = 'butt';
      }
      g.restore();
    }

    // ---- Glass shards
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

    // ---- Particles on top (additive, so dense areas glow)
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineJoin = 'round';
    RAMP.forEach((c, k) => {
      const a = alphaOf(k);
      g.globalAlpha = a;
      g.fillStyle = c; g.fill(paths[k]);
      if (!lowFx) { g.globalAlpha = a * 0.09; g.lineWidth = 5; g.strokeStyle = c; g.stroke(paths[k]); }
    });
    g.globalAlpha = 1;
    g.fillStyle = css(HOT, 0.95); g.fill(swarm);
    if (!lowFx) { g.globalAlpha = 0.14; g.lineWidth = 6; g.strokeStyle = css(ACC); g.stroke(swarm); }

    // The triage scan: a blue line crossing the debris, with a short trail behind it.
    const scanA = smooth(SCAN0, SCAN0 + 0.025, p) * (1 - smooth(SCAN1 - 0.03, SCAN1, p));
    if (scanA > 0.01) {
      const x = ox + scanU * sc, w = 130 * sc;
      const y0 = floorY - 470 * sc, y1 = floorY + 46 * sc, ym = (y0 + y1) / 2, hh = (y1 - y0) / 2;
      g.globalAlpha = 1;
      // trail: the left half of a tall soft ellipse, so it fades out upwards, downwards and behind
      g.save();
      g.beginPath(); g.rect(x - w, y0, w, y1 - y0); g.clip();
      g.translate(x, ym); g.scale(w / hh, 1);
      const trail = g.createRadialGradient(0, 0, 0, 0, 0, hh);
      trail.addColorStop(0, css(ACC, 0.3 * scanA)); trail.addColorStop(1, css(ACC, 0));
      g.fillStyle = trail; g.fillRect(-hh, -hh, hh, hh * 2);
      g.restore();
      const line = (a: number) => {
        const lg = g.createLinearGradient(0, y0, 0, y1);
        lg.addColorStop(0, css(HOT, 0)); lg.addColorStop(0.25, css(HOT, a)); lg.addColorStop(0.85, css(HOT, a)); lg.addColorStop(1, css(HOT, 0));
        return lg;
      };
      g.fillStyle = line(0.22 * scanA); g.fillRect(x - 4, y0, 8, y1 - y0);
      g.fillStyle = line(0.95 * scanA); g.fillRect(x - 1, y0, 2, y1 - y0);
    }
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

    // A blueprint outline traces the shield while the fragments are still on their way in,
    // so the eye knows where they are going. It hands over to the solid shield below.
    const trace = smooth(0.5, 0.78, p);
    if (trace > 0.01 && sv < 0.99) {
      g.save();
      g.translate(ox, shY); g.scale(sc, sc);
      g.lineWidth = 2.5; g.lineJoin = 'round';
      g.setLineDash([(SHIELD_LEN / 2) * trace, SHIELD_LEN]);
      g.shadowColor = css(ACC, 0.9); g.shadowBlur = 10;
      g.strokeStyle = css(mix(ACC, WHITE, 0.35), 0.9 * (1 - sv));
      // The path starts at the top point, so drawing it once as it is and once mirrored
      // makes the two halves run down both sides and meet at the bottom tip.
      shieldPath(g); g.stroke();
      g.scale(-1, 1); shieldPath(g); g.stroke();
      g.restore();
    }

    // ---- Shield (solid) once it has formed
    if (sv > 0.01) {
      if (!lowFx) { // its reflection on the floor
        g.save();
        g.translate(ox, 2 * floorY - shY); g.scale(sc, -sc);
        g.globalAlpha = sv;
        const rg = g.createLinearGradient(0, 162, 0, -30);
        rg.addColorStop(0, css(ACC, 0.18)); rg.addColorStop(1, css(ACC, 0));
        shieldPath(g); g.lineWidth = 4; g.lineJoin = 'round'; g.strokeStyle = rg; g.stroke();
        g.restore();
      }
      // the shield itself: a ready-made image (see shieldLayer)
      const img = shieldLayer();
      g.globalAlpha = sv;
      g.drawImage(img, ox + SBOX.x * sc, shY + SBOX.y * sc, img.width / dpr, img.height / dpr);
      g.globalAlpha = 1;
      if (!lowFx) { // a slow band of light moving down through the dot matrix
        g.save();
        g.translate(ox, shY); g.scale(sc, sc);
        shieldPath(g); g.clip();
        const yb = -200 + ((t * 46) % 480);
        const band = g.createLinearGradient(0, yb - 48, 0, yb + 48);
        band.addColorStop(0, css(HOT, 0)); band.addColorStop(0.5, css(HOT, 0.6)); band.addColorStop(1, css(HOT, 0));
        g.fillStyle = band;
        g.globalAlpha = sv; g.fill(dots);
        g.globalAlpha = sv * 0.12; g.fillRect(-132, yb - 48, 264, 96);
        g.restore();
      }

      // ring of ticks around the shield, and rays beyond it
      const ring = smooth(0.84, 0.98, p);
      if (ring > 0) {
        g.save();
        g.translate(ox, shY + 6 * sc);
        g.save(); g.rotate(t * 0.08);
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
        g.rotate(-t * 0.05);
        const R1 = (224 + 10 * ring) * sc;
        g.strokeStyle = css(ACC, 0.26 * ring); g.lineWidth = 1;
        g.beginPath();
        rays.forEach((l, i) => {
          const a = (i / rays.length) * TAU;
          g.moveTo(Math.cos(a) * R1, Math.sin(a) * R1);
          g.lineTo(Math.cos(a) * (R1 + l * sc * ring), Math.sin(a) * (R1 + l * sc * ring));
        });
        g.stroke();
        g.restore();
      }
    }

    // Light streaks once everything is secure
    const stv = smooth(0.68, 0.9, p);
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
  let lean = 0, leanTo = 0; // floor shear from the mouse position
  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden || !W) return;
    if (motionOff()) {
      if (!paintedStatic) { draw(1, 0, 0); paintedStatic = true; }
      return;
    }
    paintedStatic = false;
    t += dt;
    const target = getProgress();
    cur += (target - cur) * Math.min(1, dt * 9);
    if (Math.abs(target - cur) < 0.0004) cur = target;
    lean += (leanTo - lean) * Math.min(1, dt * 4);
    if (Math.abs(leanTo - lean) < 0.0002) lean = leanTo; // exactly 0 at rest, so the cached floor is copied 1:1
    draw(cur, t, lean);
    // Below ~42 fps for the first 90 frames: drop the reflections, halos and moving light.
    if (!lowFx && frames < 90 && t > 1) { frames++; slow += dt; if (frames === 90 && slow / 90 > 1 / 42) lowFx = true; }
  }

  // Mouse only: a finger is busy scrolling.
  host.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') leanTo = (e.clientX / innerWidth - 0.5) * -0.07; });
  host.addEventListener('pointerleave', () => { leanTo = 0; });

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
