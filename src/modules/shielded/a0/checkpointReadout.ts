/**
 * The M1b checkpoint readout (spec §16 "Checkpoints · M1b"): what the desk script reads off the
 * phone over adb — one logcat line (or a few chunks of one) after a deposit is submitted, after its
 * outcome, and after each startup step (restore + reconciliation); since M1c also one line per probe
 * of the `pinnedFetch` on-device control (`pinnedControl.ts`, spec §6.0). DEVNET BUILD ONLY.
 *
 * WHY A LOG LINE. The values the checkpoint judges live in the ENCRYPTED MMKV (the note store,
 * R13's counters in `v1_a0_last_restore`) of a release app, which adb cannot read (no `run-as` on a
 * release build). The desk does not trust the screen either: it compares every value here with
 * the chain (`scripts/m1b-checkpoint/`).
 *
 * ONLY PUBLIC VALUES, BY CONSTRUCTION. Each payload is built field by field from a fixed list —
 * never by spreading a record — so a field added to a note, a stats record or an outcome does not
 * reach the log by accident. What it carries is public on chain once the deposit is broadcast or
 * landed (signature, depositor = the main account, amount, commitment, leaf index, root), or a
 * count / duration / reason / error code. It never carries a rho, a depositIndex, a nullifier, an
 * error message (a message can quote anything), the seed or anything derived from it in Rust.
 * Two counts are named because they look close to that line:
 *   - the restore's `highestHit` (R1-m4 / R2-N4): how far the deposit-counter walk found a hit —
 *     a count of the walk (the counters this wallet used, which its main account's public deposit
 *     history already shows), never attached to a note, so no note's depositIndex can be read
 *     from it. It is read out so the checkpoint record shows the gap-limit hazard (100 consecutive
 *     expired or front-run deposits — S15, was 20 — hide every later own deposit from a restore);
 *   - the reconciliation's `skipped`: the pending notes another flow settled while this run reached
 *     them (they are in none of the three lists).
 *
 * THE GATE. `a0ReadoutEnabled()` is true only in a shielded build on devnet
 * (`FEATURES_SHIELDED=true` and `NETWORK=devnet` — the devnet APK's BuildConfig). The JS bundle is
 * the same in both APKs (Config is read at run time), so this code IS in the production bundle;
 * there the gate is false (`NETWORK=mainnet-beta`, no `FEATURES_SHIELDED`), and the production
 * build never runs the A0 startup or the deposit anyway. The checkpoint proves it three ways: a
 * Jest test under the production config, the production APK's BuildConfig read off the APK, and
 * no readout line in the phone's log after the production app's launch and unlock.
 *
 * FORMAT (the desk parses it; `scripts/m1b-checkpoint/fixtures/readout-sample.txt` is the
 * hand-written contract both sides are tested against):
 *   NOCTURA-A0-READOUT <id> <i>/<n> <chunk>
 * `<id>` = `<session>-<seq>` (session: this process's start time in base 36; seq: 1, 2, …), the
 * chunks of one JSON object in order (logcat truncates a line near 4 KB, so a long one is split).
 */
import {isShieldedEnabled} from '../../../constants/features';
import {NETWORK} from '../../../constants/programs';
import type {KnownNetwork} from '../../../constants/networkGuard';
import type {A0AccountEntry} from './accountRegistry';
import type {A0DepositOutcome} from './depositFlow';
import type {A0Note} from './noteStore';
import type {A0StartupState} from './startup';
import type {A0UnshieldOutcome, A0UnshieldReconcileReport} from './unshieldFlow';

export const A0_READOUT_TAG = 'NOCTURA-A0-READOUT';
export const A0_READOUT_SCHEMA = 'noctura.a0.readout/1';
/** Characters of JSON per logcat line (Android's logger payload limit is ~4 KB). */
export const A0_READOUT_CHUNK = 3000;

/** True only in a shielded build on devnet (the devnet APK). */
export function a0ReadoutEnabled(
  shielded: boolean = isShieldedEnabled(),
  network: KnownNetwork = NETWORK,
): boolean {
  return shielded === true && network === 'devnet';
}

type Json = string | number | boolean | null | Json[] | {[k: string]: Json};

