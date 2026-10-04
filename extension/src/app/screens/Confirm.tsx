import {useCallback, useEffect, useRef, useState} from 'react';
import {useWallet} from '../WalletContext';
import {feeUsd, showUsd} from '../format';
import {draftOf, feeRows, percentOf, showExact, showLamports, usdOf, type Draft} from '../send/rules';
import {reauthPage} from '../platform';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';
import {Banner, RefusedBanner} from '../ui/Banner';
import {LockedButton} from '../ui/LockedButton';
import {useEscape} from '../ui/useEscape';
import {useNow} from '../useNow';
import {CONFIRM_STRIKE_KEY, readPref, writePref} from '../prefs';
import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
import type {Intent, Pending, Prices, Resumable} from '../engine';

/** The fixed strings #20 shows (spec §4.5); adapted ones are marked there. */
export const CONFIRM_TEXT = {
  title: 'Confirm send',
  step: '4 of 4',
  about: 'You are about to send',
  highValue: 'High-value transfer',
  network: "Solana mainnet · sent through Noctura's broadcast route",
  firstTitle: "You've never sent to this address",
  firstLine: 'First-time recipient · check the whole address below, group by group, against what you expect.',
  confirmed: 'Confirmed. Review the fresh quote and send.',
  resume: 'You have a send waiting.',
  updated: 'Updated with a fresh network quote',
  updatedReview: 'Updated with a fresh network quote — review and send',
  notCarried: 'Your confirmation did not carry over. Confirm again.',
  quoteExpired: 'Quote expired — refresh',
  refresh: 'Refresh',
  pending: 'A send from this account is still pending.',
  cancel: 'Cancel',
  /** D22, in the popup: the proof is taken by #10 in a tab of its own. */
  reauthLine: "You'll confirm with your password (or passkey) in a new tab before this is sent.",
  /** Controller addition — confirmed by the owner 2026-10-02 (plan 3): in the UI tab #10 opens in this same tab. */
  reauthLineTab: "You'll confirm with your password (or passkey) in this tab before this is sent.",
  /** D12, under the CTA. */
  opensTab: 'Confirmation opens in a new tab.',
  /** Controller addition — confirmed by the owner 2026-10-02 (plan 3): as above. */
  opensHere: 'Confirmation opens in this tab.',
  /** index.html #s20 state 3's warning, kept beside the password line (review fix round 1; confirmed by the owner 2026-10-04): "If you didn't initiate this — cancel now." */
  notYou: "If you didn't initiate this — ",
  cancelNow: 'cancel now',
} as const;

const HEX32 = /^[0-9a-f]{32}$/;
type Notice = 'updated' | 'updated-review' | 'not-carried' | null;

/**
 * How #20 was reached. `flow`: from #19's Continue, bound to the prepared send #19 showed (Task 8 ruling) — a
 * different one held by the engine now (a superseded prepare landed in between) is refused, never shown or sent.
 * `resume`: the hash or a reopened popup, id-less — whatever `wallet.preparedFor` holds is the send to review.
 */
export type ConfirmEntry = {entry: 'flow'; preparedId: string} | {entry: 'resume'};

export type ConfirmProps = ConfirmEntry & {
  account: string;
  /** The back arrow and Esc: back to #19 with the prepared send kept (not a cancel). */
  onBack: (intent: Intent) => void;
  /** [Cancel] discarded the prepared send (E7): #11 with "Transaction cancelled. No fees charged.". */
  onCancelled: () => void;
  /** A send went out (or may have): #21 tracking this pending id, or — null — the one created at or after `tapAt`. */
  onTrack: (id: string | null, tapAt: number) => void;
  /** Back to #19 for a fresh prepare of the intent — or, with no intent (nothing to resume), #12 from scratch. */
  onReview: (intent: Intent, notice: 'confirmation-expired' | null) => void;
  /** #12 with the draft and "Something went wrong — start the send again." (the loop guard's second strike). */
  onStartAgain: (draft: Draft | null) => void;
  /**
   * A flow entry found another prepared send than the one #19 handed over (or none): back to #19, which reviews
   * again. Nothing was shown or sent.
   */
  onSuperseded: () => void;
};

