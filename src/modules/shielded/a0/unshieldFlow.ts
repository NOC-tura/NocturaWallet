/**
 * The A0 unshield (spec §6 steps 1–9, R5, R6, R12, I-2, I7, I13, S3, S9, S10, S11; §8 the pending
 * unshield; §10 the fresh reservation): spend the largest unspent own note into `amount` for a
 * destination wallet address, relayed (the relayer signs and pays, R6), with the change back into
 * an own note — and the reconciliation of an unshield whose outcome the app did not see.
 *
 * THE ORDER (§6 step 7, I7) — `unshieldA0`, one call per unshield (the screens' #16 → #18 → #21):
 *   1. checks before any key is opened: the amount, the build, the A0 record (the startup restore
 *      has run), the cluster (devnet genesis), the withdraw_change key files;
 *   2. `sync` — the tree (§9) and the note's path against the VERIFIED root (in the account's
 *      `rootHistory`; the sync refuses otherwise); the note is the largest unspent one (§6 step 2),
 *      its leaf must be the verified tree's at its index;
 *   3. `quote` — `fetchA0RelayerQuote` (pinned program / pool / mint / relayer, the grant held to
 *      the chain's rent); the fee is exactly `minFee.withdraw_change` (R5); max = note − fee;
 *   4. a discarded probe of the chain clock (m-2): a dead clock refuses before any prompt; then the
 *      destination (S3, S9, S11): `fresh` only for a `slip10` wallet AND a quote with a grant
 *      (reserved as `fresh-pending` HERE, on the SAME devnet Connection the cluster check passed —
 *      the registry has no cluster check of its own — I-5); `main` the registry's main (re-derived
 *      from the seed); `external` a canonical on-curve address that is no account of this seed:
 *      not a registry entry (refused naming its role), not `cli`, not `slip10:0 … 20` derived
 *      locally (m-5: "an account of this wallet not offered as a destination") — a key of this seed
 *      typed as "another address" would skip the warning its real choice carries, and the
 *      verifier's ARGS rule must never fire on our own classification. The owner is always a
 *      wallet address (§6.1);
 *   5. `approval` — the native confirmation (§4, Task 6): Kotlin shows Rust's parse, biometrics,
 *      Rust records ONE authorization; JS holds the answer to its own ATA (`confirmA0Unshield`);
 *   6. `proof` — exactly the allow-list `{merkleRoot, inputAmount, rho, pathElements, pathIndices}`
 *      (§3); the prove consumes the authorization whatever happens; the payload builder compares
 *      merkleRoot, withdrawAmount, recipientField (JS's own ATA → be_mod_r), mintHash, fee with JS's
 *      own values and aborts on a mismatch (§6 step 6);
 *   7. the re-quote (§6 step 7): a quote older than `validForSeconds` is re-fetched; the same fee,
 *      fee payer and grant → the proof already made is submitted; any change → the proof is
 *      DISCARDED and the loop goes back to step 5: a NEW confirmation for the new terms, then a new
 *      proof. Nothing is submitted under terms the user did not approve;
 *   8. `submitChainTime` — `getSlot` then `getBlockTime` (generic requests, §6 step 7; slot−1 … −4
 *      when a slot has none, m-2), THE one anchor (R2-N2), then the PENDING UNSHIELD is written (§8:
 *      `pendingSince` + the approved intent, one write), and only then `submit` (kind
 *      withdraw_change, destination = the approved ATA, destinationOwner = the approved owner,
 *      cuLimit 200,000). The `submit` STAGE is emitted at the pending write (Task 8 review M-2): from
 *      there on the unshield may stand, whatever throws before the request leaves. A hold between
 *      the write and the request (`holdMs`, Task 9's devnet hold, `submitHold.ts` via the run
 *      screen) is asked once per submit, read out as `heldMs` on `unshield-submitting`, and
 *      re-reads the clock after it, keeping the LATER value (m-1); a null or failing re-read keeps
 *      the anchor and never fails the unshield;
 *   9. the outcome (§6 step 8), by Task 3's disposition:
 *      - `verify` (`confirmed`) → `confirm`: the tree sync, retried up to
 *        `A0_CONFIRM_SYNC_RETRIES` (10) times `A0_CONFIRM_SYNC_DELAY_MS` (3 s) apart, until it lists
 *        the relayed signature (never a `getTransaction` of it, I3) — still absent → `pending`
 *        (the reconciliation decides); found → `matchSpent` over its Withdraw nullifiers + the
 *        post-landing verifier (Task 4) → the settle below;
 *      - `reconcile` (`unconfirmed`, `already_spent`, a `relay_failed` with a signature, `unknown` —
 *        a deadline, a transport error, and every unreadable answer at a status other than a 4xx,
 *        R1-C1) → the note STAYS pending, the reservation is kept; the reconciliation decides. An
 *        `unknown` never reverts the note or releases the reservation;
 *      - the GENERIC `relay_failed` WITHOUT a signature (`a0IsGenericRelayFailed`, R2-N1 / R3-N4;
 *        a stale root is this answer) → ONE re-sync: when it is complete, the proof's root has
 *        left the 64-root ring and no synced tx carries the note's nullifier
 *        (`a0RelayFailedNeverLands`), the tx can never land: the note back to `unspent` and a new
 *        path, a NEW confirmation and a new proof (§6 step 7), the reservation kept; otherwise it
 *        is `reconcile` above (pending — "Not confirmed yet" until the window decides);
 *      - `not-forwarded` (a specific refusal code, or an unreadable 4xx) → the note back to
 *        `unspent`, the reservation released.
 *   At most `A0_UNSHIELD_MAX_ROUNDS` confirmations per call.
 *
 * THE SETTLE (the controller's refusal semantics — chain truth wins for note state). For the tx
 * that `matchSpent` attributes to the note (its nullifier is ours: the note IS spent):
 *   - verdict ok → the note `spent` (`spentTx`), the change note stored exactly as Task 5's restore
 *     would recover it (`{commitment, amount: input − amount − fee — 0 included, rho:
 *     a0ChangeRho(landed nullifier), leafIndex}`), a fresh destination promoted to `fresh-exit`;
 *   - verdict REFUSED → LOUD (`landed-unverified`, a readout line; never silent, never retried):
 *     the note is `spent` all the same (a landed tx's nullifier is spent), the change note is
 *     recorded only when the tx's `LeafInserted` carries OUR change commitment; a fresh
 *     reservation refused for a seed-key signer is promoted AND marked `linked`; for any other
 *     refusal it is promoted when the tx names its address or ATA (it is on chain now) and released
 *     when it does not.
 * A tx the relayer named that `matchSpent` does NOT attribute to the note is `landed-unverified`
 * with the note left `pending` (it did not spend it; the reconciliation decides by the chain).
 *
 * THE RECONCILIATION (`reconcileA0PendingUnshields`; the startup step and "Check again"): every
 * pending unshield not held by a flow in this process — the chain time is read FIRST, then the
 * tree sync COMPLETES: a synced Withdraw that `matchSpent` attributes to the note → the settle
 * above (with the stored intent; a pending unshield stored without one settles by Task 5's
 * recovery rules alone); none, and the chain's clock past `pendingSince + 300 s` → not landed (the
 * relayer's blockhash has expired by then): back to `unspent`, the reservation released; else it
 * stays pending — on a quiet pool too (no later pool tx is needed: the clock is the chain's).
 * Reservations no pending unshield names and no flow holds (the app died between the reservation
 * and the pending write) are released unless the synced history names them. No pending unshield
 * and no such reservation → no request at all. It never looks up a nullifier PDA, never polls a
 * signature, never resubmits.
 *
 * THE IN-FLIGHT NULLIFIER (R12, INV-NULL's one exception). It reaches JS as the proof's public
 * input [1] and the payload carries it to the relayer. It lives in local variables of ONE call —
 * never stored (the pending note keeps its rho and the intent, not the nullifier), never logged
 * (no log call here touches the proof or the payload; the readout is built field by field), never
 * sent to the RPC (the settle works from the SYNCED tx; the change rho is computed from the LANDED,
 * public nullifier) — and both references are dropped as soon as the submit returns.
 *
 * ONE AT A TIME. Rust holds one authorization and Kotlin one confirmation; one unshield runs per
 * process (`E_A0_UNSHIELD_BUSY` — the screens also debounce 500 ms and disable on tap, CLAUDE.md
 * rule 6). One call submits its payload at most once.
 *
 * BOUND TO ONE WALLET (R3-N5): both entry points capture the encrypted instance at entry
 * (`options.bound ?? mmkvSecure()`) and pass it to every note-store and registry call.
 *
 * NO SELF-RELAY (R6). Nothing here builds, signs or sends a transaction; with the relayer
 * unavailable the unshield fails.
 *
 * THE WINDOW ARITHMETIC (m-1, R2-N2). `pendingSince` is the chain time read last before the
 * request leaves (after a hold too). The relayer fetches its blockhash after that, and a tx can
 * land only while that blockhash is valid (~150 slots, ~60–90 s) — so with a 300 s chain-time
 * window and a reconciliation that reads the clock BEFORE its sync, every landing is inside the
 * window with > 200 s to spare. The slot−1 … −4 fallback costs at most ~2 s of it; a hold that did
 * not re-read would cost its whole length (Task 9's is 30 s), which is why the re-read exists.
 *
 * NOTES.
 *   - (m-8) A stranger who dusts a `fresh-pending` account (any tx naming it, before our exit
 *     lands) makes the orphan sweep promote it to `fresh-exit` — harmless: the account is ours, it
 *     merely is not handed out as fresh again.
 *   - (controller) An exit account used on ANOTHER device that no restore or pre-check here has
 *     imported is not restored automatically by this module. Fresh selection stays safe (§10: the
 *     history check skips any account with history); the cost if wrong: such an account's balance
 *     is not shown until a restore.
 *   - (R3-N4, the UX cost) an honest generic failure that cannot be proven dead shows "Not
 *     confirmed yet"; the note and its `fresh-pending` reservation are held up to 300 s of chain
 *     time, until the next start or "Check again".
 *   - (fix round 1, M-8) A pending unshield that a deposit pre-check or a restore settles FIRST
 *     (Task 5: the chain's spend wins in the merge) is never run through the verifier: a refusal
 *     such as a seed-key signer is not reported and `linked` is not set for it. Carried to the
 *     final review.
 *   - (fix round 1, M-4, deferred) when R3-N4's re-sync already shows the note's nullifier, the
 *     flow still answers `pending`; the reconciliation ("Check again", the next start) settles it.
 *   - The verifier's `detail` names keys of this seed beside the signature: it reaches the
 *     returned outcome (the screen) only, never a readout line (R2-N3) — the readout carries the code.
 */
