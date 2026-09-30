import {useState} from 'react';
import {useWallet, sustained, type NetMode} from '../WalletContext';
import {valuation} from '../valuation';
import {TOKEN_INFO, ago, agoLong, clock, showAmount, showUsd, usdParts} from '../format';
import {formatAmount} from '../../shared/amount';
import {HIDE_BALANCES_KEY, readPref, writePref} from '../prefs';
import {useNow} from '../useNow';
import {ExtIcon} from '../ui/ExtIcon';
import {RefusedBanner} from '../ui/Banner';
import {SkelCircle, SkelLine} from '../ui/Skeleton';
import {TokenTile} from '../ui/TokenTile';
import type {Pending, Token} from '../engine';

/** #42's banner: offline is navigator's word; unreachable says the server did not answer (review L3). */
function NetBanner({mode, sustainedNow, lastSync, failures, now}: {mode: NetMode; sustainedNow: boolean; lastSync: number | null; failures: number; now: number}) {
  if (mode === 'reconnecting') {
    return (
      <div className="s8-offline-banner success app-banner" role="status">
        <ExtIcon name="check" size={18} />
        <div>
          <p>Connected · syncing</p>
          <div className="meta noc-caption">Auto-dismisses in 1.5 s</div>
        </div>
      </div>
    );
  }
  if (mode !== 'offline' && mode !== 'unreachable') return null;
  const title = mode === 'offline' ? (sustainedNow ? "You're offline · Showing cached data" : "You're offline") : 'Could not reach the Noctura server';
  const line = sustainedNow
    ? `Last synced ${lastSync === null ? 'never' : agoLong(lastSync, now)} · ${failures} ${failures === 1 ? 'retry' : 'retries'} failed`
    : mode === 'offline'
      ? 'Network just dropped · the Noctura server is unreachable'
      : 'Showing your last synced balances.';
  return (
    <div className="s8-offline-banner warn app-banner" role="alert">
      <ExtIcon name="wifi-off" size={18} />
      <div>
        <p>{title}</p>
        <div className="meta">{line}</div>
      </div>
    </div>
  );
}

/** #11's pending strip (plan-1 stand-in: it opens Activity, not #21/#54). */
function PendingStrip({p, now, onOpen}: {p: Pending; now: number; onOpen: () => void}) {
  const slow = p.state === 'stuck' || now - p.createdAt > 80_000;
  const amount = formatAmount(p.intent.amount, TOKEN_INFO[p.intent.token].decimals, {min: 0, max: TOKEN_INFO[p.intent.token].decimals});
  return (
    <button type="button" className="banner info app-banner app-strip" onClick={onOpen}>
      <ExtIcon name="send" size={18} />
      <span className="noc-body-sm">
        Sending {amount} {p.intent.token} · {slow ? 'taking longer than usual' : 'pending'}
      </span>
    </button>
  );
}

const HIDDEN_ROW = '••••••';

/**
 * #11 dashboard (spec §5.1) with #42's offline states and the D26 refused state (§5.4). Plan-1
 * stand-ins, stated in the plan: no Send quick action (the send flow is plan 3), and the pending
 * strip opens Activity.
 */
