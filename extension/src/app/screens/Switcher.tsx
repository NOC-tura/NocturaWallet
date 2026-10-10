import {useState} from 'react';
import {useWallet} from '../WalletContext';
import {useAccountBalances} from '../useAccountBalances';
import {valuation} from '../valuation';
import {ago, showAmount, showUsd, twoGroups} from '../format';
import {useNow} from '../useNow';
import {Sheet} from '../ui/Sheet';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import type {Account} from '../engine';

export {FRESH_ROWS} from '../useAccountBalances';

/** The rename refusals (2a §5.2), shared with the B1b-2b accounts manager's inline rename. */
export const RENAME_FAILED = 'Something went wrong.';
/** 2a §5.2's name rule (the accounts' rename, and B1b-2b's contact sheet — one literal, so the two cannot drift). */
export const NAME_RULE = 'Names are 1 to 32 characters, without control characters.';
export const RENAME_ERRORS: Record<string, string> = {
  malformed: NAME_RULE,
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
 * rename, "Add account". Remove and reorder are the B1b-2b accounts manager's; the rows come in the display
 * order (E14) like every account list.
 */
export function Switcher({onClose}: {onClose: () => void}) {
  const m = useWallet();
  const now = useNow(1_000, m.now);
  const accounts = m.wallet?.accounts ?? [];
  const {rows, reads} = useAccountBalances(accounts);
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);

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
        {accounts.map(a => {
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
                        {row === undefined ? (reads.has(a.publicKey) ? '' : 'not checked yet') : `${showAmount('SOL', row.b.sol)} SOL${total === null ? '' : ` · ${showUsd(total)}`}`}
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
      <button type="button" className="btn btn-secondary" disabled={cli} onClick={() => m.platform.openPage('unlock.html?mode=accounts&op=add')}>
        <ExtIcon name="plus" size={18} />
        Add account
      </button>
      {cli ? <p className="noc-caption app-muted">A Solana CLI wallet has exactly one account.</p> : null}
    </Sheet>
  );
}
