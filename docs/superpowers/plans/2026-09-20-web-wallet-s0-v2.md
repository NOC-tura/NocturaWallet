# Noctura Web S0 Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **This supersedes `2026-09-20-web-wallet-s0.md`, which is blocked.** That version was written from the shape of the APIs; a review found six load-bearing assumptions false against the pinned libraries and the real backend. Everything asserted below about *this repository* was read out of the file named. Everything about packages **not installed here** (Vite, Vitest, wallet-adapter, TanStack Query) is written as a **PROBE step** the implementer runs and records — because an assertion about a library nobody has run is the same defect in a new coat.

**Goal:** A locally runnable web app at `web/` where a presale buyer connects an existing Solana wallet and sees their on-chain allocation, the live stage and price, their referral standing and the TGE countdown — and can buy NOC with SOL.

**Architecture:** The browser holds no authority: the connected wallet signs and broadcasts. Most of the logic already exists in `src/modules/` and is **moved** into `core/` behind two small injected ports, never copied — in this project the client code is the specification for the on-chain encoding, so a second copy is a second specification. The React Native app keeps working through re-exports, and its existing test suite is what proves each move.

**Tech Stack:** Vite + React 18 + TypeScript strict · `@solana/wallet-adapter-react` · `@solana/web3.js` 1.95.8 (already pinned at the repo root) · TanStack Query v5 · Vitest + React Testing Library + jsdom · Node >= 22.11.0

**Spec:** `docs/superpowers/specs/2026-09-20-web-wallet-s0-design.md`

**Revision history.** v1 was blocked after a review found six load-bearing assumptions
false. This document is v2, and it has since had a second review and a third pass. That
review confirmed all seven v1 fixes and then found new defects **in exactly the parts v2
still wrote from assumption** — the buy path's dependencies, the coordinator's write
contract, and the browser's globals. Those tasks (3, 4, 8, 9, 11) were rewritten from the
files. The pattern across both rounds is worth stating for whoever writes the next plan
here: **what was read is right, what was assumed is wrong**, without exception so far.

## Global Constraints

- **No key material in the page.** No code path produces or accepts a private key, seed or mnemonic.
- **No secret in the bundle.** The Helius key exists only in the dev-server proxy and on the coordinator.
- **No third-party code or telemetry.** Nothing loaded from a host we do not serve.
- **TypeScript strict; no `any`, no `@ts-ignore`.**
- **Amounts are `bigint` base units**, never floats.
- **UTC everywhere**; convert only in the render layer.
- **Signing debounces >= 500 ms and disables on tap.**
- **Fail closed.** No silent fallback.
- **RPC allowlist**, which the client must not exceed: `getAccountInfo`, `getMultipleAccounts`, `getBalance`, `getTokenAccountsByOwner`, `getLatestBlockhash`, `getBlockHeight`, `getRecentPrioritizationFees`, `simulateTransaction`, `getSignatureStatuses`, `getTransaction`, `getSignaturesForAddress`. **`sendTransaction` is not on it** — the wallet broadcasts.
- **No WebSocket subscriptions.** Balances are polled.
- **API paths are bare.** `API_BASE` ends in `/api/v1`.

### Facts verified in this repository on 2026-09-20 — do not re-derive, do not "improve"

| fact | source |
|---|---|
| `new Connection('/rpc')` **throws** `Endpoint URL must start with \`http:\` or \`https:\`` | ran it against `node_modules/@solana/web3.js` 1.95.8; guard at `lib/index.cjs.js:4515` |
| `buffer@5.7.1` has **no** `readBigUInt64LE` / `readBigInt64LE` | `grep -c readBigUInt64LE node_modules/buffer/index.js` = 0 |
| u64 is therefore decoded with a **byte loop** | `src/modules/presale/presaleBuyModule.ts:92-96` |
| allocation `total_tokens` u64 LE at offset **40** | `presaleBuyModule.ts:75` (`ALLOCATION_TOTAL_TOKENS_OFFSET`) |
| config `tge_timestamp` i64 LE at offset **201** | `presaleBuyModule.ts:104`, layout at `:99-103`; value read live, not restated here |
| `PresalePdas` has **four** fields: `config`, `userAccount`, `userAllocation`, `referrerAllocation` | `presaleBuyModule.ts:50-56` |
| `/geo/check` returns `{countryCode, isVpn}` — **no envelope, no `allowed`** | `src/modules/geoFence/geoFenceModule.ts:21-24` |
| the block decision is **client-side, OFAC-only**: `isPresaleBlocked(r) = r.action === 'block'` | `geoFenceModule.ts:26-28` |
| `ReferralStats` has 7 fields: `totalReferrals`, `totalBaseBonusNoc`, `totalExtraBonusNoc`, `totalBonusNoc`, `totalReferredNoc`, `totalReferredUsd`, `tierBonusCount` | `src/modules/referral/referralModule.ts:3-11` |
| referral link is `https://noc-tura.io?ref=<address>` | `referralModule.ts:14-16` |
| `/stats` supplies only `currentStage`, `totalNocSold`, `isPaused`; **price comes from a client table** | `src/modules/presale/presaleModule.ts:37-56`, `src/constants/presale.ts:7-10` |
| `/user/:address` returns `{purchases:[{noc_amount, referral_bonus}]}` | `presaleModule.ts:60-63` |
| root `tsconfig.json` includes `**/*.ts`, excluding only `node_modules`, `Pods`, `e2e` | `tsconfig.json:15-16` |
| root `.gitignore` ignores `.env*` with only `!.env.example` exempted | `.gitignore:86` |

---

### Task 0: Fence the new directories out of the root build, before anything exists

If this is skipped, the very first file in `web/` turns the root CI red, and the failure looks like the web work broke the app.

**Files:**
- Modify: `tsconfig.json` (exclude), `jest.config.js` (ignore), `.gitignore` (unignore the example env)

**Interfaces:**
- Consumes: nothing.
- Produces: a repo where `core/` and `web/` can exist without the root toolchain touching them.

- [ ] **Step 1: Prove the problem exists first**

```bash
mkdir -p web/src core
printf 'export const x: string = 1;\n' > web/src/broken.ts
npx tsc --noEmit; echo "exit $?"
```
Expected: **FAIL**, reporting `web/src/broken.ts`. That is the defect this task fixes; if it passes, the root config already excludes `web/` and you should record that and skip to Step 3.

- [ ] **Step 2: Add the exclusions**

`tsconfig.json` — extend `exclude`:

```json
"exclude": ["**/node_modules", "**/Pods", "e2e", "web", "core"]
```

`jest.config.js` — extend `testPathIgnorePatterns` (read the file first; keep the existing entries):

```js
testPathIgnorePatterns: ['/node_modules/', '/e2e/', '/web/', '/core/'],
```

`.gitignore` — after the existing `!.env.example` line:

```
!web/.env.local.example
```

- [ ] **Step 3: Verify both toolchains are clean and the example env is committable**

```bash
npx tsc --noEmit; echo "tsc exit $?"        # expect 0, with web/src/broken.ts still present
npx jest --listTests | grep -c web || true  # expect 0
rm web/src/broken.ts
printf 'HELIUS_RPC_URL=\n' > web/.env.local.example
git check-ignore -v web/.env.local.example; echo "check-ignore exit $? (1 = not ignored, which is what we want)"
```

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json jest.config.js .gitignore web/.env.local.example
git commit -m "chore: fence web/ and core/ out of the root build before they exist

Demonstrated first: a single .ts file under web/ fails root tsc, because the root
tsconfig includes **/*.ts and excludes only node_modules, Pods and e2e. Left
unfenced, the first commit of the web app would turn the app's CI red and the
failure would look like the app broke.

Also unignores web/.env.local.example: .gitignore ignores .env* with only
.env.example exempted, so the file the next task adds could not be committed."
```

---

### Task 1: Scaffold `web/`, and a secret gate that has been made to fail

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/scripts/check-no-secrets.mjs`
- Test: `web/src/__tests__/App.test.tsx`, `web/scripts/__tests__/check-no-secrets.test.mjs`

**Interfaces:**
- Consumes: Task 0's exclusions.
- Produces: `npm --prefix web run dev|build|test|scan|verify`.

- [ ] **Step 1: Write the failing tests**

`web/src/__tests__/App.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import {App} from '../App';

it('renders the product name', () => {
  render(<App />);
  expect(screen.getByRole('heading', {name: /noctura/i})).toBeTruthy();
});
```

`web/scripts/__tests__/check-no-secrets.test.mjs` — note the cwd: Vitest already runs with `web/` as cwd, so the script path is relative to that, not to `web/web`.

```js
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

function run(...dirs) {
  try {
    execFileSync(process.execPath, ['scripts/check-no-secrets.mjs', ...dirs], {stdio: 'pipe'});
    return 0;
  } catch (e) {
    return e.status ?? -1;
  }
}

it('passes on a clean tree (positive control — the gate can say yes)', () => {
  const d = mkdtempSync(join(tmpdir(), 'clean-'));
  writeFileSync(join(d, 'a.ts'), 'export const x = 1;\n');
  expect(run(d)).toBe(0);
});

it.each([
  ['Keypair.fromSecretKey', 'const k = Keypair.fromSecretKey(b);'],
  ['Keypair.generate', 'const k = Keypair.generate();'],
  ['mnemonic', 'const mnemonic = generateMnemonic();'],
  ['privateKey', 'const privateKey = x;'],
])('fails on %s', (_label, source) => {
  const d = mkdtempSync(join(tmpdir(), 'dirty-'));
  writeFileSync(join(d, 'b.ts'), source);
  expect(run(d)).toBe(1);
});

it('fails on a credential in a built bundle, detected by --bundle not by path', () => {
  const d = mkdtempSync(join(tmpdir(), 'bundle-'));
  mkdirSync(join(d, 'assets'));
  writeFileSync(join(d, 'assets', 'index.js'), 'fetch("https://x/?api-key=abc")');
  expect(run('--bundle', d)).toBe(1);
});

it('a bundle without a credential passes (positive control for --bundle)', () => {
  const d = mkdtempSync(join(tmpdir(), 'ok-'));
  mkdirSync(join(d, 'assets'));
  writeFileSync(join(d, 'assets', 'index.js'), 'fetch("/rpc")');
  expect(run('--bundle', d)).toBe(0);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd web && npm install && npm test`
Expected: FAIL — both modules missing.

- [ ] **Step 3: Write the implementation**

`web/package.json`:

```json
{
  "name": "noctura-web",
  "private": true,
  "type": "module",
  "engines": {"node": ">=22.11.0"},
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run --exclude '**/no-external-hosts.test.ts'",
    "test:bundle": "vitest run no-external-hosts",
    "scan": "node scripts/check-no-secrets.mjs src ../core && node scripts/check-no-secrets.mjs --bundle dist",
    "verify": "rm -rf dist && npm run build && npm run test && npm run test:bundle && npm run scan"
  },
  "dependencies": {
    "@solana/web3.js": "1.95.8",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "@types/node": "^22.7.0",
    "jsdom": "^24.1.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

`build` runs **before** `test` in `verify` so that `dist/` exists when the bundle checks run.

`web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "scripts", "../core"]
}
```

`web/vite.config.ts` — `defineConfig` comes from `vitest/config`, which is the variant that types the `test` key:

```ts
import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';

export default defineConfig({
  plugins: [react()],
  // core/ lives outside web/, so the dev server must be allowed to read it.
  server: {fs: {allow: [resolve(__dirname, '..')]}},
  // One copy of web3.js even though core/ resolves from the repo root: two copies
  // give two `Connection` classes with private members, and tsc rejects passing one
  // where the other is expected.
  resolve: {dedupe: ['@solana/web3.js', 'react', 'react-dom']},
  test: {environment: 'jsdom', globals: true},
});
```

`web/src/App.tsx`:

```tsx
export function App() {
  return (
    <main>
      <h1>Noctura</h1>
    </main>
  );
}
```

`web/src/main.tsx`:

```tsx
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Noctura</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`web/scripts/check-no-secrets.mjs` — the mode is an explicit flag, not a guess from the path:

```js
#!/usr/bin/env node
// Two things must never reach a browser: key-shaped symbols in our sources, and a
// credential in the built output. Which rule applies is chosen by --bundle, not by
// looking for "dist" in the path — a gate that guesses its own mode is a gate that
// silently applies the wrong one.
import {readdirSync, readFileSync, statSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const SOURCE_FORBIDDEN =
  /\b(mnemonic|generateMnemonic|secretKey|privateKey|Keypair\.(fromSecretKey|fromSeed|generate)|nacl\.sign\.keyPair)\b/;
const BUNDLE_FORBIDDEN = /api-key=|BEGIN [A-Z ]*PRIVATE KEY/;

const args = process.argv.slice(2);
const bundleMode = args.includes('--bundle');
const roots = args.filter(a => a !== '--bundle');
const rule = bundleMode ? BUNDLE_FORBIDDEN : SOURCE_FORBIDDEN;
const extensions = bundleMode ? /\.(js|css|html|map|json)$/ : /\.(ts|tsx|js|jsx|mjs)$/;

let bad = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!extensions.test(entry)) continue;
    const m = rule.exec(readFileSync(p, 'utf8'));
    if (m) {
      console.error(`FORBIDDEN ${m[0]} in ${p}`);
      bad += 1;
    }
  }
}