export interface A0ReadoutOptions {
  /** where the lines go (default: console.info → logcat tag ReactNativeJS) */
  sink?: (line: string) => void;
  /** default: a0ReadoutEnabled() */
  enabled?: boolean;
  /** default: new Date() (UTC ISO in the payload) */
  now?: () => Date;
  chunk?: number;
  /** TEST-ONLY: a fixed session id (default: this process's start time) */
  session?: string;
}

const SESSION = Date.now().toString(36);
let seq = 0;
let testDefaults: A0ReadoutOptions = {};

/** TEST-ONLY: reset the counter and the defaults below. */
export function resetA0ReadoutForTests(): void {
  seq = 0;
  testDefaults = {};
}

/** TEST-ONLY: defaults for the call sites' readouts (a capturing sink, the gate forced on). */
export function setA0ReadoutDefaultsForTests(o: A0ReadoutOptions): void {
  testDefaults = o;
}

/** The lines of one readout (no gate, no side effect) — exported for the contract test. */
export function a0ReadoutLines(id: string, payload: {[k: string]: Json}, chunk: number = A0_READOUT_CHUNK): string[] {
  const text = JSON.stringify(payload);
  const n = Math.max(1, Math.ceil(text.length / chunk));
  const lines: string[] = [];
  for (let i = 0; i < n; i++) {
    lines.push(`${A0_READOUT_TAG} ${id} ${i + 1}/${n} ${text.slice(i * chunk, (i + 1) * chunk)}`);
  }
  return lines;
}

/**
 * Whether a readout with these options is written: `o.enabled`, else the test defaults', else the
 * gate (`a0ReadoutEnabled()`). The devnet checkpoint's submit hold (`submitHold.ts`) and the
 * startup step's seed-key derivation (`startup.ts`, R2-N3) use the same answer, so neither can be
 * live where its line would not be written.
 */
export function a0ReadoutActive(o: A0ReadoutOptions = {}): boolean {
  return {...testDefaults, ...o}.enabled ?? a0ReadoutEnabled();
}

function emit(event: string, fields: {[k: string]: Json}, given: A0ReadoutOptions): void {
  const o = {...testDefaults, ...given};
  if (!a0ReadoutActive(given)) {
    return;
  }
  const session = o.session ?? SESSION;
  seq += 1;
  const id = `${session}-${seq}`;
  const payload = {
    schema: A0_READOUT_SCHEMA,
    event,
    session,
    seq,
    at: (o.now ?? (() => new Date()))().toISOString(),
    ...fields,
  };
  const sink = o.sink ?? ((line: string) => console.info(line));
  try {
    for (const line of a0ReadoutLines(id, payload, o.chunk)) {
      sink(line);
    }
  } catch {
    // a readout never breaks the flow it reports on
  }
}

export interface A0ReadoutDeposit {
  signature: string;
  depositor: string;
  amount: bigint;
  commitment: string;
}

/** After the deposit's send was accepted (#21 "submitted") — the kill window opens here. */
export function readA0DepositSubmitted(d: A0ReadoutDeposit, o: A0ReadoutOptions = {}): void {
  emit(
    'deposit-submitted',
    {signature: d.signature, depositor: d.depositor, amount: d.amount.toString(), commitment: d.commitment},
    o,
  );
}

/** The deposit's outcome as `submitA0Deposit` returns it. */
export function readA0DepositOutcome(
  d: Omit<A0ReadoutDeposit, 'signature'>,
  outcome: A0DepositOutcome,
  o: A0ReadoutOptions = {},
): void {
  const f: {[k: string]: Json} = {
    signature: outcome.signature,
    status: outcome.status,
    depositor: d.depositor,
    amount: d.amount.toString(),
    commitment: d.commitment,
  };
  if (outcome.status === 'unspent') {
    f.leafIndex = outcome.leafIndex;
    f.root = outcome.root;
  } else if (outcome.status === 'pending') {
    f.reason = outcome.reason;
  } else {
    f.reason = outcome.reason;
    f.foreignSignature = outcome.foreignSignature;
  }
  emit('deposit-outcome', f, o);
}

