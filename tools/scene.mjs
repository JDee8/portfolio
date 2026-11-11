// `node tools/scene.mjs`: screenshots of the scroll scene at chosen progress values,
// so each phase of the lock → shield animation can be reviewed as a still.
// Uses your installed Chrome (playwright-core, no browser download).
//
// usage: node tools/scene.mjs [url] [outDir] [progress] [widths]
//   url       default http://localhost:4324/  (start `npm run dev` first)
//   outDir    default shots/scene
//   progress  default 0,0.15,0.28,0.34,0.42,0.48,0.55,0.62,0.7,0.78,0.86,1
//   widths    default 1440,375
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [url = 'http://localhost:4324/', out = 'shots/scene', progress = '0,0.15,0.28,0.34,0.42,0.48,0.55,0.62,0.7,0.78,0.86,1', widths = '1440,375'] = process.argv.slice(2);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SIZES = { 1440: [1440, 900], 1280: [1280, 800], 768: [768, 1024], 375: [375, 812] };
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const width of widths.split(',').map(Number)) {
    const [vw, vh] = SIZES[width] ?? [width, 900];
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, hasTouch: vw < 768, isMobile: vw < 768 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important} html{scroll-behavior:auto!important}' });
    for (const p of progress.split(',').map(Number)) {
      await page.evaluate((p) => {
        const s = document.querySelector('[data-scene]');
        scrollTo(0, s.getBoundingClientRect().top + scrollY + p * (s.offsetHeight - innerHeight));
      }, p);
      await page.waitForTimeout(1300); // the scene eases to this progress
      await page.screenshot({ path: `${out}/${width}-p${String(Math.round(p * 100)).padStart(3, '0')}.png` });
    }
    console.log(`[${width}] console: ${errors.length ? errors.join(' | ') : 'clean'}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`Screenshots in ${out}`);
