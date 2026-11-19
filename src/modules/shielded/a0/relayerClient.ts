/* eslint-disable no-bitwise -- byte-level encoding is part of what this file is about */
/**
 * The A0 relayer client (spec 2026-11-08 shielded A0 M1 §1 "Relayer", §6.4 quote, §6.7 submit,
 * §6.8 outcomes, R5, R6; the program side's relayer-a0-contract.md, frozen 2026-11-08 and amended
 * for P1 / P2, live on devnet since their coordinator 37ad673). Built on Task 1's transport
 * (`relayerTransport.ts`, proven on the phone), which hands back `{status, body}` for every HTTP
 * status and throws only for what is not an answer.
 *
 * THE QUOTE (§6.4). `GET /relayer/quote` is refused unless:
 *   - `programId`, `pool`, `mint` equal the pinned A0 constants, and `feePayer` equals the PINNED
 *     relayer key `A0_RELAYER.feePayer` (controller ruling 9 — stricter than §6.4's "a valid key");
 *   - `maxFee`, `minFee.{transfer, withdraw_change}` and `gasGrantLamports` are u64 CANONICAL
 *     decimal strings (no sign, no leading zero, ≤ 2^64 − 1), `validForSeconds` an integer 1..60;
 *   - `minFee.withdraw_change ≤ maxFee` — else the clear `E_A0_QUOTE_FEE_ABOVE_MAX`;
 *   - `gasGrantLamports`, when present, lies in [rent(0) + 5,000, 50,000,000], where rent(0) is
 *     the cluster's `getMinimumBalanceForRentExemption(0)` read at quote time (controller ruling 2:
 *     no floor number is pinned; 650,240 on devnet on 2026-11-17, so 655,240 today). Absent = no
 *     grant: the fresh-account option is disabled (S11), never an error here;
 *   - no key the frozen contract does not list is present.
 * The wallet's fee is EXACTLY `minFee.withdraw_change` (R5) and the time the answer arrived is
 * recorded (§6.4), for the re-quote rule of §6.7 (`a0QuoteExpired`, `a0QuoteTermsUnchanged`).
 *
 * THE SUBMIT (§6.7, contract §2). Kind `withdraw_change`, `destination = ata`, `destinationOwner =
 * owner` (REQUIRED since P2), `publicInputs` as decimal strings in the circuit's order, each named
 * field the big-endian reading of its entry (they are taken FROM the entries, so they agree by
 * construction), `cuLimit` 200,000. Before a payload exists, the five public inputs JS can
 * recompute are compared with its own values (§6.6): merkleRoot, withdrawAmount, recipientField
 * (`be_mod_r` of its OWN ATA derivation), mintHash (`be_mod_r` of the mint), fee (= the quote's).
 *
 * THE OUTCOMES (§6.8, contract §1). The twelve, each with its HTTP status; the outcome is read
 * from the body AND the status, and a disagreement is not believed. `txSignature` present ⟺
 * forwarded. An answer that cannot be read and carries a `txSignature` claims a forward: `unknown`,
 * reconciled through the sync, never released at once. An unreadable answer without one is, by
 * STATUS (R1-C1): a 4xx → `relay_failed`, not forwarded (refused before forwarding; a 429's
 * plain text is a 4xx); ANY other status (a 200 with a body that is not JSON, a gateway's
 * 500 / 502 / 503 / 504 page after nginx's 60 s proxy timeout) → `unknown`, because the relayer may
 * already have forwarded. A readable generic `relay_failed` WITHOUT a signature is `forwarded:
 * 'unknown'` and disposition `reconcile` (R2-N1 / R3-N4: the relayer answers it for a preflight
 * refusal AND for a transport failure after the node accepted the tx; Task 7 re-syncs once and
 * reverts only when it can prove the tx can never land). Every specific refusal code stays
 * not-forwarded. A deadline or a transport error on submit is `unknown` too: the net under a crash or
 * a lost answer is the direct null-safe native call plus the pending record persisted BEFORE the
 * submit leaves, then the reconcile.
 *
 * NO SELF-RELAY (R6). This module builds no transaction, holds no key and sends nothing but the
 * JSON above; the one instruction it encodes (`buildA0WithdrawChangeIx`, the shape the relayer
 * lands, for the verifier) is signed by the pinned relayer key and by nothing else. With the
 * relayer unavailable an unshield fails. `noSelfRelay.test.ts` reads the sources for it.
 */
