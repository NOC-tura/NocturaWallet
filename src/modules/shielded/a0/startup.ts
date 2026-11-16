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
 * THE SHIELDED BALANCE IS SHOWN ONLY AFTER THIS (Task 6): `a0StartupState().phase === 'ready'`.
 * Before it (`running`) the balance is unknown, and an `error` is shown as such — never as 0.
 */
import type {Connection} from '@solana/web3.js';
import {A0NoteStoreError, hasA0NoteRecord, loadA0NoteStore} from './noteStore';
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
 * the encrypted instance; the restore's and the reconciliation's errors pass through.
 */
export async function runA0Startup(
  connection: Connection,
  seed: Uint8Array,
  options: {sync?: A0SyncOptions} = {},
): Promise<A0StartupResult> {
  try {
    let restoredBecause: A0StartupResult['restoredBecause'] = null;
    if (!hasA0NoteRecord()) {
      restoredBecause = 'no-record';
    } else {
      try {
        loadA0NoteStore();
      } catch (e) {
        if (!(e instanceof A0NoteStoreError && e.code === 'E_A0_STORE_CORRUPT')) {
          throw e;
        }
        restoredBecause = 'corrupt-record'; // only a recovery replaces it (noteStore)
      }
    }
    const restore = restoredBecause ? (await restoreA0FromSeed(connection, seed, options)).stats : null;
    const reconcile = await reconcileA0PendingDeposits(connection, options);
    return {restoredBecause, restore, reconcile};
  } finally {
    seed.fill(0);
  }
}

let state: A0StartupState = {phase: 'idle'};
let inFlight: Promise<A0StartupState> | null = null;
const listeners = new Set<(s: A0StartupState) => void>();

function setState(s: A0StartupState): void {
  state = s;
  for (const l of listeners) {
    l(s);
  }
}

/** The session's startup state (for the shielded balance, Task 6). */
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
 * Run the startup step once per session; never rejects (fire-and-forget callers). A call while
 * one runs, or after it succeeded, wipes its `seed` and returns that run's state; a call after a
 * FAILED run tries again (a restore that failed wrote nothing).
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
  setState({phase: 'running'});
  inFlight = runA0Startup(connection, seed, options).then(
    result => {
      setState({phase: 'ready', result});
      inFlight = null;
      return state;
    },
    (e: unknown) => {
      const code = typeof (e as {code?: unknown})?.code === 'string' ? (e as {code: string}).code : null;
      setState({phase: 'error', code, message: e instanceof Error ? e.message : String(e)});
      inFlight = null;
      return state;
    },
  );
  return inFlight;
}

/** TEST-ONLY reset of the session state. */
export function resetA0StartupForTests(): void {
  state = {phase: 'idle'};
  inFlight = null;
  listeners.clear();
}