/** The store as the desk needs it: counts, the unspent balance, each unspent note's public part. */
function notesFields(notes: () => readonly A0Note[]): {[k: string]: Json} {
  try {
    const all = notes();
    const unspent = all.filter(n => n.status === 'unspent');
    return {
      notes: {
        pending: all.filter(n => n.status === 'pending').length,
        unspent: unspent.length,
        spent: all.filter(n => n.status === 'spent').length,
        unspentBalance: unspent.reduce((s, n) => s + n.amount, 0n).toString(),
        unspentNotes: unspent.map(n => ({leafIndex: n.leafIndex ?? null, commitment: n.commitment, amount: n.amount.toString()})),
      },
    };
  } catch (e) {
    const code = typeof (e as {code?: unknown})?.code === 'string' ? (e as {code: string}).code : null;
    return {notesError: code};
  }
}

/** After the startup step settled (`ready` or `error`); `notes` reads the store (after it). */
export function readA0Startup(state: A0StartupState, notes: () => readonly A0Note[], o: A0ReadoutOptions = {}): void {
  if (state.phase === 'error') {
    emit('startup', {phase: 'error', code: state.code}, o);
    return;
  }
  if (state.phase !== 'ready') {
    return;
  }
  const {restoredBecause, restore: r, reconcile} = state.result;
  emit(
    'startup',
    {
      phase: 'ready',
      restoredBecause,
      restore: r
        ? {
            treeTransactions: r.treeTransactions,
            failedTransactions: r.failedTransactions,
            listedSignatures: r.listedSignatures,
            fetchedTransactions: r.fetchedTransactions,
            syncDurationMs: r.syncDurationMs,
            durationMs: r.durationMs,
            depositIndicesTried: r.depositIndicesTried,
            depositsInHistory: r.depositsInHistory,
            ownNotes: r.ownNotes,
            spentNotes: r.spentNotes,
            foreignRhoHits: r.foreignRhoHits,
            highestHit: r.highestHit,
            finishedAt: r.finishedAt,
            r13TriggerReached: r.r13TriggerReached,
          }
        : null,
      reconcile: {
        confirmed: reconcile.confirmed.map(c => ({leafIndex: c.leafIndex, signature: c.signature})),
        dropped: reconcile.dropped.map(d => ({reason: d.reason})),
        stillPending: reconcile.stillPending.map(p => ({reason: p.reason})),
        skipped: reconcile.skipped,
      },
      ...notesFields(notes),
    },
    o,
  );
}

/** The probe of the M1c `pinnedFetch` on-device control as `pinnedControl.ts` returns it. */
export interface A0ReadoutPinnedProbe {
  probe: 'submit' | 'quote' | 'submit-prefix';
  /** the request's URL (the public API base + a bare path); '' when the base was refused */
  url: string;
  /** the HTTP status the probe got back, or null when it threw */
  status: number | null;
  /** the body's `outcome` if it is one of the contract's twelve; `unrecognised` for another string; else null */
  outcome: string | null;
  threw: boolean;
  /** threw with exactly the pre-fix message "[object Object]" (a rejected response, its status lost) */
  lostStatus: boolean;
  /** threw an SSLPinningError (E004): the pins did not match the host's chain */
  pinFailure: boolean;
  /** probe `quote` only, when the body has the quote's shape; `gasGrantLamports` null = absent */
  quote: {
    programId: string;
    pool: string;
    mint: string;
    feePayer: string;
    maxFee: string;
    minFeeTransfer: string;
    minFeeWithdrawChange: string;
    gasGrantLamports: string | null;
    validForSeconds: number;
  } | null;
}

/**
 * One line per probe of the M1c `pinnedFetch` control (spec §6.0; `pinnedControl.ts`), `run` = the
 * control's run number in this process. Field by field: the quote's fields arrive already checked
 * against their shape (base58 keys, u64 decimal strings), so no server text reaches the log.
 */
export function readA0PinnedControl(run: number, p: A0ReadoutPinnedProbe, o: A0ReadoutOptions = {}): void {
  const q = p.quote;
  emit(
    'pinned-control',
    {
      run,
      probe: p.probe,
      url: p.url,
      status: p.status,
      outcome: p.outcome,
      threw: p.threw,
      lostStatus: p.lostStatus,
      pinFailure: p.pinFailure,
      quote: q
        ? {
            programId: q.programId,
            pool: q.pool,
            mint: q.mint,
            feePayer: q.feePayer,
            maxFee: q.maxFee,
            minFeeTransfer: q.minFeeTransfer,
            minFeeWithdrawChange: q.minFeeWithdrawChange,
            gasGrantLamports: q.gasGrantLamports,
            validForSeconds: q.validForSeconds,
          }
        : null,
    },
    o,
  );
}

