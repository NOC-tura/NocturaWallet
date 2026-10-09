import {useEffect, useRef, useState} from 'react';
import {useWallet} from '../WalletContext';
import {parseAmount} from '../../shared/amount';
import {TOKEN_INFO, ago, showAmount, showUsd} from '../format';
import {
  BASE_FEE_LAMPORTS,
  isAddressText,
  maxSendable,
  percentOf,
  plainAmount,
  predictReasons,
  sentBeforeText,
  showExact,
  showLamports,
  usdOf,
  type Draft,
} from '../send/rules';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';
import {Banner, RefusedBanner} from '../ui/Banner';
import {LockedButton} from '../ui/LockedButton';
import {useEscape} from '../ui/useEscape';
import {useNow} from '../useNow';
import {TokenSheet} from './TokenSheet';
import {fromBook} from '../addressBook';
import type {Balances, Intent, Pending, RecipientInfo, Token} from '../engine';

/** The fixed strings #12 shows (spec §4.2); adapted ones are marked there. */
export const SEND_TEXT = {
  invalid: 'Not a valid Solana address — check length & characters',
  self: 'This is the account you are sending from.',
  neverSent: 'Never sent here before',
  firstTitle: 'First-time recipient',
  firstLine: 'Re-auth (password) required before broadcast · verify the address character-by-character below.',
  feeWarning: 'Not enough SOL for the network fee.',
  maxHelper: 'MAX keeps 0.00089 SOL so the account stays open, plus the network fee.',
  priority: 'Set automatically — shown on the next step',
  pending: 'A send from this account is still pending. Wait until it confirms or expires.',
  reviewUnlock: 'Review & unlock to send',
  /** Controller addition — confirmed by the owner 2026-10-02 (plan 3): the browser refused the clipboard read. */
  pasteRefused: 'Paste with Ctrl+V (⌘V on a Mac).',
  /** §4.5's loop guard sends the user back here with it. */
  startAgain: 'Something went wrong — start the send again.',
  /** Controller addition (plan 3 fix round 1) — confirmed by the owner 2026-10-04: §4.2 gives no copy for an amount that does not parse. */
  invalidAmount: (decimals: number): string => `Not a valid amount — digits, with up to ${decimals} decimals`,
} as const;

const EMPTY_DRAFT: Draft = {token: 'SOL', recipient: '', amount: ''};
const balanceKey = (t: Token): keyof Balances => (t === 'SOL' ? 'sol' : t === 'NOC' ? 'noc' : t === 'USDC' ? 'usdc' : 'usdt');

/**
 * #12 send (spec §4.2). Nothing is prepared here: the CTA hands the intent to #19, which prepares. The hints —
 * the recipient's (E6, local only), the predicted re-authentication, MAX — are hints; #19 and #20 show the
 * engine's own answers, which decide. Removed by decision: the priority chips (D15), `.sol` (D16), scan (D13)
 * and the shielded variant (D4); the fee-loading state (the fee is known only once #19 prepares). Rule 6: the CTA is a
 * LockedButton. B1b-2b plan 2 (§6.3): the empty field's "Address book" icon (ix:6652) opens #15 in pick mode with the
 * draft kept; a picked address comes back through the route's draft and is handled exactly as a paste. A saved
 * contact adds "From your address book: <name>" above the helper, which is unchanged — "Never sent here before" stays
 * for an address never sent to (a contact is not known, D19).
 */
