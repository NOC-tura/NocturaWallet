/**
 * The A0 startup step (the ledger's ruling (2); spec §7 "the note store and the registry become
 * caches", §5 step 7). Once per app session, after the encrypted store is open and the seed is in
 * hand (unlock / onboarding, `secureStorageSession.ts`):
 *   1. NO `v1_a0_notes` record (a fresh install, an import, a wiped app) — or a record that does
 *      not decode — → `restoreA0FromSeed`: the notes come back from the chain. A missing record is
 *      asked with `hasA0NoteRecord()` BEFORE anything reads the store, because the store's first
 *      read writes an empty record (its one-time v1 clear) and an empty record would read as "no
 *      notes" from then on. A restore that fails writes nothing, so the next start restores again;
 *   2. the pending deposits are reconciled (`reconcileA0PendingDeposits`).
 *
 * THE SHIELDED BALANCE IS SHOWN ONLY AFTER THIS (Task 5 (screens)): `a0StartupState().phase === 'ready'`.
 * Before it (`running`) the balance is unknown, and an `error` is shown as such — never as 0.
 *
 * ONE WALLET PER RUN (R1-C1, R2-N1). The state below is per process, and an in-app "Wipe wallet"
 * followed by an import replaces the wallet without a restart. So:
 *   - `resetA0Startup()` (production) runs whenever the encrypted instance is replaced —
 *     `clearAllStores()` and `initSecureMmkv` fire it through `onSecureMmkvReset` — and puts the
 *     state back to `idle` (listeners kept), so the imported wallet's onboarding starts a new run;
 *   - a generation counter makes every continuation of a run started before a reset a no-op: it
 *     never publishes its outcome and never clears a later run's `inFlight`;
 *   - a run captures the encrypted instance ONCE (`mmkvSecure()` at its start) and every store
 *     call it makes — the record check, the first read, the restore's merge and R13 stats, the
 *     reconciliation's confirm / drop — refuses with `E_A0_STORE_CHANGED` when the open instance
 *     is another one, before writing. The onboarding order (instance created → reset hook → run
 *     started) captures the NEW instance, so the import's own run is never refused.
 */
import type {Connection} from '@solana/web3.js';
import {mmkvSecure, onSecureMmkvReset} from '../../../store/mmkv/instances';
import {A0NoteStoreError, hasA0NoteRecord, loadA0NoteStore} from './noteStore';
import type {A0StoreBinding} from './noteStore';
import {restoreA0FromSeed} from './recovery';
import type {A0RestoreStats} from './recovery';
import {reconcileA0PendingDeposits} from './depositFlow';
import type {A0ReconcileReport} from './depositFlow';
import type {A0SyncOptions} from './treeSync';

export interface A0StartupResult {
  /** why a restore ran, or null when the record existed and decoded */
  restoredBecause: 'no-record' | 'corrupt-record' | null;
  restore: A0RestoreStats | null;
  reconcile: A0ReconcileReport;
}

export type A0StartupState =
  | {phase: 'idle'}
  | {phase: 'running'}
  | {phase: 'ready'; result: A0StartupResult}
  | {phase: 'error'; code: string | null; message: string};

/**
 * Steps 1–2. `seed` (64 bytes) is CONSUMED: handed to the restore when one runs, zero-filled
 * otherwise (and in any case on return). Throws `E_A0_STORE_LOCKED` before any request without
 * the encrypted instance, `E_A0_STORE_CHANGED` when the instance captured at its start (or
 * `options.bound`) was replaced before a write; the restore's and the reconciliation's errors
 * pass through.
 */
export async function runA0Startup(
  connection: Connection,
  seed: Uint8Array,
  options: {sync?: A0SyncOptions; bound?: A0StoreBinding} = {},
): Promise<A0StartupResult> {
  try {
    const bound = options.bound ?? mmkvSecure();
    const bind = {...options, bound};
    let restoredBecause: A0StartupResult['restoredBecause'] = null;
    if (!hasA0NoteRecord(bound)) {
      restoredBecause = 'no-record';
    } else {
      try {
        loadA0NoteStore(bound);
      } catch (e) {
        if (!(e instanceof A0NoteStoreError && e.code === 'E_A0_STORE_CORRUPT')) {
          throw e;
        }
        restoredBecause = 'corrupt-record'; // only a recovery replaces it (noteStore)
      }
    }
    const restore = restoredBecause ? (await restoreA0FromSeed(connection, seed, bind)).stats : null;
    const reconcile = await reconcileA0PendingDeposits(connection, bind);
    return {restoredBecause, restore, reconcile};
  } finally {
    seed.fill(0);
  }
}

let state: A0StartupState = {phase: 'idle'};
let inFlight: Promise<A0StartupState> | null = null;
/** moved on by every reset: a run's continuation acts only while it is still its own */
let generation = 0;
const listeners = new Set<(s: A0StartupState) => void>();

function setState(s: A0StartupState): void {
  state = s;
  for (const l of listeners) {
    l(s);
  }
}

/** The session's startup state (for the shielded balance, Task 5 (screens)). */
export function a0StartupState(): A0StartupState {
  return state;
}

/** Subscribe to state changes; returns the unsubscribe. */
export function subscribeA0Startup(listener: (s: A0StartupState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Run the startup step once per session (= per wallet: a reset starts a new one); never rejects
 * (fire-and-forget callers). A call while one runs, or after it succeeded, wipes its `seed` and
 * returns that run's state; a call after a FAILED run tries again (a restore that failed wrote
 * nothing). A run made stale by a reset resolves its own callers with its own outcome but does
 * not publish it: the module state is the later run's.
 */
export function ensureA0Startup(
  connection: Connection,
  seed: Uint8Array,
  options: {sync?: A0SyncOptions} = {},
): Promise<A0StartupState> {
  if (inFlight || state.phase === 'ready') {
    seed.fill(0);
    return inFlight ?? Promise.resolve(state);
  }
  const gen = generation;
  const settle = (outcome: A0StartupState): A0StartupState => {
    if (gen !== generation) {
      return outcome; // stale: a reset came between — publish nothing, leave the later run alone
    }
    setState(outcome);
    inFlight = null;
    return outcome;
  };
  setState({phase: 'running'});
  const run = runA0Startup(connection, seed, options).then(
    (result): A0StartupState => settle({phase: 'ready', result}),
    (e: unknown): A0StartupState => {
      const code = typeof (e as {code?: unknown})?.code === 'string' ? (e as {code: string}).code : null;
      return settle({phase: 'error', code, message: e instanceof Error ? e.message : String(e)});
    },
  );
  inFlight = run;
  return run;
}

/**
 * The wallet changed (the encrypted instance was wiped or replaced): back to `idle`, no run in
 * flight, and every continuation of an earlier run a no-op. The listeners are KEPT (the screens'
 * subscriptions outlive a wallet) and told. Fired by `instances.ts` through `onSecureMmkvReset`.
 */
export function resetA0Startup(): void {
  generation++;
  inFlight = null;
  if (state.phase !== 'idle') {
    setState({phase: 'idle'});
  }
}

onSecureMmkvReset(resetA0Startup);

/** TEST-ONLY: `resetA0Startup` and every listener dropped. */
export function resetA0StartupForTests(): void {
  resetA0Startup();
  listeners.clear();
}
