# Noctura Extension B1a — keys, vault and the extension skeleton — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An installable, reproducibly built Noctura extension skeleton for Chrome and Firefox whose vault can hold an encrypted seed, unlock it with a password or a passkey in a dedicated vault page, keep only per-account signing keys in session memory, lock itself, and refuse every message that does not come from the right place — with the key derivation shared with the Android app through `core/`.

**Architecture:** A new `extension/` package beside `web/`, built with Vite into one set of files plus two rendered manifests (`dist/chrome`, `dist/firefox`). Key derivation and the mnemonic helpers move from `src/modules/keyDerivation/` into `core/keys/`, with the app keeping thin re-export shims. The vault is plain TypeScript over WebCrypto (AES-GCM, AES-KW, HKDF) and `@noble/hashes` Argon2id, used only by `unlock.html` and its worker; the background holds per-account signing keys in `storage.session` and routes messages through two partitions.

**Tech Stack:** TypeScript 5 (strict), Vite 8, Vitest 5 (node environment), `@noble/hashes` 2 (Argon2id), `@noble/curves` 2 (Ed25519), `@scure/bip39` 2, `@scure/base` 2, `micro-key-producer` 0.8 (SLIP-0010), WebCrypto, Playwright (Chromium E2E), Node ≥ 22.12 with npm 11.6.2.

**Spec:** `docs/superpowers/specs/2026-09-27-extension-b1-design.md` (revision 3). Read §1 (boundaries, message partitions), §2 (vault) and §5 (gates) before starting.

## Scope change from the spec — stated

The spec's phase list puts "transfers and balances into `core/`" in B1a. **They move to B1b instead.** Reading `src/modules/solana/transactionBuilder.ts` showed the app's send path also charges a Noctura fee (`feeEngine.getEffectiveFee('transferMarkup')` → `NOCTURA_FEE_TREASURY`), which the spec does not mention for the extension. That is a product decision for the owner, taken when the Send screen is designed in B1b; moving the builder now would either carry the fee in silently or strip it silently. B1a is complete without it: nothing in B1a sends a transaction.

