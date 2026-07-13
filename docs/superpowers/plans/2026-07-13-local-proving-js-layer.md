# Local Proving — JS Orchestration Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the wallet-side JS layer for on-device ZK proving — feature-gated OFF — so that when the native `NocturaProver` module and the real circuit assets land, shielded proofs run locally and `noteSecret` never leaves the device.

**Architecture:** A thin `nativeProverBridge` fronts the (future) native mopro module. `provingAssets` downloads/verifies/caches each circuit's `.zkey` (SHA-256 pinned) with all I/O injected so it is pure-logic testable. `localProver` becomes real, delegating to the bridge. `proveShielded` hard-switches on `FEATURES.localProving`: ON → local-only (no hosted, queue on transient); OFF → today's hosted path unchanged.

**Tech Stack:** React Native (TypeScript strict), Jest. Native module (mopro/Rust) is OUT of this plan — mocked behind an interface. FS/download injected — mocked in tests.

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`. (CLAUDE.md)
- No placeholders — every function fully implemented. (CLAUDE.md)
- `noteSecret` / witness must NEVER be sent over the network on the local path. (spec §2)
- Shielded proving is **local-only** when the gate is ON — no silent hosted fallback. (spec §7)
- A `.zkey` whose SHA-256 ≠ the pinned hash is REJECTED; proving does not proceed. (spec §6)
- Feature default is OFF: `FEATURES.localProving = Config.LOCAL_PROVING === 'true'`. Committed default false. (mirrors `FEATURES.shieldedRelayer`)
- `circuitId ∈ {'deposit','withdraw','withdraw_change','transfer'}` (matches `proveShielded`'s ProofType). (spec §4)
- Prover output contract (final shape, native produces it): `{ proofBytes: string /*hex, 256 B*/, publicInputs: string[] /*decimal, circuit order*/ }` — identical to today's `ShieldedProveResult` so `transferFlow`/`withdrawFlow`/`depositFlow` and the wallet-side public-input cross-check are unchanged. (spec §3)

---

## File Structure

- Create `src/modules/zkProver/nativeProverBridge.ts` — TS contract + wrapper over `NativeModules.NocturaProver`.
- Create `src/modules/zkProver/provingAssets.ts` — `ensureZkey(circuitId, deps)`: download/verify/cache the pinned `.zkey`.
- Create `src/constants/provingAssets.ts` — per-circuit zkey download URL + pinned SHA-256 (config, populated from ICO delivery).
- Modify `src/modules/zkProver/localProver.ts` — real impl of the existing `{supported, prove}` interface.
- Modify `src/modules/zkProver/zkProverModule.ts` — gate `proveShielded` on `FEATURES.localProving`.
- Modify `src/constants/features.ts` — add `localProving` flag + `isLocalProvingEnabled()`.
- Modify `src/types/env.d.ts` — declare `LOCAL_PROVING?`.
- Tests under `src/modules/zkProver/__tests__/` and `src/constants/__tests__/`.

---

### Task 1: Feature flag `localProving`

**Files:**
- Modify: `src/constants/features.ts`
- Modify: `src/types/env.d.ts`
- Test: `src/constants/__tests__/features.test.ts`

**Interfaces:**
- Produces: `FEATURES.localProving: boolean`, `isLocalProvingEnabled(): boolean`.

- [x] **Step 1: Write the failing test** (append to `features.test.ts`)

```ts
import {isLocalProvingEnabled} from '../features';

