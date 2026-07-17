# On-device proving assets — Implementation Plan

> **For agentic workers:** executed inline (superpowers:executing-plans) in this session — the change is one cohesive refactor of the zkProver asset layer. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Wire the wallet to consume ICO's live devnet circuit artifacts — download+verify BOTH zkey and wasm (fail-closed), pass both paths to the native prover, and assert programId/cluster/nPublic — without flipping the `localProving` gate ON.

**Architecture:** `ZKEY_ASSETS` becomes `{zkey, wasm}` per circuit with real pinned SHA-256s. `ensureCircuitAssets` downloads+verifies both. `nativeProve` gains `wasmPath`. `localProver` passes both paths and asserts `publicInputs.length`. Trust is client-pinned (no runtime manifest fetch).

**Tech Stack:** TypeScript strict, Jest, react-native-fs (mocked), native bridge (mocked).

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`.
- Both artifacts fail-closed: download → SHA-256 → compare pinned → delete+throw on mismatch.
- No runtime manifest fetch (client-pinned constants are the trust anchor).
- The `localProving` gate stays OFF; native module stays mocked.
- Prettier: single quotes, trailing commas, no parens on single arrow params.
- `nPublic`: deposit=3, withdraw=5, withdraw_change=6, transfer=6.
- `ZKEY_PROGRAM_ID` must equal `SHIELDED_POOL_PROGRAM_ID` (`NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES`).
- Run per-file tests with `npx jest --testPathPattern=<name>`; final gate `npm run verify`.

**Coupling note:** Tasks 1–5 are one interdependent refactor — `tsc --noEmit` is green only after Task 5. Per-unit Jest tests (mocked deps) pass per task. Run `npm run verify` in Task 6.

**Design spec:** `docs/superpowers/specs/2026-07-17-on-device-proving-wallet-integration-design.md`

---

### Task 1: `constants/provingAssets.ts` — new structure, real literal, constants, guard

**Files:** Modify `src/constants/provingAssets.ts`; Test `src/constants/__tests__/provingAssets.test.ts`.

- [ ] **Step 1: failing test** — replace the old-structure assertions with:

```ts
import {circuitAssets, ZKEY_ASSETS, EXPECTED_NPUBLIC, ZKEY_PROGRAM_ID, ZKEY_CLUSTER} from '../provingAssets';
import {SHIELDED_POOL_PROGRAM_ID} from '../programs';

it('exposes zkey + wasm pinned assets per circuit', () => {
  const a = circuitAssets('transfer');
  expect(a.zkey.url).toMatch(/transfer_final\.zkey$/);
  expect(a.zkey.sha256).toHaveLength(64);
  expect(a.wasm.url).toMatch(/transfer\.wasm$/);
  expect(a.wasm.sha256).toHaveLength(64);
});
it('nPublic per circuit matches the circuits', () => {
  expect(EXPECTED_NPUBLIC).toEqual({deposit: 3, withdraw: 5, withdraw_change: 6, transfer: 6});
});
it('the pinned zkeys target the wallet-configured shielded program', () => {
  expect(ZKEY_PROGRAM_ID).toBe(SHIELDED_POOL_PROGRAM_ID);
  expect(ZKEY_CLUSTER).toBe('devnet');
});
it('circuitAssets throws when an asset url/sha256 is empty', () => {
  const saved = ZKEY_ASSETS.deposit.wasm.sha256;
  (ZKEY_ASSETS.deposit.wasm as {sha256: string}).sha256 = '';
  expect(() => circuitAssets('deposit')).toThrow(/not configured/);
  (ZKEY_ASSETS.deposit.wasm as {sha256: string}).sha256 = saved;
});
```

- [ ] **Step 2: run → FAIL** (`npx jest --testPathPattern=constants/.*provingAssets`).

- [ ] **Step 3: implement** — replace the whole file:

```ts
import {SHIELDED_POOL_PROGRAM_ID} from './programs';

export type CircuitId = 'deposit' | 'withdraw' | 'withdraw_change' | 'transfer';