import {PublicKey} from '@solana/web3.js';
import type {Connection} from '@solana/web3.js';
import {mmkvSecure} from '../../../store/mmkv/instances';
import {loadTransparentScheme} from '../../keyDerivation/derivationScheme';
import type {TransparentScheme} from '../../keyDerivation/transparent';
import {a0Commitment, a0KeysClose, a0KeysOpen, a0MatchSpent, a0Prove, isProverSupported} from '../../zkProver/nativeProverBridge';
import type {A0Handle, A0Proof} from '../../zkProver/nativeProverBridge';
import type {AssetIO} from '../../zkProver/provingAssets';
import {rnfsAssetIO} from '../../zkProver/rnfsAssetIO';
import {A0} from './constants';
import {ensureA0KeyFiles} from './keyAssets';
import {
  A0AccountRegistryError,
  a0AccountAddress,
  a0SeedPublicKeys,
  addA0RecoveredExitAccounts,
  hasA0AccountRegistry,
  loadA0AccountRegistry,
  openA0AccountRegistry,
  parseA0Scheme,
  promoteA0FreshAccount,
  releaseA0FreshAccount,
  reserveA0FreshAccount,
} from './accountRegistry';
import type {A0AccountEntry, A0AccountRole} from './accountRegistry';
import {
  hasA0NoteRecord,
  loadA0NoteStore,
  markA0PendingUnshield,
  refreshA0PendingSince,
  revertA0PendingUnshield,
  settleA0Unshield,
} from './noteStore';
import type {A0ChangeNote, A0Note, A0PendingUnshield, A0StoreBinding} from './noteStore';
import {a0ChangeAmount, a0ChangeRho} from './recovery';
import {
  a0AtaOf,
  a0QuoteExpired,
  a0QuoteTermsUnchanged,
  a0SubmitDisposition,
  buildA0WithdrawChangePayload,
  fetchA0RelayerQuote,
  submitA0WithdrawChange,
} from './relayerClient';
import type {A0RelayerQuote, A0SubmitResult, A0WithdrawChangePayload} from './relayerClient';
import {A0RelayerUrlError, relayerUrl} from './relayerTransport';
import type {RelayerRequestOptions} from './relayerTransport';
import {a0MerklePath, syncA0Tree} from './treeSync';
import type {A0MerklePath, A0SyncOptions, A0VerifiedTree} from './treeSync';
import type {A0SyncedTx} from './syncedTx';
import {verifyLandedUnshield} from './landedVerifier';
import type {A0DestinationKind, A0VerifyRefusal} from './landedVerifier';
import {confirmA0Unshield} from './unshieldConfirm';
import {readA0UnshieldOutcome, readA0UnshieldReconcile, readA0UnshieldSubmitting} from './checkpointReadout';

/** §6 step 8 (I-2): sync retries after a `confirmed` whose signature the sync does not list yet. */
export const A0_CONFIRM_SYNC_RETRIES = 10;
/** …and the pause between them. */
export const A0_CONFIRM_SYNC_DELAY_MS = 3_000;
/** §6 step 8: a pending unshield is "not landed" once the chain's clock is past pendingSince + this. */
export const A0_UNSHIELD_LANDING_WINDOW_S = 300;
/** Confirmations one `unshieldA0` call may ask for (the first + re-quote / root-expiry rounds). */
export const A0_UNSHIELD_MAX_ROUNDS = 3;
/** m-2: slots before the current one whose block time the chain clock may fall back to. */
export const A0_CHAIN_CLOCK_EARLIER_SLOTS = 4;
/** m-5: "Another address" also refuses `slip10:0 … this` of the seed (21 local derivations). */
export const A0_EXTERNAL_SEED_SCAN_LAST = 20;

