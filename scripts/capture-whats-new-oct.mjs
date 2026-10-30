/**
 * October 2026 What's New captures: request access, Access queue,
 * project activity rail, People, Analytics, Run import.
 *
 * Usage (sample API + app; see dev/docs-fixtures.md):
 *   cd w4h-docs
 *   PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" \
 *     node scripts/capture-whats-new-oct.mjs
 *
 * Optional (leave the working API on :2026 alone):
 *   cd ../w4h-api && node bin/w4h seed-docs
 *   PORT=2027 npm run start:sample
 *   cd ../w4h-app && VITE_API_URL=http://127.0.0.1:2027/ npm run dev -- --host 127.0.0.1 --port 5174
 *   W4H_APP_URL=http://127.0.0.1:5174 W4H_API_URL=http://127.0.0.1:2027/ \
 *     node scripts/capture-whats-new-oct.mjs
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

async function preparePage(page) {
  await page.route('**/*devtools*', (route) => route.abort());
  await hideOverlays(page);
}

async function hideOverlays(page) {
  await page.addStyleTag({
    content: `
      #__vue-devtools-container__,
      .vue-devtools-frame,
      .vue-devtools__anchor,
      [class*="vue-devtools"],
      iframe[src*="devtools"] {
        display: none !important;
        visibility: hidden !important;
      }
    `,
  });
}