import {PublicKey, TransactionInstruction} from '@solana/web3.js';
import type {Connection} from '@solana/web3.js';
import {
  A0,
  A0_CU,
  A0_IX_DISCRIMINATOR,
  A0_NULLIFIER_SEED,
  A0_PROOF_BYTES,
  A0_RELAYER,
  A0_WITHDRAW_CHANGE_ARGS_BYTES,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from './constants';
import {FIELD_MODULUS, toBe32Hex} from './fieldEquations';
import {A0RelayerDeadlineError, A0RelayerUrlError, relayerGetQuote, relayerPostSubmit} from './relayerTransport';
import type {RelayerHttpResult, RelayerRequestOptions} from './relayerTransport';
import type {A0Proof} from '../../zkProver/nativeProverBridge';

// ------------------------------------------------------------------------------ errors

export type A0RelayerErrorCode =
  /** the quote endpoint answered no quote (an outcome, a status) or was not reached */
  | 'E_A0_QUOTE_UNAVAILABLE'
  /** the quote's shape is not the contract's */
  | 'E_A0_QUOTE_INVALID'
  /** programId / pool / mint are not the pinned A0 constants */
  | 'E_A0_QUOTE_FOREIGN'
  /** feePayer is not the pinned relayer key */
  | 'E_A0_QUOTE_FEE_PAYER'
  /** minFee.withdraw_change is above maxFee */
  | 'E_A0_QUOTE_FEE_ABOVE_MAX'
  /** gasGrantLamports outside [rent(0) + 5,000, 50,000,000] */
  | 'E_A0_QUOTE_GRANT'
  /** the cluster's rent-exempt minimum could not be read */
  | 'E_A0_QUOTE_RENT'
  /** the unshield's own values (owner, ATA, amount, fee, proof shape) are not usable */
  | 'E_A0_SUBMIT_ARGS'
  /** a public input JS recomputes is not its own value */
  | 'E_A0_SUBMIT_PUBLIC_INPUTS';

export class A0RelayerError extends Error {
  readonly code: A0RelayerErrorCode;
  constructor(code: A0RelayerErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'A0RelayerError';
    this.code = code;
  }
}

// ------------------------------------------------------------------------------ outcomes

/**
 * The contract's twelve outcomes (§1), each with its HTTP status and whether `txSignature` is
 * always, sometimes or never present. In the order of `pinnedControl.ts`'s `A0_RELAYER_OUTCOMES`
 * (a test holds the two lists equal).
 */
export const A0_RELAYER_OUTCOME_TABLE = {
  confirmed: {status: 200, signature: 'always'},
  already_spent: {status: 409, signature: 'optional'},
  unconfirmed: {status: 502, signature: 'always'},
  relay_failed: {status: 502, signature: 'optional'},
  invalid_request: {status: 400, signature: 'never'},
  duplicate_in_flight: {status: 429, signature: 'never'},
  budget_exceeded: {status: 429, signature: 'never'},
  balance_too_low: {status: 503, signature: 'never'},
  unavailable: {status: 503, signature: 'never'},
  transfer_disabled: {status: 503, signature: 'never'},
  relayer_disabled: {status: 503, signature: 'never'},
  misconfigured: {status: 500, signature: 'never'},
} as const;

export type A0RelayerOutcome = keyof typeof A0_RELAYER_OUTCOME_TABLE;
/** The eight outcomes that never carry a signature: nothing was forwarded. */
export type A0RelayerRefusal = Exclude<A0RelayerOutcome, 'confirmed' | 'already_spent' | 'unconfirmed' | 'relay_failed'>;

/** What the submit's answer says, typed. `forwarded` is the load-bearing bit (§6.8). */
export type A0SubmitResult =
  | {outcome: 'confirmed'; status: 200; forwarded: true; txSignature: string}
  | {outcome: 'unconfirmed'; status: 502; forwarded: true; txSignature: string}
  | {
      outcome: 'already_spent';
      status: 409;
      forwarded: boolean;
      txSignature: string | null;
      /** the contract's `alreadySpentIndexes` when known; null = undetermined, never "none" */
      alreadySpentIndexes: readonly number[] | null;
    }
  | {
      outcome: 'relay_failed';
      status: number;
      /**
       * `false` ONLY for an unreadable 4xx (refused before forwarding); `true` with a signature;
       * `'unknown'` for the readable generic signature-less `relay_failed` (R2-N1: the relayer
       * answers it for a preflight refusal AND for a transport failure after the node took the tx).
       */
      forwarded: boolean | 'unknown';
      txSignature: string | null;
      /** false: the answer could not be read (an unreadable 4xx); true: the relayer said `relay_failed` */
      recognised: boolean;
    }
  | {outcome: A0RelayerRefusal; status: number; forwarded: false; txSignature: null}
  | {
      outcome: 'unknown';
      status: number | null;
      forwarded: 'unknown';
      txSignature: string | null;
      /** deadline / transport: the request may have been forwarded; unreadable: the answer claims a forward */
      cause: 'deadline' | 'transport' | 'unreadable';
    };

/**
 * What the flow does next (§6.8): `verify` the landed tx (only `confirmed`), `reconcile` through
 * the tree sync (the note `pending`, the fresh reservation kept until the chain-time rule decides),
 * or `not-forwarded` (the note untouched, a `fresh-pending` reservation released).
 */
export type A0SubmitDisposition = 'verify' | 'reconcile' | 'not-forwarded';

export function a0SubmitDisposition(r: A0SubmitResult): A0SubmitDisposition {
  switch (r.outcome) {
    case 'confirmed':
      return 'verify';
    case 'unconfirmed':
    case 'already_spent':
    case 'unknown':
      return 'reconcile';
    case 'relay_failed':
      // Only an unreadable 4xx is certainly not forwarded. A signature-less generic relay_failed is
      // `reconcile` (R2-N1): Task 7 re-syncs once and reverts only when R3-N4's three conditions prove the
      // tx can never land; otherwise the chain-time window and the sync decide.
      return r.forwarded === false ? 'not-forwarded' : 'reconcile';
    default:
      return 'not-forwarded';
  }
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** A transaction signature: base58 of exactly 64 bytes (leading '1's are zero bytes). */
export function isA0TxSignature(s: unknown): s is string {
  if (typeof s !== 'string' || s.length < 64 || s.length > 88) {
    return false;
  }
  let n = 0n;
  for (const ch of s) {
    const v = B58.indexOf(ch);
    if (v < 0) {
      return false;
    }
    n = n * 58n + BigInt(v);
  }
  let zeros = 0;
  while (zeros < s.length && s[zeros] === '1') {
    zeros++;
  }
  const significant = n === 0n ? 0 : Math.ceil(n.toString(16).length / 2);
  return zeros + significant === 64;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * The submit's `{status, body}` read against the contract's table. Pure.
 *   - a readable answer: an object whose `outcome` is one of the twelve, whose status is that
 *     outcome's, and whose `txSignature` is present exactly as the table allows (and well formed);
 *   - anything else is unreadable: `unknown` (reconcile) when it carries a `txSignature` key — it
 *     claims a forward — else by status (R1-C1): a 4xx is `relay_failed`, not forwarded,
 *     `recognised: false`; ANY other status (200, 5xx) is `unknown`, cause `unreadable`;
 *   - a readable generic `relay_failed` with no signature is `forwarded: 'unknown'` (R2-N1).
 * Other body keys (`success`, `error`, `alreadySpent`) are not read: the outcome and the status
 * decide.
 */
export function interpretA0SubmitAnswer(http: RelayerHttpResult): A0SubmitResult {
  const body = http.body;
  const unreadable = (): A0SubmitResult =>
    isPlainObject(body) && body.txSignature !== undefined
      ? {
          outcome: 'unknown',
          status: http.status,
          forwarded: 'unknown',
          txSignature: isA0TxSignature(body.txSignature) ? body.txSignature : null,
          cause: 'unreadable',
        }
      : http.status >= 400 && http.status < 500
        ? // a 4xx: the request was refused before anything was forwarded (a 429's plain text, a 400)
          {outcome: 'relay_failed', status: http.status, forwarded: false, txSignature: null, recognised: false}
        : // R1-C1: ANY other status (a 200, a gateway's 5xx after its proxy timeout) may follow a forward
          {outcome: 'unknown', status: http.status, forwarded: 'unknown', txSignature: null, cause: 'unreadable'};

  if (!isPlainObject(body) || typeof body.outcome !== 'string' || !Object.prototype.hasOwnProperty.call(A0_RELAYER_OUTCOME_TABLE, body.outcome)) {
    return unreadable();
  }
  const outcome = body.outcome as A0RelayerOutcome;
  const row = A0_RELAYER_OUTCOME_TABLE[outcome];
  if (http.status !== row.status) {
    return unreadable();
  }
  const hasSig = body.txSignature !== undefined;
  if (hasSig && !isA0TxSignature(body.txSignature)) {
    return unreadable();
  }
  if ((row.signature === 'always' && !hasSig) || (row.signature === 'never' && hasSig)) {
    return unreadable();
  }
  const sig = hasSig ? (body.txSignature as string) : null;
  switch (outcome) {
    case 'confirmed':
      return {outcome, status: 200, forwarded: true, txSignature: sig as string};
    case 'unconfirmed':
      return {outcome, status: 502, forwarded: true, txSignature: sig as string};
    case 'already_spent': {
      const idx = body.alreadySpentIndexes;
      // A withdraw_change spends one note: index 0 is the only one there is.
      const known = Array.isArray(idx) && idx.length === 1 && idx[0] === 0 ? [0] : null;
      return {outcome, status: 409, forwarded: sig !== null, txSignature: sig, alreadySpentIndexes: known};
    }
    case 'relay_failed':
      // R2-N1: with a signature the tx was forwarded; without one it is UNKNOWN, never "not forwarded"
      return {outcome, status: 502, forwarded: sig !== null ? true : 'unknown', txSignature: sig, recognised: true};
    default:
      return {outcome, status: http.status, forwarded: false, txSignature: null};
  }
}

// ------------------------------------------------------------------------------ the quote

/** A validated quote (§6.4). Every amount a BigInt in base units / lamports. */
export interface A0RelayerQuote {
  programId: string;
  pool: string;
  mint: string;
  /** = A0_RELAYER.feePayer (pinned) */
  feePayer: string;
  maxFee: bigint;
  minFee: {transfer: bigint; withdrawChange: bigint};
  /** null: no grant — the fresh-account option is disabled (S11) */
  gasGrantLamports: bigint | null;
  validForSeconds: number;
  /** the wallet's fee for a withdraw_change: exactly minFee.withdraw_change (R5) */
  fee: bigint;
  /** the floor the grant was held to (rent(0) + 5,000), null when there is no grant */
  grantFloorLamports: bigint | null;
  /** when the answer arrived (ms since the epoch, the phone's clock: only ages are taken from it) */
  fetchedAtMs: number;
}

const U64_MAX = (1n << 64n) - 1n;
const U64_DEC = /^(0|[1-9][0-9]{0,19})$/;
const QUOTE_KEYS = new Set([
  'programId',
  'pool',
  'mint',
  'feePayer',
  'maxFee',
  'minFee',
  'gasGrantLamports',
  'validForSeconds',
]);

function u64Dec(v: unknown, what: string): bigint {
  if (typeof v !== 'string' || !U64_DEC.test(v) || BigInt(v) > U64_MAX) {
    throw new A0RelayerError('E_A0_QUOTE_INVALID', `${what} is not a u64 decimal string`);
  }
  return BigInt(v);
}

/** The context a quote is validated in: when it arrived, and the cluster's rent(0) when needed. */
export interface A0QuoteContext {
  fetchedAtMs: number;
  /** `getMinimumBalanceForRentExemption(0)`; required when the quote carries a grant */
  rentExemptZeroLamports: bigint | null;
}

/** §6.4, pure: the body of a 200 answer → a quote, or `A0RelayerError`. */
export function parseA0RelayerQuote(body: unknown, ctx: A0QuoteContext): A0RelayerQuote {
  if (!isPlainObject(body)) {
    throw new A0RelayerError('E_A0_QUOTE_INVALID', 'the quote is not a JSON object');
  }
  for (const k of Object.keys(body)) {
    if (!QUOTE_KEYS.has(k)) {
      throw new A0RelayerError('E_A0_QUOTE_INVALID', `the quote carries ${JSON.stringify(k)}, which the contract does not list`);
    }
  }
  if (body.programId !== A0.programId || body.pool !== A0.pool || body.mint !== A0.mint) {
    throw new A0RelayerError('E_A0_QUOTE_FOREIGN', 'the quote is not for the pinned A0 program, pool and mint');
  }
  if (body.feePayer !== A0_RELAYER.feePayer) {
    throw new A0RelayerError('E_A0_QUOTE_FEE_PAYER', `the quote's fee payer is not the pinned relayer ${A0_RELAYER.feePayer}`);
  }
  const maxFee = u64Dec(body.maxFee, 'maxFee');
  if (!isPlainObject(body.minFee) || Object.keys(body.minFee).sort().join(',') !== 'transfer,withdraw_change') {
    throw new A0RelayerError('E_A0_QUOTE_INVALID', 'minFee must be {transfer, withdraw_change}');
  }
  const minFee = {
    transfer: u64Dec(body.minFee.transfer, 'minFee.transfer'),
    withdrawChange: u64Dec(body.minFee.withdraw_change, 'minFee.withdraw_change'),
  };
  const v = body.validForSeconds;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > A0_RELAYER.maxValidForSeconds) {
    throw new A0RelayerError('E_A0_QUOTE_INVALID', `validForSeconds must be an integer 1..${A0_RELAYER.maxValidForSeconds}`);
  }
  if (minFee.withdrawChange > maxFee) {
    throw new A0RelayerError(
      'E_A0_QUOTE_FEE_ABOVE_MAX',
      `the relayer's fee ${minFee.withdrawChange} is above the pool's maximum ${maxFee}; nothing can be submitted`,
    );
  }
  let gasGrantLamports: bigint | null = null;
  let grantFloorLamports: bigint | null = null;
  if (body.gasGrantLamports !== undefined) {
    gasGrantLamports = u64Dec(body.gasGrantLamports, 'gasGrantLamports');
    if (ctx.rentExemptZeroLamports === null) {
      throw new A0RelayerError('E_A0_QUOTE_RENT', 'a grant cannot be checked without the cluster rent');
    }
    grantFloorLamports = ctx.rentExemptZeroLamports + A0_RELAYER.signatureFeeLamports;
    if (gasGrantLamports < grantFloorLamports || gasGrantLamports > A0_RELAYER.maxGasGrantLamports) {
      throw new A0RelayerError(
        'E_A0_QUOTE_GRANT',
        `gasGrantLamports ${gasGrantLamports} is outside [${grantFloorLamports}, ${A0_RELAYER.maxGasGrantLamports}]`,
      );
    }
  }
  return {
    programId: A0.programId,
    pool: A0.pool,
    mint: A0.mint,
    feePayer: A0_RELAYER.feePayer,
    maxFee,
    minFee,
    gasGrantLamports,
    validForSeconds: v,
    fee: minFee.withdrawChange,
    grantFloorLamports,
    fetchedAtMs: ctx.fetchedAtMs,
  };
}

/** The one cluster request a quote may need (generic: nothing in it is about a note, §6.4). */
export type A0RentRpc = Pick<Connection, 'getMinimumBalanceForRentExemption'>;

export interface A0QuoteOptions {
  transport?: RelayerRequestOptions;
  /** default Date.now */
  now?: () => number;
}

/**
 * §6.4: `GET /relayer/quote` → a validated quote. `rpc` is the devnet connection the tree sync
 * uses; it is asked `getMinimumBalanceForRentExemption(0)` only when the quote carries a grant.
 * Never a fallback (R6): a quote that is not there is `E_A0_QUOTE_UNAVAILABLE`.
 */
export async function fetchA0RelayerQuote(rpc: A0RentRpc, o: A0QuoteOptions = {}): Promise<A0RelayerQuote> {
  let http: RelayerHttpResult;
  try {
    http = await relayerGetQuote(o.transport);
  } catch (e) {
    if (e instanceof A0RelayerUrlError) {
      throw e;
    }
    throw new A0RelayerError('E_A0_QUOTE_UNAVAILABLE', `the relayer was not reached (${e instanceof Error ? e.message : String(e)})`);
  }
  const fetchedAtMs = (o.now ?? Date.now)();
  if (http.status !== 200) {
    const said = isPlainObject(http.body) && typeof http.body.outcome === 'string' ? http.body.outcome : 'no outcome';
    throw new A0RelayerError('E_A0_QUOTE_UNAVAILABLE', `the relayer answered ${http.status} (${said})`);
  }
  let rent: bigint | null = null;
  if (isPlainObject(http.body) && http.body.gasGrantLamports !== undefined) {
    let lamports: unknown;
    try {
      lamports = await rpc.getMinimumBalanceForRentExemption(0);
    } catch (e) {
      throw new A0RelayerError('E_A0_QUOTE_RENT', `rent(0) could not be read (${e instanceof Error ? e.message : String(e)})`);
    }
    if (typeof lamports !== 'number' || !Number.isSafeInteger(lamports) || lamports <= 0) {
      throw new A0RelayerError('E_A0_QUOTE_RENT', `rent(0) is not a positive integer: ${String(lamports)}`);
    }
    rent = BigInt(lamports);
  }
  return parseA0RelayerQuote(http.body, {fetchedAtMs, rentExemptZeroLamports: rent});
}

/** §6.7: a quote older than its `validForSeconds` is re-fetched before submit. */
export function a0QuoteExpired(q: A0RelayerQuote, nowMs: number): boolean {
  return nowMs - q.fetchedAtMs >= q.validForSeconds * 1000;
}

/**
 * §6.7: a re-fetched quote may take the proof already made only if the terms the user approved
 * are the same — the fee (minFee.withdraw_change), the fee payer and the grant (or its absence).
 * Anything else: discard the proof, new confirmation.
 */
export function a0QuoteTermsUnchanged(a: A0RelayerQuote, b: A0RelayerQuote): boolean {
  return a.fee === b.fee && a.feePayer === b.feePayer && a.gasGrantLamports === b.gasGrantLamports;
}

// ------------------------------------------------------------------------------ the payload

/** `POST /relayer/submit` for kind `withdraw_change` — the contract's §2 fields, in its order. */
export interface A0WithdrawChangePayload {
  kind: 'withdraw_change';
  pool: string;
  mint: string;
  merkleRoot: string;
  nullifier: string;
  withdrawAmount: string;
  destination: string;
  destinationOwner: string;
  changeCommitment: string;
  fee: string;
  proofBytes: string;
  publicInputs: string[];
  cuLimit: number;
}

/** The unshield's own values: the authorization's owner and ATA, the amount, the fee, the root. */
export interface A0UnshieldTerms {
  /** the destination wallet address (base58), on the Ed25519 curve */
  owner: string;
  /** the token account the authorization returned = ATA(owner, mint) */
  ata: string;
  /** base units, 1..2^64-1 */
  amount: bigint;
  /** = the quote's fee (R5) */
  fee: bigint;
  /** the root the path was computed against (the synced tree's) */
  merkleRoot: bigint;
}

/** The order of withdraw_change's public inputs (§1). */
export const A0_WITHDRAW_CHANGE_PUBLIC_INPUTS = [
  'merkleRoot',
  'nullifier',
  'withdrawAmount',
  'recipientField',
  'mintHash',
  'changeCommitment',
  'fee',
] as const;

const HEX32 = /^[0-9a-f]{64}$/;
const HEX_PROOF = new RegExp(`^[0-9a-f]{${2 * A0_PROOF_BYTES}}$`);

function beModR(bytes: Uint8Array): bigint {
  return BigInt(`0x${Buffer.from(bytes).toString('hex')}`) % FIELD_MODULUS;
}

function canonicalKey(s: string, what: string): PublicKey {
  let k: PublicKey;
  try {
    k = new PublicKey(s);
  } catch {
    throw new A0RelayerError('E_A0_SUBMIT_ARGS', `${what} is not a public key`);
  }
  if (k.toBase58() !== s) {
    throw new A0RelayerError('E_A0_SUBMIT_ARGS', `${what} is not in canonical base58`);
  }
  return k;
}

/** ATA(owner, mint) under the classic token program, computed here (never read from Rust). */
export function a0AtaOf(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), new PublicKey(TOKEN_PROGRAM_ID).toBuffer(), new PublicKey(A0.mint).toBuffer()],
    new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID),
  )[0];
}

