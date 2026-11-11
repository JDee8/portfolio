// Code-drawn animations for the project cards. Each one shows what the
// project actually does. Picked by the card's data-art attribute.
import { motionOff } from './motion';
import { A, R, F, D, L } from './palette';

type Draw = (g: CanvasRenderingContext2D, w: number, h: number, dt: number) => void;
type Point = [number, number];

const FG = `rgb(${F})`;
const DIM = `rgb(${D})`;
const LINE = `rgb(${L})`;
const ACCENT = `rgb(${A})`;
const ALERT = `rgb(${R})`;
const MONO = '11px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SMALL = '10px "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function status(g: CanvasRenderingContext2D, w: number, h: number, left: string, right: string) {
  g.font = MONO;
  // On narrow panels (phones) the two labels collide; keep only the number on the right.
  const fits = g.measureText(left).width + g.measureText(right).width + 18 * 2 + 16 <= w;
  g.fillStyle = DIM;
  g.textAlign = 'left';
  if (fits) g.fillText(left, 18, h - 14);
  g.fillStyle = FG;
  g.textAlign = 'right';
  g.fillText(right, w - 18, h - 14);
  g.textAlign = 'left';
}

/* Endpoint management: a patch wave sweeps across the fleet, then new
   patches are released and devices drift out of date again. */
function fleet(): Draw {
  const cols = 10, rows = 4;
  const devices = Array.from({ length: cols * rows }, () => ({ current: Math.random() < 0.35, flash: 0 }));
  let wave = 0, pause = 0.8;

  return (g, w, h, dt) => {
    const px = 18, top = 20, bottom = 40;
    const cw = (w - px * 2) / cols, ch = (h - top - bottom) / rows;
    const dw = Math.min(cw * 0.62, 30), dh = dw * 0.66;

    if (pause > 0) {
      pause -= dt;
      for (const d of devices) if (d.current && Math.random() < dt * 0.35) d.current = false;
      if (pause <= 0) wave = 0;
    } else {
      wave += dt * 0.38;
      if (wave >= 1.15) pause = 1.6;
    }
    const waveX = px + wave * (w - px * 2);
    if (pause <= 0) {
      const band = g.createLinearGradient(waveX - 60, 0, waveX, 0);
      band.addColorStop(0, `rgba(${A},0)`);
      band.addColorStop(1, `rgba(${A},.16)`);
      g.fillStyle = band;
      g.fillRect(waveX - 60, top - 8, 60, h - top - bottom + 16);
      g.fillStyle = `rgba(${A},.7)`;
      g.fillRect(waveX, top - 8, 1, h - top - bottom + 16);
    }

    let current = 0;
    devices.forEach((d, i) => {
      const x = px + (i % cols) * cw + (cw - dw) / 2;
      const y = top + Math.floor(i / cols) * ch + (ch - dh) / 2;
      if (pause <= 0 && !d.current && x + dw / 2 < waveX) { d.current = true; d.flash = 1; }
      d.flash = Math.max(0, d.flash - dt * 1.6);
      if (d.current) current++;

      const stroke = d.current ? `rgba(${A},.8)` : `rgba(${R},.85)`;
      g.beginPath();
      g.roundRect(x, y, dw, dh, 3);
      g.fillStyle = d.current ? `rgba(${A},.1)` : `rgba(${R},.1)`;
      g.fill();
      g.strokeStyle = stroke;
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = stroke;
      g.fillRect(x + dw / 2 - 3, y + dh + 3, 6, 1.5);
      if (d.flash > 0) {
        const grow = (1 - d.flash) * 8;
        g.beginPath();
        g.roundRect(x - grow, y - grow, dw + grow * 2, dh + grow * 2, 4 + grow);
        g.strokeStyle = `rgba(${A},${d.flash * 0.8})`;
        g.stroke();
      }
    });
    status(g, w, h, pause > 0 ? 'new patches released' : 'rolling out patches', `${current}/${devices.length} endpoints current`);
  };
}

/* Network design: VLANs and a DMZ behind pfSense, traffic crossing an
   IPsec tunnel to site B, and WAN probes stopped at the firewall. */
