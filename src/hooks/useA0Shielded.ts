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
import {a0HasPendingUnshields, reconcileA0PendingUnshields} from '../modules/shielded/a0/unshieldFlow';
import type {A0UnshieldReconcileReport} from '../modules/shielded/a0/unshieldFlow';
import type {A0VerifyRefusal} from '../modules/shielded/a0/landedVerifier';
import {a0CheckCaption, a0UnshieldCheckOf} from '../modules/shielded/a0/unshieldCheck';
import type {A0UnshieldCheck} from '../modules/shielded/a0/unshieldCheck';

// the pure readings live in unshieldCheck.ts (no React, no native): re-exported for the screens
export {a0CheckCaption, a0UnshieldCheckOf, a0UnshieldDecisionFor} from '../modules/shielded/a0/unshieldCheck';
export type {A0UnshieldCheck} from '../modules/shielded/a0/unshieldCheck';

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
  | {status: 'done'; report: A0ReconcileReport; unshields: A0UnshieldReconcileReport}
  /** the startup step is running (it reconciles itself): nothing was asked */
  | {status: 'busy'}
  | {status: 'error'; code: string | null; message: string};

let checking: Promise<A0CheckAgainResult> | null = null;

/**
 * The verifier refusal a "Check again" found, for the rest of the session of THIS wallet (bound to
 * the encrypted instance open at the tap): the screen that tapped may be gone before the user looks.
 * The code only — the verifier's detail names keys of this seed and never leaves the flow.
 */
let checkRefusal: {bound: object | null; code: A0VerifyRefusal} | null = null;

/** The refusal of the startup step's reconciliation (code only), or null. */
function startupRefusal(state: A0StartupState): A0VerifyRefusal | null {
  if (state.phase !== 'ready') {
    return null;
  }
  const c = a0UnshieldCheckOf(state.result.unshields);
  return c?.kind === 'unverified' ? c.code : null;
}

/** The fixed text of a check that failed (final review M-4: code + a fixed sentence; the raw message only without a code). */
function checkErrorNote(code: string | null, message: string): string {
  return code ? `${code} · The check could not finish. Check again in a moment.` : message;
}


/**
 * "Check again" on a pending deposit or unshield (R1-m9, R2-N2, R3-N5): the startup
 * reconciliations once more, now. The deposits' needs no seed; the unshields' (M1c) needs the keys
 * only when a pending unshield exists — then, and only then, ONE keychain read (biometric). BOUND to
 * the encrypted instance open at the tap (`{bound: mmkvSecure()}`), so a wipe + import while it
 * runs refuses (`E_A0_STORE_CHANGED`) instead of writing the old wallet's note into the new one.
 * Refused (`busy`) while the startup step is `running`; a tap while one check runs shares it.
 * Never rejects.
 */
export function checkA0PendingAgain(): Promise<A0CheckAgainResult> {
  if (!isShieldedEnabled() || !isProverSupported()) {
    return Promise.resolve({status: 'error', code: null, message: 'Private balances are not available on this device.'});
  }
  if (a0StartupState().phase === 'running') {
    return Promise.resolve({status: 'busy'});
  }
  if (checking) {
    return checking;
  }
  const bound = mmkvSecure();
  const run = (async (): Promise<A0CheckAgainResult> => {
    const report = await reconcileA0PendingDeposits(getConnection(), {bound});
    const seed = a0HasPendingUnshields(bound) ? await mnemonicToSeed(await keychainManager.retrieveSeed()) : null;
    const unshields = await reconcileA0PendingUnshields(getConnection(), seed, {bound});
    const found = a0UnshieldCheckOf(unshields);
    if (found?.kind === 'unverified') {
      checkRefusal = {bound, code: found.code};
    }
    return {status: 'done', report, unshields};
  })().then(
    (r): A0CheckAgainResult => r,
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
  /** what the last check found (an error, still pending, settled, reverted, a refusal) — fixed text, never a raw message with a code */
  note: string | null;
  /** what the last check decided about the pending unshields, all of them (I-1) — for #16 and the dashboard */
  unshield: A0UnshieldCheck | null;
  /** the last check's unshield report (null before one / on an error): #21 reads its own note in it (N-1) */
  report: A0UnshieldReconcileReport | null;
  run: () => void;
}

/**
 * The shielded balance view, live. `refresh` re-reads the store (e.g. on focus after a deposit).
 * `refusal` (I-1): a verifier refusal of a landed unshield that the startup step or a "Check again"
 * in this wallet's session found — the screens show it LOUD, by its code only.
 */
export function useA0Shielded(): {view: A0ShieldedView; refresh: () => void; checkAgain: A0CheckAgain; refusal: A0VerifyRefusal | null} {
  const state = useA0StartupState();
  const [tick, setTick] = useState(0);
  const [view, setView] = useState<A0ShieldedView>(() => a0ShieldedView(state));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [unshield, setUnshield] = useState<A0UnshieldCheck | null>(null);
  const [report, setReport] = useState<A0UnshieldReconcileReport | null>(null);
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
    setUnshield(null);
    setReport(null);
    checkA0PendingAgain().then(r => {
      if (!alive.current) {
        return;
      }
      setBusy(false);
      if (r.status === 'error') {
        setNote(checkErrorNote(r.code, r.message));
      } else if (r.status === 'busy') {
        setNote('Restoring from the chain · check again when it finishes.');
      } else {
        const found = a0UnshieldCheckOf(r.unshields);
        setUnshield(found);
        setReport(r.unshields);
        if (found !== null) {
          setNote(a0CheckCaption(found));
        } else if (r.report.stillPending.length > 0) {
          setNote(a0CheckCaption({kind: 'pending'}));
        }
      }
      refresh(); // the store changed under the view (useA0StartupState only moves on a state change)
    });
  }, [disabled, refresh]);
  const fromCheck = checkRefusal !== null && checkRefusal.bound === mmkvSecure() ? checkRefusal.code : null;
  const refusal = fromCheck ?? startupRefusal(state);
  return {view, refresh, checkAgain: {disabled, checking: busy, note, unshield, report, run}, refusal};
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