const U64_MAX = 2n ** 64n - 1n;

export type A0UnshieldErrorCode =
  /** another unshield is in flight in this process */
  | 'E_A0_UNSHIELD_BUSY'
  /** the amount is not 1..2^64-1, or amount + fee is above the note */
  | 'E_A0_UNSHIELD_AMOUNT'
  /** the Rust prover is not available on this device */
  | 'E_A0_UNSHIELD_UNSUPPORTED'
  /** no A0 record yet: the startup restore has not run */
  | 'E_A0_UNSHIELD_NOT_READY'
  /** the RPC is not devnet (genesis hash) */
  | 'E_A0_UNSHIELD_CLUSTER'
  /** no unspent note can pay the fee */
  | 'E_A0_UNSHIELD_NO_NOTE'
  /** the note's leaf is not the verified tree's at its index */
  | 'E_A0_UNSHIELD_NOTE_LEAF'
  /** the destination is not allowed (fresh unavailable, not a wallet address, a key of this seed) */
  | 'E_A0_UNSHIELD_DESTINATION'
  /** the re-fetched quote's terms cannot be met (the fee above the note, the grant gone for a fresh account) */
  | 'E_A0_UNSHIELD_TERMS'
  /** the chain's clock could not be read before the submit */
  | 'E_A0_UNSHIELD_CLOCK'
  /** A0_UNSHIELD_MAX_ROUNDS confirmations used */
  | 'E_A0_UNSHIELD_ROUNDS'
  /** a reconciliation of a pending unshield was started without the seed */
  | 'E_A0_UNSHIELD_NEEDS_SEED';

export class A0UnshieldError extends Error {
  readonly code: A0UnshieldErrorCode;
  constructor(code: A0UnshieldErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'A0UnshieldError';
    this.code = code;
  }
}

// ------------------------------------------------------------------ destination and note (pure)

/** What the user chose (#16's destination choice, Task 8). */
export type A0UnshieldDestination = {kind: 'fresh'} | {kind: 'main'} | {kind: 'external'; owner: string};

/** Why the fresh account is not offered (§11's copy keys on it). */
export type A0FreshUnavailable = 'cli' | 'no-grant';

export interface A0UnshieldDestinationOffer {
  fresh: {available: true; grantLamports: bigint} | {available: false; reason: A0FreshUnavailable};
  /** S11: the fresh account is preselected only when it is available; otherwise nothing is */
  preselected: 'fresh' | null;
}

/** §6 step 1 (S3, S9, S11): which destinations the screen offers for this wallet and quote. Pure. */
export function a0UnshieldDestinationOffer(
  quote: Pick<A0RelayerQuote, 'gasGrantLamports'>,
  scheme: TransparentScheme,
): A0UnshieldDestinationOffer {
  if (scheme.kind === 'cli') {
    return {fresh: {available: false, reason: 'cli'}, preselected: null};
  }
  if (quote.gasGrantLamports === null) {
    return {fresh: {available: false, reason: 'no-grant'}, preselected: null};
  }
  return {fresh: {available: true, grantLamports: quote.gasGrantLamports}, preselected: 'fresh'};
}

export interface A0UnshieldSource {
  note: A0Note;
  /** the note's amount minus the fee (§6 step 2) */
  maxAmount: bigint;
}

/**
 * §6 step 2: the largest unspent note (ties: the lowest leaf index) and the most it can pay out
 * after `fee`; null when no unspent note covers the fee and one base unit. Pure.
 */
export function a0UnshieldSource(notes: readonly A0Note[], fee: bigint): A0UnshieldSource | null {
  let best: A0Note | null = null;
  for (const n of notes) {
    if (n.status !== 'unspent' || n.leafIndex === undefined) {
      continue;
    }
    if (best === null || n.amount > best.amount || (n.amount === best.amount && n.leafIndex < best.leafIndex!)) {
      best = n;
    }
  }
  if (best === null || best.amount - fee < 1n) {
    return null;
  }
  return {note: best, maxAmount: best.amount - fee};
}

/** The loud text of a landed unshield the verifier refused (the controller's ruling). */
export function a0LandedUnverifiedText(code: A0VerifyRefusal, detail: string): string {
  return `Landed, but failed verification: ${code} · ${detail}`;
}

// ------------------------------------------------------------------ outcomes

export type A0UnshieldStage = 'sync' | 'quote' | 'approval' | 'proof' | 'submit' | 'confirm';

export type A0UnshieldOutcome =
  /** landed and verified: the note spent, the change note stored */
  | {
      status: 'spent';
      signature: string;
      changeLeafIndex: number;
      changeAmount: bigint;
      grantLamports: bigint | null;
      /** a fresh account that got no grant and holds 0 lamports: shown as "no SOL" (never funded) */
      destinationWithoutSol: boolean;
    }
  /** a tx the relayer named landed and the verifier REFUSED it — LOUD, never retried */
  | {
      status: 'landed-unverified';
      signature: string;
      code: A0VerifyRefusal;
      detail: string;
      /** `spent`: the tx spends our note (chain truth); `pending`: it does not — the reconciliation decides */
      note: 'spent' | 'pending';
      changeRecorded: boolean;
      /** a fresh account marked linked (a key of this seed signed the tx) */
      linked: boolean;
    }
  /** forwarded (or maybe): the note pending, the reservation kept; the reconciliation decides */
  | {
      status: 'pending';
      signature: string | null;
      reason: 'unconfirmed' | 'already_spent' | 'relay_failed' | 'unknown' | 'not-in-sync';
      detail?: string;
    }
  /** nothing was forwarded: the note unspent, the reservation released */
  | {status: 'not-sent'; outcome: string};

export interface A0UnshieldRequest {
  destination: A0UnshieldDestination;
  /** base units the destination receives */
  amount: bigint;
}

export interface A0UnshieldOptions {
  io?: AssetIO;
  sync?: A0SyncOptions;
  /** the relayer transport (default pinnedFetch to `${API_BASE}/relayer/…`) */
  transport?: RelayerRequestOptions;
  onStage?: (stage: A0UnshieldStage) => void;
  /** the encrypted instance to stay on (default: the one open at entry) — R3-N5 */
  bound?: A0StoreBinding;
  /** the phone's clock, for the quote's age only (default Date.now) */
  now?: () => number;
  /** default A0_CONFIRM_SYNC_RETRIES / A0_CONFIRM_SYNC_DELAY_MS */
  confirmSyncRetries?: number;
  confirmSyncDelayMs?: number;
  /**
   * m-1: a hold (ms) between the pending write and the submit — asked once per submit; default none
   * (0). The devnet checkpoint's one-shot hold (M1c Task 9) plugs in here. After a hold the chain
   * clock is re-read and a later value becomes `pendingSince` (R2-N2).
   */
  holdMs?: () => number;
}

// ------------------------------------------------------------------ shared state

let running = false;
/** notes / reservations a flow in this process holds: the reconciliation leaves them alone */
const liveRhos = new Set<string>();
const liveSchemes = new Set<string>();
const timers = new Set<ReturnType<typeof setTimeout>>();

const sleep = (ms: number): Promise<void> =>
  new Promise(r => {
    const t = setTimeout(() => {
      timers.delete(t);
      r();
    }, ms);
    timers.add(t);
  });

