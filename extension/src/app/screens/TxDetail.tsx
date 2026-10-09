import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {useWallet} from '../WalletContext';
import {TOKEN_INFO, ago, feeUsd, fullDate, showAmount, showFee, showUsd} from '../format';
import {explorerUrl} from '../explorer';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {TopBar} from '../ui/TopBar';
import {StatusPill} from '../ui/StatusPill';
import {ExtIcon} from '../ui/ExtIcon';
import {useCopy} from '../ui/useCopy';
import {useNow} from '../useNow';
import {Banner, RefusedBanner} from '../ui/Banner';
import {LockedButton} from '../ui/LockedButton';
import {ContactSheet, type ContactSheetMode} from '../ui/ContactSheet';
import {fromBook} from '../addressBook';
import type {Contact, HistoryItem, Intent} from '../engine';
import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';

/** At most this many history pages are read to find a signature the list has not loaded. */
export const FIND_PAGES = 3;
const MINUS = '−';

function Row({label, children}: {label: string; children: ReactNode}) {
  return (
    <div className="detail-row">
      <span className="lbl noc-body-sm">{label}</span>
      <span className="val">{children}</span>
    </div>
  );
}

/**
 * The design's inline `.copy-btn` (index.html 12115, 12347: the copy glyph, then "Copy"), with
 * CopyButton's honesty through useCopy: "Copied" only when the clipboard took it, "Copy failed"
 * otherwise; the accessible name says which address while idle.
 */
function CopyBtn({value, label}: {value: string; label: string}) {
  const [state, copy] = useCopy();
  const text = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy';
  return (
    <button type="button" className="copy-btn" aria-label={state === 'idle' ? label : text} onClick={() => copy(value)}>
      <ExtIcon name={state === 'copied' ? 'check' : state === 'failed' ? 'close' : 'copy'} size={14} />
      {text}
    </button>
  );
}

function Address({address, label}: {address: string; label: string}) {
  return (
    <>
      <span className="mono-addr">
        <AddressGroups address={address} />
      </span>
      <CopyBtn value={address} label={label} />
    </>
  );
}

/** The one external link (§6.5): #27's [Explorer], and #44's [View on explorer] (plan 3) — one place builds the href. */
export function ExplorerLink({signature, label = 'Explorer', icon = true, className = 'btn btn-secondary'}: {signature: string; label?: string; icon?: boolean; className?: string}) {
  const href = explorerUrl(signature);
  if (href === null) return null;
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {icon ? <ExtIcon name="link-out" size={16} /> : null}
      {label}
    </a>
  );
}

/**
 * #27 tx-detail (spec §6.3), from the #26 row (or, when only the signature is known, the first
 * FIND_PAGES history pages). No Block or Memo rows (not in HistoryView, G13), no share (D19); fiat is
 * today's price and says "now". A failed send offers [Try again] → #19 with what it tried to send, when
 * the decoder knows the recipient and the amount (plan 3, owner question 1, option A): #19 prepares it
 * afresh and #20 shows the whole address before one tap sends.
 *
 * B1b-2b plan 2 (§6.3): beside [Explorer], [Save] on a send (27a, ix:12143) and [Save sender] on a receive (27c,
 * ix:12272) open the contact sheet for the counter-party — prefilled, or the edit sheet when it is saved (ix:12384).
 * From a receive the sheet warns: "…— it only sent to you." for a sender never sent to, and the dust banner with
 * "Save anyway" below C18's floor (review H3). The To / From label is own > treasury > contact. Purchase, other and
 * failed rows get no button; nor does any row while the book is unread (a refused read hides it) or is being re-read
 * after the sheet closed (Task 7 fix round 1, I1): Save opens "add" or "edit" from a fresh read, never a stale one.
 */
