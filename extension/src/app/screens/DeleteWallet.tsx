import {useEffect, useRef, useState} from 'react';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {PENDING_POLL_MS, useWallet} from '../WalletContext';
import {FRESH_ROWS, useAccountBalances} from '../useAccountBalances';
import {valuation} from '../valuation';
import {showAmount, showUsd} from '../format';
import {TopBar} from '../ui/TopBar';
import {Banner} from '../ui/Banner';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {HoldButton, type HoldClock, realClock} from '../ui/HoldButton';
import {isOpen, type Account, type Balances, type Pending, type Token} from '../engine';

/** #37's copy (B1b-2b §5): the design's strings, adapted where marked in the spec, and O11, O64, O65, O66. */
export const DELETE_TEXT = {
  title: 'Delete wallet',
  heading: 'Delete this wallet?',
  /** ix:14973 → adapted ("device" → "browser"); the bold parts at 1 and 3. */
  body: ['This removes ', 'all encrypted keys', ' and ', 'local data', ' from this browser.'],
  bulletAssets: ["Your assets won't be lost on-chain — but you'll need your ", 'recovery phrase', ' to access them again.'],
  bulletErased: ['Local settings, cached balances and the list of addresses you have sent to are ', 'erased', ' and not recoverable.'],
  holdBody: 'Hold the red button below — release to cancel, hold for the full second to delete.',
  firstAccount: "This wallet's first account",
  typeLead: 'Type ',
  typeWord: 'DELETE',
  typeTail: ' to confirm',
  placeholder: 'Type DELETE here',
  caseSensitive: 'Case-sensitive · must match exactly.',
  keepGoing: (n: number) => [String(n), ' of ', '6', ' characters · keep going'] as const,
  notAPrefix: 'Type DELETE exactly — it is case-sensitive.',
  matched: 'Confirmation matched',
  holdCaption: 'Hold the red button to delete · release to cancel',
  hold: 'Hold to delete',
  opensTab: 'Confirmation opens in a new tab.',
  cancel: 'Cancel',
  funded: 'This wallet holds funds',
  fundedTail: 'They stay on Solana. Only your recovery phrase reaches them after this.',
  unknown: 'Balances could not all be checked — this wallet may hold funds.',
  sendOpen: 'A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.',
} as const;

/**
 * D29 (owner, 2026-10-08): the send-open banner is a bold title + a regular body, as the funds banner. The one approved
 * string (RESTORE `sendOpen`, 2a) is split at its first sentence — no word added or dropped.
 */
const SEND_OPEN_AT = DELETE_TEXT.sendOpen.indexOf('. ') + 1;
export const SEND_OPEN_TITLE = DELETE_TEXT.sendOpen.slice(0, SEND_OPEN_AT);
export const SEND_OPEN_BODY = DELETE_TEXT.sendOpen.slice(SEND_OPEN_AT + 1);

export const WORD = 'DELETE';
/** D9: the owner chose "the full second" (the design says both 600 ms and "the full second", ix:15072). */
export const HOLD_MS = 1_000;
const TOKENS: readonly Token[] = ['SOL', 'NOC', 'USDC', 'USDT'];
const KEY: Record<Token, keyof Balances> = {SOL: 'sol', NOC: 'noc', USDC: 'usdc', USDT: 'usdt'};

/** C17: the account with the LOWEST index — never the display order (E14), never list position. */
export function firstAccount(accounts: readonly Account[]): Account | null {
  let low: Account | null = null;
  for (const a of accounts) if (low === null || a.index < low.index) low = a;
  return low;
}

/** Parts with the odd ones in bold (DELETE_TEXT's convention for the design's `<b>`). */
function boldOdd(parts: readonly string[]) {
  return parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : p));
}

