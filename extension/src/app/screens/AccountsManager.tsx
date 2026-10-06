import {useEffect, useRef, useState} from 'react';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {useWallet} from '../WalletContext';
import {FRESH_ROWS, useAccountBalances, type RowBalance} from '../useAccountBalances';
import {valuation} from '../valuation';
import {ago, showAmount, showUsd, twoGroups} from '../format';
import {useNow} from '../useNow';
import {removeAccountPage} from '../platform';
import {TopBar} from '../ui/TopBar';
import {Sheet} from '../ui/Sheet';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {RENAME_ERRORS, RENAME_FAILED} from './Switcher';
import type {Account, Token} from '../engine';

/** The accounts manager's copy (B1b-2b §4.3): 2a's strings and the owner-confirmed O52–O61. */
export const ACCOUNTS_TEXT = {
  title: 'Accounts',
  moveUp: (name: string) => `Move ${name} up`,
  moveDown: (name: string) => `Move ${name} down`,
  remove: (name: string) => `Remove ${name}`,
  rename: (name: string) => `Rename ${name}`,
  stale: 'The accounts changed. Try again.',
  orderFailed: 'Could not save the order. Try again.',
  removeTitle: (name: string) => `Remove ${name}?`,
  holds: (parts: string[]) => `Holds ${parts.join(' · ')}`,
  holdsNothing: 'Holds no funds',
  notChecked: 'Balance not checked',
  fundsStay: 'Its funds stay on Solana; add it again to use them.',
  continueRemove: 'Continue to remove',
  opensTab: 'Confirmation opens in a new tab.',
  cancel: 'Cancel',
  lastAccount: 'The last account cannot be removed.',
  sendOpen: 'A transaction from this account is still pending. Wait until it confirms or expires — about two minutes — then try again.',
  add: 'Add account',
  cli: 'A Solana CLI wallet has exactly one account.',
  selectFailed: 'Could not switch accounts. Try again.',
  notCheckedYet: 'not checked yet',
  save: 'Save',
  accountName: 'Account name',
} as const;

const TOKENS: readonly Token[] = ['SOL', 'NOC', 'USDC', 'USDT'];
const BALANCE_KEY: Record<Token, 'sol' | 'noc' | 'usdc' | 'usdt'> = {SOL: 'sol', NOC: 'noc', USDC: 'usdc', USDT: 'usdt'};

/** O58 / O59 / O60: what the removed account holds, from the rows' last read — never a guard (D16). */
export function holdsLine(row: RowBalance | undefined, prices: Parameters<typeof valuation>[1]): string {
  if (row === undefined) return ACCOUNTS_TEXT.notChecked;
  const parts = TOKENS.filter(t => row.b[BALANCE_KEY[t]] > 0n).map(t => `${showAmount(t, row.b[BALANCE_KEY[t]])} ${t}`);
  if (parts.length === 0) return ACCOUNTS_TEXT.holdsNothing;
  const total = valuation(row.b, prices).total;
  return ACCOUNTS_TEXT.holds(total === null ? parts : [...parts, showUsd(total)]);
}

/**
 * The accounts manager (spec B1b-2b §4.3; D16, D17, C6, C14, C16) — no design exists (context §1.7); derived from the
 * 2a switcher (2a-D14) and #43's sheet. Rows in the display order (E14): select, inline rename, ↑ / ↓ (buttons, not drag:
 * keyboard-first — Tab to the button, Enter or Space) and remove. A move writes accounts.order (no proof: the order never
 * touches the envelope); `stale` re-reads the list. Remove opens a sheet that says what the account holds and that its
 * funds stay on Solana, then the vault tab's proof (`removeAccountPage(index)`, C14: the page shows "Account N", never the
 * name). The background refuses a remove while a send from it is open (C5); the sheet says so first. Rule 6: every write,
 * every page it opens and every row tool (pencil, ↑, ↓, trash) through LockedButton. Every await is guarded: an answer
 * that lands after the screen went, after a lock, or (for a move or a rename) after the selected account changed sets
 * nothing and reads nothing.
 */
