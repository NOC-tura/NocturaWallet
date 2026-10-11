import {useCallback, useEffect, useRef, useState} from 'react';
import {useWallet} from '../WalletContext';
import {useNow} from '../useNow';
import {ago} from '../format';
import {whenText} from '../addressBook';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {HoldButton, type HoldClock, realClock} from '../ui/HoldButton';
import {useEscape} from '../ui/useEscape';
import type {DappBlocked, DappGrant, DappInteraction} from '../engine';

/** #49's copy (B1c §4.4): the design's strings (ix:18705-19100) as the spec quotes them, Q10, Q13–Q15 and 2a's "Try again". */
export const CONNECTED_TEXT = {
  title: 'Connected apps',
  sort: 'Sort',
  sessions: (n: number): [string, string] => [String(n), n === 1 ? ' active session' : ' active sessions'],
  sortedLastUsed: 'Sorted by last used',
  sortedName: 'Sorted by name',
  holdingNote: 'Hold to revoke all',
  meta: (date: string, when: string): string => `Connected ${date} · last used ${when}`,
  /** Q10. */
  sessionPill: 'This session',
  revoke: 'Revoke',
  revoked: (name: string): string => `${name} revoked`,
  undoIn: (s: number): string => `undo · ${s} s`,
  undo: 'UNDO',
  close: 'Close',
  permissions: 'Permissions',
  readKeys: 'Read public keys',
  readKeysSub: 'Granted at connect — view-only',
  signTx: 'Sign transactions',
  signMsg: 'Sign messages',
  withPrompt: '(with prompt)',
  promptSub: 'Each request asks before signing',
  session: 'Session',
  connectedK: 'Connected',
  lastUsedK: 'Last used',
  scopeK: 'Scope',
  untilRevoked: 'Until revoked',
  thisSessionOnly: 'This session only',
  last3: 'Last 3 interactions',
  interaction: {connect: 'Connect', signMessage: 'Sign message', signTransaction: 'Sign transaction', signAndSendTransaction: 'Sign and send transaction'} as Record<DappInteraction['type'], string>,
  outcome: {approved: '(approved)', rejected: '(rejected)'} as Record<DappInteraction['outcome'], string>,
  revokeThis: 'Revoke this connection',
  hold: (n: number): string => `Hold to disconnect all · ${n} ${n === 1 ? 'session' : 'sessions'}`,
  holdHeld: 'Hold to disconnect all',
  holdHelper: (n: number): string => `All ${n} ${n === 1 ? 'session' : 'sessions'} will be wiped · release the button to cancel`,
  disconnectAll: 'Disconnect all',
  emptyTitle: 'No connected apps',
  /** Q14. */
  emptyBody: 'When you connect a site, it appears here.',
  /** Q13. */
  blocked: 'Blocked sites',
  blockedOn: (date: string): string => `Blocked ${date}`,
  lookedLike: (domain: string): string => `Looked like ${domain}`,
  unblock: 'Unblock',
  /** Q15. */
  failed: 'Could not load your connections. Try again.',
  tryAgain: 'Try again',
} as const;

/** #49d: the hold is #49's own 600 ms (§9; #37's is 1 s). */
export const DISCONNECT_ALL_MS = 600;
/** §2.7: the undo window. */
export const UNDO_MS = 5_000;

