/**
 * Credentials for Playwright docs captures.
 * Reads w4h-docs/.env (gitignored) — not w4h-app/.env.
 * Identities match w4h-api `seed-docs` / dev/docs-fixtures.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DOCS_ROOT = path.resolve(__dirname, '../..');

const DEFAULTS = {
  appUrl: 'http://127.0.0.1:5173',
  password: 'DocsOnly!2026',
  emails: {
    superadmin: 'superadmin@example.com',
    admin: 'admin@example.com',
    user: 'user@example.com',
  },
};

export function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v.replace(/\\\$/g, '$').replace(/\\n/g, '\n');
  }
  return out;
}

/**
 * @param {'superadmin' | 'admin' | 'user'} role
 */
export function loadCaptureCredentials(role = 'superadmin') {
  if (!DEFAULTS.emails[role]) {
    throw new Error(`Unknown capture role "${role}". Use superadmin, admin, or user.`);
  }
  const fileEnv = loadDotEnv(path.join(DOCS_ROOT, '.env'));
  const password =
    process.env.W4H_DOCS_PASSWORD ||
    process.env.W4H_PASSWORD ||
    fileEnv.W4H_DOCS_PASSWORD ||
    fileEnv.W4H_PASSWORD ||
    DEFAULTS.password;
  const emails = {
    superadmin:
      process.env.W4H_SUPERADMIN_EMAIL ||
      fileEnv.W4H_SUPERADMIN_EMAIL ||
      DEFAULTS.emails.superadmin,
    admin: process.env.W4H_ADMIN_EMAIL || fileEnv.W4H_ADMIN_EMAIL || DEFAULTS.emails.admin,
    user: process.env.W4H_USER_EMAIL || fileEnv.W4H_USER_EMAIL || DEFAULTS.emails.user,
  };
  const email = process.env.W4H_EMAIL || fileEnv.W4H_EMAIL || emails[role];
  const appUrl = process.env.W4H_APP_URL || fileEnv.W4H_APP_URL || DEFAULTS.appUrl;
  const appFileEnv = loadDotEnv(path.join(DOCS_ROOT, '../w4h-app/.env'));
  const apiUrl = String(
    process.env.W4H_API_URL || fileEnv.W4H_API_URL || appFileEnv.VITE_API_URL || 'http://localhost:2026/'
  ).replace(/\/?$/, '/');
  if (!email || !password) {
    throw new Error(
      `Missing capture credentials for ${role}. Run \`node bin/w4h seed-docs\` in w4h-api, ` +
        'then copy w4h-docs/.env.example → .env (see dev/docs-fixtures.md).'
    );
  }
  return { email, password, appUrl, apiUrl, role };
}

export async function assertSampleApiAcceptsLogin({ email, password, apiUrl }) {
  const url = new URL('users/login', apiUrl).href;
  let body;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    body = await res.json();
  } catch (err) {
    throw new Error(
      `Cannot reach API at ${url}. Start it with: cd ../w4h-api && npm run start:sample\n${err.message}`
    );
  }
  const msg = body?.error?.message || (typeof body?.error === 'string' ? body.error : null);
  const token = body?.token || body?.user?.token;
  if (msg || !token) {
    throw new Error(
      `API at ${apiUrl} rejected ${email}${msg ? ` (${msg})` : ''}. ` +
        'That process is probably still on DB_DATABASE, not w4h-sample.\n' +
        'Stop the API on :2026, then: cd ../w4h-api && npm run start:sample'
    );
  }
}

export async function establishCaptureSession(page, creds) {
  const loginUrl = new URL('users/login', creds.apiUrl).href;
  let user;
  try {
    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
    });
    user = await res.json();
  } catch (err) {
    throw new Error(
      `Cannot reach API at ${loginUrl}. Start: cd ../w4h-api && npm run start:sample\n${err.message}`
    );
  }
  const msg = user?.error?.message || (typeof user?.error === 'string' ? user.error : null);
  if (msg || !user?.token) {
    throw new Error(
      `API at ${creds.apiUrl} rejected ${creds.email}${msg ? ` (${msg})` : ''}. ` +
        'Run: node bin/w4h seed-docs && npm run start:sample'
    );
  }

  const platformAdmin =
    user.role === 'super_admin' ||
    user.role === 'admin' ||
    user.caps?.platform_admin === true;
  const landingPath = platformAdmin ? '/admin/home' : '/admin/datasets';

  const sessionPayload = {
    role: user.role,
    name: user.name,
    email: user.email,
    id: user.id,
    caps: user.caps ?? null,
    team_id: user.team_id ?? null,
    team_ids: user.team_ids ?? [],
    team_memberships: user.team_memberships ?? [],
  };

  await page.goto(creds.appUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ token, sessionUser, platformAdmin }) => {
      localStorage.setItem('w4h.user.token', token);
      localStorage.setItem('w4h.user', JSON.stringify(sessionUser));
      localStorage.setItem('isAdminUI', platformAdmin ? 'true' : 'false');
    },
    { token: user.token, sessionUser: sessionPayload, platformAdmin }
  );
  await page.reload({ waitUntil: 'networkidle' });

  await page.goto(`${creds.appUrl}${landingPath}`, { waitUntil: 'networkidle' });
  if (page.url().includes('/login')) {
    throw new Error(
      `Session for ${creds.email} was rejected after API login. ` +
        `Check VITE_API_URL in w4h-app/.env matches ${creds.apiUrl}`
    );
  }
  await page.waitForTimeout(800);
}

export async function loginForCapture(page, creds) {
  await establishCaptureSession(page, creds);
}

function passwordSource() {
  const fileEnv = loadDotEnv(path.join(DOCS_ROOT, '.env'));
  if (process.env.W4H_DOCS_PASSWORD) return 'env W4H_DOCS_PASSWORD';
  if (process.env.W4H_PASSWORD) return 'env W4H_PASSWORD';
  if (fileEnv.W4H_DOCS_PASSWORD) return 'w4h-docs/.env W4H_DOCS_PASSWORD';
  if (fileEnv.W4H_PASSWORD) return 'w4h-docs/.env W4H_PASSWORD';
  return 'documented default (dev/docs-fixtures.md)';
}

function printInspect() {
  const envPath = path.join(DOCS_ROOT, '.env');
  console.log('Docs capture env (library used by scripts/capture-*.mjs)');
  console.log(`  docs root     ${DOCS_ROOT}`);
  console.log(`  .env          ${fs.existsSync(envPath) ? envPath : 'missing (defaults apply)'}`);
  console.log(`  password from ${passwordSource()} (not printed)`);
  const { apiUrl } = loadCaptureCredentials('superadmin');
  console.log(`  API          ${apiUrl}  (must be npm run start:sample)`);
  for (const role of Object.keys(DEFAULTS.emails)) {
    const { email, appUrl } = loadCaptureCredentials(role);
    console.log(`  ${role.padEnd(11)} ${email}  →  ${appUrl}`);
  }
  console.log('\nThis file does not capture screenshots. From w4h-docs, with npm run start:sample:');
  console.log('  node scripts/capture-whats-new.mjs');
  console.log('  node scripts/recapture-datasets.mjs');
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) printInspect();
