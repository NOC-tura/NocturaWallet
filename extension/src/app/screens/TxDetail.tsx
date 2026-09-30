import {useEffect, useState, type ReactNode} from 'react';
import {useWallet} from '../WalletContext';
import {TOKEN_INFO, fullDate, showAmount, showSol, showUsd} from '../format';
import {explorerUrl} from '../explorer';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {CopyButton} from '../../../../web/src/ui/CopyButton';
import {TopBar} from '../ui/TopBar';
import {StatusPill} from '../ui/StatusPill';
import {ExtIcon} from '../ui/ExtIcon';
import {Banner, RefusedBanner} from '../ui/Banner';
import type {HistoryItem} from '../engine';
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

function Address({address, label}: {address: string; label: string}) {
  return (
    <>
      <span className="mono-addr">
        <AddressGroups address={address} />
      </span>
      <CopyButton value={address} label={label} />
    </>
  );
}

export function ExplorerLink({signature}: {signature: string}) {
  const href = explorerUrl(signature);
  if (href === null) return null;
  return (
    <a className="btn btn-secondary" href={href} target="_blank" rel="noopener noreferrer">
      <ExtIcon name="link-out" size={16} />
      Explorer
    </a>
  );
}

/**
 * #27 tx-detail (spec §6.3), from the #26 row (or, when only the signature is known, the first
 * FIND_PAGES history pages). No Block or Memo rows (not in HistoryView, G13), no Save (address book,
 * B1b-2b), no share (D19); fiat is today's price and says "now". Plan-1 stand-in: no [Try again].
 */
export function TxDetail({signature, item: given, onBack}: {signature: string; item?: HistoryItem; onBack: () => void}) {
  const m = useWallet();
  const [item, setItem] = useState<HistoryItem | null | undefined>(given);
  /**
   * Set only when the by-signature search itself fails to reach or was refused by the coordinator
   * (review fix round 1 #2): §7.2/§7.3 never let a network failure read as "not in the recent
   * history" — that line is reserved for a real, answered search that came up empty. `item` stays
   * `undefined` (still "searching") while this is set, so the render below shows the net-state
   * banner instead, with the explorer link kept (the signature is already known).
   */
  const [searchError, setSearchError] = useState<string | null>(null);
  const account = m.account;
  const owner = account?.publicKey ?? '';

  useEffect(() => {
    if (given !== undefined) return;
    // The open sequence has not set the account yet: wait for it rather than search with ''
    // (review fix round 1 #4a) — the effect re-runs once `account` is set, below.
    if (account === null) return;
    const ownerKey = account.publicKey;
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
  }, [given, account, signature, m.engine]);

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
  const labelOf = (address: string | null): string | null => {
    if (address === null) return null;
    const own = accounts.find(a => a.publicKey === address);
    if (own !== undefined) return `Your account: ${own.name}`;
    return address === MAINNET_FEE_TREASURY ? 'Noctura treasury' : null;
  };
  const price = item.token === null ? null : item.token === 'NOC' ? null : m.prices?.[item.token === 'SOL' ? 'sol' : item.token === 'USDC' ? 'usdc' : 'usdt'] ?? null;
  const fiat = item.amount === null || item.token === null || price === null ? null : (Number(item.amount) / 10 ** TOKEN_INFO[item.token].decimals) * price;
  const date = item.blockTime === null ? '—' : fullDate(item.blockTime * 1000);
  const hash = <Address address={item.signature} label="Copy hash" />;

  if (item.failed) {
    return (
      <div className="screen s-txd">
        {top}
        <div className="scroll">
          <div className="amount-card">
            <div className="eyebrow noc-overline">{item.kind === 'sent' ? 'FAILED · SENT' : 'FAILED'}</div>
            <div className="amt noc-balance-lg noc-numeral">{item.token === null ? '—' : `— ${item.token}`}</div>
            <div className="fiat noc-body">Fee charged</div>
            <StatusPill text="Failed" fail />
          </div>
          <Banner tone="danger" title="The transaction failed on chain. The network fee was charged; the amount did not move." />
          <div className="detail-card">
            <Row label="Hash">{hash}</Row>
            <Row label="Network fee charged">
              <span className="noc-body noc-numeral">{showSol(item.feeLamports)} SOL</span>
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
              <span className="noc-body noc-numeral">{showSol(item.feeLamports)} SOL</span>
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
  return (
    <div className="screen s-txd">
      {top}
      <div className="scroll">
        <div className="amount-card">
          <div className="eyebrow noc-overline">{sent ? 'SENT' : 'RECEIVED'}</div>
          <div className="amt noc-balance-lg noc-numeral">
            {sent ? MINUS : '+'}
            {item.amount === null ? '—' : showAmount(token, item.amount)} {token}
          </div>
          {fiat === null ? null : <div className="fiat noc-body noc-numeral">≈ {showUsd(fiat)} now</div>}
          <StatusPill text="Confirmed" />
        </div>
        <div className="detail-card">
          {sent ? (
            <>
              <Row label="Type">
                <span className="noc-body">{token === 'SOL' ? 'Transfer' : `${token} transfer`}</span>
              </Row>
              <Row label="From">
                <span className="noc-body-sm">{account?.name}</span>
                <Address address={owner} label="Copy sender" />
              </Row>
              <Row label="To">
                {toLabel === null ? null : <span className="noc-body-sm">{toLabel}</span>}
                {item.counterparty === null ? <span className="noc-body">—</span> : <Address address={item.counterparty} label="Copy recipient" />}
              </Row>
            </>
          ) : (
            <>
              <Row label="From">{item.counterparty === null ? <span className="noc-body">—</span> : <Address address={item.counterparty} label="Copy sender" />}</Row>
              <Row label="To">
                <span className="noc-body-sm">Your wallet</span>
                <Address address={owner} label="Copy recipient" />
              </Row>
            </>
          )}
          <Row label="Hash">{hash}</Row>
          <Row label="Network fee">
            <span className="noc-body noc-numeral">{sent ? `${showSol(item.feeLamports)} SOL` : 'Paid by sender'}</span>
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