export interface PinnedAsset {
  /** Pinned download URL. */
  url: string;
  /** Lowercase hex SHA-256, verified before use. */
  sha256: string;
}
export interface CircuitAssets {
  zkey: PinnedAsset;
  wasm: PinnedAsset;
}

/** The program these zkeys were built for; the wallet must transact with the same
 *  program for on-device proofs to verify against its on-chain VK. */
export const ZKEY_PROGRAM_ID = 'NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES';
export const ZKEY_CLUSTER = 'devnet';

/** Public-input count per circuit (from the deployed circuits' vk.json). */
export const EXPECTED_NPUBLIC: Record<CircuitId, number> = {
  deposit: 3,
  withdraw: 5,
  withdraw_change: 6,
  transfer: 6,
};

// AUTO-GENERATED source: noc-presale zk/scripts/gen-zkey-manifest.mjs
// circuitSetVersion=devnet-1 cluster=devnet programId=NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES
const BASE = 'https://api.noc-tura.io/api/v1/zk-assets/v1';
export const ZKEY_ASSETS: Record<CircuitId, CircuitAssets> = {
  deposit: {
    zkey: {url: `${BASE}/deposit_final.zkey`, sha256: 'f11fec5007f7039ce6897689e4d6061b7276f82014c04600a006bfb9e7ffa821'},
    wasm: {url: `${BASE}/deposit.wasm`, sha256: 'b05ef3f39b7a839f7d063e3c3db8ca355053733b2817eaa5773a562f3b572984'},
  },
  withdraw: {
    zkey: {url: `${BASE}/withdraw_final.zkey`, sha256: 'abc7ef8345eaa247f83d5fb148a3670b9a201d4a5e2d068b9459db1acc319557'},
    wasm: {url: `${BASE}/withdraw.wasm`, sha256: '1af3b9f8abb9ebd5007bcdc71817bce52192d23f53adbcc7d7cd7bedaf9a111c'},
  },
  withdraw_change: {
    zkey: {url: `${BASE}/withdraw_change_final.zkey`, sha256: 'e67f948a5b2e5d812dc8966a0ed0255689a8a0cebf41768cacc2dda5f19ca7e3'},
    wasm: {url: `${BASE}/withdraw_change.wasm`, sha256: '36fd887f047b5d2a0a647780ed46e97138fdf57969c0892e3f91d6a8d939b15a'},
  },
  transfer: {
    zkey: {url: `${BASE}/transfer_final.zkey`, sha256: '858429d01b51fc801fe2e814fd292ea0901f84b19c349656ee5f3243f30d77ce'},
    wasm: {url: `${BASE}/transfer.wasm`, sha256: '2a7213170759b01d265f7df01ad76fc87a3de8ef28e34a9596ba6094b6a9f118'},
  },
} as const;

// Fail-closed at import: the pinned zkeys must target the program we transact with.
if (ZKEY_PROGRAM_ID !== SHIELDED_POOL_PROGRAM_ID) {
  throw new Error(
    `ZKEY_PROGRAM_ID (${ZKEY_PROGRAM_ID}) != SHIELDED_POOL_PROGRAM_ID (${SHIELDED_POOL_PROGRAM_ID})`,
  );
}

export function circuitAssets(id: CircuitId): CircuitAssets {
  const a = ZKEY_ASSETS[id];
  if (!a || !a.zkey.url || !a.zkey.sha256 || !a.wasm.url || !a.wasm.sha256) {
    throw new Error(`circuit assets for '${id}' are not configured`);
  }
  return a;
}
```

- [ ] **Step 4: run → PASS.** (`tsc` still red until Task 5 — expected.)

---

### Task 2: `zkProver/provingAssets.ts` — `ensureCircuitAssets` (+ cachePath kind)

**Files:** Modify `src/modules/zkProver/provingAssets.ts`; Test `src/modules/zkProver/__tests__/provingAssets.test.ts`.

**Interfaces:** Produces `ensureCircuitAssets(id: CircuitId, io: AssetIO): Promise<{zkeyPath: string; wasmPath: string}>`; `AssetIO.cachePath(id: string, kind: 'zkey' | 'wasm'): string`. Consumes `circuitAssets` (Task 1).

- [ ] **Step 1: failing test** — rewrite around both assets:

```ts
import {ensureCircuitAssets, type AssetIO} from '../provingAssets';

