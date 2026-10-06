import {useEffect, useRef, useState} from 'react';
import {useWallet} from './WalletContext';
import type {Account, Balances} from './engine';

/** Fresh balances for the first ten rows, one account at a time (2 requests each, inside the proxy's budget). */
export const FRESH_ROWS = 10;

export type RowBalance = {b: Balances; at: number; fresh: boolean};

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
export function useAccountBalances(accounts: readonly Account[]): Record<string, RowBalance> {
  const m = useWallet();
  const [rows, setRows] = useState<Record<string, RowBalance>>({});
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
    void (async () => {
      for (const a of accounts) {
        const c = await m.engine.cached(a.publicKey);
        if (gone()) return;
        if (c.ok && c.data.balances !== null) {
          const {at, ...b} = c.data.balances;
          setRows(r => ({...r, [a.publicKey]: {b, at, fresh: false}}));
        }
      }
      if (away()) return;
      for (const a of accounts.slice(0, FRESH_ROWS)) {
        if (away()) return;
        const f = await m.engine.balances(a.publicKey);
        if (gone()) return;
        if (f.ok) {
          setRows(r => ({...r, [a.publicKey]: {b: f.data, at: m.now(), fresh: true}}));
          continue;
        }
        // A 403 or no answer is the whole app's state (M4), and ends the pass: the next read would fare no better.
        m.report(f.error);
        if (f.error === 'coordinator-refused' || f.error === 'unreachable') return;
      }
    })();
    return () => {
      alive = false;
    };
    // Keyed on the addresses only, deliberately (see above). extension/ has no lint gate; this is a plain note.
  }, [keys]);
  return rows;
}
