import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {PENDING_POLL_MS, useWallet} from '../WalletContext';
import {feeUsd, showAmount, showUsd} from '../format';
import {showExact, showLamports} from '../send/rules';
import {reauthPage} from '../platform';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';
import {Banner, RefusedBanner} from '../ui/Banner';
import {LockedButton} from '../ui/LockedButton';
import {useEscape} from '../ui/useEscape';
import {useNow} from '../useNow';
import {CONFIRM_TEXT} from '../screens/Confirm';
import {REVIEW_TEXT} from '../screens/Review';
import {CONFIRM_STRIKE_KEY, readPref, writePref} from '../prefs';
import type {Pending, Prices} from '../engine';
import {PREPARE_REFUSALS, presaleClient, type PrepareRefusal, type ResumablePurchase} from './client';
import {CONFIRM_PURCHASE_TEXT as T, priceText} from './text';
import type {PresaleAgain} from './routes';

const HEX32 = /^[0-9a-f]{32}$/;
const isPrepareRefusal = (code: string): code is PrepareRefusal => (PREPARE_REFUSALS as readonly string[]).includes(code);
/** "271 408 921": a slot in groups of three, as #19 and #20 write it. */
const groupSlot = (slot: number): string => slot.toLocaleString('en-US').replace(/,/g, ' ');

/**
 * #20's purchase variant (B1d §4.2; B1b's #20 chrome, spec §4.5 of B1b-2a): what it shows is the background's —
 * `presale.preparedFor` on every entry (from #23's Buy, bound to the purchase #23 prepared; a reopened popup; the tab's
 * hand-over after #10), and a fresh `presale.prepareBuy` of the same intent, carrying the challenge, when that quote has
 * expired. **One tap per signature:** `presale.buy` is called from `tap()` and nowhere else, and `tap()` runs only from
 * Buy's click (rule 6: a LockedButton, never focused); a refusal that needs new values shows them and waits for a new
 * tap. The quote's end re-prepares by itself at most once without user input, then "Quote expired" and [Refresh].
 *
 * The rows (§4.2): the payment as B1b's amount card (Q08 its eyebrow, "≈ $" from the simulation's cents), what the
 * simulation credits (`nocBase`, the program's Δtotal_tokens — not #23's estimate), the stage and the price it was
 * simulated at, the account and the recipient — Q10 over the pinned treasury or vault ATA, whole, in groups of four —
 * the fees (network, priority, and Q09 for the accounts this purchase creates; no Noctura fee, C25), and #19's facts
 * (C33, Q44). No first-send warning (§3.4). Re-authentication opens #10 exactly as a send's does.
 *
 * Where it goes (#23 is this flow's review): back and Esc → #23 with the amount kept and the challenge carried; Cancel
 * → `presale.discardPrepared`, then a fresh #23; a sign-time refusal that no re-prepare can lift (`geo-closed`,
 * `presale-closed`, `blocked`) discards the purchase and opens #23, whose view says why; one that a new review can lift
 * (`price-changed`, `state-changed`, a limit that moved) keeps it (C29) and opens #23 with the amount, the refusal's
 * line or notice and the challenge carried (§3.3, §5); a signature → #21 tracking its record. Another account
 * selected ends it (#11), as a send's #20.
 */
