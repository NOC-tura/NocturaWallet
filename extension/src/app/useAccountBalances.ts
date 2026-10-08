import {useEffect, useRef, useState} from 'react';
import {useWallet} from './WalletContext';
import type {Account, Balances} from './engine';

/** Fresh balances for the first ten rows, one account at a time (2 requests each, inside the proxy's budget). */
export const FRESH_ROWS = 10;

export type RowBalance = {b: Balances; at: number; fresh: boolean};

/**
 * The rows, and how the pass went: `done` once it ended (never after an unmount or a lock); `failed` when a fresh read
 * failed; `reads` the addresses this pass's fresh read covers — the first FRESH_ROWS rows when the pass started, cut to
 * the ones it actually asked for when it stopped early (the 403 cool-down, offline, unreachable: before the first, or at
 * a refusal). A row's "not checked yet" is decided from
 * `reads`, never from its current position: a move (E14) brings a row into the first ten without reading it (Task 14
 * review N1).
 */
export interface AccountBalances {
  rows: Record<string, RowBalance>;
  done: boolean;
  failed: boolean;
  reads: ReadonlySet<string>;
}

const NONE: ReadonlySet<string> = new Set();

/**
 * The account rows' balances (spec B1b-2a §5.2; shared by the switcher and the B1b-2b accounts manager): every account's
 * cached balances first, then a fresh read for the first FRESH_ROWS rows. No fresh pass during the 403 cool-down, nor
 * while offline or unreachable; a 403 or no answer ends the pass and is reported to the app (M4). Read once per set of
 * addresses: a rename changes names and a move the order, not balances, and neither reads again; an account added, removed or first known
 * (a screen mounted before the wallet state arrived) reads again.
 *
 * After every await the pass stops if the screen went (unmount) or the wallet locked meanwhile (B1b-2b, every async path
 * guarded). An account switch does not stop it: the rows are per address, not per selected account.
 */
export function useAccountBalances(accounts: readonly Account[]): AccountBalances {
  const m = useWallet();
  const [rows, setRows] = useState<Record<string, RowBalance>>({});
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reads, setReads] = useState<ReadonlySet<string>>(NONE);
  // The live net mode (WalletContext's own netRef pattern): a ref, kept current every render, so the
  // async pass below reads what net.mode IS when it checks, not what it was when the effect started.
  const netRef = useRef(m.net);
  netRef.current = m.net;
  // The live phase, the same way: a lock while the pass runs ends it.
  const phaseRef = useRef(m.phase);
  phaseRef.current = m.phase;
  // The set of addresses, not their order: a move (B1b-2b E14) reorders the rows and reads nothing again.
  const keys = accounts
    .map(a => a.publicKey)
    .sort()
    .join(',');

  useEffect(() => {
    let alive = true;
    const gone = (): boolean => !alive || phaseRef.current !== 'unlocked';
    // No fresh pass during the 403 cool-down, nor while offline or unreachable (review M5): the cached
    // rows are what there is, and ten reads that cannot answer would only wait. Read live (netRef), not
    // a value captured once: the sequential cached loop below can run long enough for net.mode to flip
    // mid-pass, and a snapshot taken at mount would miss that (review follow-up).
    const away = (): boolean => {
      const mode = netRef.current.mode;
      return mode === 'refused' || mode === 'offline' || mode === 'unreachable';
    };
    const fresh = accounts.slice(0, FRESH_ROWS);
    setDone(false);
    setFailed(false);
    setReads(new Set(fresh.map(a => a.publicKey)));
    void (async () => {
      await pass();
      // Ended by itself (read everything, or stopped at a refusal) — not by an unmount or a lock.
      if (!gone()) setDone(true);
    })();
    async function pass(): Promise<void> {
      for (const a of accounts) {
        const c = await m.engine.cached(a.publicKey);
        if (gone()) return;
        if (c.ok && c.data.balances !== null) {
          const {at, ...b} = c.data.balances;
          setRows(r => ({...r, [a.publicKey]: {b, at, fresh: false}}));
        }
      }
      // A pass that stops before the end of `fresh` read only the rows before the stop: `reads` says so.
      const stopAt = (i: number): void => setReads(new Set(fresh.slice(0, i).map(a => a.publicKey)));
      for (const [i, a] of fresh.entries()) {
        if (away()) return stopAt(i);
        const f = await m.engine.balances(a.publicKey);
        if (gone()) return;
        if (f.ok) {
          setRows(r => ({...r, [a.publicKey]: {b: f.data, at: m.now(), fresh: true}}));
          continue;
        }
        // A 403 or no answer is the whole app's state (M4), and ends the pass: the next read would fare no better.
        setFailed(true);
        m.report(f.error);
        if (f.error === 'coordinator-refused' || f.error === 'unreachable') return stopAt(i + 1);
      }
    }
    return () => {
      alive = false;
    };
    // Keyed on the addresses only, deliberately (see above). extension/ has no lint gate; this is a plain note.
  }, [keys]);
  return {rows, done, failed, reads};
}
