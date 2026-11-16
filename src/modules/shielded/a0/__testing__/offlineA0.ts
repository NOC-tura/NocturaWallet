/**
 * TEST-ONLY: the A0 key equations computed OFFLINE, and a fake `NocturaProver` native module
 * built on them (never imported by app code).
 *
 * THE ANTI-CIRCULARITY BOUNDARY. Jest cannot load the Rust core, so the suites of the note store
 * and of recovery talk to this fake through the real bridge (`nativeProverBridge.ts`). Its
 * values come from two places only, neither of them code under test:
 *   - the committed offline vector file `native/noctura-prover/tests/fixtures/a0-key-vectors.json`
 *     (written by `scripts/a0-vectors/gen-key-vectors.mjs` from micro-key-producer/bls.js and
 *     poseidon-lite; the Rust core is held to the same file) — the seed → `nk` step is a LOOKUP in
 *     that file, so no derivation at the spend path happens in JS (§14 boundary);
 *   - the frozen equations of spec §3, re-implemented here directly on `poseidon-lite` and
 *     `@noble/hashes` SHA-512 — and held to every row of that file by `offlineA0.test.ts` before
 *     any suite may lean on them.
 * Nothing here imports `fieldEquations.ts`, `recovery.ts` or `noteStore.ts`.
 *
 * The fake follows the Rust core's documented contract (spec §3 "JNI surface", rev 3.2): one live
 * handle, a second `keysOpen` replaces it, a stale handle is refused (`E_A0_UNKNOWN_HANDLE`),
 * `matchSpent` refuses a repeated own rho (`E_A0_DUPLICATE_RHO`) and treats `chainNullifiers` as
 * a set, every value is 64 lowercase canonical hex (`E_A0_NON_CANONICAL`), every u64 a canonical
 * decimal (`E_A0_NOT_U64`). Every call is logged in `calls` (method + arguments) for the
 * handle-lifetime and "one matchSpent" assertions.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {poseidon2, poseidon3, poseidon5} from 'poseidon-lite';
import {sha512} from '@noble/hashes/sha2.js';

export const FIELD_R =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export interface KeyVectorNote {
  depositIndex: string;
  rho: string;
  nullifier: string;
  rhoChange: string;
  commitments: {amount: string; commitment: string}[];
}
export interface KeyVectorSeed {
  label: string;
  seed: string;
  nk: string;
  ivk: string;
  dSelf: string;
  addrSelf: string;
  notes: KeyVectorNote[];
}
export interface KeyVectors {
  constants: {mintHash: string; dSelfDomain: string; depositRhoDomain: string; fieldModulus: string};
  seeds: KeyVectorSeed[];
}

export const KEY_VECTORS_PATH = join(
  __dirname,
  '../../../../../native/noctura-prover/tests/fixtures/a0-key-vectors.json',
);
export const KEY_VECTORS = JSON.parse(readFileSync(KEY_VECTORS_PATH, 'utf8')) as KeyVectors;

/** The repo's public test mnemonic (abandon … about) — the "own" seed of every recovery test. */
export const TEST_SEED = KEY_VECTORS.seeds[0]!;
/** The repo's second test mnemonic (zoo … wrong) — "somebody else". */
export const OTHER_SEED = KEY_VECTORS.seeds[1]!;

const enc = new TextEncoder();
const hex64 = (v: bigint): string => v.toString(16).padStart(64, '0');
const bytesOf = (h: string): Uint8Array => Uint8Array.from(Buffer.from(h, 'hex'));
const beModR = (b: Uint8Array): bigint => BigInt(`0x${Buffer.from(b).toString('hex')}`) % FIELD_R;
const u64be = (i: bigint): Uint8Array => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, i, false);
  return b;
};
const cat = (...parts: Uint8Array[]): Uint8Array => Uint8Array.from(parts.flatMap(p => [...p]));

const MINT_HASH = BigInt(`0x${KEY_VECTORS.constants.mintHash}`);
const TAG_CM = 0x10n;
const TAG_NULL = 0x11n;
const TAG_ADDR = 0x12n;
const TAG_RHO = 0x13n;

/** The §3 equations for one `nk`, computed offline. Every value 64 lowercase BE hex. */
export class OfflineA0Keys {
  readonly nk: bigint;
  readonly dSelf: bigint;
  readonly addrSelf: bigint;
  constructor(nkHex: string) {
    this.nk = BigInt(`0x${nkHex}`);
    this.dSelf = beModR(sha512(cat(enc.encode(KEY_VECTORS.constants.dSelfDomain), bytesOf(nkHex))));
    this.addrSelf = poseidon3([TAG_ADDR, this.nk, this.dSelf]);
  }
  /** rho(i) = be_mod_r(SHA-512("noctura/a0/deposit-rho/v1" ‖ be32(nk) ‖ u64be(i))) */
  rho(i: bigint): string {
    return hex64(
      beModR(sha512(cat(enc.encode(KEY_VECTORS.constants.depositRhoDomain), bytesOf(hex64(this.nk)), u64be(i)))),
    );
  }
  /** nullifier(rho) = Poseidon3(0x11, nk, rho) */
  nullifier(rho: string): string {
    return hex64(poseidon3([TAG_NULL, this.nk, BigInt(`0x${rho}`)]));
  }
  /** commitment(amount, rho) = Poseidon5(0x10, addrField(d_self), amount, mintHash, rho) */
  commitment(amount: bigint, rho: string): string {
    return hex64(poseidon5([TAG_CM, this.addrSelf, amount, MINT_HASH, BigInt(`0x${rho}`)]));
  }
  /** rho_change = Poseidon3(0x13, nullifier, 0) */
  rhoChange(nullifier: string): string {
    return hex64(poseidon3([TAG_RHO, BigInt(`0x${nullifier}`), 0n]));
  }
}

