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

/** What the native confirmation returns (spec §4 step 4): an opaque single-use `authId` (32 lowercase
 *  hex, recorded in Rust), and the owner and token account Rust parsed and the human approved. */
export interface A0UnshieldApproval {
  authId: string;
  owner: string;
  ata: string;
}

/** The NocturaProver native module (`NocturaProverModule.kt`): its @ReactMethods, and nothing
 *  else — `parseUnshield` / `authorizeUnshield` are Kotlin-only (the native dialog calls them,
 *  M1c) and are deliberately absent here; `confirmUnshield` is the one way to an `authId`.
 *  Every A0 call rejects with a stable `E_A0_…` code. */
interface NocturaProverNative {
  isSupported(): boolean;
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
  confirmUnshield(handle: string, owner: string, amount: string, fee: string): Promise<unknown>;
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

/** A malformed answer of the native confirmation (never expected; refused, never repaired). */
export class A0ConfirmResultError extends Error {
  readonly code = 'E_A0_CONFIRM_RESULT' as const;
  constructor(message: string) {
    super(message);
    this.name = 'A0ConfirmResultError';
  }
}

const AUTH_ID = /^[0-9a-f]{32}$/;
const BASE58_KEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * `confirmUnshield(handle, owner, amount, fee) -> {authId, owner, ata}` (spec §4): native parses
 * the request in Rust, shows ITS OWN dialog with Rust's values, asks BiometricPrompt, and only on
 * that approval Rust records a single-use authorization (120 s from the approval). Rejects with
 * Rust's code (a malformed owner / amount / fee) or `E_A0_CONFIRM_…` (busy, no foreground
 * activity, no usable authenticator, cancelled, 60 s timeout, biometric failure, paused or
 * recreated, the key session changed, the dialog failed). The answer's SHAPE is checked here;
 * that its `ata` is ATA(owner, mint) is the caller's check (`confirmA0Unshield`, which aborts on a
 * mismatch).
 */
export async function a0ConfirmUnshield(
  handle: A0Handle,
  owner: string,
  amount: bigint,
  fee: bigint,
): Promise<A0UnshieldApproval> {
  const r = await requireNative().confirmUnshield(handle, owner, u64(amount, 'amount'), u64(fee, 'fee'));
  if (typeof r !== 'object' || r === null || Array.isArray(r)) {
    throw new A0ConfirmResultError('the confirmation answer is not an object');
  }
  const o = r as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  if (keys.join(',') !== 'ata,authId,owner') {
    throw new A0ConfirmResultError(`the confirmation answer has the keys [${keys.join(',')}]`);
  }
  const {authId, owner: approvedOwner, ata} = o;
  if (typeof authId !== 'string' || !AUTH_ID.test(authId)) {
    throw new A0ConfirmResultError('the authId is not 32 lowercase hex');
  }
  if (typeof approvedOwner !== 'string' || !BASE58_KEY.test(approvedOwner)) {
    throw new A0ConfirmResultError('the approved owner is not a base58 key');
  }
  if (typeof ata !== 'string' || !BASE58_KEY.test(ata)) {
    throw new A0ConfirmResultError('the approved token account is not a base58 key');
  }
  return {authId, owner: approvedOwner, ata};
}
