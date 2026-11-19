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
 * What a reconciliation decided about the pending unshields (M1c final review I-1), from its report
 * alone, in this order: a verifier refusal (LOUD), something still pending, a settle, a revert.
 * A settle by recovery's rules (no intent: `verified` false with NO code) is a settle, not a
 * refusal. Null when it decided nothing about an unshield.
 */
export type A0UnshieldCheck =
  | {kind: 'unverified'; code: A0VerifyRefusal}
  | {kind: 'pending'}
  | {kind: 'settled'}
  | {kind: 'reverted'};

export function a0UnshieldCheckOf(r: A0UnshieldReconcileReport): A0UnshieldCheck | null {
  const refused = r.settled.find(x => !x.verified && x.code !== null);
  if (refused) {
    return {kind: 'unverified', code: refused.code!};
  }
  if (r.stillPending.length > 0) {
    return {kind: 'pending'};
  }
  if (r.settled.length > 0) {
    return {kind: 'settled'};
  }
  if (r.reverted.length > 0) {
    return {kind: 'reverted'};
  }
  return null;
}

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

const UNSHIELD_CHECK_NOTE: Record<A0UnshieldCheck['kind'], string> = {
  unverified: 'Checked just now · it landed, but failed verification.',
  pending: 'Still not confirmed · checked just now.',
  settled: 'Confirmed · unshielded.',
  reverted: 'Not sent · your note is back in your shielded balance.',
};

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
    return Promise.resolve({status: 'error', code: null, message: 'Shielding is not available on this device.'});
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
  /** what the last check decided about the pending unshields (I-1): #21 says it instead of "Not confirmed yet" */
  unshield: A0UnshieldCheck | null;
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
        if (found !== null) {
          setNote(UNSHIELD_CHECK_NOTE[found.kind]);
        } else if (r.report.stillPending.length > 0) {
          setNote(UNSHIELD_CHECK_NOTE.pending);
        }
      }
      refresh(); // the store changed under the view (useA0StartupState only moves on a state change)
    });
  }, [disabled, refresh]);
  const fromCheck = checkRefusal !== null && checkRefusal.bound === mmkvSecure() ? checkRefusal.code : null;
  const refusal = fromCheck ?? startupRefusal(state);
  return {view, refresh, checkAgain: {disabled, checking: busy, note, unshield, run}, refusal};
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