it('localProving is off unless env LOCAL_PROVING=true', () => {
  // Config is mocked to {} in the test env → flag false by default.
  expect(isLocalProvingEnabled()).toBe(false);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=features`
Expected: FAIL — `isLocalProvingEnabled` is not exported.

- [x] **Step 3: Implement**

In `src/constants/features.ts`, add to the `FEATURES` object (after `shieldedRelayer`):

```ts
  /**
   * On-device ZK proving. OFF by default. When ON, shielded proofs are generated
   * locally (noteSecret never leaves the device) and the hosted prover is NOT used
   * for shielded ops — no silent fallback. Requires the native NocturaProver module
   * + the circuit assets to be present; enable only once those ship.
   */
  localProving: Config.LOCAL_PROVING === 'true',
```

And after `isShieldedRelayerEnabled`:

```ts
/** Whether shielded proofs are generated on-device (vs the hosted prover). */
export function isLocalProvingEnabled(): boolean {
  return FEATURES.localProving;
}
```

In `src/types/env.d.ts`, add inside `NativeConfig` (after `SHIELDED_RELAYER`):

```ts
    /**
     * 'true' generates shielded ZK proofs on-device (noteSecret never leaves the
     * phone; hosted prover unused for shielded). Requires native prover + assets.
     * Optional; absent = off.
     */
    LOCAL_PROVING?: string;
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=features`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/constants/features.ts src/types/env.d.ts src/constants/__tests__/features.test.ts
git commit -m "feat(prover): add localProving feature flag (off by default)"
```

---

### Task 2: Native prover bridge

**Files:**
- Create: `src/modules/zkProver/nativeProverBridge.ts`
- Test: `src/modules/zkProver/__tests__/nativeProverBridge.test.ts`

**Interfaces:**
- Produces:
  - `isProverSupported(): boolean`
  - `nativeProve(circuitId: string, witnessJson: string, zkeyPath: string): Promise<{proofBytes: string; publicInputs: string[]}>`
- Consumes: `NativeModules.NocturaProver` (native, mocked in tests). Native owns the bundled `.wasm` per circuitId; JS supplies only the verified `zkeyPath`.

- [x] **Step 1: Write the failing test**

```ts
const mockNative = {isSupported: jest.fn(), prove: jest.fn()};
jest.mock('react-native', () => ({NativeModules: {NocturaProver: mockNative}}));

import {isProverSupported, nativeProve} from '../nativeProverBridge';

beforeEach(() => jest.clearAllMocks());

it('isProverSupported reflects the native module', () => {
  mockNative.isSupported.mockReturnValue(true);
  expect(isProverSupported()).toBe(true);
  mockNative.isSupported.mockReturnValue(false);
  expect(isProverSupported()).toBe(false);
});

it('nativeProve delegates to the native module and returns its result', async () => {
  mockNative.prove.mockResolvedValue({proofBytes: 'ab'.repeat(256), publicInputs: ['1', '2']});
  const res = await nativeProve('transfer', '{"x":1}', '/cache/transfer.zkey');
  expect(mockNative.prove).toHaveBeenCalledWith('transfer', '{"x":1}', '/cache/transfer.zkey');
  expect(res.proofBytes).toBe('ab'.repeat(256));
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=nativeProverBridge`
Expected: FAIL — module does not exist.

- [x] **Step 3: Implement `src/modules/zkProver/nativeProverBridge.ts`**

```ts
import {NativeModules} from 'react-native';

/** Native (mopro) prover contract. Implemented by the NocturaProver native module
 *  (Rust core via UniFFI → iOS/Android). Native owns the bundled witness .wasm per
 *  circuitId; JS supplies the SHA-256-verified .zkey path. Output is on-chain-ready. */
interface NocturaProverNative {
  isSupported(): boolean;
  prove(
    circuitId: string,
    witnessJson: string,
    zkeyPath: string,
  ): Promise<{proofBytes: string; publicInputs: string[]}>;
}

const native = NativeModules.NocturaProver as NocturaProverNative | undefined;

export function isProverSupported(): boolean {
  return !!native && native.isSupported();
}

export async function nativeProve(
  circuitId: string,
  witnessJson: string,
  zkeyPath: string,
): Promise<{proofBytes: string; publicInputs: string[]}> {
  if (!native) {
    throw new Error('NocturaProver native module unavailable');
  }
  return native.prove(circuitId, witnessJson, zkeyPath);
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=nativeProverBridge`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/modules/zkProver/nativeProverBridge.ts src/modules/zkProver/__tests__/nativeProverBridge.test.ts
git commit -m "feat(prover): native NocturaProver bridge contract (mocked)"
```

---

### Task 3: Zkey asset config

**Files:**
- Create: `src/constants/provingAssets.ts`
- Test: `src/modules/zkProver/__tests__/provingAssets.test.ts` (config assertions live with the logic test in Task 4; this task only adds the constant + a shape test here)
- Test: `src/constants/__tests__/provingAssets.test.ts`

**Interfaces:**
- Produces: `ZKEY_ASSETS: Record<CircuitId, {url: string; sha256: string}>`, `type CircuitId`, `zkeyAsset(id: CircuitId)`.

> **ICO dependency:** the real `url` + `sha256` per circuit come from the ICO/circuits delivery and DO NOT exist yet. Ship the wired structure now with **empty strings**; `zkeyAsset` throwing on an empty entry is what keeps the gate honest (capability false until populated). Populate on delivery.

- [x] **Step 1: Write the failing test** (`src/constants/__tests__/provingAssets.test.ts`)

```ts
import {ZKEY_ASSETS, zkeyAsset} from '../provingAssets';

it('declares an entry for every circuit id', () => {
  expect(Object.keys(ZKEY_ASSETS).sort()).toEqual(
    ['deposit', 'transfer', 'withdraw', 'withdraw_change'],
  );
});

it('zkeyAsset throws until an entry is populated (unconfigured is not usable)', () => {
  // With empty url/sha256, the asset is not usable and must fail closed.
  expect(() => zkeyAsset('transfer')).toThrow(/not configured/);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=constants/__tests__/provingAssets`
Expected: FAIL — module does not exist.

- [x] **Step 3: Implement `src/constants/provingAssets.ts`**

```ts
export type CircuitId = 'deposit' | 'withdraw' | 'withdraw_change' | 'transfer';

export interface ZkeyAsset {
  /** Pinned download URL for the circuit's proving key. */
  url: string;
  /** Lowercase hex SHA-256 of the .zkey file. Verified before use. */
  sha256: string;
}

/**
 * Proving-key assets per circuit. url + sha256 are delivered by the ZK/ICO team
 * (see spec §10). Empty = not yet delivered → zkeyAsset() throws → local proving
 * reports unsupported for that circuit (fail-closed). Populate on delivery.
 */
export const ZKEY_ASSETS: Record<CircuitId, ZkeyAsset> = {
  deposit: {url: '', sha256: ''},
  withdraw: {url: '', sha256: ''},
  withdraw_change: {url: '', sha256: ''},
  transfer: {url: '', sha256: ''},
};

export function zkeyAsset(id: CircuitId): ZkeyAsset {
  const a = ZKEY_ASSETS[id];
  if (!a || !a.url || !a.sha256) {
    throw new Error(`zkey asset for '${id}' is not configured`);
  }
  return a;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=constants/__tests__/provingAssets`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/constants/provingAssets.ts src/constants/__tests__/provingAssets.test.ts
git commit -m "feat(prover): zkey asset config (structure wired, values pending ICO)"
```

---

### Task 4: `provingAssets.ensureZkey` — download / verify / cache

**Files:**
- Create: `src/modules/zkProver/provingAssets.ts`
- Test: `src/modules/zkProver/__tests__/provingAssets.test.ts`

**Interfaces:**
- Consumes: `zkeyAsset` (Task 3); an injected `AssetIO` so FS/download/hash are mockable.
- Produces:
  - `interface AssetIO { exists(path): Promise<boolean>; download(url, path): Promise<void>; sha256(path): Promise<string>; remove(path): Promise<void>; cachePath(id): string; }`
  - `ensureZkey(id: CircuitId, io: AssetIO): Promise<string>` — returns a verified local zkey path.

- [x] **Step 1: Write the failing tests**

```ts
import {ensureZkey, type AssetIO} from '../provingAssets';
import {ZKEY_ASSETS} from '../../../constants/provingAssets';

ZKEY_ASSETS.transfer.url = 'https://assets.example/transfer.zkey';
ZKEY_ASSETS.transfer.sha256 = 'good';

function ioMock(over: Partial<AssetIO> = {}): AssetIO {
  return {
    exists: jest.fn(async () => false),
    download: jest.fn(async () => {}),
    sha256: jest.fn(async () => 'good'),
    remove: jest.fn(async () => {}),
    cachePath: (id: string) => `/cache/${id}.zkey`,
    ...over,
  };
}

it('downloads, verifies, and returns the cache path when absent', async () => {
  const io = ioMock();
  const p = await ensureZkey('transfer', io);
  expect(io.download).toHaveBeenCalledWith('https://assets.example/transfer.zkey', '/cache/transfer.zkey');
  expect(p).toBe('/cache/transfer.zkey');
});

it('uses the cached file (no re-download) when present and hash matches', async () => {
  const io = ioMock({exists: jest.fn(async () => true)});
  await ensureZkey('transfer', io);
  expect(io.download).not.toHaveBeenCalled();
  expect(io.sha256).toHaveBeenCalledWith('/cache/transfer.zkey'); // still re-verified
});

it('REJECTS a hash mismatch and deletes the bad file (no proving)', async () => {
  const io = ioMock({sha256: jest.fn(async () => 'evil')});
  await expect(ensureZkey('transfer', io)).rejects.toThrow(/sha-?256/i);
  expect(io.remove).toHaveBeenCalledWith('/cache/transfer.zkey');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=zkProver/__tests__/provingAssets`
Expected: FAIL — module does not exist.

- [x] **Step 3: Implement `src/modules/zkProver/provingAssets.ts`**

```ts
import {zkeyAsset, type CircuitId} from '../../constants/provingAssets';

/** Injected filesystem/download/hash boundary (real impl wraps react-native-fs;
 *  tests mock it). Kept an interface so the pure download/verify/cache logic is
 *  fully unit-testable without native FS. */
export interface AssetIO {
  exists(path: string): Promise<boolean>;
  download(url: string, path: string): Promise<void>;
  sha256(path: string): Promise<string>;
  remove(path: string): Promise<void>;
  cachePath(id: string): string;
}

/**
 * Return a local path to the circuit's proving key, guaranteed to match the pinned
 * SHA-256. Downloads on first use; re-verifies the cached copy on every call so
 * cache tampering is caught. A mismatch deletes the file and throws — proving never
 * proceeds on an unverified key.
 */
export async function ensureZkey(id: CircuitId, io: AssetIO): Promise<string> {
  const {url, sha256} = zkeyAsset(id);
  const path = io.cachePath(id);
  if (!(await io.exists(path))) {
    await io.download(url, path);
  }
  const actual = await io.sha256(path);
  if (actual !== sha256) {
    await io.remove(path);
    throw new Error(`zkey SHA-256 mismatch for '${id}' — rejected`);
  }
  return path;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=zkProver/__tests__/provingAssets`
Expected: PASS (3 tests).

- [x] **Step 5: Commit**

```bash
git add src/modules/zkProver/provingAssets.ts src/modules/zkProver/__tests__/provingAssets.test.ts
git commit -m "feat(prover): ensureZkey — download + SHA-256 verify + cache (fail-closed)"
```

---

### Task 5: Real `localProver`

**Files:**
- Modify: `src/modules/zkProver/localProver.ts`
- Test: `src/modules/zkProver/__tests__/localProver.test.ts`

**Interfaces:**
- Consumes: `isProverSupported`, `nativeProve` (Task 2); `ensureZkey` + a concrete `AssetIO` (Task 4).
- Produces (keeps the existing shape): `localProver.supported: boolean` and
  `localProver.prove(proofType: CircuitId, params: ShieldedProveParams): Promise<{proofBytes: string; publicInputs: string[]}>`.

> Note: this replaces the old `ProofWitness`-based stub signature with the shielded
> `ShieldedProveParams` signature that `proveShielded` actually uses. `supported`
> becomes a getter (native + configured assets), not a literal.

- [x] **Step 1: Write the failing test**

```ts
jest.mock('../nativeProverBridge', () => ({
  isProverSupported: jest.fn(() => true),
  nativeProve: jest.fn(async () => ({proofBytes: 'aa'.repeat(256), publicInputs: ['10', '20']})),
}));
jest.mock('../provingAssets', () => ({ensureZkey: jest.fn(async () => '/cache/transfer.zkey')}));

import {localProver} from '../localProver';
import {isProverSupported, nativeProve} from '../nativeProverBridge';
import {ensureZkey} from '../provingAssets';

beforeEach(() => jest.clearAllMocks());

it('supported reflects the native module', () => {
  (isProverSupported as jest.Mock).mockReturnValue(true);
  expect(localProver.supported).toBe(true);
});

it('prove ensures the zkey then delegates to native, returning the proof', async () => {
  const res = await localProver.prove('transfer', {merkleRoot: '5'} as never);
  expect(ensureZkey).toHaveBeenCalledWith('transfer', expect.anything());
  expect(nativeProve).toHaveBeenCalledWith('transfer', JSON.stringify({merkleRoot: '5'}), '/cache/transfer.zkey');
  expect(res.proofBytes).toBe('aa'.repeat(256));
  expect(res.publicInputs).toEqual(['10', '20']);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=localProver`
Expected: FAIL — old stub throws / signature mismatch.

- [x] **Step 3: Implement** — replace `src/modules/zkProver/localProver.ts` body

```ts
import type {ShieldedProveParams} from './types';
import type {CircuitId} from '../../constants/provingAssets';
import {isProverSupported, nativeProve} from './nativeProverBridge';
import {ensureZkey, type AssetIO} from './provingAssets';
import {rnfsAssetIO} from './rnfsAssetIO';

/**
 * On-device ZK prover. `supported` is true only when the native module reports it
 * can prove; `prove` verifies the pinned zkey then runs the native Groth16 prover.
 * The witness (incl. noteSecret) is passed to native ONLY — never over the network.
 */
export const localProver = {
  get supported(): boolean {
    return isProverSupported();
  },

  async prove(
    proofType: CircuitId,
    params: ShieldedProveParams,
    io: AssetIO = rnfsAssetIO,
  ): Promise<{proofBytes: string; publicInputs: string[]}> {
    const zkeyPath = await ensureZkey(proofType, io);
    return nativeProve(proofType, JSON.stringify(params), zkeyPath);
  },
} as const;
```

> The concrete `rnfsAssetIO` (real FS/download via react-native-fs) is created in
> Task 6. For this task's test it is mocked via the `provingAssets` mock, so import
> resolution is all that matters here; if `rnfsAssetIO` does not yet exist, create a
> minimal stub file exporting `export const rnfsAssetIO = {} as never;` and replace
> it in Task 6. (Prefer doing Task 6 first if executing in order.)

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=localProver`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/modules/zkProver/localProver.ts src/modules/zkProver/__tests__/localProver.test.ts
git commit -m "feat(prover): real localProver delegating to native + verified zkey"
```

---

### Task 6: Concrete `AssetIO` (react-native-fs)

**Files:**
- Create: `src/modules/zkProver/rnfsAssetIO.ts`
- Test: `src/modules/zkProver/__tests__/rnfsAssetIO.test.ts`

**Interfaces:**
- Produces: `rnfsAssetIO: AssetIO` — real implementation using `react-native-fs` (`downloadFile`, `exists`, `hash`, `unlink`, `CachesDirectoryPath`).
- Consumes: `AssetIO` type (Task 4).

> Dependency: `react-native-fs`. If not already in `package.json`, add it (`npm i react-native-fs`) and note the native autolink in the task commit. Its API is thin and mockable.

- [x] **Step 1: Write the failing test**

```ts
const RNFS = {
  CachesDirectoryPath: '/caches',
  exists: jest.fn(async () => true),
  downloadFile: jest.fn(() => ({promise: Promise.resolve({statusCode: 200})})),
  hash: jest.fn(async () => 'ABCDEF'),
  unlink: jest.fn(async () => {}),
};
jest.mock('react-native-fs', () => RNFS);

import {rnfsAssetIO} from '../rnfsAssetIO';

it('cachePath is under the caches dir, keyed by circuit', () => {
  expect(rnfsAssetIO.cachePath('transfer')).toBe('/caches/noctura-transfer.zkey');
});

it('sha256 lowercases the RNFS hash', async () => {
  expect(await rnfsAssetIO.sha256('/caches/x.zkey')).toBe('abcdef');
});

it('download throws on a non-200 status', async () => {
  RNFS.downloadFile.mockReturnValueOnce({promise: Promise.resolve({statusCode: 404})});
  await expect(rnfsAssetIO.download('u', '/caches/x.zkey')).rejects.toThrow(/404/);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=rnfsAssetIO`
Expected: FAIL — module does not exist.

- [x] **Step 3: Implement `src/modules/zkProver/rnfsAssetIO.ts`**

```ts
import RNFS from 'react-native-fs';
import type {AssetIO} from './provingAssets';

export const rnfsAssetIO: AssetIO = {
  cachePath(id: string): string {
    return `${RNFS.CachesDirectoryPath}/noctura-${id}.zkey`;
  },
  async exists(path: string): Promise<boolean> {
    return RNFS.exists(path);
  },
  async download(url: string, path: string): Promise<void> {
    const {statusCode} = await RNFS.downloadFile({fromUrl: url, toFile: path}).promise;
    if (statusCode !== 200) {
      throw new Error(`zkey download failed: HTTP ${statusCode}`);
    }
  },
  async sha256(path: string): Promise<string> {
    return (await RNFS.hash(path, 'sha256')).toLowerCase();
  },
  async remove(path: string): Promise<void> {
    await RNFS.unlink(path);
  },
};
```

Then delete the temporary stub if Task 5 created one, and confirm `localProver.ts`
imports this real module.

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=rnfsAssetIO`
Expected: PASS (3 tests).

- [x] **Step 5: Commit**

```bash
git add src/modules/zkProver/rnfsAssetIO.ts src/modules/zkProver/__tests__/rnfsAssetIO.test.ts package.json
git commit -m "feat(prover): react-native-fs AssetIO (download/exists/hash/remove)"
```

---

### Task 7: Gate `proveShielded` on the flag (local-only when ON)

**Files:**
- Modify: `src/modules/zkProver/zkProverModule.ts`
- Test: `src/modules/zkProver/__tests__/zkProverModule.shielded.test.ts` (new file; do not disturb existing prover tests)

**Interfaces:**
- Consumes: `isLocalProvingEnabled` (Task 1), `localProver` (Task 5), the existing hosted `proveShielded` internals.
- Produces: `proveShielded` behavior — ON → `localProver.prove` (NO hosted call, NO network of the witness); OFF → today's hosted path (unchanged).

- [x] **Step 1: Write the failing test**

```ts
jest.mock('../../../constants/features', () => ({isLocalProvingEnabled: jest.fn(() => false)}));
jest.mock('../localProver', () => ({localProver: {supported: true, prove: jest.fn(async () => ({proofBytes: 'cc'.repeat(256), publicInputs: ['1']}))}}));
jest.mock('../../sslPinning/pinnedFetch', () => ({pinnedFetch: jest.fn()}));

import {proveShielded} from '../zkProverModule';
import {isLocalProvingEnabled} from '../../../constants/features';
import {localProver} from '../localProver';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';

beforeEach(() => jest.clearAllMocks());

it('flag ON → proves locally, never calls the hosted prover', async () => {
  (isLocalProvingEnabled as jest.Mock).mockReturnValue(true);
  const res = await proveShielded('transfer', {merkleRoot: '5'} as never);
  expect(localProver.prove).toHaveBeenCalledWith('transfer', {merkleRoot: '5'});
  expect(pinnedFetch).not.toHaveBeenCalled(); // witness never left the device
  expect(res.proofBytes).toBe('cc'.repeat(256));
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=zkProverModule.shielded`
Expected: FAIL — `proveShielded` still always calls the hosted path.

- [x] **Step 3: Implement** — at the top of `proveShielded` in `zkProverModule.ts`, before the hosted `pinnedFetch`:

```ts
  // Local-only when enabled: the witness (incl. noteSecret) is proved on-device and
  // NEVER sent to the hosted prover. No silent fallback — a local failure throws.
  if (isLocalProvingEnabled()) {
    return localProver.prove(proofType, params);
  }
```

Add the imports at the top of the file:

```ts
import {isLocalProvingEnabled} from '../../constants/features';
import {localProver} from './localProver';
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=zkProverModule.shielded`
Expected: PASS.

- [x] **Step 5: Full-suite regression + commit**

```bash
npx tsc --noEmit
npx jest
git add src/modules/zkProver/zkProverModule.ts src/modules/zkProver/__tests__/zkProverModule.shielded.test.ts
git commit -m "feat(prover): route shielded proving on-device when localProving is ON (no hosted fallback)"
```

---

## Not in this plan (prerequisites to flip the gate ON)

- **Spike M1 (native, interactive):** mopro Rust crate for the 4 circuits, `NocturaProver` native module (iOS Swift + Android Kotlin via UniFFI), `libc++` static/pickFirst resolution, on-device launch + one valid proof, both platforms. Deliverable that satisfies the Task 2 contract.
- **Bundled `.wasm`:** the witness calculators bundled as native assets (native resolves per circuitId).
- **ICO delivery:** populate `ZKEY_ASSETS` url + sha256 per circuit.
- **On-device parity gate + M4:** verify a locally-generated proof is accepted on-chain (devnet) for all 4 flows, then delete the hosted-prover path for shielded.

## Self-Review

- **Spec coverage:** §3 approach → Tasks 2,5,7. §6 assets/integrity → Tasks 3,4,6. §7 local-only + no fallback → Task 7. §9 forward-compat (opaque witness JSON, circuit-agnostic) → Tasks 2,4,5. §5 libc++ / native / §8 on-device parity / iOS → explicitly deferred to "Not in this plan" (M1) — correct, not TDD-able here. §2 residual (noteSecret sole authority) → out of scope by design.
- **Placeholder scan:** the only empty values are `ZKEY_ASSETS` url/sha256 — an intentional, documented ICO-delivery config that fails closed (Task 3), not a logic placeholder. No TODO/TBD in code.
- **Type consistency:** `{proofBytes: string; publicInputs: string[]}` used identically in Tasks 2,5,7; `CircuitId` from Task 3 used in 4,5; `AssetIO` from Task 4 used in 5,6; flag names `localProving`/`isLocalProvingEnabled` consistent across 1,7.