export function PresaleConfirm({
  account,
  preparedId,
  onPresale,
  onTrack,
  onHome,
}: {
  account: string;
  /** The purchase #23 prepared (a flow entry); null for a resume, which shows whatever the background holds. */
  preparedId: string | null;
  /** #23 again — with what was being bought, or fresh (null). */
  onPresale: (again: PresaleAgain | null) => void;
  /** #21 tracking this pending id, or — null — the record this account made at or after `since`. */
  onTrack: (account: string, id: string | null, since: number) => void;
  onHome: () => void;
}) {
  const m = useWallet();
  const {engine, platform, reload, report, now: clock, surface} = m;
  const client = useMemo(() => presaleClient(engine), [engine]);
  const [view, setView] = useState<ResumablePurchase | null>(null);
  const [notice, setNotice] = useState<'updated' | 'not-carried' | null>(null);
  const [open, setOpen] = useState<Pending | null>(null);
  const [ownPrices, setOwnPrices] = useState<Prices | null>(null);
  const [quoteDead, setQuoteDead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelFailed, setCancelFailed] = useState(false);
  const [inFlight, setInFlight] = useState(false);
  /** A tap's presale.buy is out: Cancel, back and Esc do nothing until it answers. */
  const sending = useRef(false);
  const now = useNow(1_000, clock);
  /** The screen was left: anything a prepare in flight makes afterwards is discarded (Cancel) or dropped. */
  const left = useRef(false);
  const cancelled = useRef(false);
  /** C5: the quote's end may re-prepare by itself this many more times; any user input gives it one back. */
  const auto = useRef(1);
  /** When #20 was first shown: an `unknown-prepared` after a tap looks for a record made from then on. */
  const shownAt = useRef(clock());
  /** The prepared purchase this screen stands for: #23's, then each one #20 itself prepares. */
  const expected = useRef<string | null>(preparedId);
  /** Bumped when the screen goes: an answer to an older generation's await is dropped. */
  const gen = useRef(0);

  /** #23 again with this purchase: the amount, a refusal for it (or none), the challenge carried. */
  const toPresale = useCallback(
    (v: ResumablePurchase, code: PrepareRefusal | null) => {
      left.current = true;
      onPresale({currency: v.currency, amount: v.amount.toString(), code, challengeId: v.reauth?.challengeId ?? null});
    },
    [onPresale],
  );

  const apply = useCallback((v: ResumablePurchase) => {
    setView(v);
    setQuoteDead(false);
  }, []);

  /** A fresh prepare of the same purchase, carrying its challenge (§3.3 step 6). False when refused or the screen went. */
  const reprepare = useCallback(
    async (v: ResumablePurchase): Promise<boolean> => {
      const g = gen.current;
      setBusy(true);
      const r = await client.prepareBuy(account, {currency: v.currency, amount: v.amount, stage: v.stage}, v.reauth?.challengeId);
      setBusy(false);
      if (left.current || gen.current !== g) {
        if (r.ok && cancelled.current) void client.discardPrepared(account);
        return false;
      }
      if (r.ok) {
        expected.current = r.data.id;
        apply({...r.data, expired: false});
        return true;
      }
      if (r.error === 'locked') {
        void reload();
        return false;
      }
      if (r.error === 'coordinator-refused' || r.error === 'unreachable') report(r.error);
      // Any refusal is #23's to show, with its own line, for the same amount.
      toPresale(v, isPrepareRefusal(r.error) ? r.error : null);
      return false;
    },
    [account, client, apply, reload, report, toPresale],
  );

  useEffect(() => {
    left.current = false;
    const g = gen.current;
    const gone = () => left.current || gen.current !== g;
    setView(null);
    setOpen(null);
    void (async () => {
      const r = await client.preparedFor(account);
      if (gone()) return;
      if (!r.ok && r.error === 'locked') return void reload();
      if (!r.ok || r.data === null || (preparedId !== null && r.data.id !== preparedId)) {
        // Another purchase than #23's (a prepare that landed in between), or none: nothing is shown or signed — #23.
        left.current = true;
        return onPresale(null);
      }
      const v = r.data;
      expected.current = v.id;
      if (v.expired) await reprepare(v);
      else apply(v);
      if (gone()) return;
      const p = await engine.pending();
      if (!gone() && p.ok) setOpen(p.data.find(x => x.account === account && (x.state === 'pending' || x.state === 'stuck')) ?? null);
      if (!gone() && m.prices === null) {
        const pr = await engine.prices();
        if (!gone() && pr.ok) setOwnPrices(pr.data);
      }
    })();
    return () => {
      left.current = true;
      gen.current += 1;
    };
    // Read once per mount: the account is this route's.
  }, [account, client]);

  // Another account selected (here or in another window): this purchase is not that account's — #11, as a send's #20.
  const selected = m.account?.publicKey ?? null;
  useEffect(() => {
    if (selected !== null && selected !== account) {
      left.current = true;
      onHome();
    }
  }, [selected, account, onHome]);

  // A transaction of this account was open when #20 read it: re-read on the provider's cadence while it blocks Buy.
  const blocked = open !== null;
  useEffect(() => {
    if (!blocked) return;
    let alive = true;
    const g = gen.current;
    const read = async () => {
      const p = await engine.pending();
      if (!alive || gen.current !== g || left.current || !p.ok) return;
      setOpen(p.data.find(x => x.account === account && (x.state === 'pending' || x.state === 'stuck')) ?? null);
    };
    const t = setInterval(() => void read(), PENDING_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [blocked, engine, account]);

  // C5: any user input since the last automatic re-prepare allows one more.
  useEffect(() => {
    const input = () => {
      auto.current = 1;
    };
    document.addEventListener('pointerdown', input);
    document.addEventListener('keydown', input);
    return () => {
      document.removeEventListener('pointerdown', input);
      document.removeEventListener('keydown', input);
    };
  }, []);

  // The quote's end (the 30 s prepared life): re-prepare once by itself, then wait for [Refresh].
  const expiredNow = view !== null && now >= view.validUntil;
  useEffect(() => {
    if (!expiredNow || view === null || busy || quoteDead || open !== null || inFlight || sending.current || left.current) return;
    if (auto.current <= 0) {
      setQuoteDead(true);
      return;
    }
    auto.current -= 1;
    void reprepare(view).then(ok => {
      if (ok) setNotice('updated');
    });
  }, [expiredNow, view, busy, quoteDead, open, inFlight, reprepare]);

  const refresh = async () => {
    if (view === null || sending.current || left.current) return;
    auto.current = 1;
    if (await reprepare(view)) setNotice('updated');
  };

  const back = () => {
    if (view === null || left.current || sending.current) return;
    toPresale(view, null);
  };
  useEscape(back);

  const cancelling = useRef(false);
  const cancel = async () => {
    if (cancelling.current || sending.current || left.current) return;
    cancelling.current = true;
    left.current = true;
    cancelled.current = true;
    setCancelFailed(false);
    const g = gen.current;
    const r = await client.discardPrepared(account);
    if (gen.current !== g) return;
    if (r.ok) return onPresale(null);
    // Not discarded: the purchase and its challenge are still there — never "cancelled" over them; live again.
    cancelling.current = false;
    left.current = false;
    cancelled.current = false;
    setCancelFailed(true);
  };

  /** The record a signature refused after the tap may still have made, or null. */
  const madeSince = async (since: number): Promise<Pending | null> => {
    const p = await engine.pending();
    if (!p.ok) return null;
    return p.data.find(x => x.account === account && (x.createdAt >= since || x.state === 'pending' || x.state === 'stuck')) ?? null;
  };

  /** Buy's click — and the ONLY caller of presale.buy. An unproven challenge opens #10 instead. */
  const tap = async () => {
    if (view === null || busy || quoteDead || open !== null || sending.current || left.current || cancelling.current) return;
    const tapAt = clock();
    if (view.reauth !== null && !view.reauth.proven) {
      // Proven from another surface since this #20 read it: read once more — still this one tap.
      const g = gen.current;
      const fresh = await client.preparedFor(account);
      if (left.current || gen.current !== g) return;
      const latest = fresh.ok ? fresh.data : null;
      if (latest !== null && latest.id === view.id && view.id === expected.current && latest.reauth?.proven === true && !latest.expired) return buy(view, tapAt);
      const page = reauthPage(view.reauth.challengeId);
      if (page === null) return toPresale(view, null);
      if (surface === 'popup') {
        platform.openPage(page);
        platform.closeWindow();
      } else platform.navigate(page);
      return;
    }
    return buy(view, tapAt);
  };

  /** The one presale.buy: reached only from Buy's handler above. */
  const buy = async (v: ResumablePurchase, tapAt: number) => {
    const g = gen.current;
    sending.current = true;
    setInFlight(true);
    const r = await client.buy(v.id);
    sending.current = false;
    setInFlight(false);
    if (r.ok) writePref(CONFIRM_STRIKE_KEY, '');
    if (left.current || gen.current !== g) return;
    const done = () => {
      left.current = true;
    };
    if (r.ok) {
      done();
      return onTrack(account, r.data.id, tapAt);
    }
    const data = r.data as {challengeId?: unknown; id?: unknown} | undefined;
    switch (r.error) {
      case 'check-pending':
        // Recorded, maybe broadcast: never "nothing sent" — #21 tracks the record it names.
        done();
        return onTrack(account, typeof data?.id === 'string' ? data.id : null, tapAt);
      case 'failed':
        done();
        return onTrack(account, null, tapAt);
      case 'unreachable':
        report(r.error);
        done();
        return onTrack(account, null, tapAt);
      case 'prepared-expired':
        if (await reprepare(v)) setNotice('updated');
        return;
      case 'reauth-required': {
        if (typeof data?.challengeId !== 'string' || !HEX32.test(data.challengeId)) return toPresale(v, null);
        // B1b's loop guard: the first time, say so and let the next tap open #10 again; the second time in a row for
        // the same challenge, stop — #23 with the amount.
        if (readPref(CONFIRM_STRIKE_KEY) === data.challengeId) {
          writePref(CONFIRM_STRIKE_KEY, '');
          return toPresale(v, null);
        }
        writePref(CONFIRM_STRIKE_KEY, data.challengeId);
        setView({...v, reauth: {challengeId: data.challengeId, reasons: v.reauth?.reasons ?? [], proven: false}});
        setNotice('not-carried');
        return;
      }
      case 'unknown-prepared':
      case 'prepared-invalid':
      case 'in-flight': {
        // A second window, or a tap that raced the lock, may have signed it: track that record, else #23.
        const made = await madeSince(shownAt.current);
        if (left.current || gen.current !== g) return;
        if (made !== null) {
          done();
          return onTrack(account, made.id, tapAt);
        }
        return toPresale(v, null);
      }
      case 'geo-closed':
      case 'presale-closed':
      case 'blocked':
        // §3.3: no re-prepare can succeed — the purchase goes; #23's own view says why.
        done();
        await client.discardPrepared(account);
        return onPresale(null);
      case 'price-changed':
      case 'state-changed':
      case 'below-min':
      case 'above-max-tx':
      case 'above-user-limit':
      case 'presale-unavailable':
        // Kept (C29): #23 shows why, for the same amount; its next Buy prepares again carrying the challenge.
        return toPresale(v, r.error);
      case 'coordinator-refused':
        report(r.error);
        return;
      case 'locked':
        await reload();
        return;
      default:
        return toPresale(v, null);
    }
  };

  const refused = m.net.mode === 'refused';
  const top = <TopBar title={T.title} titleClass="" onBack={back} />;
  if (view === null) {
    return (
      <div className="screen s-conf" aria-busy="true">
        {top}
      </div>
    );
  }

  const amount = showExact(view.currency, view.amount);
  const prices = m.prices ?? ownPrices;
  const solUsd = prices?.sol ?? null;
  const usd = Number(view.spentCents) / 100;
  const proven = view.reauth?.proven === true;
  const needsProof = view.reauth !== null && !proven;
  const from = m.wallet?.accounts.find(a => a.publicKey === account);
  const {networkLamports, priorityLamports, rentLamports} = view.fees;
  const fees = [
    {label: T.networkFee, lamports: networkLamports - priorityLamports},
    {label: T.priority, lamports: priorityLamports},
    ...(rentLamports > 0n ? [{label: T.setup, lamports: rentLamports}] : []),
  ];
  const solFees = networkLamports + rentLamports;
  const solUsdOf = (lamports: bigint): number | null => (solUsd === null ? null : (Number(lamports) / 1e9) * solUsd);
  const total = view.currency === 'SOL' ? `${showLamports(view.amount + solFees)} SOL` : `${amount} ${view.currency} + ${showLamports(solFees)} SOL`;
  const feesUsd = solUsdOf(solFees);
  const seconds = Math.max(0, Math.ceil((view.validUntil - now) / 1000));
  const banner = refused ? (
    <RefusedBanner />
  ) : notice === 'not-carried' ? (
    <Banner tone="warning" title={CONFIRM_TEXT.notCarried} />
  ) : notice === 'updated' ? (
    quoteDead ? null : <Banner tone="info" title={CONFIRM_TEXT.updated} />
  ) : proven ? (
    <Banner tone="info" title={T.confirmed} />
  ) : preparedId === null ? (
    <Banner tone="info" title={T.resume} />
  ) : null;

  return (
    <div className="screen s-conf">
      {top}
      <div className="scroll">
        {cancelFailed ? <Banner tone="danger" title={REVIEW_TEXT.leaveFailed} /> : null}
        {banner}
        <div className="review-card">
          <span className="eyebrow">{T.about}</span>
          <div className="head">
            <span className="amount noc-numeral">{amount}</span>
            <span className="ticker">{view.currency}</span>
          </div>
          <span className="fiat">≈ {showUsd(usd)} USD</span>
        </div>
        <div className="detail-grid app-pre-grid">
          <div className="detail-row">
            <span className="lbl">{T.receive}</span>
            <span className="val noc-numeral">{showAmount('NOC', view.nocBase)} NOC</span>
          </div>
          <div className="detail-row">
            <span className="lbl">{T.stage}</span>
            <span className="val noc-numeral">{T.stageOf(view.stage + 1)}</span>
          </div>
          <div className="detail-row">
            <span className="lbl">{T.price}</span>
            <span className="val noc-numeral">{T.perNoc(priceText(view.priceTicks))}</span>
          </div>
          <div className="detail-row">
            <span className="lbl">{T.from}</span>
            <span className="val app-stack">
              {from === undefined ? null : <span className="noc-body-sm">{from.name}</span>}
              <span className="noc-mono">
                <AddressGroups address={account} />
              </span>
            </span>
          </div>
          <div className="detail-row">
            <span className="lbl">{T.to}</span>
            <span className="val app-stack">
              <span className="noc-body-sm">{T.presale}</span>
              <span className="noc-mono">
                <AddressGroups address={view.destination} />
              </span>
            </span>
          </div>
          <div className="detail-row">
            <span className="lbl">Network</span>
            <span className="val app-prose">{CONFIRM_TEXT.network}</span>
          </div>
        </div>
        <div className="fee-block">
          <h3>{T.fees}</h3>
          {fees.map(f => (
            <div className="fee-row" key={f.label}>
              <span>{f.label}</span>
              <span className="val noc-numeral">{showLamports(f.lamports)} SOL</span>
              <span className="fiat noc-numeral">{feeUsd(solUsdOf(f.lamports))}</span>
            </div>
          ))}
          <div className="fee-row total">
            <span className="lbl">{T.total}</span>
            <span className="val noc-numeral">{total}</span>
            <span className="fiat noc-numeral">{feesUsd === null ? '—' : showUsd(usd + feesUsd)}</span>
          </div>
        </div>
        <div className="fee-block">
          <h3>{T.simulation}</h3>
          <div className="fee-row">
            <span className="noc-numeral">{T.slot(groupSlot(view.simulation.slot))}</span>
          </div>
          <div className="fee-row">
            <span>{T.programs}</span>
            <span className="val">{T.programsValue}</span>
          </div>
        </div>
        <div className="app-quote noc-caption noc-numeral">
          {quoteDead ? (
            <>
              {CONFIRM_TEXT.quoteExpired}{' '}
              <LockedButton className="btn btn-tertiary app-btn-inline" onPress={refresh} disabled={refused || inFlight}>
                {CONFIRM_TEXT.refresh}
              </LockedButton>
            </>
          ) : (
            T.quote(seconds)
          )}
        </div>
      </div>
      <div className="sticky-bar">
        <LockedButton className="btn btn-primary" disabled={open !== null || quoteDead || busy || refused} onPress={tap}>
          <ExtIcon name="buy" size={18} />
          {T.buy}
        </LockedButton>
        <button type="button" className="btn btn-tertiary" disabled={inFlight} onClick={() => void cancel()}>
          {CONFIRM_TEXT.cancel}
        </button>
        {open !== null ? <p className="noc-caption app-muted app-center-text">{CONFIRM_TEXT.pending}</p> : null}
        {open === null && needsProof ? <p className="noc-caption app-muted app-center-text">{surface === 'popup' ? CONFIRM_TEXT.opensTab : CONFIRM_TEXT.opensHere}</p> : null}
      </div>
    </div>
  );
}