export function AccountsManager({onBack}: {onBack: () => void}) {
  const m = useWallet();
  const now = useNow(1_000, m.now);
  const accounts = m.wallet?.accounts ?? [];
  const rows = useAccountBalances(accounts);
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Account | null>(null);
  const cli = m.wallet?.scheme === 'cli';
  const last = accounts.length <= 1;

  /** False once unmounted. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // The live phase and selection (WalletContext's netRef pattern): kept current every render, read after each await.
  const live = useRef({phase: m.phase, selected: m.wallet?.selected ?? null});
  live.current = {phase: m.phase, selected: m.wallet?.selected ?? null};
  /** Still here and unlocked. */
  const here = (): boolean => alive.current && live.current.phase === 'unlocked';
  /** Taken at a press: still here, unlocked, and on the account that was selected then. */
  const stamp = (): (() => boolean) => {
    const selected = live.current.selected;
    return () => here() && live.current.selected === selected;
  };

  const open = (page: Parameters<typeof m.platform.openPage>[0]) => {
    m.platform.openPage(page);
    if (m.surface === 'popup') m.platform.closeWindow();
  };
  const select = async (a: Account) => {
    // A select is the switch itself: guarded on the screen and the lock only.
    const r = await m.engine.select(a.index);
    if (!here()) return;
    if (!r.ok) return setLine(ACCOUNTS_TEXT.selectFailed);
    setLine(null);
    await m.reload();
  };
  const save = async (a: Account) => {
    const still = stamp();
    const r = await m.engine.rename(a.index, name);
    if (!still()) return;
    if (r.ok) {
      setEditing(null);
      setRenameError(null);
      await m.reload();
    } else setRenameError(RENAME_ERRORS[r.error] ?? RENAME_FAILED);
  };
  /** Moves the account at `at` one place; the pressed button keeps the focus (LockedButton keepFocus: keyboard reorder). */
  const move = async (at: number, by: -1 | 1) => {
    const order = accounts.map(a => a.index);
    const to = at + by;
    const a = order[at];
    const b = order[to];
    if (a === undefined || b === undefined) return;
    order.splice(to, 1, a);
    order.splice(at, 1, b);
    const still = stamp();
    const r = await m.engine.order(order);
    if (!still()) return;
    await m.reload();
    // Our own re-read may move the selection (an account removed elsewhere): from here, the screen and the lock only.
    if (!here()) return;
    if (!r.ok) return setLine(r.error === 'stale' ? ACCOUNTS_TEXT.stale : ACCOUNTS_TEXT.orderFailed);
    setLine(null);
  };
  const sendOpen = (a: Account) => m.pending.some(p => p.account === a.publicKey && (p.state === 'pending' || p.state === 'stuck'));

  return (
    <div className="screen">
      <TopBar title={ACCOUNTS_TEXT.title} onBack={onBack} />
      <div className="app-manager-body">
        <div className="app-manager-list">
          {accounts.map((a, i) => {
            const row = rows[a.publicKey];
            const selected = a.index === m.wallet?.selected;
            const total = row === undefined ? null : valuation(row.b, m.prices).total;
            return (
              <div key={a.index} className={`app-account-row${selected ? ' sel' : ''}`} data-account={a.index}>
                {editing === a.index ? (
                  <div className="app-rename">
                    <input className="app-input" aria-label={ACCOUNTS_TEXT.accountName} maxLength={32} value={name} onChange={e => setName(e.target.value)} />
                    <LockedButton className="btn btn-primary app-btn-sm" onPress={() => save(a)}>
                      {ACCOUNTS_TEXT.save}
                    </LockedButton>
                    <button
                      type="button"
                      className="btn btn-secondary app-btn-sm"
                      onClick={() => {
                        setEditing(null);
                        setRenameError(null);
                      }}
                    >
                      {ACCOUNTS_TEXT.cancel}
                    </button>
                    {renameError === null ? null : (
                      <p className="field-msg noc-danger" role="alert">
                        {renameError}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <button type="button" className="app-account-pick" aria-pressed={selected} onClick={() => void select(a)}>
                      <span className="avatar">{a.name.slice(0, 1).toUpperCase()}</span>
                      <span>
                        <span className="pri noc-body-lg">{a.name}</span>
                        <span className="sec noc-mono">{twoGroups(a.publicKey)}</span>
                        <span className="sec noc-numeral">
                          {row === undefined ? (i >= FRESH_ROWS ? ACCOUNTS_TEXT.notCheckedYet : '') : `${showAmount('SOL', row.b.sol)} SOL${total === null ? '' : ` · ${showUsd(total)}`}`}
                        </span>
                        {row !== undefined && !row.fresh ? <span className="sec noc-caption">cached {ago(row.at, now)}</span> : null}
                      </span>
                      {selected ? <ExtIcon name="check" size={18} label="Selected" /> : null}
                    </button>
                    <span className="app-row-tools">
                      <LockedButton
                        className="icon-btn"
                        label={ACCOUNTS_TEXT.rename(a.name)}
                        onPress={() => {
                          setEditing(a.index);
                          setName(a.name);
                          setRenameError(null);
                        }}
                      >
                        <ExtIcon name="pencil" size={16} />
                      </LockedButton>
                      <LockedButton className="icon-btn" keepFocus label={ACCOUNTS_TEXT.moveUp(a.name)} disabled={i === 0} onPress={() => move(i, -1)}>
                        <ExtIcon name="arrow-up" size={16} />
                      </LockedButton>
                      <LockedButton className="icon-btn" keepFocus label={ACCOUNTS_TEXT.moveDown(a.name)} disabled={i === accounts.length - 1} onPress={() => move(i, 1)}>
                        <ExtIcon name="arrow-down" size={16} />
                      </LockedButton>
                      <LockedButton className="icon-btn" label={ACCOUNTS_TEXT.remove(a.name)} disabled={last} onPress={() => setRemoving(a)}>
                        <ExtIcon name="trash" size={16} />
                      </LockedButton>
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {last ? <p className="noc-caption app-muted">{ACCOUNTS_TEXT.lastAccount}</p> : null}
        {line === null ? null : (
          <p className="field-msg noc-danger" role="alert">
            {line}
          </p>
        )}
        <LockedButton className="btn btn-secondary" disabled={cli} onPress={() => open('unlock.html?mode=accounts&op=add')}>
          <ExtIcon name="plus" size={18} />
          {ACCOUNTS_TEXT.add}
        </LockedButton>
        {cli ? <p className="noc-caption app-muted">{ACCOUNTS_TEXT.cli}</p> : null}
      </div>
      {removing === null ? null : (
        <Sheet title={ACCOUNTS_TEXT.removeTitle(removing.name)} onClose={() => setRemoving(null)}>
          <div className="app-remove-sheet">
            <AddressGroups address={removing.publicKey} />
            <p className="noc-body-sm noc-numeral">{holdsLine(rows[removing.publicKey], m.prices)}</p>
            <p className="noc-body-sm app-muted">{ACCOUNTS_TEXT.fundsStay}</p>
            {sendOpen(removing) ? (
              <p className="field-msg noc-warning" role="status">
                {ACCOUNTS_TEXT.sendOpen}
              </p>
            ) : null}
            <LockedButton
              className="btn btn-destructive"
              disabled={sendOpen(removing)}
              onPress={() => {
                const page = removeAccountPage(removing.index);
                if (page !== null) open(page);
              }}
            >
              {ACCOUNTS_TEXT.continueRemove}
            </LockedButton>
            <p className="noc-caption app-muted app-center-text">{ACCOUNTS_TEXT.opensTab}</p>
            <button type="button" className="btn btn-secondary" onClick={() => setRemoving(null)}>
              {ACCOUNTS_TEXT.cancel}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