export function Home({onReceive, onActivity, onAccounts}: {onReceive: () => void; onActivity: () => void; onAccounts: () => void}) {
  const m = useWallet();
  const now = useNow();
  const [hidden, setHidden] = useState(() => readPref(HIDE_BALANCES_KEY) === '1');
  const toggleHidden = () => {
    setHidden(h => {
      writePref(HIDE_BALANCES_KEY, h ? '0' : '1');
      return !h;
    });
  };
  const account = m.account;
  const mode = m.net.mode;
  const refused = mode === 'refused';
  const away = mode === 'offline' || mode === 'unreachable';
  const long = sustained(m.net, now);
  const stale = m.stale || away || refused;
  const open = m.pending.find(p => p.account === account?.publicKey && (p.state === 'pending' || p.state === 'stuck'));

  const top = (
    <div className="top">
      <button type="button" className="app-account" aria-label="Accounts" onClick={onAccounts}>
        <span className="avatar">{(account?.name ?? '?').slice(0, 1).toUpperCase()}</span>
        <span className="noc-body-lg app-account-name">{account?.name ?? ''}</span>
        <ExtIcon name="chevron-down" size={16} />
      </button>
      <div className="top-actions">
        <button type="button" aria-label="Refresh" className={m.refreshing ? 'is-spinning' : undefined} disabled={refused || m.refreshing} onClick={() => void m.refresh()}>
          <ExtIcon name="refresh" size={22} />
        </button>
      </div>
    </div>
  );

  if (m.balances === null) {
    // Cold mount: no cache yet, nothing read yet.
    return (
      <div className="screen s-dash" aria-busy="true">
        {top}
        {refused ? <RefusedBanner /> : <NetBanner mode={mode} sustainedNow={long} lastSync={m.lastSync} failures={m.net.failures} now={now} />}
        <div className="hero">
          <SkelLine width={90} height={14} />
          <SkelLine width={200} height={44} />
          <SkelLine width={140} height={14} />
        </div>
        <div className="tokens" data-testid="skeleton">
          {[60, 54, 64, 50].map(w => (
            <div className="row" key={w}>
              <SkelCircle />
              <div className="meta">
                <SkelLine width={w} height={13} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const v = valuation(m.balances, m.prices);
  const tokens: Token[] = (['SOL', 'NOC', 'USDC', 'USDT'] as const).filter(t => t === 'SOL' || t === 'NOC' || v.rows[t].base > 0n);
  const priceAt = m.prices?.at ?? null;
  const label = long && m.lastSync !== null ? `Stale · ${clock(m.lastSync)}` : stale && m.balancesAt !== null ? `Total balance · cached ${ago(m.balancesAt, now)}` : 'Total balance';
  const rowNote = mode === 'reconnecting' ? 'live' : long ? 'stale' : stale ? 'cached' : null;
  const solPrice = m.prices?.sol ?? null;

  return (
    <div className="screen s-dash">
      {top}
      {refused ? <RefusedBanner /> : <NetBanner mode={mode} sustainedNow={long} lastSync={m.lastSync} failures={m.net.failures} now={now} />}
      {open === undefined ? null : <PendingStrip p={open} now={now} onOpen={onActivity} />}
      <section className={`hero${stale ? ' s8-stale' : ''}`}>
        <div className="label-row">
          <div className="left">
            <span className={`noc-overline${long ? ' app-warning' : ''}`}>{label}</span>
          </div>
          <button type="button" className="eye-btn" aria-label={hidden ? 'Show balance' : 'Hide balance'} onClick={toggleHidden}>
            <ExtIcon name={hidden ? 'eye-off' : 'eye'} size={20} />
          </button>
        </div>
        {hidden ? (
          <div className="balance">
            <span className="noc-body app-reveal">Tap eye to reveal</span>
          </div>
        ) : v.total === null ? (
          <div className="balance">
            <span className="real noc-balance-xl noc-numeral">—</span>
            <div className="noc-caption app-muted">Prices unavailable</div>
          </div>
        ) : (
          <div className="balance">
            <span className="real noc-balance-xl noc-numeral">{usdParts(v.total).whole}</span>
            <span className="cents noc-numeral">{usdParts(v.total).cents}</span>
          </div>
        )}
        {away && !hidden && m.lastSync !== null ? (
          <div className="noc-body-sm app-muted">
            {v.total !== null && solPrice !== null ? `≈ ${(Math.floor((v.total / solPrice) * 100) / 100).toFixed(2)} SOL · ` : ''}last synced {clock(m.lastSync)}
          </div>
        ) : null}
        {long ? <div className="noc-caption app-warning">prices may have moved</div> : null}
        <div className="sub-balance noc-body-sm">
          <div>
            <b className="noc-numeral">{hidden ? '••••' : showAmount('SOL', m.balances.sol)}</b>
            <span>SOL</span>
          </div>
          <span className="dot" />
          <div>
            <b className="noc-numeral">{hidden ? '••••' : showAmount('NOC', m.balances.noc)}</b>
            <span>NOC</span>
          </div>
        </div>
      </section>
      <div className="quick">
        <button type="button" className="qa" onClick={onReceive}>
          <span className="icon">
            <ExtIcon name="receive" size={18} />
          </span>
          <span className="lbl">Receive</span>
        </button>
      </div>
      {away ? <p className="noc-caption app-muted app-offline-note">Sending needs a network connection. Receiving works — your address is on this device. Use the refresh button to retry.</p> : null}
      {away && long ? (
        <div className="banner info app-banner app-callout">
          <ExtIcon name="info" size={18} />
          <div className="noc-body-sm">
            <div>What you can still do offline:</div>
            <ul>
              <li>Read your last synced balances</li>
              <li>Show your address to receive funds</li>
              <li>Lock the wallet from Settings</li>
            </ul>
          </div>
        </div>
      ) : null}
      <div className="section-h">
        <h3 className="noc-overline">TOKENS</h3>
      </div>
      <div className={`tokens${stale ? ' s8-stale' : ''}`}>
        {tokens.map(t => {
          const row = v.rows[t];
          return (
            <div className="row" key={t} data-token={t}>
              <TokenTile token={t} />
              <div className="meta">
                <div className="pri noc-body-lg">{TOKEN_INFO[t].name}</div>
                <div className="sec noc-body-sm noc-numeral">
                  {hidden ? `${HIDDEN_ROW} ${t}` : `${showAmount(t, row.base)} ${t}`}
                  {rowNote === 'cached' ? ' · cached' : ''}
                </div>
              </div>
              <div className="price">
                <div className="pri noc-body-lg noc-numeral">{hidden ? '••••' : row.usd === null ? '—' : showUsd(row.usd)}</div>
                {row.basis === 'stage' ? <div className="sec noc-body-sm">at stage price</div> : null}
                {rowNote === 'live' ? <div className="sec noc-body-sm app-success">live</div> : null}
                {rowNote === 'stale' ? <div className="sec noc-body-sm app-warning">stale</div> : null}
                {rowNote === 'cached' && away && priceAt !== null ? <div className="sec noc-body-sm">price {clock(priceAt)}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