async function dismissWhatsNew(page) {
  const skip = page.getByRole('button', { name: /don't show again/i });
  if (await skip.count()) {
    await skip.click();
    await page.waitForTimeout(400);
  }
}

async function shot(page, name, opts = {}) {
  const file = path.join(OUT, `${name}.png`);
  if (opts.locator) {
    await opts.locator.screenshot({ path: file });
  } else {
    await page.screenshot({ path: file, fullPage: !!opts.fullPage });
  }
  console.log('shot', path.relative(DOCS_ROOT, file));
}

async function framesToGif(page, steps, gifName, duration = 750) {
  const frames = [];
  for (const [i, step] of steps.entries()) {
    await step();
    await page.waitForTimeout(350);
    const fp = path.join(OUT, `_${gifName}_${i}.png`);
    await page.screenshot({ path: fp });
    frames.push(fp);
  }
  pngsToGif(frames, path.join(OUT, `${gifName}.gif`), duration);
  frames.forEach((f) => fs.rmSync(f, { force: true }));
}

async function firstProjectId(page, apiUrl) {
  const token = await page.evaluate(() => localStorage.getItem('w4h.user.token'));
  const res = await fetch(new URL('projects', apiUrl).href, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  const rows = Array.isArray(body) ? body : body?.projects || body?.data || [];
  const hit = rows.find((p) => p.slug === 'docs-pilot') || rows[0];
  if (!hit?.id) throw new Error('No project returned for Admin capture (seed Wearable Pilot / docs-pilot).');
  return String(hit.id);
}

async function captureGuestRequestAccess(browser, appUrl) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${appUrl}/login`, { waitUntil: 'networkidle' });
  await preparePage(page);
  await page.waitForTimeout(400);
  await shot(page, '_ra_login');

  const requestLink = page.getByRole('link', { name: /request access/i });
  if (await requestLink.count()) {
    await requestLink.first().click();
    await page.waitForLoadState('networkidle');
  } else {
    await page.goto(`${appUrl}/request-access`, { waitUntil: 'networkidle' });
  }
  await preparePage(page);
  const name = page.locator('#ra-name');
  if (await name.count()) {
    await name.fill('Riley Morgan');
    await page.locator('#ra-email').fill('researcher@usc.edu');
    await page.locator('#ra-affiliation').fill('Example Cardiology Lab');
    await page.locator('#ra-purpose').fill('Pilot study of resting heart-rate trends (synthetic, docs only).');
  }
  await page.waitForTimeout(300);
  await shot(page, 'request-access', { fullPage: true });
  await page.close();
}

async function captureSuperAdminQueue(browser) {
  const creds = loadCaptureCredentials('superadmin');
  await assertSampleApiAcceptsLogin(creds);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await loginForCapture(page, creds);
  await preparePage(page);
  await dismissWhatsNew(page);

  await page.goto(`${creds.appUrl}/admin/access-requests`, { waitUntil: 'networkidle' });
  await preparePage(page);
  await page.waitForTimeout(600);
  await shot(page, 'access-requests');

  await page.goto(`${creds.appUrl}/admin/contributions`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await shot(page, 'contributions-admin');

  const loginStill = path.join(OUT, '_ra_login.png');
  const formStill = path.join(OUT, 'request-access.png');
  const queueStill = path.join(OUT, 'access-requests.png');
  pngsToGif([loginStill, formStill, queueStill], path.join(OUT, 'request-access.gif'), 900);
  fs.rmSync(loginStill, { force: true });
  await page.close();
}

async function captureAdminWorkspace(browser) {
  const creds = loadCaptureCredentials('admin');
  await assertSampleApiAcceptsLogin(creds);
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await loginForCapture(page, creds);
  await preparePage(page);
  await dismissWhatsNew(page);

  const projectId = await firstProjectId(page, creds.apiUrl);
  const editUrl = `${creds.appUrl}/admin/projects/${projectId}/edit`;
  await page.goto(editUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await dismissWhatsNew(page);
  await shot(page, 'project-datasets');

  await framesToGif(
    page,
    [
      async () => {
        await page.goto(editUrl, { waitUntil: 'networkidle' });
        await preparePage(page);
      },
      async () => {
        await page.goto(`${editUrl}?tab=docs`, { waitUntil: 'networkidle' });
        await preparePage(page);
      },
      async () => {
        await page.goto(`${editUrl}?tab=analytics`, { waitUntil: 'networkidle' });
        await preparePage(page);
      },
      async () => {
        await page.goto(`${editUrl}?tab=people`, { waitUntil: 'networkidle' });
        await preparePage(page);
      },
    ],
    'project-hub-rail',
    800
  );

  await page.goto(`${editUrl}?tab=people`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await shot(page, 'project-people');

  await page.goto(`${editUrl}?tab=analytics`, { waitUntil: 'networkidle' });
  await preparePage(page);
  await page.waitForTimeout(900);
  const datasetSelect = page.locator('select.form-select').first();
  if (await datasetSelect.count()) {
    const loadedValue = await datasetSelect.locator('option').evaluateAll((opts) => {
      const hit = opts.find((o) => /loaded/i.test(o.textContent || ''));
      return hit ? hit.value : '';
    });
    if (loadedValue) await datasetSelect.selectOption(loadedValue);
    await page.waitForTimeout(800);
  }
  await shot(page, 'analytics-tab');
  await framesToGif(
    page,
    [
      async () => {},
      async () => {
        const explore = page.getByRole('button', { name: /explore signals/i });
        if (await explore.count()) await explore.click();
      },
    ],
    'analytics-explorer',
    900
  );

  await page.goto(editUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const combined = page.getByRole('button', { name: /combined summary/i });
  if (await combined.count()) await combined.click();
  const firstDataset = page.locator('.dataset-selector .dataset-row, .dataset-row').first();
  if (await firstDataset.count()) await firstDataset.click();
  await page.waitForTimeout(400);
  const runBtn = page.getByRole('button', { name: /run import/i });
  await framesToGif(
    page,
    [
      async () => {},
      async () => {
        if (await runBtn.count()) {
          await runBtn.click();
          await page.waitForTimeout(800);
          await page.locator('.modal.show, .modal.fade.show, .offcanvas.show').first().waitFor({ timeout: 4000 }).catch(() => {});
        }
      },
    ],
    'run-import',
    900
  );

  await page.close();
}

async function main() {
  const guestCreds = loadCaptureCredentials('admin');
  const browser = await chromium.launch({ headless: true });
  await captureGuestRequestAccess(browser, guestCreds.appUrl);
  await captureSuperAdminQueue(browser);
  await captureAdminWorkspace(browser);
  await browser.close();
  console.log('Done →', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