function network(): Draw {
  interface Packet { path: Point[]; d: number; len: number; speed: number; bad: boolean; done: boolean }
  let packets: Packet[] = [];
  let spawn = 0, probe = 2, dash = 0, sent = 0, blocked = 0, flash = 0;

  const length = (path: Point[]) => path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0);
  const locate = (pk: Packet) => {
    let d = pk.d;
    for (let i = 0; i < pk.path.length - 1; i++) {
      const [x1, y1] = pk.path[i], [x2, y2] = pk.path[i + 1];
      const seg = Math.hypot(x2 - x1, y2 - y1);
      if (d <= seg) return { x: x1 + ((x2 - x1) * d) / seg, y: y1 + ((y2 - y1) * d) / seg, seg: i };
      d -= seg;
    }
    const [x, y] = pk.path[pk.path.length - 1];
    return { x, y, seg: pk.path.length - 2 };
  };

  return (g, w, h, dt) => {
    const m = 18, top = 30, bottom = 40;
    const siteW = Math.min(w * 0.34, 200);
    const boxH = (h - top - bottom - 16) / 3;
    const labels = ['VLAN 10 · users', 'VLAN 20 · servers', 'DMZ'];
    const boxes = labels.map((label, i) => ({ x: m, y: top + i * (boxH + 8), w: siteW, h: boxH, label }));
    const midY = top + (h - top - bottom) / 2;
    const fwA: Point = [m + siteW + w * 0.1, midY];
    const siteB = { x: w - m - Math.min(w * 0.18, 110), y: top, w: Math.min(w * 0.18, 110), h: h - top - bottom };
    const fwB: Point = [siteB.x - w * 0.08, midY];
    const nodeIn = (b: { x: number; y: number; w: number; h: number }, i: number, n: number): Point =>
      [b.x + (b.w * (i + 1)) / (n + 1), b.y + b.h * 0.62];
    const siteNodes: Point[] = [0, 1, 2, 3].map((i) => [siteB.x + siteB.w / 2, siteB.y + 22 + (i * (siteB.h - 30)) / 3.4]);

    // Static layout
    g.lineWidth = 1;
    g.font = SMALL;
    for (const b of boxes) {
      g.beginPath();
      g.roundRect(b.x, b.y, b.w, b.h, 6);
      g.strokeStyle = b.label === 'DMZ' ? `rgba(${A},.35)` : LINE;
      g.stroke();
      g.fillStyle = DIM;
      g.fillText(b.label, b.x + 8, b.y + 13);
      for (let i = 0; i < 3; i++) {
        const [x, y] = nodeIn(b, i, 3);
        g.fillStyle = `rgba(${F},.7)`;
        g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = LINE;
      g.beginPath(); g.moveTo(b.x + b.w, b.y + b.h / 2); g.lineTo(fwA[0], fwA[1]); g.stroke();
    }
    g.beginPath();
    g.roundRect(siteB.x, siteB.y, siteB.w, siteB.h, 6);
    g.strokeStyle = LINE; g.stroke();
    g.fillStyle = DIM; g.fillText('site B', siteB.x + 8, siteB.y + 13);
    for (const [x, y] of siteNodes) {
      g.fillStyle = `rgba(${F},.7)`;
      g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill();
    }
    g.beginPath(); g.moveTo(fwB[0], fwB[1]); g.lineTo(siteB.x, fwB[1]); g.strokeStyle = LINE; g.stroke();

    // WAN feed and the IPsec tunnel
    g.setLineDash([2, 4]);
    g.beginPath(); g.moveTo(fwA[0], 4); g.lineTo(fwA[0], fwA[1] - 14); g.strokeStyle = LINE; g.stroke();
    dash -= dt * 30;
    g.lineDashOffset = dash;
    g.setLineDash([6, 5]);
    g.beginPath(); g.moveTo(fwA[0] + 14, fwA[1]); g.lineTo(fwB[0] - 14, fwB[1]);
    g.strokeStyle = `rgba(${A},.55)`; g.stroke();
    g.setLineDash([]);
    g.lineDashOffset = 0;
    g.fillStyle = DIM;
    g.fillText('WAN', fwA[0] + 6, 12);
    g.fillText('IPsec tunnel', (fwA[0] + fwB[0]) / 2 - 30, fwA[1] - 10);

    // Firewalls
    flash = Math.max(0, flash - dt * 2);
    for (const [i, [x, y]] of [fwA, fwB].entries()) {
      g.beginPath();
      g.roundRect(x - 13, y - 13, 26, 26, 6);
      g.fillStyle = '#06111f';
      g.fill();
      g.strokeStyle = i === 0 && flash > 0 ? `rgba(${R},${0.4 + flash * 0.6})` : ACCENT;
      g.stroke();
      g.fillStyle = FG;
      g.font = SMALL;
      g.textAlign = 'center';
      g.fillText('FW', x, y + 3.5);
      g.fillStyle = DIM;
      g.fillText('pfSense', x, y + 27);
      g.textAlign = 'left';
    }
    if (flash > 0) {
      g.beginPath();
      g.arc(fwA[0], fwA[1], 16 + (1 - flash) * 16, 0, Math.PI * 2);
      g.strokeStyle = `rgba(${R},${flash * 0.7})`;
      g.stroke();
    }

    // Traffic
    spawn -= dt;
    if (spawn <= 0) {
      spawn = 0.45 + Math.random() * 0.4;
      const b = boxes[(Math.random() * 3) | 0];
      const start = nodeIn(b, (Math.random() * 3) | 0, 3);
      const path: Point[] = [start, [b.x + b.w, b.y + b.h / 2], fwA, fwB, [siteB.x, fwB[1]], siteNodes[(Math.random() * 4) | 0]];
      packets.push({ path, d: 0, len: length(path), speed: 120 + Math.random() * 40, bad: false, done: false });
    }
    probe -= dt;
    if (probe <= 0) {
      probe = 2.5 + Math.random() * 2;
      const path: Point[] = [[fwA[0], -4], [fwA[0], fwA[1] - 13]];
      packets.push({ path, d: 0, len: length(path), speed: 140, bad: true, done: false });
    }
    for (const pk of packets) {
      pk.d += pk.speed * dt;
      if (pk.d >= pk.len) {
        pk.done = true;
        if (pk.bad) { blocked++; flash = 1; } else sent++;
        continue;
      }
      const { x, y, seg } = locate(pk);
      g.fillStyle = pk.bad ? ALERT : seg === 2 ? ACCENT : FG;
      g.fillRect(x - 2, y - 2, 4, 4);
    }
    packets = packets.filter((pk) => !pk.done);
    status(g, w, h, `${blocked} WAN probes blocked`, `${sent} packets through the tunnel`);
  };
}

