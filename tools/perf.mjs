// `node tools/perf.mjs`: frame-rate check for the scroll scene.
// Loads the running dev server in headless Chrome, parks the scroll scene at several
// progress values and counts animation frames for a few seconds at each.
// Headless Chrome often rasterises on the CPU, so read the numbers as a worst case:
// a normal browser with a GPU is usually faster.
//
// usage: node tools/perf.mjs [url] [cpuSlowdown]   (defaults: http://localhost:4324/ and 1)
//   cpuSlowdown 4 or 6 simulates a mid-range laptop or phone by slowing the CPU that many times.
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:4324/';
const slowdown = Number(process.argv[3] ?? 1);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROGRESS = [0.1, 0.25, 0.4, 0.55, 0.65, 0.9, 1];
const SIZES = [
  ['desktop 1440x900', { width: 1440, height: 900 }, false],
  ['phone 375x812', { width: 375, height: 812 }, true],
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const [label, viewport, mobile] of SIZES) {
    const ctx = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile });
    const page = await ctx.newPage();
    if (slowdown > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: slowdown });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important} html{scroll-behavior:auto!important}' });
    await page.waitForTimeout(1500);
    console.log(`\n${label}${slowdown > 1 ? `, CPU ${slowdown}x slower` : ''}`);
    console.log('  progress   fps    median ms   worst ms');
    for (const p of PROGRESS) {
      await page.evaluate((p) => {
        const s = document.querySelector('[data-scene]');
        const top = s.getBoundingClientRect().top + scrollY;
        scrollTo(0, top + p * (s.offsetHeight - innerHeight));
      }, p);
      await page.waitForTimeout(1500); // let the scene ease to this progress
      const r = await page.evaluate(() => new Promise((resolve) => {
        const times = [];
        let last = performance.now();
        const start = last;
        const tick = (now) => {
          times.push(now - last); last = now;
          if (now - start < 3000) requestAnimationFrame(tick); else resolve(times.slice(1));
        };
        requestAnimationFrame(tick);
      }));
      const sorted = [...r].sort((a, b) => a - b);
      const fps = r.length / (r.reduce((a, b) => a + b, 0) / 1000);
      console.log(`  ${String(p).padEnd(9)} ${fps.toFixed(0).padStart(4)}   ${sorted[sorted.length >> 1].toFixed(1).padStart(8)}   ${sorted[sorted.length - 1].toFixed(1).padStart(8)}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
