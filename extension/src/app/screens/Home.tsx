import {useState} from 'react';
import {useWallet, sustained, type NetMode} from '../WalletContext';
import {valuation} from '../valuation';
import {TOKEN_INFO, ago, agoLong, showAmount, showUsd, stamp, usdParts} from '../format';
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
        <ExtIcon name="wifi" size={18} />
        <div>
          <p>Connected · syncing</p>
          <div className="meta noc-caption">Auto-dismisses in 1.5 s</div>
        </div>
      </div>
    );
  }
  if (mode !== 'offline' && mode !== 'unreachable') return null;
  const title = mode === 'offline' ? (sustainedNow ? "You're offline · Showing cached data" : "You're offline") : 'Could not reach the Noctura server';
  // The retries this popup made: the first failed read of the spell is not a retry.
  const retries = Math.max(0, failures - 1);
  const line = sustainedNow
    ? `Last synced ${lastSync === null ? 'never' : agoLong(lastSync, now)}${retries === 0 ? '' : ` · ${retries} ${retries === 1 ? 'retry' : 'retries'} failed`}`
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
const DOTS = [0, 1, 2, 3, 4, 5];
const joined = (...parts: (string | null)[]): string => parts.filter((x): x is string => x !== null).join(' · ');

/**
 * #11 dashboard (spec §5.1) with #42's offline states and the D26 refused state (§5.4). Plan-1
 * stand-ins, stated in the plan: no Send quick action (the send flow is plan 3), and the pending
 * strip opens Activity.
 */
