/**
 * Re-capture SMTP (element shot, no sticky-nav fullPage glitch)
 * and Usage period GIF (taller viewport so chart bars aren't clipped).
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
const creds = loadCaptureCredentials('superadmin');
const { appUrl: APP_URL } = creds;

if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(os.homedir(), 'Library/Caches/ms-playwright');
}
fs.mkdirSync(OUT, { recursive: true });

function pngsToGif(framePaths, gifPath, duration = 800) {
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

async function clipThroughChart(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  const chart = page.locator('.daily-chart').first();
  const box = await chart.boundingBox();
  const clipH = box ? Math.min(1100, Math.ceil(box.y + box.height + 48)) : 900;
  return { x: 0, y: 0, width: 1280, height: Math.max(clipH, 720) };
}

async function main() {
  await assertSampleApiAcceptsLogin(creds);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  await loginForCapture(page, creds);

  // --- SMTP: Mail Server card only (avoids fixed-nav fullPage stitch) ---
  await page.goto(`${APP_URL}/admin/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await hideOverlays(page);
  const mailCard = page.locator('.card').filter({ hasText: 'Mail Server' }).first();
  await mailCard.scrollIntoViewIfNeeded();
  // Docs shots: generic addresses only (do not Save — leave real SMTP credentials intact)
  await mailCard.locator('label').filter({ hasText: 'Username' }).locator('..').locator('input').fill('noreply@example.com');
  await mailCard.locator('label').filter({ hasText: /^From$/ }).locator('..').locator('input').fill('W4H Toolkit <noreply@example.com>');
  await mailCard.locator('label').filter({ hasText: 'Reply-To' }).locator('..').locator('input').fill('support@example.com');
  await mailCard.locator('label').filter({ hasText: 'Test Recipient' }).locator('..').locator('input').fill('you@example.com');
  const helpEmail = page.locator('label').filter({ hasText: 'Help request email' }).locator('..').locator('input');
  if (await helpEmail.count()) await helpEmail.fill('support@example.com');
  await page.waitForTimeout(300);
  await mailCard.screenshot({ path: path.join(OUT, 'admin-settings-smtp.png') });
  console.log('shot media/whats-new/admin-settings-smtp.png (element)');

  // --- Usage period GIF ---
  await page.goto(`${APP_URL}/admin/usage`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await hideOverlays(page);
  const frames = [];
  for (const [i, v] of ['7', '30', '90', '14'].entries()) {
    await page.locator('#usage-days').selectOption(v);
    await page.waitForTimeout(900);
    const fp = path.join(OUT, `_usg_${i}.png`);
    await page.screenshot({ path: fp, clip: await clipThroughChart(page) });
    frames.push(fp);
  }
  pngsToGif(frames, path.join(OUT, 'usage-period.gif'), 900);
  frames.forEach((f) => fs.rmSync(f, { force: true }));

  await page.locator('#usage-days').selectOption('14');
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(OUT, 'usage-dashboard.png'),
    clip: await clipThroughChart(page),
  });
  console.log('shot media/whats-new/usage-dashboard.png');

  await browser.close();
  console.log('Done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