/* High availability: two domain controllers share logons. DC01 fails,
   DC02 takes every request, DC01 returns and replicates. No failed logons. */
function failover(): Draw {
  const CYCLE = 11;
  interface Req { client: number; dc: 0 | 1; p: number; back: boolean }
  let t = 0, spawn = 0, snap = 1;
  let reqs: Req[] = [];
  let snaps: { dc: 0 | 1; p: number }[] = [];

  return (g, w, h, dt) => {
    t = (t + dt) % CYCLE;
    const phase = t < 4.5 ? 'normal' : t < 7.5 ? 'down' : 'sync';
    const dc: Point[] = [[w * 0.3, h * 0.42], [w * 0.7, h * 0.42]];
    const dpm: Point = [w * 0.5, h * 0.12];
    const clients: Point[] = Array.from({ length: 6 }, (_, i) => [w * (0.15 + i * 0.14), h * 0.74]);
    const up = (i: number) => i === 1 || phase === 'normal';

    // Links
    g.lineWidth = 1;
    for (const c of clients) for (const [i, d] of dc.entries()) {
      g.strokeStyle = up(i) ? `rgba(${L},1)` : `rgba(${R},.12)`;
      g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.stroke();
    }
    for (const d of dc) { g.strokeStyle = LINE; g.beginPath(); g.moveTo(d[0], d[1]); g.lineTo(dpm[0], dpm[1]); g.stroke(); }
    g.setLineDash(phase === 'down' ? [3, 4] : []);
    g.strokeStyle = phase === 'down' ? `rgba(${R},.5)` : `rgba(${A},.4)`;
    g.beginPath(); g.moveTo(dc[0][0] + 34, dc[0][1]); g.lineTo(dc[1][0] - 34, dc[1][1]); g.stroke();
    g.setLineDash([]);

    // Heartbeat or replication between the controllers
    if (phase === 'normal') {
      const k = (Math.sin(t * 3) + 1) / 2;
      g.fillStyle = ACCENT;
      g.beginPath(); g.arc(dc[0][0] + 34 + k * (dc[1][0] - dc[0][0] - 68), dc[0][1], 2.5, 0, Math.PI * 2); g.fill();
    } else if (phase === 'sync') {
      for (let i = 0; i < 4; i++) {
        const k = 1 - ((t * 0.9 + i / 4) % 1);
        g.fillStyle = ACCENT;
        g.fillRect(dc[0][0] + 34 + k * (dc[1][0] - dc[0][0] - 68) - 2, dc[0][1] - 2, 4, 4);
      }
    }

    // Logon requests and replies
    spawn -= dt;
    if (spawn <= 0) {
      spawn = 0.3;
      const dcPick: 0 | 1 = phase === 'normal' ? (Math.random() < 0.5 ? 0 : 1) : 1;
      reqs.push({ client: (Math.random() * clients.length) | 0, dc: dcPick, p: 0, back: false });
    }
    for (const r of reqs) {
      if (r.dc === 0 && !up(0)) { r.dc = 1; r.p = 0; r.back = false; } // clients retry on DC02
      r.p += dt * 1.6;
      if (r.p >= 1 && !r.back) { r.back = true; r.p = 0; }
      const [cx, cy] = clients[r.client], [dx, dy] = dc[r.dc];
      const k = r.back ? 1 - r.p : r.p;
      g.fillStyle = r.back ? ACCENT : FG;
      g.fillRect(cx + (dx - cx) * k - 1.5, cy + (dy - cy) * k - 1.5, 3, 3);
    }
    reqs = reqs.filter((r) => !(r.back && r.p >= 1));

    // Backups to DPM
    snap -= dt;
    if (snap <= 0) { snap = 2.4; snaps.push({ dc: up(0) && Math.random() < 0.5 ? 0 : 1, p: 0 }); }
    for (const s of snaps) {
      s.p += dt * 0.8;
      const [sx, sy] = dc[s.dc];
      g.fillStyle = `rgba(${F},.8)`;
      g.fillRect(sx + (dpm[0] - sx) * s.p - 2, sy + (dpm[1] - sy) * s.p - 2, 4, 4);
    }
    snaps = snaps.filter((s) => s.p < 1);

    // Nodes
    g.font = MONO;
    g.textAlign = 'center';
    for (const [i, [x, y]] of dc.entries()) {
      const state = i === 0 && phase === 'down' ? 'offline' : i === 0 && phase === 'sync' ? 'replicating' : 'online';
      const color = state === 'offline' ? ALERT : state === 'replicating' ? ACCENT : `rgba(${F},.6)`;
      g.beginPath(); g.roundRect(x - 34, y - 15, 68, 30, 6);
      g.fillStyle = '#06111f'; g.fill();
      g.strokeStyle = color; g.stroke();
      g.fillStyle = state === 'offline' ? ALERT : FG;
      g.fillText(`DC0${i + 1}`, x, y + 4);
      g.font = SMALL;
      g.fillStyle = state === 'online' ? DIM : color;
      g.fillText(state, x, y + 30);
      g.font = MONO;
      if (state === 'offline' && t < 5.3) {
        const k = (t - 4.5) / 0.8;
        g.strokeStyle = `rgba(${R},${1 - k})`;
        g.beginPath(); g.roundRect(x - 34 - k * 14, y - 15 - k * 14, 68 + k * 28, 30 + k * 28, 6 + k * 8); g.stroke();
      }
    }
    g.beginPath(); g.roundRect(dpm[0] - 24, dpm[1] - 11, 48, 22, 5);
    g.fillStyle = '#06111f'; g.fill();
    g.strokeStyle = LINE; g.stroke();
    g.fillStyle = DIM; g.font = SMALL;
    g.fillText('DPM', dpm[0], dpm[1] + 3.5);
    for (const [x, y] of clients) {
      g.fillStyle = `rgba(${F},.75)`;
      g.fillRect(x - 6, y - 4, 12, 8);
    }
    g.textAlign = 'left';

    const left = phase === 'normal' ? 'both controllers serving logons' : phase === 'down' ? 'DC01 down · DC02 serving all logons' : 'DC01 back · replicating from DC02';
    status(g, w, h, left, '0 failed logons');
  };
}

