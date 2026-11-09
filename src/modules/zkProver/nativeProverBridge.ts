import {NativeModules} from 'react-native';

/** An open A0 key session (spec §3 "Handle lifetime"): opaque; one per operation, closed in a
 *  `finally`. A second `a0KeysOpen` replaces the first. */
export type A0Handle = string & {readonly __a0Handle: unique symbol};

/** The circuits M1 proves (`transfer` is refused natively until M2). */
export type A0Circuit = 'deposit' | 'withdraw_change';

/** A proof as the chain takes it: 256 bytes as 512 hex chars, and the circuit's public inputs
 *  in order, each 32 bytes big-endian as 64 lowercase hex. */
export interface A0Proof {
  proofBytes: string;
  publicInputs: string[];
}

/** The NocturaProver native module (`NocturaProverModule.kt`): its @ReactMethods, and nothing
 *  else — `parseUnshield` / `authorizeUnshield` are Kotlin-only (the native dialog's, M1c) and
 *  are deliberately absent here. Every A0 call rejects with a stable `E_A0_…` code. */
interface NocturaProverNative {
  isSupported(): boolean;
  /** v1 (the NPkc pool) — removed with the v1 path in M1b. */
  proveV1(
    circuitId: string,
    witnessJson: string,
    zkeyPath: string,
    wasmPath: string,
  ): Promise<{proofBytes: string; publicInputs: string[]}>;
  keysOpen(seed: number[]): Promise<string>;
  keysClose(handle: string): Promise<null>;
  depositRho(handle: string, depositIndex: string): Promise<string>;
  matchSpent(handle: string, chainNullifiers: string[], ownRhos: string[]): Promise<number[]>;
  commitment(handle: string, amount: string, rho: string): Promise<string>;
  prove(
    handle: string,
    circuit: string,
    witnessJson: string,
    authId: string | null,
    zkeyPath: string,
    wasmPath: string,
  ): Promise<A0Proof>;
}

const native = NativeModules.NocturaProver as NocturaProverNative | undefined;

function requireNative(): NocturaProverNative {
  if (!native) {
    throw new Error('NocturaProver native module unavailable');
  }
  return native;
}

/** A u64 as the bridge's decimal string; a negative value never reaches native. */
function u64(v: bigint, what: string): string {
  if (v < 0n) {
    throw new RangeError(`${what} must not be negative`);
  }
  return v.toString();
}

export function isProverSupported(): boolean {
  return !!native && native.isSupported();
}

/** v1 prove (the NPkc pool) — native supplies BOTH SHA-256-verified paths at prove time.
 *  Removed with the v1 path in M1b. */
export async function nativeProve(
  circuitId: string,
  witnessJson: string,
  zkeyPath: string,
  wasmPath: string,
): Promise<{proofBytes: string; publicInputs: string[]}> {
  return requireNative().proveV1(circuitId, witnessJson, zkeyPath, wasmPath);
}

// ------------------------------------------------------------------ the A0 core (spec §3)
//
// These are the whole JS side of the native A0 surface. None returns sk, nk, ivk, d_self or
// addrField — native has no call that could — and an own note's nullifier reaches JS only as
// public input [1] of a withdraw_change proof (`a0Prove`).

/**
 * `keysOpen(seed) -> handle`. CONSUMES `seed`: the bytes are copied into a `number[]` for the
 * bridge, and both that array and the caller's `Uint8Array` are zero-filled as soon as the call
 * settles, whatever its outcome (spec §3 "The seed crosses as bytes"). Stated limit: the copies
 * React Native makes while serializing cannot be wiped from JS.
 */
export async function a0KeysOpen(seed: Uint8Array): Promise<A0Handle> {
  const bytes: number[] = Array.from(seed);
  try {
    return (await requireNative().keysOpen(bytes)) as A0Handle;
  } finally {
    bytes.fill(0);
    seed.fill(0);
  }
}

export async function a0KeysClose(handle: A0Handle): Promise<void> {
  await requireNative().keysClose(handle);
}

/** The deposit `rho(i)` as 64 lowercase hex — public once deposited (R1). */
export async function a0DepositRho(handle: A0Handle, depositIndex: bigint): Promise<string> {
  return requireNative().depositRho(handle, u64(depositIndex, 'depositIndex'));
}

/** The indices into `ownRhos` (ascending) of the own notes whose nullifier is in
 *  `chainNullifiers` (R12). Every value 64 lowercase hex. */
export async function a0MatchSpent(
  handle: A0Handle,
  chainNullifiers: string[],
  ownRhos: string[],
): Promise<number[]> {
  return requireNative().matchSpent(handle, chainNullifiers, ownRhos);
}

/** An own note's commitment (d_self implicit), 64 lowercase hex. */
export async function a0Commitment(handle: A0Handle, amount: bigint, rho: string): Promise<string> {
  return requireNative().commitment(handle, u64(amount, 'amount'), rho);
}

/**
 * `prove(handle, circuit, witnessJson, authId?, zkeyPath, wasmPath)`. `witnessJson` is the
 * circuit's allow-list only (deposit `{amount, depositIndex}`; withdraw_change `{merkleRoot,
 * inputAmount, rho, pathElements, pathIndices}`) and carries private note data — never log it.
 * A withdraw_change needs the `authId` of a native approval (M1c); without one it is refused,
 * and every prove uses a live approval up. Runs on native's proving thread.
 */
export async function a0Prove(
  handle: A0Handle,
  circuit: A0Circuit,
  witnessJson: string,
  authId: string | null,
  zkeyPath: string,
  wasmPath: string,
): Promise<A0Proof> {
  return requireNative().prove(handle, circuit, witnessJson, authId, zkeyPath, wasmPath);
}
