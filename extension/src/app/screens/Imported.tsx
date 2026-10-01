import {useCallback, useEffect, useRef, useState} from 'react';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import type {Account, Balances, Prices, Token} from '../engine';
import {TOKEN_INFO, approxSol, showAmount, showUsd} from '../format';
import {valuation} from '../valuation';
import {useWallet} from '../WalletContext';
import {RefusedBanner} from '../ui/Banner';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {SkelCircle, SkelLine} from '../ui/Skeleton';
import {TokenTile} from '../ui/TokenTile';
import {useCloseTab} from '../ui/useCloseTab';
import {useCopy} from '../ui/useCopy';
import {NoWallet} from './NoWallet';
import {READY_LINE, USE_IT_LINE} from './Created';

/** Spec §3.12: balances are read for at most this many accounts, one at a time. */
export const MAX_READ = 6;
const TOKENS: readonly Token[] = ['SOL', 'NOC', 'USDC', 'USDT'];
const KEY: Record<Token, keyof Balances> = {SOL: 'sol', NOC: 'noc', USDC: 'usdc', USDT: 'usdt'};

type Read = {kind: 'loading'} | {kind: 'refused'} | {kind: 'unreachable'} | {kind: 'read'; per: Balances[]; prices: Prices | null};

/**
 * Reads up to MAX_READ accounts' balances one at a time, then the prices. A 403 anywhere is the D26
 * state (reported, sticky); any other failure is `unreachable` — never "empty" (review R2-L5).
 */
async function readAll(engine: ReturnType<typeof useWallet>['engine'], accounts: readonly Account[], report: (e: string) => void): Promise<Read> {
  const per: Balances[] = [];
  for (const a of accounts.slice(0, MAX_READ)) {
    const b = await engine.balances(a.publicKey);
    if (!b.ok) {
      report(b.error);
      return b.error === 'coordinator-refused' ? {kind: 'refused'} : {kind: 'unreachable'};
    }
    per.push(b.data);
  }
  const p = await engine.prices();
  if (!p.ok) {
    // Reported as #11 reports it (WalletContext.refresh): a 403 is the D26 state; an unanswered price
    // read leaves the balances shown, without a USD value.
    report(p.error);
    if (p.error === 'coordinator-refused') return {kind: 'refused'};
  }
  return {kind: 'read', per, prices: p.ok ? p.data : null};
}

const sum = (per: readonly Balances[]): Balances => per.reduce((t, b) => ({sol: t.sol + b.sol, noc: t.noc + b.noc, usdc: t.usdc + b.usdc, usdt: t.usdt + b.usdt}), {sol: 0n, noc: 0n, usdc: 0n, usdt: 0n});

/** #7's sentence (the carried rule: the clipboard is not auto-cleared, and the screen says so). */
export const CLIPBOARD_LINE = 'Copying puts the address on your clipboard. Noctura does not clear it afterwards.';

function AddressChip({address}: {address: string}) {
  const [copied, copy] = useCopy();
  const label = copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy address';
  return (
    <>
      <div className="s8-addr-chip app-onb-chip">
        <div>
          <div className="noc-overline app-dim app-onb-chip-label">Your wallet address</div>
          <span className="addr noc-mono">
            <AddressGroups address={address} />
          </span>
        </div>
        <button type="button" aria-label={label} title={label} onClick={() => copy(address)}>
          <ExtIcon name={copied === 'copied' ? 'check' : copied === 'failed' ? 'close' : 'copy'} size={20} />
        </button>
      </div>
      {/* Controller addition — confirmed by the owner 2026-10-01 (plan-2 review M3): #7's line under #40's chip. */}
      <p className="noc-caption app-dim app-onb-help">{CLIPBOARD_LINE}</p>
    </>
  );
}

function Hero({info, head, sub}: {info?: boolean; head?: string; sub: string}) {
  return (
    <div className="s8-success-hero">
      <div className={info === true ? 'ring app-onb-info' : 'ring'}>
        <div className={info === true ? 'ring-inner app-onb-info' : 'ring-inner'}>
          <ExtIcon name="check" size={32} />
        </div>
      </div>
      {head === undefined ? null : <h1 className="head">{head}</h1>}
      <p className="sub">{sub}</p>
    </div>
  );
}