/**
 * An unshield's public part (M1c Task 7): the destination owner and its token account, the amount
 * and the fee — what the relayer is sent and the chain shows once it lands — and the destination's
 * kind. Never the nullifier, the proof, the payload, a rho or the registry index.
 */
export interface A0ReadoutUnshield {
  owner: string;
  ata: string;
  amount: bigint;
  fee: bigint;
  destination: 'fresh' | 'main' | 'external';
}

const unshieldFields = (u: A0ReadoutUnshield): {[k: string]: Json} => ({
  owner: u.owner,
  ata: u.ata,
  amount: u.amount.toString(),
  fee: u.fee.toString(),
  destination: u.destination,
});

/**
 * What the M1c checkpoint's desk needs beside the unshield's public part (Task 9), read out ONCE
 * per unshield, on the `unshield-submitting` line:
 *   - `feePayer` / `gasGrantLamports`: the quote the human approved (public: the relayer's quote);
 *   - `walletKind`: `slip10` | `cli` — the KIND of the wallet's scheme, never its index;
 *   - `registry`: the registry at that moment, `{address, role, linked}` in registry order — the
 *     desk reads the destination's role and, for the second fresh unshield of §16 M1c CP2, that
 *     the first's reservation was still `fresh-pending` when the second reserved its own;
 *   - `heldMs`: the devnet checkpoint's one-shot submit hold (`submitHold.ts`; 0 = none).
 * NOT the seed's public-key set (R2-N3): that is read out once per start on `startup-accounts`;
 * this line adds no linkage beyond it. Never the registry's index, the scheme string, a rho or
 * the nullifier.
 */
export interface A0ReadoutUnshieldContext {
  feePayer: string;
  gasGrantLamports: bigint | null;
  walletKind: 'slip10' | 'cli';
  registry: readonly A0AccountEntry[];
  heldMs: number;
}

const registryFields = (entries: readonly A0AccountEntry[]): Json[] =>
  entries.map(e => ({address: e.address, role: e.role, linked: e.linked === true}));

const codeOf = (e: unknown, fallback: string): string =>
  typeof (e as {code?: unknown})?.code === 'string' ? (e as {code: string}).code : fallback;

/**
 * Just before the relayer is asked to submit (the pending unshield is written) — the kill window
 * opens here. `context` is read only when the gate is open (the production build never computes
 * it). A context that throws is reported by its code only (`contextError`, never its message) — a
 * readout never breaks the flow it reports on.
 */
export function readA0UnshieldSubmitting(
  u: A0ReadoutUnshield,
  context: () => A0ReadoutUnshieldContext,
  o: A0ReadoutOptions = {},
): void {
  if (!a0ReadoutActive(o)) {
    return;
  }
  let f: {[k: string]: Json};
  try {
    const c = context();
    f = {
      feePayer: c.feePayer,
      gasGrantLamports: c.gasGrantLamports === null ? null : c.gasGrantLamports.toString(),
      walletKind: c.walletKind,
      registry: registryFields(c.registry),
      heldMs: c.heldMs,
    };
  } catch (e) {
    f = {contextError: codeOf(e, 'E_A0_READOUT_CONTEXT')};
  }
  emit('unshield-submitting', {...unshieldFields(u), ...f}, o);
}

/** The unshield's outcome as `unshieldA0` returns it; a verifier refusal is read out with its code. */
export function readA0UnshieldOutcome(u: A0ReadoutUnshield, out: A0UnshieldOutcome, o: A0ReadoutOptions = {}): void {
  const f: {[k: string]: Json} = {...unshieldFields(u), status: out.status};
  switch (out.status) {
    case 'spent':
      f.signature = out.signature;
      f.changeLeafIndex = out.changeLeafIndex;
      f.grantLamports = out.grantLamports === null ? null : out.grantLamports.toString();
      f.destinationWithoutSol = out.destinationWithoutSol;
      break;
    case 'landed-unverified':
      f.signature = out.signature;
      f.code = out.code;
      f.note = out.note;
      f.changeRecorded = out.changeRecorded;
      f.linked = out.linked;
      break;
    case 'pending':
      f.signature = out.signature;
      f.reason = out.reason;
      break;
    case 'not-sent':
      f.outcome = out.outcome;
      break;
  }
  emit('unshield-outcome', f, o);
}

