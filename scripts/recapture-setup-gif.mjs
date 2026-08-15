/**
 * Re-capture admin-setup-flow.gif with generic SMTP / help emails in the Settings frame.
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

async function fillGenericMail(page) {
  const mailCard = page.locator('.card').filter({ hasText: 'Mail Server' }).first();
  await mailCard.scrollIntoViewIfNeeded();
  await mailCard.locator('label').filter({ hasText: 'Username' }).locator('..').locator('input').fill('noreply@example.com');
  await mailCard.locator('label').filter({ hasText: /^From$/ }).locator('..').locator('input').fill('W4H Toolkit <noreply@example.com>');
  await mailCard.locator('label').filter({ hasText: 'Reply-To' }).locator('..').locator('input').fill('support@example.com');
  await mailCard.locator('label').filter({ hasText: 'Test Recipient' }).locator('..').locator('input').fill('you@example.com');
  const helpEmail = page.locator('label').filter({ hasText: 'Help request email' }).locator('..').locator('input');
  if (await helpEmail.count()) await helpEmail.fill('support@example.com');
}

async function main() {
  await assertSampleApiAcceptsLogin(creds);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await loginForCapture(page, creds);
  await hideOverlays(page);

  const setupFrames = [];

  await page.goto(`${APP_URL}/admin/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const walk = (vnode, depth = 0) => {
      if (!vnode || depth > 30) return false;
      const s = vnode.setupState || vnode.ctx?.setupState;
      if (s && 'showSetupGuide' in s) {
        s.showSetupGuide = true;
        return true;
      }
      const children = vnode.subTree?.children || vnode.children || [];
      const list = Array.isArray(children) ? children : [children];
      for (const c of list) {
        if (c?.component && walk(c.component, depth + 1)) return true;
        if (c && walk(c, depth + 1)) return true;
      }
      return false;
    };
    walk(document.querySelector('#app')?.__vue_app__?._instance);
  });
  await page.waitForTimeout(400);
  let fp = path.join(OUT, '_su_0.png');
  await page.screenshot({ path: fp, fullPage: true });
  setupFrames.push(fp);

  await page.goto(`${APP_URL}/admin/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await fillGenericMail(page);
  // Full-page stitch clips under the sticky nav; show Mail Server + Help email clearly.
  await page.evaluate(() => window.scrollTo(0, 0));
  const mailCard = page.locator('.card').filter({ hasText: 'Mail Server' }).first();
  await mailCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  fp = path.join(OUT, '_su_1.png');
  await page.screenshot({ path: fp });
  setupFrames.push(fp);

  await page.goto(`${APP_URL}/admin/teams/add`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.locator('input').first().fill('Cardiology Trial');
  await page.waitForTimeout(200);
  fp = path.join(OUT, '_su_2.png');
  await page.screenshot({ path: fp });
  setupFrames.push(fp);

  await page.goto(`${APP_URL}/admin/users/add`, { waitUntil: 'networkidle' }).catch(async () => {
    await page.goto(`${APP_URL}/users/add`, { waitUntil: 'networkidle' });
  });
  await page.waitForTimeout(600);
  fp = path.join(OUT, '_su_3.png');
  await page.screenshot({ path: fp });
  setupFrames.push(fp);

  pngsToGif(setupFrames, path.join(OUT, 'admin-setup-flow.gif'), 800);
  setupFrames.forEach((f) => fs.rmSync(f, { force: true }));

  // Keep still SMTP card in sync (generic fill, no Save)
  await page.goto(`${APP_URL}/admin/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await fillGenericMail(page);
  const smtpCard = page.locator('.card').filter({ hasText: 'Mail Server' }).first();
  await smtpCard.screenshot({ path: path.join(OUT, 'admin-settings-smtp.png') });
  console.log('shot media/whats-new/admin-settings-smtp.png');

  await browser.close();
  console.log('Done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
