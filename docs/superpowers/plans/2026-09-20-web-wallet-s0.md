# Noctura Web S0 Implementation Plan

> ## ⛔ DO NOT EXECUTE — this plan is blocked pending a rewrite (2026-09-20)
>
> An adversarial review found its load-bearing assumptions false against the pinned
> libraries and the real backend. Six were re-verified directly, by running the code
> rather than reading it:
>
> | claim in this plan | reality |
> |---|---|
> | `RPC_URL = '/rpc'` passed to `new Connection()` | **throws** `Endpoint URL must start with \`http:\` or \`https:\`` (web3.js 1.95.8). The app would not render. |
> | `CONFIG_TGE_TIMESTAMP_OFFSET = 0` | the real offset is **201** (`presaleBuyModule.ts:104`) |
> | `PresalePdas` has three fields | it has **four**; dropping `referrerAllocation` breaks the RN tests this plan claims will guard the move |
> | `readBigUInt64LE` in moved core code | `buffer@5.7.1` **does not have it** — the RN app uses a byte loop for exactly this reason. Would crash the shipping Android presale screen. |
> | `/geo/check` returns `{success, data:{allowed,…}}` | it returns `{countryCode, isVpn}`; the block decision is client-side, OFAC-only. Every purchase would refuse, while the mocked test stayed green. |
> | `web/` and `core/` are invisible to the root build | root `tsconfig.json` includes `**/*.ts` and excludes only node_modules/Pods/e2e — root CI goes red from Task 1 |
>
> The architecture survived the review and the spec stands: no key in the page, the
> wallet signs, RPC behind a proxy, `core/` moved rather than copied. What failed is
> this document — its code was written from the shape of the APIs instead of from the
> repository and the versions actually pinned here.
>
> Rewrite Tasks 2–7 and 10 against the real modules before starting any of them, and
> add root `tsconfig`/Jest exclusions plus a resolution strategy for `core/` before
> Task 1. Full findings: the review is in this session's transcript.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A locally runnable web app at `web/` where a presale buyer connects an existing Solana wallet and sees their on-chain allocation, the live presale stage, their referral standing and the TGE countdown — and can buy with SOL.

**Architecture:** The browser holds no authority: every signature comes from the connected wallet, and no private key, seed or note secret ever exists in the page. Platform-independent logic lives in `core/` at the repo root and is imported by **relative path** from both the React Native app and the web app — no aliases, no workspace wiring, so Metro, Jest, tsc and Vite all resolve it with zero config. During local development a Vite dev-server proxy fronts both the coordinator API and Solana RPC, so the Helius key stays server-side and no CORS rule has to be relaxed.

**Tech Stack:** Vite 5 + React 18 + TypeScript strict · `@solana/wallet-adapter-react` · `@solana/web3.js` (the version the app already pins) · TanStack Query v5 · Vitest + React Testing Library + jsdom · Node >= 22.11.0

**Spec:** `docs/superpowers/specs/2026-09-20-web-wallet-s0-design.md`

## Global Constraints

Every task's requirements implicitly include these. They come from the spec; the values are verbatim.

- **No key material in the page.** No code path produces or accepts a private key, seed or mnemonic. CI greps `web/` and `core/` for `mnemonic|generateMnemonic|secretKey|privateKey|Keypair.fromSecretKey` and fails on a match.
- **No secret in the bundle.** The built output must contain no `api-key=`. The Helius key exists only in the dev-server proxy and in the coordinator.
- **No third-party code or telemetry.** No analytics, tag managers, hosted fonts or CDN-loaded libraries. Everything is built into the bundle and served from our origin.
- **TypeScript strict; no `any`, no `@ts-ignore`** (root `CLAUDE.md` cardinal rule 5).
- **Token amounts are integers.** Lamports and base units as `bigint`, never floats (cardinal rule 2).
- **UTC everywhere**; convert to local time only in the render layer (cardinal rule 3).
- **Signing buttons debounce >= 500 ms and disable on tap** (cardinal rule 6).
- **Fail closed.** A failed geo check, a failed simulation, an unreachable backend or an unparseable response blocks the action and says so. No silent fallback.
- **RPC method allowlist** (the proxy enforces it; the client must not need more): `getAccountInfo`, `getMultipleAccounts`, `getBalance`, `getTokenAccountsByOwner`, `getLatestBlockhash`, `getBlockHeight`, `getRecentPrioritizationFees`, `simulateTransaction`, `getSignatureStatuses`, `getTransaction`, `getSignaturesForAddress`.
- **`sendTransaction` is never called through the proxy.** The connected wallet broadcasts.
- **No WebSocket subscriptions.** `onAccountChange` is out of S0; balances are polled.
- **API paths are bare.** `API_BASE` already ends in `/api/v1`; never write `/v1/` again inside a path.
- **Mainnet constants** (root `CLAUDE.md`): `NOC_MINT = B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW`, `NOC_DECIMALS = 9`, `PROGRAM_ID = 6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt`.

---

### Task 1: Scaffold `web/` and the secret-scan gate

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/setupTests.ts`, `web/scripts/check-no-secrets.mjs`
- Test: `web/src/__tests__/App.test.tsx`, `web/scripts/__tests__/check-no-secrets.test.mjs`
- Modify: `.gitignore` (add `web/node_modules`, `web/dist`, `web/.env.local`)

**Interfaces:**
- Consumes: nothing.
- Produces: `npm --prefix web run dev|build|test|scan` — the scripts every later task uses.

- [ ] **Step 1: Write the failing test**

`web/src/__tests__/App.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import {App} from '../App';

describe('App', () => {
  it('renders the product name', () => {
    render(<App />);
    expect(screen.getByRole('heading', {name: /noctura/i})).toBeTruthy();
  });
});
```

`web/scripts/__tests__/check-no-secrets.test.mjs`:

```js
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

function run(dir) {
  try {
    execFileSync(process.execPath, ['scripts/check-no-secrets.mjs', dir], {cwd: 'web'});
    return 0;
  } catch (e) {
    return e.status;
  }
}

it('passes on a clean tree', () => {
  const d = mkdtempSync(join(tmpdir(), 'clean-'));
  writeFileSync(join(d, 'a.ts'), 'export const x = 1;\n');
  expect(run(d)).toBe(0);
});

it('fails when a forbidden symbol is planted', () => {
  const d = mkdtempSync(join(tmpdir(), 'dirty-'));
  writeFileSync(join(d, 'b.ts'), 'const k = Keypair.fromSecretKey(bytes);\n');
  expect(run(d)).toBe(1);
});

