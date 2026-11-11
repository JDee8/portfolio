// `npm run shots`: screenshots for the design critic loop.
// Captures the hero, each section, the scroll scene, the footer and the phone
// menu at desktop, tablet and phone widths, and reports console errors and
// sideways scroll. Uses your installed Chrome (playwright-core, no browser download).
//
// usage: node tools/capture.mjs [url] [outDir] [widths] [only]
//   url     default http://localhost:4324/  (start `npm run dev` first)
//   outDir  default shots/<timestamp>
//   widths  default 1440,768,375
//   only    comma list from: hero,about,work,timeline,skills,contact,scene,footer,menu
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const [url = 'http://localhost:4324/', out = `shots/${stamp}`, widths = '1440,768,375', only = ''] = process.argv.slice(2);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SIZES = { 1440: [1440, 900], 1280: [1280, 800], 1024: [1024, 768], 768: [768, 1024], 375: [375, 812] };
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const want = (n) => !only || only.split(',').includes(n);
// Show the final state of reveals and typed headings, so shots don't catch them mid-animation.
const settle = (page) => page.evaluate(() => {
  document.querySelectorAll('.reveal').forEach((e) => e.classList.add('in'));
  document.querySelectorAll('[data-type]').forEach((e) => { e.textContent = e.dataset.type; e.classList.add('done'); });
});
let problems = 0;

for (const width of widths.split(',').map(Number)) {
  const [vw, vh] = SIZES[width] ?? [width, 900];
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, hasTouch: vw < 768, isMobile: vw < 768 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(3500); // particles settle
  const file = (n) => `${out}/${width}-${n}.png`;

  if (want('hero')) await page.screenshot({ path: file('hero') });
  for (const id of ['about', 'work', 'timeline', 'skills', 'contact']) {
    if (!want(id) || !(await page.locator(`#${id}`).count())) continue;
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1300);
    await settle(page);
    await page.waitForTimeout(1200);
    await page.locator(`#${id}`).screenshot({ path: file(id) });
  }
  if (want('scene') && (await page.locator('[data-scene]').count())) {
    for (const p of [0.15, 0.5, 0.85]) {
      await page.evaluate((p) => {
        const s = document.querySelector('[data-scene]');
        scrollTo(0, s.getBoundingClientRect().top + scrollY + p * (s.offsetHeight - innerHeight));
      }, p);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: file(`scene-${p * 100}`) });
    }
  }
  if (want('footer')) {
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(800);
    await page.screenshot({ path: file('footer') });
  }
  if (want('menu') && vw < 900 && (await page.locator('[data-menu-open]').count())) {
    await page.evaluate(() => scrollTo(0, 0));
    await page.click('[data-menu-open]');
    await page.waitForTimeout(900);
    await page.screenshot({ path: file('menu') });
    await page.keyboard.press('Escape');
  }

  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  const real = errors.filter((e) => !/status of 404/.test(e) || !url.includes('404'));
  if (sw > iw || real.length) problems++;
  console.log(`[${width}] ${sw > iw ? `SIDEWAYS SCROLL (${sw}px > ${iw}px)` : 'no sideways scroll'} · console: ${real.length ? real.join(' | ') : 'clean'}`);
  await ctx.close();
}
await browser.close();
console.log(`Screenshots in ${out}`);
process.exit(problems ? 1 : 0);
