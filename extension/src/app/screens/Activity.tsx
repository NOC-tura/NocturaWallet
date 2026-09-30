import {useCallback, useEffect, useRef, useState} from 'react';
import {useWallet} from '../WalletContext';
import {ACTIVITY_FILTER_KEY, readPref, writePref} from '../prefs';
import {FILTERS, isFilter, matches, rowText, type Filter} from '../history';
import {TOKEN_INFO, dateSection, timeOfDay} from '../format';
import {formatAmount} from '../../shared/amount';
import {useNow} from '../useNow';
import {ChipRow} from '../ui/Chip';
import {ExtIcon} from '../ui/ExtIcon';
import {Banner, RefusedBanner} from '../ui/Banner';
import type {HistoryItem, Pending} from '../engine';

/** wallet.history answers 10 per page (background HISTORY_PAGE_SIZE); "Load more" follows the reply's own `next` cursor (review fix round 1 #1), not this count. */
export const PAGE_SIZE = 10;

function PendingRow({p, now}: {p: Pending; now: number}) {
  const secs = Math.max(0, Math.floor((now - p.createdAt) / 1000));
  const amount = formatAmount(p.intent.amount, TOKEN_INFO[p.intent.token].decimals, {min: 0, max: TOKEN_INFO[p.intent.token].decimals});
  // Plan-1 stand-in: a pending row opens nothing (#21/#54 arrive with the send flow, plan 3).
  return (
    <div className="tx-row" data-pending={p.id}>
      <span className="ic send">
        <ExtIcon name="arrow-up-right" size={20} />
      </span>
      <div className="meta">
        <span className="pri noc-body-lg">
          Sending {amount} {p.intent.token}
        </span>
        <span className="sec noc-body-sm">
          waiting · {Math.floor(secs / 60)} m {secs % 60} s
        </span>
      </div>
    </div>
  );
}

/** #41 empty-activity (spec §6.4). */
function Empty({refreshing, onReceive}: {refreshing: boolean; onReceive: () => void}) {
  return (
    <div className="app-empty">
      <div className="s8-empty-illust">
        <div className="ring1" />
        <svg width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      {refreshing ? (
        <div className="s8-empty-copy">
          <h3 className="noc-h2">Checking the network…</h3>
          <p className="noc-body">Re-fetching through the Noctura server</p>
        </div>
      ) : (
        <div className="s8-empty-copy">
          <h3 className="noc-h2">No activity yet</h3>
          <p className="noc-body">Your transactions will appear here once you send or receive assets.</p>
        </div>
      )}
      <div className="app-empty-actions">
        <button type="button" className="btn btn-primary" onClick={onReceive}>
          <ExtIcon name="receive" size={18} />
          Receive crypto
        </button>
      </div>
      <p className="noc-caption app-muted app-center-text">Use the refresh button to check again.</p>
    </div>
  );
}

/**
 * #26 activity (spec §6.2) and #41 when there is nothing. Rows from wallet.history (10 a page, paced by
 * the background), open sends on top. No fiat per row (it would need historical prices), no origin
 * badge (B1c), counterparties short at equal weight (a list is a scanning aid; #27 shows the whole address).
 */
