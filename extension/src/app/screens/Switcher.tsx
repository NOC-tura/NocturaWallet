import {useEffect, useRef, useState} from 'react';
import {useWallet} from '../WalletContext';
import {valuation} from '../valuation';
import {ago, showAmount, showUsd, twoGroups} from '../format';
import {useNow} from '../useNow';
import {Sheet} from '../ui/Sheet';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import type {Account, Balances} from '../engine';

/** Fresh balances for the first ten rows, one account at a time (2 requests each, inside the proxy's budget). */
export const FRESH_ROWS = 10;

type RowBalance = {b: Balances; at: number; fresh: boolean};

const RENAME_FAILED = 'Something went wrong.';
const RENAME_ERRORS: Record<string, string> = {
  malformed: 'Names are 1 to 32 characters, without control characters.',
  busy: 'The wallet is busy. Try again.',
  'unknown-account': 'That account no longer exists.',
  failed: RENAME_FAILED,
};

const SELECT_ERROR = 'Could not switch accounts. Try again.';
/** The error codes `report` (review M4) is for — `select` cannot return them today (spec: no network
 * call), but the check is here in case that ever changes, rather than assuming its own contract. */
const NETWORK_ERRORS = new Set<string>(['coordinator-refused', 'unreachable']);

/**
 * The account switcher (spec §5.2, D14): derived from #43's sheet — accounts with balances, select,
 * rename, "Add account". Remove and reorder are B1b-2b's accounts manager.
 */
export function Switcher({onClose}: {onClose: () => void}) {
  const m = useWallet();
  const now = useNow(1_000, m.now);
  const accounts = m.wallet?.accounts ?? [];
  const [rows, setRows] = useState<Record<string, RowBalance>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  // The live net mode (WalletContext's own netRef pattern): a ref, kept current every render, so the
  // async pass below reads what net.mode IS when it checks, not what it was when the effect started.
  const netRef = useRef(m.net);
  netRef.current = m.net;

  useEffect(() => {
    let alive = true;
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
        if (!alive) return;
        if (c.ok && c.data.balances !== null) {
          const {at, ...b} = c.data.balances;
          setRows(r => ({...r, [a.publicKey]: {b, at, fresh: false}}));
        }
      }
      if (away()) return;
      for (const a of accounts.slice(0, FRESH_ROWS)) {
        if (away()) return;
        const f = await m.engine.balances(a.publicKey);
        if (!alive) return;
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
    // Mount-only, deliberately: the account list is read once per opening (a rename changes names, not
    // balances), and the live net mode is read through netRef above rather than restarting this whole
    // pass on every net.mode change. extension/ has no lint gate to satisfy here; this is a plain note.
  }, []);

  const select = async (a: Account) => {
    const r = await m.engine.select(a.index);
    if (r.ok) {
      setSelectError(null);
      onClose();
      await m.reload();
      return;
    }
    setSelectError(SELECT_ERROR);
    if (NETWORK_ERRORS.has(r.error)) m.report(r.error);
  };

  const save = async (a: Account) => {
    const r = await m.engine.rename(a.index, name);
    if (r.ok) {
      setEditing(null);
      setError(null);
      await m.reload();
    } else setError(RENAME_ERRORS[r.error] ?? RENAME_FAILED);
  };

  const cli = m.wallet?.scheme === 'cli';
  return (
    <Sheet title="Accounts" onClose={onClose}>
      <div className="list">
        {accounts.map((a, i) => {
          const row = rows[a.publicKey];
          const selected = a.index === m.wallet?.selected;
          const total = row === undefined ? null : valuation(row.b, m.prices).total;
          return (
            <div key={a.index} className={`app-account-row${selected ? ' sel' : ''}`} data-account={a.index}>
              {editing === a.index ? (
                <div className="app-rename">
                  <input
                    className="app-input"
                    aria-label="Account name"
                    maxLength={32}
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                  <LockedButton className="btn btn-primary app-btn-sm" onPress={() => save(a)}>
                    Save
                  </LockedButton>
                  <button type="button" className="btn btn-secondary app-btn-sm" onClick={() => {
                    setEditing(null);
                    setError(null);
                  }}>
                    Cancel
                  </button>
                  {error === null ? null : <p className="field-msg noc-danger" role="alert">{error}</p>}
                </div>
              ) : (
                <>
                  <button type="button" className="app-account-pick" aria-pressed={selected} onClick={() => void select(a)}>
                    <span className="avatar">{a.name.slice(0, 1).toUpperCase()}</span>
                    <span>
                      <span className="pri noc-body-lg">{a.name}</span>
                      <span className="sec noc-mono">{twoGroups(a.publicKey)}</span>
                      <span className="sec noc-numeral">
                        {row === undefined ? (i >= FRESH_ROWS ? 'not checked yet' : '') : `${showAmount('SOL', row.b.sol)} SOL${total === null ? '' : ` · ${showUsd(total)}`}`}
                      </span>
                      {row !== undefined && !row.fresh ? <span className="sec noc-caption">cached {ago(row.at, now)}</span> : null}
                    </span>
                    {selected ? <ExtIcon name="check" size={18} label="Selected" /> : null}
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Rename ${a.name}`} onClick={() => {
                    setEditing(a.index);
                    setName(a.name);
                    setError(null);
                  }}>
                    <ExtIcon name="pencil" size={16} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
      {selectError === null ? null : <p className="field-msg noc-danger" role="alert">{selectError}</p>}
      <button type="button" className="btn btn-secondary" disabled={cli} onClick={() => m.platform.openPage('unlock.html?mode=accounts')}>
        <ExtIcon name="plus" size={18} />
        Add account
      </button>
      {cli ? <p className="noc-caption app-muted">A Solana CLI wallet has exactly one account.</p> : null}
    </Sheet>
  );
}
