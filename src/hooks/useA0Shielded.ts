import {useCallback, useEffect, useRef, useState} from 'react';
import {a0StartupState, ensureA0Startup, subscribeA0Startup} from '../modules/shielded/a0/startup';
import type {A0StartupState} from '../modules/shielded/a0/startup';
import {loadA0NoteStore} from '../modules/shielded/a0/noteStore';
import {a0ErrorText} from '../modules/shielded/a0/screenSupport';
import {isProverSupported} from '../modules/zkProver/nativeProverBridge';
import {isShieldedEnabled} from '../constants/features';
import {keychainManager} from '../modules/keychain/keychainModule';
import {mnemonicToSeed} from '../modules/keyDerivation/mnemonicUtils';
import {getConnection} from '../modules/solana/connection';
import {mmkvSecure} from '../store/mmkv/instances';
import {reconcileA0PendingDeposits} from '../modules/shielded/a0/depositFlow';
import type {A0ReconcileReport} from '../modules/shielded/a0/depositFlow';

/**
 * The shielded balance as the screens may state it (spec §11; Task 4's rule: the balance is the
 * note store's ONLY once the startup restore/reconcile finished — `a0StartupState().phase ===
 * 'ready'`). Every other state is a state, never a 0:
 *   - unsupported — no shielded in this build, or no on-device prover (non-arm64);
 *   - idle        — the startup step has not run this session (it starts at unlock; Retry runs it);
 *   - running     — restoring / reconciling from the chain;
 *   - error       — the step failed: its code is shown, Retry runs it again (a failed restore wrote
 *                   nothing, so a retry restores again — never an endless spinner);
 *   - ready       — unspent and pending sums from the store (a store read that throws is an error).
 */
export type A0ShieldedView =
  | {kind: 'unsupported'}
  | {kind: 'idle'}
  | {kind: 'running'}
  | {kind: 'error'; code: string | null; message: string}
  | {kind: 'ready'; unspent: bigint; pending: bigint; notes: number};

export function a0ShieldedView(state: A0StartupState): A0ShieldedView {
  if (!isShieldedEnabled() || !isProverSupported()) {
    return {kind: 'unsupported'};
  }
  switch (state.phase) {
    case 'idle':
      return {kind: 'idle'};
    case 'running':
      return {kind: 'running'};
    case 'error':
      return {kind: 'error', code: state.code, message: state.message};
    case 'ready':
      try {
        const {notes} = loadA0NoteStore();
        let unspent = 0n;
        let pending = 0n;
        for (const n of notes) {
          if (n.status === 'unspent') {
            unspent += n.amount;
          } else if (n.status === 'pending') {
            pending += n.amount;
          }
        }
        return {kind: 'ready', unspent, pending, notes: notes.filter(n => n.status === 'unspent').length};
      } catch (e) {
        return {kind: 'error', ...a0ErrorText(e)};
      }
  }
}

/** The startup state, live (subscribed). */
export function useA0StartupState(): A0StartupState {
  const [s, setS] = useState<A0StartupState>(a0StartupState());
  useEffect(() => {
    setS(a0StartupState());
    return subscribeA0Startup(setS);
  }, []);
  return s;
}

export type A0CheckAgainResult =
  | {status: 'done'; report: A0ReconcileReport}
  /** the startup step is running (it reconciles itself): nothing was asked */
  | {status: 'busy'}
  | {status: 'error'; code: string | null; message: string};

let checking: Promise<A0CheckAgainResult> | null = null;

/**
 * "Check again" on a pending deposit (R1-m9, R2-N2, R3-N5): the startup reconciliation once more,
 * now — it needs no seed (no keychain read). BOUND to the encrypted instance open at the tap
 * (`{bound: mmkvSecure()}`), so a wipe + import while it runs refuses (`E_A0_STORE_CHANGED`)
 * instead of writing the old wallet's note into the new one. Refused (`busy`) while the startup
 * step is `running`; a tap while one check runs shares it. Never rejects.
 */
export function checkA0PendingAgain(): Promise<A0CheckAgainResult> {
  if (!isShieldedEnabled() || !isProverSupported()) {
    return Promise.resolve({status: 'error', code: null, message: 'Shielding is not available on this device.'});
  }
  if (a0StartupState().phase === 'running') {
    return Promise.resolve({status: 'busy'});
  }
  if (checking) {
    return checking;
  }
  const bound = mmkvSecure();
  const run = reconcileA0PendingDeposits(getConnection(), {bound}).then(
    (report): A0CheckAgainResult => ({status: 'done', report}),
    (e: unknown): A0CheckAgainResult => ({status: 'error', ...a0ErrorText(e)}),
  );
  checking = run;
  run.finally(() => {
    if (checking === run) {
      checking = null;
    }
  });
  return run;
}

/** The "Check again" control's state, for a screen that shows a pending deposit. */
export interface A0CheckAgain {
  /** while the startup step is running, or a check is in flight */
  disabled: boolean;
  checking: boolean;
  /** what the last check found when it is not visible in the balance (still pending, an error) */
  note: string | null;
  run: () => void;
}

/** The shielded balance view, live. `refresh` re-reads the store (e.g. on focus after a deposit). */
export function useA0Shielded(): {view: A0ShieldedView; refresh: () => void; checkAgain: A0CheckAgain} {
  const state = useA0StartupState();
  const [tick, setTick] = useState(0);
  const [view, setView] = useState<A0ShieldedView>(() => a0ShieldedView(state));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setView(a0ShieldedView(state));
  }, [state, tick]);
  const refresh = useCallback(() => setTick(t => t + 1), []);
  const disabled = busy || state.phase === 'running';
  const run = useCallback(() => {
    if (disabled) {
      return;
    }
    setBusy(true);
    setNote(null);
    checkA0PendingAgain().then(r => {
      if (!alive.current) {
        return;
      }
      setBusy(false);
      if (r.status === 'error') {
        setNote(r.code ? `${r.code} · ${r.message}` : r.message);
      } else if (r.status === 'busy') {
        setNote('Restoring from the chain · check again when it finishes.');
      } else if (r.report.stillPending.length > 0) {
        setNote('Still not confirmed · checked just now.');
      }
      refresh(); // the store changed under the view (useA0StartupState only moves on a state change)
    });
  }, [disabled, refresh]);
  return {view, refresh, checkAgain: {disabled, checking: busy, note, run}};
}

/**
 * Run the startup step again (Retry on an `idle` or `error` view): one keychain read (biometric),
 * the seed's own copy handed over (the step consumes it). Never rejects — a refused keychain read
 * is returned as an error state; the step's own failure is its state.
 */
export async function retryA0Startup(): Promise<A0StartupState> {
  if (!isShieldedEnabled() || !isProverSupported()) {
    return a0StartupState();
  }
  let seed: Uint8Array;
  try {
    seed = await mnemonicToSeed(await keychainManager.retrieveSeed());
  } catch (e) {
    return {phase: 'error', ...a0ErrorText(e)};
  }
  return ensureA0Startup(getConnection(), seed);
}