for (const root of roots) {
  if (existsSync(root)) walk(root);
}
process.exit(bad === 0 ? 0 : 1);
```

- [ ] **Step 4: Run the tests, then make the gate refuse something real**

Run: `cd web && npm test`
Expected: PASS, 8 tests (1 App + 7 gate).

```bash
cd web
printf 'const k = Keypair.generate();\n' > src/planted.ts
npm run scan; echo "expected 1, got $?"
rm src/planted.ts
npm run scan; echo "expected 0, got $?"
```
A gate that has never refused anything has not been tested.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat(web): scaffold, and a secret gate proven in both directions

The gate ships with the scaffold: the cheapest moment to make a key impossible to
commit is before there is anything to commit. Its mode is an explicit --bundle flag
rather than a guess from the path, and it refuses Keypair.generate and
Keypair.fromSeed as well — the spec forbids producing a key, not only importing one.

Every forbidden case has a matching positive control, so the tests can fail for the
right reason."
```

---

### Task 2: Config, dev proxies, and a probe that distinguishes the two ways `/rpc` fails

**Files:**
- Create: `web/src/config.ts`, `web/.env.local.example`
- Modify: `web/vite.config.ts`
- Test: `web/src/__tests__/config.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `API_BASE: string` (`'/api/v1'`, same-origin relative — used with `fetch`, which accepts it) and `rpcEndpoint(): string` (**absolute**, because `Connection` rejects a relative URL).

- [ ] **Step 1: Write the failing test**

`web/src/__tests__/config.test.ts`:

```ts
import {Connection} from '@solana/web3.js';
import {API_BASE, rpcEndpoint} from '../config';