/**
 * #40 import-success (spec §3.12), in the UI tab at `#/imported` — where the vault page hands over after
 * an import or a restore. What the wallet holds: the market total (SOL + USDC + USDT; NOC "at stage
 * price", outside it), a row per token held (summed over the accounts read), the address. Empty only
 * when every account's read succeeded and all four tokens are zero on each; then [Try a different seed]
 * re-reads first (LockedButton) and goes to the vault page's retry path only if all are still zero
 * (D41; the background guard checks again at the deletion, C6).
 */
export function Imported() {
  const m = useWallet();
  const tab = useCloseTab(m.platform);
  const [read, setRead] = useState<Read>({kind: 'loading'});
  const live = useRef(true);
  const accounts = m.wallet?.accounts ?? [];
  const unlocked = m.phase === 'unlocked';
  // The read follows the account list's addresses (a string key), not the array's identity.
  const key = accounts.map(a => a.publicKey).join(',');
  const current = useRef(accounts);
  current.current = accounts;
  // The 403 cool-down (D26) is the model's, as on #11: once a read here or anywhere reported it, nothing
  // reads again on this page — a re-entry (lock, unlock) shows the refused state without a read.
  const cooling = useRef(false);
  cooling.current = m.net.mode === 'refused';
  const load = useCallback(async () => {
    if (current.current.length === 0) return;
    if (cooling.current) return setRead({kind: 'refused'});
    setRead({kind: 'loading'});
    const r = await readAll(m.engine, current.current, m.report);
    if (live.current) setRead(r);
  }, [m.engine, m.report, key]);
  useEffect(() => {
    live.current = true;
    if (unlocked) void load();
    return () => {
      live.current = false;
    };
  }, [unlocked, load]);

  if (m.phase === 'no-wallet') return <NoWallet />;
  if (m.phase === 'locked') {
    return (
      <div className="screen app-center">
        <p className="noc-body">Wallet imported. Unlock it to see what was recovered.</p>
        <div className="app-center-actions">
          {/* Rule 6 (§7.6): one hand-over per tap. */}
          <LockedButton onPress={() => m.platform.navigate('unlock.html?mode=unlock&return=imported')}>Unlock</LockedButton>
        </div>
      </div>
    );
  }
  const first = accounts.find(a => a.index === 0) ?? accounts[0];
  if (unlocked && first === undefined) {
    // Unlocked but no account to show: fail closed as #7 does (Task 15 fix round 1, m-2) — the vault
    // page's neutral line, nothing read, no [Unlock] that would bring the user back here.
    return (
      <div className="screen app-center">
        <p className="noc-body">{USE_IT_LINE}</p>
        <div className="app-center-actions">
          {tab.refused ? null : (
            <LockedButton className="btn btn-secondary" onPress={tab.close}>
              Close this tab
            </LockedButton>
          )}
        </div>
      </div>
    );
  }
  if (read.kind === 'loading' || first === undefined) {
    return (
      <div className="screen app-onb-imported" aria-busy="true">
        <Hero sub="Checking what this wallet holds…" />
        <div className="s8-recovered-card">
          {[0, 1, 2].map(i => (
            <div key={i} className="s8-token-row">
              <SkelCircle size={32} />
              <SkelLine width={120} />
              <SkelLine width={60} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (read.kind === 'refused' || read.kind === 'unreachable') {
    const refused = read.kind === 'refused' || m.net.mode === 'refused';
    return (
      <div className="screen app-onb-imported">
        {refused ? <RefusedBanner /> : null}
        <div className="app-center">
          {refused ? null : <p className="noc-body">Balances could not be read right now.</p>}
          <button type="button" className="icon-btn" aria-label="Refresh" disabled={refused} onClick={() => void load()}>
            <ExtIcon name="refresh" size={20} />
          </button>
        </div>
        <AddressChip address={first.publicKey} />
      </div>
    );
  }

  const total = sum(read.per);
  const held = TOKENS.filter(t => total[KEY[t]] > 0n);
  const n = accounts.length;
  const allRead = n <= MAX_READ;
  const accountsWord = n === 1 ? '1 account' : `${n} accounts`;

  if (held.length === 0 && allRead) {
    const retry = async () => {
      const again = await readAll(m.engine, accounts, m.report);
      if (!live.current) return;
      // Anything arrived (or the read failed): this screen shows it, and the button is gone. Only a
      // read of all four tokens at zero on every account goes on to the retry path.
      const now = again.kind === 'read' ? sum(again.per) : null;
      if (now === null || now.sol + now.noc + now.usdc + now.usdt > 0n) return setRead(again);
      m.platform.navigate('unlock.html?mode=import&source=retry');
    };
    return (
      <div className="screen app-onb-imported">
        <Hero info head="Wallet imported · empty" sub="Your seed checked out, but this wallet holds none of the tokens Noctura shows yet. That's fine — go receive some." />
        <div className="s8-recovered-card">
          <span className="label">Recovered</span>
          <span className="total noc-balance-lg noc-numeral app-muted">0 tokens</span>
          <span className="delta">{accountsWord} · address derivation succeeded</span>
          <div className="app-onb-rule" />
          <div className="app-onb-reasons">
            <p className="noc-body">A few reasons this can happen:</p>
            <ul className="noc-body-sm app-muted">
              <li>This is a fresh seed — never received any tokens</li>
              <li>You imported the wrong seed for this account</li>
              <li>Your assets are on a different derivation path (we check m/44'/501'/n'/0' for n = 0–4, and the Solana CLI key)</li>
            </ul>
          </div>
        </div>
        <AddressChip address={first.publicKey} />
        <p className="noc-caption app-dim app-onb-foot">You can send SOL to this address to fund the wallet.</p>
        <div className="app-onb-grow" />
        <div className="sticky-bar">
          <p className="noc-body app-center-text">{READY_LINE}</p>
          <LockedButton className="btn btn-secondary" onPress={retry}>
            Try a different seed
          </LockedButton>
        </div>
      </div>
    );
  }

  const v = valuation(total, read.prices);
  const solUsd = read.prices?.sol ?? null;
  // Truncated, never rounded up (plan-1 ruling L6; plan-2 review M1).
  const approx = v.total !== null && solUsd !== null ? approxSol(v.total, solUsd) : null;
  const holders = (t: Token) => read.per.filter(b => b[KEY[t]] > 0n).length;
  // "1 token" (singular): controller addition — confirmed by the owner 2026-10-01.
  const tokens = held.length === 1 ? '1 token' : `${held.length} tokens`;
  // Past MAX_READ the copy claims only what was read (plan-2 review M2 — controller addition, confirmed by the owner 2026-10-01).
  const sub = n === 1 ? `1 account · ${tokens} recovered. Welcome back.` : allRead ? `${n} accounts · ${tokens} recovered.` : `${n} accounts · ${tokens} recovered from the first ${MAX_READ}.`;
  const across = allRead ? `across ${n} accounts` : `across the first ${MAX_READ} of ${n} accounts`;
  const delta = n === 1 ? approx : [across, approx].filter(x => x !== null).join(' · ');
  return (
    <div className="screen app-onb-imported">
      <Hero head="Wallet imported" sub={sub} />
      <div className="s8-recovered-card">
        <span className="label">Total value recovered</span>
        <span className="total noc-balance-lg noc-numeral">{v.total === null ? '—' : showUsd(v.total)}</span>
        {delta === null || delta === '' ? null : <span className="delta">{delta}</span>}
        <div className="app-onb-rule" />
        {held.map(t => {
          const row = v.rows[t];
          const count = holders(t);
          return (
            <div key={t} className="s8-token-row">
              <TokenTile token={t} size={32} />
              <div>
                <div className="pri noc-body-lg">{t}</div>
                <div className="sec">{n > 1 && count > 1 ? `${TOKEN_INFO[t].name} · ${count} accounts` : TOKEN_INFO[t].name}</div>
              </div>
              <div>
                <div className="amt noc-numeral">{showAmount(t, row.base)}</div>
                <div className="fiat noc-numeral">{row.usd === null ? '—' : `${showUsd(row.usd)}${row.basis === 'stage' ? ' at stage price' : ''}`}</div>
              </div>
            </div>
          );
        })}
      </div>
      <AddressChip address={first.publicKey} />
      <div className="app-onb-grow" />
      <div className="sticky-bar">
        <p className="noc-body app-center-text">{READY_LINE}</p>
        {tab.refused ? null : (
          <LockedButton className="btn btn-secondary" onPress={tab.close}>
            Close this tab
          </LockedButton>
        )}
      </div>
    </div>
  );
}