/* Multi-threaded app: four worker threads pull records, a validation gate
   passes good ones and drops bad ones. */
function threads(): Draw {
  interface Item { lane: number; x: number; y: number; vy: number; valid: boolean; state: 'run' | 'ok' | 'bad'; alpha: number }
  const speeds = [86, 104, 74, 95];
  let items: Item[] = [];
  let spawn = 0, next = 0, processed = 1240, rejected = 31;

  return (g, w, h, dt) => {
    const top = 26, bottom = 44, lanes = 4;
    const laneY = (i: number) => top + ((h - top - bottom) * (i + 0.5)) / lanes;
    const x0 = 44, gate = w * 0.62, x1 = w - 18;

    g.font = SMALL;
    for (let i = 0; i < lanes; i++) {
      const y = laneY(i);
      g.strokeStyle = LINE;
      g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
      g.fillStyle = DIM;
      g.fillText(`T${i + 1}`, 18, y + 3.5);
    }
    g.setLineDash([3, 4]);
    g.strokeStyle = `rgba(${A},.6)`;
    g.beginPath(); g.moveTo(gate, top - 10); g.lineTo(gate, h - bottom + 6); g.stroke();
    g.setLineDash([]);
    g.fillStyle = ACCENT;
    g.textAlign = 'center';
    g.fillText('validate', gate, top - 14);
    g.textAlign = 'left';

    spawn -= dt;
    if (spawn <= 0) {
      spawn = 0.16 + Math.random() * 0.18;
      items.push({ lane: next++ % lanes, x: x0, y: 0, vy: 0, valid: Math.random() > 0.12, state: 'run', alpha: 1 });
    }
    for (const it of items) {
      if (it.state === 'bad') {
        it.vy += 420 * dt;
        it.y += it.vy * dt;
        it.alpha -= dt * 1.4;
      } else {
        it.x += speeds[it.lane] * dt;
        if (it.state === 'run' && it.x >= gate) {
          it.state = it.valid ? 'ok' : 'bad';
          if (it.valid) processed++; else rejected++;
        }
        if (it.x > x1 - 20) it.alpha -= dt * 4;
      }
      const a = Math.max(0, it.alpha);
      g.fillStyle = it.state === 'bad' ? `rgba(${R},${a})` : it.state === 'ok' ? `rgba(${F},${a})` : `rgba(${F},${0.45 * a})`;
      g.fillRect(it.x - 6, laneY(it.lane) + it.y - 3, 12, 6);
    }
    items = items.filter((it) => it.alpha > 0);
    status(g, w, h, `${rejected} rejected`, `${processed.toLocaleString('en')} records processed`);
  };
}

