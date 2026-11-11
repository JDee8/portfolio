// `node tools/og.mjs`: renders the link-preview image (public/og.png, 1200×630).
// It loads the running dev server, scrolls the scroll scene to its finished state (the blue
// shield), hides the nav and captions, adds the name and role, and takes a screenshot.
// Uses your installed Chrome (playwright-core, no browser download).
//
// usage: node tools/og.mjs [url] [outFile]
//   url      default http://localhost:4324/  (start `npm run dev` first)
//   outFile  default public/og.png
import { chromium } from 'playwright-core';

const [url = 'http://localhost:4324/', out = 'public/og.png'] = process.argv.slice(2);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    // astro-dev-toolbar is the floating dock the dev server adds; it never ships in a build.
    content: '.nav,.skip,.hud,.caption,[data-cmdk],astro-dev-toolbar{display:none!important} html{scroll-behavior:auto!important}',
  });
  await page.evaluate(() => {
    const s = document.querySelector('[data-scene]');
    const top = s.getBoundingClientRect().top + scrollY;
    scrollTo(0, top + s.offsetHeight - innerHeight);
  });
  await page.waitForTimeout(4000); // the scene eases towards its final frame
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:64px;bottom:52px;z-index:9999;pointer-events:none';
    d.innerHTML =
      '<div style="font:600 68px/1 var(--font-display);letter-spacing:-.02em;color:#eaf4ff;text-shadow:0 0 30px rgba(58,168,255,.45)">João Dias</div>' +
      '<div style="margin-top:12px;font:400 26px/1.2 var(--font-body);color:#7b94b4">Cybersecurity &amp; Network Specialist · Lisbon</div>';
    document.body.append(d);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out });
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