describe('config', () => {
  it('keeps the API same-origin, so no credential can live in the bundle', () => {
    expect(API_BASE).toBe('/api/v1');
  });

  it('gives Connection an absolute endpoint — it rejects a relative one', () => {
    // Positive control for the guard this test exists because of:
    expect(() => new Connection('/rpc')).toThrow(/must start with/i);
    expect(() => new Connection(rpcEndpoint())).not.toThrow();
  });

  it('points at this origin, not at a hard-coded host', () => {
    expect(rpcEndpoint().startsWith(window.location.origin)).toBe(true);
    expect(rpcEndpoint()).toMatch(/\/rpc$/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd web && npm test -- config`
Expected: FAIL — `Cannot find module '../config'`.

- [ ] **Step 3: Write the implementation**

`web/src/config.ts`:

```ts
/**
 * Both endpoints are same-origin: in development the Vite proxy forwards them with
 * the Helius key injected server-side, in production the coordinator serves them. A
 * key reachable from the bundle is a published key, which is also why nothing here
 * carries a VITE_ prefix — that prefix is exactly what inlines a value into the
 * output.
 */
export const API_BASE = '/api/v1';

/**
 * Absolute on purpose. `new Connection('/rpc')` throws
 * `Endpoint URL must start with \`http:\` or \`https:\`` in web3.js 1.95.8
 * (verified by running it), so the relative form cannot be used here even though
 * `fetch` would accept it.
 */
export function rpcEndpoint(): string {
  return `${window.location.origin}/rpc`;
}
```

`web/.env.local.example`:

```
# Read by the Vite dev server ONLY. No VITE_ prefix, so it is never inlined.
# No Helius key here: /rpc forwards to the coordinator's allowlisted route, which
# holds its own key server-side. Nothing in development needs a credential.
COORDINATOR_ORIGIN=https://api.noc-tura.io
```

**Error semantics of that route, to code against** (given by the coordinator side, the
first three verified from here on 2026-09-20):

| status | meaning | client behaviour |
|---|---|---|
| `403` `-32601 method not allowed: X` | `X` is not on the allowlist | **a bug in our code, never a transient — never retry.** Surface it. |
| `429` | throttled; the upstream status is preserved | back off; do not treat as a failure of the call |
| `503` | the proxy could not ask (key unset, upstream unreachable) | a transient, not a refusal |
| `502` | a 2xx whose body was not JSON | genuinely broken |

Configure TanStack Query with `retry: false` for anything that can produce a 403: a
retried client bug is a client bug repeated.

`web/vite.config.ts` — add the proxy. `ignorePath` makes the proxy use the target's own path and query and discard the incoming one, which is what an RPC POST needs; the `configure` hook prints the URL actually requested so a failure can be diagnosed instead of guessed:

```ts
import {defineConfig} from 'vitest/config';
import {loadEnv} from 'vite';   // loadEnv is a vite export; vitest/config re-exports only defineConfig, mergeConfig, configDefaults
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, __dirname, '');
  const coordinator = env.COORDINATOR_ORIGIN || 'https://api.noc-tura.io';
  return {
    plugins: [react()],
    server: {
      fs: {allow: [resolve(__dirname, '..')]},
      proxy: {
        '/api': {target: coordinator, changeOrigin: true, secure: true},
        // Since 2026-09-20 the coordinator serves a method-allowlisted RPC route,
        // so development no longer needs a Helius key at all and local and
        // production have the same shape. Verified against the live route:
        // getLatestBlockhash and getAccountInfo 200; sendTransaction, getVersion
        // and a batch containing one refused method all 403.
        '/rpc': {target: `${coordinator}/api/v1/rpc`, changeOrigin: true, secure: true, ignorePath: true},
      },
    },
    resolve: {dedupe: ['@solana/web3.js', 'react', 'react-dom']},
    test: {environment: 'jsdom', globals: true},
  };
});
```

- [ ] **Step 4: Confirm the proxy reaches the coordinator's route**

```bash
cd web && cp .env.local.example .env.local
npm run dev &
sleep 3
curl -s -X POST http://localhost:5173/rpc -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getLatestBlockhash"}' | head -c 160
curl -s -o /dev/null -w 'sendTransaction through the proxy: %{http_code}\n' -X POST http://localhost:5173/rpc \
  -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"sendTransaction","params":["x"]}'
```

Expected: a real `blockhash`, then **403** — the second call is the positive control
that the allowlist is in the path at all. A 200 there would mean the dev proxy is not
reaching the route this plan assumes.

**MEASURED 2026-09-21, dev server on :5173** — recorded here, because a probe whose
answer is not written down is an assumption again:

| through the dev proxy | result |
|---|---|
| `/rpc` `getLatestBlockhash` | 200, real blockhash |
| `/rpc` `sendTransaction` | **403** `-32601 method not allowed` |
| `/api/v1/stats` | 200, live data |
| `/api/v1/stats` **with a browser-style `Origin` header** | 200 |

The last row is the one that mattered: the earlier `curl`-only probe sent no `Origin`
and so could not see that the coordinator answered an unlisted one with a 500. That is
fixed server-side (`callback(null, false)` — no CORS headers, request answered
normally), and the dev proxy additionally **rewrites `Origin` to
`https://wallet.noc-tura.io`**, because Vite moves to :5174 when :5173 is taken and an
unlisted port returns without CORS headers — a failure that reads as "the API is down".

If the first call fails, the cause is `ignorePath` behaving differently in the
installed Vite/http-proxy version than assumed here. Record what you find **in this
plan**, then fix it.

- [ ] **Step 5: Commit**

```bash
git add web/src/config.ts web/vite.config.ts web/.env.local.example web/src/__tests__/config.test.ts
git commit -m "feat(web): same-origin config, dev proxies, absolute RPC endpoint

Connection rejects a relative endpoint — verified by constructing one in the test,
so the reason this is absolute is pinned rather than remembered. fetch is happy with
the relative API path, so that one stays relative and no host is hard-coded.

The proxy logs host and path without the query, and the probe step names the two
different failures that both surface as 'Unauthorized' so the next person does not
debug the wrong one."
```

---

### Task 3: The ports, and the first module moved through them

`core/` must not import React Native, MMKV, Zustand or `react-native-config`. Each moved module therefore takes a **narrow port**: the smallest interface it actually needs, so nothing drags a platform in behind it.

**Files:**
- Create: `core/ports.ts`, `core/presale/stats.ts`, `core/presale/stagePrices.ts`, `core/util/parseTokenAmount.ts`
- Modify: `src/modules/presale/presaleModule.ts` (delegate), `src/constants/presale.ts` (re-export)
- Test: `core/presale/__tests__/stats.test.ts`

**Interfaces:**
- Produces:
  - `interface JsonGetter { get<T>(path: string): Promise<T> }` — `path` is bare, e.g. `/stats`
  - `PRESALE_STAGE_PRICES: readonly number[]`, `nocUsdPriceForStage(stage: number | null): number`
  - `fetchPresaleStats(json: JsonGetter): Promise<{displayStage: number; pricePerNocUsd: number; soldInStageBase: string; stageCapacityBase: string; isPaused: boolean}>`

- [ ] **Step 1: Write the failing test**

`core/presale/__tests__/stats.test.ts`:

```ts
import {fetchPresaleStats} from '../stats';
import type {JsonGetter} from '../../ports';

function jsonReturning(body: unknown): JsonGetter {
  return {get: async () => body as never};
}

describe('fetchPresaleStats', () => {
  it('derives the price from the stage table — /stats does not carry a price', async () => {
    const stats = await fetchPresaleStats(jsonReturning({success: true, data: {currentStage: 1, totalNocSold: 0, isPaused: false}}));
    expect(stats.displayStage).toBe(2);
    expect(stats.pricePerNocUsd).toBe(0.1723);
  });

  it('clamps a stage index beyond the table instead of returning undefined', async () => {
    const stats = await fetchPresaleStats(jsonReturning({success: true, data: {currentStage: 99, totalNocSold: 0, isPaused: false}}));
    expect(stats.displayStage).toBe(10);
    expect(Number.isFinite(stats.pricePerNocUsd)).toBe(true);
  });

  it('throws on an unsuccessful envelope rather than showing stage 1 at full price', async () => {
    await expect(fetchPresaleStats(jsonReturning({success: false}))).rejects.toThrow();
  });

  it('treats a missing isPaused as not paused, and a true one as paused', async () => {
    const open = await fetchPresaleStats(jsonReturning({success: true, data: {currentStage: 0, totalNocSold: 0}}));
    const shut = await fetchPresaleStats(jsonReturning({success: true, data: {currentStage: 0, totalNocSold: 0, isPaused: true}}));
    expect(open.isPaused).toBe(false);
    expect(shut.isPaused).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd web && npm test -- stats`
Expected: FAIL — `Cannot find module '../stats'`.

- [ ] **Step 3: Move the implementation**

`core/ports.ts`:

```ts
/**
 * The narrowest transport a core module can ask for. The app supplies a
 * pinnedFetch-backed implementation; the web supplies one over plain fetch. Paths
 * are bare — the base URL already carries `/api/v1`.
 */
export interface JsonGetter {
  get<T>(path: string): Promise<T>;
}
```

`core/presale/stagePrices.ts` — move the table and helper out of `src/constants/presale.ts` verbatim, keeping the comment, then have the RN file re-export them:

```ts
export const PRESALE_STAGE_PRICES: readonly number[] = [
  0.1501, 0.1723, 0.1945, 0.2167, 0.2389, 0.2611, 0.2833, 0.3055, 0.3277, 0.3499,
];

export const TOKENS_PER_STAGE = 10_240_000;

export function nocUsdPriceForStage(stage: number | null): number {
  if (stage == null || stage < 1 || stage > PRESALE_STAGE_PRICES.length) {
    return PRESALE_STAGE_PRICES[0]!;
  }
  return PRESALE_STAGE_PRICES[stage - 1]!;
}
```

`core/util/parseTokenAmount.ts` — move `src/utils/parseTokenAmount.ts` **whole**: it has zero imports, it is pure, and `fetchPresaleStats` reaches it through `nocStringToBase`. Leave `src/utils/parseTokenAmount.ts` as a one-line re-export so its many existing importers and `parseTokenAmount.test.ts` keep working. Without this move, core would import upward into `src/`, which is the wrong direction and is also invisible to the secret scan (`scan` walks `src ../core` from `web/`, never `src/utils` from core's point of view).

`core/presale/stats.ts` — the body is `fetchPresaleStats` from `src/modules/presale/presaleModule.ts:37-56`, with `getCoordinatorJson('/stats')` replaced by `json.get('/stats')`. Bring `nocStringToBase` with it. Copy the arithmetic exactly; do not re-derive it.

Then in `src/modules/presale/presaleModule.ts`, replace the moved function with a delegation that supplies the app's transport:

```ts
import {fetchPresaleStats as coreFetchPresaleStats} from '../../../core/presale/stats';

const appJson = {get: <T,>(path: string) => getCoordinatorJson(path) as Promise<T>};

export const fetchPresaleStats = () => coreFetchPresaleStats(appJson);
```

- [ ] **Step 4: Prove the move with the app's own tests**

Run: `cd web && npm test -- stats` → PASS, 4 tests.
Run: `cd .. && npx jest src/modules/presale src/constants src/utils && npx tsc --noEmit` → PASS. `parseTokenAmount.test.ts` is what proves the utility survived the move intact.

The RN suite passing against the moved code is the whole point: one implementation, guarded by tests that already existed.

- [ ] **Step 5: Commit**

```bash
git add core/ports.ts core/presale src/modules/presale/presaleModule.ts src/constants/presale.ts
git commit -m "refactor(core): ports, and the presale stats reader moved behind one

core/ takes the narrowest interface each module needs, so nothing drags React
Native, MMKV or react-native-config in behind it. The app keeps its pinnedFetch
transport and passes it in.

Moved, not copied: the stage price table lives in the client, /stats carries no
price, and two copies of that table would be two answers to what a buyer pays."
```

---

### Task 4: Move the on-chain allocation and TGE readers

**Files:**
- Create: `core/presale/allocation.ts`, `core/presale/addresses.ts`
- Modify: `src/modules/presale/presaleBuyModule.ts` (delegate), `src/constants/programs.ts` (re-export the mainnet literals)
- Test: `core/presale/__tests__/allocation.test.ts`

**Interfaces:**
- Produces:
  - `interface AccountReader { getAccountInfo(address: PublicKey): Promise<{data: Uint8Array} | null> }`
  - `derivePresalePdas(user: PublicKey): {config; userAccount; userAllocation; referrerAllocation}` — **four** fields; the app's tests read `referrerAllocation`
  - `readU64LE(data: Uint8Array, offset: number): bigint`
  - `fetchOnChainAllocation(reader: AccountReader, user: PublicKey): Promise<{totalTokensBase: string; exists: boolean}>`
  - `fetchTgeTimestamp(reader: AccountReader): Promise<number | null>`
  - `ALLOCATION_TOTAL_TOKENS_OFFSET = 40`, `CONFIG_TGE_TIMESTAMP_OFFSET = 201`

- [ ] **Step 1: Write the failing test**

`core/presale/__tests__/allocation.test.ts`:

```ts
import {PublicKey} from '@solana/web3.js';
import {
  ALLOCATION_TOTAL_TOKENS_OFFSET,
  CONFIG_TGE_TIMESTAMP_OFFSET,
  derivePresalePdas,
  fetchOnChainAllocation,
  fetchTgeTimestamp,
  readU64LE,
} from '../allocation';

const USER = new PublicKey('Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B');
const readerFor = (data: Uint8Array | null) => ({getAccountInfo: async () => (data ? {data} : null)});

function u64le(value: bigint, at: number, length: number): Uint8Array {
  const buf = new Uint8Array(length);
  let v = value;
  for (let i = 0; i < 8; i++) {
    buf[at + i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return buf;
}

describe('allocation readers', () => {
  it('derives four distinct PDAs, deterministically', () => {
    const a = derivePresalePdas(USER);
    const b = derivePresalePdas(USER);
    expect(a.userAllocation.toBase58()).toBe(b.userAllocation.toBase58());
    expect(
      new Set([a.config, a.userAccount, a.userAllocation, a.referrerAllocation].map(k => k.toBase58())).size,
    ).toBe(4);
  });

  it('decodes u64 little-endian without Buffer BigInt accessors', () => {
    // buffer@5.7.1 has no readBigUInt64LE; Hermes would throw where Node does not.
    expect(readU64LE(u64le(1_234_000_000_000n, 0, 8), 0)).toBe(1_234_000_000_000n);
    expect(readU64LE(u64le(0n, 0, 8), 0)).toBe(0n);
    expect(readU64LE(u64le(2n ** 64n - 1n, 0, 8), 0)).toBe(2n ** 64n - 1n);
  });

  it('reads total_tokens at offset 40', async () => {
    const data = u64le(1_234_000_000_000n, ALLOCATION_TOTAL_TOKENS_OFFSET, ALLOCATION_TOTAL_TOKENS_OFFSET + 8);
    expect(await fetchOnChainAllocation(readerFor(data), USER)).toEqual({
      totalTokensBase: '1234000000000',
      exists: true,
    });
  });

  it('reports absence rather than zero when the account is missing', async () => {
    expect((await fetchOnChainAllocation(readerFor(null), USER)).exists).toBe(false);
  });

  it('reads tge_timestamp at offset 201 and returns the real value', async () => {
    const data = u64le(1_893_456_000n, CONFIG_TGE_TIMESTAMP_OFFSET, CONFIG_TGE_TIMESTAMP_OFFSET + 8);
    expect(await fetchTgeTimestamp(readerFor(data))).toBe(1_893_456_000);
  });

  // BEHAVIOUR CHANGE, declared: the app returns Number(0) for a zero field
// (presaleBuyModule.ts:122) and its tests never cover that case, so the RN suite
// passing does NOT prove this one unchanged. null is the better answer — the
// countdown then says "not set" instead of counting from 1970 — but it is a change
// and the app's `tgeCountdownDisplay` consumer must be checked for it.
it('returns null for a zero timestamp — not 1970 (negative control for the offset)', async () => {
    const data = new Uint8Array(CONFIG_TGE_TIMESTAMP_OFFSET + 8);
    expect(await fetchTgeTimestamp(readerFor(data))).toBeNull();
  });

  it('returns null when the account is too short to hold the field', async () => {
    expect(await fetchTgeTimestamp(readerFor(new Uint8Array(8)))).toBeNull();
  });
});
```

The zero-value test and the too-short test are separate on purpose: with the wrong offset both would return null, and a single test would pass either way.

- [ ] **Step 2: Run it and watch it fail**

Run: `cd web && npm test -- allocation`
Expected: FAIL — module missing.

- [ ] **Step 3: Move the implementation**

`core/presale/allocation.ts` — take the bodies from `src/modules/presale/presaleBuyModule.ts:50-128` unchanged, including the **byte-loop decode**, and change only the connection source:

**Two decisions this task must make, because the previous version left them implicit and both are fatal in a browser.**

**`Buffer` is not a global in a Vite bundle.** Every moved body uses it —
`Buffer.from('config')`, `Buffer.concat`, `Buffer.alloc` — and web3.js imports the
`buffer` package for itself without defining `globalThis.Buffer`. Under Vitest (Node)
the global exists, so the tests would be green and the page would throw
`ReferenceError: Buffer is not defined` on the first PDA derivation. Every core file
that touches it therefore imports it explicitly:

```ts
import {Buffer} from 'buffer';
```

which resolves to the root `buffer@5.7.1` for React Native and Jest, and to the copy
web3.js already carries under the web build. `TransactionInstruction`'s `data` field is
typed `Buffer`, so this is also what type-checks. **`readU64LE` and `encodeU64LE` still
return/accept `Uint8Array` and do their own byte loops** — the import gives us the
constructor, not the BigInt accessors, which 5.7.1 does not have.

**Core needs `PROGRAM` and `ADMIN`, and `src/constants/programs.ts` cannot be their home**
— its first line is `import Config from 'react-native-config'`, and it runs
`assertKnownNetwork(Config.NETWORK)` at import time. Pulling it into the web bundle
drags React Native in; copying the literals creates the second specification this plan
exists to avoid. So `core/presale/addresses.ts` owns them, and the app re-exports:

```ts
import {PublicKey} from '@solana/web3.js';

/** Mainnet, as recorded in the project's CLAUDE.md. `src/constants/programs.ts`
 *  re-exports these; it keeps the devnet switch, which core does not need. */
export const PROGRAM = new PublicKey('6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt');
export const ADMIN = new PublicKey('KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr');
export const NOC_MINT = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
export const NOC_DECIMALS = 9;
```

Read the current values out of `src/constants/programs.ts` before writing this file and
use those; the ones above are from `CLAUDE.md` and must agree. If they disagree, stop —
that disagreement is a finding, not a formatting detail.

```ts
import {Buffer} from 'buffer';
import {PublicKey} from '@solana/web3.js';

export interface AccountReader {
  getAccountInfo(address: PublicKey): Promise<{data: Uint8Array} | null>;
}

export const ALLOCATION_TOTAL_TOKENS_OFFSET = 40;
export const CONFIG_TGE_TIMESTAMP_OFFSET = 201;

/**
 * buffer@5.7.1 — what React Native ships — has no readBigUInt64LE. Reading a u64
 * by hand is not style; on Hermes the accessor simply does not exist, and the
 * failure appears only on a device.
 */
export function readU64LE(data: Uint8Array, offset: number): bigint {
  let value = 0n;
  for (let i = 7; i >= 0; i--) {
    value = (value << 8n) | BigInt(data[offset + i]!);
  }
  return value;
}
```

Keep `derivePresalePdas` with **all four** fields (`config`, `userAccount`, `userAllocation`, `referrerAllocation`) exactly as `presaleBuyModule.ts:58-69` derives them, then implement the two readers against `AccountReader` using `readU64LE`.

In `src/modules/presale/presaleBuyModule.ts`, delete the moved bodies and delegate:

```ts
import {
  derivePresalePdas,
  fetchOnChainAllocation as coreFetchOnChainAllocation,
  fetchTgeTimestamp as coreFetchTgeTimestamp,
} from '../../../core/presale/allocation';

export {derivePresalePdas};
const appReader = {getAccountInfo: (a: PublicKey) => getConnection().getAccountInfo(a)};
export const fetchOnChainAllocation = (user: PublicKey) => coreFetchOnChainAllocation(appReader, user);
export const fetchTgeTimestamp = () => coreFetchTgeTimestamp(appReader);
```

- [ ] **Step 4: Prove the move with the app's own tests**

Run: `cd web && npm test -- allocation` → PASS, 7 tests.
Run: `cd .. && npx jest src/modules/presale && npx tsc --noEmit` → PASS. `presaleBuyModule.test.ts` reads `pdas.referrerAllocation` and decodes 1893456000 at offset 201; if either was changed, it fails here.

- [ ] **Step 5: Commit**

```bash
git add core/presale/allocation.ts src/modules/presale/presaleBuyModule.ts
git commit -m "refactor(core): move the allocation and TGE readers, byte loop intact

The u64 decode stays a hand-written loop: buffer@5.7.1 has no readBigUInt64LE, so
the tidy accessor works in Node and throws on a phone. A test pins the loop against
0, a mid value and 2^64-1.

derivePresalePdas keeps all four PDAs — the app's tests read referrerAllocation, and
they are the proof that this move changed nothing."
```

---

### Task 5: Connect a wallet — observing the real button, not the imagined one

**Files:**
- Create: `web/src/wallet/WalletProviders.tsx`, `web/src/wallet/ConnectPanel.tsx`
- Modify: `web/src/App.tsx`, `web/package.json`
- Test: `web/src/wallet/__tests__/ConnectPanel.test.tsx`

**Interfaces:**
- Consumes: `rpcEndpoint()` (Task 2).
- Produces: `<WalletProviders>`, `<ConnectPanel />`.

- [ ] **Step 1: PROBE the adapter before writing a test against it**

Install, render `WalletMultiButton` on a scratch page, and **write down two things**: the exact text it renders with no wallet connected, and whether `@solana/wallet-adapter-react-ui/styles.css` must be imported for the modal to be usable.

```bash
cd web && npm i @solana/wallet-adapter-base @solana/wallet-adapter-react @solana/wallet-adapter-react-ui
```

Also record whether Phantom and Solflare appear in the modal with `wallets={[]}` — modern adapters register through the Wallet Standard, and if they do, `@solana/wallet-adapter-wallets` (which re-exports dozens of adapters, each with its own hosts) is not needed. **Do not install it on the assumption that it is.**

Write the observed values into the test below instead of guessing them.

- [ ] **Step 2: Write the failing test**

`web/src/wallet/__tests__/ConnectPanel.test.tsx` — this tests *our* component, not the vendor button, so the vendor button is stubbed:

```tsx
import {render, screen} from '@testing-library/react';
import {ConnectPanel} from '../ConnectPanel';

const connect = vi.fn();
const signMessage = vi.fn();

vi.mock('@solana/wallet-adapter-react-ui', () => ({
  WalletMultiButton: () => <button type="button">Select Wallet</button>,
}));
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({publicKey: null, connected: false, connect, signMessage}),
}));

describe('ConnectPanel', () => {
  beforeEach(() => {
    connect.mockClear();
    signMessage.mockClear();
  });

  it('renders the wallet button', () => {
    render(<ConnectPanel />);
    expect(screen.getByRole('button', {name: /select wallet/i})).toBeTruthy();
  });

  it('requests no connection and no signature on mount', () => {
    render(<ConnectPanel />);
    expect(connect).not.toHaveBeenCalled();
    expect(signMessage).not.toHaveBeenCalled();
    // Positive control: the spies are wired to something that would register a call.
    connect();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('states that the recovery phrase is never requested', () => {
    render(<ConnectPanel />);
    expect(screen.getByText(/never ask for your recovery phrase/i)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run it and watch it fail, then implement**

`web/src/wallet/WalletProviders.tsx`:

```tsx
import {type ReactNode} from 'react';
import {ConnectionProvider, WalletProvider} from '@solana/wallet-adapter-react';
import {WalletModalProvider} from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';
import {rpcEndpoint} from '../config';

export function WalletProviders({children}: {children: ReactNode}) {
  // autoConnect stays off: a page that connects on arrival is the shape every
  // drainer uses, and users are right to be trained against it.
  return (
    <ConnectionProvider endpoint={rpcEndpoint()}>
      <WalletProvider wallets={[]} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

If the probe showed that `wallets={[]}` leaves the modal empty, add only the two named adapters from `@solana/wallet-adapter-wallets` and note in the commit why the larger package had to come in.

`web/src/wallet/ConnectPanel.tsx`:

```tsx
import {useWallet} from '@solana/wallet-adapter-react';
import {WalletMultiButton} from '@solana/wallet-adapter-react-ui';

export function ConnectPanel() {
  const {publicKey} = useWallet();
  return (
    <section>
      <WalletMultiButton />
      {publicKey ? <p>{publicKey.toBase58()}</p> : null}
      <p>Noctura will never ask for your recovery phrase.</p>
    </section>
  );
}
```

- [ ] **Step 4: Verify**

Run: `cd web && npm test -- ConnectPanel` → PASS, 3 tests.
Manual: `npm run dev`, click the button, connect Phantom, confirm the address appears and that **nothing was signed**.

- [ ] **Step 5: Commit**

```bash
git add web/src/wallet web/src/App.tsx web/package.json web/package-lock.json
git commit -m "feat(web): connect a wallet, and nothing else on load

The label in the test is the one the vendor button actually renders, observed before
the test was written rather than assumed. autoConnect is off and no signature is
requested until the user asks for one.

The no-signature test carries a positive control: the spies are proven able to
register a call, so the assertion can fail for the right reason."
```

---

### Task 6: Presale panel — stage and price from core, allocation from the chain, error distinguished from absence

**Files:**
- Create: `web/src/lib/api.ts`, `web/src/lib/solana.ts`, `web/src/presale/usePresale.ts`, `web/src/presale/PresalePanel.tsx`, `web/src/format.ts`
- Modify: `web/src/App.tsx`, `web/package.json` (`@tanstack/react-query`)
- Test: `web/src/presale/__tests__/PresalePanel.test.tsx`, `web/src/__tests__/format.test.ts`

**Interfaces:**
- Consumes: `fetchPresaleStats` (Task 3), `fetchOnChainAllocation` (Task 4), `API_BASE`/`rpcEndpoint()` (Task 2).
- Produces: `formatBaseUnits(base: bigint, decimals: number, symbol: string): string`; `<PresalePanel stats allocation />` where `allocation` is `{status: 'absent'} | {status: 'error'} | {status: 'ok'; base: string}`.

- [ ] **Step 1: Write the failing tests**

`web/src/__tests__/format.test.ts`:

```ts
import {formatBaseUnits} from '../format';

it('formats base units without floats', () => {
  expect(formatBaseUnits(1_234_000_000_000n, 9, 'NOC')).toBe('1,234 NOC');
  expect(formatBaseUnits(473_081_440n, 9, 'SOL')).toBe('0.47308144 SOL');
  expect(formatBaseUnits(0n, 9, 'NOC')).toBe('0 NOC');
});

it('does not lose precision a float would lose', () => {
  expect(formatBaseUnits(9_007_199_254_740_993n, 9, 'NOC')).toContain('9,007,199');
});
```

`web/src/presale/__tests__/PresalePanel.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import {PresalePanel} from '../PresalePanel';

const stats = {
  displayStage: 2,
  pricePerNocUsd: 0.1723,
  soldInStageBase: '0',
  stageCapacityBase: '10240000000000000',
  isPaused: false,
};

it('shows the stage and its price', () => {
  render(<PresalePanel stats={stats} allocation={{status: 'absent'}} />);
  expect(screen.getByText(/stage 2/i)).toBeTruthy();
  expect(screen.getByText(/0\.1723/)).toBeTruthy();
});

it('shows the allocation when there is one', () => {
  render(<PresalePanel stats={stats} allocation={{status: 'ok', base: '1234000000000'}} />);
  expect(screen.getByText('1,234 NOC')).toBeTruthy();
});

it('says "no allocation" only when the read succeeded and found none', () => {
  render(<PresalePanel stats={stats} allocation={{status: 'absent'}} />);
  expect(screen.getByText(/no allocation/i)).toBeTruthy();
});

it('says the read failed when it failed — never "no allocation"', () => {
  render(<PresalePanel stats={stats} allocation={{status: 'error'}} />);
  expect(screen.queryByText(/no allocation/i)).toBeNull();
  expect(screen.getByText(/could not be read/i)).toBeTruthy();
});

it('marks the presale paused', () => {
  render(<PresalePanel stats={{...stats, isPaused: true}} allocation={{status: 'absent'}} />);
  expect(screen.getByText(/paused/i)).toBeTruthy();
});
```

The fourth test is the one that matters: "we could not read your allocation" and "you have none" are opposite statements to someone checking whether their money arrived, and a failed RPC call must never produce the second.

- [ ] **Step 2: Run them and watch them fail**

Run: `cd web && npm test -- PresalePanel format`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

`web/src/lib/api.ts`:

```ts
import {API_BASE} from '../config';
import type {JsonGetter} from '../../../core/ports';

/** Fail closed: a non-200 throws, and so does a 200 whose envelope says failure. */
export const json: JsonGetter = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`);
    if (res.status !== 200) throw new Error(`${path} returned HTTP ${res.status}`);
    return (await res.json()) as T;
  },
};
```

`web/src/lib/solana.ts`:

```ts
import {Connection, PublicKey} from '@solana/web3.js';
import {rpcEndpoint} from '../config';

let cached: Connection | null = null;

export function connection(): Connection {
  cached ??= new Connection(rpcEndpoint(), 'confirmed');
  return cached;
}

/** The narrow reader core asks for, backed by the shared Connection. */
export const accountReader = {
  getAccountInfo: (address: PublicKey) => connection().getAccountInfo(address),
};
```

`web/src/format.ts`:

```ts
export function formatBaseUnits(base: bigint, decimals: number, symbol: string): string {
  const unit = 10n ** BigInt(decimals);
  const whole = (base / unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = (base % unit).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac} ${symbol}` : `${whole} ${symbol}`;
}
```

`web/src/presale/usePresale.ts` uses TanStack Query for both reads and maps the allocation query into the three-state shape: `isError` → `{status:'error'}`, `exists === false` → `{status:'absent'}`, otherwise `{status:'ok', base}`. `PresalePanel` renders the five cases above.

- [ ] **Step 4: Verify**

Run: `cd web && npm test` → PASS.
Manual: connect a wallet with an allocation and confirm the NOC figure equals what the Android app shows for the same address. Then stop the dev proxy and reload: the panel must say the allocation could not be read, **not** that there is none.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib web/src/presale web/src/format.ts web/src/App.tsx web/package.json web/package-lock.json
git commit -m "feat(web): presale panel, with a failed read distinguished from an empty one

Allocation is a three-state value, not a nullable number. 'We could not read your
allocation' and 'you have none' are opposite claims to someone checking whether
their money arrived, and an RPC outage must never produce the second. There is a
test for exactly that, and the manual step is to pull the proxy down and look."
```

---

### Task 7: Balances — every account for the mint, polled

**Files:**
- Create: `web/src/portfolio/useBalances.ts`, `web/src/portfolio/PortfolioPanel.tsx`
- Test: `web/src/portfolio/__tests__/useBalances.test.tsx`

**Interfaces:**
- Consumes: `connection()` (Task 6), `formatBaseUnits` (Task 6).
- Produces: `useBalances(publicKey: PublicKey | null): {sol: bigint | null; noc: bigint | null; isError: boolean}`.

- [ ] **Step 1: Write the failing test**

Wrap the hook in a `QueryClientProvider` — a `useQuery` hook rendered without one throws "No QueryClient set".

```tsx
import {renderHook, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {PublicKey} from '@solana/web3.js';
import {useBalances} from '../useBalances';

const getBalance = vi.fn();
const getParsed = vi.fn();
vi.mock('../../lib/solana', () => ({
  connection: () => ({getBalance, getParsedTokenAccountsByOwner: getParsed}),
}));

const USER = new PublicKey('Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B');

function wrapper({children}: {children: React.ReactNode}) {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  getBalance.mockReset();
  getParsed.mockReset();
});

it('returns lamports as bigint', async () => {
  getBalance.mockResolvedValue(473081440);
  getParsed.mockResolvedValue({value: []});
  const {result} = renderHook(() => useBalances(USER), {wrapper});
  await waitFor(() => expect(result.current.sol).toBe(473081440n));
});

it('sums every account for the mint, not the derived ATA alone', async () => {
  getBalance.mockResolvedValue(0);
  getParsed.mockResolvedValue({
    value: [
      {account: {data: {parsed: {info: {tokenAmount: {amount: '1000000000'}}}}}},
      {account: {data: {parsed: {info: {tokenAmount: {amount: '2000000000'}}}}}},
    ],
  });
  const {result} = renderHook(() => useBalances(USER), {wrapper});
  await waitFor(() => expect(result.current.noc).toBe(3000000000n));
});

it('distinguishes an empty wallet from a failed read', async () => {
  getBalance.mockResolvedValue(0);
  getParsed.mockResolvedValue({value: []});
  const {result: ok} = renderHook(() => useBalances(USER), {wrapper});
  await waitFor(() => expect(ok.current.noc).toBe(0n));

  getBalance.mockRejectedValue(new Error('rpc down'));
  const {result: bad} = renderHook(() => useBalances(USER), {wrapper});
  await waitFor(() => expect(bad.current.isError).toBe(true));
  expect(bad.current.sol).toBeNull();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd web && npm test -- useBalances` → FAIL, module missing.

- [ ] **Step 3: Implement**

`useBalances` calls `connection().getBalance(owner)` and `connection().getParsedTokenAccountsByOwner(owner, {mint: NOC_MINT})` inside one `useQuery` with `refetchInterval: 20_000` (polled, because a WebSocket endpoint would expose the key exactly as the HTTP one does), reduces every returned account's `tokenAmount.amount` with `BigInt`, and returns `{sol: null, noc: null, isError: true}` when the query errored. `PortfolioPanel` renders `formatBaseUnits(...)`, or an em dash when `isError`.

- [ ] **Step 4: Verify**

Run: `cd web && npm test -- portfolio` → PASS, 3 tests.
Manual: compare both figures with the Android app for the same address.

- [ ] **Step 5: Commit**

```bash
git add web/src/portfolio
git commit -m "feat(web): SOL and NOC balances, polled and summed across accounts

Every account for the mint is summed rather than the derived ATA read: this project
has a wallet whose tokens live in a non-canonical account, and reading only the ATA
shows a zero that is not true.

0 NOC and 'could not read' are separate states, with a test that asserts both — one
means an empty wallet and the other means we do not know."
```

---

### Task 8: The geo gate — the real contract, OFAC-only

**Files:**
- Create: `core/geo/classify.ts`, `core/geo/restrictedList.ts`, `web/src/geo/useGeo.ts`
- Test (web): `web/src/geo/__tests__/checkGeo.test.ts` — the wiring is where v1 invented a field, so it does not go untested
- Modify: `src/modules/geoFence/geoFenceModule.ts` (delegate the classifier)
- Test: `core/geo/__tests__/classify.test.ts`

**Interfaces:**
- Produces:
  - `interface RestrictedCountry {code: string; category: 'sanctioned' | 'restricted'; name?: string}`
  - `interface JurisdictionResult {action: 'allow'|'warn'|'block'; countryCode: string; reason?: 'restricted'|'sanctioned'|'ambiguous'|'vpn_detected'; transparentAllowed: true; message?: string}`
  - `classifyJurisdiction(input: {countryCode: string; isVpn: boolean}, restricted: readonly RestrictedCountry[]): JurisdictionResult`
  - `isPresaleBlocked(result: JurisdictionResult): boolean`
  - from `web/src/geo/useGeo.ts`: `checkGeo(): Promise<JurisdictionResult>` — the name Task 9 depends on

- [ ] **Step 1: Write the failing test**

```ts
import {classifyJurisdiction, isPresaleBlocked} from '../classify';

const LIST = [
  {code: 'IR', category: 'sanctioned' as const},
  {code: 'RO', category: 'restricted' as const},
];

it('blocks only sanctioned jurisdictions — the presale policy is OFAC-only', () => {
  const r = classifyJurisdiction({countryCode: 'IR', isVpn: false}, LIST);
  expect(r.action).toBe('block');
  expect(r.reason).toBe('sanctioned');
  expect(isPresaleBlocked(r)).toBe(true);
});

it('warns, and does not block, on a merely restricted country', () => {
  const r = classifyJurisdiction({countryCode: 'RO', isVpn: false}, LIST);
  expect(r.action).toBe('warn');
  expect(isPresaleBlocked(r)).toBe(false);
});

it('warns on a VPN rather than blocking', () => {
  expect(classifyJurisdiction({countryCode: 'SI', isVpn: true}, LIST).action).toBe('warn');
});

it('allows an unlisted country with no VPN (positive control)', () => {
  const r = classifyJurisdiction({countryCode: 'SI', isVpn: false}, LIST);
  expect(r.action).toBe('allow');
  expect(isPresaleBlocked(r)).toBe(false);
});

it('always permits transparent use, whatever the verdict', () => {
  for (const cc of ['IR', 'RO', 'SI']) {
    expect(classifyJurisdiction({countryCode: cc, isVpn: false}, LIST).transparentAllowed).toBe(true);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd web && npm test -- classify` → FAIL, module missing.

- [ ] **Step 3: Move the classifier**

Take the decision branches from `src/modules/geoFence/geoFenceModule.ts:105-140` — no list entry → `allow`; `category === 'sanctioned'` → `block`/`sanctioned`; otherwise → `warn`/`restricted`; `isVpn` → `warn`/`vpn_detected` — into `core/geo/classify.ts` as a pure function over `(input, restricted)`. Move `isPresaleBlocked` (`:27`) with it. **Transport and caching stay per platform**: the app keeps its MMKV-cached list with the 6-hour TTL and the bundled fallback; the web fetches `/geo/restricted-list` through `json.get`.

Move `BUNDLED_RESTRICTED_LIST` and `BUNDLED_LIST_DATE` from `src/modules/geoFence/restrictedList.ts` into `core/geo/restrictedList.ts` — pure data, no imports — and re-export from the app file. The web needs the same fallback: without it, a failure of `/geo/restricted-list` leaves the page unable to block anyone, including the jurisdictions the gate exists for.

`web/src/geo/useGeo.ts` exports **`checkGeo(): Promise<JurisdictionResult>`** — Task 9 mocks it by that name. It fetches `/geo/check` — real shape `{countryCode, isVpn}`, **no envelope** — and `/geo/restricted-list`, falls back to the bundled list on failure, then calls `classifyJurisdiction`.

**When `/geo/check` itself fails, the buy is refused, not warned.** The app's `warn` on an unreachable service is its shielded-era fail-safe, and copying it here would contradict spec §6.8 — "a failed geo check … blocks the action and says so" — silently. So `checkGeo` throws when the country lookup fails and `useBuy` surfaces that; the rest of the page keeps working, because only the purchase is gated. Write this divergence from the app's behaviour into the file header, or the next reader will "fix" it back.

`web/src/geo/__tests__/checkGeo.test.ts` covers four cases: a sanctioned country blocks; an unlisted country allows; `/geo/restricted-list` failing still blocks a sanctioned country through the bundled fallback; and `/geo/check` failing **throws** rather than returning warn.

Then have `geoFenceModule.ts` import the classifier from core instead of its private copy.

- [ ] **Step 4: Verify**

Run: `cd web && npm test -- classify` → PASS, 5 tests.
Run: `cd .. && npx jest src/modules/geoFence && npx tsc --noEmit` → PASS. The app's geo tests are the proof the move changed no decision.

- [ ] **Step 5: Commit**

```bash
git add core/geo web/src/geo src/modules/geoFence/geoFenceModule.ts
git commit -m "refactor(core): move the jurisdiction classifier, keep the real contract

/geo/check returns {countryCode, isVpn} with no envelope and no 'allowed' field: the
decision has always been client-side and OFAC-only. A web client inventing an
'allowed' boolean would have refused every purchase while its mocked tests stayed
green.

Transport and caching stay per platform; only the decision moved, and the app's own
geo tests are what prove it still decides the same way."
```

---

### Task 9: Buy with SOL — the whole money path, moved rather than re-invented

The previous version of this task invented three things and each would have cost real
money. What follows is built out of what the app already does.

**Files:**
- Create: `core/presale/buyInstructions.ts`, `core/presale/referrer.ts`, `core/presale/record.ts`, `core/solana/priorityFee.ts`, `web/src/presale/useBuy.ts`, `web/src/presale/BuyForm.tsx`
- Modify: `src/modules/presale/presaleBuyModule.ts`, `src/modules/presale/presaleModule.ts`, `src/modules/solana/priorityFee.ts` (all three become delegations), `web/src/lib/api.ts` (add `post`)
- Test: `core/presale/__tests__/buyInstructions.test.ts`, `core/presale/__tests__/referrer.test.ts`, `web/src/presale/__tests__/useBuy.test.tsx`

**Interfaces:**
- `encodeU64LE(value: bigint): Uint8Array` — byte loop; `buffer@5.7.1` has no `writeBigUInt64LE` either
- `buildSolPurchaseInstruction(user, solLamports, referrerAllocation): TransactionInstruction`
- `buildBuyInstructions(user, solLamports, priorityFeeMicroLamports, resolved): TransactionInstruction[]`
- `fetchAllocationRef(reader: AccountReader, user): Promise<{exists: boolean; referrer: string | null; purchaseCount: number}>`
- `resolveReferrer(reader: AccountReader, user, capturedReferrer: string | null): Promise<{referrerAllocation: PublicKey; registerReferrer: PublicKey | null; effectiveReferrerAddress: string | null}>`
- `estimatePriorityFee(fees: FeeReader, level: PriorityLevel): Promise<number>` where `FeeReader = {getRecentPrioritizationFees(): Promise<{prioritizationFee: number}[]>}`
- `recordPresalePurchase(post: JsonPoster, rec: PresalePurchaseRecord): Promise<void>` — **best effort, never throws**
- `useBuy(): {submit(solLamports: bigint): Promise<string>; state: BuyState; error: string | null; canBuy: boolean; blockedReason: string | null}`

#### Three corrections this task exists to carry

**1. The referrer PDA is not derivable from the buyer alone.** `presaleBuyModule.ts:225`
says it outright: *the program validates `referrer_allocation` against
`["allocation", user_allocation.referrer]`, so a mismatch makes the tx fail.* Anyone who
has ever bought with a referrer has a non-default on-chain referrer, so passing
`derivePresalePdas(user).referrerAllocation` makes **their** purchase fail simulation
with no stated cause. `resolveReferrer` is pure once `fetchAllocationRef` takes an
`AccountReader` — the only MMKV-bound input is the *captured* referrer, which is already
a parameter. Both move; the web passes the `?ref=` query parameter, or `null`.

**2. The coordinator's record has eight fields and never throws.** The real contract is
`PresalePurchaseRecord {txHash, buyerAddress, paymentToken, paymentAmount, nocAmount,
usdValue, stage, referrerAddress?}` (`presaleModule.ts:76-85`), and
`recordPresalePurchase` swallows failures on purpose — the chain is the source of truth
and a failed archive must not look like a failed purchase (`:88-98`). Move that function
behind a `post` port instead of writing a new one that invents `{signature, address,
solLamports}` and throws.

**3. The priority fee has an engineered ceiling, and re-reading the raw RPC drops it.**
`src/modules/solana/priorityFee.ts` clamps between `FLOOR` and `CEILING` so that
`CEILING * MAX_COMPUTE_UNITS / 1e6 <= MAX_PRIORITY_FEE_LAMPORTS`, with the reason in the
file: *the RPC is untrusted … no RPC response can inflate the fee without bound.* Telling
the web to call `getRecentPrioritizationFees` itself would be a copy with the control
removed, on the one path that spends money. Move the module; narrow its `Connection`
parameter to the one method it calls.

- [ ] **Step 1: PROBE — can a wallet that cannot broadcast be recognised BEFORE it signs?**

Policy, agreed with the coordinator side on 2026-09-20: `sendTransaction` stays off the
RPC allowlist, so the proxy keeps a property one test can prove — *this key cannot put
anything on chain* (verified from here: `sendTransaction` → 403 `-32601`). The cost is
that a wallet without the `solana:signAndSendTransaction` feature signs and then
broadcasts through **our** connection, and receives that 403 **after** the user signed.

A signature followed by silent non-delivery is worse than refusing the wallet, so the
condition on the policy is: **refuse at connect time, before an amount is entered.**

Measure, and write the answer here:

1. Can the feature be read from `useWallet()` before any signing — e.g. through
   `wallet.adapter` and the Wallet Standard features object? Record the exact expression.
2. **Does the reading match behaviour?** A detector that reads a property answers
   "capable" whenever the property exists; if the call then fails, you have a green light
   that cannot show red. The test that separates them is a real broadcast from a wallet
   without the feature, with the outcome measured — not the presence of a key in an object.

If (1) has no answer, **(b) cannot meet its own condition** and this task switches to the
S1 path instead: broadcast through the public Solana RPC (`api.mainnet-beta.solana.com`,
no key needed, the signed transaction is public anyway) while reads and confirmation stay
on our proxy. That path needs resubmission and a visible pending state, which is why it
is not the S0 default — not because it is worse.

- [ ] **Step 2: Write the failing tests**

`core/presale/__tests__/referrer.test.ts`:

```ts
import {PublicKey} from '@solana/web3.js';
import {derivePresalePdas} from '../allocation';
import {resolveReferrer} from '../referrer';

const USER = new PublicKey('Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B');
const R2 = new PublicKey('9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4');

/** An allocation account with `referrer` set and a purchase count. Layout per
 *  presaleBuyModule.ts:161-170 — read it and mirror it exactly. */
function allocationWith(referrer: PublicKey | null, purchaseCount: number): Uint8Array {
  /* build the fixture from the documented offsets */
  throw new Error('build from the real layout before running');
}

it('honours an existing on-chain referrer — the program validates against it', async () => {
  const reader = {getAccountInfo: async () => ({data: allocationWith(R2, 1)})};
  const r = await resolveReferrer(reader, USER, null);
  expect(r.referrerAllocation.toBase58()).toBe(derivePresalePdas(R2).userAllocation.toBase58());
  expect(r.registerReferrer).toBeNull();
});

it('ignores a captured referrer once the buyer already has an on-chain one', async () => {
  const reader = {getAccountInfo: async () => ({data: allocationWith(R2, 1)})};
  const r = await resolveReferrer(reader, USER, USER.toBase58());
  expect(r.referrerAllocation.toBase58()).toBe(derivePresalePdas(R2).userAllocation.toBase58());
});

it('falls back to the default PDA when there is no referrer at all (positive control)', async () => {
  const reader = {getAccountInfo: async () => null};
  const r = await resolveReferrer(reader, USER, null);
  expect(r.referrerAllocation.toBase58()).toBe(derivePresalePdas(PublicKey.default).userAllocation.toBase58());
});
```

The first two are the tests whose absence would have shipped the defect: they fail loudly
if the web ever goes back to deriving the referrer from the buyer.

`web/src/presale/__tests__/useBuy.test.tsx` — the connection stub carries **every** method
the hook calls, including `getBlockHeight` for blockhash expiry, and the debounce is
per-hook so five tests in one file do not collide:

```tsx
import {PublicKey} from '@solana/web3.js';
import {renderHook, act} from '@testing-library/react';

const h = vi.hoisted(() => ({
  geo: vi.fn(), simulate: vi.fn(), send: vi.fn(), blockhash: vi.fn(),
  height: vi.fn(), statuses: vi.fn(), fees: vi.fn(), record: vi.fn(), resolve: vi.fn(),
}));

vi.mock('../../geo/useGeo', () => ({checkGeo: h.geo}));
vi.mock('../../lib/api', () => ({post: vi.fn(), recordPurchase: h.record}));
vi.mock('../../../../core/presale/referrer', () => ({resolveReferrer: h.resolve}));
vi.mock('../../lib/solana', () => ({
  connection: () => ({
    simulateTransaction: h.simulate,
    getLatestBlockhash: h.blockhash,
    getBlockHeight: h.height,
    getSignatureStatuses: h.statuses,
    getRecentPrioritizationFees: h.fees,
  }),
  accountReader: {getAccountInfo: vi.fn()},
}));
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: new PublicKey('Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B'),
    sendTransaction: h.send,
    wallet: {adapter: {name: 'Phantom'}},
  }),
}));

import {useBuy} from '../useBuy';

beforeEach(() => {
  Object.values(h).forEach(m => m.mockReset());
  h.blockhash.mockResolvedValue({blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 100});
  h.height.mockResolvedValue(10);
  h.statuses.mockResolvedValue({value: [{confirmationStatus: 'confirmed', err: null}]});
  h.fees.mockResolvedValue([{prioritizationFee: 1000}]);
  h.resolve.mockResolvedValue({referrerAllocation: PublicKey.default, registerReferrer: null, effectiveReferrerAddress: null});
});

it('refuses a sanctioned region before asking for a signature', async () => {
  h.geo.mockResolvedValue({action: 'block', countryCode: 'IR', reason: 'sanctioned', transparentAllowed: true});
  const {result} = renderHook(() => useBuy());
  await act(async () => {
    await expect(result.current.submit(1_000_000_000n)).rejects.toThrow(/sanctioned|restricted/i);
  });
  expect(h.send).not.toHaveBeenCalled();
});

it('refuses when the geo service itself fails — spec 6.8, not the app warn', async () => {
  h.geo.mockRejectedValue(new Error('geo unreachable'));
  const {result} = renderHook(() => useBuy());
  await act(async () => {
    await expect(result.current.submit(1_000_000_000n)).rejects.toThrow();
  });
  expect(h.send).not.toHaveBeenCalled();
});

it('proceeds on a warn — warn is not a block (positive control)', async () => {
  h.geo.mockResolvedValue({action: 'warn', countryCode: 'SI', reason: 'vpn_detected', transparentAllowed: true});
  h.simulate.mockResolvedValue({value: {err: null}});
  h.send.mockResolvedValue('sig');
  const {result} = renderHook(() => useBuy());
  await act(async () => {
    await expect(result.current.submit(1_000_000_000n)).resolves.toBe('sig');
  });
});

it('refuses when the simulation errors, before asking for a signature', async () => {
  h.geo.mockResolvedValue({action: 'allow', countryCode: 'SI', transparentAllowed: true});
  h.simulate.mockResolvedValue({value: {err: {InstructionError: [0, 'Custom']}}});
  const {result} = renderHook(() => useBuy());
  await act(async () => {
    await expect(result.current.submit(1_000_000_000n)).rejects.toThrow(/simulation/i);
  });
  expect(h.send).not.toHaveBeenCalled();
});

it('uses the resolved referrer allocation, never one derived from the buyer', async () => {
  const R2 = new PublicKey('9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4');
  h.resolve.mockResolvedValue({referrerAllocation: R2, registerReferrer: null, effectiveReferrerAddress: R2.toBase58()});
  h.geo.mockResolvedValue({action: 'allow', countryCode: 'SI', transparentAllowed: true});
  h.simulate.mockResolvedValue({value: {err: null}});
  h.send.mockResolvedValue('sig');
  const {result} = renderHook(() => useBuy());
  await act(async () => {
    await result.current.submit(1_000_000_000n);
  });
  const tx = h.send.mock.calls[0]![0];
  expect(tx.message.staticAccountKeys.some((k: PublicKey) => k.equals(R2))).toBe(true);
});

it('rejects a second submit inside the debounce window, per hook instance', async () => {
  h.geo.mockResolvedValue({action: 'allow', countryCode: 'SI', transparentAllowed: true});
  h.simulate.mockResolvedValue({value: {err: null}});
  h.send.mockResolvedValue('sig');
  const {result} = renderHook(() => useBuy());
  await act(async () => {
    await result.current.submit(1_000_000_000n);
    await expect(result.current.submit(1_000_000_000n)).rejects.toThrow(/too soon|in flight/i);
  });
  expect(h.send).toHaveBeenCalledTimes(1);
});

it('records the purchase best-effort, in the coordinator field names', async () => {
  h.geo.mockResolvedValue({action: 'allow', countryCode: 'SI', transparentAllowed: true});
  h.simulate.mockResolvedValue({value: {err: null}});
  h.send.mockResolvedValue('sig');
  const {result} = renderHook(() => useBuy());
  await act(async () => {
    await result.current.submit(1_000_000_000n);
  });
  expect(h.record).toHaveBeenCalledWith(
    expect.objectContaining({txHash: 'sig', paymentToken: 'SOL', buyerAddress: expect.any(String)}),
  );
});

it('still resolves when the record call fails — the chain is the source of truth', async () => {
  h.geo.mockResolvedValue({action: 'allow', countryCode: 'SI', transparentAllowed: true});
  h.simulate.mockResolvedValue({value: {err: null}});
  h.send.mockResolvedValue('sig');
  h.record.mockRejectedValue(new Error('coordinator down'));
  const {result} = renderHook(() => useBuy());
  await act(async () => {
    await expect(result.current.submit(1_000_000_000n)).resolves.toBe('sig');
  });
});
```

- [ ] **Step 3: Run them and watch them fail, then move the code**

Move, in this order, each with the app's suite as the proof:

1. `encodeU64LE`, `buildSolPurchaseInstruction`, `buildRegisterReferrerInstruction`, `buildBuyInstructions` → `core/presale/buyInstructions.ts`. Account order is authoritative; do not reorder. Import `Buffer` explicitly (Task 4).
2. `fetchAllocationRef`, `resolveReferrer`, `captureIsValid` → `core/presale/referrer.ts`, with `AccountReader` as the first parameter. The `self.` indirection in the app exists for test spying; keep the app's wrapper doing that and let core take a plain call.
3. `estimatePriorityFee` with `FLOOR`, `CEILING`, `PERCENTILE`, `MAX_PRIORITY_FEE_LAMPORTS` → `core/solana/priorityFee.ts`, parameter narrowed to `FeeReader`.
4. `PresalePurchaseRecord` and `recordPresalePurchase` → `core/presale/record.ts`, taking a `JsonPoster` port. **Keep the swallow**; add the port to `core/ports.ts`:

```ts
export interface JsonPoster {
  post(path: string, body: unknown): Promise<void>;
}
```

`web/src/presale/useBuy.ts` then runs, in order: `checkGeo()` → refuse on `isPresaleBlocked`
and on a thrown lookup; `resolveReferrer(accountReader, publicKey, refFromQueryString)`;
`estimatePriorityFee(connection(), 'normal')`; `getLatestBlockhash()`; compile a
`VersionedTransaction` from `buildBuyInstructions(...)`; `simulateTransaction` → refuse on
`err`; `sendTransaction(tx, connection())`; poll `getSignatureStatuses` until confirmed or
`getBlockHeight()` passes `lastValidBlockHeight`; then `recordPurchase({txHash, ...})`,
whose failure is logged and ignored. Debounce with a `useRef` timestamp **per hook
instance**, not a module-level one — Vitest isolates modules per file, not per test, so a
module-level stamp makes the tests collide with each other.

`BuyForm` disables the button while busy, and when `canBuy` is false renders
`blockedReason` instead of the amount field — that is where the connect-time refusal from
Step 1 surfaces.

**Spec §6.7 lands here too, and it is not optional.** Before the signature request the
form renders, in words: the amount in SOL, the NOC it buys at the current stage price,
the priority fee, and the program the transaction calls. And the transaction is checked
against an allowlist of program ids before it is handed to the wallet:

```ts
const ALLOWED_PROGRAM_IDS = [PROGRAM, ComputeBudgetProgram.programId, SystemProgram.programId];
```

An instruction addressed to anything else is a bug in code we wrote, and the page refuses
to ask for a signature rather than showing a summary it cannot vouch for. Add a test that
plants a foreign program id into the instruction list and asserts `sendTransaction` was
never called.

- [ ] **Step 4: Verify**

Run: `cd web && npm test -- buyInstructions referrer useBuy` → PASS.
Run: `cd .. && npx jest src/modules/presale src/modules/solana && npx tsc --noEmit` → PASS.
The app's `presaleBuyModule.test.ts` covers the referrer cases (an on-chain R2 must produce
`PDA(R2)`), which is exactly what proves move 2 changed nothing.

**Do not buy on mainnet from this build until Task 11's gates are green**, and when you
do, use the minimum and check the signature on an explorer before believing the UI.

- [ ] **Step 5: Commit**

```bash
git add core/presale core/solana web/src/presale src/modules/presale src/modules/solana/priorityFee.ts
git commit -m "feat(web): buy with SOL, with the money path moved rather than re-invented

Three things an earlier draft of this task invented, each of which would have cost
money: the referrer allocation derived from the buyer (the program validates it
against the buyer's ON-CHAIN referrer, so every referred buyer's transaction would
fail simulation), a three-field purchase record that throws (the real one has eight
fields and swallows, because the chain is the source of truth), and a fresh read of
getRecentPrioritizationFees (the app clamps that against an untrusted RPC, and the
copy dropped the clamp).

All three are now moved from the app and guarded by its own tests. The refusals —
blocked region, unreachable geo service, failed simulation, repeat click — each
assert that sendTransaction was never reached."
```

---

### Task 10: Referral panel and the TGE countdown, against the real shapes

**Files:**
- Create: `core/referral/link.ts`, `web/src/referral/ReferralPanel.tsx`, `web/src/tge/Countdown.tsx`
- Test: `web/src/referral/__tests__/ReferralPanel.test.tsx`, `web/src/tge/__tests__/Countdown.test.tsx`

**Interfaces:**
- Consumes: `fetchTgeTimestamp` (Task 4), `/referral-stats/:address`.
- Produces: `buildReferralLink(address: string): string` → `https://noc-tura.io?ref=<address>`; `<ReferralPanel address stats />` where `stats` is the **real** `ReferralStats` (7 fields); `<Countdown tgeUnix: number | null />`.

- [ ] **Step 1: Write the failing tests**

```tsx
// Countdown.test.tsx
import {render, screen} from '@testing-library/react';
import {Countdown} from '../Countdown';

afterEach(() => vi.useRealTimers());

it('counts in UTC from the on-chain timestamp', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-20T00:00:00Z'));
  render(<Countdown tgeUnix={Math.floor(Date.UTC(2026, 8, 22) / 1000)} />);
  expect(screen.getByText(/2 days/i)).toBeTruthy();
});

it('says the date is unset rather than counting from 1970', () => {
  render(<Countdown tgeUnix={null} />);
  expect(screen.getByText(/not set/i)).toBeTruthy();
});

it('says TGE has passed instead of counting through zero', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2030-01-02T00:00:00Z'));
  render(<Countdown tgeUnix={1_893_456_000} />);
  expect(screen.getByText(/has passed/i)).toBeTruthy();
});
```

```tsx
// ReferralPanel.test.tsx
import {render, screen} from '@testing-library/react';
import {ReferralPanel} from '../ReferralPanel';

const STATS = {
  totalReferrals: 3,
  totalBaseBonusNoc: 10,
  totalExtraBonusNoc: 2.5,
  totalBonusNoc: 12.5,
  totalReferredNoc: 500,
  totalReferredUsd: 75,
  tierBonusCount: 1,
};

it('renders the address-based link the website uses', () => {
  render(<ReferralPanel address="Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B" stats={STATS} />);
  expect(screen.getByText('https://noc-tura.io?ref=Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B')).toBeTruthy();
});

it('labels each figure, so no number is ambiguous', () => {
  render(<ReferralPanel address="Da83" stats={STATS} />);
  expect(screen.getByTestId('referral-count').textContent).toContain('3');
  expect(screen.getByTestId('referral-bonus').textContent).toContain('12.5');
});
```

Query by `testId` for the figures: `getByText(/3/)` also matches the address, and React Testing Library throws on multiple matches.

- [ ] **Step 2: Run them and watch them fail**

Run: `cd web && npm test -- Countdown ReferralPanel` → FAIL, modules missing.

- [ ] **Step 3: Implement**

Move `buildReferralLink` from `src/modules/referral/referralModule.ts:14-16` into `core/referral/link.ts` and re-export it from the app module. `ReferralPanel` renders the link plus `totalReferrals` and `totalBonusNoc` with `data-testid` attributes. `Countdown` handles null, past and future; it computes from `Date.now()` in UTC and formats days and hours.

- [ ] **Step 4: Verify**

Run: `cd web && npm test` → whole suite PASS.
Run: `cd .. && npx jest src/modules/referral` → PASS.

- [ ] **Step 5: Commit**

```bash
git add core/referral web/src/referral web/src/tge src/modules/referral/referralModule.ts
git commit -m "feat(web): referral panel and TGE countdown, against the real field names

ReferralStats has seven fields and none of them is called referredCount — an invented
shape renders 'undefined referred' and no test notices, because the test mocks the
invention.

The countdown refuses the two failure modes that look like data: an unset timestamp
says so instead of counting from 1970, and a past one says TGE has passed."
```

---

### Task 11: Turn the security requirements into gates that have been made to fail

**Files:**
- Create: `.github/workflows/web.yml`, `web/src/__tests__/no-external-hosts.test.ts`
- Modify: `web/package.json`

**Interfaces:**
- Consumes: `npm --prefix web run verify`.
- Produces: a CI job that refuses a planted secret, a third-party host, a type error or a failing test.

- [ ] **Step 1: Write the failing test**

```ts
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';

// Hosts we serve ourselves, plus the two the wallet adapter legitimately needs.
// Every entry needs a reason; an allowlist without one is how this gate rots.
const ALLOWED = [/(^|\.)noc-tura\.io$/, /^localhost$/];

// Excluded from the default `npm test` set and run only by `verify`, after
// `rm -rf dist && build`. In the default set it would fail every run that had not
// built; against a stale dist/ it would report on yesterday's bundle — a gate
// describing an artifact nobody is shipping.
it('the built bundle references no third-party host', () => {
  expect(existsSync('dist')).toBe(true);
  const offenders: string[] = [];
  const files = [
    ...readdirSync('dist/assets').map(f => join('dist/assets', f)),
    'dist/index.html',
  ];
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      const host = m[1]!;
      if (!ALLOWED.some(re => re.test(host))) offenders.push(`${f}: ${host}`);
    }
  }
  expect(offenders).toEqual([]);
});
```

- [ ] **Step 2: Run it and read the list it prints**

Run: `cd web && npm run build && npm test -- no-external-hosts`
Expected: FAIL on the first run. For **each** host in the list decide and write down: remove the dependency path that pulls it, or add it to `ALLOWED` with a comment naming why it is acceptable. Do not widen the pattern to make the list empty — that converts the gate into decoration.

- [ ] **Step 3: Add the workflow**

```yaml
name: web
on:
  pull_request:
    paths: ['web/**', 'core/**', '.github/workflows/web.yml']
  push:
    branches: [main]
    paths: ['web/**', 'core/**']

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.11.0'
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
        working-directory: web
      - run: npm audit --audit-level=high
        working-directory: web
      - run: npm run verify
        working-directory: web
```

**`core/` needs a `paths` mapping, or the root install.** `core/*.ts` import `@solana/web3.js`, and tsc resolves that by walking up from `core/` to the **repo root** `node_modules`, which this workflow never installs — so `npm run build` (`tsc --noEmit && vite build`) passes locally and fails in CI. Make both agree in `web/tsconfig.json`:

```json
"paths": {"@solana/web3.js": ["./node_modules/@solana/web3.js"], "buffer": ["./node_modules/buffer"]}
```

Locally this prevents the other half of the same problem: two copies of web3.js give two `Connection` classes, and `Connection` has private members, so tsc rejects passing one where the other is expected. The narrow ports this plan uses — `AccountReader`, the fee reader — never name `Connection`, which is why they were chosen.

`npm audit --audit-level=high` here covers `web/`'s own tree including the wallet-adapter dev dependencies, while the repo root's policy is `--omit=dev --audit-level=critical`. Decide which applies **before** the first red run, and write the reason into the workflow instead of lowering the threshold later when it is inconvenient.

- [ ] **Step 4: Make every gate refuse something**

```bash
cd web
printf 'const k = Keypair.generate();\n' > src/planted.ts && npm run scan; echo "expect 1, got $?"; rm src/planted.ts
# The planted host must actually be REACHED by the bundler, or nothing is bundled and
# the gate 'passes' while proving nothing. Import it from the entry, and capture the code.
printf 'export const u = "https://cdn.example.com/x.js";\n' > src/planted2.ts
printf "\nimport './planted2';\n" >> src/main.tsx
npm run build >/dev/null && npm run test:bundle; echo "expect NON-ZERO, got $?"
git checkout src/main.tsx && rm src/planted2.ts
npm run verify; echo "expect 0, got $?"
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/web.yml web/src/__tests__/no-external-hosts.test.ts web/package.json
git commit -m "ci(web): the spec's checkable requirements become gates

Each gate was made to refuse something before it was trusted: a planted
Keypair.generate fails the scan, a planted CDN URL fails the host check, and a clean
tree passes both. A gate that has only ever said yes has not been tested."
```

---

## What this plan deliberately leaves out

- **Shielded.** Both preconditions are open (spec §9): the A0 key model, and a measurement of depth-20 proving in a phone browser. No screen, no flag.
- **Transparent send and receive.** The connected wallet does both; duplicating them doubles the signing surface.
- **The claim transaction.** Deferred to TGE; the countdown is S0's surface.
- **Stablecoin purchases.** SOL only in S0; the USDC/USDT path has its own token-account handling and doubles the buy surface.
- **Price and chart.** `/wallet/prices` and `/wallet/chart` are live and cheap to add, but nothing in S0 needs a USD figure that the stage price does not already give.
- **Production hosting, CSP headers, the separate origin and the reproducible build.** They belong to the deploy task; spec §6.3–6.5 is its requirements list.
- **Ledger.** It has no Wallet Standard interface, so with `wallets={[]}` it does not
  appear at all; and under the S0 broadcast policy a wallet that cannot `signAndSend`
  is refused at connect time anyway. Ledger returns in S1 together with the public-RPC
  broadcast path — that pairing is the reason the path is written down rather than
  discarded.
- **A user-cancelled signature test** (spec §10). The refusals that are tested are the
  ones we control: region, geo outage, simulation, repeat click. A cancellation is the
  adapter's own rejection and belongs with the end-to-end mock-adapter test, which is
  deploy-task work.
- **Desktop visual design.** Structure and behaviour only. The layouts are the user's to design, and this plan is written so that pass changes CSS, not components.

## One deliberate deviation from the plan format

Four implementation steps — the query hooks in Tasks 6, 7, 9 and the two components in
Task 10 — name the exact calls, their order and their return shapes in prose instead of
giving finished code. That is on purpose. The previous version of this plan was blocked
because it stated confident code against libraries nobody here has run, and four of its
six fatal defects were in exactly this kind of glue. Naming the calls and leaving the
writing to someone with the library installed is the safer failure mode: an implementer
who cannot make it compile asks, whereas an implementer handed wrong code ships it.

Everything that touches the chain, the encoding or a security boundary is given as code,
because those are the parts this repository can and did verify.

## Note for whoever executes this

Where a step says **PROBE**, run it and write the answer into the plan before continuing. Three of the six defects that blocked the previous version were assertions about libraries or endpoints that nobody had run. If a probe contradicts this document, the document is wrong — fix it here, then proceed.
