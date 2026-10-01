import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import type {Account, Balances, Engine, Pending, Prices, WalletState} from './engine';
import type {Platform} from './platform';

export type Surface = 'popup' | 'tab';
export type Phase = 'loading' | 'no-wallet' | 'locked' | 'unlocked';
/**
 * #42 and D26 as one state: online; offline (navigator says so); unreachable (a read got no answer
 * while navigator says online — never called "offline", review L3); refused (the 403 cool-down, until
 * the popup reopens); reconnecting (the first good read after offline/unreachable, for 1.5 s).
 */
export type NetMode = 'online' | 'offline' | 'unreachable' | 'refused' | 'reconnecting';
export interface Net {
  mode: NetMode;
  /** When the current offline/unreachable spell began. */
  since: number;
  /** Failed reads in this spell, the first included (so the retries are `failures - 1`). */
  failures: number;
}

export interface WalletModel {
  surface: Surface;
  engine: Engine;
  platform: Platform;
  phase: Phase;
  wallet: WalletState | null;
  account: Account | null;
  balances: Balances | null;
  /**
   * When `balances` were read. `stale`: they are not a fresh read of now — they came from the cache
   * (E4), or the last balance read failed with them on screen (owner decision 2026-10-01, §5.1) — and
   * no successful read has replaced them.
   */
  balancesAt: number | null;
  stale: boolean;
  /**
   * The refusal code of the selected account's last balance read, null after a success (or before
   * any read). 'failed' over shown balances adds #11's failed-read line; a good read clears it.
   */
  balanceError: string | null;
  prices: Prices | null;
  /** `prices` came from the cache (E4) and no fresh wallet.prices has replaced them: never shown as current. */
  pricesStale: boolean;
  pending: Pending[];
  net: Net;
  lastSync: number | null;
  refreshing: boolean;
  /**
   * The selected account's first fresh balance read has answered, either way (final review I1). Until
   * then, with nothing cached, #11 shows its skeleton; after it, never — a failed first read of any
   * code shows the layout, with Receive (D36) and the refresh button.
   */
  settled: boolean;
  /** The clock every screen uses (injectable for tests). */
  now(): number;
  /**
   * A screen that read the network reports a refusal here (review M4): 'coordinator-refused' puts the
   * whole app into the D26 state (banner, network buttons disabled), 'unreachable' into #42's.
   */
  report(error: string): void;
  /**
   * The counterpart of `report`: a screen whose own network read succeeded (Activity's history,
   * #27's search) says so here, with the same effect on the net state as Home's own successful
   * refresh — offline or unreachable becomes reconnecting for 1.5 s, then online; refused stays
   * refused (the 403 cool-down holds until the popup reopens). It does not move `lastSync`: that is
   * the age of the balances shown, and a history read does not refresh them.
   */
  reached(): void;
  refresh(): Promise<void>;
  reload(): Promise<void>;
  /** Locks and re-reads the state; false when the wallet is still unlocked (the caller says so). */
  lock(): Promise<boolean>;
}

export const STATE_POLL_MS = 5_000;
export const PENDING_POLL_MS = 2_000;
export const PING_EVERY_MS = 30_000;
export const RECONNECTED_MS = 1_500;
/** Sustained offline: 30 s, or two failed refreshes (#42). */
export const SUSTAINED_MS = 30_000;
export const sustained = (net: Net, now: number): boolean => (net.mode === 'offline' || net.mode === 'unreachable') && (now - net.since >= SUSTAINED_MS || net.failures >= 2);

const Ctx = createContext<WalletModel | null>(null);

export function useWallet(): WalletModel {
  const m = useContext(Ctx);
  if (m === null) throw new Error('useWallet outside WalletProvider');
  return m;
}

/** A stable default clock: a new function per render would re-run every effect that depends on it. */
const systemNow = (): number => Date.now();
const online = (): boolean => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

/**
 * The engine is the source of truth (spec §1.6): no cache of our own, only the last replies. The open
 * sequence: wallet.state → wallet.cached (stale at once) → wallet.pending → wallet.balances and
 * wallet.prices (fresh) → activity.ping. While open: wallet.state every 5 s, wallet.pending every 2 s
 * while a send of this account is open, and activity.ping on user input at most every 30 s. Nothing
 * else reads the network by itself: refresh is on open and on the refresh button (D2).
 */
