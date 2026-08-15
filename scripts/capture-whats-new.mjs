/**
 * Capture What's New screenshots + short GIFs from a running local W4H stack.
 *
 * Usage (app on :5173, API on :2026):
 *   cd w4h-docs
 *   PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" \
 *     node scripts/capture-whats-new.mjs
 *
 * Env: w4h-docs/.env (see dev/docs-fixtures.md). Role: Super admin.
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { assertSampleApiAcceptsLogin, loadCaptureCredentials, loginForCapture } from './lib/docs-capture-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.resolve(__dirname, '..');
const APP_ROOT = path.resolve(DOCS_ROOT, '../w4h-app');
const requireFromApp = createRequire(path.join(APP_ROOT, 'package.json'));
const { chromium } = requireFromApp('playwright');
const OUT = path.join(DOCS_ROOT, 'media', 'whats-new');
const creds = loadCaptureCredentials('superadmin');
const { appUrl: APP_URL } = creds;

if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(os.homedir(), 'Library/Caches/ms-playwright');
}

fs.mkdirSync(OUT, { recursive: true });

function pngsToGif(framePaths, gifPath, duration = 700) {
  const py = `
from PIL import Image
frames=[Image.open(p).convert('P', palette=Image.ADAPTIVE, colors=128) for p in ${JSON.stringify(framePaths)}]
frames[0].save(${JSON.stringify(gifPath)}, save_all=True, append_images=frames[1:], duration=${duration}, loop=0, optimize=True)
print(${JSON.stringify(path.relative(DOCS_ROOT, gifPath))})
`;
  const r = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || 'gif failed');
  console.log('gif ', (r.stdout || '').trim());
}

async function shot(page, name, opts = {}) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: !!opts.fullPage });
  console.log('shot', path.relative(DOCS_ROOT, file));
}

async function main() {
  await assertSampleApiAcceptsLogin(creds);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await loginForCapture(page, creds);
  await shot(page, 'admin-home');

  await page.goto(`${APP_URL}/admin/usage`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, 'usage-dashboard', { fullPage: true });

  await page.goto(`${APP_URL}/admin/audit-log`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, 'audit-log', { fullPage: true });

  await page.goto(`${APP_URL}/admin/datasets`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, 'datasets-catalog');

  await page.click('#adminMenuDropdown');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'About' }).click();
  await page.waitForSelector('#aboutModalTitle', { timeout: 5000 });
  await page.waitForTimeout(400);
  await shot(page, 'about-modal');
  await page.locator('.modal-footer .btn-primary').click();

  await page.goto(`${APP_URL}/docs/setting-up-projects`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await shot(page, 'docs-guide');

  // GIF: dataset filters (prefer Admin app-shell — see scripts/recapture-datasets.mjs)
  await page.goto(`${APP_URL}/admin/datasets`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const ds = [];
  for (const [i, label] of ['All', 'Mine', 'Others', 'Shared', 'All'].entries()) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(350);
    const fp = path.join(OUT, `_ds_${i}.png`);
    await page.screenshot({ path: fp });
    ds.push(fp);
  }
  pngsToGif(ds, path.join(OUT, 'datasets-filters.gif'));
  ds.forEach((f) => fs.rmSync(f, { force: true }));

  // GIF: usage period
  await page.goto(`${APP_URL}/admin/usage`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const us = [];
  for (const [i, v] of ['7', '30', '90', '14'].entries()) {
    await page.locator('#usage-days').selectOption(v);
    await page.waitForTimeout(700);
    const fp = path.join(OUT, `_us_${i}.png`);
    await page.screenshot({ path: fp });
    us.push(fp);
  }
  pngsToGif(us, path.join(OUT, 'usage-period.gif'), 800);
  us.forEach((f) => fs.rmSync(f, { force: true }));

  // GIF: about menu
  await page.goto(`${APP_URL}/admin/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const ab = [];
  let fp = path.join(OUT, '_ab_0.png');
  await page.screenshot({ path: fp });
  ab.push(fp);
  await page.click('#adminMenuDropdown');
  await page.waitForTimeout(400);
  fp = path.join(OUT, '_ab_1.png');
  await page.screenshot({ path: fp });
  ab.push(fp);
  await page.getByRole('button', { name: 'About' }).click();
  await page.waitForSelector('#aboutModalTitle');
  await page.waitForTimeout(500);
  fp = path.join(OUT, '_ab_2.png');
  await page.screenshot({ path: fp });
  ab.push(fp);
  await page.waitForTimeout(600);
  fp = path.join(OUT, '_ab_3.png');
  await page.screenshot({ path: fp });
  ab.push(fp);
  pngsToGif(ab, path.join(OUT, 'about-menu.gif'), 750);
  ab.forEach((f) => fs.rmSync(f, { force: true }));

  await browser.close();
  console.log('Done →', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