const good = {
  deposit: {zkey: 'aa', wasm: 'bb'},
} as const;

function mockIO(hashes: Record<string, string>): AssetIO {
  return {
    cachePath: (id, kind) => `/cache/${id}.${kind}`,
    exists: jest.fn(async () => false),
    download: jest.fn(async () => {}),
    sha256: jest.fn(async (p: string) => hashes[p] ?? 'zz'),
    remove: jest.fn(async () => {}),
  };
}
// Pin ZKEY_ASSETS.deposit to known hashes for the test.
jest.mock('../../../constants/provingAssets', () => ({
  circuitAssets: () => ({
    zkey: {url: 'u-zkey', sha256: 'aa'},
    wasm: {url: 'u-wasm', sha256: 'bb'},
  }),
}));

it('downloads + verifies BOTH and returns both cache paths', async () => {
  const io = mockIO({'/cache/deposit.zkey': 'aa', '/cache/deposit.wasm': 'bb'});
  const r = await ensureCircuitAssets('deposit', io);
  expect(r).toEqual({zkeyPath: '/cache/deposit.zkey', wasmPath: '/cache/deposit.wasm'});
  expect(io.download).toHaveBeenCalledTimes(2);
});
it('rejects + removes on a zkey hash mismatch', async () => {
  const io = mockIO({'/cache/deposit.zkey': 'WRONG', '/cache/deposit.wasm': 'bb'});
  await expect(ensureCircuitAssets('deposit', io)).rejects.toThrow(/SHA-256 mismatch/);
  expect(io.remove).toHaveBeenCalledWith('/cache/deposit.zkey');
});
it('rejects + removes on a wasm hash mismatch', async () => {
  const io = mockIO({'/cache/deposit.zkey': 'aa', '/cache/deposit.wasm': 'WRONG'});
  await expect(ensureCircuitAssets('deposit', io)).rejects.toThrow(/SHA-256 mismatch/);
  expect(io.remove).toHaveBeenCalledWith('/cache/deposit.wasm');
});
it('skips download on a cache hit that still verifies', async () => {
  const io = mockIO({'/cache/deposit.zkey': 'aa', '/cache/deposit.wasm': 'bb'});
  (io.exists as jest.Mock).mockResolvedValue(true);
  await ensureCircuitAssets('deposit', io);
  expect(io.download).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement** — replace the file body:

```ts
import {circuitAssets, type CircuitId} from '../../constants/provingAssets';

export interface AssetIO {
  exists(path: string): Promise<boolean>;
  download(url: string, path: string): Promise<void>;
  sha256(path: string): Promise<string>;
  remove(path: string): Promise<void>;
  cachePath(id: string, kind: 'zkey' | 'wasm'): string;
}

async function ensureOne(url: string, sha256: string, path: string, io: AssetIO): Promise<string> {
  if (!(await io.exists(path))) {
    await io.download(url, path);
  }
  const actual = await io.sha256(path);
  if (actual !== sha256) {
    await io.remove(path);
    throw new Error(`SHA-256 mismatch for '${path}' — rejected`);
  }
  return path;
}

/**
 * Return local paths to the circuit's proving key AND witness wasm, each guaranteed
 * to match its pinned SHA-256. Downloads on first use; re-verifies cached copies
 * every call. A mismatch deletes the file and throws — proving never proceeds on an
 * unverified artifact. Both are downloaded (wasm is NOT bundled) so the circuit set
 * can rotate without an app-store release.
 */
export async function ensureCircuitAssets(
  id: CircuitId,
  io: AssetIO,
): Promise<{zkeyPath: string; wasmPath: string}> {
  const {zkey, wasm} = circuitAssets(id);
  const zkeyPath = await ensureOne(zkey.url, zkey.sha256, io.cachePath(id, 'zkey'), io);
  const wasmPath = await ensureOne(wasm.url, wasm.sha256, io.cachePath(id, 'wasm'), io);
  return {zkeyPath, wasmPath};
}
```

- [ ] **Step 4: run → PASS.**

---

### Task 3: `rnfsAssetIO.ts` — cachePath by kind

**Files:** Modify `src/modules/zkProver/rnfsAssetIO.ts`; Test `src/modules/zkProver/__tests__/rnfsAssetIO.test.ts`.

- [ ] **Step 1: failing test** — update the cachePath assertion:

```ts
it('cachePath is under the caches dir, keyed by circuit + kind', () => {
  expect(rnfsAssetIO.cachePath('transfer', 'zkey')).toBe('/caches/noctura-transfer.zkey');
  expect(rnfsAssetIO.cachePath('transfer', 'wasm')).toBe('/caches/noctura-transfer.wasm');
});
```

(Keep the existing sha256/download tests; update the download-error test message expectation to `/asset download failed/`.)

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement** — update `cachePath` and the download error string:

```ts
  cachePath(id: string, kind: 'zkey' | 'wasm'): string {
    return `${RNFS.CachesDirectoryPath}/noctura-${id}.${kind}`;
  },
```

and in `download`: `throw new Error(\`asset download failed: HTTP ${statusCode}\`);`

- [ ] **Step 4: run → PASS.**

---

### Task 4: `nativeProverBridge.ts` — add `wasmPath`

**Files:** Modify `src/modules/zkProver/nativeProverBridge.ts`; Test `src/modules/zkProver/__tests__/nativeProverBridge.test.ts`.

- [ ] **Step 1: failing test** — assert wasmPath forwarding:

```ts
it('forwards zkeyPath AND wasmPath to native.prove', async () => {
  const prove = jest.fn(async () => ({proofBytes: 'aa', publicInputs: []}));
  (NativeModules as {NocturaProver: unknown}).NocturaProver = {isSupported: () => true, prove};
  await nativeProve('transfer', '{}', '/z/transfer.zkey', '/w/transfer.wasm');
  expect(prove).toHaveBeenCalledWith('transfer', '{}', '/z/transfer.zkey', '/w/transfer.wasm');
});
```

(Adapt to how the existing test injects `NativeModules.NocturaProver`.)

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement** — add `wasmPath: string` to the `NocturaProverNative.prove` interface, the `nativeProve` signature, and the `native.prove(...)` call. Update the doc comment: "JS supplies both SHA-256-verified paths (zkey + wasm); native does not bundle the wasm."

- [ ] **Step 4: run → PASS.**

---

### Task 5: `localProver.ts` — both paths + nPublic assertion (tsc green here)

**Files:** Modify `src/modules/zkProver/localProver.ts`; Test `src/modules/zkProver/__tests__/localProver.test.ts`.

**Interfaces:** Consumes `ensureCircuitAssets` (Task 2), `nativeProve(…, zkeyPath, wasmPath)` (Task 4), `EXPECTED_NPUBLIC` (Task 1).

- [ ] **Step 1: failing test** — update mocks (`ensureCircuitAssets` returns both paths; `nativeProve` returns a proof) and add the nPublic assertion test:

```ts
jest.mock('../provingAssets', () => ({ensureCircuitAssets: jest.fn(async () => ({zkeyPath: '/z', wasmPath: '/w'}))}));
jest.mock('../nativeProverBridge', () => ({
  isProverSupported: jest.fn(() => true),
  nativeProve: jest.fn(async () => ({proofBytes: 'aa'.repeat(256), publicInputs: ['1','2','3','4','5','6']})),
}));

it('ensures both assets, passes both paths to native, returns the proof', async () => {
  const res = await localProver.prove('transfer', {merkleRoot: '5'} as never);
  expect(ensureCircuitAssets).toHaveBeenCalledWith('transfer', expect.anything());
  expect(nativeProve).toHaveBeenCalledWith('transfer', JSON.stringify({merkleRoot: '5'}), '/z', '/w');
  expect(res.publicInputs).toHaveLength(6); // transfer nPublic
});
it('throws when the proof publicInputs length != EXPECTED_NPUBLIC', async () => {
  (nativeProve as jest.Mock).mockResolvedValueOnce({proofBytes: 'aa', publicInputs: ['1']}); // wrong for transfer (6)
  await expect(localProver.prove('transfer', {} as never)).rejects.toThrow(/public input/i);
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement**:

```ts
import type {ShieldedProveParams} from './types';
import {EXPECTED_NPUBLIC, type CircuitId} from '../../constants/provingAssets';
import {isProverSupported, nativeProve} from './nativeProverBridge';
import {ensureCircuitAssets, type AssetIO} from './provingAssets';
import {rnfsAssetIO} from './rnfsAssetIO';

export const localProver = {
  get supported(): boolean {
    return isProverSupported();
  },
  async prove(
    proofType: CircuitId,
    params: ShieldedProveParams,
    io: AssetIO = rnfsAssetIO,
  ): Promise<{proofBytes: string; publicInputs: string[]}> {
    const {zkeyPath, wasmPath} = await ensureCircuitAssets(proofType, io);
    const res = await nativeProve(proofType, JSON.stringify(params), zkeyPath, wasmPath);
    if (res.publicInputs.length !== EXPECTED_NPUBLIC[proofType]) {
      throw new Error(
        `proof public input count ${res.publicInputs.length} != expected ${EXPECTED_NPUBLIC[proofType]} for '${proofType}'`,
      );
    }
    return res;
  },
} as const;
```

- [ ] **Step 4: run → PASS.** Then `npx tsc --noEmit` → should now be CLEAN (whole tree consistent).

---

### Task 6: dev-time manifest cross-check + full verify + commit

- [ ] **Step 1: manifest cross-check (dev-time, not shipped).** Fetch the hosted manifest and confirm the pasted SHA-256s match:

```bash
curl -s https://api.noc-tura.io/api/v1/zk-assets/v1/zkey-manifest.json \
 | node -e 'const m=JSON.parse(require("fs").readFileSync(0));for(const [c,v] of Object.entries(m.circuits||m)){console.log(c, v.zkey?.sha256, v.wasm?.sha256)}'
```

Compare each printed digest against `ZKEY_ASSETS` in `provingAssets.ts`. Any mismatch → fix the literal (do NOT proceed with a wrong pin). If the network is unavailable, note it and rely on ICO's hand-off values (they came from the same generator).

- [ ] **Step 2: full verify.** `npm run verify` → lint + tsc + jest all green.

- [ ] **Step 3: commit.**

```bash
git add src/constants/provingAssets.ts src/modules/zkProver/ src/constants/__tests__/provingAssets.test.ts
git commit -m "feat(prover): consume live devnet circuit artifacts (download+verify zkey+wasm, nPublic guard)"
```

---

## Self-Review

- **Spec coverage:** download-both fail-closed → Task 2; `nativeProve(…, wasmPath)` → Task 4; client-pinned programId/cluster + guard → Task 1; nPublic assertion → Task 5; cache-by-kind → Tasks 2/3; real literal → Task 1 (Appendix A values); manifest cross-check (dev-time) → Task 6; gate stays OFF / native mocked / parity deferred → no code change (localProver still gated by `proveShielded`'s flag, untouched here).
- **Placeholder scan:** the mock hashes `'aa'/'bb'` in tests are deliberate test fixtures, not production placeholders; real pins are in Task 1's literal. No TODO/TBD.
- **Type consistency:** `CircuitAssets = {zkey: PinnedAsset; wasm: PinnedAsset}`; `ensureCircuitAssets → {zkeyPath, wasmPath}`; `AssetIO.cachePath(id, kind)`; `nativeProve(circuitId, witnessJson, zkeyPath, wasmPath)`; `EXPECTED_NPUBLIC: Record<CircuitId, number>` — used identically across tasks. `circuitAssets` replaces `zkeyAsset`; `ensureCircuitAssets` replaces `ensureZkey` (only caller: `localProver`).

## Not in this plan

- Flipping `localProving` ON — needs the native `NocturaProver` module (still mocked) + the on-chain proofBytes parity gate (ICO §6).
- On-device restore/recovery/proof end-to-end verification.