/**
 * #20 tx-confirm (spec §4.5, the one statement of resume and re-authentication). What it shows comes from the
 * background only — `wallet.preparedFor` on every entry (from #19, a reopened popup, or the UI tab's resume route),
 * and a fresh `wallet.prepareSend` when that quote has expired, carrying the challenge (D39). **One user tap per
 * broadcast (D38):** `wallet.send` is called from `tap()` and nowhere else, and `tap()` runs only from the Send
 * button's click; a refusal that needs new values (prepared-expired, a re-authentication) shows them and waits for
 * a new tap. Send is never focused (R2-L4). The quote's end re-prepares by itself at most once without user input
 * (C5); after that "Quote expired — refresh", and the refresh is a tap.
 */
export function Confirm(props: ConfirmProps) {
  const {account, entry, onBack, onCancelled, onTrack, onReview, onStartAgain, onSuperseded} = props;
  /** The prepared send #19 showed (a flow entry), null for a resume. Read once: the route's own. */
  const handedOver = props.entry === 'flow' ? props.preparedId : null;
  const m = useWallet();
  const {engine, platform, reload, report, now: clock, surface} = m;
  const [view, setView] = useState<Resumable | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [open, setOpen] = useState<Pending | null>(null);
  const [ownPrices, setOwnPrices] = useState<Prices | null>(null);
  const [quoteDead, setQuoteDead] = useState(false);
  const [busy, setBusy] = useState(false);
  /**
   * A tap's wallet.send is in flight: [Cancel], the back arrow and Esc do nothing until it answers — a cancel then
   * would discard nothing (the send holds the prepared send) and say "No fees charged" over a broadcast.
   */
  const sending = useRef(false);
  const [inFlight, setInFlight] = useState(false);
  const now = useNow(1_000, clock);
  /** The screen was left: anything a prepare in flight makes afterwards is discarded (Cancel) or dropped. */
  const left = useRef(false);
  const cancelled = useRef(false);
  /** C5: the quote's end may re-prepare by itself this many more times; any user input gives it one back. */
  const auto = useRef(1);
  /** When #20 was first shown: an `unknown-prepared` after a tap looks for a pending record from then on (R2-M2). */
  const shownAt = useRef(clock());
  /**
   * The prepared send this screen stands for: #19's on a flow entry, then each one #20 itself prepares (C5, the
   * refresh, prepared-expired). A tap re-reads against it, never against whatever the engine holds now.
   */
  const expected = useRef<string | null>(handedOver);
  /**
   * Bumped when the screen goes (unmount, another account): an answer to an older generation's await is dropped
   * — it never navigates a screen that is gone, nor is handled twice.
   */
  const gen = useRef(0);

  const apply = useCallback((v: Resumable) => {
    setView(v);
    setQuoteDead(false);
  }, []);

  /** A fresh prepare of the intent, carrying the challenge (D39). Null when the screen was left or it was refused. */
  const reprepare = useCallback(
    async (intent: Intent, challengeId: string | undefined): Promise<boolean> => {
      const g = gen.current;
      setBusy(true);
      const r = await engine.prepareSend(account, intent, challengeId);
      setBusy(false);
      if (left.current || gen.current !== g) {
        // E7: a [Cancel] that landed while this prepared must leave nothing behind.
        if (r.ok && cancelled.current) void engine.discardPrepared(account);
        return false;
      }
      if (r.ok) {
        // #20's own prepare: the send this screen now stands for (Task 8 ruling).
        expected.current = r.data.id;
        apply({...r.data, intent, expired: false});
        return true;
      }
      if (r.error === 'locked') void reload();
      else if (r.error === 'coordinator-refused' || r.error === 'unreachable') report(r.error);
      // Any refusal is #19's to show, with its own copy and nothing to continue (§4.4).
      if (r.error !== 'locked') onReview(intent, null);
      return false;
    },
    [account, engine, apply, reload, report, onReview],
  );

  useEffect(() => {
    left.current = false;
    const g = gen.current;
    const gone = () => left.current || gen.current !== g;
    setView(null);
    setOpen(null);
    void (async () => {
      const r = await engine.preparedFor(account);
      if (gone()) return;
      if (!r.ok || r.data === null || (handedOver !== null && r.data.id !== handedOver)) {
        // A flow entry bound to #19's prepared send finds another, or none: a prepare that landed between
        // #19's Continue and here superseded it. Refuse — back to #19, which reviews again; nothing is sent.
        if (handedOver !== null) return onSuperseded();
        // Nothing to resume (gone with its challenge, discarded, or after a lock): the flow starts at #12 (§7.4).
        return onStartAgain(null);
      }
      const v = r.data;
      expected.current = v.id;
      if (v.expired) await reprepare(v.intent, v.reauth?.challengeId);
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
  }, [account, engine]);

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

  // The quote's end (the 30 s prepared life, D39): re-prepare once by itself, then wait for [Refresh] (C5).
  const expiredNow = view !== null && now >= view.validUntil;
  useEffect(() => {
    // While a send from this account is open the engine would answer `in-flight` and move an untouched #20 to #19;
    // Send is disabled anyway, so the quote waits (plan-3 review L1). So too while #20's OWN tap's send is out, and
    // once that send has answered (fix round 1): a re-prepare then would be refused `in-flight` and move a send that
    // went out to #19 instead of #21 — or, refused late, leave a fresh prepared send behind.
    if (!expiredNow || view === null || busy || quoteDead || open !== null || inFlight || sending.current || left.current) return;
    if (auto.current <= 0) {
      setQuoteDead(true);
      return;
    }
    auto.current -= 1;
    void reprepare(view.intent, view.reauth?.challengeId).then(ok => {
      if (ok) setNotice('updated');
    });
  }, [expiredNow, view, busy, quoteDead, open, inFlight, reprepare]);

  const refresh = async () => {
    if (view === null || sending.current || left.current) return;
    auto.current = 1;
    void engine.ping();
    if (await reprepare(view.intent, view.reauth?.challengeId)) setNotice('updated');
  };

  const back = () => {
    if (view === null || left.current || sending.current) return;
    left.current = true;
    onBack(view.intent);
  };
  useEscape(back);

  const cancelling = useRef(false);
  const cancel = async () => {
    if (cancelling.current || sending.current) return;
    cancelling.current = true;
    left.current = true;
    cancelled.current = true;
    await engine.discardPrepared(account);
    onCancelled();
  };

  /** The pending record a send that was refused after the tap may still have made (R2-M2), or null. */
  const madeSince = async (since: number): Promise<Pending | null> => {
    const p = await engine.pending();
    if (!p.ok) return null;
    return p.data.find(x => x.account === account && (x.createdAt >= since || x.state === 'pending' || x.state === 'stuck')) ?? null;
  };

  /**
   * The Send button's click — and the ONLY caller of engine.send (D38; links.test.ts and Confirm.test.tsx hold it to
   * that). An unproven challenge opens #10 instead (spec §4.5 step 2).
   */
  const tap = async () => {
    if (view === null || busy || quoteDead || open !== null || sending.current) return;
    const tapAt = clock();
    if (view.reauth !== null && !view.reauth.proven) {
      // The view may be stale: the challenge proven from another surface since this #20 read it (plan-3 review L2).
      // Read once more — still this one tap — and send if the engine now says proven for this very prepared send.
      const g = gen.current;
      const fresh = await engine.preparedFor(account);
      if (left.current || gen.current !== g) return;
      const latest = fresh.ok ? fresh.data : null;
      if (latest !== null && latest.id === view.id && view.id === expected.current && latest.reauth?.proven === true && !latest.expired) return send(view, tapAt);
      const page = reauthPage(view.reauth.challengeId);
      if (page === null) return onStartAgain(draftOf(view.intent));
      if (surface === 'popup') {
        platform.openPage(page);
        platform.closeWindow();
      } else platform.navigate(page);
      return;
    }
    return send(view, tapAt);
  };

  /** The one wallet.send (D38): reached only from the Send button's handler above, and from nowhere else. */
  const send = async (view: Resumable, tapAt: number) => {
    const g = gen.current;
    sending.current = true;
    setInFlight(true);
    const r = await engine.send(view.id);
    sending.current = false;
    setInFlight(false);
    if (r.ok) writePref(CONFIRM_STRIKE_KEY, '');
    // The screen went while the send was out (unmounted, another account): the answer navigates nothing — the
    // pending strip and #26 show the send; handling it here would act on a screen that is gone.
    if (left.current || gen.current !== g) return;
    /** An answer that moves on from #20: the screen is done — no re-prepare, refresh, cancel or back after it. */
    const done = () => {
      left.current = true;
    };
    if (r.ok) {
      done();
      return onTrack(r.data.id, tapAt);
    }
    const data = r.data as {challengeId?: unknown; id?: unknown} | undefined;
    switch (r.error) {
      case 'check-pending':
        // Recorded, maybe broadcast: never "nothing sent" — #21 tracks the record it names.
        done();
        return onTrack(typeof data?.id === 'string' ? data.id : null, tapAt);
      case 'failed':
        // #21 looks for a record of this account created after the tap; without one, its check-pending wording.
        done();
        return onTrack(null, tapAt);
      case 'prepared-expired':
        // The quote ended between the tap and the send: fresh values, and a new tap — the earlier one is never reused.
        if (await reprepare(view.intent, view.reauth?.challengeId)) setNotice('updated-review');
        return;
      case 'reauth-required': {
        if (typeof data?.challengeId !== 'string' || !HEX32.test(data.challengeId)) {
          // The engine consumed the send against a proof that no longer holds (past C5's cap, R2-M3).
          done();
          return onReview(view.intent, 'confirmation-expired');
        }
        // The prepared send is intact; its proof is missing — a confirmation that did not carry over. The loop guard
        // (§4.5, §7.7): the first time, say so and let the NEXT tap open #10 again; the second time in a row for the
        // same challenge — remembered across the #10 round trip, which may close this popup — stop, back to #12.
        if (readPref(CONFIRM_STRIKE_KEY) === data.challengeId) {
          writePref(CONFIRM_STRIKE_KEY, '');
          done();
          return onStartAgain(draftOf(view.intent));
        }
        writePref(CONFIRM_STRIKE_KEY, data.challengeId);
        setView({...view, reauth: {challengeId: data.challengeId, reasons: view.reauth?.reasons ?? [], proven: false}});
        setNotice('not-carried');
        return;
      }
      case 'unknown-prepared':
      case 'prepared-invalid':
      case 'in-flight': {
        // A second window, or a tap that raced the lock, may have sent it (R2-M2): track that record, else #19.
        const made = await madeSince(shownAt.current);
        if (left.current || gen.current !== g) return;
        done();
        if (made !== null) return onTrack(made.id, tapAt);
        return onReview(view.intent, null);
      }
      case 'coordinator-refused':
        report(r.error);
        return;
      case 'unreachable':
        report(r.error);
        done();
        return onTrack(null, tapAt);
      case 'locked':
        await reload();
        return;
      default:
        done();
        return onStartAgain(draftOf(view.intent));
    }
  };

  const refused = m.net.mode === 'refused';
  const top = <TopBar title={CONFIRM_TEXT.title} onBack={back} trailing={<span className="step noc-overline">{CONFIRM_TEXT.step}</span>} />;
  if (view === null) {
    return (
      <div className="screen s-conf" aria-busy="true">
        {top}
      </div>
    );
  }

  const intent = view.intent;
  const token = intent.token;
  const amount = showExact(token, intent.amount);
  const prices = m.prices ?? ownPrices;
  const usd = usdOf(token, intent.amount, prices);
  const solUsd = prices?.sol ?? null;
  const reasons = view.reauth?.reasons ?? [];
  const proven = view.reauth?.proven === true;
  const high = reasons.includes('over-5-percent') || reasons.includes('over-usd-threshold');
  const first = reasons.includes('first-send');
  const balance = token === 'SOL' ? view.simulation.sol.before : m.balances === null ? null : m.balances[token === 'NOC' ? 'noc' : token === 'USDC' ? 'usdc' : 'usdt'];
  const percent = percentOf(intent.amount, balance);
  const fiat = [usd === null ? null : `≈ ${showUsd(usd)} USD`, high && percent !== null ? `${percent} % of your balance` : null].filter((x): x is string => x !== null).join(' · ');
  const from = m.wallet?.accounts.find(a => a.publicKey === account);
  const own = m.wallet?.accounts.find(a => a.publicKey === intent.recipient);
  const toLabel = own !== undefined ? `Your account: ${own.name}` : intent.recipient === MAINNET_FEE_TREASURY ? 'Noctura treasury' : null;
  const rows = feeRows(view.fees);
  const solTotal = view.solRequiredLamports;
  const totalUsd = solUsd === null ? null : (Number(solTotal) / 1e9) * solUsd + (token === 'SOL' ? 0 : usd ?? Number.NaN);
  const seconds = Math.max(0, Math.ceil((view.validUntil - now) / 1000));
  const banner = refused ? (
    <RefusedBanner />
  ) : notice === 'not-carried' ? (
    <Banner tone="warning" title={CONFIRM_TEXT.notCarried} />
  ) : notice === 'updated-review' ? (
    <Banner tone="info" title={CONFIRM_TEXT.updatedReview} />
  ) : notice === 'updated' ? (
    <Banner tone="info" title={CONFIRM_TEXT.updated} />
  ) : proven ? (
    <Banner tone="info" title={CONFIRM_TEXT.confirmed} />
  ) : entry === 'resume' ? (
    <Banner tone="info" title={CONFIRM_TEXT.resume} />
  ) : null;
  const needsProof = view.reauth !== null && !proven;
  // index.html #s20's headline label ("Send 2.4800 SOL to recipient address …"), the whole address in its groups of four.
  const headlineLabel = `${high ? `${CONFIRM_TEXT.highValue}: ` : ''}Send ${amount} ${token} to ${first ? 'first-time ' : ''}recipient address ${(intent.recipient.match(/.{1,4}/g) ?? []).join(' ')}`;

  return (
    <div className="screen s-conf">
      {top}
      <div className="scroll">
        {banner}
        <h1 className="headline" aria-label={headlineLabel}>
          <span className="amount noc-numeral">Send {amount}</span> <span className="ticker">{token}</span> <span className="to-prefix">to</span>{' '}
          <span className="recipient noc-mono">
            <AddressGroups address={intent.recipient} />
          </span>
        </h1>
        <div className={`review-card${high ? ' high-value' : ''}`}>
          <span className="eyebrow">{high ? CONFIRM_TEXT.highValue : CONFIRM_TEXT.about}</span>
          <div className="head">
            <span className="amount noc-numeral">{amount}</span>
            <span className="ticker">{token}</span>
          </div>
          {fiat === '' ? null : <span className="fiat">{fiat}</span>}
        </div>
        {high ? (
          <div className="high-value-banner">
            <span className="help">
              {needsProof ? <span>{surface === 'popup' ? CONFIRM_TEXT.reauthLine : CONFIRM_TEXT.reauthLineTab}</span> : null}
              {needsProof ? ' ' : null}
              {CONFIRM_TEXT.notYou}
              <span className="app-danger">{CONFIRM_TEXT.cancelNow}</span>.
            </span>
          </div>
        ) : null}
        {first ? (
          <div className="first-time-banner" role="note">
            <ExtIcon name="alert-triangle" size={18} />
            <div>
              <b className="app-block">{CONFIRM_TEXT.firstTitle}</b>
              <span className="noc-caption app-secondary">{CONFIRM_TEXT.firstLine}</span>
            </div>
          </div>
        ) : null}
        <div className="detail-grid">
          <div className="detail-row">
            <span className="lbl">From</span>
            <span className="val app-stack">
              {from === undefined ? null : <span className="noc-body-sm">{from.name}</span>}
              <span className="noc-mono">
                <AddressGroups address={account} />
              </span>
            </span>
          </div>
          <div className="detail-row">
            <span className="lbl">To</span>
            <span className="val app-stack">
              {toLabel === null ? null : <span className="noc-body-sm">{toLabel}</span>}
              <span className="noc-mono">
                <AddressGroups address={intent.recipient} />
              </span>
            </span>
          </div>
          <div className="detail-row">
            <span className="lbl">Network</span>
            <span className="val">{CONFIRM_TEXT.network}</span>
          </div>
        </div>
        <div className="fee-block">
          <h3>Fees</h3>
          {rows.map(f => (
            <div className="fee-row" key={f.label}>
              <span>{f.label}</span>
              <span className="val noc-numeral">{f.lamports === null ? '' : `${showLamports(f.lamports)} SOL`}</span>
              <span className="fiat noc-numeral">{f.lamports === null ? '' : feeUsd(solUsd === null ? null : (Number(f.lamports) / 1e9) * solUsd)}</span>
            </div>
          ))}
          <div className="fee-row total">
            <span className="lbl">Total</span>
            <span className="val noc-numeral">{token === 'SOL' ? `${showLamports(solTotal)} SOL` : `${amount} ${token} + ${showLamports(solTotal)} SOL`}</span>
            <span className="fiat noc-numeral">{totalUsd === null || Number.isNaN(totalUsd) ? '—' : showUsd(totalUsd)}</span>
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
            `Quote valid ${seconds} s · slot ${view.simulation.slot.toLocaleString('en-US').replace(/,/g, ' ')}`
          )}
        </div>
      </div>
      <div className="sticky-bar">
        <LockedButton className={high ? 'btn btn-destructive' : 'btn btn-primary'} disabled={open !== null || quoteDead || busy || refused} onPress={tap}>
          <ExtIcon name="send" size={18} />
          Send {amount} {token}
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