/**
 * #37 delete wallet (spec B1b-2b §5; D9, D11, C13, C17) in the popup. Two gates of friction — DELETE typed exactly (case
 * sensitive, `autocapitalize="characters"`) and a 1 s hold (pointer, or Space / Enter held) — then the vault tab's proof
 * (`?mode=delete`, §3.2), where the password or passkey deletes the wallet. Neither gate is the security: the proof is.
 * The screen shows what is at stake: "This wallet holds funds" with the summed balances (the popup's reading, C13 — it
 * informs, never gates: D11), or that the balances could not all be checked; an open send (any account's: the screen
 * reads wallet.pending itself, and again every PENDING_POLL_MS while one is open, since the provider polls only the
 * selected account's) disables the CTA (E5 refuses it anyway). The three banners stand above the overline (§5). The first
 * account's address (lowest index) is the one the delete page will show (C17). Cancel and Back leave once, with the typed
 * text wiped; the hold is its own rule-6 lock (HoldButton). Every await is guarded: an answer that lands after the
 * screen went or after a lock sets nothing and schedules nothing.
 */
export function DeleteWallet({onBack, clock = realClock}: {onBack: () => void; clock?: HoldClock}) {
  const m = useWallet();
  const accounts = m.wallet?.accounts ?? [];
  const {rows, done, failed, reads} = useAccountBalances(accounts);
  const [typed, setTyped] = useState('');
  const [pressing, setPressing] = useState(false);
  /** The screen's own wallet.pending read (null until it answers). */
  const [own, setOwn] = useState<Pending[] | null>(null);
  const matched = typed === WORD;
  const partial = typed !== '' && !matched;
  const prefix = WORD.startsWith(typed);
  const first = firstAccount(accounts);
  const sendOpen = (own ?? m.pending).some(isOpen);

  // Read while unlocked: a lock (or the screen going) ends the read loop — its cleanup drops an answer still in flight
  // and the poll it would schedule; an unlock starts it again.
  useEffect(() => {
    if (m.phase !== 'unlocked') return;
    let on = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      const r = await m.engine.pending();
      if (!on) return;
      if (r.ok) setOwn(r.data);
      if (!r.ok || r.data.some(isOpen)) timer = setTimeout(() => void read(), PENDING_POLL_MS);
    };
    void read();
    return () => {
      on = false;
      clearTimeout(timer);
    };
  }, [m.phase]);

  // C13: the popup's reading, summed over the accounts it has a row for.
  const sum: Balances = {sol: 0n, noc: 0n, usdc: 0n, usdt: 0n};
  for (const a of accounts) {
    const r = rows[a.publicKey];
    if (r === undefined) continue;
    for (const t of TOKENS) sum[KEY[t]] += r.b[KEY[t]];
  }
  const held = TOKENS.filter(t => sum[KEY[t]] > 0n);
  const total = held.length === 0 ? null : valuation(sum, m.prices).total;
  // O65 (fix round 1, I1): a fresh read failed, or was skipped (the 403 cool-down, unreachable, offline: the pass read fewer
  // rows than it should have — stale cached zeros are not a check), or an account beyond the first 10 has no cache.
  const unknown = done && (failed || reads.size < Math.min(accounts.length, FRESH_ROWS) || accounts.some(a => rows[a.publicKey] === undefined));

  /** Rule 6 for leaving: Back and Cancel leave once (a second pop would leave the caller too). */
  const left = useRef(false);
  const leave = () => {
    if (left.current) return;
    left.current = true;
    setTyped('');
    onBack();
  };
  const toProof = () => {
    setTyped('');
    m.platform.openPage('unlock.html?mode=delete');
    if (m.surface === 'popup') m.platform.closeWindow();
  };

  return (
    <div className="screen app-delete">
      <TopBar title={DELETE_TEXT.title} onBack={leave} />
      <div className="app-delete-body">
        <div className="app-delete-card">
          <div className="app-delete-head">
            <span className="app-delete-icon">
              <ExtIcon name="alert-triangle" size={24} />
            </span>
            <h2 className="noc-h2 noc-danger">{DELETE_TEXT.heading}</h2>
          </div>
          <p className="noc-body">{matched ? DELETE_TEXT.holdBody : boldOdd(DELETE_TEXT.body)}</p>
          {typed === '' ? (
            <ul className="app-delete-bullets">
              {[DELETE_TEXT.bulletAssets, DELETE_TEXT.bulletErased].map(parts => (
                <li key={parts[1]} className="noc-body-sm">
                  <span className="app-delete-x">
                    <ExtIcon name="close" size={16} />
                  </span>
                  <span>{boldOdd(parts)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {first === null ? null : (
          <div className="app-delete-first">
            <p className="noc-caption app-muted">{DELETE_TEXT.firstAccount}</p>
            <AddressGroups address={first.publicKey} />
          </div>
        )}
        {held.length > 0 ? (
          <Banner tone="warning" title={DELETE_TEXT.funded}>
            <span className="app-delete-funds">
              {held.map(t => (
                <span key={t} className="noc-numeral">{`${showAmount(t, sum[KEY[t]])} ${t}`}</span>
              ))}
              {total === null ? null : <span className="noc-numeral">{showUsd(total)}</span>}
              <span>{DELETE_TEXT.fundedTail}</span>
            </span>
          </Banner>
        ) : null}
        {unknown ? <Banner tone="warning" title={DELETE_TEXT.unknown} /> : null}
        {sendOpen ? (
          <Banner tone="warning" title={SEND_OPEN_TITLE}>
            {SEND_OPEN_BODY}
          </Banner>
        ) : null}
        <div>
          {matched ? (
            <p className="noc-overline noc-success app-delete-eyebrow">
              <ExtIcon name="check" size={12} /> {DELETE_TEXT.matched}
            </p>
          ) : (
            <p className="noc-overline app-dim app-delete-eyebrow">
              {DELETE_TEXT.typeLead}
              <b className="app-delete-word">{DELETE_TEXT.typeWord}</b>
              {DELETE_TEXT.typeTail}
            </p>
          )}
          <label className={`s7-pw${matched ? ' app-pw-ok' : partial ? ' app-pw-active' : ''}`}>
            <input
              aria-label={DELETE_TEXT.placeholder}
              placeholder={DELETE_TEXT.placeholder}
              value={typed}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={e => setTyped(e.target.value)}
            />
            {matched ? (
              <span className="noc-success">
                <ExtIcon name="check" size={20} />
              </span>
            ) : null}
          </label>
          {typed === '' ? <p className="noc-caption app-dim app-delete-help">{DELETE_TEXT.caseSensitive}</p> : null}
          {partial && prefix ? (
            <p className="noc-caption app-dim app-delete-help">
              {DELETE_TEXT.keepGoing(typed.length).map((part, i) => (i === 0 || i === 2 ? <span key={i} className="noc-numeral">{part}</span> : part))}
            </p>
          ) : null}
          {partial && !prefix ? <p className="noc-caption noc-danger app-delete-help">{DELETE_TEXT.notAPrefix}</p> : null}
        </div>
        {matched ? <p className="noc-caption app-dim app-center-text">{DELETE_TEXT.holdCaption}</p> : null}
      </div>
      <div className="sticky-bar">
        {matched ? (
          <HoldButton label={DELETE_TEXT.hold} holdMs={HOLD_MS} disabled={sendOpen} onHeld={toProof} onPressing={setPressing} clock={clock} />
        ) : (
          <button type="button" className="btn btn-primary app-delete-gated" disabled>
            <ExtIcon name="trash" size={18} />
            {DELETE_TEXT.title}
          </button>
        )}
        {matched ? <p className="noc-caption app-dim app-center-text">{DELETE_TEXT.opensTab}</p> : null}
        <LockedButton className="btn btn-secondary" disabled={pressing} onPress={leave}>
          {DELETE_TEXT.cancel}
        </LockedButton>
      </div>
    </div>
  );
}