export function Send({
  draft,
  notice,
  onBack,
  onReview,
  onViewPending,
  onBook,
}: {
  draft: Draft | null;
  notice: 'start-again' | null;
  onBack: () => void;
  onReview: (draft: Draft, intent: Intent) => void;
  onViewPending: (p: Pending) => void;
  /** Plan 2: #15 in pick mode, holding what the user typed (the token and the amount; the field is empty). */
  onBook: (draft: Draft) => void;
}) {
  const m = useWallet();
  const now = useNow(30_000, m.now);
  const start = draft ?? EMPTY_DRAFT;
  const [token, setToken] = useState<Token>(start.token);
  const [recipient, setRecipient] = useState(start.recipient);
  const [amountText, setAmountText] = useState(start.amount);
  const [sheet, setSheet] = useState(false);
  /** recipientInfo's last answer, keyed by what it answered (`account|address`; Task 6 fix round 1, M2). */
  const [answer, setAnswer] = useState<{for: string; info: RecipientInfo} | null>(null);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [pasteRefused, setPasteRefused] = useState(false);
  const [maxText, setMaxText] = useState<string | null>(start.max === true ? start.amount : null);
  const account = m.account;
  const {engine, reload} = m;

  useEscape(onBack, !sheet);

  // The dollar threshold (settings.get, local). Until it is read, the hint fails closed (above the rule).
  useEffect(() => {
    let alive = true;
    void engine.settings().then(r => {
      if (alive && r.ok) setThreshold(r.data.reauthUsdCents);
    });
    return () => {
      alive = false;
    };
  }, [engine]);

  const address = recipient.trim();
  const valid = isAddressText(address);
  const invalid = address !== '' && !valid;
  const key = account?.publicKey ?? null;
  // E6's answer is shown only for the pair it was given for: an answer for another address (or account) — the one the
  // field held before, while this one's is still out — is never this address's label or "Verified" line.
  const asked = valid && key !== null ? `${key}|${address}` : null;
  const info = asked !== null && answer !== null && answer.for === asked ? answer.info : null;

  // A paste that answers after the user typed, cleared or left is dropped (the same generation idea as E6's).
  const pasteGeneration = useRef(0);

  // E6, each time the field holds a valid address: local, no network. A reply for an address the field no longer
  // holds — or after the screen left — is dropped (the generation check).
  const generation = useRef(0);
  useEffect(() => {
    const mine = ++generation.current;
    if (!valid || key === null) return;
    const pair = `${key}|${address}`;
    void engine.recipientInfo(key, address).then(r => {
      if (generation.current !== mine) return;
      if (r.ok) setAnswer({for: pair, info: r.data});
      else if (r.error === 'locked') void reload();
    });
  }, [valid, address, key, engine, reload]);
  useEffect(
    () => () => {
      generation.current += 1;
      pasteGeneration.current += 1;
    },
    [],
  );

  const decimals = TOKEN_INFO[token].decimals;
  const parsed = parseAmount(amountText, decimals);
  const amount = parsed !== null && parsed > 0n ? parsed : null;
  const badAmount = amountText !== '' && parsed === null;
  const balance = m.balances === null ? null : m.balances[balanceKey(token)];
  const short = amount !== null && balance !== null && amount > balance ? amount - balance : null;
  const solShort = token !== 'SOL' && m.balances !== null && m.balances.sol < BASE_FEE_LAMPORTS;
  const refused = m.net.mode === 'refused';
  const open = m.pending.find(p => p.account === key && (p.state === 'pending' || p.state === 'stuck'));
  // The sending account itself is refused from the text alone — never only on E6's answer, which may fail or come late.
  const self = (key !== null && address === key) || info?.self === true;
  const firstTime = valid && info !== null && !info.known && !self;
  const reasons = valid && amount !== null ? predictReasons({known: info?.known ?? false, token, amount, balance, prices: m.prices, thresholdCents: threshold}) : [];
  // A send the CTA refuses anyway (short, or no SOL for the fee) predicts nothing: the design's state 4 reads
  // "Send 75.000000 SOL", disabled.
  const predicted = reasons.length > 0 && short === null && !solShort;
  const usd = amount === null ? null : usdOf(token, amount, m.prices);
  const ready = key !== null && valid && !self && amount !== null && short === null && !solShort && open === undefined && !refused;

  const max = () => {
    if (balance === null) return;
    const text = plainAmount(maxSendable(token, balance), decimals);
    setAmountText(text);
    setMaxText(text);
  };
  const paste = async () => {
    const mine = ++pasteGeneration.current;
    setPasteRefused(false);
    try {
      const text = await navigator.clipboard.readText();
      if (pasteGeneration.current === mine) setRecipient(text.trim());
    } catch {
      if (pasteGeneration.current === mine) setPasteRefused(true);
    }
  };
  const edit = (text: string) => {
    pasteGeneration.current += 1;
    setRecipient(text);
    setPasteRefused(false);
  };
  const review = () => {
    if (!ready || amount === null) return;
    onReview({token, recipient: address, amount: amountText}, {token, recipient: address, amount});
  };

  let helper = null;
  if (invalid) {
    helper = (
      <div className="helper error" role="alert">
        <ExtIcon name="alert" size={12} /> {SEND_TEXT.invalid}
      </div>
    );
  } else if (pasteRefused && address === '') {
    helper = <div className="helper warn">{SEND_TEXT.pasteRefused}</div>;
  } else if (valid && self) {
    helper = (
      <div className="helper error" role="alert">
        <ExtIcon name="alert" size={12} /> {SEND_TEXT.self}
      </div>
    );
  } else if (valid && info !== null) {
    if (!info.known) {
      helper = (
        <div className="helper warn">
          <ExtIcon name="alert" size={12} /> {SEND_TEXT.neverSent}
        </div>
      );
    } else {
      const text = info.label?.kind === 'own' ? `Your account: ${info.label.name}` : info.label?.kind === 'treasury' ? 'Noctura treasury' : sentBeforeText(info.lastSentAt, now);
      helper = (
        <div className="helper ok">
          <ExtIcon name="check" size={12} /> {text}
        </div>
      );
    }
  }

  // E17's label for a saved contact (the background's precedence: own > treasury > contact) — above the helper, which
  // stays what 2a says: "Never sent here before" for an address never sent to (D19).
  const contactName = valid && !self && info?.label?.kind === 'contact' ? info.label.name : null;

  const percent = amount === null ? null : percentOf(amount, balance);
  let available;
  if (predicted && valid && !self) {
    const parts = [usd === null ? null : `≈ ${showUsd(usd)}`, percent === null ? null : `${percent}% of balance`].filter((x): x is string => x !== null);
    available = <div className="available noc-body-sm noc-numeral app-warning">{`${parts.join(' · ')}${parts.length > 0 ? ' — re-auth' : 'Re-auth'} required`}</div>;
  } else {
    available = (
      <div className={`available noc-body-sm${m.stale && balance !== null ? ' app-warning' : ''}`}>
        Available <b className="noc-numeral">{balance === null ? '—' : `${showAmount(token, balance)} ${token}`}</b>
        {usd === null ? null : (
          <>
            {' · ≈ '}
            <span className="noc-numeral">{showUsd(usd)}</span>
          </>
        )}
        {m.stale && balance !== null && m.balancesAt !== null ? ` · last synced ${ago(m.balancesAt, now)}` : null}
      </div>
    );
  }

  const label = predicted ? (
    <>
      <ExtIcon name="lock" size={18} />
      &nbsp;{SEND_TEXT.reviewUnlock}
    </>
  ) : amount !== null ? (
    // The amount as typed (design state 4: "Send 75.000000 SOL") — but never "Send 1. SOL" mid-typing (review L6).
    `Send ${amountText.endsWith('.') ? amountText.slice(0, -1) : amountText} ${token}`
  ) : (
    `Send ${token}`
  );

  return (
    <>
      <div className="screen s-send">
        <TopBar title="Send" onBack={onBack} />
        <div className="scroll">
          {refused ? <RefusedBanner /> : null}
          {notice === 'start-again' ? <Banner tone="danger" title={SEND_TEXT.startAgain} /> : null}
          {open === undefined ? null : (
            <div className="banner info" role="status">
              <ExtIcon name="info" size={18} />
              <div>
                <div className="noc-body-sm banner-title">{SEND_TEXT.pending}</div>
                <button type="button" className="btn btn-tertiary app-btn-inline" onClick={() => onViewPending(open)}>
                  View it
                </button>
              </div>
            </div>
          )}
          {firstTime ? (
            <Banner tone="warning" role="status" title={SEND_TEXT.firstTitle}>
              {SEND_TEXT.firstLine}
            </Banner>
          ) : null}
          <div className="row">
            <div className="lbl noc-overline">Token</div>
            <button type="button" className="token-chip" aria-label={`Token: ${token}`} onClick={() => setSheet(true)}>
              <span className={`app-chip-ico s8-tok ${token.toLowerCase()}`} aria-hidden="true" />
              <span className="noc-body-lg">{token}</span>
              <ExtIcon name="chevron-down" size={16} />
            </button>
          </div>
          <div className={`row recipient-row${invalid || self ? ' app-row-error' : ''}`}>
            <label className="lbl noc-overline" htmlFor="send-recipient">
              Recipient
            </label>
            <div className="field">
              <input
                id="send-recipient"
                className={`input noc-mono${invalid ? ' invalid' : ''}`}
                placeholder="Solana address"
                autoComplete="off"
                spellCheck={false}
                value={recipient}
                onChange={e => edit(e.target.value)}
              />
              <div className="input-actions">
                {recipient === '' ? (
                  <>
                    <button type="button" aria-label="Paste" onClick={() => void paste()}>
                      <ExtIcon name="clip" size={18} />
                    </button>
                    {/* ix:6652; Scan QR (ix:6651) stays omitted (2a-D13). Rule 6: one #15 per tap. */}
                    <LockedButton className="" label="Address book" onPress={() => onBook({token, recipient: '', amount: amountText, ...(maxText !== null && amountText === maxText ? {max: true as const} : {})})}>
                      <ExtIcon name="book" size={18} />
                    </LockedButton>
                  </>
                ) : firstTime ? null : (
                  // Design state 6 draws no field action; state 3 tints Clear --danger.
                  <button type="button" aria-label="Clear recipient" className={invalid ? 'app-danger' : undefined} onClick={() => edit('')}>
                    <ExtIcon name="close" size={18} />
                  </button>
                )}
              </div>
            </div>
            {contactName === null ? null : <div className="noc-caption app-contact-label">{fromBook(contactName)}</div>}
            {helper}
            {firstTime ? (
              <div className="app-send-addr noc-mono">
                <AddressGroups address={address} />
              </div>
            ) : null}
          </div>
          <div className={`row amount-row${invalid ? ' app-row-dim' : short !== null || badAmount ? ' app-row-error' : ''}`}>
            <label className="lbl noc-overline" htmlFor="send-amount">
              Amount
            </label>
            <div className="amount-line">
              <input
                id="send-amount"
                className={`amount noc-balance-lg noc-numeral${short !== null || badAmount ? ' app-danger' : ''}`}
                placeholder="0.000000"
                inputMode="decimal"
                autoComplete="off"
                value={amountText}
                onChange={e => setAmountText(e.target.value.trim())}
              />
              <button type="button" className="max-chip" disabled={invalid || balance === null} onClick={max}>
                MAX
              </button>
            </div>
            {available}
            {token === 'SOL' && maxText !== null && amountText === maxText ? <div className="helper ok">{SEND_TEXT.maxHelper}</div> : null}
            {badAmount ? (
              <div className="helper error" role="alert">
                <ExtIcon name="alert" size={12} /> {SEND_TEXT.invalidAmount(decimals)}
              </div>
            ) : null}
            {short === null ? null : (
              <div className="helper error" role="alert">
                <ExtIcon name="alert" size={12} /> Insufficient balance — short by <span className="noc-numeral">{`${showExact(token, short)} ${token}`}</span>
              </div>
            )}
            {solShort ? (
              <div className="helper error" role="alert">
                <ExtIcon name="alert" size={12} /> {SEND_TEXT.feeWarning}
              </div>
            ) : null}
          </div>
          <div className={`row fee-row${invalid ? ' app-row-dim' : ''}`}>
            <div className="line">
              <span className="l noc-body-sm">Network fee</span>
              <span className="r noc-body-sm noc-numeral">{invalid ? '—' : `~${showLamports(BASE_FEE_LAMPORTS)} SOL`}</span>
            </div>
            <div className="line muted">
              <span className="l noc-body-sm">Priority</span>
              <span className="r noc-body-sm">{SEND_TEXT.priority}</span>
            </div>
          </div>
        </div>
        <div className="sticky-bar">
          <LockedButton className="btn btn-primary" disabled={!ready} onPress={review}>
            {label}
          </LockedButton>
        </div>
      </div>
      {/* #43 beside #12, not inside `.s-send`: there `.s-send .row` (#12's cards) would style the sheet's rows (Task 17). */}
      {sheet ? <TokenSheet balances={m.balances} prices={m.prices} selected={token} onSelect={setToken} onClose={() => setSheet(false)} /> : null}
    </>
  );
}