export function WalletProvider({
  engine,
  platform,
  surface,
  now = systemNow,
  quiet = false,
  children,
}: {
  engine: Engine;
  platform: Platform;
  surface: Surface;
  now?: () => number;
  /**
   * The UI tab's hand-over screens (#7, #40, the resume stand-in): the state only — no cached, pending,
   * balance or price read on open. #40 reads what it shows itself; #7 reads nothing from the network.
   */
  quiet?: boolean;
  children: ReactNode;
}) {
  const [phase, setPhaseState] = useState<Phase>('loading');
  const phaseRef = useRef<Phase>('loading');
  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [balancesAt, setBalancesAt] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [pricesStale, setPricesStale] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [net, setNet] = useState<Net>(() => (online() ? {mode: 'online', since: now(), failures: 0} : {mode: 'offline', since: now(), failures: 0}));
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [settled, setSettled] = useState(false);
  const refreshingRef = useRef(false);
  const netRef = useRef(net);
  netRef.current = net;
  const shownKey = useRef<string | null>(null);

  const account = useMemo(() => wallet?.accounts.find(a => a.index === wallet.selected) ?? null, [wallet]);
  const accountRef = useRef(account);
  accountRef.current = account;

  const failed = useCallback(
    (error: string) => {
      if (error === 'coordinator-refused') {
        setNet(n => ({mode: 'refused', since: n.mode === 'refused' ? n.since : now(), failures: n.failures}));
      } else if (error === 'unreachable') {
        setNet(n => {
          if (n.mode === 'refused') return n;
          const spell = n.mode === 'offline' || n.mode === 'unreachable';
          return {mode: online() ? 'unreachable' : 'offline', since: spell ? n.since : now(), failures: (spell ? n.failures : 0) + 1};
        });
      }
    },
    [now],
  );

  /**
   * A read got an answer: offline/unreachable → reconnecting. A functional update, so it sees the
   * mode as it will be — never the ref, which lags a refusal made in the same batch (review fix round
   * 1 #1: a success must never clear the 403 state). Refused, online and reconnecting are left alone.
   * The 1.5 s timer to online is armed by the effect below, only when the mode really became
   * reconnecting.
   */
  const reached = useCallback(() => {
    setNet(n => (n.mode === 'offline' || n.mode === 'unreachable' ? {mode: 'reconnecting', since: now(), failures: 0} : n));
  }, [now]);

  const succeeded = useCallback(() => {
    setLastSync(now());
    reached();
  }, [now, reached]);

  /**
   * Fresh balances and prices for the selected account. Refused while the 403 cool-down holds. Both
   * reads start together; the balances are applied as soon as they land, so a reconnect shows
   * "Connected · syncing" while the price read still runs (#42 reconnecting: "re-fetching prices").
   */
  const refresh = useCallback(async () => {
    const a = accountRef.current;
    if (a === null || netRef.current.mode === 'refused') return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const priceRead = engine.prices();
      const b = await engine.balances(a.publicKey);
      if (accountRef.current?.publicKey !== a.publicKey) return;
      setSettled(true);
      if (b.ok) {
        setBalances(b.data);
        setBalancesAt(now());
        setStale(false);
        setBalanceError(null);
        succeeded();
      } else {
        // Whatever is on screen is no longer current (§5.1, owner decision 2026-10-01): marked stale
        // as cached values are. `lastSync` stays at the last good read; nothing replaces the values.
        setStale(true);
        setBalanceError(b.error);
        failed(b.error);
      }
      const p = await priceRead;
      if (accountRef.current?.publicKey !== a.publicKey) return;
      if (p.ok) {
        setPrices(p.data);
        setPricesStale(false);
      } else if (b.ok || p.error === 'coordinator-refused') {
        // A 403 from either read is the D26 state, never hidden behind the other's "unreachable"
        // (final review M1); refused is sticky, so its order against the balance failure is moot.
        failed(p.error);
      }
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [engine, now, failed, succeeded]);

  const readPending = useCallback(async () => {
    const r = await engine.pending();
    if (r.ok) setPending(r.data);
  }, [engine]);

  /** The open sequence for the unlocked wallet: cache first (stale), then pending, then fresh. */
  const openUnlocked = useCallback(
    async (w: WalletState) => {
      const a = w.accounts.find(x => x.index === w.selected) ?? null;
      if (a === null) return;
      // The render that derives `account` from this state has not happened yet: point the ref at it now.
      accountRef.current = a;
      // This account has not been read yet: the skeleton (when nothing is cached) until its read answers.
      setSettled(false);
      setBalanceError(null);
      const c = await engine.cached(a.publicKey);
      if (c.ok) {
        if (c.data.balances !== null) {
          const {at, ...b} = c.data.balances;
          setBalances(b);
          setBalancesAt(at);
          setStale(true);
        } else {
          setBalances(null);
          setBalancesAt(null);
          setStale(false);
        }
        setPrices(c.data.prices);
        setPricesStale(c.data.prices !== null);
        if (c.data.prices !== null || c.data.balances !== null) setLastSync(c.data.balances?.at ?? c.data.prices?.at ?? null);
      }
      await readPending();
      await refresh();
      await engine.ping();
    },
    [engine, readPending, refresh],
  );

  const applyState = useCallback(
    async (fresh: boolean) => {
      const r = await engine.state();
      if (!r.ok) return;
      const w = r.data;
      setWallet(prev => {
        const changed = prev === null || prev.unlocked !== w.unlocked || prev.selected !== w.selected || JSON.stringify(prev.accounts) !== JSON.stringify(w.accounts);
        return changed ? w : prev;
      });
      if (!w.hasWallet || !w.unlocked) {
        // Nothing of the session outlives it: balances, prices, and the open sends (which also stops
        // the 2 s pending poll).
        setPhase(w.hasWallet ? 'locked' : 'no-wallet');
        setBalances(null);
        setBalancesAt(null);
        setStale(false);
        setBalanceError(null);
        setPrices(null);
        setPricesStale(false);
        setPending([]);
        return;
      }
      const wasUnlocked = phaseRef.current === 'unlocked';
      setPhase('unlocked');
      // Read again on open, on unlock, and when the selected account changed (a select here, or an
      // account list changed elsewhere) — otherwise the 5 s poll only watches the lock.
      const key = w.accounts.find(x => x.index === w.selected)?.publicKey ?? null;
      if (!quiet && (!wasUnlocked || fresh || key !== shownKey.current)) {
        shownKey.current = key;
        await openUnlocked(w);
      }
    },
    [engine, openUnlocked, setPhase, quiet],
  );

  const reload = useCallback(() => applyState(true), [applyState]);

  // Open, then wallet.state every 5 s: an auto-lock while open switches to the locked screen.
  useEffect(() => {
    void applyState(true);
    const t = setInterval(() => void applyState(false), STATE_POLL_MS);
    return () => clearInterval(t);
  }, [applyState]);

  const selectedKey = account?.publicKey ?? null;

  // wallet.pending every 2 s while a send of this account is open.
  const open = pending.some(p => p.account === selectedKey && (p.state === 'pending' || p.state === 'stuck'));
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => void readPending(), PENDING_POLL_MS);
    return () => clearInterval(t);
  }, [open, readPending]);

  // activity.ping on user input, at most every 30 s (the idle timer, parent §2).
  useEffect(() => {
    if (phase !== 'unlocked') return;
    let last = now();
    const onInput = () => {
      if (now() - last < PING_EVERY_MS) return;
      last = now();
      void engine.ping();
    };
    document.addEventListener('pointerdown', onInput);
    document.addEventListener('keydown', onInput);
    return () => {
      document.removeEventListener('pointerdown', onInput);
      document.removeEventListener('keydown', onInput);
    };
  }, [phase, engine, now]);

  // The browser's own connectivity events: offline shows #42 at once; online refreshes.
  useEffect(() => {
    const off = () =>
      setNet(n => {
        if (n.mode === 'refused') return n;
        const spell = n.mode === 'offline' || n.mode === 'unreachable';
        return {mode: 'offline', since: spell ? n.since : now(), failures: spell ? n.failures : 0};
      });
    // One read at a time, and none during the cool-down (403 is terminal for this popup).
    const on = () => {
      if (refreshingRef.current || netRef.current.mode === 'refused') return;
      void refresh();
    };
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => {
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
    };
  }, [refresh, now]);
  // Reconnecting shows for RECONNECTED_MS, then online. Armed only when the mode really became
  // reconnecting; any committed change of mode or spell (a refusal, a new failure) runs the cleanup,
  // which cancels it. The callback is ALSO a functional guard (review fix round 2): a refusal queued
  // but not yet committed when the timer fires is applied first, and online never overwrites it.
  useEffect(() => {
    if (net.mode !== 'reconnecting') return;
    const t = setTimeout(() => setNet(n => (n.mode === 'reconnecting' ? {mode: 'online', since: now(), failures: 0} : n)), RECONNECTED_MS);
    return () => clearTimeout(t);
  }, [net.mode, net.since, now]);

  // No wallet in the popup: setup opens in a tab and the popup closes (§1.6 step 1).
  useEffect(() => {
    if (phase !== 'no-wallet' || surface !== 'popup') return;
    platform.openPage('unlock.html?mode=welcome');
    platform.closeWindow();
  }, [phase, surface, platform]);

  /** True when the wallet is locked afterwards: vault.lock answered ok AND the state re-read says so. */
  const lock = useCallback(async (): Promise<boolean> => {
    const r = await engine.lock();
    await applyState(true);
    return r.ok && phaseRef.current !== 'unlocked';
  }, [engine, applyState]);

  const model: WalletModel = {surface, engine, platform, phase, wallet, account, balances, balancesAt, stale, balanceError, prices, pricesStale, pending, net, lastSync, refreshing, settled, now, report: failed, reached, refresh, reload, lock};
  return <Ctx.Provider value={model}>{children}</Ctx.Provider>;
}