/** The offline keys of a vector seed. */
export function offlineKeys(seed: KeyVectorSeed): OfflineA0Keys {
  return new OfflineA0Keys(seed.nk);
}

/** A fresh copy of a vector seed's 64 bytes (the bridge consumes — zero-fills — what it is given). */
export function seedBytes(seed: KeyVectorSeed): Uint8Array {
  return bytesOf(seed.seed);
}

/** A different 32-byte field element, deterministic in `k` (a stranger's commitment, a change leaf). */
export function strangerField(k: number): string {
  return hex64(poseidon2([0x7777n, BigInt(k)]));
}

// ------------------------------------------------------------------ the fake native module

export interface FakeCall {
  method: string;
  args: unknown[];
}

class NativeRefusal extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
  }
}

const HEX = /^[0-9a-f]{64}$/;
const U64 = /^(0|[1-9][0-9]*)$/;
const canonical = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || !HEX.test(v) || BigInt(`0x${v}`) >= FIELD_R) {
    throw new NativeRefusal('E_A0_NON_CANONICAL', `${what} ${String(v)}`);
  }
  return v;
};
const u64 = (v: unknown, what: string): bigint => {
  if (typeof v !== 'string' || !U64.test(v) || BigInt(v) >= 2n ** 64n) {
    throw new NativeRefusal('E_A0_NOT_U64', `${what} ${String(v)}`);
  }
  return BigInt(v);
};

export interface FakeProverNative {
  isSupported(): boolean;
  proveV1(): Promise<never>;
  keysOpen(seed: number[]): Promise<string>;
  keysClose(handle: string): Promise<null>;
  depositRho(handle: string, depositIndex: string): Promise<string>;
  matchSpent(handle: string, chainNullifiers: string[], ownRhos: string[]): Promise<number[]>;
  commitment(handle: string, amount: string, rho: string): Promise<string>;
  prove(): Promise<never>;
  /** test controls */
  readonly calls: FakeCall[];
  /** the live handle, or null */
  liveHandle(): string | null;
  /** the next call of `method` rejects with `error` (once) */
  failNext(method: string, error: Error): void;
  reset(): void;
}

/** A fake of the NocturaProver React module, computing every value offline (above). */
export function createFakeProverNative(): FakeProverNative {
  const calls: FakeCall[] = [];
  let live: {handle: string; keys: OfflineA0Keys} | null = null;
  let counter = 0;
  const failures = new Map<string, Error>();

  const enter = (method: string, args: unknown[]): void => {
    calls.push({method, args: JSON.parse(JSON.stringify(args)) as unknown[]});
    const f = failures.get(method);
    if (f) {
      failures.delete(method);
      throw f;
    }
  };
  const keysOf = (handle: string): OfflineA0Keys => {
    if (!live || live.handle !== handle) {
      throw new NativeRefusal('E_A0_UNKNOWN_HANDLE', `handle ${handle}`);
    }
    return live.keys;
  };

  return {
    calls,
    liveHandle: () => live?.handle ?? null,
    failNext: (method, error) => {
      failures.set(method, error);
    },
    reset: () => {
      calls.length = 0;
      live = null;
      failures.clear();
    },
    isSupported: () => true,
    proveV1: async () => {
      throw new NativeRefusal('E_V1_REMOVED', 'the v1 prover is removed');
    },
    prove: async () => {
      throw new NativeRefusal('E_FAKE_NO_PROVE', 'the fake proves nothing (recovery never proves)');
    },
    keysOpen: async (seed: number[]) => {
      enter('keysOpen', [seed.length]); // the seed itself is never logged
      live = null; // a second open ends the live session before validating the new seed (rev 3.2)
      if (!Array.isArray(seed) || seed.length !== 64) {
        throw new NativeRefusal('E_A0_SEED_LENGTH', `seed of ${seed.length} bytes`);
      }
      const hex = Buffer.from(seed).toString('hex');
      const v = KEY_VECTORS.seeds.find(s => s.seed === hex);
      if (!v) {
        throw new Error('fakeProverNative: a seed outside a0-key-vectors.json (the fake derives nothing)');
      }
      counter += 1;
      live = {handle: String(counter), keys: new OfflineA0Keys(v.nk)};
      return live.handle;
    },
    keysClose: async (handle: string) => {
      enter('keysClose', [handle]);
      keysOf(handle);
      live = null;
      return null;
    },
    depositRho: async (handle: string, depositIndex: string) => {
      enter('depositRho', [handle, depositIndex]);
      return keysOf(handle).rho(u64(depositIndex, 'depositIndex'));
    },
    commitment: async (handle: string, amount: string, rho: string) => {
      enter('commitment', [handle, amount, rho]);
      const k = keysOf(handle);
      return k.commitment(u64(amount, 'amount'), canonical(rho, 'rho'));
    },
    matchSpent: async (handle: string, chainNullifiers: string[], ownRhos: string[]) => {
      enter('matchSpent', [handle, chainNullifiers, ownRhos]);
      const k = keysOf(handle);
      const chain = new Set(chainNullifiers.map((n, i) => canonical(n, `chainNullifier[${i}]`)));
      const seen = new Set<string>();
      const out: number[] = [];
      ownRhos.forEach((r, i) => {
        canonical(r, `ownRho[${i}]`);
        if (seen.has(r)) {
          throw new NativeRefusal('E_A0_DUPLICATE_RHO', `ownRho[${i}] repeats`);
        }
        seen.add(r);
        if (chain.has(k.nullifier(r))) {
          out.push(i);
        }
      });
      return out;
    },
  };
}