/** A reconciliation of pending unshields that decided anything (counts, signatures, codes — no rho). */
export function readA0UnshieldReconcile(r: A0UnshieldReconcileReport, o: A0ReadoutOptions = {}): void {
  if (r.settled.length + r.reverted.length + r.stillPending.length + r.released.length + r.promoted.length === 0) {
    return;
  }
  emit(
    'unshield-reconcile',
    {
      settled: r.settled.map(x => ({signature: x.signature, verified: x.verified, code: x.code, changeRecorded: x.changeRecorded})),
      reverted: r.reverted.length,
      stillPending: r.stillPending.map(x => ({reason: x.reason})),
      skipped: r.skipped,
      released: r.released.length,
      promoted: r.promoted.length,
    },
    o,
  );
}

/**
 * After the startup step settled `ready` (M1c Task 9), right after `startup`: a separate event, so
 * M1b's `startup` line — a byte contract with its desk — stays as it is. It carries:
 *   - `accounts`: the registry as stored (`{address, role, linked}`; the desk judges "the fresh
 *     account comes back" from the first one after a wipe); an unreadable registry is reported by
 *     its code only (`accountsError`), never as an empty list; no record yet → null;
 *   - `seedKeys` (R2-N3): the seed's public-key set (registry ∪ `cli` ∪ `slip10:0`), derived by the
 *     startup step with the gate open (`A0StartupResult.seedKeys`) — the desk's "no signer is a key
 *     of this seed" reads it; once per start, so every unshield line after it adds no linkage.
 *     Not derived → null; a derivation that failed → null and its code (`seedKeysError`);
 *   - `restore`: the restore's M1c counters (null without a restore), each named for what it
 *     counts (Task 5 M3 / M7):
 *       `changeNotes`            change notes imported by the restore;
 *       `unmatchedChangeLeaves`  spends of our notes whose change was NOT imported: a Withdraw
 *                                event without its instruction, a change amount below zero, or a
 *                                change commitment that is not ours (three cases, one count);
 *       `attributionCalls`       the attribution's local `matchSpent([n], …)` calls (no request);
 *       `accountIndicesTried`    the `slip10` indices the account walk derived;
 *       `exitAccounts`           the `slip10` indices the walk MATCHED to an exit — index 0 (the
 *                                main) included when a withdrawal went to the main: it is NOT a
 *                                count of fresh accounts.
 * Public values only: addresses and counts, never an index, a scheme string, a rho or a nullifier.
 */
export function readA0StartupAccounts(
  state: A0StartupState,
  accounts: () => readonly A0AccountEntry[] | null,
  o: A0ReadoutOptions = {},
): void {
  if (state.phase !== 'ready' || !a0ReadoutActive(o)) {
    return;
  }
  const r = state.result.restore;
  const seed = state.result.seedKeys;
  let list: Json = null;
  let accountsError: string | null = null;
  try {
    const entries = accounts();
    list = entries === null ? null : registryFields(entries);
  } catch (e) {
    accountsError = codeOf(e, 'E_A0_READOUT_ACCOUNTS');
  }
  emit(
    'startup-accounts',
    {
      restoredBecause: state.result.restoredBecause,
      restore: r
        ? {
            changeNotes: r.changeNotes,
            unmatchedChangeLeaves: r.unmatchedChangeLeaves,
            attributionCalls: r.attributionCalls,
            accountIndicesTried: r.accountIndicesTried,
            exitAccounts: r.exitAccounts,
          }
        : null,
      accounts: list,
      accountsError,
      seedKeys: seed?.keys ? [...seed.keys] : null,
      seedKeysError: seed?.error ?? null,
    },
    o,
  );
}

/**
 * The devnet checkpoint's submit hold (`submitHold.ts`): `armed` by the desk's link, `taken` by an
 * unshield, or `expired` — an arm older than ten minutes found by the next unshield (m-4).
 */
export function readA0SubmitHold(state: 'armed' | 'taken' | 'expired', heldMs: number, o: A0ReadoutOptions = {}): void {
  emit('submit-hold', {state, heldMs}, o);
}
