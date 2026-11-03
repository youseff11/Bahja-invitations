// Screenshot a Bahja code harness at several viewports and animation stages.
//
// usage (run from frontend/, where Playwright is installed):
//   node ../.claude/skills/bahja-advanced-code/scripts/shots.mjs <url> <out_dir>
//        [--click] [--times 500,1300,2600,4000,6000] [--viewports m,d,l] [--wait 3200] [--scroll]
//
//   --click      click near the bottom centre after the idle shot (intro button area)
//   --times      ms after the click (or after load without --click) for each stage shot
//   --viewports  m = 390x844 @2x, d = 1440x860, l = 844x390 @2x
//   --wait       ms to let entrance animations finish before the first shot
//   --scroll     also scroll the code box into view first (section/video modes)
//
// Writes <out_dir>/<vp>-0.png (idle) and <vp>-1.png … per stage, and prints page errors
// plus whether window.__lbIntro.open() was called.
import fs from 'node:fs';
import { createRequire } from 'node:module';

// Playwright lives in frontend/node_modules: resolve it from the working directory, not from this file
const { chromium } = createRequire(process.cwd() + '/')('playwright');

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];
if (!url || !out) {
  console.error('usage: shots.mjs <url> <out_dir> [--click] [--times a,b,c] [--viewports m,d,l] [--wait ms] [--scroll]');
  process.exit(2);
}
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt;
};
const click = args.includes('--click');
const scroll = args.includes('--scroll');
const times = opt('--times', click ? '500,1300,2600,4000,6000' : '1000,3000').split(',').map(Number);
const wait = Number(opt('--wait', '3200'));
const VPS = {
  m: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d: { viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 },
  l: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const vps = opt('--viewports', 'm,d,l').split(',');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const key of vps) {
  const cfg = VPS[key];
  if (!cfg) continue;
  const page = await browser.newPage(cfg);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  if (scroll) await page.evaluate(() => document.querySelector('.lb-extra-html')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${key}-0.png` });
  const t0 = Date.now();
  if (click) {
    const { width, height } = cfg.viewport;
    await page.mouse.click(width / 2, height - 60);
  }
  for (const [i, t] of times.entries()) {
    const left = t - (Date.now() - t0);
    if (left > 0) await page.waitForTimeout(left);
    await page.screenshot({ path: `${out}/${key}-${i + 1}.png` });
  }
  const opened = await page.evaluate(() => document.body.dataset.opened || '');
  console.log(`[${key}] opened=${opened ? 'yes' : 'no'} errors=${JSON.stringify(errs)}`);
  await page.close();
}
await browser.close();