export function Activity({onTx, onReceive}: {onTx: (item: HistoryItem) => void; onReceive: () => void}) {
  const m = useWallet();
  const now = useNow(1_000, m.now);
  const account = m.account;
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  /**
   * The background's own paging cursor (review fix round 1 #1): the getSignaturesForAddress page's
   * last signature when that page was full, else null. Never derived from `items.length` — a
   * signature not yet indexed is dropped from `items` without shrinking the underlying RPC page, so
   * `[Load more]` and its `before` must follow this, not the last row that happened to decode.
   */
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(() => {
    const saved = readPref(ACTIVITY_FILTER_KEY);
    return isFilter(saved) ? saved : 'all';
  });
  const refused = m.net.mode === 'refused' || error === 'coordinator-refused';

  const key = account?.publicKey ?? null;
  const {engine, report, reached} = m;
  /**
   * A monotonic request token (review fix round 1 #4c): a load or "Load more" reply that lands after
   * a newer one started — a second click, or a fresh `load()` because the selected account changed
   * — is dropped rather than applied. Shared by `load` and `more`, so an account switch mid "Load
   * more" cannot mix a stale page into the new account's list: switching re-runs `load()` below,
   * which bumps this before the old request's reply can land.
   */
  const reqRef = useRef(0);
  const load = useCallback(async () => {
    if (key === null) return;
    const mine = ++reqRef.current;
    setBusy(true);
    const r = await engine.history(key);
    if (reqRef.current !== mine) return; // superseded while in flight: its reply is dropped
    setBusy(false);
    if (r.ok) {
      setItems(r.data.items);
      setNext(r.data.next);
      setError(null);
      // A good read is the whole app's news too (#42: unreachable → reconnecting), as Home's refresh.
      reached();
    } else {
      setError(r.error);
      report(r.error);
    }
  }, [key, engine, report, reached]);

  /**
   * Read on open, and whenever the selected account changes — ALWAYS: an account switch resets
   * to that account's own (empty, unloaded) state first, then loads only if not refused (review fix
   * round 2 #1). Before this, a switch while refused left the previous account's rows and `next` on
   * screen under the new account — "Load more" would then ask `history(B, A's cursor)` and append
   * B's rows onto A's, and A's own rows still opened as #27 under B. `reqRef` is bumped even when
   * the load is skipped, so a reply still in flight for the account being left is dropped too. After
   * this effect, only the refresh button reads (D2).
   */
  useEffect(() => {
    reqRef.current += 1;
    setItems(null);
    setNext(null);
    setError(null);
    if (m.net.mode !== 'refused') void load();
  }, [load]);

  const more = async () => {
    if (account === null || items === null || next === null) return;
    const mine = ++reqRef.current;
    setBusy(true);
    const r = await m.engine.history(account.publicKey, next);
    if (reqRef.current !== mine) return; // superseded (account changed, or another request started)
    setBusy(false);
    if (r.ok) {
      setItems(prev => [...(prev ?? []), ...r.data.items]);
      setNext(r.data.next);
      m.reached();
    } else {
      setError(r.error);
      m.report(r.error);
    }
  };

  const choose = (f: Filter) => {
    setFilter(f);
    writePref(ACTIVITY_FILTER_KEY, f);
  };

  const open = m.pending.filter(p => p.account === account?.publicKey && (p.state === 'pending' || p.state === 'stuck'));
  const shown = (items ?? []).filter(i => matches(i, filter));
  const accounts = m.wallet?.accounts ?? [];
  const sections: {title: string; rows: HistoryItem[]}[] = [];
  for (const item of shown) {
    const title = dateSection(item.blockTime === null ? null : item.blockTime * 1000, now);
    const last = sections[sections.length - 1];
    if (last !== undefined && last.title === title) last.rows.push(item);
    else sections.push({title, rows: [item]});
  }

  const banner = refused ? (
    <RefusedBanner />
  ) : error === 'unreachable' ? (
    <Banner tone="warning" icon="wifi-off" title={m.net.mode === 'offline' ? "You're offline" : 'Could not reach the Noctura server'} />
  ) : null;

  const top = (
    <div className="s-vi-top">
      <div className="left">
        <h1 className="noc-h1">Activity</h1>
      </div>
      <div className="right">
        <button type="button" className={`icon-btn${busy ? ' is-spinning' : ''}`} aria-label="Refresh" disabled={refused || busy} onClick={() => void load()}>
          <ExtIcon name="refresh" size={22} />
        </button>
      </div>
    </div>
  );

  // #41 needs items truly exhausted (next === null) too: a full page of not-yet-indexed signatures
  // decodes to zero items but is not "empty" — Load more must still offer the next page (review fix
  // round 1 #1).
  if (items !== null && items.length === 0 && next === null && open.length === 0 && error === null) {
    return (
      <div className="screen s-act">
        {top}
        <Empty refreshing={busy} onReceive={onReceive} />
      </div>
    );
  }

  return (
    <div className="screen s-act">
      {top}
      <ChipRow options={FILTERS} active={filter} onChange={choose} label="Filter" />
      {banner}
      <div className="scroll">
        {open.length > 0 ? (
          <>
            <div className="date-h noc-overline">PENDING</div>
            {open.map(p => (
              <PendingRow key={p.id} p={p} now={now} />
            ))}
          </>
        ) : null}
        {items === null && error === null && !refused ? (
          <div data-testid="skeleton">
            {['TODAY', 'YESTERDAY'].map((t, s) => (
              <div key={t}>
                <div className="date-h noc-overline">{t}</div>
                {Array.from({length: s === 0 ? 2 : 3}, (_, i) => (
                  <div className="tx-row skel" key={i}>
                    <span className="ic" />
                    <div className="meta">
                      <span className="pri" />
                      <span className="sec" />
                    </div>
                    <span className="amt" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : null}
        {sections.map(s => (
          <div key={s.title}>
            <div className="date-h noc-overline">{s.title}</div>
            {s.rows.map(item => {
              const t = rowText(item, accounts);
              const time = item.blockTime === null ? '' : ` · ${timeOfDay(item.blockTime * 1000)}`;
              return (
                <button type="button" className="tx-row" key={item.signature} onClick={() => onTx(item)}>
                  <span className={`ic ${t.tone}`}>
                    <ExtIcon name={t.tone === 'fail' ? 'close' : 'arrow-up-right'} size={20} />
                  </span>
                  <span className="meta">
                    <span className="pri noc-body-lg">{t.title}</span>
                    <span className="sec noc-body-sm">
                      {t.meta}
                      {time}
                    </span>
                  </span>
                  <span className={`amt noc-body-lg noc-numeral${t.tone === 'recv' ? ' up' : t.tone === 'fail' ? ' fail' : ''}`}>{t.amount}</span>
                </button>
              );
            })}
          </div>
        ))}
        {next !== null ? (
          <button type="button" className="btn btn-secondary app-load-more" disabled={busy || refused} onClick={() => void more()}>
            Load more
          </button>
        ) : null}
      </div>
    </div>
  );
}