/** TEST-ONLY: clear pending retry pauses and forget an abandoned flow (a killed app's). */
export function resetA0UnshieldForTests(): void {
  for (const t of timers) {
    clearTimeout(t);
  }
  timers.clear();
  running = false;
  liveRhos.clear();
  liveSchemes.clear();
}

// ------------------------------------------------------------------ helpers

/**
 * The chain's clock (generic requests): `blockTime` of the cluster's current confirmed slot; when
 * that slot has none (null, or devnet's "block not available" error), of `slot − 1 … slot − 4`, the
 * first that has one (m-2: an earlier slot's time is at most ~2 s earlier — a reconciliation then
 * waits a little longer, a pending unshield's window starts a little sooner). Null when none of the
 * five has one; a `getSlot` failure throws.
 */
export async function a0ChainTime(connection: Connection): Promise<number | null> {
  const slot = await connection.getSlot('confirmed');
  for (let k = 0; k <= A0_CHAIN_CLOCK_EARLIER_SLOTS && slot - k >= 0; k++) {
    let t: number | null = null;
    try {
      t = await connection.getBlockTime(slot - k);
    } catch {
      t = null; // this slot has no block (yet): the one before is asked
    }
    if (typeof t === 'number' && Number.isSafeInteger(t) && t > 0) {
      return t;
    }
  }
  return null;
}

/**
 * R2-N1 / R3-N4: the relayer's GENERIC `relay_failed` without a signature — the one answer that
 * mixes a preflight refusal (a stale root among them) with a transport failure after the node took
 * the tx. Task 3 disposes it `reconcile` (`forwarded: 'unknown'`); this is the ONE place the flow
 * recognises it. An unreadable 4xx (`recognised: false`) and every specific code are not it.
 */
export function a0IsGenericRelayFailed(r: A0SubmitResult): boolean {
  return r.outcome === 'relay_failed' && r.txSignature === null && r.forwarded === 'unknown' && r.recognised;
}

/**
 * R3-N4: after a generic signature-less `relay_failed` and ONE re-sync, the tx can never land — and
 * the note may go back to `unspent` at once — only when ALL THREE hold: (a) the sync is complete
 * (our root is the account's newest, `rootHistory[rootHistoryHead]`); (b) the proof's root is no
 * longer in `rootHistory` (a root never re-enters it, so the program refuses that proof forever);
 * (c) no synced tx carries the note's nullifier (`matchSpent` attributed none). Pure.
 */
export function a0RelayFailedNeverLands(tree: A0VerifiedTree, proofRoot: string, nullifierSynced: boolean): boolean {
  const complete = tree.root === tree.account.rootHistory[tree.account.rootHistoryHead];
  const rootGone = !tree.account.rootHistory.includes(proofRoot);
  return complete && rootGone && !nullifierSynced;
}

/** What "Another address" turned out to be when it is this seed's (m-5): a registry role, or none. */
export interface A0OwnAccount {
  scheme: string;
  role: A0AccountRole | null;
}

/**
 * m-5 / the controller's ruling: is `owner` an account of this seed? Its registry entry (with its
 * role) first; else the seed set (`cli`, `slip10:0`); else `slip10:0 … A0_EXTERNAL_SEED_SCAN_LAST`
 * derived locally (no request). Null: not one of them — an external address.
 */
export function a0OwnAccountOf(seed: Uint8Array, owner: string, bound: A0StoreBinding): A0OwnAccount | null {
  const entry = openA0AccountRegistry(seed, {bound}).find(e => e.address === owner);
  if (entry !== undefined) {
    return {scheme: entry.scheme, role: entry.role};
  }
  if (a0AccountAddress(seed, {kind: 'cli'}) === owner) {
    return {scheme: 'cli', role: null};
  }
  for (let n = 0; n <= A0_EXTERNAL_SEED_SCAN_LAST; n++) {
    if (a0AccountAddress(seed, {kind: 'slip10', account: n}) === owner) {
      return {scheme: `slip10:${n}`, role: null};
    }
  }
  return null;
}

function ownAccountRefusal(own: A0OwnAccount): A0UnshieldError {
  if (own.role === 'main') {
    return new A0UnshieldError('E_A0_UNSHIELD_DESTINATION', `that address is your main account (${own.scheme}): choose "My main account"`);
  }
  if (own.role !== null) {
    return new A0UnshieldError(
      'E_A0_UNSHIELD_DESTINATION',
      `that address is an account of this wallet not offered as a destination (${own.scheme}, ${own.role})`,
    );
  }
  return new A0UnshieldError('E_A0_UNSHIELD_DESTINATION', `that address is an account of this wallet not offered as a destination (${own.scheme})`);
}

async function assertDevnet(connection: Connection): Promise<void> {
  const genesis = await connection.getGenesisHash();
  if (genesis !== A0.genesisHash) {
    throw new A0UnshieldError('E_A0_UNSHIELD_CLUSTER', `the RPC's genesis hash is ${genesis}, not devnet's`);
  }
}

function pathOf(tree: A0VerifiedTree, note: A0Note): A0MerklePath {
  const i = note.leafIndex;
  if (i === undefined || tree.leaves[i] !== note.commitment) {
    throw new A0UnshieldError('E_A0_UNSHIELD_NOTE_LEAF', `the note's leaf ${String(i)} is not its commitment in the verified tree`);
  }
  return a0MerklePath(tree, i);
}

function canonicalOwner(owner: string): string {
  let k: PublicKey;
  try {
    k = new PublicKey(owner);
  } catch {
    throw new A0UnshieldError('E_A0_UNSHIELD_DESTINATION', 'the destination is not a public key');
  }
  if (k.toBase58() !== owner || !PublicKey.isOnCurve(k.toBytes())) {
    throw new A0UnshieldError('E_A0_UNSHIELD_DESTINATION', 'the destination is not a wallet address (canonical, on the Ed25519 curve)');
  }
  return owner;
}

const verifierKind = (intent: A0PendingUnshield, registry: readonly A0AccountEntry[] | null): A0DestinationKind => {
  if (intent.destination === 'fresh') {
    return registry?.find(e => e.scheme === intent.scheme)?.role === 'fresh-exit' ? 'fresh-exit' : 'fresh-pending';
  }
  return intent.destination;
};

/** Does `tx` name `address` or its ATA at all (destination, create-ATA owner, transfer, any listed key)? */
function txNames(tx: A0SyncedTx, address: string): boolean {
  const ata = a0AtaOf(new PublicKey(address)).toBase58();
  return tx.preBalances.some(p => p.address === address || p.address === ata);
}

/** A landed exit to the reserved `scheme`: promoted (and `linked` when a seed key signed). */
function promoteOrAdd(scheme: string, linked: boolean, seed: Uint8Array, bound: A0StoreBinding): void {
  try {
    promoteA0FreshAccount(scheme, {bound, linked});
  } catch (e) {
    if (!(e instanceof A0AccountRegistryError && e.code === 'E_A0_ACCOUNTS_UNKNOWN')) {
      throw e;
    }
    // the reservation is gone (released by a stale reading, or a restore rebuilt the registry): the exit is ours
    const s = parseA0Scheme(scheme);
    if (s === null || s.kind !== 'slip10') {
      throw e;
    }
    addA0RecoveredExitAccounts([s.account], seed, {bound});
    if (linked) {
      promoteA0FreshAccount(scheme, {bound, linked});
    }
  }
}