it('fails when a built bundle carries an api key', () => {
  const d = mkdtempSync(join(tmpdir(), 'bundle-'));
  mkdirSync(join(d, 'assets'));
  writeFileSync(join(d, 'assets', 'index.js'), 'fetch("https://x/?api-key=abc")');
  expect(run(d)).toBe(1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npm test`
Expected: FAIL — `Cannot find module '../App'` and `Cannot find module 'scripts/check-no-secrets.mjs'`.

- [ ] **Step 3: Write the minimal implementation**

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
    "test": "vitest run",
    "scan": "node scripts/check-no-secrets.mjs src ../core && node scripts/check-no-secrets.mjs dist",
    "verify": "npm run test && npm run build && npm run scan"
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
    "jsdom": "^24.1.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

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
  "include": ["src", "../core"]
}
```

`web/vite.config.ts`:

```ts
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: {fs: {allow: ['..', resolve(__dirname, '../core')]}},
  test: {environment: 'jsdom', globals: true, setupFiles: ['./src/setupTests.ts']},
});
```

`web/src/setupTests.ts`:

```ts
import '@testing-library/react';
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

createRoot(document.getElementById('root')!).render(
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

`web/scripts/check-no-secrets.mjs`:

```js
#!/usr/bin/env node
// Two things must never reach a browser: anything that looks like key material in
// our sources, and anything that looks like a credential in the built bundle.
// Exit 1 on the first hit, naming the file — a gate that only prints is a comment.
import {readdirSync, readFileSync, statSync, existsSync} from 'node:fs';
import {join} from 'node:path';

const SOURCE_FORBIDDEN =
  /\b(mnemonic|generateMnemonic|secretKey|privateKey|Keypair\.fromSecretKey)\b/;
const BUNDLE_FORBIDDEN = /api-key=|BEGIN [A-Z ]*PRIVATE KEY/;

const roots = process.argv.slice(2);
let bad = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs|css|html|map)$/.test(entry)) continue;
    const text = readFileSync(p, 'utf8');
    const rule = /(^|\/)dist(\/|$)/.test(p) ? BUNDLE_FORBIDDEN : SOURCE_FORBIDDEN;
    const m = rule.exec(text);
    if (m) {
      console.error(`FORBIDDEN ${m[0]} in ${p}`);
      bad += 1;
    }
  }
}

for (const root of roots) {
  if (!existsSync(root)) continue;
  walk(root);
}
process.exit(bad === 0 ? 0 : 1);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npm install && npm test`
Expected: PASS, 4 tests.

Run: `cd web && npm run dev` and open the printed URL.
Expected: the word "Noctura" renders.

- [ ] **Step 5: Commit**

```bash
git add web .gitignore
git commit -m "feat(web): scaffold the web app and the no-secrets gate

The gate ships with the scaffold rather than after it: the cheapest moment to
make a key impossible to commit is before there is anything to commit. It is
tested in both directions — a clean tree passes, a planted Keypair.fromSecretKey
and a planted api-key= in dist each fail."
```

---

### Task 2: Dev proxies, so no key and no CORS rule are needed locally

**Files:**
- Modify: `web/vite.config.ts`
- Create: `web/.env.local.example`, `web/src/config.ts`
- Test: `web/src/__tests__/config.test.ts`

**Interfaces:**
- Consumes: Task 1's scaffold.
- Produces: `API_BASE: string` and `RPC_URL: string` from `web/src/config.ts`; both are same-origin paths in every environment.

- [ ] **Step 1: Write the failing test**

`web/src/__tests__/config.test.ts`:

```ts
import {API_BASE, RPC_URL} from '../config';

describe('config', () => {
  it('uses same-origin paths so no credential can live in the bundle', () => {
    expect(API_BASE).toBe('/api/v1');
    expect(RPC_URL).toBe('/rpc');
  });

  it('never embeds a key', () => {
    expect(`${API_BASE}${RPC_URL}`).not.toMatch(/api-key=/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npm test -- config`
Expected: FAIL — `Cannot find module '../config'`.

- [ ] **Step 3: Write the minimal implementation**

`web/src/config.ts`:

```ts
/**
 * Both are same-origin paths, in development and in production.
 *
 * In development the Vite proxy (vite.config.ts) forwards them, injecting the
 * Helius key server-side; in production the coordinator serves them. A key
 * reachable from the bundle is a published key, so the bundle never holds one —
 * which is also why there is no VITE_ variable here: anything with that prefix is
 * inlined into the output.
 */
export const API_BASE = '/api/v1';
export const RPC_URL = '/rpc';
```

`web/.env.local.example` (copy to `web/.env.local`, which is gitignored):

```
# Used by the Vite dev server ONLY. Never inlined into the bundle: the name has no
# VITE_ prefix, so Vite refuses to expose it to client code.
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=REPLACE_ME
COORDINATOR_ORIGIN=https://api.noc-tura.io
```

`web/vite.config.ts` — replace the `server` block:

```ts
import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, __dirname, '');
  const coordinator = env.COORDINATOR_ORIGIN ?? 'https://api.noc-tura.io';
  const helius = env.HELIUS_RPC_URL ?? '';

  return {
    plugins: [react()],
    server: {
      fs: {allow: ['..', resolve(__dirname, '../core')]},
      proxy: {
        '/api': {target: coordinator, changeOrigin: true, secure: true},
        '/rpc': {
          target: helius || coordinator,
          changeOrigin: true,
          secure: true,
          rewrite: () => (helius ? new URL(helius).pathname + new URL(helius).search : '/api/v1/rpc'),
        },
      },
    },
    test: {environment: 'jsdom', globals: true, setupFiles: ['./src/setupTests.ts']},
  };
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web && npm test -- config`
Expected: PASS.

Manual check, with `web/.env.local` filled in:

```bash
cd web && npm run dev &
curl -s -X POST http://localhost:5173/rpc -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getLatestBlockhash"}' | head -c 120
```
Expected: a JSON-RPC result. If it returns `Unauthorized`, the key in `.env.local` is wrong — fix it there, never in the bundle.

- [ ] **Step 5: Commit**

```bash
git add web/vite.config.ts web/src/config.ts web/.env.local.example web/src/__tests__/config.test.ts
git commit -m "feat(web): dev proxies for API and RPC, so the key stays server-side

/api and /rpc are same-origin paths in every environment. Locally the dev server
forwards them and injects the Helius key; in production the coordinator does. The
env var deliberately has no VITE_ prefix — that prefix is exactly what would inline
it into the public bundle.

This also removes the CORS question from local work entirely: the browser only ever
talks to its own origin."
```

---

### Task 3: The coordinator API client in `core/`

**Files:**
- Create: `core/api/client.ts`, `core/api/types.ts`
- Test: `core/api/__tests__/client.test.ts`

**Interfaces:**
- Consumes: `API_BASE` is passed in, not imported — `core/` must not depend on web-only config.
- Produces:
  - `class ApiError extends Error { readonly status: number }`
  - `createApiClient(baseUrl: string, fetchImpl?: typeof fetch): ApiClient`
  - `interface ApiClient { fetchStats(): Promise<PresaleStats>; fetchUser(address: string): Promise<UserSummary>; fetchReferralStats(address: string): Promise<ReferralStats>; fetchGeoCheck(): Promise<GeoDecision> }`
  - `interface PresaleStats { totalNocSold: number; totalUsdRaised: number; remainingSupply: number; currentStage: number; isPaused: boolean; uniqueBuyers: number; totalPurchases: number }`
  - `interface GeoDecision { allowed: boolean; countryCode: string | null; reason: string | null }`

- [ ] **Step 1: Write the failing test**

`core/api/__tests__/client.test.ts`:

```ts
import {createApiClient, ApiError} from '../client';

function stubFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: {'content-type': 'application/json'},
    })) as unknown as typeof fetch;
}

