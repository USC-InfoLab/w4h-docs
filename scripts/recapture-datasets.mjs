/**
 * Re-capture Datasets catalog still + filter GIF as Admin (app shell).
 *
 * Super admin always uses Platform Admin chrome — use the seeded Admin account.
 * See dev/docs-fixtures.md.
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
const { chromium } = createRequire(path.join(APP_ROOT, 'package.json'))('playwright');
const OUT = path.join(DOCS_ROOT, 'media', 'whats-new');
const creds = loadCaptureCredentials('admin');
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

async function hideOverlays(page) {
  await page.addStyleTag({
    content:
      '#__vue-devtools-container__, .vue-devtools-frame, .vue-devtools__anchor { display: none !important; }',
  });
}

async function main() {
  await assertSampleApiAcceptsLogin(creds);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await loginForCapture(page, creds);
  await hideOverlays(page);

  // Assert we are not on Platform Admin chrome (Datasets must appear in app-shell nav)
  await page.goto(`${APP_URL}/admin/datasets`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const datasetsNav = page.locator('.navbar .nav-link', { hasText: 'Datasets' });
  if (!(await datasetsNav.count())) {
    throw new Error(
      'Datasets nav item not found. Use an Admin account (not Super admin) so the app shell is shown.'
    );
  }
  const datasetsActive = await datasetsNav.first().evaluate((el) => el.classList.contains('active'));
  if (!datasetsActive) {
    console.warn('Warning: Datasets nav link is not .active — check route active matching.');
  }

  await page.screenshot({ path: path.join(OUT, 'datasets-catalog.png') });
  console.log('shot media/whats-new/datasets-catalog.png');

  const frames = [];
  for (const [i, label] of ['All', 'Mine', 'Others', 'Shared', 'All'].entries()) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(400);
    const fp = path.join(OUT, `_ds_${i}.png`);
    await page.screenshot({ path: fp });
    frames.push(fp);
  }
  pngsToGif(frames, path.join(OUT, 'datasets-filters.gif'), 700);
  frames.forEach((f) => fs.rmSync(f, { force: true }));

  await browser.close();
  console.log('Done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