const stillPendingUnshield = (rho: string, bound: A0StoreBinding): A0Note | null => {
  if (!hasA0NoteRecord(bound)) {
    return null;
  }
  const n = loadA0NoteStore(bound).notes.find(m => m.rho === rho);
  return n !== undefined && n.status === 'pending' && n.pendingSince !== undefined ? n : null;
};

type Settled =
  | {kind: 'verified'; signature: string; changeLeafIndex: number; changeAmount: bigint; grantLamports: bigint | null; destinationWithoutSol: boolean}
  | {kind: 'unverified'; signature: string; code: A0VerifyRefusal; detail: string; changeRecorded: boolean; linked: boolean}
  | {kind: 'recovered'; signature: string; changeRecorded: boolean}
  | {kind: 'not-ours'; signature: string; code: A0VerifyRefusal; detail: string};

interface SettleContext {
  handle: A0Handle;
  seed: Uint8Array;
  bound: A0StoreBinding;
  note: A0Note;
  /** null: a pending unshield stored without its intent — Task 5's recovery rules only */
  intent: A0PendingUnshield | null;
  /** the relayed signature (the flow), or null (found by the reconciliation) */
  txSignature: string | null;
  /** the change commitment Rust proved (the flow, public input 5), or null (recomputed by Rust) */
  changeCommitment: string | null;
}

/** Which of `tx`'s Withdraw nullifiers is `rho`'s (local matchSpent calls); null when none. */
async function ourNullifier(handle: A0Handle, tx: A0SyncedTx, rho: string): Promise<string | null> {
  for (const n of tx.withdrawNullifiers) {
    const a = await a0MatchSpent(handle, [n], [rho]);
    if (a.length === 1 && a[0] === 0) {
      return n;
    }
  }
  return null;
}

/** §6 step 8 + the controller's refusal semantics, for the tx that may spend `ctx.note`. */
async function settleLanded(tx: A0SyncedTx, ctx: SettleContext): Promise<Settled> {
  const {handle, seed, bound, note, intent} = ctx;
  const answer = await a0MatchSpent(handle, [...tx.withdrawNullifiers], [note.rho]);
  const attributed = answer.length === 1 && answer[0] === 0;
  const nullifier = attributed ? await ourNullifier(handle, tx, note.rho) : null;
  const withdrawal = nullifier === null ? undefined : tx.withdrawals.find(w => w.nullifier === nullifier);

  if (intent === null) {
    // a pending unshield stored without its intent: recovery's rules (§7 "Change notes") alone
    if (nullifier === null) {
      throw new A0UnshieldError('E_A0_UNSHIELD_NOTE_LEAF', `${tx.signature} does not spend the note`);
    }
    let change: A0ChangeNote | null = null;
    const amount = withdrawal ? a0ChangeAmount(note.amount, withdrawal.amount, withdrawal.fee) : null;
    if (withdrawal && amount !== null) {
      const rho = a0ChangeRho(nullifier);
      const cm = await a0Commitment(handle, amount, rho);
      const leaves = tx.leafInserted.filter(l => l.commitment === cm);
      if (cm === withdrawal.changeCommitment && leaves.length === 1) {
        change = {commitment: cm, amount, rho, leafIndex: leaves[0]!.leafIndex};
      }
    }
    settleA0Unshield(note.rho, tx.signature, change, bound);
    return {kind: 'recovered', signature: tx.signature, changeRecorded: change !== null};
  }

  const changeAmount = a0ChangeAmount(note.amount, intent.amount, intent.fee)!;
  const expectedChange =
    ctx.changeCommitment ?? (nullifier !== null ? await a0Commitment(handle, changeAmount, a0ChangeRho(nullifier)) : null);
  const seedPublicKeys = a0SeedPublicKeys(seed, {bound});
  // Task 2's carry: the reservation may have been released (blindly) before the landing showed up.
  // The reserved account is still ours — re-derived from the seed, never taken from the store alone.
  const reservedScheme = intent.destination === 'fresh' && intent.scheme !== undefined ? parseA0Scheme(intent.scheme) : null;
  if (reservedScheme !== null && !seedPublicKeys.includes(intent.owner) && a0AccountAddress(seed, reservedScheme) === intent.owner) {
    seedPublicKeys.push(intent.owner);
  }
  const registry = loadA0AccountRegistry({bound});
  const verdict = verifyLandedUnshield(tx, {
    txSignature: ctx.txSignature,
    quote: {feePayer: intent.feePayer, gasGrantLamports: intent.gasGrantLamports},
    authorization: {owner: intent.owner, ata: a0AtaOf(new PublicKey(intent.owner)).toBase58(), amount: intent.amount, fee: intent.fee},
    destinationKind: verifierKind(intent, registry),
    seedPublicKeys,
    // never compared when the tx is not ours (the verifier refuses on the nullifier first)
    changeCommitment: expectedChange ?? '',
    noteMatch: {chainNullifiers: tx.withdrawNullifiers, answer},
  });
  if (nullifier === null) {
    // the relayer's tx does not spend this note: nothing about the note is decided by it
    return {
      kind: 'not-ours',
      signature: tx.signature,
      code: verdict.ok ? 'E_A0_VERIFY_NULLIFIER' : verdict.code,
      detail: verdict.ok ? 'matchSpent does not attribute the spend to the note' : verdict.detail,
    };
  }
  const changeRho = a0ChangeRho(nullifier);
  if (verdict.ok) {
    settleA0Unshield(
      note.rho,
      tx.signature,
      {commitment: verdict.changeLeaf.commitment, amount: changeAmount, rho: changeRho, leafIndex: verdict.changeLeaf.leafIndex},
      bound,
    );
    if (intent.destination === 'fresh') {
      promoteOrAdd(intent.scheme!, false, seed, bound);
    }
    return {
      kind: 'verified',
      signature: tx.signature,
      changeLeafIndex: verdict.changeLeaf.leafIndex,
      changeAmount,
      grantLamports: verdict.grantLamports,
      destinationWithoutSol: verdict.destinationWithoutSol,
    };
  }
  // REFUSED, but the tx spends our note: chain truth for the note, ours-only for the change
  const leaves = tx.leafInserted.filter(l => l.commitment === expectedChange);
  const change: A0ChangeNote | null =
    leaves.length === 1 && withdrawal?.changeCommitment === expectedChange
      ? {commitment: expectedChange!, amount: changeAmount, rho: changeRho, leafIndex: leaves[0]!.leafIndex}
      : null;
  settleA0Unshield(note.rho, tx.signature, change, bound);
  let linked = false;
  if (intent.destination === 'fresh') {
    linked = verdict.code === 'E_A0_VERIFY_SEED_SIGNER';
    if (linked || txNames(tx, intent.owner)) {
      promoteOrAdd(intent.scheme!, linked, seed, bound);
    } else {
      releaseA0FreshAccount(intent.scheme!, {bound});
    }
  }
  return {kind: 'unverified', signature: tx.signature, code: verdict.code, detail: verdict.detail, changeRecorded: change !== null, linked};
}