export function TxDetail({
  signature,
  account: owner,
  item: given,
  canRetry,
  onBack,
  onTryAgain,
}: {
  signature: string;
  /**
   * The account whose transaction this is — #27's route carries it (#26's account, or the account #21 follows). The
   * search, the From/To framing and the sender's name read it, never the selected account (fix round 2): #27 opened
   * from #21 for A while B is selected still shows A's transaction as A's.
   */
  account: string;
  item?: HistoryItem;
  /** False while another account than the transaction's owner is selected: no [Try again] (fix round 1). */
  canRetry: boolean;
  onBack: () => void;
  onTryAgain: (intent: Intent) => void;
}) {
  const m = useWallet();
  const now = useNow(30_000, m.now);
  const [item, setItem] = useState<HistoryItem | null | undefined>(given);
  /**
   * Set only when the by-signature search itself fails to reach or was refused by the coordinator
   * (review fix round 1 #2): §7.2/§7.3 never let a network failure read as "not in the recent
   * history" — that line is reserved for a real, answered search that came up empty. `item` stays
   * `undefined` (still "searching") while this is set, so the render below shows the net-state
   * banner instead, with the explorer link kept (the signature is already known).
   */
  const [searchError, setSearchError] = useState<string | null>(null);
  /** Plan 2: the address book (labels, and whether the counter-party is saved); null until read, or refused. */
  const [book, setBook] = useState<Contact[] | null>(null);
  const [sheet, setSheet] = useState<ContactSheetMode | null>(null);
  /**
   * The sheet closed and #27 has not read the book since (Task 7 fix round 1, I1, carried): what it holds may be old — a
   * save that landed, here or elsewhere. No Save button until the re-read answers: an "add" sheet for an address saved by
   * then would silently rename it.
   */
  const [bookStale, setBookStale] = useState(false);
  /**
   * Bumped when #27 goes (unmount) and when another account is selected under it: a book answer to an older generation
   * is dropped — it sets nothing and reloads nothing. #27 stays on a switch (it shows the route owner's transaction), so
   * the switch reads the book afresh.
   */
  const gen = useRef(0);
  const selected = m.account?.publicKey ?? null;
  const {engine, reload} = m;
  const readBook = useCallback(async () => {
    const g = gen.current;
    const r = await engine.contacts();
    if (gen.current !== g) return;
    if (r.ok) {
      setBook(r.data.contacts);
      setBookStale(false);
    } else if (r.error === 'locked') void reload();
  }, [engine, reload]);
  useEffect(() => {
    void readBook();
    return () => {
      gen.current += 1;
    };
  }, [readBook, selected]);

  /**
   * The by-signature search. Unreachable in plan 1 (final review M4): App opens #27 only from an
   * Activity row and always passes that row's `item`, so `given` is never undefined there. It is the
   * plumbing for #21 in plan 3, which opens #27 with a signature only; its tests
   * (TxDetail.test.tsx) keep it honest until then.
   */
  // The provider's open sequence has run (an account is known): the search starts after it, as before fix round 2, so
  // the open sequence's own reads never land after the search's report and overwrite it (review fix round 1 #4a).
  // Only a readiness flag — the lookup never reads the selected account, and a switch (non-null to non-null) is no
  // change here.
  const ready = m.account !== null;
  useEffect(() => {
    if (given !== undefined || !ready) return;
    // The owner comes from the route, an address the router checked (fix round 2) — never '' and never the selected
    // account: another account selected mid-search changes nothing here, and the search goes on for the owner.
    const ownerKey = owner;
    let alive = true;
    void (async () => {
      let before: string | undefined;
      for (let page = 0; page < FIND_PAGES; page++) {
        const r = await m.engine.history(ownerKey, before);
        if (!alive) return;
        if (!r.ok) {
          m.report(r.error);
          setSearchError(r.error);
          return; // stop: no further page is read once the search itself has failed
        }
        // An answered page is a good read for the whole app (#42: unreachable → reconnecting).
        m.reached();
        const hit = r.data.items.find(i => i.signature === signature);
        if (hit !== undefined) return setItem(hit);
        if (r.data.next === null) break;
        before = r.data.next;
      }
      if (alive) setItem(null);
    })();
    return () => {
      alive = false;
    };
  }, [given, ready, owner, signature, m.engine]);

  const top = <TopBar title="Transaction" onBack={onBack} titleClass="noc-h3" />;
  if (item === undefined) {
    if (searchError !== null) {
      // #42/D26 banner over the search, exactly as Activity shows it — never the not-in-history line.
      // A code that is neither (review fix round 2 #3: 'malformed' — defensive; the client never
      // sends a bad account or `before`, but a bare screen with no message at all was a real bug) gets
      // a fixed line instead of nothing.
      const refused = m.net.mode === 'refused' || searchError === 'coordinator-refused';
      const netBanner = refused ? (
        <RefusedBanner />
      ) : searchError === 'unreachable' ? (
        <Banner tone="warning" icon="wifi-off" title={m.net.mode === 'offline' ? "You're offline" : 'Could not reach the Noctura server'} />
      ) : (
        <p className="noc-body app-muted">Could not read this transaction.</p>
      );
      return (
        <div className="screen s-txd">
          {top}
          <div className="scroll">
            {netBanner}
            <div className="actions-row">
              <ExplorerLink signature={signature} />
            </div>
          </div>
        </div>
      );
    }
    return <div className="screen s-txd">{top}</div>;
  }
  if (item === null) {
    return (
      <div className="screen s-txd">
        {top}
        <div className="scroll">
          <p className="noc-body app-muted">This transaction is not in the recent history yet.</p>
          <div className="actions-row">
            <ExplorerLink signature={signature} />
          </div>
        </div>
      </div>
    );
  }

  const accounts = m.wallet?.accounts ?? [];
  /** The owner's own entry (its name on the From row), when it is one of this wallet's accounts. */
  const ownerAccount = accounts.find(a => a.publicKey === owner);
  const savedAs = (address: string | null): Contact | undefined => (address === null ? undefined : book?.find(c => c.address === address));
  /** own > treasury > contact (E17): a contact's name never stands in for "Your account" or the treasury. */
  const labelOf = (address: string | null): string | null => {
    if (address === null) return null;
    const own = accounts.find(a => a.publicKey === address);
    if (own !== undefined) return `Your account: ${own.name}`;
    if (address === MAINNET_FEE_TREASURY) return 'Noctura treasury';
    const contact = savedAs(address);
    return contact === undefined ? null : fromBook(contact.name);
  };
  const price = item.token === null ? null : item.token === 'NOC' ? null : m.prices?.[item.token === 'SOL' ? 'sol' : item.token === 'USDC' ? 'usdc' : 'usdt'] ?? null;
  const fiat = item.amount === null || item.token === null || price === null ? null : (Number(item.amount) / 10 ** TOKEN_INFO[item.token].decimals) * price;
  const date = item.blockTime === null ? '—' : fullDate(item.blockTime * 1000);
  // The fee in SOL, grouped, with today's dollars (index.html 12136: "0.000 005 SOL · $0.0007").
  const solPrice = m.prices?.sol ?? null;
  const feeFiat = feeUsd(solPrice === null ? null : (Number(item.feeLamports) / 1e9) * solPrice);
  const fee = `${showFee(item.feeLamports)} SOL`;
  const hash = <Address address={item.signature} label="Copy hash" />;

  if (item.failed) {
    const retry: Intent | null = canRetry && item.kind === 'sent' && item.token !== null && item.counterparty !== null && item.amount !== null && item.amount > 0n ? {token: item.token, recipient: item.counterparty, amount: item.amount} : null;
    return (
      <div className="screen s-txd">
        {top}
        <div className="scroll">
          {/* §7.2 (D26; final review M2, carry c): the banner says why [Try again] is disabled. */}
          {m.net.mode === 'refused' ? <RefusedBanner /> : null}
          <div className="amount-card app-failed">
            {/*
              A failed send carries what it tried to send (core/solana/history.ts, plan 3 owner question 1,
              option A): "FAILED · SENT" and "— SOL", as 27d draws a failed card. Any other failed transaction
              has no kind or token to name: "FAILED" and "—".
            */}
            <div className="eyebrow noc-overline">{item.kind === 'sent' ? 'FAILED · SENT' : 'FAILED'}</div>
            <div className="amt noc-balance-lg noc-numeral">{item.token === null ? '—' : `— ${item.token}`}</div>
            <div className="fiat noc-body noc-numeral">Fee charged · {feeFiat}</div>
            <StatusPill text="Failed" fail />
          </div>
          <Banner tone="danger" title="The transaction failed on chain. The network fee was charged; the amount did not move." />
          <div className="detail-card">
            <Row label="Hash">{hash}</Row>
            <Row label="Network fee charged">
              <span className="noc-body noc-numeral">{fee}</span>
            </Row>
            <Row label="Date">
              <span className="noc-body">{date}</span>
            </Row>
          </div>
          <div className="actions-row">
            {retry === null ? null : (
              <LockedButton className="btn btn-primary" disabled={m.net.mode === 'refused'} onPress={() => onTryAgain(retry)}>
                <ExtIcon name="refresh" size={16} />
                Try again
              </LockedButton>
            )}
            <ExplorerLink signature={item.signature} />
          </div>
        </div>
      </div>
    );
  }

  if (item.kind === 'purchase' || item.kind === 'other') {
    return (
      <div className="screen s-txd">
        {top}
        <div className="scroll">
          <div className="amount-card">
            <div className="eyebrow noc-overline">{item.kind === 'purchase' ? 'PRESALE PURCHASE' : 'OTHER'}</div>
            {item.amount !== null && item.token !== null ? (
              <div className="amt noc-balance-lg noc-numeral">
                {MINUS}
                {showAmount(item.token, item.amount)} {item.token}
              </div>
            ) : null}
            <StatusPill text="Confirmed" />
          </div>
          <div className="detail-card">
            <Row label="Hash">{hash}</Row>
            <Row label="Network fee">
              <span className="noc-body noc-numeral">
                {fee} · {feeFiat}
              </span>
            </Row>
            <Row label="Date">
              <span className="noc-body">{date}</span>
            </Row>
          </div>
          <div className="actions-row">
            <ExplorerLink signature={item.signature} />
          </div>
        </div>
      </div>
    );
  }

  const sent = item.kind === 'sent';
  const token = item.token ?? 'SOL';
  const toLabel = labelOf(item.counterparty);
  const counterparty = item.counterparty;
  const saved = savedAs(counterparty);
  const open = () => {
    if (counterparty === null || book === null || bookStale) return;
    setSheet(saved === undefined ? {kind: 'add', address: counterparty} : {kind: 'edit', address: counterparty, name: saved.name});
  };
  return (
    <>
      <div className="screen s-txd">
        {top}
        <div className="scroll">
          <div className="amount-card">
            <div className="eyebrow noc-overline">{sent ? 'SENT' : 'RECEIVED'}</div>
            <div className={`amt noc-balance-lg noc-numeral${sent ? '' : ' app-amt-in'}`}>
              {sent ? MINUS : '+'}
              {item.amount === null ? '—' : showAmount(token, item.amount)} {token}
            </div>
            {fiat === null ? null : <div className="fiat noc-body noc-numeral">≈ {showUsd(fiat)} now</div>}
            {/* 27c carries the age ("Confirmed · 8h ago"); 27a does not. */}
            <StatusPill text={!sent && item.blockTime !== null ? `Confirmed · ${ago(item.blockTime * 1000, now)}` : 'Confirmed'} />
          </div>
          <div className="detail-card">
            <Row label="Type">
              <span className="noc-body">{token === 'SOL' ? 'Transfer' : `${token} transfer`}</span>
            </Row>
            {sent ? (
              <>
                <Row label="From">
                  <span className="noc-body-sm">{ownerAccount?.name}</span>
                  <Address address={owner} label="Copy sender" />
                </Row>
                <Row label="To">
                  {toLabel === null ? null : <span className="noc-body-sm">{toLabel}</span>}
                  {item.counterparty === null ? <span className="noc-body">—</span> : <Address address={item.counterparty} label="Copy recipient" />}
                </Row>
              </>
            ) : (
              <>
                <Row label="From">
                  {toLabel === null ? null : <span className="noc-body-sm">{toLabel}</span>}
                  {item.counterparty === null ? <span className="noc-body">—</span> : <Address address={item.counterparty} label="Copy sender" />}
                </Row>
                <Row label="To">
                  <span className="noc-body-sm noc-accent">Your wallet</span>
                  <Address address={owner} label="Copy recipient" />
                </Row>
              </>
            )}
            <Row label="Hash">{hash}</Row>
            <Row label="Network fee">
              <span className="noc-body noc-numeral">{sent ? `${fee} · ${feeFiat}` : 'Paid by sender'}</span>
            </Row>
            <Row label="Date">
              <span className="noc-body">{date}</span>
            </Row>
          </div>
          <div className="actions-row">
            <ExplorerLink signature={item.signature} />
            {book === null || bookStale || counterparty === null ? null : (
              <LockedButton className="btn btn-secondary" onPress={open}>
                <ExtIcon name="bookmark" size={16} />
                {sent ? 'Save' : 'Save sender'}
              </LockedButton>
            )}
          </div>
        </div>
      </div>
      {/* Beside `.s-txd`, not inside (as #43 beside #12). */}
      {sheet === null ? null : (
        <ContactSheet
          mode={sheet}
          received={sent ? undefined : {token: item.token, amount: item.amount}}
          onClose={() => {
            // Every close re-reads the book (Task 7 fix round 1, I1): Save comes back from a fresh read, never a stale one.
            setSheet(null);
            setBookStale(true);
            void readBook();
          }}
          onSaved={() => {
            setSheet(null);
            setBookStale(true);
            void readBook();
          }}
        />
      )}
    </>
  );
}