/** The date as #49 writes it: YYYY-MM-DD, local (UTC stored — cardinal rule 3). */
export function isoDay(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** C6: the domain's initials — the name's first two words' first letters, or a one-word name's first two letters. */
export function initialsOf(name: string): string {
  const words = name.split(/[\s.-]+/).filter(w => w !== '');
  const two = words.length >= 2 ? `${Array.from(words[0] ?? '')[0] ?? ''}${Array.from(words[1] ?? '')[0] ?? ''}` : Array.from(words[0] ?? '?').slice(0, 2).join('');
  return two.toUpperCase();
}

/** The design's five row gradients (ix:3885-3889), chosen from the host so a site keeps its colour. */
export const TILES = ['tensor', 'jup', 'magic', 'drift', 'kamino'] as const;
export function tileOf(host: string): (typeof TILES)[number] {
  let sum = 0;
  for (let i = 0; i < host.length; i++) sum += host.charCodeAt(i);
  return TILES[sum % TILES.length] ?? 'tensor';
}

type Sort = 'used' | 'name';

/** The host, with the port when the origin has an explicit one (review 1 L5, R35): two ports are two grants (C8). */
export function siteLabel(origin: string, host: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return host;
  }
}
type List = {grants: DappGrant[]; blocked: DappBlocked[]};

