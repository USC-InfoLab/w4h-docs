/**
 * Extra What's New captures: login-with-code + Platform Admin setup shell.
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

async function shot(page, name, opts = {}) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: !!opts.fullPage });
  console.log('shot', path.relative(DOCS_ROOT, file));
}

async function main() {
  await assertSampleApiAcceptsLogin(creds);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // --- Login with password (shows email-code link) ---
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#inputEmail');
  // Clear autofill noise for a clean marketing shot
  await page.fill('#inputEmail', '');
  await page.fill('#inputPassword', '');
  await page.fill('#inputEmail', 'researcher@example.edu');
  await page.waitForTimeout(300);
  await shot(page, 'login-password');

  // --- Login with email code: request step ---
  await page.getByText('Login with email code').click();
  await page.waitForURL(/login.*code|code/i, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
  // Route may be /login-code
  if (!page.url().includes('code') && !page.url().includes('Code')) {
    await page.goto(`${APP_URL}/loginCode`, { waitUntil: 'networkidle' });
  }
  await page.waitForSelector('#email, input[type="email"]');
  await page.fill('#email', 'researcher@example.edu');
  await page.waitForTimeout(300);
  await shot(page, 'login-code-email');

  // Try send; if SMTP fails, force the code-entry UI via Vue state
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1200);
  const hasCode = await page.locator('#code').count();
  if (!hasCode) {
    await page.evaluate(() => {
      // Force second step for documentation capture
      const app = document.querySelector('#app')?.__vue_app__;
      // Fallback: mutate DOM to match code step if Vue internals unavailable
    });
    // Reliable approach: inject the code-step markup isn't ideal — use page.route
    // Instead navigate and set component state via localStorage hack won't work.
    // Use Playwright to evaluate Vue refs through exposed elements:
    await page.evaluate(() => {
      // Directly set visible state by clicking through if message shows success
    });
  }

  if (await page.locator('#code').count()) {
    await page.fill('#code', '123456');
    await page.waitForTimeout(300);
    await shot(page, 'login-code-verify');
  } else {
    // Synthesize verify step by setting Vue component state through the form
    await page.evaluate(() => {
      // Find the Vue component instance for LoginWithCode via element
      const form = document.querySelector('form.form-signin');
      let el = form;
      while (el) {
        const vn = el.__vueParentComponent;
        if (vn?.setupState && 'emailSent' in vn.setupState) {
          vn.setupState.emailSent = true;
          vn.setupState.email = 'researcher@example.edu';
          vn.setupState.message = 'Sign-in code sent.';
          vn.setupState.messageIsError = false;
          return true;
        }
        el = el.parentElement;
      }
      return false;
    });
    await page.waitForTimeout(400);
    if (await page.locator('#code').count()) {
      await page.fill('#code', '123456');
      await page.waitForTimeout(200);
      await shot(page, 'login-code-verify');
    } else {
      console.warn('Could not force code step — skipping login-code-verify.png');
    }
  }

  // GIF: password login → email code → (verify if available)
  const loginFrames = [];
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('#inputEmail', 'researcher@example.edu');
  await page.fill('#inputPassword', '');
  let fp = path.join(OUT, '_lg_0.png');
  await page.screenshot({ path: fp });
  loginFrames.push(fp);
  await page.getByText('Login with email code').click();
  await page.waitForTimeout(600);
  if (!page.url().includes('code') && !page.url().includes('Code')) await page.goto(`${APP_URL}/loginCode`, { waitUntil: 'networkidle' });
  await page.fill('#email', 'researcher@example.edu');
  fp = path.join(OUT, '_lg_1.png');
  await page.screenshot({ path: fp });
  loginFrames.push(fp);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);
  if (!(await page.locator('#code').count())) {
    await page.evaluate(() => {
      const form = document.querySelector('form.form-signin');
      let el = form;
      while (el) {
        const vn = el.__vueParentComponent;
        if (vn?.setupState && 'emailSent' in vn.setupState) {
          vn.setupState.emailSent = true;
          vn.setupState.email = 'researcher@example.edu';
          vn.setupState.message = 'Sign-in code sent.';
          vn.setupState.messageIsError = false;
          return;
        }
        el = el.parentElement;
      }
    });
    await page.waitForTimeout(400);
  }
  if (await page.locator('#code').count()) {
    await page.fill('#code', '123456');
    await page.waitForTimeout(200);
  }
  fp = path.join(OUT, '_lg_2.png');
  await page.screenshot({ path: fp });
  loginFrames.push(fp);
  pngsToGif(loginFrames, path.join(OUT, 'login-code-flow.gif'), 900);
  loginFrames.forEach((f) => fs.rmSync(f, { force: true }));

  // --- Platform Admin shell + setup ---
  await loginForCapture(page, creds);

  // Force setup guide visible
  await page.evaluate(() => {
    localStorage.removeItem('w4h.setupGuide');
    try {
      const raw = localStorage.getItem('user');
      // also clear dismissed flags used by pinia persist if any
    } catch { /* ignore */ }
  });

  await page.goto(`${APP_URL}/admin/home`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // If guide not showing (teams exist), inject callout visibility via evaluate on Vue
  const guideVisible = await page.locator('.w4h-callout').count();
  if (!guideVisible) {
    await page.evaluate(() => {
      // Find HomeView and set showSetupGuide
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
      const app = document.querySelector('#app')?.__vue_app__;
      const root = app?._instance;
      walk(root);
    });
    await page.waitForTimeout(400);
  }
  await shot(page, 'admin-setup-guide', { fullPage: true });

  await page.goto(`${APP_URL}/admin/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const mailCard = page.locator('.card').filter({ hasText: 'Mail Server' }).first();
  await mailCard.scrollIntoViewIfNeeded();
  // Docs shots: generic addresses only (do not Save)
  await mailCard.locator('label').filter({ hasText: 'Username' }).locator('..').locator('input').fill('noreply@example.com');
  await mailCard.locator('label').filter({ hasText: /^From$/ }).locator('..').locator('input').fill('W4H Toolkit <noreply@example.com>');
  await mailCard.locator('label').filter({ hasText: 'Reply-To' }).locator('..').locator('input').fill('support@example.com');
  await mailCard.locator('label').filter({ hasText: 'Test Recipient' }).locator('..').locator('input').fill('you@example.com');
  const helpEmail = page.locator('label').filter({ hasText: 'Help request email' }).locator('..').locator('input');
  if (await helpEmail.count()) await helpEmail.fill('support@example.com');
  await page.waitForTimeout(300);
  await mailCard.screenshot({ path: path.join(OUT, 'admin-settings-smtp.png') });
  console.log('shot media/whats-new/admin-settings-smtp.png (element)');

  // Super admin approves access requests; they do not create teams (ADR-028). The seeded
  // synthetic pending request (w4h-api lib/seed-docs-fixtures.js) makes the queue non-empty.
  await page.goto(`${APP_URL}/admin/access-requests`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Approve', { timeout: 10000 });
  await page.waitForTimeout(400);
  await shot(page, 'admin-access-requests');

  await page.goto(`${APP_URL}/admin/users/add`, { waitUntil: 'networkidle' }).catch(async () => {
    await page.goto(`${APP_URL}/users/add`, { waitUntil: 'networkidle' });
  });
  // try common routes
  if (!(await page.locator('text=Invite').count())) {
    await page.goto(`${APP_URL}/admin/users/invite`, { waitUntil: 'networkidle' }).catch(() => {});
  }
  await page.waitForTimeout(600);
  // Discover invite route from nav
  if (!(await page.getByRole('heading', { name: /Invite/i }).count()) && !(await page.locator('text=Invite User').count())) {
    await page.goto(`${APP_URL}/admin/home`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Users' }).first().click().catch(() => {});
    await page.waitForTimeout(500);
    const addBtn = page.getByRole('link', { name: /Invite|Add/i }).or(page.getByRole('button', { name: /Invite|Add/i }));
    if (await addBtn.count()) await addBtn.first().click();
    await page.waitForTimeout(600);
  }
  await shot(page, 'admin-users-invite');

  // GIF: setup walkthrough home → settings → access requests
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
  fp = path.join(OUT, '_su_0.png');
  await page.screenshot({ path: fp, fullPage: true });
  setupFrames.push(fp);

  await page.goto(`${APP_URL}/admin/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  {
    const mailCard = page.locator('.card').filter({ hasText: 'Mail Server' }).first();
    await mailCard.scrollIntoViewIfNeeded();
    await mailCard.locator('label').filter({ hasText: 'Username' }).locator('..').locator('input').fill('noreply@example.com');
    await mailCard.locator('label').filter({ hasText: /^From$/ }).locator('..').locator('input').fill('W4H Toolkit <noreply@example.com>');
    await mailCard.locator('label').filter({ hasText: 'Reply-To' }).locator('..').locator('input').fill('support@example.com');
    await mailCard.locator('label').filter({ hasText: 'Test Recipient' }).locator('..').locator('input').fill('you@example.com');
    const helpEmail = page.locator('label').filter({ hasText: 'Help request email' }).locator('..').locator('input');
    if (await helpEmail.count()) await helpEmail.fill('support@example.com');
  }
  fp = path.join(OUT, '_su_1.png');
  await page.screenshot({ path: fp, fullPage: true });
  setupFrames.push(fp);

  await page.goto(`${APP_URL}/admin/access-requests`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Approve', { timeout: 10000 });
  await page.waitForTimeout(500);
  fp = path.join(OUT, '_su_2.png');
  await page.screenshot({ path: fp });
  setupFrames.push(fp);

  pngsToGif(setupFrames, path.join(OUT, 'admin-setup-flow.gif'), 1100);
  setupFrames.forEach((f) => fs.rmSync(f, { force: true }));

  // Report an issue — force NavBar by exiting admin UI briefly if possible
  // Super admin always uses AdminNavBar — capture via mounting ReportIssueModal is hard.
  // Use evaluate to open a temporary modal isn't available.
  // Instead: patch isAdminUI false for one shot (App.vue computed may resist).
  await page.goto(`${APP_URL}/admin/home`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('isAdminUI', 'false');
  });
  // Won't change Super admin chrome per App.vue — skip if still admin nav
  await page.goto(`${APP_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  if (await page.locator('#menuDropdown').count()) {
    await page.click('#menuDropdown');
    await page.waitForTimeout(300);
    if (await page.getByRole('button', { name: 'Report an issue' }).count()) {
      await page.getByRole('button', { name: 'Report an issue' }).click();
      await page.waitForSelector('#reportIssueTitle');
      await page.fill('#report-subject', 'Docs typo on Quick Start');
      await page.fill('#report-message', 'The SMTP section heading looks off on mobile.');
      await page.waitForTimeout(300);
      await shot(page, 'report-issue-modal');
    }
  } else {
    console.warn('Report an issue not available for Super admin shell — leaving existing asset');
  }

  await browser.close();
  console.log('Done →', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