/** The `pending` reason for a `reconcile` disposition, held by the compiler (no cast); anything else is `unknown`. */
function pendingReasonOf(r: A0SubmitResult): 'unconfirmed' | 'already_spent' | 'relay_failed' | 'unknown' {
  switch (r.outcome) {
    case 'unconfirmed':
    case 'already_spent':
    case 'relay_failed':
    case 'unknown':
      return r.outcome;
    default:
      return 'unknown';
  }
}

function outcomeOf(s: Settled): A0UnshieldOutcome {
  switch (s.kind) {
    case 'verified':
      return {
        status: 'spent',
        signature: s.signature,
        changeLeafIndex: s.changeLeafIndex,
        changeAmount: s.changeAmount,
        grantLamports: s.grantLamports,
        destinationWithoutSol: s.destinationWithoutSol,
      };
    case 'unverified':
      return {
        status: 'landed-unverified',
        signature: s.signature,
        code: s.code,
        detail: s.detail,
        note: 'spent',
        changeRecorded: s.changeRecorded,
        linked: s.linked,
      };
    case 'not-ours':
      return {status: 'landed-unverified', signature: s.signature, code: s.code, detail: s.detail, note: 'pending', changeRecorded: false, linked: false};
    case 'recovered':
      // the flow always holds its intent; only the reconciliation of an intent-less note gets here
      return {status: 'pending', signature: s.signature, reason: 'not-in-sync'};
  }
}

// ------------------------------------------------------------------ the unshield

/**
 * §6 steps 1–9, one unshield (see the module comment). `seed` (64 bytes) is CONSUMED — zero-filled
 * on every path. Throws before anything was sent (a refusal: the note untouched, a reservation it
 * made released); after the pending write only a note-store / registry refusal still throws.
 */