const ARTS: Record<string, () => Draw> = { fleet, network, failover, threads };

export function mountArt(canvas: HTMLCanvasElement) {
  const make = ARTS[canvas.dataset.art ?? ''];
  const g = canvas.getContext('2d');
  if (!make || !g) return;
  const draw = make();
  let w = 0, h = 0, visible = false, still = false, warm = false, last = performance.now();

  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    still = false;
    if (warm && w) paint(0); // resizing clears a canvas: redraw it even while it is off screen
  };
  const paint = (dt: number) => {
    g.clearRect(0, 0, w, h);
    g.save();
    draw(g, w, h, dt);
    g.restore();
  };
  // Run three seconds of the panel's story unseen, so it opens mid-action (packets moving,
  // threads busy) instead of on an empty diagram, and is never blank if someone scrolls fast.
  const warmUp = () => {
    if (warm || !w) return;
    for (let i = 0; i < 90; i++) paint(1 / 30);
    warm = true;
  };

  new ResizeObserver(size).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: '100px' }).observe(canvas);
  addEventListener('jd:motion', () => { still = false; });

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || !w) return;
    if (motionOff()) {
      // Run the simulation forward silently and show one representative frame.
      if (!still) { for (let i = 0; i < 240; i++) paint(1 / 60); still = true; }
      return;
    }
    warmUp();
    paint(dt);
  };
  requestAnimationFrame(frame);
  // Warm up when the browser is idle after load (or on first sight, whichever comes first).
  if ('requestIdleCallback' in window) requestIdleCallback(warmUp, { timeout: 2500 });
  else setTimeout(warmUp, 400);
}