/**
 * §6.6 + §6.7: the submit payload for a proof Rust made (`a0Prove('withdraw_change', …)`), after
 * JS compared every public input it can recompute with its own value. The nullifier and the change
 * commitment cannot be recomputed in JS (R12, R9): they are checked when the tx lands (§6.8).
 * The payload carries the in-flight nullifier — keep it in memory only (Task 7).
 */
export function buildA0WithdrawChangePayload(
  proof: A0Proof,
  terms: A0UnshieldTerms,
  quote: A0RelayerQuote,
): A0WithdrawChangePayload {
  if (!Array.isArray(proof.publicInputs) || proof.publicInputs.length !== A0_WITHDRAW_CHANGE_PUBLIC_INPUTS.length) {
    throw new A0RelayerError('E_A0_SUBMIT_ARGS', 'a withdraw_change proof has exactly 7 public inputs');
  }
  const pi = proof.publicInputs.map((h, i) => {
    if (typeof h !== 'string' || !HEX32.test(h)) {
      throw new A0RelayerError('E_A0_SUBMIT_ARGS', `public input ${i} is not 64 lowercase hex`);
    }
    const v = BigInt(`0x${h}`);
    if (v >= FIELD_MODULUS) {
      throw new A0RelayerError('E_A0_SUBMIT_ARGS', `public input ${i} is not a canonical field element`);
    }
    return v;
  });
  if (typeof proof.proofBytes !== 'string' || !HEX_PROOF.test(proof.proofBytes)) {
    throw new A0RelayerError('E_A0_SUBMIT_ARGS', `the proof is not ${A0_PROOF_BYTES} bytes of lowercase hex`);
  }
  if (terms.amount < 1n || terms.amount > U64_MAX) {
    throw new A0RelayerError('E_A0_SUBMIT_ARGS', 'amount must be 1..2^64-1 base units');
  }
  if (terms.fee !== quote.fee) {
    throw new A0RelayerError('E_A0_SUBMIT_ARGS', `the fee ${terms.fee} is not the quote's minFee ${quote.fee} (R5)`);
  }
  const owner = canonicalKey(terms.owner, 'the destination owner');
  if (!PublicKey.isOnCurve(owner.toBytes())) {
    throw new A0RelayerError('E_A0_SUBMIT_ARGS', 'the destination owner is not a wallet address (off the Ed25519 curve)');
  }
  const ata = canonicalKey(terms.ata, 'the destination token account');
  if (!a0AtaOf(owner).equals(ata)) {
    throw new A0RelayerError('E_A0_SUBMIT_ARGS', 'the token account is not ATA(owner, mint)');
  }
  const ours: Array<[number, bigint]> = [
    [0, terms.merkleRoot],
    [2, terms.amount],
    [3, beModR(ata.toBytes())],
    [4, beModR(new PublicKey(A0.mint).toBytes())],
    [6, terms.fee],
  ];
  for (const [i, v] of ours) {
    if (pi[i] !== v) {
      throw new A0RelayerError(
        'E_A0_SUBMIT_PUBLIC_INPUTS',
        `public input ${i} (${A0_WITHDRAW_CHANGE_PUBLIC_INPUTS[i]}) is not this unshield's`,
      );
    }
  }
  return {
    kind: 'withdraw_change',
    pool: A0.pool,
    mint: A0.mint,
    merkleRoot: toBe32Hex(pi[0]!),
    nullifier: toBe32Hex(pi[1]!),
    withdrawAmount: pi[2]!.toString(),
    destination: terms.ata,
    destinationOwner: terms.owner,
    changeCommitment: toBe32Hex(pi[5]!),
    fee: pi[6]!.toString(),
    proofBytes: proof.proofBytes,
    publicInputs: pi.map(v => v.toString()),
    cuLimit: A0_CU.withdrawChange,
  };
}