export async function unshieldA0(
  connection: Connection,
  seed: Uint8Array,
  request: A0UnshieldRequest,
  options: A0UnshieldOptions = {},
): Promise<A0UnshieldOutcome> {
  if (running) {
    seed.fill(0);
    throw new A0UnshieldError('E_A0_UNSHIELD_BUSY', 'another unshield is in flight');
  }
  running = true;
  const bound = options.bound ?? mmkvSecure();
  const now = options.now ?? Date.now;
  const onStage = options.onStage ?? (() => undefined);
  let reserved: string | null = null;
  let pendingWritten = false;
  let heldRho: string | null = null;
  let handle: A0Handle | null = null;
  try {
    const amount = request.amount;
    if (typeof amount !== 'bigint' || amount < 1n || amount > U64_MAX) {
      throw new A0UnshieldError('E_A0_UNSHIELD_AMOUNT', `amount ${String(amount)} is not 1..2^64-1 base units`);
    }
    if (!isProverSupported()) {
      throw new A0UnshieldError('E_A0_UNSHIELD_UNSUPPORTED', 'the on-device prover is not available');
    }
    if (!hasA0NoteRecord(bound)) {
      throw new A0UnshieldError('E_A0_UNSHIELD_NOT_READY', 'no A0 note record yet: the startup restore has not run');
    }
    loadA0NoteStore(bound); // CORRUPT throws here, before any request
    await assertDevnet(connection);
    const {zkeyPath, wasmPath} = await ensureA0KeyFiles('withdraw_change', options.io ?? rnfsAssetIO);
    const scheme = loadTransparentScheme();
    const mainOwner = openA0AccountRegistry(seed, {bound}).find(e => e.role === 'main')!.address;

    onStage('sync');
    let tree = (await syncA0Tree(connection, options.sync)).tree;
    onStage('quote');
    let quote = await fetchA0RelayerQuote(connection, {transport: options.transport, now});
    const source = a0UnshieldSource(loadA0NoteStore(bound).notes, quote.fee);
    if (source === null) {
      throw new A0UnshieldError('E_A0_UNSHIELD_NO_NOTE', `no unspent note covers the fee ${quote.fee} and one base unit`);
    }
    if (amount > source.maxAmount) {
      throw new A0UnshieldError('E_A0_UNSHIELD_AMOUNT', `at most ${source.maxAmount} from one note (the fee ${quote.fee} comes out of it)`);
    }
    const note = source.note;
    let path = pathOf(tree, note);

    // m-2 / R2-N2: a discarded probe of the chain clock BEFORE any prompt — a dead clock refuses
    // here, with no dialog and no reservation. It is never the anchor (that is read just before the
    // pending write).
    if ((await a0ChainTime(connection)) === null) {
      throw new A0UnshieldError('E_A0_UNSHIELD_CLOCK', 'the cluster gives no block time for its current slot or the 4 before it');
    }

    // §6 step 1: the destination
    const offer = a0UnshieldDestinationOffer(quote, scheme);
    let owner: string;
    const kind = request.destination.kind;
    if (kind === 'fresh') {
      if (!offer.fresh.available) {
        throw new A0UnshieldError('E_A0_UNSHIELD_DESTINATION', `no fresh account: ${offer.fresh.reason}`);
      }
      // reserved when the user proceeds to the confirmation (I-5): a second unshield takes the next index
      const entry = await reserveA0FreshAccount(connection, seed, {bound});
      reserved = entry.scheme;
      liveSchemes.add(entry.scheme);
      owner = entry.address;
    } else if (kind === 'main') {
      owner = mainOwner;
    } else if (kind === 'external') {
      owner = canonicalOwner(request.destination.owner);
      // m-5 + the controller's ruling: classified BEFORE anything is sent — a key of this seed (the
      // seed set or slip10:0 … 20) is never `external`, so the verifier's ARGS rule never fires on
      // our own classification
      // (registry ∪ cli ∪ slip10:0 … 20 covers a0SeedPublicKeys: registry ∪ cli ∪ slip10:0)
      const own = a0OwnAccountOf(seed, owner, bound);
      if (own !== null) {
        throw ownAccountRefusal(own);
      }
    } else {
      throw new A0UnshieldError('E_A0_UNSHIELD_DESTINATION', 'unknown destination');
    }
    heldRho = note.rho;
    liveRhos.add(note.rho);

    handle = await a0KeysOpen(seed.slice());
    for (let round = 1; ; round++) {
      if (round > A0_UNSHIELD_MAX_ROUNDS) {
        throw new A0UnshieldError('E_A0_UNSHIELD_ROUNDS', `${A0_UNSHIELD_MAX_ROUNDS} confirmations without a submit`);
      }
      // Rust holds ONE authorization: every earlier round ended in a prove, which consumed its own
      // (§3: every prove consumes the live authorization first), so this dialog can succeed.
      onStage('approval');
      const approval = await confirmA0Unshield(handle, {owner, amount, fee: quote.fee});
      onStage('proof');
      const witness = JSON.stringify({
        merkleRoot: path.root,
        inputAmount: note.amount.toString(),
        rho: note.rho,
        pathElements: path.pathElements,
        pathIndices: path.pathIndices,
      });
      // The proof and the payload carry the in-flight nullifier (public input [1]): they live only
      // in this holder, which is emptied as soon as the submit returns (R12).
      const flight: {proof: A0Proof | null; payload: A0WithdrawChangePayload | null} = {proof: null, payload: null};
      flight.proof = await a0Prove(handle, 'withdraw_change', witness, approval.authId, zkeyPath, wasmPath);
      // §6 step 6: the five public inputs JS can recompute, else E_A0_SUBMIT_PUBLIC_INPUTS (nothing sent)
      flight.payload = buildA0WithdrawChangePayload(
        flight.proof,
        {owner: approval.owner, ata: approval.ata, amount, fee: quote.fee, merkleRoot: BigInt(`0x${path.root}`)},
        quote,
      );
      flight.proof = null;
      const changeCommitment = flight.payload.changeCommitment;

      // §6 step 7: the re-quote
      if (a0QuoteExpired(quote, now())) {
        onStage('quote');
        const again = await fetchA0RelayerQuote(connection, {transport: options.transport, now});
        if (!a0QuoteTermsUnchanged(quote, again)) {
          quote = again; // the proof is discarded with this round's locals; a NEW confirmation follows
          if (amount + quote.fee > note.amount) {
            throw new A0UnshieldError('E_A0_UNSHIELD_TERMS', `the new fee ${quote.fee} leaves less than ${amount} in the note`);
          }
          if (kind === 'fresh' && quote.gasGrantLamports === null) {
            throw new A0UnshieldError('E_A0_UNSHIELD_TERMS', 'the relayer no longer grants SOL: no fresh account');
          }
          continue;
        }
        quote = again;
      }

      relayerUrl('submit', options.transport?.base); // a refused base throws here, before the pending write
      // R2-N2: THE anchor — the last chain time read before the request leaves (re-read after a hold)
      const pendingSince = await a0ChainTime(connection);
      if (pendingSince === null) {
        throw new A0UnshieldError('E_A0_UNSHIELD_CLOCK', 'the cluster gave no block time for its current slot or the 4 before it');
      }
      const intent: A0PendingUnshield = {
        owner: approval.owner,
        amount,
        fee: quote.fee,
        feePayer: quote.feePayer,
        gasGrantLamports: quote.gasGrantLamports,
        destination: kind,
        ...(reserved !== null ? {scheme: reserved} : {}),
      };
      const pub = {owner: approval.owner, ata: approval.ata, amount, fee: quote.fee, destination: kind};
      markA0PendingUnshield(note.rho, pendingSince, intent, bound);
      pendingWritten = true;
      // M1c Task 9 / Task 8 review M-2: the `submit` stage starts AT the pending write — from here on
      // the unshield may stand, so a throw inside a hold (or anywhere before the request) is never
      // read as "nothing was sent" by the run screen, whose `recorded` flag is set on `submit`
      onStage('submit');
      const heldMs = options.holdMs?.() ?? 0;
      const quoted = quote;
      // the checkpoint's context (devnet readout gate only; R2-N3: the registry, never the seed set)
      readA0UnshieldSubmitting(pub, () => ({
        feePayer: quoted.feePayer,
        gasGrantLamports: quoted.gasGrantLamports,
        walletKind: scheme.kind,
        registry: loadA0AccountRegistry({bound}) ?? [],
        heldMs,
      }));
      if (heldMs > 0) {
        await sleep(heldMs);
        // m-1 / R2-N2: the window counts from the last chain time before the request leaves. A null
        // or failing re-read KEEPS the earlier anchor and never fails the unshield.
        let later: number | null = null;
        try {
          later = await a0ChainTime(connection);
        } catch {
          later = null;
        }
        if (later !== null) {
          refreshA0PendingSince(note.rho, later, bound);
        }
      }
      let result: A0SubmitResult;
      try {
        result = await submitA0WithdrawChange(flight.payload, options.transport);
      } catch (e) {
        // only the URL refusal proves nothing was sent; any other throw may follow a request that
        // left — the note STAYS pending and the reservation kept (unknown is never "not sent")
        if (e instanceof A0RelayerUrlError) {
          revertA0PendingUnshield(note.rho, bound);
          pendingWritten = false;
        }
        throw e;
      } finally {
        flight.payload = null; // the in-flight nullifier's last reference (R12)
      }
      const disposition = a0SubmitDisposition(result);

      if (disposition === 'not-forwarded') {
        // certainly not forwarded: a specific refusal code, or an unreadable 4xx (R1-C1)
        revertA0PendingUnshield(note.rho, bound);
        pendingWritten = false;
        if (reserved !== null) {
          releaseA0FreshAccount(reserved, {bound});
          liveSchemes.delete(reserved); // the finally no longer sees it (fix round 1, M-2)
          reserved = null;
        }
        const out: A0UnshieldOutcome = {status: 'not-sent', outcome: result.outcome};
        readA0UnshieldOutcome(pub, out);
        return out;
      }
      if (disposition === 'reconcile' && a0IsGenericRelayFailed(result)) {
        // R3-N4: the generic signature-less relay_failed (a stale root IS this answer). Re-sync ONCE;
        // revert at once — and take a new path and a NEW confirmation (§6 step 7) — only when the
        // chain proves the tx can never land. Anything else (a failed sync included) stays pending.
        onStage('sync');
        let neverLands = false;
        try {
          const again = (await syncA0Tree(connection, options.sync)).tree;
          const nullifiers = [...new Set(again.txs.flatMap(t => t.withdrawNullifiers))];
          const hit = nullifiers.length > 0 ? await a0MatchSpent(handle, nullifiers, [note.rho]) : [];
          neverLands = a0RelayFailedNeverLands(again, path.root, hit.length > 0);
          if (neverLands) {
            tree = again;
          }
        } catch {
          neverLands = false;
        }
        if (neverLands) {
          revertA0PendingUnshield(note.rho, bound);
          pendingWritten = false;
          path = pathOf(tree, note);
          continue;
        }
      }
      if (disposition === 'reconcile') {
        const out: A0UnshieldOutcome = {
          status: 'pending',
          signature: result.txSignature,
          reason: pendingReasonOf(result),
        };
        readA0UnshieldOutcome(pub, out);
        return out;
      }

      // verify: the relayed signature from the SYNC (I3), retried for RPC lag (I-2)
      onStage('confirm');
      const signature = result.txSignature as string;
      const retries = options.confirmSyncRetries ?? A0_CONFIRM_SYNC_RETRIES;
      let landed: A0SyncedTx | null = null;
      let detail: string | undefined;
      try {
        for (let k = 0; k <= retries && landed === null; k++) {
          if (k > 0) {
            await sleep(options.confirmSyncDelayMs ?? A0_CONFIRM_SYNC_DELAY_MS);
          }
          landed = (await syncA0Tree(connection, options.sync)).tree.txs.find(t => t.signature === signature) ?? null;
        }
      } catch (e) {
        detail = e instanceof Error ? e.message : String(e);
      }
      if (landed === null) {
        const out: A0UnshieldOutcome = {status: 'pending', signature, reason: 'not-in-sync', ...(detail ? {detail} : {})};
        readA0UnshieldOutcome(pub, out);
        return out;
      }
      const settled = await settleLanded(landed, {handle, seed, bound, note, intent, txSignature: signature, changeCommitment});
      const out = outcomeOf(settled);
      readA0UnshieldOutcome(pub, out);
      return out;
    }
  } catch (e) {
    if (reserved !== null && !pendingWritten) {
      try {
        releaseA0FreshAccount(reserved, {bound});
      } catch {
        // the store changed under us: the new wallet's registry is not ours to touch
      }
    }
    throw e;
  } finally {
    if (handle !== null) {
      await a0KeysClose(handle).catch(() => undefined);
    }
    seed.fill(0);
    if (heldRho !== null) {
      liveRhos.delete(heldRho);
    }
    if (reserved !== null) {
      liveSchemes.delete(reserved);
    }
    running = false;
  }
}