/** 49c: the row's detail sheet — permissions, session, the last three interactions, [Revoke this connection]. */
function GrantSheet({grant, now, onClose, onRevoke}: {grant: DappGrant; now: number; onClose: () => void; onRevoke: () => Promise<void>}) {
  const panel = useRef<HTMLDivElement>(null);
  useEscape(onClose);
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    return () => before?.focus();
  }, []);
  const day = isoDay(grant.connectedAt);
  const tile = tileOf(grant.host);
  return (
    <>
      <div className="s10-sheet-overlay" data-testid="sheet-backdrop" onClick={onClose} />
      <div className="s10-sheet" role="dialog" aria-modal="true" aria-label={grant.name} ref={panel}>
        <div className="grabber" />
        <div className="head-row">
          <div className={tile === 'tensor' ? 'ico app-tile-tensor' : tile === 'jup' ? 'ico app-tile-jup' : tile === 'magic' ? 'ico app-tile-magic' : tile === 'drift' ? 'ico app-tile-drift' : 'ico app-tile-kamino'} aria-hidden="true">
            {initialsOf(grant.name)}
          </div>
          <div className="body">
            <div className="name">
              {grant.name}
              {grant.verified ? <span className="app-verified-dot" /> : null}
            </div>
            <div className="domain">{siteLabel(grant.origin, grant.host)}</div>
          </div>
          <button type="button" className="icon-btn" aria-label={CONNECTED_TEXT.close} onClick={onClose}>
            <ExtIcon name="close" size={20} />
          </button>
        </div>
        <div className="app-grant-sheet-body">
          <div>
            <p className="group-label app-group-label">{CONNECTED_TEXT.permissions}</p>
            <div className="s10-perm-row">
              <span className="check">
                <ExtIcon name="check" size={18} />
              </span>
              <div>
                <div className="pri">{CONNECTED_TEXT.readKeys}</div>
                <div className="sub">{CONNECTED_TEXT.readKeysSub}</div>
              </div>
              <span className="ts">{day}</span>
            </div>
            <div className="s10-perm-row">
              <span className="check">
                <ExtIcon name="check" size={18} />
              </span>
              <div>
                <div className="pri">
                  {CONNECTED_TEXT.signTx} <span className="app-dim app-light">{CONNECTED_TEXT.withPrompt}</span>
                </div>
                <div className="sub">{CONNECTED_TEXT.promptSub}</div>
              </div>
              <span className="ts">{day}</span>
            </div>
            <div className="s10-perm-row">
              <span className="check">
                <ExtIcon name="check" size={18} />
              </span>
              <div>
                <div className="pri">
                  {CONNECTED_TEXT.signMsg} <span className="app-dim app-light">{CONNECTED_TEXT.withPrompt}</span>
                </div>
                <div className="sub">{CONNECTED_TEXT.promptSub}</div>
              </div>
              <span className="ts">{day}</span>
            </div>
          </div>
          <div>
            <p className="group-label app-group-label">{CONNECTED_TEXT.session}</p>
            <div className="s10-meta-grid">
              <div className="cell">
                <span className="k">{CONNECTED_TEXT.connectedK}</span>
                <span className="v">{day}</span>
              </div>
              <div className="cell">
                <span className="k">{CONNECTED_TEXT.lastUsedK}</span>
                <span className="v">{whenText(grant.lastUsedAt, now)}</span>
              </div>
              <div className="cell">
                <span className="k">{CONNECTED_TEXT.scopeK}</span>
                <span className="v">{grant.scope === 'persistent' ? CONNECTED_TEXT.untilRevoked : CONNECTED_TEXT.thisSessionOnly}</span>
              </div>
            </div>
          </div>
          {grant.recent.length > 0 ? (
            <div>
              <p className="group-label app-group-label">{CONNECTED_TEXT.last3}</p>
              <div className="s10-history">
                {grant.recent.map(r => (
                  <div className="row" key={`${r.at}-${r.type}`}>
                    <span className="op">
                      {CONNECTED_TEXT.interaction[r.type]} <span className="noc-caption app-dim">{CONNECTED_TEXT.outcome[r.outcome]}</span>
                    </span>
                    <span className="when">{ago(r.at, now)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <LockedButton className="btn btn-primary app-revoke-one" onPress={onRevoke}>
          <ExtIcon name="trash" size={18} />
          {CONNECTED_TEXT.revokeThis}
        </LockedButton>
      </div>
    </>
  );
}

/**
 * #49 connected apps (spec §4.4; index.html ix:18705-19100; D1, D3, D9, C6, C7): every grant (persistent, and the
 * session's while unlocked) with its initials tile, name, verified dot, domain, "Connected <date> · last used <when>" and
 * the "This session" pill; Revoke with no confirmation — the row leaves and the design's 5-second, single-shot undo
 * toast appears (the background holds the record behind a token, §2.7); a row tap opens 49c's detail sheet; "Hold to
 * disconnect all" (49d, 600 ms: rows dim, per-row Revoke off, no undo); the sort button; the blocked sites with Unblock
 * (D3); empty (Q14, no Browse button — D1), skeleton, failed (Q15). Re-read on focus (no pull-to-refresh). Every read
 * and every action checks it is still the newest and still mounted before it sets anything.
 */
export function ConnectedApps({onBack, clock = realClock}: {onBack: () => void; clock?: HoldClock}) {
  const m = useWallet();
  const {engine, reload} = m;
  const now = useNow(1_000, m.now);
  const [list, setList] = useState<List | 'failed' | null>(null);
  const [sort, setSort] = useState<Sort>('used');
  const [open, setOpen] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  /** Revoked here and not yet re-read: hidden at once (the design's optimistic remove). */
  const [gone, setGone] = useState<string[]>([]);
  const [toast, setToast] = useState<{name: string; token: string; until: number} | null>(null);
  const reads = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const n = ++reads.current;
    const [g, b] = await Promise.all([engine.dappGrants(), engine.dappBlocked()]);
    if (!alive.current || n !== reads.current) return;
    if ((!g.ok && g.error === 'locked') || (!b.ok && b.error === 'locked')) return void reload();
    if (!g.ok || !b.ok) return setList('failed');
    setGone([]);
    setList({grants: g.data, blocked: b.data});
  }, [engine, reload]);
  useEffect(() => {
    void load();
    const again = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', again);
    return () => window.removeEventListener('focus', again);
  }, [load]);

  // The toast lives five seconds; the countdown is whole seconds left.
  useEffect(() => {
    if (toast !== null && now >= toast.until) setToast(null);
  }, [now, toast]);

  const revoke = async (g: DappGrant) => {
    setGone(x => [...x, g.origin]);
    setOpen(null);
    const r = await engine.dappRevoke(g.origin);
    if (!alive.current) return;
    if (r.ok) setToast({name: g.name, token: r.data.undoToken, until: m.now() + UNDO_MS});
    await load();
  };
  const undo = async () => {
    if (toast === null) return;
    const token = toast.token;
    setToast(null);
    await engine.dappUndo(token);
    if (alive.current) await load();
  };
  const unblock = async (host: string) => {
    await engine.dappUnblock(host);
    if (alive.current) await load();
  };
  const disconnectAll = async () => {
    await engine.dappRevokeAll();
    if (alive.current) await load();
  };

  const top = (sorting: boolean) => (
    <div className="top-bar">
      <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
        <ExtIcon name="back" size={22} />
      </button>
      <h1 className="title noc-h1-compact">{CONNECTED_TEXT.title}</h1>
      {sorting ? (
        <button type="button" className="icon-btn" aria-label={CONNECTED_TEXT.sort} onClick={() => setSort(s => (s === 'used' ? 'name' : 'used'))}>
          <ExtIcon name="sort" size={22} />
        </button>
      ) : (
        <span className="app-top-spacer" />
      )}
    </div>
  );

  if (list === null) {
    return (
      <div className="screen app-connected" aria-busy="true">
        {top(false)}
        <div className="scroll-area app-connected-body">
          {[60, 70, 52, 64, 58].map(w => (
            <div className="s10-skel-row" key={w}>
              <div className="ico" />
              <div className="body">
                <div className={w === 60 ? 'skel-line app-w60' : w === 70 ? 'skel-line app-w70' : w === 52 ? 'skel-line app-w52' : w === 64 ? 'skel-line app-w64' : 'skel-line app-w58'} />
                <div className="skel-line app-skel-sub" />
              </div>
              <div className="skel-line app-skel-meta" />
            </div>
          ))}
        </div>
        <div className="sticky-bar">
          <button type="button" className="btn btn-primary app-delete-gated" disabled>
            <ExtIcon name="trash" size={18} />
            {CONNECTED_TEXT.disconnectAll}
          </button>
        </div>
      </div>
    );
  }
  if (list === 'failed') {
    return (
      <div className="screen app-connected">
        {top(false)}
        <div className="scroll-area app-connected-body">
          <p className="noc-body app-muted app-connected-failed">{CONNECTED_TEXT.failed}</p>
          <LockedButton className="btn btn-secondary" onPress={load}>
            {CONNECTED_TEXT.tryAgain}
          </LockedButton>
        </div>
      </div>
    );
  }

  const grants = list.grants.filter(g => !gone.includes(g.origin));
  const shown = [...grants].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) || a.host.localeCompare(b.host) : b.lastUsedAt - a.lastUsedAt));
  const openGrant = shown.find(g => g.origin === open) ?? null;
  const blocked = list.blocked.length === 0 ? null : (
    <>
      <p className="s7-group-label">{CONNECTED_TEXT.blocked}</p>
      {list.blocked.map(b => (
        <div className="s10-app-row" key={b.host}>
          <div className="ico app-tile-blocked" aria-hidden="true">
            {initialsOf(b.host.split('.').slice(-2, -1)[0] ?? b.host)}
          </div>
          <div className="body">
            <span className="domain">{b.host}</span>
            <div className="meta">
              <span>{CONNECTED_TEXT.blockedOn(isoDay(b.blockedAt))}</span>
              {b.imitates === null ? null : <span className="noc-warning">{CONNECTED_TEXT.lookedLike(b.imitates)}</span>}
            </div>
          </div>
          <LockedButton className="revoke app-unblock" onPress={() => unblock(b.host)}>
            {CONNECTED_TEXT.unblock}
          </LockedButton>
        </div>
      ))}
    </>
  );

  if (shown.length === 0) {
    return (
      <>
        <div className="screen app-connected">
          {top(false)}
          <div className="scroll-area app-connected-body">
            <div className="s10-empty">
              <div className="ill">
                <ExtIcon name="unlink" size={56} />
              </div>
              <h2 className="head">{CONNECTED_TEXT.emptyTitle}</h2>
              <p className="sub">{CONNECTED_TEXT.emptyBody}</p>
            </div>
            {blocked}
          </div>
          <div className="sticky-bar">
            <button type="button" className="btn btn-primary app-delete-gated" disabled>
              <ExtIcon name="trash" size={18} />
              {CONNECTED_TEXT.disconnectAll}
            </button>
          </div>
        </div>
        {toast === null ? null : <UndoToast toast={toast} now={now} onUndo={undo} />}
      </>
    );
  }

  const [count, label] = CONNECTED_TEXT.sessions(shown.length);
  return (
    <>
      <div className="screen app-connected">
        {top(true)}
        <div className="scroll-area app-connected-body">
          <div className="s10-summary-bar">
            <span className="count">
              <b>{count}</b>
              {label}
            </span>
            <span className={holding ? 'sort app-hold-note' : 'sort'}>{holding ? CONNECTED_TEXT.holdingNote : sort === 'used' ? CONNECTED_TEXT.sortedLastUsed : CONNECTED_TEXT.sortedName}</span>
          </div>
          {shown.map(g => {
            const tile = tileOf(g.host);
            return (
              <div className={holding ? 's10-app-row app-row-dim' : 's10-app-row'} key={g.origin} onClick={() => setOpen(g.origin)}>
                <div className={tile === 'tensor' ? 'ico tensor' : tile === 'jup' ? 'ico jup' : tile === 'magic' ? 'ico magic' : tile === 'drift' ? 'ico drift' : 'ico kamino'} aria-hidden="true">
                  {initialsOf(g.name)}
                </div>
                <button type="button" className="body app-row-open" onClick={() => setOpen(g.origin)}>
                  <span className="name-row">
                    <span className="name">{g.name}</span>
                    {g.verified ? <span className="verified-dot" /> : null}
                  </span>
                  <span className="domain">{siteLabel(g.origin, g.host)}</span>
                  <span className="meta">
                    <span>{CONNECTED_TEXT.meta(isoDay(g.connectedAt), whenText(g.lastUsedAt, now))}</span>
                    {g.scope === 'session' ? <span className="badge app-session-pill">{CONNECTED_TEXT.sessionPill}</span> : null}
                  </span>
                </button>
                <span
                  className="app-row-action"
                  onClick={e => {
                    e.stopPropagation();
                  }}
                >
                  <LockedButton className="revoke" disabled={holding} onPress={() => revoke(g)}>
                    {CONNECTED_TEXT.revoke}
                  </LockedButton>
                </span>
              </div>
            );
          })}
          {holding ? <p className="noc-caption noc-danger app-hold-helper">{CONNECTED_TEXT.holdHelper(shown.length)}</p> : null}
          {blocked}
        </div>
        <div className="sticky-bar">
          <HoldButton label={CONNECTED_TEXT.hold(shown.length)} heldLabel={CONNECTED_TEXT.holdHeld} decimals={2} holdMs={DISCONNECT_ALL_MS} disabled={false} onPressing={setHolding} onHeld={() => void disconnectAll()} clock={clock} />
        </div>
      </div>
      {toast === null ? null : <UndoToast toast={toast} now={now} onUndo={undo} />}
      {openGrant === null ? null : <GrantSheet grant={openGrant} now={now} onClose={() => setOpen(null)} onRevoke={() => revoke(openGrant)} />}
    </>
  );
}

/** 49e's undo toast: "<name> revoked", "undo · <s> s", [UNDO] — single-shot, five seconds. */
function UndoToast({toast, now, onUndo}: {toast: {name: string; until: number}; now: number; onUndo: () => Promise<void>}) {
  const left = Math.max(1, Math.ceil((toast.until - now) / 1000));
  return (
    <div className="s10-undo-toast" role="status" aria-live="polite">
      <ExtIcon name="trash" size={18} />
      <span className="body">{CONNECTED_TEXT.revoked(toast.name)}</span>
      <span className="timer noc-body-sm noc-numeral">{CONNECTED_TEXT.undoIn(left)}</span>
      <LockedButton className="undo-btn" onPress={onUndo}>
        {CONNECTED_TEXT.undo}
      </LockedButton>
    </div>
  );
}