Also deferred, from §5 of the spec: the Chrome `key` manifest field (needs the store's key; B1e), the extension CI running E2E (B1e), the drainer list (B1e).

## Global Constraints

- TypeScript strict; **no `any`, no `@ts-ignore`** (CLAUDE.md).
- No `// TODO`, no placeholders (cardinal rule 1).
- Prettier style of this repo: single quotes, trailing commas, **no spaces inside braces** (`{a, b}`), no parens around a single arrow parameter.
- Minimum browsers: **Chrome 122, Firefox 150**.
- Permissions: exactly `storage`, `alarms`; host permissions exactly `https://api.noc-tura.io/*`, `https://wallet.noc-tura.io/*`. No content scripts yet (B1c).
- Extension CSP: `script-src 'self'; object-src 'self'` — no `'unsafe-eval'`, no remote code.
- Argon2id production parameters: **m = 65536 KiB, t = 3, p = 1, dkLen = 32**.
- Auto-lock default **5 minutes**, configurable 1–60.
- `storage.session` holds per-account signing keys as **base64 strings**; never the seed, never the data key.
- The seed and the data key exist only in `unlock.html` and its worker.
- Passkey RP ID **`wallet.noc-tura.io`**; `userVerification: 'required'`; PRF salt 32 random bytes per wallet; HKDF info `"noctura-ext-v1/passkey-wrap"`.
- npm is **11.6.2** (the CI pin); Node **22.12.0** in CI.
- Every commit ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## File map

| path | responsibility |
|---|---|
| `core/util/zeroize.ts` | fill a byte array with zeros |
| `core/keys/transparent.ts` | Ed25519 derivation (moved) |
| `core/keys/mnemonic.ts` | generate / normalise / validate / seed (moved) |
| `core/keys/__tests__/*.test.ts` | vectors, run under the extension's vitest |
| `src/modules/keyDerivation/{transparent,mnemonicUtils}.ts` | re-export shims for the app |
| `core/geo/freshness.ts` + test | stale-list rules and the presale geo gate |
| `extension/package.json`, `tsconfig.json`, `vite.config.ts` | the package |
| `extension/manifest/source.mjs` + test | the one manifest source, rendered per browser |
| `extension/scripts/build.mjs` | vite build → `dist/app` → `dist/chrome`, `dist/firefox` |
| `extension/scripts/check-*.mjs` + tests | gates: CSP, permissions, vault isolation, reproducibility |
| `extension/src/ext.ts` | the typed `chrome`/`browser` shim |
| `extension/src/vault/envelope.ts` + test | envelope format, wrap/unwrap |
| `extension/src/vault/kdf.ts`, `kdf.worker.ts` + test | Argon2id, in a worker |
| `extension/src/vault/accounts.ts` + test | seed → per-account signing keys |
| `extension/src/vault/passkey.ts` + test | WebAuthn PRF create/get |
| `extension/src/vault/reauth.ts` + test | re-authentication as a proof |
| `extension/src/background/session.ts` + test | signing keys in `storage.session` |
| `extension/src/background/messages.ts` + test | the two partitions and the router |
| `extension/src/background/autolock.ts` + test | idle, browser-close and manual lock |
| `extension/src/background/index.ts` | wires the listeners |
| `extension/unlock.html`, `src/unlock/main.ts` | the vault page |
| `extension/popup.html`, `src/popup/main.ts` | locked/unlocked status + "Unlock" |
| `extension/e2e/unlock.spec.ts` | Playwright: unlock puts keys in session |
| `.github/workflows/extension.yml` | CI for the package |

---

### Task 1: The extension package, its build and the manifest source

**Files:**
- Create: `extension/package.json`, `extension/tsconfig.json`, `extension/vite.config.ts`, `extension/.gitignore`
- Create: `extension/manifest/source.mjs`, `extension/manifest/__tests__/source.test.mjs`
- Create: `extension/scripts/build.mjs`
- Create: `extension/popup.html`, `extension/src/popup/main.ts`, `extension/unlock.html`, `extension/src/unlock/main.ts`, `extension/src/background/index.ts`
- Modify: root `package.json` / `tsconfig.json` / `jest.config.js` only if they would otherwise pick up `extension/` (check in Step 1)

**Interfaces:**
- Produces: `render(browser: 'chrome' | 'firefox'): object` and `PERMISSIONS`, `HOST_PERMISSIONS` (arrays of `{value, reason}`), `EXTENSION_CSP` from `extension/manifest/source.mjs`; `npm run build` producing `dist/chrome/` and `dist/firefox/`.

- [ ] **Step 1: Fence the root build off from `extension/`**

Run: `grep -nE "testPathIgnorePatterns|exclude|\"include\"" jest.config.js tsconfig.json .eslintrc* 2>/dev/null`
The root already ignores `web/` and `core/` for jest (`jest.config.js` `testPathIgnorePatterns`). Add `'<rootDir>/extension/'` to that array, and add `"extension"` to the root `tsconfig.json` `exclude` array next to `"web"`. Verify: `npx tsc --noEmit` and `npx jest --listTests | grep -c extension` → `0`.

- [ ] **Step 2: Create the package**

`extension/package.json`:
```json
{
  "name": "noctura-extension",
  "private": true,
  "type": "module",
  "engines": {"node": ">=22.12.0"},
  "scripts": {
    "build": "tsc --noEmit && node scripts/build.mjs",
    "test": "vitest run",
    "e2e": "playwright test",
    "csp": "node scripts/check-csp.mjs dist/app",
    "gates": "node scripts/check-permissions.mjs",
    "reproducible": "node scripts/verify-reproducible.mjs",
    "verify": "rm -rf dist && npm run build && npm run test && npm run csp && npm run gates && npm run reproducible"
  },
  "dependencies": {
    "@noble/curves": "^2.0.1",
    "@noble/hashes": "^2.0.1",
    "@scure/base": "^2.0.0",
    "@scure/bip39": "^2.0.1",
    "micro-key-producer": "^0.8.5"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "@types/node": "^22.7.0",
    "typescript": "^5.5.0",
    "vite": "^8.3.0",
    "vitest": "^5.0.1"
  }
}
```
Run: `cd extension && npm install -g npm@11.6.2 >/dev/null; npm install` → creates `package-lock.json`.

`extension/.gitignore`:
```
node_modules/
dist/
test-results/
playwright-report/
```

`extension/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "WebWorker"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "node"],
    "baseUrl": ".",
    "paths": {
      "@noble/curves/*": ["./node_modules/@noble/curves/*"],
      "@noble/hashes/*": ["./node_modules/@noble/hashes/*"],
      "@scure/base": ["./node_modules/@scure/base"],
      "@scure/bip39": ["./node_modules/@scure/bip39"],
      "@scure/bip39/*": ["./node_modules/@scure/bip39/*"],
      "micro-key-producer/*": ["./node_modules/micro-key-producer/*"]
    }
  },
  "include": ["src", "e2e", "../core/keys", "../core/util"]
}
```

`extension/vite.config.ts`:
```ts
import {defineConfig} from 'vite';
import type {UserConfig} from 'vitest/config';
import {resolve} from 'node:path';

// core/ is imported by relative path and its bare imports must resolve to THIS package's
// node_modules — CI installs only extension/, exactly as web.yml does for web/.
const SHARED = ['@noble/curves', '@noble/hashes', '@scure/base', '@scure/bip39', 'micro-key-producer'];

export default defineConfig({
  base: './',
  resolve: {dedupe: SHARED},
  server: {fs: {allow: [resolve(__dirname, '..')]}},
  build: {
    outDir: 'dist/app',
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        popup: resolve(__dirname, 'popup.html'),
        unlock: resolve(__dirname, 'unlock.html'),
      },
      output: {
        // The manifest names background.js; a hash there would change the manifest.
        entryFileNames: chunk => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  worker: {format: 'es'},
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'manifest/**/*.test.mjs', 'scripts/**/*.test.mjs', '../core/keys/**/*.test.ts'],
  },
} as UserConfig);
```

- [ ] **Step 3: Write the failing manifest test**

`extension/manifest/__tests__/source.test.mjs`:
```js
import {render, PERMISSIONS, HOST_PERMISSIONS, EXTENSION_CSP} from '../source.mjs';

describe('manifest source', () => {
  it('asks for exactly storage and alarms, each with a reason', () => {
    expect(PERMISSIONS.map(p => p.value)).toEqual(['storage', 'alarms']);
    for (const p of [...PERMISSIONS, ...HOST_PERMISSIONS]) expect(p.reason.length).toBeGreaterThan(20);
  });

  it('asks for exactly the two noc-tura hosts', () => {
    expect(HOST_PERMISSIONS.map(p => p.value)).toEqual([
      'https://api.noc-tura.io/*',
      'https://wallet.noc-tura.io/*',
    ]);
  });

  it('forbids eval and remote script in extension pages', () => {
    expect(EXTENSION_CSP).toBe("script-src 'self'; object-src 'self'");
  });

  it('renders a Chrome MV3 service worker', () => {
    const m = render('chrome');
    expect(m.manifest_version).toBe(3);
    expect(m.background).toEqual({service_worker: 'background.js', type: 'module'});
    expect(m.minimum_chrome_version).toBe('122');
    expect(m.browser_specific_settings).toBeUndefined();
  });

  it('renders a Firefox MV3 event page with the fields AMO requires', () => {
    const m = render('firefox');
    expect(m.background).toEqual({scripts: ['background.js'], type: 'module'});
    expect(m.browser_specific_settings.gecko.id).toBe('wallet@noc-tura.io');
    expect(m.browser_specific_settings.gecko.strict_min_version).toBe('150.0');
    expect(m.browser_specific_settings.gecko.data_collection_permissions.required.length).toBeGreaterThan(0);
  });

  it('gives both browsers the same permissions, hosts, CSP and pages', () => {
    const c = render('chrome');
    const f = render('firefox');
    for (const k of ['permissions', 'host_permissions', 'content_security_policy', 'action', 'name', 'version']) {
      expect(f[k]).toEqual(c[k]);
    }
  });

  it('control: an extra permission would be seen', () => {
    const m = render('chrome');
    m.permissions.push('tabs');
    expect(m.permissions).not.toEqual(PERMISSIONS.map(p => p.value));
  });
});
```
Run: `cd extension && npx vitest run manifest` → FAIL (`Cannot find module '../source.mjs'`).

- [ ] **Step 4: Write the manifest source**

`extension/manifest/source.mjs`:
```js
// The one source for both browsers' manifests, as web/deploy/security-headers.mjs is for
// nginx: every permission and host is here once, with the reason a store reviewer and a
// user are owed. The permissions gate (scripts/check-permissions.mjs) compares the built
// manifests against these lists, so a permission cannot arrive by a hand edit.

export const PERMISSIONS = [
  {value: 'storage', reason: 'The encrypted vault (storage.local) and the unlocked per-account signing keys (storage.session, memory only).'},
  {value: 'alarms', reason: 'Auto-lock: the vault locks itself after the chosen idle time, default five minutes.'},
];

export const HOST_PERMISSIONS = [
  {value: 'https://api.noc-tura.io/*', reason: 'Reads through the coordinator RPC proxy, prices, the jurisdiction check and broadcast — readable without CORS.'},
  {value: 'https://wallet.noc-tura.io/*', reason: 'The passkey relying-party ID: an extension may claim an RP ID only for a host it has permission for.'},
];

export const EXTENSION_CSP = "script-src 'self'; object-src 'self'";

const VERSION = '0.1.0';

function base() {
  return {
    manifest_version: 3,
    name: 'Noctura',
    version: VERSION,
    description: 'Noctura wallet for Solana.',
    permissions: PERMISSIONS.map(p => p.value),
    host_permissions: HOST_PERMISSIONS.map(p => p.value),
    content_security_policy: {extension_pages: EXTENSION_CSP},
    action: {default_popup: 'popup.html', default_title: 'Noctura'},
  };
}

/** @param {'chrome' | 'firefox'} browser */
export function render(browser) {
  if (browser === 'chrome') {
    return {...base(), minimum_chrome_version: '122', background: {service_worker: 'background.js', type: 'module'}};
  }
  if (browser === 'firefox') {
    return {
      ...base(),
      background: {scripts: ['background.js'], type: 'module'},
      browser_specific_settings: {
        gecko: {
          id: 'wallet@noc-tura.io',
          strict_min_version: '150.0',
          // Truthful, per spec §5: public addresses and transactions go to the coordinator.
          // The exact category list is re-checked against AMO's current taxonomy in B1e,
          // before the first submission.
          data_collection_permissions: {required: ['financialAndPaymentInfo']},
        },
      },
    };
  }
  throw new Error(`unknown browser ${browser}`);
}
```
Run: `npx vitest run manifest` → PASS (7 tests).

- [ ] **Step 5: Pages, background stub and the build script**

`extension/popup.html` and `extension/unlock.html` (same shape; `unlock.html` uses `src/unlock/main.ts` and title "Noctura — unlock"):
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Noctura</title>
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="./src/popup/main.ts"></script>
  </body>
</html>
```
`extension/src/popup/main.ts` (replaced in Task 10):
```ts
const app = document.getElementById('app');
if (app) app.textContent = 'Noctura';
```
`extension/src/unlock/main.ts` (replaced in Task 10):
```ts
const app = document.getElementById('app');
if (app) app.textContent = 'Noctura — unlock';
```
`extension/src/background/index.ts` (replaced in Task 9):
```ts
export {};
```

`extension/scripts/build.mjs`:
```js
#!/usr/bin/env node
// vite build once into dist/app, then one directory per browser: the same files plus that
// browser's manifest. The JS is identical across browsers by construction, so a reviewer
// comparing the two packages sees only the manifest differ.
import {execFileSync} from 'node:child_process';
import {cpSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {render} from '../manifest/source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, 'dist');
const app = join(outRoot, 'app');

execFileSync('npx', ['vite', 'build', '--outDir', app, '--emptyOutDir'], {cwd: ROOT, stdio: 'inherit'});

for (const browser of ['chrome', 'firefox']) {
  const dir = join(outRoot, browser);
  rmSync(dir, {recursive: true, force: true});
  mkdirSync(dir, {recursive: true});
  cpSync(app, dir, {recursive: true});
  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(render(browser), null, 2)}\n`);
}
```
Run: `npm run build && ls dist/chrome dist/firefox` → both contain `manifest.json`, `background.js`, `popup.html`, `unlock.html`, `assets/`.

- [ ] **Step 6: Commit**
```bash
git add extension/ jest.config.js tsconfig.json
git commit -m "feat(extension): the package, one manifest source for two browsers, and a build that renders both"
```

---

### Task 2: The gates — CSP, permissions, reproducibility — and CI

**Files:**
- Create: `extension/scripts/check-csp.mjs`, `extension/scripts/check-permissions.mjs`, `extension/scripts/verify-reproducible.mjs`
- Create: `extension/scripts/__tests__/check-permissions.test.mjs`
- Create: `.github/workflows/extension.yml`

**Interfaces:**
- Consumes: `render`, `PERMISSIONS`, `HOST_PERMISSIONS` (Task 1); `checkHtml`, `checkJs` from `web/scripts/check-csp.mjs`; `buildManifest` from `web/scripts/build-manifest.mjs`.
- Produces: `comparePermissions(manifest, browser): string[]` (list of problems, empty = OK).

- [ ] **Step 1: Failing permissions test**

`extension/scripts/__tests__/check-permissions.test.mjs`:
```js
import {comparePermissions} from '../check-permissions.mjs';
import {render} from '../../manifest/source.mjs';

describe('permissions gate', () => {
  it('accepts the rendered manifests', () => {
    expect(comparePermissions(render('chrome'), 'chrome')).toEqual([]);
    expect(comparePermissions(render('firefox'), 'firefox')).toEqual([]);
  });

  it('refuses an added permission', () => {
    const m = render('chrome');
    m.permissions = [...m.permissions, 'tabs'];
    expect(comparePermissions(m, 'chrome')).toEqual(['permissions differ: storage,alarms,tabs']);
  });

  it('refuses an added host', () => {
    const m = render('firefox');
    m.host_permissions = [...m.host_permissions, '<all_urls>'];
    expect(comparePermissions(m, 'firefox')[0]).toMatch(/^host_permissions differ/);
  });

  it('refuses a loosened CSP', () => {
    const m = render('chrome');
    m.content_security_policy = {extension_pages: "script-src 'self' 'unsafe-eval'"};
    expect(comparePermissions(m, 'chrome')[0]).toMatch(/^CSP differs/);
  });

  it('refuses a Firefox manifest without gecko.id', () => {
    const m = render('firefox');
    delete m.browser_specific_settings.gecko.id;
    expect(comparePermissions(m, 'firefox')).toContain('firefox: gecko.id missing');
  });
});
```
Run: `npx vitest run scripts` → FAIL (module not found).

- [ ] **Step 2: Implement the permissions gate**

`extension/scripts/check-permissions.mjs`:
```js
#!/usr/bin/env node
// The built manifests must say exactly what manifest/source.mjs says. A permission that
// arrives by a hand edit of dist/ — or by a future generator bug — fails here.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {PERMISSIONS, HOST_PERMISSIONS, EXTENSION_CSP} from '../manifest/source.mjs';

export function comparePermissions(manifest, browser) {
  const problems = [];
  const want = PERMISSIONS.map(p => p.value).join(',');
  const got = (manifest.permissions ?? []).join(',');
  if (got !== want) problems.push(`permissions differ: ${got}`);
  const wantHosts = HOST_PERMISSIONS.map(p => p.value).join(',');
  const gotHosts = (manifest.host_permissions ?? []).join(',');
  if (gotHosts !== wantHosts) problems.push(`host_permissions differ: ${gotHosts}`);
  if (manifest.content_security_policy?.extension_pages !== EXTENSION_CSP) {
    problems.push(`CSP differs: ${manifest.content_security_policy?.extension_pages}`);
  }
  if (manifest.content_scripts !== undefined) problems.push('content_scripts present (not before B1c)');
  if (browser === 'firefox') {
    const gecko = manifest.browser_specific_settings?.gecko;
    if (!gecko?.id) problems.push('firefox: gecko.id missing');
    if (!gecko?.data_collection_permissions) problems.push('firefox: data_collection_permissions missing');
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let bad = 0;
  for (const browser of ['chrome', 'firefox']) {
    const m = JSON.parse(readFileSync(join('dist', browser, 'manifest.json'), 'utf8'));
    for (const p of comparePermissions(m, browser)) {
      console.error(`${browser}: ${p}`);
      bad += 1;
    }
  }
  if (bad) process.exit(1);
  console.log('permissions ok: both manifests match manifest/source.mjs');
}
```
Run: `npx vitest run scripts` → PASS (5).

- [ ] **Step 3: CSP gate and reproducibility, reusing web's checked implementations**

`extension/scripts/check-csp.mjs`:
```js
#!/usr/bin/env node
// Same rules as web/: no inline script or style in the HTML, no eval / new Function in the
// JS. Imported rather than copied, so the two gates cannot drift apart.
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {checkHtml, checkJs} from '../../web/scripts/check-csp.mjs';

const root = process.argv[2] ?? 'dist/app';
const problems = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (entry.endsWith('.html')) problems.push(...checkHtml(readFileSync(p, 'utf8')).map(x => `${p}: ${x}`));
    else if (entry.endsWith('.js')) problems.push(...checkJs(readFileSync(p, 'utf8')).map(x => `${p}: ${x}`));
  }
}
walk(root);
if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`CSP ok: ${root} needs no unsafe-inline or unsafe-eval`);
```
`checkHtml` and `checkJs` in `web/scripts/check-csp.mjs` return arrays of finding strings (read 2026-09-28); do not change web's script.

`extension/scripts/verify-reproducible.mjs`:
```js
#!/usr/bin/env node
// Two full builds (both browsers) into temp dirs; each browser's digest must match.
import {mkdtempSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildManifest} from '../../web/scripts/build-manifest.mjs';

const dirs = [mkdtempSync(join(tmpdir(), 'noctura-ext-a-')), mkdtempSync(join(tmpdir(), 'noctura-ext-b-'))];
try {
  for (const d of dirs) execFileSync('node', ['scripts/build.mjs', d], {stdio: 'inherit'});
  let bad = 0;
  for (const browser of ['chrome', 'firefox']) {
    const [a, b] = dirs.map(d => buildManifest(join(d, browser)));
    if (a.files.length === 0) {
      console.error(`INCONCLUSIVE: ${browser} build is empty`);
      process.exit(2);
    }
    if (a.digest !== b.digest) {
      console.error(`NOT REPRODUCIBLE: ${browser} sha256:${a.digest} vs sha256:${b.digest}`);
      bad += 1;
    } else console.log(`reproducible: ${browser} ${a.files.length} files sha256:${a.digest}`);
  }
  if (bad) process.exit(1);
} finally {
  for (const d of dirs) rmSync(d, {recursive: true, force: true});
}
```
`npm run gates` runs only `check-permissions.mjs` until Task 11 adds the vault-isolation check.

Run: `npm run verify` → PASS; prints two `reproducible:` lines with equal digests per browser.

- [ ] **Step 4: CI**

`.github/workflows/extension.yml`:
```yaml
name: extension

on:
  pull_request:
    paths: ['extension/**', 'core/**', 'web/scripts/**', '.github/workflows/extension.yml']
  push:
    branches: [main]
    paths: ['extension/**', 'core/**', 'web/scripts/**', '.github/workflows/extension.yml']

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.12.0'
          cache: npm
          cache-dependency-path: extension/package-lock.json
      # Same pin as ci.yml/web.yml: the lockfile is written by npm 11.6.2.
      - run: npm install -g npm@11.6.2
      # Only extension/ is installed: core/ resolves through this package's node_modules.
      - run: npm ci
        working-directory: extension
      - run: npm run verify
        working-directory: extension
```

- [ ] **Step 5: Commit**
```bash
git add extension/scripts .github/workflows/extension.yml extension/package.json
git commit -m "ci(extension): CSP, permissions and reproducibility gates, and a workflow that runs them"
```

---

### Task 3: Key derivation into `core/keys`

**Files:**
- Create: `core/util/zeroize.ts`, `core/keys/transparent.ts`, `core/keys/mnemonic.ts`
- Create: `core/keys/__tests__/transparent.test.ts`, `core/keys/__tests__/mnemonic.test.ts`
- Modify: `src/modules/keyDerivation/transparent.ts`, `src/modules/keyDerivation/mnemonicUtils.ts` (become re-exports)
- Modify: `web/tsconfig.json` (`include`), `web/vite.config.ts` (`test.include`), `web/package.json` (`scan` script)

**Interfaces:**
- Produces (from `core/keys/transparent.ts`): `type TransparentScheme = {kind: 'slip10'; account: number} | {kind: 'cli'}`, `DEFAULT_TRANSPARENT_SCHEME`, `schemeToString`, `schemeFromString`, `schemeLabel`, `deriveTransparentKeypair(seed: Uint8Array, scheme?: TransparentScheme): {publicKey: Uint8Array; secretKey: Uint8Array}`.
- Produces (from `core/keys/mnemonic.ts`): `generateMnemonic(): string`, `normalizeMnemonicInput(s: string): string`, `validateMnemonic(s: string): boolean`, `mnemonicToSeed(s: string): Promise<Uint8Array>`.

- [ ] **Step 1: Failing vector tests (vitest, in the extension package)**

`core/keys/__tests__/transparent.test.ts`:
```ts
import {deriveTransparentKeypair, schemeFromString, schemeToString} from '../transparent';
import {mnemonicToSeed} from '../mnemonic';

// The same pinned vectors as the app's src/modules/keyDerivation/__tests__/transparent.test.ts:
// the extension must derive the Android app's addresses from the same seed.
const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

describe('core/keys/transparent', () => {
  let seed: Uint8Array;
  beforeAll(async () => {
    seed = await mnemonicToSeed(MNEMONIC);
  });

  it("slip10 account 0 matches Phantom/Solflare (m/44'/501'/0'/0')", () => {
    expect(hex(deriveTransparentKeypair(seed).publicKey)).toBe(
      'f036276246a75b9de3349ed42b15e232f6518fc20f5fcd4f1d64e81f9bd258f7',
    );
  });

  it('slip10 account 1 matches the pinned vector', () => {
    expect(hex(deriveTransparentKeypair(seed, {kind: 'slip10', account: 1}).publicKey)).toBe(
      'f8029acf5cbcbdd5ac46ec147f3b78a3df6e5022ef0411db2bab650d329a4cd4',
    );
  });

  it('cli matches solana-keygen raw seed', () => {
    expect(hex(deriveTransparentKeypair(seed, {kind: 'cli'}).publicKey)).toBe(
      'c5785e1865b708938aff8161d573006496663b1aa10834e396dc566869a2c66a',
    );
  });

  it('secretKey is private (32) + public (32)', () => {
    const kp = deriveTransparentKeypair(seed);
    expect(kp.secretKey.length).toBe(64);
    expect(hex(kp.secretKey.subarray(32))).toBe(hex(kp.publicKey));
  });

  it('scheme strings round-trip', () => {
    expect(schemeFromString(schemeToString({kind: 'slip10', account: 3}))).toEqual({kind: 'slip10', account: 3});
    expect(schemeFromString('cli')).toEqual({kind: 'cli'});
    expect(schemeFromString('garbage')).toEqual({kind: 'slip10', account: 0});
  });
});
```

`core/keys/__tests__/mnemonic.test.ts`:
```ts
import {generateMnemonic, normalizeMnemonicInput, validateMnemonic} from '../mnemonic';

describe('core/keys/mnemonic', () => {
  it('generates 24 valid words', () => {
    const m = generateMnemonic();
    expect(m.split(' ')).toHaveLength(24);
    expect(validateMnemonic(m)).toBe(true);
  });

  it('accepts 12 words and keyboard artifacts', () => {
    const m = 'Abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about.';
    expect(validateMnemonic(m)).toBe(true);
    expect(normalizeMnemonicInput(m)).toBe(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    );
  });

  it('rejects a bad checksum', () => {
    expect(
      validateMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon'),
    ).toBe(false);
  });
});
```
Run: `cd extension && npx vitest run ../core/keys` → FAIL (modules not found).

- [ ] **Step 2: Move the code**

`core/util/zeroize.ts`:
```ts
/** Fill a byte array with zeros — best effort; JavaScript cannot guarantee no copies remain. */
export function zeroize(data: Uint8Array | null | undefined): void {
  if (!data) return;
  data.fill(0);
}
```
`core/keys/transparent.ts`: the **entire current contents** of `src/modules/keyDerivation/transparent.ts`, with one line changed: `import {zeroize} from '../session/zeroize';` → `import {zeroize} from '../util/zeroize';`. Use `git mv`-free copy so the app file can become a shim:
```bash
cp src/modules/keyDerivation/transparent.ts core/keys/transparent.ts
sed -i "s#from '../session/zeroize'#from '../util/zeroize'#" core/keys/transparent.ts
cp src/modules/keyDerivation/mnemonicUtils.ts core/keys/mnemonic.ts
```
Then replace the comment in `core/keys/mnemonic.ts` "Uses crypto.getRandomValues() via polyfill (loaded in index.js)." with "Uses crypto.getRandomValues(): native in browsers and Node, a polyfill in the app (index.js)."

App shims — `src/modules/keyDerivation/transparent.ts`:
```ts
// Moved to core/keys so the app and the browser extension derive keys with one piece of
// code. This re-export keeps every existing import in the app unchanged.
export * from '../../../core/keys/transparent';
```
`src/modules/keyDerivation/mnemonicUtils.ts`:
```ts
// Moved to core/keys (shared with the browser extension); re-exported unchanged.
export * from '../../../core/keys/mnemonic';
```

- [ ] **Step 3: Keep `web/` from compiling, testing and scanning key code**

`web/` does not depend on `@scure/bip39` or `micro-key-producer`, and its source secret scan forbids `mnemonic`/`privateKey` — correctly, for a page that must never hold a key. So `core/keys` is outside web's scope:
- `web/tsconfig.json` `include`: replace `"../core"` with `"../core/presale", "../core/geo", "../core/portfolio", "../core/referral", "../core/solana", "../core/util", "../core/ports.ts"`.
- `web/vite.config.ts` `test.include`: replace `'../core/**/*.test.ts'` with `'../core/{presale,geo,portfolio,referral,solana,util}/**/*.test.ts'`.
- `web/package.json` `scan`: replace `src ../core` with `src ../core/presale ../core/geo ../core/portfolio ../core/referral ../core/solana ../core/util ../core/ports.ts`.
- Add a web test proving the fence holds, `web/src/__tests__/no-keys-in-web.test.ts`:
```ts
import {execFileSync} from 'node:child_process';

it('no web source imports core/keys', () => {
  let out = '';
  try {
    out = execFileSync('grep', ['-rln', 'core/keys', 'src'], {encoding: 'utf8'});
  } catch {
    out = ''; // grep exits 1 when nothing matches — the passing case
  }
  expect(out.split('\n').filter(l => l && !l.endsWith('no-keys-in-web.test.ts'))).toEqual([]);
});
```

- [ ] **Step 4: Run all three consumers**

Run, from the repo root:
- `cd extension && npx vitest run ../core/keys` → PASS (8).
- `cd .. && npx jest src/modules/keyDerivation` → PASS (the app's own vectors, now through the shim).
- `npx tsc --noEmit` → clean.
- `cd web && npm run verify` → green; the reproducible digest is unchanged (no web code changed).

- [ ] **Step 5: Commit**
```bash
git add core/util core/keys src/modules/keyDerivation/transparent.ts src/modules/keyDerivation/mnemonicUtils.ts web/tsconfig.json web/vite.config.ts web/package.json web/src/__tests__/no-keys-in-web.test.ts
git commit -m "refactor(core): key derivation moves to core/keys, shared by the app and the extension"
```

---

### Task 4: The stale-list rule and the presale geo gate in `core/geo`

**Files:**
- Create: `core/geo/freshness.ts`, `core/geo/__tests__/freshness.test.ts`

**Interfaces:**
- Consumes: `JurisdictionResult` from `core/geo/classify.ts`.
- Produces:
  - `interface ListMeta {source: 'server' | 'bundled'; updatedAt?: string; reviewedAt?: string; maxStalenessDays?: number; serverStale?: boolean}`
  - `evaluateListFreshness(meta: ListMeta, now: Date): {stale: boolean; reason: 'bundled' | 'no_dates' | 'too_old' | 'server_says_stale' | null; ageDays: number | null}`
  - `presaleGeoGate(input: {freshness: ReturnType<typeof evaluateListFreshness>; jurisdiction: JurisdictionResult | null}): {open: boolean; reason: 'stale_list' | 'unknown_country' | 'sanctioned' | 'no_check' | null}`

- [ ] **Step 1: Failing tests**

`core/geo/__tests__/freshness.test.ts`:
```ts
import {evaluateListFreshness, presaleGeoGate} from '../freshness';
import type {JurisdictionResult} from '../classify';

const NOW = new Date('2026-09-28T12:00:00Z');
const fresh = {source: 'server' as const, updatedAt: '2026-09-20', reviewedAt: '2026-09-20', maxStalenessDays: 30, serverStale: false};
const allow: JurisdictionResult = {action: 'allow', countryCode: 'SI', transparentAllowed: true};

describe('evaluateListFreshness', () => {
  it('a server list inside its limit is fresh', () => {
    expect(evaluateListFreshness(fresh, NOW)).toEqual({stale: false, reason: null, ageDays: 8});
  });
  it('the bundled fallback is always stale', () => {
    expect(evaluateListFreshness({source: 'bundled', updatedAt: '2026-09-27'}, NOW).reason).toBe('bundled');
  });
  it('missing dates are stale', () => {
    expect(evaluateListFreshness({source: 'server', maxStalenessDays: 30, serverStale: false}, NOW).reason).toBe('no_dates');
  });
  it('unparsable dates are stale', () => {
    expect(evaluateListFreshness({...fresh, updatedAt: 'soon', reviewedAt: 'soon'}, NOW).reason).toBe('no_dates');
  });
  it('a missing limit is stale', () => {
    expect(evaluateListFreshness({...fresh, maxStalenessDays: undefined}, NOW).stale).toBe(true);
  });
  it('server stale:false never overrides a local age above the limit', () => {
    const r = evaluateListFreshness({...fresh, updatedAt: '2026-04-04', reviewedAt: '2026-04-04'}, NOW);
    expect(r).toMatchObject({stale: true, reason: 'too_old'});
  });
  it('server stale:true is stale even when young', () => {
    expect(evaluateListFreshness({...fresh, serverStale: true}, NOW).reason).toBe('server_says_stale');
  });
  it('uses the later of updatedAt and reviewedAt', () => {
    expect(evaluateListFreshness({...fresh, updatedAt: '2026-04-04', reviewedAt: '2026-09-25'}, NOW).stale).toBe(false);
  });
});

describe('presaleGeoGate', () => {
  const ok = evaluateListFreshness(fresh, NOW);
  it('opens for a fresh list and an allowed country (positive control)', () => {
    expect(presaleGeoGate({freshness: ok, jurisdiction: allow})).toEqual({open: true, reason: null});
  });
  it('closes on a stale list', () => {
    expect(presaleGeoGate({freshness: evaluateListFreshness({source: 'bundled'}, NOW), jurisdiction: allow}).reason).toBe('stale_list');
  });
  it('closes when the check did not happen', () => {
    expect(presaleGeoGate({freshness: ok, jurisdiction: null}).reason).toBe('no_check');
  });
  it.each(['', 'XX', 'UNKNOWN', 'zz', 'S'])('closes on unknown country code %j', code => {
    expect(presaleGeoGate({freshness: ok, jurisdiction: {...allow, countryCode: code}}).reason).toBe('unknown_country');
  });
  it('closes on a sanctioned block', () => {
    expect(
      presaleGeoGate({freshness: ok, jurisdiction: {action: 'block', countryCode: 'IR', reason: 'sanctioned', transparentAllowed: true}}).reason,
    ).toBe('sanctioned');
  });
});
```
Run: `cd web && npx vitest run ../core/geo` → FAIL.

- [ ] **Step 2: Implement**

`core/geo/freshness.ts`:
```ts
import type {JurisdictionResult} from './classify';

/**
 * Whether the sanctions list a purchase is judged against is fresh enough to sell on.
 *
 * Fails closed on purpose (spec §4, owner decision 2026-09-27): the app once ran five
 * months on its bundled fallback because the list endpoint 404'd silently. So the bundled
 * list is always stale, missing or unparsable dates are stale, a missing limit is stale,
 * and a server's `stale: false` never overrides an age computed here.
 */
export interface ListMeta {
  source: 'server' | 'bundled';
  updatedAt?: string;
  reviewedAt?: string;
  maxStalenessDays?: number;
  serverStale?: boolean;
}

export interface Freshness {
  stale: boolean;
  reason: 'bundled' | 'no_dates' | 'too_old' | 'server_says_stale' | null;
  ageDays: number | null;
}

const DAY = 86_400_000;

function parseDay(v: string | undefined): number | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const t = Date.parse(v.length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isFinite(t) ? t : null;
}

export function evaluateListFreshness(meta: ListMeta, now: Date): Freshness {
  if (meta.source === 'bundled') return {stale: true, reason: 'bundled', ageDays: null};
  const dates = [parseDay(meta.updatedAt), parseDay(meta.reviewedAt)].filter((t): t is number => t !== null);
  if (dates.length === 0) return {stale: true, reason: 'no_dates', ageDays: null};
  const ageDays = Math.floor((now.getTime() - Math.max(...dates)) / DAY);
  const limit = meta.maxStalenessDays;
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0 || ageDays > limit) {
    return {stale: true, reason: 'too_old', ageDays};
  }
  if (meta.serverStale === true) return {stale: true, reason: 'server_says_stale', ageDays};
  return {stale: false, reason: null, ageDays};
}

export interface GeoGate {
  open: boolean;
  reason: 'stale_list' | 'unknown_country' | 'sanctioned' | 'no_check' | null;
}

/** ISO 3166-1 alpha-2, and not the placeholders geolocation services use for "unknown". */
function isKnownCountry(code: string): boolean {
  return /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'ZZ';
}

export function presaleGeoGate(input: {freshness: Freshness; jurisdiction: JurisdictionResult | null}): GeoGate {
  if (input.freshness.stale) return {open: false, reason: 'stale_list'};
  if (input.jurisdiction === null) return {open: false, reason: 'no_check'};
  if (!isKnownCountry(input.jurisdiction.countryCode)) return {open: false, reason: 'unknown_country'};
  if (input.jurisdiction.action === 'block') return {open: false, reason: 'sanctioned'};
  return {open: true, reason: null};
}
```
Run: `npx vitest run ../core/geo` → PASS. Mutation: change `ageDays > limit` to `ageDays > limit + 1000` → "server stale:false never overrides" must FAIL; revert.

- [ ] **Step 3: Commit**
```bash
git add core/geo/freshness.ts core/geo/__tests__/freshness.test.ts
git commit -m "feat(core): a sanctions list that is not provably fresh closes the presale"
```

---

### Task 5: The vault envelope

**Files:**
- Create: `extension/src/vault/bytes.ts`, `extension/src/vault/envelope.ts`, `extension/src/vault/__tests__/envelope.test.ts`

**Interfaces:**
- Produces:
  - `b64(bytes: Uint8Array): string`, `unb64(s: string): Uint8Array`, `utf8(s: string): Uint8Array` (`bytes.ts`)
  - `interface KdfParams {m: number; t: number; p: number}`; `PRODUCTION_KDF: KdfParams = {m: 65536, t: 3, p: 1}`
  - `type Kdf = (password: string, salt: Uint8Array, params: KdfParams) => Promise<Uint8Array>` (32 bytes)
  - `interface EnvelopeV1 {v: 1; scheme: 'slip10' | 'cli'; kdf: {alg: 'argon2id'} & KdfParams & {salt: string}; seed: {iv: string; ct: string}; password: {wrapped: string}; passkey?: {credentialId: string; prfSalt: string; wrapped: string}; accounts: {index: number; name: string; publicKey: string}[]}`
  - `createEnvelope(input: {mnemonic: string; password: string; scheme: 'slip10' | 'cli'; accounts: EnvelopeV1['accounts']; kdf: Kdf; params?: KdfParams}): Promise<EnvelopeV1>`
  - `unlockWithPassword(env: EnvelopeV1, password: string, kdf: Kdf): Promise<Uint8Array>` → the 32-byte data key; throws `WrongPassword`
  - `decryptMnemonic(env: EnvelopeV1, dataKey: Uint8Array): Promise<string>`
  - `addPasskeyWrap(env: EnvelopeV1, dataKey: Uint8Array, prfOutput: Uint8Array, credentialId: Uint8Array, prfSalt: Uint8Array): Promise<EnvelopeV1>`
  - `unlockWithPrf(env: EnvelopeV1, prfOutput: Uint8Array): Promise<Uint8Array>` → data key; throws `WrongPasskey`
  - `class WrongPassword extends Error`, `class WrongPasskey extends Error`

- [ ] **Step 1: Failing tests** (fast KDF injected; production params checked separately)

`extension/src/vault/__tests__/envelope.test.ts`:
```ts
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {
  createEnvelope, unlockWithPassword, decryptMnemonic, addPasskeyWrap, unlockWithPrf,
  WrongPassword, WrongPasskey, PRODUCTION_KDF, type Kdf,
} from '../envelope';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
// Tiny parameters for speed; the production parameters are asserted below, not exercised.
const kdf: Kdf = (pw, salt, p) => argon2idAsync(pw, salt, {m: p.m, t: p.t, p: p.p, dkLen: 32});
const FAST = {m: 64, t: 1, p: 1};
const accounts = [{index: 0, name: 'Account 1', publicKey: 'x'}];

describe('vault envelope', () => {
  it('production Argon2id parameters are the spec values', () => {
    expect(PRODUCTION_KDF).toEqual({m: 65536, t: 3, p: 1});
  });

  it('round-trips the mnemonic with the right password', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    expect(await decryptMnemonic(env, dk)).toBe(MNEMONIC);
  });

  it('refuses the wrong password', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    await expect(unlockWithPassword(env, 'wrong horse battery!', kdf)).rejects.toBeInstanceOf(WrongPassword);
  });

  it('stores nothing in the clear', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    const json = JSON.stringify(env);
    expect(json).not.toContain('abandon');
    expect(json).not.toContain('correct horse');
  });

  it('two envelopes of one seed share no salt, IV or ciphertext', async () => {
    const a = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    const b = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.seed.iv).not.toBe(b.seed.iv);
    expect(a.seed.ct).not.toBe(b.seed.ct);
  });

  it('a passkey wrap unlocks the same data key; a different PRF output does not', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const withPk = await addPasskeyWrap(env, dk, prf, new Uint8Array([1, 2, 3]), crypto.getRandomValues(new Uint8Array(32)));
    expect(await decryptMnemonic(withPk, await unlockWithPrf(withPk, prf))).toBe(MNEMONIC);
    await expect(unlockWithPrf(withPk, crypto.getRandomValues(new Uint8Array(32)))).rejects.toBeInstanceOf(WrongPasskey);
  });

  it('refuses a tampered ciphertext', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: FAST});
    const dk = await unlockWithPassword(env, 'correct horse battery', kdf);
    const ct = env.seed.ct;
    const flipped = {...env, seed: {...env.seed, ct: (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1)}};
    await expect(decryptMnemonic(flipped, dk)).rejects.toThrow();
  });
});
```
Run: `cd extension && npx vitest run src/vault` → FAIL.

- [ ] **Step 2: Implement**

`extension/src/vault/bytes.ts`:
```ts
import {base64} from '@scure/base';

export const b64 = (bytes: Uint8Array): string => base64.encode(bytes);
export const unb64 = (s: string): Uint8Array => base64.decode(s);
export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
```

`extension/src/vault/envelope.ts`:
```ts
import {b64, unb64, utf8} from './bytes';

/**
 * The vault on disk: the seed encrypted once with a random data key (AES-256-GCM), and the
 * data key wrapped once per unlock factor — password through Argon2id, passkey through PRF
 * and HKDF (spec §2). Nothing here is ever in the clear; this module is imported only by
 * the vault page (unlock.html) and its worker, enforced by scripts/check-vault-isolation.mjs.
 */
export interface KdfParams {
  m: number;
  t: number;
  p: number;
}
export const PRODUCTION_KDF: KdfParams = {m: 65536, t: 3, p: 1};
export type Kdf = (password: string, salt: Uint8Array, params: KdfParams) => Promise<Uint8Array>;

export interface EnvelopeV1 {
  v: 1;
  scheme: 'slip10' | 'cli';
  kdf: {alg: 'argon2id'; m: number; t: number; p: number; salt: string};
  seed: {iv: string; ct: string};
  password: {wrapped: string};
  passkey?: {credentialId: string; prfSalt: string; wrapped: string};
  accounts: {index: number; name: string; publicKey: string}[];
}

export class WrongPassword extends Error {
  constructor() {
    super('wrong password');
  }
}
export class WrongPasskey extends Error {
  constructor() {
    super('this passkey does not unlock this wallet');
  }
}

const HKDF_INFO = utf8('noctura-ext-v1/passkey-wrap');
const subtle = () => globalThis.crypto.subtle;
const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

async function aesKw(kekBytes: Uint8Array): Promise<CryptoKey> {
  return subtle().importKey('raw', kekBytes, 'AES-KW', false, ['wrapKey', 'unwrapKey']);
}

async function wrap(dataKey: Uint8Array, kekBytes: Uint8Array): Promise<string> {
  const dk = await subtle().importKey('raw', dataKey, 'AES-GCM', true, ['encrypt', 'decrypt']);
  return b64(new Uint8Array(await subtle().wrapKey('raw', dk, await aesKw(kekBytes), 'AES-KW')));
}

async function unwrap(wrapped: string, kekBytes: Uint8Array): Promise<Uint8Array> {
  const dk = await subtle().unwrapKey('raw', unb64(wrapped), await aesKw(kekBytes), 'AES-KW', 'AES-GCM', true, ['encrypt', 'decrypt']);
  return new Uint8Array(await subtle().exportKey('raw', dk));
}

async function prfKek(prfOutput: Uint8Array, prfSalt: Uint8Array): Promise<Uint8Array> {
  const ikm = await subtle().importKey('raw', prfOutput, 'HKDF', false, ['deriveBits']);
  const bits = await subtle().deriveBits({name: 'HKDF', hash: 'SHA-256', salt: prfSalt, info: HKDF_INFO}, ikm, 256);
  return new Uint8Array(bits);
}

export async function createEnvelope(input: {
  mnemonic: string;
  password: string;
  scheme: 'slip10' | 'cli';
  accounts: EnvelopeV1['accounts'];
  kdf: Kdf;
  params?: KdfParams;
}): Promise<EnvelopeV1> {
  const params = input.params ?? PRODUCTION_KDF;
  const salt = random(16);
  const dataKey = random(32);
  const iv = random(12);
  const key = await subtle().importKey('raw', dataKey, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await subtle().encrypt({name: 'AES-GCM', iv}, key, utf8(input.mnemonic)));
  const kek = await input.kdf(input.password, salt, params);
  const env: EnvelopeV1 = {
    v: 1,
    scheme: input.scheme,
    kdf: {alg: 'argon2id', ...params, salt: b64(salt)},
    seed: {iv: b64(iv), ct: b64(ct)},
    password: {wrapped: await wrap(dataKey, kek)},
    accounts: input.accounts,
  };
  dataKey.fill(0);
  kek.fill(0);
  return env;
}

export async function unlockWithPassword(env: EnvelopeV1, password: string, kdf: Kdf): Promise<Uint8Array> {
  const kek = await kdf(password, unb64(env.kdf.salt), {m: env.kdf.m, t: env.kdf.t, p: env.kdf.p});
  try {
    return await unwrap(env.password.wrapped, kek);
  } catch {
    throw new WrongPassword();
  } finally {
    kek.fill(0);
  }
}

export async function decryptMnemonic(env: EnvelopeV1, dataKey: Uint8Array): Promise<string> {
  const key = await subtle().importKey('raw', dataKey, 'AES-GCM', false, ['decrypt']);
  const pt = await subtle().decrypt({name: 'AES-GCM', iv: unb64(env.seed.iv)}, key, unb64(env.seed.ct));
  return new TextDecoder().decode(pt);
}

export async function addPasskeyWrap(
  env: EnvelopeV1,
  dataKey: Uint8Array,
  prfOutput: Uint8Array,
  credentialId: Uint8Array,
  prfSalt: Uint8Array,
): Promise<EnvelopeV1> {
  const kek = await prfKek(prfOutput, prfSalt);
  const wrapped = await wrap(dataKey, kek);
  kek.fill(0);
  return {...env, passkey: {credentialId: b64(credentialId), prfSalt: b64(prfSalt), wrapped}};
}

export async function unlockWithPrf(env: EnvelopeV1, prfOutput: Uint8Array): Promise<Uint8Array> {
  if (!env.passkey) throw new WrongPasskey();
  const kek = await prfKek(prfOutput, unb64(env.passkey.prfSalt));
  try {
    return await unwrap(env.passkey.wrapped, kek);
  } catch {
    throw new WrongPasskey();
  } finally {
    kek.fill(0);
  }
}
```
Run: `npx vitest run src/vault` → PASS (7). Mutation: make `unwrap` return `kekBytes` instead of the unwrapped key → "refuses the wrong password" must FAIL; revert.

- [ ] **Step 3: Commit**
```bash
git add extension/src/vault/bytes.ts extension/src/vault/envelope.ts extension/src/vault/__tests__/envelope.test.ts
git commit -m "feat(extension): the vault envelope — one data key, wrapped by password and by passkey"
```

---

### Task 6: Argon2id in a worker

**Files:**
- Create: `extension/src/vault/kdf.ts`, `extension/src/vault/kdf.worker.ts`, `extension/src/vault/__tests__/kdf.test.ts`

**Interfaces:**
- Consumes: `Kdf`, `KdfParams` (Task 5).
- Produces: `argon2idKdf: Kdf` (runs on the calling thread — used by tests and by the worker), `workerKdf: Kdf` (posts to `kdf.worker.ts`).

- [ ] **Step 1: Failing test** — a published Argon2id vector, so the parameters are the library's meaning of them:

`extension/src/vault/__tests__/kdf.test.ts`:
```ts
import {argon2idKdf} from '../kdf';

const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

describe('argon2idKdf', () => {
  it('is deterministic and 32 bytes', async () => {
    const salt = new Uint8Array(16).fill(7);
    const a = await argon2idKdf('password', salt, {m: 64, t: 1, p: 1});
    const b = await argon2idKdf('password', salt, {m: 64, t: 1, p: 1});
    expect(a.length).toBe(32);
    expect(hex(a)).toBe(hex(b));
  });

  it('depends on every input', async () => {
    const salt = new Uint8Array(16).fill(7);
    const base = hex(await argon2idKdf('password', salt, {m: 64, t: 1, p: 1}));
    expect(hex(await argon2idKdf('passwore', salt, {m: 64, t: 1, p: 1}))).not.toBe(base);
    expect(hex(await argon2idKdf('password', new Uint8Array(16).fill(8), {m: 64, t: 1, p: 1}))).not.toBe(base);
    expect(hex(await argon2idKdf('password', salt, {m: 128, t: 1, p: 1}))).not.toBe(base);
    expect(hex(await argon2idKdf('password', salt, {m: 64, t: 2, p: 1}))).not.toBe(base);
  });
});
```
Run: `npx vitest run src/vault/__tests__/kdf` → FAIL.

- [ ] **Step 2: Implement**

`extension/src/vault/kdf.ts`:
```ts
import {argon2idAsync} from '@noble/hashes/argon2.js';
import type {Kdf} from './envelope';

/** Argon2id on the calling thread. In the extension this runs only inside kdf.worker.ts. */
export const argon2idKdf: Kdf = (password, salt, params) =>
  argon2idAsync(password, salt, {m: params.m, t: params.t, p: params.p, dkLen: 32});

/**
 * Argon2id in a Web Worker owned by the vault page. At the production parameters it takes
 * about 3.4 s on a fast laptop; on the page's main thread it would freeze the window, and in
 * the background it would block every message (spec §2).
 */
export const workerKdf: Kdf = (password, salt, params) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./kdf.worker.ts', import.meta.url), {type: 'module'});
    worker.onmessage = (e: MessageEvent<{key?: Uint8Array; error?: string}>) => {
      worker.terminate();
      if (e.data.key) resolve(e.data.key);
      else reject(new Error(e.data.error ?? 'kdf failed'));
    };
    worker.onerror = e => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage({password, salt, params});
  });
```

`extension/src/vault/kdf.worker.ts`:
```ts
import {argon2idKdf} from './kdf';
import type {KdfParams} from './envelope';

self.onmessage = async (e: MessageEvent<{password: string; salt: Uint8Array; params: KdfParams}>) => {
  try {
    const key = await argon2idKdf(e.data.password, e.data.salt, e.data.params);
    self.postMessage({key});
  } catch (err) {
    self.postMessage({error: err instanceof Error ? err.message : 'kdf failed'});
  }
};
```
Run: `npx vitest run src/vault` → PASS. (`workerKdf` is exercised end to end in Task 11's E2E.)

- [ ] **Step 3: Commit**
```bash
git add extension/src/vault/kdf.ts extension/src/vault/kdf.worker.ts extension/src/vault/__tests__/kdf.test.ts
git commit -m "feat(extension): Argon2id runs in the vault page's worker, never on a thread that answers messages"
```

---

### Task 7: Seed → per-account signing keys, and re-authentication as a proof

**Files:**
- Create: `extension/src/vault/accounts.ts`, `extension/src/vault/reauth.ts`
- Create: `extension/src/vault/__tests__/accounts.test.ts`, `extension/src/vault/__tests__/reauth.test.ts`

**Interfaces:**
- Consumes: `deriveTransparentKeypair`, `mnemonicToSeed` (Task 3); `EnvelopeV1`, `Kdf`, `unlockWithPassword`, `unlockWithPrf`, `decryptMnemonic` (Task 5).
- Produces:
  - `interface SessionAccount {index: number; publicKey: string /* base58 */; secretKey: string /* base64, 64 bytes */}`
  - `deriveSessionAccounts(mnemonic: string, scheme: 'slip10' | 'cli', indexes: number[]): Promise<SessionAccount[]>`
  - `proveWithPassword(env, password, kdf, session: SessionAccount[]): Promise<boolean>`; `proveWithPrf(env, prfOutput, session): Promise<boolean>`

- [ ] **Step 1: Failing tests**

`extension/src/vault/__tests__/accounts.test.ts`:
```ts
import {deriveSessionAccounts} from '../accounts';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('deriveSessionAccounts', () => {
  it('gives the Android app addresses for slip10 accounts 0 and 1', async () => {
    const [a0, a1] = await deriveSessionAccounts(MNEMONIC, 'slip10', [0, 1]);
    // base58 of the pinned hex vectors in core/keys/__tests__/transparent.test.ts
    expect(a0?.publicKey).toBe('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    expect(a1?.index).toBe(1);
    expect(a0?.secretKey).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('cli has exactly one account', async () => {
    await expect(deriveSessionAccounts(MNEMONIC, 'cli', [0, 1])).rejects.toThrow(/cli wallet has one account/);
  });
});
```
The base58 constant was computed from the pinned hex vector on 2026-09-28 (`base58.encode(hex f0362762…58f7)` → `HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk`).

`extension/src/vault/__tests__/reauth.test.ts`:
```ts
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {createEnvelope, type Kdf} from '../envelope';
import {deriveSessionAccounts} from '../accounts';
import {proveWithPassword} from '../reauth';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const kdf: Kdf = (pw, salt, p) => argon2idAsync(pw, salt, {m: p.m, t: p.t, p: p.p, dkLen: 32});

describe('re-authentication is a proof', () => {
  it('passes with the right password against the right session', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts: [], kdf, params: {m: 64, t: 1, p: 1}});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await proveWithPassword(env, 'correct horse battery', kdf, session)).toBe(true);
  });

  it('fails with the wrong password', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts: [], kdf, params: {m: 64, t: 1, p: 1}});
    const session = await deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
    expect(await proveWithPassword(env, 'nope nope nope nope', kdf, session)).toBe(false);
  });

  it('fails when the session keys are not this vault\'s (a swapped session)', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts: [], kdf, params: {m: 64, t: 1, p: 1}});
    const foreign = await deriveSessionAccounts(OTHER, 'slip10', [0]);
    expect(await proveWithPassword(env, 'correct horse battery', kdf, foreign)).toBe(false);
  });
});
```
Run: `npx vitest run src/vault` → FAIL.

- [ ] **Step 2: Implement**

`extension/src/vault/accounts.ts`:
```ts
import {base58} from '@scure/base';
import {deriveTransparentKeypair} from '../../../core/keys/transparent';
import {mnemonicToSeed} from '../../../core/keys/mnemonic';
import {b64} from './bytes';

/** What the background holds while unlocked: per-account signing keys, never the seed. */
export interface SessionAccount {
  index: number;
  publicKey: string;
  secretKey: string;
}

export async function deriveSessionAccounts(
  mnemonic: string,
  scheme: 'slip10' | 'cli',
  indexes: number[],
): Promise<SessionAccount[]> {
  if (scheme === 'cli' && (indexes.length !== 1 || indexes[0] !== 0)) {
    throw new Error('a cli wallet has one account');
  }
  const seed = await mnemonicToSeed(mnemonic);
  try {
    return indexes.map(index => {
      const kp = deriveTransparentKeypair(seed, scheme === 'cli' ? {kind: 'cli'} : {kind: 'slip10', account: index});
      const out = {index, publicKey: base58.encode(kp.publicKey), secretKey: b64(kp.secretKey)};
      kp.secretKey.fill(0);
      return out;
    });
  } finally {
    seed.fill(0);
  }
}
```

`extension/src/vault/reauth.ts`:
```ts
import {decryptMnemonic, unlockWithPassword, unlockWithPrf, type EnvelopeV1, type Kdf} from './envelope';
import {deriveSessionAccounts, type SessionAccount} from './accounts';

/**
 * Re-authentication proves the factor, not just that someone clicked (spec §2): unwrap the
 * data key, decrypt the seed, re-derive the session's accounts and require every public key
 * to match what the background holds. A mismatch is a failed proof.
 */
async function matches(env: EnvelopeV1, dataKey: Uint8Array, session: SessionAccount[]): Promise<boolean> {
  const mnemonic = await decryptMnemonic(env, dataKey);
  dataKey.fill(0);
  const derived = await deriveSessionAccounts(mnemonic, env.scheme, session.map(a => a.index));
  return derived.length === session.length && derived.every((d, i) => d.publicKey === session[i]?.publicKey);
}

export async function proveWithPassword(env: EnvelopeV1, password: string, kdf: Kdf, session: SessionAccount[]): Promise<boolean> {
  try {
    return await matches(env, await unlockWithPassword(env, password, kdf), session);
  } catch {
    return false;
  }
}

export async function proveWithPrf(env: EnvelopeV1, prfOutput: Uint8Array, session: SessionAccount[]): Promise<boolean> {
  try {
    return await matches(env, await unlockWithPrf(env, prfOutput), session);
  } catch {
    return false;
  }
}
```
Run: `npx vitest run src/vault` → PASS. Mutation: make `matches` return `true` → the "swapped session" test must FAIL; revert.

- [ ] **Step 3: Commit**
```bash
git add extension/src/vault/accounts.ts extension/src/vault/reauth.ts extension/src/vault/__tests__/accounts.test.ts extension/src/vault/__tests__/reauth.test.ts
git commit -m "feat(extension): session keys per account, and re-authentication that must re-derive them"
```

---

### Task 8: Passkey — create, prove PRF with a get(), unlock

**Files:**
- Create: `extension/src/vault/passkey.ts`, `extension/src/vault/__tests__/passkey.test.ts`

**Interfaces:**
- Produces:
  - `RP_ID = 'wallet.noc-tura.io'`
  - `interface CredentialsApi {create(o: CredentialCreationOptions): Promise<Credential | null>; get(o: CredentialRequestOptions): Promise<Credential | null>}`
  - `registerPasskey(api: CredentialsApi, userHandle: Uint8Array): Promise<{credentialId: Uint8Array; prfSalt: Uint8Array; prfOutput: Uint8Array} | {unsupported: true}>`
  - `evaluatePrf(api: CredentialsApi, credentialId: Uint8Array, prfSalt: Uint8Array): Promise<Uint8Array | null>`

- [ ] **Step 1: Failing tests** with a fake credentials API:

`extension/src/vault/__tests__/passkey.test.ts`:
```ts
import {registerPasskey, evaluatePrf, RP_ID, type CredentialsApi} from '../passkey';

type Opts = {publicKey?: {rp?: {id?: string}; rpId?: string; authenticatorSelection?: {userVerification?: string}; userVerification?: string; extensions?: {prf?: {eval?: {first: BufferSource}}}}};

function fakeApi(prfAtGet: boolean): {api: CredentialsApi; seen: Opts[]} {
  const seen: Opts[] = [];
  const cred = (prf: Uint8Array | null) => ({
    rawId: new Uint8Array([9, 9, 9]).buffer,
    getClientExtensionResults: () => (prf ? {prf: {results: {first: prf.buffer}}} : {prf: {enabled: true}}),
  }) as unknown as Credential;
  return {
    seen,
    api: {
      create: async o => {
        seen.push(o as Opts);
        return cred(null); // PRF not surfaced at create — the Windows Hello case
      },
      get: async o => {
        seen.push(o as Opts);
        return cred(prfAtGet ? new Uint8Array(32).fill(5) : null);
      },
    },
  };
}

describe('passkey', () => {
  it('registers on wallet.noc-tura.io with user verification required', async () => {
    const {api, seen} = fakeApi(true);
    await registerPasskey(api, new Uint8Array(16));
    expect(seen[0]?.publicKey?.rp?.id).toBe(RP_ID);
    expect(seen[0]?.publicKey?.authenticatorSelection?.userVerification).toBe('required');
    expect(seen[1]?.publicKey?.rpId).toBe(RP_ID);
  });

  it('decides PRF support by a get() after create, not by create', async () => {
    const {api} = fakeApi(true);
    const r = await registerPasskey(api, new Uint8Array(16));
    expect('unsupported' in r).toBe(false);
  });

  it('reports unsupported when get() yields no PRF output', async () => {
    const {api} = fakeApi(false);
    expect(await registerPasskey(api, new Uint8Array(16))).toEqual({unsupported: true});
  });

  it('uses a fresh 32-byte PRF salt per registration', async () => {
    const a = await registerPasskey(fakeApi(true).api, new Uint8Array(16));
    const b = await registerPasskey(fakeApi(true).api, new Uint8Array(16));
    if ('unsupported' in a || 'unsupported' in b) throw new Error('expected support');
    expect(a.prfSalt.length).toBe(32);
    expect(Array.from(a.prfSalt)).not.toEqual(Array.from(b.prfSalt));
  });

  it('evaluatePrf returns null without PRF output', async () => {
    expect(await evaluatePrf(fakeApi(false).api, new Uint8Array([1]), new Uint8Array(32))).toBeNull();
  });
});
```
Run: `npx vitest run src/vault/__tests__/passkey` → FAIL.

- [ ] **Step 2: Implement**

`extension/src/vault/passkey.ts`:
```ts
/**
 * Passkey unlock (spec §2). The RP ID is claimed through the extension's host permission for
 * wallet.noc-tura.io (Chrome 122+, Firefox 150+). This module runs only in a tab — the
 * action popup closes when the credential prompt opens.
 */
export const RP_ID = 'wallet.noc-tura.io';

export interface CredentialsApi {
  create(o: CredentialCreationOptions): Promise<Credential | null>;
  get(o: CredentialRequestOptions): Promise<Credential | null>;
}

type PrfResults = {prf?: {results?: {first?: ArrayBuffer}}};

function prfOutputOf(cred: Credential | null): Uint8Array | null {
  if (!cred || !('getClientExtensionResults' in cred)) return null;
  const ext = (cred as PublicKeyCredential).getClientExtensionResults() as PrfResults;
  const first = ext.prf?.results?.first;
  return first ? new Uint8Array(first) : null;
}

export async function evaluatePrf(api: CredentialsApi, credentialId: Uint8Array, prfSalt: Uint8Array): Promise<Uint8Array | null> {
  const cred = await api.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: RP_ID,
      allowCredentials: [{type: 'public-key', id: credentialId}],
      userVerification: 'required',
      extensions: {prf: {eval: {first: prfSalt}}} as AuthenticationExtensionsClientInputs,
    },
  });
  return prfOutputOf(cred);
}

/**
 * Create a passkey, then prove PRF works with an immediate get(): some authenticators
 * (Windows Hello on older Chrome) surface PRF only on get(), so the create result cannot
 * decide it (spec §2).
 */
export async function registerPasskey(
  api: CredentialsApi,
  userHandle: Uint8Array,
): Promise<{credentialId: Uint8Array; prfSalt: Uint8Array; prfOutput: Uint8Array} | {unsupported: true}> {
  const cred = await api.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: {id: RP_ID, name: 'Noctura'},
      user: {id: userHandle, name: 'Noctura wallet', displayName: 'Noctura wallet'},
      pubKeyCredParams: [
        {type: 'public-key', alg: -7},
        {type: 'public-key', alg: -257},
      ],
      authenticatorSelection: {userVerification: 'required', residentKey: 'preferred'},
      extensions: {prf: {}} as AuthenticationExtensionsClientInputs,
    },
  });
  if (!cred || !('rawId' in cred)) return {unsupported: true};
  const credentialId = new Uint8Array((cred as PublicKeyCredential).rawId);
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));
  const prfOutput = await evaluatePrf(api, credentialId, prfSalt);
  if (!prfOutput) return {unsupported: true};
  return {credentialId, prfSalt, prfOutput};
}
```
Run: `npx vitest run src/vault` → PASS.

- [ ] **Step 3: Commit**
```bash
git add extension/src/vault/passkey.ts extension/src/vault/__tests__/passkey.test.ts
git commit -m "feat(extension): passkeys on wallet.noc-tura.io, PRF proven by a get() rather than assumed"
```

---

### Task 9: The background — browser shim, session keys, message partitions, auto-lock

**Files:**
- Create: `extension/src/ext.ts`
- Create: `extension/src/background/session.ts`, `messages.ts`, `autolock.ts`, and replace `index.ts`
- Create: `extension/src/background/__tests__/{session,messages,autolock}.test.ts`

**Interfaces:**
- Consumes: `SessionAccount` (Task 7).
- Produces:
  - `ext.ts`: `interface Ext {runtimeId: string; extensionOrigin: string; session: KV; local: KV; alarms: {create(name: string, o: {delayInMinutes: number}): void; clear(name: string): Promise<boolean>}; windowCount(): Promise<number>}`, `interface KV {get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void>; remove(key: string): Promise<void>}`, `browserExt(): Ext`
  - `session.ts`: `SESSION_KEY = 'v1_session'`, `setSession(ext, accounts: SessionAccount[]): Promise<void>`, `getSession(ext): Promise<SessionAccount[] | null>`, `clearSession(ext): Promise<void>`
  - `messages.ts`: `type Sender = {id?: string; origin?: string; url?: string; tab?: unknown; frameId?: number}`, `PRIVILEGED = ['vault.setKeys', 'vault.lock', 'vault.status', 'activity.ping'] as const`, `PAGE: readonly string[] = []`, `handleMessage(ext, msg: unknown, sender: Sender): Promise<{ok: true; data?: unknown} | {ok: false; error: string}>`
  - `autolock.ts`: `AUTOLOCK_ALARM = 'autolock'`, `DEFAULT_AUTOLOCK_MINUTES = 5`, `armAutolock(ext): Promise<void>`, `lock(ext): Promise<void>`, `onWindowRemoved(ext): Promise<void>`

- [ ] **Step 1: The shim**

`extension/src/ext.ts`:
```ts
/**
 * The only file that touches `chrome.*` / `browser.*`. Everything else takes an `Ext`, so the
 * background's logic is tested in Node against an in-memory fake, and Chrome's and Firefox's
 * namespaces differ in one place only.
 */
export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface Ext {
  runtimeId: string;
  extensionOrigin: string;
  session: KV;
  local: KV;
  alarms: {create(name: string, o: {delayInMinutes: number}): void; clear(name: string): Promise<boolean>};
  windowCount(): Promise<number>;
}

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}
interface BrowserLike {
  runtime: {id: string; getURL(path: string): string};
  storage: {session: StorageArea; local: StorageArea};
  alarms: {create(name: string, o: {delayInMinutes: number}): void; clear(name: string): Promise<boolean>};
  windows: {getAll(): Promise<unknown[]>};
}

function kv(area: StorageArea): KV {
  return {
    get: async key => (await area.get(key))[key],
    set: (key, value) => area.set({[key]: value}),
    remove: key => area.remove(key),
  };
}

export function browserExt(): Ext {
  const g = globalThis as unknown as {browser?: BrowserLike; chrome?: BrowserLike};
  const b = g.browser ?? g.chrome;
  if (!b) throw new Error('not running in an extension');
  return {
    runtimeId: b.runtime.id,
    extensionOrigin: new URL(b.runtime.getURL('')).origin,
    session: kv(b.storage.session),
    local: kv(b.storage.local),
    alarms: b.alarms,
    windowCount: async () => (await b.windows.getAll()).length,
  };
}
```
And a test fake used by the background tests — `extension/src/background/__tests__/fakeExt.ts`:
```ts
import type {Ext, KV} from '../../ext';

export function memKV(): KV & {data: Map<string, unknown>} {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async k => data.get(k),
    set: async (k, v) => {
      // Chrome serialises storage as JSON: store what a real browser would give back.
      data.set(k, JSON.parse(JSON.stringify(v)));
    },
    remove: async k => {
      data.delete(k);
    },
  };
}

export function fakeExt(windows = 1) {
  const alarms = new Map<string, number>();
  const ext: Ext & {alarmsSet: Map<string, number>; windows: number} = {
    runtimeId: 'abcdefghijklmnopabcdefghijklmnop',
    extensionOrigin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
    session: memKV(),
    local: memKV(),
    alarms: {
      create: (name, o) => {
        alarms.set(name, o.delayInMinutes);
      },
      clear: async name => alarms.delete(name),
    },
    windowCount: async () => ext.windows,
    alarmsSet: alarms,
    windows,
  };
  return ext;
}
```

- [ ] **Step 2: Failing tests**

`extension/src/background/__tests__/session.test.ts`:
```ts
import {setSession, getSession, clearSession, SESSION_KEY} from '../session';
import {fakeExt} from './fakeExt';

const ACC = [{index: 0, publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', secretKey: 'AAAA'}];

describe('session keys', () => {
  it('round-trips through JSON-serialised storage as strings', async () => {
    const ext = fakeExt();
    await setSession(ext, ACC);
    expect(await getSession(ext)).toEqual(ACC);
    expect(typeof ((await ext.session.get(SESSION_KEY)) as {accounts: {secretKey: unknown}[]}).accounts[0]?.secretKey).toBe('string');
  });
  it('is gone after clear', async () => {
    const ext = fakeExt();
    await setSession(ext, ACC);
    await clearSession(ext);
    expect(await getSession(ext)).toBeNull();
  });
  it('never writes to storage.local', async () => {
    const ext = fakeExt();
    await setSession(ext, ACC);
    expect((ext.local as unknown as {data: Map<string, unknown>}).data.size).toBe(0);
  });
});
```

`extension/src/background/__tests__/messages.test.ts`:
```ts
import {handleMessage} from '../messages';
import {getSession} from '../session';
import {fakeExt} from './fakeExt';

const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const unlockPage = {id: ID, origin: ORIGIN, url: `${ORIGIN}/unlock.html`, tab: {}, frameId: 0};
const popup = {id: ID, origin: ORIGIN, url: `${ORIGIN}/popup.html`};
const page = {id: ID, origin: 'https://evil.example', url: 'https://evil.example/', tab: {}, frameId: 0};
const ACC = [{index: 0, publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', secretKey: 'AAAA'}];

describe('message partitions', () => {
  it('accepts vault.setKeys from the vault page (positive control)', async () => {
    const ext = fakeExt();
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage)).toEqual({ok: true});
    expect(await getSession(ext)).toEqual(ACC);
  });

  it('refuses vault.setKeys from the popup — only the vault page may', async () => {
    const ext = fakeExt();
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, popup)).toEqual({ok: false, error: 'forbidden'});
    expect(await getSession(ext)).toBeNull();
  });

  it('refuses every privileged type from a web page', async () => {
    for (const type of ['vault.setKeys', 'vault.lock', 'vault.status', 'activity.ping']) {
      const ext = fakeExt();
      expect(await handleMessage(ext, {type, accounts: ACC}, page)).toEqual({ok: false, error: 'forbidden'});
    }
  });

  it('refuses a page that claims the extension origin in its url but not in sender.origin', async () => {
    const ext = fakeExt();
    const spoof = {...page, url: `${ORIGIN}/unlock.html`};
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, spoof)).toEqual({ok: false, error: 'forbidden'});
  });

  it('refuses a message from another extension', async () => {
    const ext = fakeExt();
    expect(await handleMessage(ext, {type: 'vault.status'}, {...popup, id: 'someotherextensionidxxxxxxxxxxxx'})).toEqual({ok: false, error: 'forbidden'});
  });

  it('refuses unknown types and malformed messages', async () => {
    const ext = fakeExt();
    expect(await handleMessage(ext, {type: 'vault.export'}, popup)).toEqual({ok: false, error: 'unknown type'});
    expect(await handleMessage(ext, 'hello', popup)).toEqual({ok: false, error: 'malformed'});
  });

  it('refuses malformed accounts in vault.setKeys', async () => {
    const ext = fakeExt();
    expect(await handleMessage(ext, {type: 'vault.setKeys', accounts: [{index: 0}]}, unlockPage)).toEqual({ok: false, error: 'malformed'});
  });

  it('vault.status reports locked/unlocked without keys', async () => {
    const ext = fakeExt();
    expect(await handleMessage(ext, {type: 'vault.status'}, popup)).toEqual({ok: true, data: {unlocked: false, accounts: []}});
    await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
    const r = await handleMessage(ext, {type: 'vault.status'}, popup);
    expect(r).toEqual({ok: true, data: {unlocked: true, accounts: [{index: 0, publicKey: ACC[0]?.publicKey}]}});
    expect(JSON.stringify(r)).not.toContain('secretKey');
  });

  it('vault.lock clears the session', async () => {
    const ext = fakeExt();
    await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
    await handleMessage(ext, {type: 'vault.lock'}, popup);
    expect(await getSession(ext)).toBeNull();
  });
});
```

`extension/src/background/__tests__/autolock.test.ts`:
```ts
import {armAutolock, lock, onWindowRemoved, AUTOLOCK_ALARM, DEFAULT_AUTOLOCK_MINUTES} from '../autolock';
import {setSession, getSession} from '../session';
import {fakeExt} from './fakeExt';

const ACC = [{index: 0, publicKey: 'x', secretKey: 'AAAA'}];

describe('auto-lock', () => {
  it('arms the alarm for the default five minutes', async () => {
    const ext = fakeExt();
    await armAutolock(ext);
    expect(DEFAULT_AUTOLOCK_MINUTES).toBe(5);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(5);
  });
  it('honours a stored setting inside 1–60, and clamps outside it', async () => {
    const ext = fakeExt();
    await ext.local.set('v1_settings', {autoLockMinutes: 15});
    await armAutolock(ext);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(15);
    await ext.local.set('v1_settings', {autoLockMinutes: 600});
    await armAutolock(ext);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(60);
    await ext.local.set('v1_settings', {autoLockMinutes: 0});
    await armAutolock(ext);
    expect(ext.alarmsSet.get(AUTOLOCK_ALARM)).toBe(1);
  });
  it('lock clears the session and the alarm', async () => {
    const ext = fakeExt();
    await setSession(ext, ACC);
    await armAutolock(ext);
    await lock(ext);
    expect(await getSession(ext)).toBeNull();
    expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(false);
  });
  it('locks when the last window closes, not before', async () => {
    const ext = fakeExt(2);
    await setSession(ext, ACC);
    ext.windows = 1;
    await onWindowRemoved(ext);
    expect(await getSession(ext)).not.toBeNull();
    ext.windows = 0;
    await onWindowRemoved(ext);
    expect(await getSession(ext)).toBeNull();
  });
});
```
Run: `npx vitest run src/background` → FAIL.

- [ ] **Step 3: Implement**

`extension/src/background/session.ts`:
```ts
import type {Ext} from '../ext';
import type {SessionAccount} from '../vault/accounts';

/** Per-account signing keys while unlocked; memory-only storage.session, base64 strings. */
export const SESSION_KEY = 'v1_session';

export async function setSession(ext: Ext, accounts: SessionAccount[]): Promise<void> {
  await ext.session.set(SESSION_KEY, {accounts});
}

export async function getSession(ext: Ext): Promise<SessionAccount[] | null> {
  const v = (await ext.session.get(SESSION_KEY)) as {accounts?: SessionAccount[]} | undefined;
  return v?.accounts ?? null;
}

export async function clearSession(ext: Ext): Promise<void> {
  await ext.session.remove(SESSION_KEY);
}
```
Note: `session.ts` imports only the `SessionAccount` **type** from the vault folder; the isolation gate in Task 11 allows `import type` and forbids value imports.

`extension/src/background/autolock.ts`:
```ts
import type {Ext} from '../ext';
import {clearSession} from './session';

export const AUTOLOCK_ALARM = 'autolock';
export const DEFAULT_AUTOLOCK_MINUTES = 5;

async function minutes(ext: Ext): Promise<number> {
  const s = (await ext.local.get('v1_settings')) as {autoLockMinutes?: number} | undefined;
  const m = s?.autoLockMinutes;
  if (typeof m !== 'number' || !Number.isFinite(m)) return DEFAULT_AUTOLOCK_MINUTES;
  return Math.min(60, Math.max(1, Math.round(m)));
}

/** Re-arm on every user action and every unlock; the alarm firing locks. */
export async function armAutolock(ext: Ext): Promise<void> {
  ext.alarms.create(AUTOLOCK_ALARM, {delayInMinutes: await minutes(ext)});
}

export async function lock(ext: Ext): Promise<void> {
  await clearSession(ext);
  await ext.alarms.clear(AUTOLOCK_ALARM);
}

/** Chrome can keep running with no windows, so session storage alone is not "browser closed". */
export async function onWindowRemoved(ext: Ext): Promise<void> {
  if ((await ext.windowCount()) === 0) await lock(ext);
}
```

`extension/src/background/messages.ts`:
```ts
import type {Ext} from '../ext';
import type {SessionAccount} from '../vault/accounts';
import {getSession, setSession} from './session';
import {armAutolock, lock} from './autolock';

/** What the browser reports about a message's origin (runtime.MessageSender). */
export interface Sender {
  id?: string;
  origin?: string;
  url?: string;
  tab?: unknown;
  frameId?: number;
}

/**
 * Two partitions (spec §1). Privileged types come only from this extension's own pages;
 * page types (none until B1c) only from https top frames. `sender.origin` is what the browser
 * sets — never the URL the message claims, and never "has a tab", which a full-tab
 * extension page also has.
 */
export const PRIVILEGED = ['vault.setKeys', 'vault.lock', 'vault.status', 'activity.ping'] as const;
export const PAGE: readonly string[] = [];

type Result = {ok: true; data?: unknown} | {ok: false; error: string};

function isOwnPage(ext: Ext, s: Sender): boolean {
  return s.id === ext.runtimeId && s.origin === ext.extensionOrigin;
}

function pagePath(ext: Ext, s: Sender): string | null {
  if (!s.url) return null;
  const u = new URL(s.url);
  return u.origin === ext.extensionOrigin ? u.pathname : null;
}

function validAccounts(v: unknown): v is SessionAccount[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      a =>
        typeof a === 'object' && a !== null &&
        Number.isInteger((a as SessionAccount).index) &&
        typeof (a as SessionAccount).publicKey === 'string' &&
        typeof (a as SessionAccount).secretKey === 'string',
    )
  );
}

export async function handleMessage(ext: Ext, msg: unknown, sender: Sender): Promise<Result> {
  if (typeof msg !== 'object' || msg === null || typeof (msg as {type?: unknown}).type !== 'string') {
    return {ok: false, error: 'malformed'};
  }
  const type = (msg as {type: string}).type;
  const privileged = (PRIVILEGED as readonly string[]).includes(type);
  if (!privileged && !PAGE.includes(type)) return {ok: false, error: 'unknown type'};
  if (privileged && !isOwnPage(ext, sender)) return {ok: false, error: 'forbidden'};

  switch (type) {
    case 'vault.setKeys': {
      if (pagePath(ext, sender) !== '/unlock.html') return {ok: false, error: 'forbidden'};
      const accounts = (msg as {accounts?: unknown}).accounts;
      if (!validAccounts(accounts)) return {ok: false, error: 'malformed'};
      await setSession(ext, accounts);
      await armAutolock(ext);
      return {ok: true};
    }
    case 'vault.lock':
      await lock(ext);
      return {ok: true};
    case 'vault.status': {
      const s = await getSession(ext);
      return {ok: true, data: {unlocked: s !== null, accounts: (s ?? []).map(a => ({index: a.index, publicKey: a.publicKey}))}};
    }
    case 'activity.ping':
      if ((await getSession(ext)) !== null) await armAutolock(ext);
      return {ok: true};
    default:
      return {ok: false, error: 'unknown type'};
  }
}
```

`extension/src/background/index.ts`:
```ts
import {browserExt} from '../ext';
import {handleMessage, type Sender} from './messages';
import {AUTOLOCK_ALARM, lock, onWindowRemoved} from './autolock';

interface BgApi {
  runtime: {
    onMessage: {addListener(cb: (m: unknown, s: Sender, reply: (r: unknown) => void) => boolean): void};
    onStartup: {addListener(cb: () => void): void};
  };
  alarms: {onAlarm: {addListener(cb: (a: {name: string}) => void): void}};
  windows: {onRemoved: {addListener(cb: () => void): void}};
}

const g = globalThis as unknown as {browser?: BgApi; chrome?: BgApi};
const api = (g.browser ?? g.chrome) as BgApi;
const ext = browserExt();

api.runtime.onMessage.addListener((msg, sender, reply) => {
  handleMessage(ext, msg, sender).then(reply, () => reply({ok: false, error: 'internal'}));
  return true; // reply asynchronously
});
api.alarms.onAlarm.addListener(a => {
  if (a.name === AUTOLOCK_ALARM) void lock(ext);
});
api.windows.onRemoved.addListener(() => {
  void onWindowRemoved(ext);
});
api.runtime.onStartup.addListener(() => {
  void lock(ext);
});
```
Run: `npx vitest run src/background` → PASS. Mutations, each must fail a named test, then revert: (1) remove `s.origin === ext.extensionOrigin` from `isOwnPage` → "refuses every privileged type from a web page" fails; (2) remove the `/unlock.html` check → "refuses vault.setKeys from the popup" fails; (3) in `onWindowRemoved` use `<= 1` → "locks when the last window closes, not before" fails.

- [ ] **Step 4: Commit**
```bash
git add extension/src/ext.ts extension/src/background
git commit -m "feat(extension): the background — session keys, two message partitions, and auto-lock"
```

---

### Task 10: The vault page and the popup

**Files:**
- Replace: `extension/unlock.html`, `extension/src/unlock/main.ts`, `extension/popup.html`, `extension/src/popup/main.ts`
- Create: `extension/src/unlock/unlockFlow.ts`, `extension/src/unlock/__tests__/unlockFlow.test.ts`
- Create: `extension/src/ui/send.ts` (a typed `runtime.sendMessage` wrapper for pages)

**Interfaces:**
- Consumes: `EnvelopeV1`, `unlockWithPassword`, `decryptMnemonic`, `unlockWithPrf` (Task 5); `workerKdf` (Task 6); `deriveSessionAccounts` (Task 7); `evaluatePrf` (Task 8).
- Produces: `ENVELOPE_KEY = 'v1_vault'`; `unlockFlow(deps: {env: EnvelopeV1; send(m: unknown): Promise<{ok: boolean; error?: string}>}, factor: {password: string; kdf: Kdf} | {prfOutput: Uint8Array}): Promise<'unlocked' | 'wrong' | 'failed'>`

- [ ] **Step 1: Failing test for the flow** (no DOM; the page is a thin shell over it)

`extension/src/unlock/__tests__/unlockFlow.test.ts`:
```ts
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {createEnvelope, type Kdf} from '../../vault/envelope';
import {unlockFlow} from '../unlockFlow';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const kdf: Kdf = (pw, salt, p) => argon2idAsync(pw, salt, {m: p.m, t: p.t, p: p.p, dkLen: 32});
const accounts = [{index: 0, name: 'Account 1', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}];

describe('unlockFlow', () => {
  it('sends the derived account keys, and nothing about the seed', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: {m: 64, t: 1, p: 1}});
    const sent: unknown[] = [];
    const r = await unlockFlow({env, send: async m => (sent.push(m), {ok: true})}, {password: 'correct horse battery', kdf});
    expect(r).toBe('unlocked');
    expect(sent).toHaveLength(1);
    const json = JSON.stringify(sent[0]);
    expect(json).toContain('"type":"vault.setKeys"');
    expect(json).toContain('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    expect(json).not.toContain('abandon');
  });

  it('says wrong for a wrong password and sends nothing', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: {m: 64, t: 1, p: 1}});
    const sent: unknown[] = [];
    expect(await unlockFlow({env, send: async m => (sent.push(m), {ok: true})}, {password: 'nope nope nope nope', kdf})).toBe('wrong');
    expect(sent).toHaveLength(0);
  });

  it('says failed when the background refuses', async () => {
    const env = await createEnvelope({mnemonic: MNEMONIC, password: 'correct horse battery', scheme: 'slip10', accounts, kdf, params: {m: 64, t: 1, p: 1}});
    expect(await unlockFlow({env, send: async () => ({ok: false, error: 'forbidden'})}, {password: 'correct horse battery', kdf})).toBe('failed');
  });
});
```
Run: `npx vitest run src/unlock` → FAIL.

- [ ] **Step 2: Implement the flow and the pages**

`extension/src/unlock/unlockFlow.ts`:
```ts
import {decryptMnemonic, unlockWithPassword, unlockWithPrf, WrongPasskey, WrongPassword, type EnvelopeV1, type Kdf} from '../vault/envelope';
import {deriveSessionAccounts} from '../vault/accounts';

export const ENVELOPE_KEY = 'v1_vault';

/**
 * The only place the seed exists: unwrap the data key, decrypt, derive the envelope's accounts,
 * hand the background their signing keys, and let the seed go out of scope (spec §2).
 */
export async function unlockFlow(
  deps: {env: EnvelopeV1; send(m: unknown): Promise<{ok: boolean; error?: string}>},
  factor: {password: string; kdf: Kdf} | {prfOutput: Uint8Array},
): Promise<'unlocked' | 'wrong' | 'failed'> {
  let dataKey: Uint8Array;
  try {
    dataKey = 'password' in factor
      ? await unlockWithPassword(deps.env, factor.password, factor.kdf)
      : await unlockWithPrf(deps.env, factor.prfOutput);
  } catch (e) {
    if (e instanceof WrongPassword || e instanceof WrongPasskey) return 'wrong';
    return 'failed';
  }
  const mnemonic = await decryptMnemonic(deps.env, dataKey);
  dataKey.fill(0);
  const indexes = deps.env.accounts.length ? deps.env.accounts.map(a => a.index) : [0];
  const accounts = await deriveSessionAccounts(mnemonic, deps.env.scheme, indexes);
  const r = await deps.send({type: 'vault.setKeys', accounts});
  return r.ok ? 'unlocked' : 'failed';
}
```

`extension/src/ui/send.ts`:
```ts
interface RuntimeLike {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
}

/** runtime.sendMessage from an extension page, typed to the background's reply shape. */
export async function send(m: unknown): Promise<{ok: boolean; error?: string; data?: unknown}> {
  const g = globalThis as unknown as {browser?: RuntimeLike; chrome?: RuntimeLike};
  const api = (g.browser ?? g.chrome) as RuntimeLike;
  return (await api.runtime.sendMessage(m)) as {ok: boolean; error?: string; data?: unknown};
}
```

`extension/unlock.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Noctura — unlock</title>
  </head>
  <body>
    <main>
      <h1>Unlock Noctura</h1>
      <form id="pw">
        <label for="password">Password</label>
        <input id="password" type="password" autocomplete="current-password" minlength="12" required />
        <button id="unlock" type="submit">Unlock</button>
      </form>
      <button id="passkey" type="button" hidden>Unlock with passkey</button>
      <p id="status" role="status"></p>
    </main>
    <script type="module" src="./src/unlock/main.ts"></script>
  </body>
</html>
```

`extension/src/unlock/main.ts`:
```ts
import {ENVELOPE_KEY, unlockFlow} from './unlockFlow';
import {workerKdf} from '../vault/kdf';
import {evaluatePrf} from '../vault/passkey';
import {unb64} from '../vault/bytes';
import {send} from '../ui/send';
import type {EnvelopeV1} from '../vault/envelope';

// The vault page renders only its own fixed strings — nothing from a dApp, a token or the
// network (spec §1).
interface LocalLike {
  storage: {local: {get(k: string): Promise<Record<string, unknown>>}};
}
const g = globalThis as unknown as {browser?: LocalLike; chrome?: LocalLike};
const api = (g.browser ?? g.chrome) as LocalLike;
const status = document.getElementById('status') as HTMLParagraphElement;
const pw = document.getElementById('password') as HTMLInputElement;
const unlockBtn = document.getElementById('unlock') as HTMLButtonElement;
const passkeyBtn = document.getElementById('passkey') as HTMLButtonElement;

const WORDS = {unlocked: 'Unlocked. You can close this tab.', wrong: 'That did not unlock the wallet.', failed: 'Unlock failed. Try again.'};

async function envelope(): Promise<EnvelopeV1 | null> {
  return ((await api.storage.local.get(ENVELOPE_KEY))[ENVELOPE_KEY] as EnvelopeV1 | undefined) ?? null;
}

async function run(factor: Parameters<typeof unlockFlow>[1]) {
  const env = await envelope();
  if (!env) {
    status.textContent = 'No wallet on this browser yet.';
    return;
  }
  unlockBtn.disabled = true;
  passkeyBtn.disabled = true;
  status.textContent = 'Unlocking…';
  const r = await unlockFlow({env, send}, factor);
  status.textContent = WORDS[r];
  unlockBtn.disabled = false;
  passkeyBtn.disabled = false;
  pw.value = '';
}

document.getElementById('pw')?.addEventListener('submit', e => {
  e.preventDefault();
  void run({password: pw.value, kdf: workerKdf});
});

void envelope().then(env => {
  if (!env?.passkey) return;
  passkeyBtn.hidden = false;
  passkeyBtn.addEventListener('click', async () => {
    const pk = env.passkey;
    if (!pk) return;
    const out = await evaluatePrf(navigator.credentials, unb64(pk.credentialId), unb64(pk.prfSalt));
    if (!out) {
      status.textContent = 'This device cannot unlock the wallet with a passkey; your password still works.';
      return;
    }
    await run({prfOutput: out});
  });
});
```

`extension/popup.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Noctura</title>
  </head>
  <body>
    <main>
      <p id="state" role="status">Reading…</p>
      <button id="unlock" type="button" hidden>Unlock</button>
      <button id="lock" type="button" hidden>Lock</button>
    </main>
    <script type="module" src="./src/popup/main.ts"></script>
  </body>
</html>
```

`extension/src/popup/main.ts`:
```ts
import {send} from '../ui/send';

// B1a popup: locked/unlocked and the two buttons. The wallet screens arrive in B1b.
interface TabsLike {
  runtime: {getURL(p: string): string};
  tabs: {create(o: {url: string}): Promise<unknown>};
}
const g = globalThis as unknown as {browser?: TabsLike; chrome?: TabsLike};
const api = (g.browser ?? g.chrome) as TabsLike;
const state = document.getElementById('state') as HTMLParagraphElement;
const unlockBtn = document.getElementById('unlock') as HTMLButtonElement;
const lockBtn = document.getElementById('lock') as HTMLButtonElement;

async function refresh() {
  const r = await send({type: 'vault.status'});
  const data = r.data as {unlocked: boolean; accounts: {publicKey: string}[]} | undefined;
  const unlocked = r.ok && data?.unlocked === true;
  state.textContent = unlocked ? `Unlocked · ${data?.accounts.length ?? 0} account(s)` : 'Locked';
  unlockBtn.hidden = unlocked;
  lockBtn.hidden = !unlocked;
  if (unlocked) void send({type: 'activity.ping'});
}

unlockBtn.addEventListener('click', () => {
  // Unlock happens in a tab: the vault page must survive a click elsewhere, and a passkey
  // prompt closes the popup (spec §2).
  void api.tabs.create({url: api.runtime.getURL('unlock.html')});
  window.close();
});
lockBtn.addEventListener('click', async () => {
  await send({type: 'vault.lock'});
  await refresh();
});
void refresh();
```
`tabs.create` needs no `tabs` permission (only reading tab URLs/titles does).

Run: `npx vitest run src/unlock` → PASS; `npm run build` → PASS; `npm run csp` → OK (no inline script, no eval).

- [ ] **Step 3: Commit**
```bash
git add extension/unlock.html extension/popup.html extension/src/unlock extension/src/popup extension/src/ui
git commit -m "feat(extension): the vault page unlocks with a password or a passkey; the popup shows and ends the session"
```

---

### Task 11: The vault-isolation gate and an end-to-end unlock

**Files:**
- Create: `extension/scripts/check-vault-isolation.mjs`, `extension/scripts/__tests__/check-vault-isolation.test.mjs`
- Create: `extension/playwright.config.ts`, `extension/e2e/unlock.spec.ts`, `extension/e2e/makeEnvelope.ts`
- Modify: `extension/package.json` (`gates` script back to both checks)

**Interfaces:**
- Consumes: everything above.
- Produces: `sourceViolations(files: {path: string; text: string}[]): string[]`; `bundleViolations(distApp: string): string[]`.

- [ ] **Step 1: Failing gate tests**

`extension/scripts/__tests__/check-vault-isolation.test.mjs`:
```js
import {sourceViolations} from '../check-vault-isolation.mjs';

const f = (path, text) => ({path, text});

describe('vault isolation (source)', () => {
  it('allows the vault page and the vault folder to import the vault', () => {
    expect(sourceViolations([
      f('src/unlock/main.ts', "import {workerKdf} from '../vault/kdf';"),
      f('src/vault/reauth.ts', "import {decryptMnemonic} from './envelope';"),
    ])).toEqual([]);
  });

  it('refuses a value import of the vault from the popup or the background', () => {
    expect(sourceViolations([f('src/popup/main.ts', "import {decryptMnemonic} from '../vault/envelope';")])).toHaveLength(1);
    expect(sourceViolations([f('src/background/messages.ts', "import {deriveSessionAccounts} from '../vault/accounts';")])).toHaveLength(1);
  });

  it('allows a type-only import from anywhere', () => {
    expect(sourceViolations([f('src/background/session.ts', "import type {SessionAccount} from '../vault/accounts';")])).toEqual([]);
  });

  it('refuses storage.session outside the background', () => {
    expect(sourceViolations([f('src/unlock/main.ts', 'chrome.storage.session.get("v1_session")')])).toHaveLength(1);
    expect(sourceViolations([f('src/background/session.ts', '// storage.session is memory-only')])).toEqual([]);
  });
});
```
Run: `npx vitest run scripts` → FAIL.

- [ ] **Step 2: Implement the gate** (source rules + a built-output check using a marker string that exists only in the vault code)

`extension/scripts/check-vault-isolation.mjs`:
```js
#!/usr/bin/env node
// Spec §1: the vault module is imported only by the vault bundle (unlock page + worker, and
// the vault folder itself); storage.session is touched only by the background. Checked twice:
// in the sources, and in the built files — a shared chunk could carry vault code into the
// popup even when every source import looks right.
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';

const VAULT_ALLOWED = /^src\/(unlock|vault)\//;
const SESSION_ALLOWED = /^src\/background\//;
const VALUE_IMPORT_OF_VAULT = /^\s*import\s+(?!type\b)[^;]*from\s+['"][^'"]*\/vault\/[^'"]+['"]/m;
// A string that exists only in the vault's envelope code.
export const VAULT_MARKER = 'noctura-ext-v1/passkey-wrap';

export function sourceViolations(files) {
  const out = [];
  for (const {path, text} of files) {
    if (!VAULT_ALLOWED.test(path) && VALUE_IMPORT_OF_VAULT.test(text)) out.push(`${path}: imports the vault`);
    if (!SESSION_ALLOWED.test(path) && /storage\.session/.test(text)) out.push(`${path}: touches storage.session`);
  }
  return out;
}

function listFiles(dir, re) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e !== '__tests__') out.push(...listFiles(p, re));
    } else if (re.test(e)) out.push(p);
  }
  return out;
}

/** JS reachable from an entry by static imports inside dist/app. */
function reachable(distApp, entryRel) {
  const seen = new Set();
  const stack = [entryRel];
  while (stack.length) {
    const rel = stack.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const text = readFileSync(join(distApp, rel), 'utf8');
    for (const m of text.matchAll(/(?:from|import)\s*["']\.\.?\/?([^"']+\.js)["']/g)) {
      const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : '';
      const next = m[0].includes('../') ? m[1] : `${dir}${m[1]}`.replace(/^\.\//, '');
      stack.push(next.replace(/^assets\/assets\//, 'assets/'));
    }
  }
  return [...seen];
}

export function bundleViolations(distApp) {
  const out = [];
  const popupHtml = readFileSync(join(distApp, 'popup.html'), 'utf8');
  const popupEntries = [...popupHtml.matchAll(/src="\.\/([^"]+\.js)"/g)].map(m => m[1]);
  for (const entry of ['background.js', ...popupEntries]) {
    for (const file of reachable(distApp, entry)) {
      if (readFileSync(join(distApp, file), 'utf8').includes(VAULT_MARKER)) out.push(`${file} (reachable from ${entry}) contains vault code`);
    }
  }
  const anywhere = listFiles(distApp, /\.js$/).some(p => readFileSync(p, 'utf8').includes(VAULT_MARKER));
  if (!anywhere) out.push('INCONCLUSIVE: the vault marker is in no built file — the check would pass trivially');
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = listFiles('src', /\.ts$/).map(p => ({path: p, text: readFileSync(p, 'utf8')}));
  const problems = [...sourceViolations(files), ...bundleViolations('dist/app')];
  if (problems.length) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log('vault isolation ok: sources and built popup/background carry no vault code');
}
```
Set `extension/package.json` `"gates": "node scripts/check-permissions.mjs && node scripts/check-vault-isolation.mjs"`.

Run: `npx vitest run scripts` → PASS; `npm run build && npm run gates` → OK. Mutation: add `import {decryptMnemonic} from '../vault/envelope'; console.log(decryptMnemonic);` to `src/popup/main.ts`, rebuild → `npm run gates` must FAIL with both a source and a bundle violation; revert and rebuild.

- [ ] **Step 3: End-to-end unlock in Chromium**

`extension/e2e/makeEnvelope.ts`:
```ts
import {createEnvelope, PRODUCTION_KDF} from '../src/vault/envelope';
import {argon2idKdf} from '../src/vault/kdf';

export const E2E_PASSWORD = 'correct horse battery staple';
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

/** A real envelope at production parameters — the E2E exercises the real cost. */
export function makeEnvelope() {
  return createEnvelope({
    mnemonic: MNEMONIC,
    password: E2E_PASSWORD,
    scheme: 'slip10',
    accounts: [{index: 0, name: 'Account 1', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}],
    kdf: argon2idKdf,
    params: PRODUCTION_KDF,
  });
}
```

`extension/playwright.config.ts`:
```ts
import {defineConfig} from '@playwright/test';

export default defineConfig({testDir: 'e2e', timeout: 120_000, workers: 1});
```

`extension/e2e/unlock.spec.ts`:
```ts
import {test, expect, chromium} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeEnvelope, E2E_PASSWORD} from './makeEnvelope';

const EXT = resolve(__dirname, '../dist/chrome');

test('unlocking in the vault page puts only signing keys into session storage', async () => {
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'noctura-e2e-')), {
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  const id = new URL(sw.url()).host;

  const env = await makeEnvelope();
  await sw.evaluate(e => chrome.storage.local.set({v1_vault: e}), env);

  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/unlock.html`);
  await page.fill('#password', E2E_PASSWORD);
  await page.click('#unlock');
  await expect(page.locator('#status')).toHaveText('Unlocked. You can close this tab.', {timeout: 60_000});

  const session = await sw.evaluate(() => chrome.storage.session.get(null));
  const json = JSON.stringify(session);
  expect(json).toContain('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
  expect(json).not.toContain('abandon');

  // Negative control: a wrong password sends nothing and leaves the session untouched.
  await sw.evaluate(() => chrome.storage.session.clear());
  await page.fill('#password', 'wrong horse battery staple');
  await page.click('#unlock');
  await expect(page.locator('#status')).toHaveText('That did not unlock the wallet.', {timeout: 60_000});
  expect(await sw.evaluate(() => chrome.storage.session.get(null))).toEqual({});

  await ctx.close();
});
```
The `chrome` global inside `sw.evaluate` is the service worker's; add `/// <reference types="chrome" />`-free typing by declaring at the top of the spec file:
```ts
declare const chrome: {storage: {local: {set(o: object): Promise<void>}; session: {get(k: null): Promise<object>; clear(): Promise<void>}}};
```

Run: `npm run build && npx playwright test` → PASS (1 test, ~10–20 s, most of it Argon2id). If Chromium is missing: `npx playwright install chromium`.

- [ ] **Step 4: Full verify, both packages, and the app**

Run:
- `cd extension && npm run verify` → build, tests, CSP, gates, reproducible — all green.
- `cd ../web && npm run verify` → green.
- `cd .. && npm run verify` → green (eslint, tsc, jest).

- [ ] **Step 5: Commit**
```bash
git add extension/scripts extension/e2e extension/playwright.config.ts extension/package.json
git commit -m "test(extension): no vault code in the popup or background, and a real unlock end to end"
```

---

## Self-review (done while writing)

- **Spec coverage for B1a:** core derivation move → T3; stale-list gate incl. both fail-open fixes → T4; envelope with two wraps → T5; Argon2id in a worker → T6; per-account session keys and re-auth as a proof → T7; passkey RP ID / UV / per-wallet PRF salt / get-after-create / HKDF info → T8; `storage.session` base64 and JSON-safe (fake storage serialises) → T9; message partitions with `sender.origin`, vault-page-only `setKeys`, unknown types refused → T9; 5-minute auto-lock with 1–60 clamp, window-close lock, startup lock → T9; vault bundle and isolation gate → T10/T11; permissions and hosts exactly per §4, Firefox `gecko.id` + `data_collection_permissions` → T1/T2; CSP, reproducibility, CI with npm 11.6.2 → T2.
- **Deferred and said so:** transfers/balances and the fee question → B1b; Chrome `key`, AMO category re-check, E2E in CI → B1e; page message types → B1c.
- **Names used across tasks:** `EnvelopeV1`, `Kdf`, `KdfParams`, `PRODUCTION_KDF`, `SessionAccount`, `deriveSessionAccounts`, `unlockFlow`, `ENVELOPE_KEY = 'v1_vault'`, `SESSION_KEY = 'v1_session'`, `AUTOLOCK_ALARM = 'autolock'`, `handleMessage`, `Ext` — consistent in every task that consumes them.