// ------------------------------------------------------------------ the reconciliation

/** Whether the bound store holds a pending unshield (no first-run write; no record → false). */
export function a0HasPendingUnshields(bound?: A0StoreBinding): boolean {
  // a note a flow in this process holds is the flow's to settle: the reconciliation skips it, so it
  // needs no keychain read (fix round 1, M-6)
  return (
    hasA0NoteRecord(bound) &&
    loadA0NoteStore(bound).notes.some(n => n.status === 'pending' && n.pendingSince !== undefined && !liveRhos.has(n.rho))
  );
}

export interface A0UnshieldReconcileReport {
  settled: {rho: string; signature: string; verified: boolean; code: A0VerifyRefusal | null; changeRecorded: boolean}[];
  /** not landed within the chain-time window: back to unspent */
  reverted: {rho: string}[];
  stillPending: {rho: string; reason: 'in-window' | 'no-clock' | 'not-ours'}[];
  /** held by a flow in this process, or settled elsewhere while this run reached them */
  skipped: number;
  /** fresh reservations released (a reverted unshield's, or one no pending unshield names) */
  released: string[];
  /** fresh reservations promoted by a landed exit */
  promoted: string[];
}

/**
 * §6 step 8 "unconfirmed / already_spent: reconcile through the tree sync" (see the module
 * comment). `seed` is consumed (zero-filled) when given; it is required when a pending unshield
 * exists (matchSpent needs the keys, the verifier the seed's public keys) — `null` is enough for a
 * run that finds none (the hook's "Check again" without a keychain read).
 */
export async function reconcileA0PendingUnshields(
  connection: Connection,
  seed: Uint8Array | null,
  options: {sync?: A0SyncOptions; bound?: A0StoreBinding} = {},
): Promise<A0UnshieldReconcileReport> {
  const bound = options.bound ?? mmkvSecure();
  const report: A0UnshieldReconcileReport = {settled: [], reverted: [], stillPending: [], skipped: 0, released: [], promoted: []};
  try {
    if (!hasA0NoteRecord(bound)) {
      return report;
    }
    const all = loadA0NoteStore(bound).notes.filter(n => n.status === 'pending' && n.pendingSince !== undefined);
    const pending = all.filter(n => !liveRhos.has(n.rho));
    report.skipped += all.length - pending.length;
    // fix round 1 (I-1): the store is read AGAIN each time — a flow that writes its pending unshield
    // while this run awaits the chain names its reservation, and it must not be swept
    const orphansOf = (): A0AccountEntry[] => {
      if (!hasA0AccountRegistry({bound})) {
        return [];
      }
      const named = new Set(
        loadA0NoteStore(bound)
          .notes.filter(n => n.status === 'pending' && n.pendingSince !== undefined)
          .map(n => n.unshield?.scheme)
          .filter((s): s is string => s !== undefined),
      );
      return (loadA0AccountRegistry({bound}) ?? []).filter(e => e.role === 'fresh-pending' && !liveSchemes.has(e.scheme) && !named.has(e.scheme));
    };
    if (pending.length === 0 && orphansOf().length === 0) {
      return report; // nothing to decide: no request at all
    }
    if (pending.length > 0 && seed === null) {
      throw new A0UnshieldError('E_A0_UNSHIELD_NEEDS_SEED', `${pending.length} pending unshields need the keys to be reconciled`);
    }
    // the clock FIRST: the sync below completes after it, so "no Withdraw" is a statement about a
    // history that reaches past pendingSince + the window
    const chainNow = pending.length > 0 ? await a0ChainTime(connection) : null;
    const {tree} = await syncA0Tree(connection, options.sync);
    if (pending.length > 0) {
      const handle = await a0KeysOpen(seed!.slice());
      try {
        const nullifiers = [...new Set(tree.txs.flatMap(t => t.withdrawNullifiers))];
        for (const n of pending) {
          const note = stillPendingUnshield(n.rho, bound);
          if (note === null) {
            report.skipped += 1;
            continue;
          }
          const hit = nullifiers.length > 0 ? await a0MatchSpent(handle, nullifiers, [note.rho]) : [];
          let landed: A0SyncedTx | null = null;
          if (hit.length === 1 && hit[0] === 0) {
            for (const t of tree.txs) {
              if (t.withdrawNullifiers.length > 0 && (await ourNullifier(handle, t, note.rho)) !== null) {
                landed = t;
                break;
              }
            }
          }
          if (stillPendingUnshield(n.rho, bound) === null) {
            report.skipped += 1;
            continue; // settled elsewhere while this run read the chain
          }
          if (landed !== null) {
            const s = await settleLanded(landed, {
              handle,
              seed: seed!,
              bound,
              note,
              intent: note.unshield ?? null,
              txSignature: null,
              changeCommitment: null,
            });
            if (s.kind === 'not-ours') {
              report.stillPending.push({rho: note.rho, reason: 'not-ours'});
              continue;
            }
            report.settled.push({
              rho: note.rho,
              signature: s.signature,
              verified: s.kind === 'verified',
              code: s.kind === 'unverified' ? s.code : null,
              changeRecorded: s.kind === 'verified' ? true : s.changeRecorded,
            });
            const scheme = note.unshield?.scheme;
            if (scheme !== undefined && loadA0AccountRegistry({bound})?.find(e => e.scheme === scheme)?.role === 'fresh-exit') {
              report.promoted.push(scheme);
            } else if (scheme !== undefined) {
              report.released.push(scheme);
            }
            continue;
          }
          if (chainNow === null) {
            report.stillPending.push({rho: note.rho, reason: 'no-clock'});
            continue;
          }
          if (chainNow <= note.pendingSince! + A0_UNSHIELD_LANDING_WINDOW_S) {
            report.stillPending.push({rho: note.rho, reason: 'in-window'});
            continue;
          }
          revertA0PendingUnshield(note.rho, bound);
          report.reverted.push({rho: note.rho});
          const scheme = note.unshield?.scheme;
          if (scheme !== undefined && releaseA0FreshAccount(scheme, {bound})) {
            report.released.push(scheme);
          }
        }
      } finally {
        await a0KeysClose(handle).catch(() => undefined);
      }
    }
    // reservations no pending unshield names and no flow holds (the app died between the
    // reservation and the pending write — such a tx was never sent): released, unless the synced
    // history names the account (then it is an exit of ours, promoted)
    for (const e of orphansOf()) {
      if (tree.txs.some(t => txNames(t, e.address))) {
        promoteA0FreshAccount(e.scheme, {bound});
        report.promoted.push(e.scheme);
      } else if (releaseA0FreshAccount(e.scheme, {bound})) {
        report.released.push(e.scheme);
      }
    }
  } finally {
    seed?.fill(0);
  }
  readA0UnshieldReconcile(report);
  return report;
}