// ------------------------------------------------------------------------------ the relayed instruction

function hexBytes(h: string): Uint8Array {
  return Uint8Array.from(Buffer.from(h, 'hex'));
}

function u64le(v: bigint): Uint8Array {
  const out = new Uint8Array(8);
  let x = v;
  for (let i = 0; i < 8; i++) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

/** The global nullifier-record PDA ["nullifier", n] under FeGSS… (n: 32 bytes BE hex). */
export function a0NullifierRecordPda(nullifierHex: string): PublicKey {
  if (!HEX32.test(nullifierHex) || BigInt(`0x${nullifierHex}`) >= FIELD_MODULUS) {
    throw new A0RelayerError('E_A0_SUBMIT_ARGS', 'the nullifier is not a canonical 32-byte field element');
  }
  return PublicKey.findProgramAddressSync(
    [Buffer.from(A0_NULLIFIER_SEED), Buffer.from(nullifierHex, 'hex')],
    new PublicKey(A0.programId),
  )[0];
}

/**
 * The `withdraw_with_change` instruction the relayer lands for `payload` (contract §2: "Encoded as
 * withdraw_with_change(merkle_root, nullifier, amount u64 LE, change_commitment, fee u64 LE, proof
 * Vec<u8>), 380 bytes"; accounts in the IDL's order), with the PINNED relayer as fee payer and its
 * only signer. The wallet never sends it (R6): it is the shape the post-landing verifier compares
 * the landed instruction with, held byte for byte to `relayerLandedP1P2` and to two landed txs.
 */
export function buildA0WithdrawChangeIx(payload: A0WithdrawChangePayload): TransactionInstruction {
  for (const [k, v] of [
    ['merkleRoot', payload.merkleRoot],
    ['changeCommitment', payload.changeCommitment],
  ] as const) {
    if (!HEX32.test(v)) {
      throw new A0RelayerError('E_A0_SUBMIT_ARGS', `${k} is not 64 lowercase hex`);
    }
  }
  if (!HEX_PROOF.test(payload.proofBytes)) {
    throw new A0RelayerError('E_A0_SUBMIT_ARGS', `the proof is not ${A0_PROOF_BYTES} bytes of lowercase hex`);
  }
  if (!U64_DEC.test(payload.withdrawAmount) || !U64_DEC.test(payload.fee)) {
    throw new A0RelayerError('E_A0_SUBMIT_ARGS', 'withdrawAmount / fee are not u64 decimal strings');
  }
  const amount = BigInt(payload.withdrawAmount);
  const fee = BigInt(payload.fee);
  if (amount < 1n || amount > U64_MAX || fee > U64_MAX) {
    throw new A0RelayerError('E_A0_SUBMIT_ARGS', 'withdrawAmount / fee are not u64');
  }
  const data = new Uint8Array(8 + A0_WITHDRAW_CHANGE_ARGS_BYTES);
  let o = 0;
  for (const part of [
    hexBytes(A0_IX_DISCRIMINATOR.withdrawWithChange),
    hexBytes(payload.merkleRoot),
    hexBytes(payload.nullifier),
    u64le(amount),
    hexBytes(payload.changeCommitment),
    u64le(fee),
    Uint8Array.of(A0_PROOF_BYTES & 0xff, (A0_PROOF_BYTES >>> 8) & 0xff, 0, 0),
    hexBytes(payload.proofBytes),
  ]) {
    data.set(part, o);
    o += part.length;
  }
  const meta = (pubkey: string | PublicKey, isWritable: boolean, isSigner = false) => ({
    pubkey: typeof pubkey === 'string' ? new PublicKey(pubkey) : pubkey,
    isSigner,
    isWritable,
  });
  return new TransactionInstruction({
    programId: new PublicKey(A0.programId),
    keys: [
      meta(A0.pool, false),
      meta(A0.merkleTree, true),
      meta(A0.vault, true),
      meta(payload.destination, true),
      meta(a0NullifierRecordPda(payload.nullifier), true),
      meta(A0_RELAYER.feePayer, true, true),
      meta(A0_RELAYER.feeDestination, true),
      meta(A0_RELAYER.wchangeVk, false),
      meta(TOKEN_PROGRAM_ID, false),
      meta(SYSTEM_PROGRAM_ID, false),
    ],
    data: Buffer.from(data),
  });
}

// ------------------------------------------------------------------------------ the submit

/**
 * §6.7: `POST /relayer/submit` with `payload` → the typed outcome. A deadline or a transport
 * error is `unknown` (the tx may have landed; reconcile), never "not forwarded". Only a refused
 * URL throws (`E_A0_RELAYER_URL`: nothing was sent).
 */
export async function submitA0WithdrawChange(
  payload: A0WithdrawChangePayload,
  transport: RelayerRequestOptions = {},
): Promise<A0SubmitResult> {
  let http: RelayerHttpResult;
  try {
    http = await relayerPostSubmit(JSON.stringify(payload), transport);
  } catch (e) {
    if (e instanceof A0RelayerUrlError) {
      throw e;
    }
    return {
      outcome: 'unknown',
      status: null,
      forwarded: 'unknown',
      txSignature: null,
      cause: e instanceof A0RelayerDeadlineError ? 'deadline' : 'transport',
    };
  }
  return interpretA0SubmitAnswer(http);
}
