/**
 * The M1b checkpoint readout (spec §16 "Checkpoints · M1b"): what the desk script reads off the
 * phone over adb — one logcat line (or a few chunks of one) after a deposit is submitted, after its
 * outcome, and after each startup step (restore + reconciliation). DEVNET BUILD ONLY.
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
 *     from it. It is read out so the checkpoint record shows the gap-limit hazard (20 consecutive
 *     expired or front-run deposits hide every later own deposit from a restore);
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
import type {A0DepositOutcome} from './depositFlow';
import type {A0Note} from './noteStore';
import type {A0StartupState} from './startup';

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

function emit(event: string, fields: {[k: string]: Json}, given: A0ReadoutOptions): void {
  const o = {...testDefaults, ...given};
  if (!(o.enabled ?? a0ReadoutEnabled())) {
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