describe('createApiClient', () => {
  it('appends bare paths — API_BASE already carries the version', async () => {
    const seen: string[] = [];
    const spy = (async (url: string) => {
      seen.push(url);
      return new Response(JSON.stringify({success: true, data: {currentStage: 0}}), {status: 200});
    }) as unknown as typeof fetch;
    await createApiClient('/api/v1', spy).fetchStats();
    expect(seen[0]).toBe('/api/v1/stats');
    expect(seen[0]).not.toMatch(/\/v1\/v1\//);
  });

  it('unwraps the success envelope', async () => {
    const client = createApiClient('/api/v1', stubFetch(200, {success: true, data: {currentStage: 3}}));
    const stats = await client.fetchStats();
    expect(stats.currentStage).toBe(3);
  });

  it('throws ApiError with the status on a non-200 — no silent fallback', async () => {
    const client = createApiClient('/api/v1', stubFetch(503, {error: 'nope'}));
    await expect(client.fetchStats()).rejects.toBeInstanceOf(ApiError);
    await expect(client.fetchStats()).rejects.toMatchObject({status: 503});
  });

  it('throws when the envelope says failure even with HTTP 200', async () => {
    const client = createApiClient('/api/v1', stubFetch(200, {success: false}));
    await expect(client.fetchStats()).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npm test -- client`
Expected: FAIL — `Cannot find module '../client'`.

- [ ] **Step 3: Write the minimal implementation**

`core/api/types.ts`:

```ts
export interface PresaleStats {
  totalNocSold: number;
  totalUsdRaised: number;
  remainingSupply: number;
  currentStage: number;
  isPaused: boolean;
  uniqueBuyers: number;
  totalPurchases: number;
}

export interface UserSummary {
  address: string;
  totalNoc: number;
  purchaseCount: number;
}

export interface ReferralStats {
  address: string;
  referredCount: number;
  bonusNoc: number;
}

export interface GeoDecision {
  allowed: boolean;
  countryCode: string | null;
  reason: string | null;
}
```

`core/api/client.ts`:

```ts
import type {GeoDecision, PresaleStats, ReferralStats, UserSummary} from './types';

/** Carries the HTTP status, because callers branch on it and a stringified error destroys it. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClient {
  fetchStats(): Promise<PresaleStats>;
  fetchUser(address: string): Promise<UserSummary>;
  fetchReferralStats(address: string): Promise<ReferralStats>;
  fetchGeoCheck(): Promise<GeoDecision>;
}

/**
 * `baseUrl` already ends in the version segment (`/api/v1`). Paths passed here are
 * bare: writing `/v1/stats` produces `/api/v1/v1/stats`, a latent bug this project
 * has shipped before.
 */
export function createApiClient(baseUrl: string, fetchImpl: typeof fetch = fetch): ApiClient {
  async function getJson<T>(path: string): Promise<T> {
    const res = await fetchImpl(`${baseUrl}${path}`);
    if (res.status !== 200) {
      throw new ApiError(res.status, `${path} returned HTTP ${res.status}`);
    }
    const body = (await res.json()) as {success?: boolean; data?: T};
    if (!body.success || body.data === undefined) {
      throw new ApiError(res.status, `${path} returned an unsuccessful envelope`);
    }
    return body.data;
  }

  return {
    fetchStats: () => getJson<PresaleStats>('/stats'),
    fetchUser: address => getJson<UserSummary>(`/user/${address}`),
    fetchReferralStats: address => getJson<ReferralStats>(`/referral-stats/${address}`),
    fetchGeoCheck: () => getJson<GeoDecision>('/geo/check'),
  };
}
```

`web/src/lib/api.ts` — the single configured instance every component uses:

```ts
import {createApiClient} from '../../../core/api/client';
import {API_BASE} from '../config';

export const api = createApiClient(API_BASE);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npm test -- client`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add core/api web/
git commit -m "feat(core): typed coordinator client, fail-closed

Paths are bare because API_BASE already ends in /api/v1 — this repo has shipped a
double /v1/v1 before, and a test now pins it. A non-200, or a 200 whose envelope
says failure, throws ApiError carrying the status; nothing degrades into an empty
list, which is how a broken backend used to look identical to an empty one."
```

---

### Task 4: Connect a wallet, and prove the page asks for nothing on load

**Files:**
- Create: `web/src/wallet/WalletProviders.tsx`, `web/src/wallet/ConnectButton.tsx`
- Modify: `web/src/App.tsx`, `web/package.json` (add adapter deps)
- Test: `web/src/wallet/__tests__/ConnectButton.test.tsx`

**Interfaces:**
- Consumes: `RPC_URL` from `web/src/config.ts`.
- Produces: `<WalletProviders>` (wraps the app) and `<ConnectButton />`; `useWallet()` from `@solana/wallet-adapter-react` is the only source of the connected `publicKey`.

- [ ] **Step 1: Write the failing test**

`web/src/wallet/__tests__/ConnectButton.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import {ConnectButton} from '../ConnectButton';

const signMessage = vi.fn();
const connect = vi.fn();

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: null,
    connected: false,
    connect,
    signMessage,
    signTransaction: vi.fn(),
  }),
}));

describe('ConnectButton', () => {
  beforeEach(() => {
    signMessage.mockClear();
    connect.mockClear();
  });

  it('renders a connect affordance when no wallet is connected', () => {
    render(<ConnectButton />);
    expect(screen.getByRole('button', {name: /connect/i})).toBeTruthy();
  });

  it('asks for no signature and no connection on mount', () => {
    render(<ConnectButton />);
    expect(signMessage).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it('states that the phrase is never requested', () => {
    render(<ConnectButton />);
    expect(screen.getByText(/never ask for your recovery phrase/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npm test -- ConnectButton`
Expected: FAIL — `Cannot find module '../ConnectButton'`.

- [ ] **Step 3: Write the minimal implementation**

Add to `web/package.json` dependencies, then `npm install`:

```json
"@solana/wallet-adapter-base": "^0.9.23",
"@solana/wallet-adapter-react": "^0.15.35",
"@solana/wallet-adapter-react-ui": "^0.9.35",
"@solana/wallet-adapter-wallets": "^0.19.32"
```

`web/src/wallet/WalletProviders.tsx`:

```tsx
import {useMemo, type ReactNode} from 'react';
import {ConnectionProvider, WalletProvider} from '@solana/wallet-adapter-react';
import {WalletModalProvider} from '@solana/wallet-adapter-react-ui';
import {PhantomWalletAdapter, SolflareWalletAdapter} from '@solana/wallet-adapter-wallets';
import {RPC_URL} from '../config';

export function WalletProviders({children}: {children: ReactNode}) {
  // Standard-wallet adapters register themselves; these two are named so the modal
  // still lists them when the extension is absent and the user needs the install link.
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

`web/src/wallet/ConnectButton.tsx`:

```tsx
import {useWallet} from '@solana/wallet-adapter-react';
import {WalletMultiButton} from '@solana/wallet-adapter-react-ui';

export function ConnectButton() {
  const {publicKey} = useWallet();
  return (
    <div>
      <WalletMultiButton />
      {publicKey ? <p>{publicKey.toBase58()}</p> : null}
      <p>Noctura will never ask for your recovery phrase.</p>
    </div>
  );
}
```

`web/src/App.tsx`:

```tsx
import {WalletProviders} from './wallet/WalletProviders';
import {ConnectButton} from './wallet/ConnectButton';

export function App() {
  return (
    <WalletProviders>
      <main>
        <h1>Noctura</h1>
        <ConnectButton />
      </main>
    </WalletProviders>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npm test`
Expected: PASS. `autoConnect={false}` is what makes the "no connection on mount" assertion true — do not turn it on for convenience.

- [ ] **Step 5: Commit**

```bash
git add web/src/wallet web/src/App.tsx web/package.json web/package-lock.json
git commit -m "feat(web): connect an existing wallet, and nothing else on load

autoConnect is off and no signature is requested until the user asks for one: a page
that signs on arrival is the shape every drainer uses, and users are right to be
trained against it. The connect screen states plainly that we never ask for a
recovery phrase — there is no field to type one into, so a clone cannot claim
otherwise."
```

---

### Task 5: Move the on-chain allocation readers into `core/`

**Files:**
- Create: `core/presale/allocation.ts`
- Modify: `src/modules/presale/presaleBuyModule.ts` (delete the moved functions, re-export from core)
- Test: `core/presale/__tests__/allocation.test.ts`

**Interfaces:**
- Consumes: `@solana/web3.js` `Connection` and `PublicKey`, passed in explicitly.
- Produces:
  - `derivePresalePdas(user: PublicKey): {config: PublicKey; userAccount: PublicKey; userAllocation: PublicKey}`
  - `fetchOnChainAllocation(connection: Connection, user: PublicKey): Promise<{totalTokensBase: string; exists: boolean}>`
  - `fetchTgeTimestamp(connection: Connection): Promise<number | null>`
  - `ALLOCATION_TOTAL_OFFSET: number`, `CONFIG_TGE_TIMESTAMP_OFFSET: number`

- [ ] **Step 1: Write the failing test**

`core/presale/__tests__/allocation.test.ts`:

```ts
import {Connection, PublicKey} from '@solana/web3.js';
import {
  ALLOCATION_TOTAL_OFFSET,
  derivePresalePdas,
  fetchOnChainAllocation,
  fetchTgeTimestamp,
} from '../allocation';

const USER = new PublicKey('Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B');

function connectionReturning(data: Buffer | null): Connection {
  return {getAccountInfo: async () => (data ? {data} : null)} as unknown as Connection;
}

describe('presale allocation readers', () => {
  it('derives three distinct PDAs deterministically', () => {
    const a = derivePresalePdas(USER);
    const b = derivePresalePdas(USER);
    expect(a.userAllocation.toBase58()).toBe(b.userAllocation.toBase58());
    expect(new Set([a.config, a.userAccount, a.userAllocation].map(k => k.toBase58())).size).toBe(3);
  });

  it('reads the total as a base-unit string at the pinned offset', async () => {
    const data = Buffer.alloc(ALLOCATION_TOTAL_OFFSET + 8);
    data.writeBigUInt64LE(1_234_000_000_000n, ALLOCATION_TOTAL_OFFSET);
    const res = await fetchOnChainAllocation(connectionReturning(data), USER);
    expect(res).toEqual({totalTokensBase: '1234000000000', exists: true});
  });

  it('reports absence rather than zero when the account does not exist', async () => {
    const res = await fetchOnChainAllocation(connectionReturning(null), USER);
    expect(res.exists).toBe(false);
  });

  it('returns null for an unset TGE timestamp instead of 1970', async () => {
    const data = Buffer.alloc(8);
    expect(await fetchTgeTimestamp(connectionReturning(data))).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npm test -- allocation`
Expected: FAIL — `Cannot find module '../allocation'`.

- [ ] **Step 3: Write the minimal implementation**

Copy the bodies out of `src/modules/presale/presaleBuyModule.ts` (lines 50–128) into `core/presale/allocation.ts`, changing only the connection source — the module-level `getConnection()` becomes an explicit first parameter:

```ts
import {Connection, PublicKey} from '@solana/web3.js';

export const PROGRAM = new PublicKey('6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt');
export const ADMIN = new PublicKey('KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr');

/** Byte offsets are the on-chain layout. Pinned by tests: a silent shift reads a wrong number. */
export const ALLOCATION_TOTAL_OFFSET = 40;
export const CONFIG_TGE_TIMESTAMP_OFFSET = 0;

export interface PresalePdas {
  config: PublicKey;
  userAccount: PublicKey;
  userAllocation: PublicKey;
}

export function derivePresalePdas(user: PublicKey): PresalePdas {
  const [config] = PublicKey.findProgramAddressSync([Buffer.from('config'), ADMIN.toBytes()], PROGRAM);
  const [userAccount] = PublicKey.findProgramAddressSync([Buffer.from('user'), user.toBytes()], PROGRAM);
  const [userAllocation] = PublicKey.findProgramAddressSync(
    [Buffer.from('allocation'), user.toBytes()],
    PROGRAM,
  );
  return {config, userAccount, userAllocation};
}

export async function fetchOnChainAllocation(
  connection: Connection,
  user: PublicKey,
): Promise<{totalTokensBase: string; exists: boolean}> {
  const {userAllocation} = derivePresalePdas(user);
  const info = await connection.getAccountInfo(userAllocation);
  if (!info || info.data.length < ALLOCATION_TOTAL_OFFSET + 8) {
    return {totalTokensBase: '0', exists: false};
  }
  const total = info.data.readBigUInt64LE(ALLOCATION_TOTAL_OFFSET);
  return {totalTokensBase: total.toString(), exists: true};
}

export async function fetchTgeTimestamp(connection: Connection): Promise<number | null> {
  const {config} = derivePresalePdas(PublicKey.default);
  const info = await connection.getAccountInfo(config);
  if (!info || info.data.length < CONFIG_TGE_TIMESTAMP_OFFSET + 8) return null;
  const ts = Number(info.data.readBigInt64LE(CONFIG_TGE_TIMESTAMP_OFFSET));
  return ts > 0 ? ts : null;
}
```

**Verify the two offsets against the current RN module before committing** — read them out of `src/modules/presale/presaleBuyModule.ts` and correct the constants above if they differ. The values in this plan are the shape, not an authority.

Then replace those functions in `src/modules/presale/presaleBuyModule.ts` with a re-export, keeping its own `getConnection()` convenience wrappers:

```ts
import {
  derivePresalePdas,
  fetchOnChainAllocation as coreFetchOnChainAllocation,
  fetchTgeTimestamp as coreFetchTgeTimestamp,
} from '../../../core/presale/allocation';

export {derivePresalePdas};
export const fetchOnChainAllocation = (user: PublicKey) =>
  coreFetchOnChainAllocation(getConnection(), user);
export const fetchTgeTimestamp = () => coreFetchTgeTimestamp(getConnection());
```

- [ ] **Step 4: Run both test suites to verify nothing broke**

Run: `cd web && npm test -- allocation`
Expected: PASS, 4 tests.

Run: `cd .. && npx jest src/modules/presale && npx tsc --noEmit`
Expected: PASS — the app's existing presale tests still pass against the moved implementation. This is the point of moving rather than copying: one implementation, and the app's tests guard it.

- [ ] **Step 5: Commit**

```bash
git add core/presale src/modules/presale/presaleBuyModule.ts
git commit -m "refactor(core): move the allocation readers out of the RN module

Moved, not copied. In this project the client code is the specification for the
on-chain encoding, so a second copy would be a second specification, and the two
would drift silently. The app now re-exports from core and its existing tests
guard the move.

core/ is imported by relative path from both apps — no aliases, so Metro, Jest,
tsc and Vite all resolve it with no configuration at all."
```

---

### Task 6: The presale panel — stage from the API, allocation from the chain

**Files:**
- Create: `web/src/presale/PresalePanel.tsx`, `web/src/presale/useAllocation.ts`, `web/src/lib/queryClient.ts`
- Modify: `web/src/App.tsx`, `web/package.json` (add `@tanstack/react-query`)
- Test: `web/src/presale/__tests__/PresalePanel.test.tsx`

**Interfaces:**
- Consumes: `createApiClient` (Task 3), `fetchOnChainAllocation` (Task 5), `useWallet()` (Task 4).
- Produces: `<PresalePanel />`; `useAllocation(publicKey): {data, isLoading, error}`.

- [ ] **Step 1: Write the failing test**

`web/src/presale/__tests__/PresalePanel.test.tsx`:

```tsx
import {render, screen, waitFor} from '@testing-library/react';
import {PresalePanel} from '../PresalePanel';

const stats = {
  totalNocSold: 1279937.4,
  totalUsdRaised: 192118.5,
  remainingSupply: 101120062.5,
  currentStage: 0,
  isPaused: false,
  uniqueBuyers: 421,
  totalPurchases: 514,
};

describe('PresalePanel', () => {
  it('shows the live stage and buyer count', async () => {
    render(<PresalePanel stats={stats} allocationBase={null} />);
    await waitFor(() => expect(screen.getByText(/421/)).toBeTruthy());
  });

  it('shows the allocation from chain, formatted from base units', () => {
    render(<PresalePanel stats={stats} allocationBase={'1234000000000'} />);
    expect(screen.getByText(/1,234(\.0+)? NOC/)).toBeTruthy();
  });

  it('says so when the wallet has no allocation, rather than showing zero', () => {
    render(<PresalePanel stats={stats} allocationBase={null} />);
    expect(screen.getByText(/no allocation/i)).toBeTruthy();
  });

  it('marks the presale paused when the backend says so', () => {
    render(<PresalePanel stats={{...stats, isPaused: true}} allocationBase={null} />);
    expect(screen.getByText(/paused/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npm test -- PresalePanel`
Expected: FAIL — `Cannot find module '../PresalePanel'`.

- [ ] **Step 3: Write the minimal implementation**

`web/src/presale/PresalePanel.tsx`:

```tsx
import type {PresaleStats} from '../../../core/api/types';

const NOC_DECIMALS = 9;

/** Base units in, human string out. BigInt throughout: the amounts do not fit a float. */
export function formatNoc(base: string): string {
  const v = BigInt(base);
  const unit = 10n ** BigInt(NOC_DECIMALS);
  const whole = v / unit;
  const frac = (v % unit).toString().padStart(NOC_DECIMALS, '0').replace(/0+$/, '');
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac} NOC` : `${grouped} NOC`;
}

export function PresalePanel({
  stats,
  allocationBase,
}: {
  stats: PresaleStats;
  allocationBase: string | null;
}) {
  return (
    <section>
      <h2>Presale</h2>
      {stats.isPaused ? <p>Presale is paused</p> : <p>Stage {stats.currentStage + 1}</p>}
      <p>{stats.uniqueBuyers} buyers</p>
      {allocationBase === null ? (
        <p>No allocation for this wallet</p>
      ) : (
        <p>{formatNoc(allocationBase)}</p>
      )}
    </section>
  );
}
```

`web/src/presale/useAllocation.ts`:

```ts
import {useQuery} from '@tanstack/react-query';
import {Connection, PublicKey} from '@solana/web3.js';
import {fetchOnChainAllocation} from '../../../core/presale/allocation';
import {RPC_URL} from '../config';

/**
 * The allocation is read from the chain, not from the coordinator: the coordinator's
 * recorded sum is approximate, and this number is the one a buyer will argue about.
 */
export function useAllocation(publicKey: PublicKey | null) {
  return useQuery({
    queryKey: ['allocation', publicKey?.toBase58() ?? null],
    enabled: publicKey !== null,
    staleTime: 15_000,
    queryFn: async () => {
      const connection = new Connection(RPC_URL, 'confirmed');
      const res = await fetchOnChainAllocation(connection, publicKey!);
      return res.exists ? res.totalTokensBase : null;
    },
  });
}
```

`web/src/lib/queryClient.ts`:

```ts
import {QueryClient} from '@tanstack/react-query';

// Retries are off for writes and short for reads: a silent retry loop is how a
// backend outage turns into "the page is just slow".
export const queryClient = new QueryClient({
  defaultOptions: {queries: {retry: 1, refetchOnWindowFocus: false}},
});
```

Wire `QueryClientProvider` and `<PresalePanel>` into `web/src/App.tsx`, fetching stats with `useQuery` and passing both props down.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npm test -- PresalePanel`
Expected: PASS, 4 tests.

Manual: `npm run dev`, connect a wallet holding an allocation, confirm the NOC figure matches what the Android app shows for the same address.

- [ ] **Step 5: Commit**

```bash
git add web/src/presale web/src/lib web/src/App.tsx web/package.json web/package-lock.json
git commit -m "feat(web): presale panel — stage from the API, allocation from the chain

The allocation is read on-chain on purpose: the coordinator's recorded sum is
approximate, and this is the number a buyer will argue about. An address with no
allocation says so rather than rendering 0 NOC, which reads as a loss."
```

---

### Task 7: Buy with SOL — geo gate, simulation, wallet signs, we never broadcast

**Files:**
- Create: `web/src/presale/BuyForm.tsx`, `web/src/presale/useBuy.ts`
- Test: `web/src/presale/__tests__/useBuy.test.ts`

**Interfaces:**
- Consumes: `buildSolPurchaseTx` and `buildSolPurchaseInstruction`, today in `src/modules/presale/presaleBuyModule.ts`. Move both into `core/presale/buy.ts`, changing only the connection source: the module-level `getConnection()` becomes an explicit first parameter, so the signature becomes `buildSolPurchaseTx(connection: Connection, user: PublicKey, solLamports: bigint): Promise<VersionedTransaction>`. Leave a re-export behind in the RN module, `export const buildSolPurchaseTx = (user: PublicKey, solLamports: bigint) => coreBuildSolPurchaseTx(getConnection(), user, solLamports);`, and run `npx jest src/modules/presale` to prove the app's existing tests still pass against the moved code.
- Produces: `useBuy(): {submit(solLamports: bigint): Promise<string>; state: 'idle'|'checking'|'simulating'|'signing'|'confirming'|'done'|'error'}` — resolves to the transaction signature.

- [ ] **Step 1: Write the failing test**

`web/src/presale/__tests__/useBuy.test.ts`:

```ts
import {renderHook, act} from '@testing-library/react';
import {useBuy} from '../useBuy';

const geo = vi.fn();
const simulate = vi.fn();
const sendTransaction = vi.fn();

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({publicKey: {toBase58: () => 'X'}, sendTransaction}),
  useConnection: () => ({connection: {simulateTransaction: simulate}}),
}));
vi.mock('../../lib/api', () => ({api: {fetchGeoCheck: geo}}));

describe('useBuy', () => {
  beforeEach(() => {
    geo.mockReset();
    simulate.mockReset();
    sendTransaction.mockReset();
  });

  it('refuses before signing when the region is blocked', async () => {
    geo.mockResolvedValue({allowed: false, countryCode: 'US', reason: 'restricted'});
    const {result} = renderHook(() => useBuy());
    await act(async () => {
      await expect(result.current.submit(1_000_000_000n)).rejects.toThrow(/restricted/i);
    });
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it('refuses when the simulation fails, before asking for a signature', async () => {
    geo.mockResolvedValue({allowed: true, countryCode: 'SI', reason: null});
    simulate.mockResolvedValue({value: {err: {InstructionError: [0, 'Custom']}}});
    const {result} = renderHook(() => useBuy());
    await act(async () => {
      await expect(result.current.submit(1_000_000_000n)).rejects.toThrow(/simulation/i);
    });
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it('ignores a second submit while one is in flight', async () => {
    geo.mockResolvedValue({allowed: true, countryCode: 'SI', reason: null});
    simulate.mockResolvedValue({value: {err: null}});
    sendTransaction.mockImplementation(() => new Promise(r => setTimeout(() => r('sig'), 50)));
    const {result} = renderHook(() => useBuy());
    await act(async () => {
      void result.current.submit(1_000_000_000n);
      void result.current.submit(1_000_000_000n);
      await new Promise(r => setTimeout(r, 80));
    });
    expect(sendTransaction).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npm test -- useBuy`
Expected: FAIL — `Cannot find module '../useBuy'`.

- [ ] **Step 3: Write the minimal implementation**

`web/src/presale/useBuy.ts`:

```ts
import {useCallback, useRef, useState} from 'react';
import {useConnection, useWallet} from '@solana/wallet-adapter-react';
import {buildSolPurchaseTx} from '../../../core/presale/buy';
import {api} from '../lib/api';

export type BuyState = 'idle' | 'checking' | 'simulating' | 'signing' | 'confirming' | 'done' | 'error';

export function useBuy() {
  const {publicKey, sendTransaction} = useWallet();
  const {connection} = useConnection();
  const [state, setState] = useState<BuyState>('idle');
  const inFlight = useRef(false);

  const submit = useCallback(
    async (solLamports: bigint): Promise<string> => {
      if (inFlight.current) return '';
      inFlight.current = true;
      try {
        if (!publicKey) throw new Error('No wallet connected');

        setState('checking');
        const geo = await api.fetchGeoCheck();
        if (!geo.allowed) {
          throw new Error(`This region is restricted: ${geo.reason ?? geo.countryCode ?? 'unknown'}`);
        }

        setState('simulating');
        const tx = await buildSolPurchaseTx(connection, publicKey, solLamports);
        const sim = await connection.simulateTransaction(tx);
        if (sim.value.err) {
          throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}`);
        }

        setState('signing');
        // The wallet signs AND broadcasts. We never hold a key and never call
        // sendTransaction through our proxy — it is not on the allowlist.
        const signature = await sendTransaction(tx, connection);

        setState('confirming');
        return signature;
      } catch (e) {
        setState('error');
        throw e;
      } finally {
        inFlight.current = false;
      }
    },
    [connection, publicKey, sendTransaction],
  );

  return {submit, state};
}
```

`web/src/presale/BuyForm.tsx`:

```tsx
import {useState} from 'react';
import {useBuy} from './useBuy';

const LAMPORTS_PER_SOL = 1_000_000_000n;

export function BuyForm() {
  const {submit, state} = useBuy();
  const [sol, setSol] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const busy = state !== 'idle' && state !== 'error' && state !== 'done';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Parse to integer lamports without ever touching a float: 1.5 -> 1500000000n.
    const [whole = '0', frac = ''] = sol.split('.');
    const lamports =
      BigInt(whole) * LAMPORTS_PER_SOL + BigInt((frac + '000000000').slice(0, 9) || '0');
    try {
      setSignature(await submit(lamports));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="sol">Amount in SOL</label>
      <input id="sol" inputMode="decimal" value={sol} onChange={e => setSol(e.target.value)} />
      <button type="submit" disabled={busy || sol === ''}>
        {busy ? state : 'Buy NOC'}
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {signature ? <p>Sent: {signature}</p> : null}
    </form>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npm test -- useBuy`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add core/presale/buy.ts web/src/presale src/modules/presale/presaleBuyModule.ts
git commit -m "feat(web): buy with SOL — gated, simulated, signed by the wallet

Three refusals come before any signature request: a blocked region, a failing
simulation, and a second click while one purchase is in flight. Each has a test
asserting that sendTransaction was never reached, because 'it showed an error' and
'it did not send' are different claims.

We never broadcast: the connected wallet does, through its own RPC. That is why
sendTransaction is absent from the proxy allowlist."
```

---

### Task 8: Referral panel and TGE countdown

**Files:**
- Create: `web/src/referral/ReferralPanel.tsx`, `web/src/tge/Countdown.tsx`
- Test: `web/src/referral/__tests__/ReferralPanel.test.tsx`, `web/src/tge/__tests__/Countdown.test.tsx`

**Interfaces:**
- Consumes: `api.fetchReferralStats` (Task 3), `fetchTgeTimestamp` (Task 5).
- Produces: `<ReferralPanel address={string} />`, `<Countdown tgeUnix={number | null} />`.

- [ ] **Step 1: Write the failing test**

`web/src/tge/__tests__/Countdown.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import {Countdown} from '../Countdown';

describe('Countdown', () => {
  it('counts in UTC from the on-chain timestamp', () => {
    vi.setSystemTime(new Date('2026-09-20T00:00:00Z'));
    render(<Countdown tgeUnix={Math.floor(Date.UTC(2026, 8, 22) / 1000)} />);
    expect(screen.getByText(/2 days/i)).toBeTruthy();
  });

  it('says the date is not set rather than showing 1970', () => {
    render(<Countdown tgeUnix={null} />);
    expect(screen.getByText(/not set/i)).toBeTruthy();
  });

  it('says TGE has passed instead of counting negative', () => {
    vi.setSystemTime(new Date('2030-01-02T00:00:00Z'));
    render(<Countdown tgeUnix={Math.floor(Date.UTC(2030, 0, 1) / 1000)} />);
    expect(screen.getByText(/has passed/i)).toBeTruthy();
  });
});
```

`web/src/referral/__tests__/ReferralPanel.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import {ReferralPanel} from '../ReferralPanel';

describe('ReferralPanel', () => {
  it('renders the share link for the connected address', () => {
    render(<ReferralPanel address="Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B" stats={{address: 'Da83', referredCount: 3, bonusNoc: 12.5}} />);
    expect(screen.getByText(/Da83cAfG/)).toBeTruthy();
    expect(screen.getByText(/3/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npm test -- Countdown ReferralPanel`
Expected: FAIL — both modules missing.

- [ ] **Step 3: Write the minimal implementation**

`web/src/tge/Countdown.tsx`:

```tsx
export function Countdown({tgeUnix}: {tgeUnix: number | null}) {
  if (tgeUnix === null) return <p>TGE date is not set yet</p>;
  const remainingMs = tgeUnix * 1000 - Date.now();
  if (remainingMs <= 0) return <p>TGE has passed</p>;
  const days = Math.floor(remainingMs / 86_400_000);
  const hours = Math.floor((remainingMs % 86_400_000) / 3_600_000);
  return (
    <p>
      {days} days {hours} hours to TGE
    </p>
  );
}
```

`web/src/referral/ReferralPanel.tsx`:

```tsx
import type {ReferralStats} from '../../../core/api/types';

export function ReferralPanel({address, stats}: {address: string; stats: ReferralStats}) {
  const link = `https://noc-tura.io/?ref=${address}`;
  return (
    <section>
      <h2>Referral</h2>
      <p>{link}</p>
      <p>{stats.referredCount} referred</p>
      <p>{stats.bonusNoc} NOC bonus</p>
    </section>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npm test`
Expected: PASS, whole suite.

- [ ] **Step 5: Commit**

```bash
git add web/src/referral web/src/tge
git commit -m "feat(web): referral panel and the TGE countdown

The countdown reads the timestamp from the chain and refuses the two failure modes
that look like data: an unset timestamp says so instead of counting from 1970, and a
past date says TGE has passed instead of counting downwards through zero."
```

---

### Task 9: Portfolio — SOL and NOC balances, price and chart

**Files:**
- Create: `web/src/portfolio/PortfolioPanel.tsx`, `web/src/portfolio/useBalances.ts`
- Test: `web/src/portfolio/__tests__/useBalances.test.ts`, `web/src/portfolio/__tests__/PortfolioPanel.test.tsx`

**Interfaces:**
- Consumes: `RPC_URL` (Task 2), `api` (Task 3), `useWallet()` (Task 4).
- Produces: `useBalances(publicKey): {sol: bigint | null; noc: bigint | null; isLoading: boolean}` and `<PortfolioPanel />`.

- [ ] **Step 1: Write the failing test**

`web/src/portfolio/__tests__/useBalances.test.ts`:

```ts
import {renderHook, waitFor} from '@testing-library/react';
import {PublicKey} from '@solana/web3.js';
import {useBalances} from '../useBalances';

const getBalance = vi.fn();
const getTokenAccountsByOwner = vi.fn();

vi.mock('@solana/wallet-adapter-react', () => ({
  useConnection: () => ({connection: {getBalance, getParsedTokenAccountsByOwner: getTokenAccountsByOwner}}),
}));

const USER = new PublicKey('Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B');

describe('useBalances', () => {
  beforeEach(() => {
    getBalance.mockReset();
    getTokenAccountsByOwner.mockReset();
  });

  it('returns lamports as bigint, never a float', async () => {
    getBalance.mockResolvedValue(473081440);
    getTokenAccountsByOwner.mockResolvedValue({value: []});
    const {result} = renderHook(() => useBalances(USER));
    await waitFor(() => expect(result.current.sol).toBe(473081440n));
  });

  it('sums every NOC account, not only the derived ATA', async () => {
    getBalance.mockResolvedValue(0);
    getTokenAccountsByOwner.mockResolvedValue({
      value: [
        {account: {data: {parsed: {info: {tokenAmount: {amount: '1000000000'}}}}}},
        {account: {data: {parsed: {info: {tokenAmount: {amount: '2000000000'}}}}}},
      ],
    });
    const {result} = renderHook(() => useBalances(USER));
    await waitFor(() => expect(result.current.noc).toBe(3000000000n));
  });

  it('reports null rather than zero when the read fails', async () => {
    getBalance.mockRejectedValue(new Error('rpc down'));
    getTokenAccountsByOwner.mockResolvedValue({value: []});
    const {result} = renderHook(() => useBalances(USER));
    await waitFor(() => expect(result.current.sol).toBeNull());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && npm test -- useBalances`
Expected: FAIL — `Cannot find module '../useBalances'`.

- [ ] **Step 3: Write the minimal implementation**

`web/src/portfolio/useBalances.ts`:

```ts
import {useQuery} from '@tanstack/react-query';
import {useConnection} from '@solana/wallet-adapter-react';
import {PublicKey} from '@solana/web3.js';

const NOC_MINT = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');

export function useBalances(publicKey: PublicKey | null) {
  const {connection} = useConnection();
  const q = useQuery({
    queryKey: ['balances', publicKey?.toBase58() ?? null],
    enabled: publicKey !== null,
    // Polled, not subscribed: a WebSocket endpoint would expose the RPC key exactly
    // as the HTTP one would, so S0 has no accountSubscribe.
    refetchInterval: 20_000,
    queryFn: async () => {
      const owner = publicKey!;
      const [sol, tokens] = await Promise.allSettled([
        connection.getBalance(owner),
        connection.getParsedTokenAccountsByOwner(owner, {mint: NOC_MINT}),
      ]);
      // The user's tokens are not always in the derived ATA, so every account for
      // the mint is summed rather than the canonical one read.
      const noc =
        tokens.status === 'fulfilled'
          ? tokens.value.value.reduce(
              (sum: bigint, a: {account: {data: {parsed: {info: {tokenAmount: {amount: string}}}}}}) =>
                sum + BigInt(a.account.data.parsed.info.tokenAmount.amount),
              0n,
            )
          : null;
      return {
        sol: sol.status === 'fulfilled' ? BigInt(sol.value) : null,
        noc,
      };
    },
  });

  return {sol: q.data?.sol ?? null, noc: q.data?.noc ?? null, isLoading: q.isLoading};
}
```

`web/src/portfolio/PortfolioPanel.tsx` renders the two figures with `formatNoc` from `web/src/presale/PresalePanel.tsx` for NOC and a 9-decimal equivalent for SOL, and renders `—` where a balance is `null`:

```tsx
import {useWallet} from '@solana/wallet-adapter-react';
import {useBalances} from './useBalances';
import {formatNoc} from '../presale/PresalePanel';

function formatSol(lamports: bigint): string {
  const whole = lamports / 1_000_000_000n;
  const frac = (lamports % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac} SOL` : `${whole} SOL`;
}

export function PortfolioPanel() {
  const {publicKey} = useWallet();
  const {sol, noc} = useBalances(publicKey);
  if (!publicKey) return null;
  return (
    <section>
      <h2>Balances</h2>
      <p>{sol === null ? '—' : formatSol(sol)}</p>
      <p>{noc === null ? '—' : formatNoc(noc.toString())}</p>
    </section>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npm test -- portfolio`
Expected: PASS, 3 tests.

Manual: connect a wallet that holds NOC and confirm the figure matches what the Android app shows for the same address.

- [ ] **Step 5: Commit**

```bash
git add web/src/portfolio
git commit -m "feat(web): SOL and NOC balances, polled rather than subscribed

Every account for the mint is summed, not the derived ATA alone: this project has a
wallet whose tokens live in a non-canonical account, and reading only the ATA shows
a zero that is not true.

A failed read renders an em dash, not 0 — those two mean opposite things to someone
checking whether their money arrived."
```

---

### Task 10: Lock the security requirements into CI

**Files:**
- Create: `.github/workflows/web.yml`, `web/src/__tests__/no-external-hosts.test.ts`
- Modify: `web/package.json` (the `verify` script is the CI entry point)

**Interfaces:**
- Consumes: `npm --prefix web run verify` from Task 1.
- Produces: a CI job that fails on a planted secret, an external host, a type error or a failing test.

- [ ] **Step 1: Write the failing test**

`web/src/__tests__/no-external-hosts.test.ts`:

```ts
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';

/**
 * Everything is served from our own origin. A stray CDN link is both a privacy leak
 * and an unreviewed path into the signing surface, and it is invisible in review.
 */
it('the built bundle references no third-party host', () => {
  const dist = 'dist';
  const files = readdirSync(join(dist, 'assets'));
  const offenders: string[] = [];
  for (const f of files) {
    const text = readFileSync(join(dist, 'assets', f), 'utf8');
    for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      const host = m[1]!;
      if (!/(^|\.)noc-tura\.io$/.test(host) && host !== 'localhost') offenders.push(`${f}: ${host}`);
    }
  }
  expect(offenders).toEqual([]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd web && npm run build && npm test -- no-external-hosts`
Expected: FAIL on the first run — wallet-adapter ships explorer and RPC URLs. Read the list it prints, and for each host decide: remove the dependency path that pulls it, or add it to the allowlist in the test **with a comment saying why**. An allowlist entry with no reason is how this gate rots.

- [ ] **Step 3: Write the minimal implementation**

`.github/workflows/web.yml`:

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
      - run: npm run verify
        working-directory: web
```

- [ ] **Step 4: Verify the gate fails when it should**

```bash
cd web
printf 'const k = Keypair.fromSecretKey(x);\n' > src/planted.ts
npm run scan; echo "expected 1, got $?"
rm src/planted.ts
npm run verify; echo "expected 0, got $?"
```
Expected: `1` then `0`. A gate that has never refused anything has not been tested.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/web.yml web/src/__tests__/no-external-hosts.test.ts web/package.json
git commit -m "ci(web): the security requirements become gates

Each check in the spec's section 6 that can be automated now is: no key-shaped
symbols in the sources, no credential in the built bundle, no third-party host in
the output. Verified in both directions — a planted secret fails the scan and a
clean tree passes it."
```

---

## What this plan deliberately leaves out

- **Shielded.** Both preconditions are open (spec section 9): the A0 key model, and a measurement of depth-20 proving in a phone browser. No screen, no flag, no import.
- **Transparent send and receive.** The connected wallet already does both; duplicating them doubles the signing surface for no gain.
- **The claim transaction.** Deferred to TGE; the countdown is S0's surface.
- **Production hosting, CSP headers and the reproducible-build check.** Those belong to the deployment task, which follows once the app runs locally and the design pass has happened — the spec's sections 6.3 and 6.4 are its requirements list.
- **Desktop visual design.** Structure and behaviour only, using the app's existing palette and type. The layouts are the user's to design (root `CLAUDE.md`), and this plan is written so that pass changes CSS, not components.
