// Text drawn as particles that spring to their place, flee the cursor and
// glow amber while they move. Used by the hero and the 404 page.
import { motionOff } from './motion';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  tx: number; ty: number; size: number; phase: number; warm: boolean;
}
interface Dust { x: number; y: number; r: number; v: number; bucket: number }

const FONT = (px: number) => `600 ${px}px "Clash Display", sans-serif`;
const RADIUS = 120;   // cursor reach (BRAND.md)
const SPRING = 0.045;
const DAMPING = 0.82;
const DUST_ALPHA = [0.08, 0.16, 0.26, 0.38]; // dust is drawn in four batches, one per alpha

export function particleText(canvas: HTMLCanvasElement, host: HTMLElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const text = (host.dataset.text ?? '').trim();
  let W = 0, H = 0;
  let parts: Particle[] = [];
  let dust: Dust[] = [];
  const pointer = { x: -9999, y: -9999 };
  let visible = true, settled = false, t = 0, last = performance.now();
  // Fewer particles on machines with few cores, and again if frames run slow.
  let quality = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4 ? 0.6 : 1;
  let measured = false, sampleTime = 0, sampleFrames = 0;

  function build() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    if (!W || !H) return;
    // Keep the backing store under ~6M pixels so huge viewports lower resolution instead of stalling.
    const dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(6e6 / (W * H)));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Draw the text off screen and sample its pixels as particle targets.
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const o = off.getContext('2d', { willReadFrequently: true })!;
    const lines = W < 760 && text.includes(' ') ? text.split(/\s+/) : [text];
    let size = 200;
    o.font = FONT(size);
    const widest = Math.max(...lines.map((l) => o.measureText(l).width));
    size = Math.min((size * W * 0.84) / widest, H * (lines.length > 1 ? 0.27 : 0.36));
    o.font = FONT(size);
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    o.fillStyle = '#fff';
    lines.forEach((line, i) => o.fillText(line, W / 2, H * 0.45 + (i - (lines.length - 1) / 2) * size * 0.98));

    const data = o.getImageData(0, 0, W, H).data;
    const cap = (W < 760 ? 3200 : 6500) * quality;
    let gap = Math.max(3, Math.round(size / 46));
    let targets: [number, number][];
    do {
      targets = [];
      for (let y = 0; y < H; y += gap)
        for (let x = 0; x < W; x += gap)
          if (data[(y * W + x) * 4 + 3] > 130) targets.push([x, y]);
      gap++;
    } while (targets.length > cap);

    const prev = parts;
    parts = targets.map(([tx, ty], i) => ({
      x: prev[i]?.x ?? Math.random() * W,
      y: prev[i]?.y ?? Math.random() * H,
      vx: 0, vy: 0, tx, ty,
      size: Math.random() * 0.9 + 1,
      phase: Math.random() * Math.PI * 2,
      warm: Math.random() < 0.06,
    }));
    dust = Array.from({ length: Math.round((W * H) / 9000) }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.1 + 0.2, v: Math.random() * 0.15 + 0.03, bucket: (Math.random() * DUST_ALPHA.length) | 0,
    }));
    settled = false;
  }

  function render(animate: boolean, dt: number) {
    ctx!.clearRect(0, 0, W, H);
    const dustPaths = DUST_ALPHA.map(() => new Path2D());
    for (const d of dust) {
      if (animate) {
        d.y -= d.v;
        if (d.y < -4) { d.y = H + 4; d.x = Math.random() * W; }
      }
      dustPaths[d.bucket].rect(d.x, d.y, d.r, d.r);
    }
    dustPaths.forEach((path, i) => {
      ctx!.fillStyle = `rgba(238,240,245,${DUST_ALPHA[i]})`;
      ctx!.fill(path);
    });
    const calm = new Path2D(), warm = new Path2D(), hot = new Path2D();
    t += dt;
    for (const p of parts) {
      if (animate) {
        const tx = p.tx + Math.sin(t * 1.4 + p.phase) * 0.7;
        const ty = p.ty + Math.cos(t * 1.1 + p.phase) * 0.7;
        p.vx += (tx - p.x) * SPRING;
        p.vy += (ty - p.y) * SPRING;
        const dx = p.x - pointer.x, dy = p.y - pointer.y, d2 = dx * dx + dy * dy;
        if (d2 < RADIUS * RADIUS) {
          const d = Math.sqrt(d2) || 1, f = (1 - d / RADIUS) * 5.5;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }
        p.vx *= DAMPING;
        p.vy *= DAMPING;
        p.x += p.vx;
        p.y += p.vy;
      }
      const speed = p.vx * p.vx + p.vy * p.vy;
      (speed > 3 ? hot : p.warm ? warm : calm).rect(p.x, p.y, p.size, p.size);
    }
    ctx!.fillStyle = '#eef0f5'; ctx!.fill(calm);
    ctx!.fillStyle = 'rgba(255,181,71,.75)'; ctx!.fill(warm);
    ctx!.fillStyle = '#ffb547'; ctx!.fill(hot);
  }

  function frame(now: number) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || !W) return;
    if (motionOff()) {
      if (!settled) {
        for (const p of parts) { p.x = p.tx; p.y = p.ty; p.vx = p.vy = 0; }
        render(false, 0);
        settled = true;
      }
      return;
    }
    settled = false;
    render(true, dt);

    // After the fly-in, time 90 frames once. Below ~45 fps, halve the particles.
    if (!measured && t > 2.5) {
      sampleTime += dt;
      if (++sampleFrames === 90) {
        measured = true;
        if (sampleTime / sampleFrames > 1 / 45) {
          quality *= 0.5;
          build();
        }
      }
    }
  }

  function scatter(cx = W / 2, cy = H * 0.45) {
    if (motionOff()) return;
    for (const p of parts) {
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
      const f = 18 + Math.random() * 30;
      p.vx += (dx / d) * f + (Math.random() - 0.5) * 12;
      p.vy += (dy / d) * f + (Math.random() - 0.5) * 12;
    }
  }

  // Input
  const resetPointer = () => { pointer.x = pointer.y = -9999; };
  addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
  });
  addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') resetPointer(); });
  addEventListener('pointercancel', resetPointer);
  document.addEventListener('pointerleave', resetPointer);
  addEventListener('blur', resetPointer);
  host.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a, button')) return;
    const r = canvas.getBoundingClientRect();
    scatter(e.clientX - r.left, e.clientY - r.top);
  });
  addEventListener('jd:scatter', () => scatter());
  addEventListener('jd:motion', () => { settled = false; });

  // Lifecycle
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(host);
  let resizeTimer = 0, started = false;
  new ResizeObserver(() => {
    if (!started) return;
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(build, 150);
  }).observe(canvas);

  // Wait for the display font so the particles sample the right letter shapes.
  Promise.race([document.fonts.load(FONT(100)), new Promise((r) => setTimeout(r, 1500))]).then(() => {
    started = true;
    build();
    host.classList.add('ready');
    requestAnimationFrame(frame);
  });
}