export function Home({onReceive, onActivity, onAccounts}: {onReceive: () => void; onActivity: () => void; onAccounts: () => void}) {
  const m = useWallet();
  const now = useNow(1_000, m.now);
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
  const b = m.balances;
  /** The balances shown are not a fresh read of now (the cache, or a read made before going away). */
  const stale = b !== null && (m.stale || away || refused);
  const priceAt = m.prices?.at ?? null;
  const pricesStale = m.pricesStale && priceAt !== null;
  /** The hero's total is stale when either of its inputs is (E4: cached prices are never shown as current). */
  const heroStale = b !== null && (stale || pricesStale);
  /** #42 reconnecting: fresh balances have landed, the price read still runs. */
  const syncing = mode === 'reconnecting' && m.refreshing;
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
  const banner = refused ? <RefusedBanner /> : <NetBanner mode={mode} sustainedNow={long} lastSync={m.lastSync} failures={m.net.failures} now={now} />;

  if (b === null && !away && !refused) {
    // Cold mount: no cache yet, nothing read yet (design #11 state 1). Offline or refused with nothing
    // read, the layout below shows "—" instead: never an endless skeleton, and Receive stays usable.
    return (
      <div className="screen s-dash" aria-busy="true">
        {top}
        {banner}
        <div className="hero">
          <SkelLine width={90} height={14} />
          <SkelLine width={200} height={44} />
          <SkelLine width={140} height={14} />
        </div>
        <div className="quick">
          <div className="qa">
            <SkelCircle />
            <SkelLine width={42} height={10} />
          </div>
        </div>
        <div className="section-h">
          <h3 className="noc-overline">TOKENS</h3>
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

  const v = b === null ? null : valuation(b, m.prices);
  const tokens: Token[] = v === null ? ['SOL', 'NOC'] : (['SOL', 'NOC', 'USDC', 'USDT'] as const).filter(t => t === 'SOL' || t === 'NOC' || v.rows[t].base > 0n);
  const total = v === null ? null : v.total;
  // The caption's age is the older of the stale inputs.
  const balancesCachedAt = stale ? m.balancesAt : null;
  const pricesCachedAt = pricesStale ? priceAt : null;
  const cachedAt = balancesCachedAt === null ? pricesCachedAt : pricesCachedAt === null ? balancesCachedAt : Math.min(balancesCachedAt, pricesCachedAt);
  const label = syncing
    ? 'Total balance · refreshing'
    : long && m.lastSync !== null
      ? `Stale · ${stamp(m.lastSync, now)}`
      : heroStale && cachedAt !== null
        ? `Total balance · cached ${ago(cachedAt, now)}`
        : 'Total balance';
  const rowNote = b === null ? null : mode === 'reconnecting' ? 'live' : long ? 'stale' : stale ? 'cached' : null;
  const solPrice = m.prices?.sol ?? null;
  // Truncated, never rounded up (review L6).
  const approx = total !== null && solPrice !== null ? `≈ ${(Math.floor((total / solPrice) * 100) / 100).toFixed(2)} SOL` : null;
  const heroLine = hidden
    ? null
    : syncing
      ? joined(approx, 're-fetching prices')
      : away && long
        ? joined(approx, 'prices may have moved')
        : away && m.lastSync !== null
          ? joined(approx, `last synced ${stamp(m.lastSync, now)}`)
          : null;
  const priceStamp = (note: typeof rowNote): boolean => priceAt !== null && ((note === 'cached' && away) || (note === null && pricesStale));

  return (
    <div className="screen s-dash">
      {top}
      {banner}
      {open === undefined ? null : <PendingStrip p={open} now={now} onOpen={onActivity} />}
      <section className={`hero${heroStale ? ' s8-stale' : ''}`}>
        {heroStale ? <div className="s8-stale-mark" /> : null}
        <div className="label-row">
          <div className="left">
            <span className={`noc-overline${long ? ' app-warning' : ''}`}>{label}</span>
          </div>
          <button type="button" className="eye-btn" aria-label={hidden ? 'Show balance' : 'Hide balance'} onClick={toggleHidden}>
            <ExtIcon name={hidden ? 'eye-off' : 'eye'} size={20} />
          </button>
        </div>
        {hidden ? (
          <>
            <div className="balance hidden">
              <div className="dots">
                {DOTS.map(i => (
                  <i key={i} />
                ))}
              </div>
            </div>
            <div className="change noc-body-sm app-muted">Tap eye to reveal</div>
          </>
        ) : total === null ? (
          <div className="balance">
            <span className="real noc-balance-xl noc-numeral">—</span>
            {b === null ? null : <div className="noc-caption app-muted">Prices unavailable</div>}
          </div>
        ) : (
          <div className="balance">
            <span className="real noc-balance-xl noc-numeral">{usdParts(total).whole}</span>
            <span className="cents noc-numeral">{usdParts(total).cents}</span>
            {syncing ? (
              <span className="app-hero-spin" data-spinner="" aria-hidden="true">
                <ExtIcon name="refresh" size={20} />
              </span>
            ) : null}
          </div>
        )}
        {heroLine === null ? null : <div className="noc-body-sm app-muted">{heroLine}</div>}
        <div className="sub-balance noc-body-sm">
          <div>
            <b className="noc-numeral">{hidden ? '••••' : b === null ? '—' : showAmount('SOL', b.sol)}</b>
            <span>SOL</span>
          </div>
          <span className="dot" />
          <div>
            <b className="noc-numeral">{hidden ? '••••' : b === null ? '—' : showAmount('NOC', b.noc)}</b>
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
      {away && !long ? <p className="noc-caption app-muted app-offline-note">Sending needs a network connection. Receiving works — your address is on this device. Use the refresh button to retry.</p> : null}
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
        {stale ? <div className="s8-stale-mark" /> : null}
        {tokens.map(t => {
          const row = v === null ? null : v.rows[t];
          return (
            <div className="row" key={t} data-token={t}>
              <TokenTile token={t} />
              <div className="meta">
                <div className="pri noc-body-lg">{TOKEN_INFO[t].name}</div>
                <div className="sec noc-body-sm noc-numeral">
                  {row === null ? '—' : hidden ? `${HIDDEN_ROW} ${t}` : `${showAmount(t, row.base)} ${t}`}
                  {rowNote === 'cached' ? ' · cached' : ''}
                </div>
              </div>
              <div className="price">
                <div className="pri noc-body-lg noc-numeral">{hidden ? '••••' : row === null || row.usd === null ? '—' : showUsd(row.usd)}</div>
                {row !== null && row.basis === 'stage' ? <div className="sec noc-body-sm">at stage price</div> : null}
                {rowNote === 'live' ? <div className="sec noc-body-sm app-success">live</div> : null}
                {rowNote === 'stale' ? <div className="sec noc-body-sm app-warning">stale</div> : null}
                {priceStamp(rowNote) && priceAt !== null ? <div className="sec noc-body-sm">price {stamp(priceAt, now)}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
