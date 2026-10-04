import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {useWallet} from '../WalletContext';
import {ago, shortAddress, showAmount} from '../format';
import {feeRows, sameIntent, showExact, showLamports} from '../send/rules';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';
import {Banner, RefusedBanner} from '../ui/Banner';
import {LockedButton} from '../ui/LockedButton';
import {useEscape} from '../ui/useEscape';
import {useNow} from '../useNow';
import type {Intent, Pending, Prepared} from '../engine';

/** The fixed strings #19 shows (spec §4.4); adapted ones are marked there. */
export const REVIEW_TEXT = {
  title: 'Review transfer',
  step: '3 of 4',
  simulating: 'Simulating on Solana mainnet',
  simulatingCta: 'Simulating…',
  /** The instruction count is not known until the engine has built the message (spec §4.4 Differs). */
  simulatingFooter: 'Noctura server · simulateTransaction',
  passed: 'Simulation passed',
  what: 'What this transaction does',
  delta: 'Balance delta',
  continue: 'Continue to confirm',
  cancel: 'Cancel',
  retry: 'Retry simulation',
  couldNot: "Couldn't simulate",
  /** §4.5 (R2-M3): #20 sends the user back here when the engine consumed the send against an expired proof. */
  confirmationExpired: 'Your confirmation expired — review again',
  pending: 'A send from this account is still pending. Wait until it confirms or expires.',
  /** Controller addition — confirmed by the owner 2026-10-02 (plan 3, carry 2; review wording) — the engine's check and the simulation's InsufficientFundsForRent alike. */
  senderBelowRent: 'This would leave less than 0.00089088 SOL in your account, which Solana does not allow. Send less, so at least that much stays.',
  /** Controller addition — confirmed by the owner 2026-10-02 (plan 3, carry 2): refused before anything is simulated, or by the simulation. */
  recipientBelowRent: 'This address has no Solana account yet. A new account needs at least 0.00089088 SOL, so send at least that much.',
  /** Leaving failed: the prepared send could not be discarded (E7), so #19 stays (the COMMON form of a failed action). */
  leaveFailed: 'Something went wrong. Try again.',
} as const;

/** A refusal #19 shows, from the engine's code (spec §4.4). */
interface Failure {
  code: string;
  detail: string | null;
}

/** Refusals a retry cannot fix: Retry is not offered (spec §4.4). */
const NO_RETRY = new Set(['split-balance', 'insufficient-token', 'insufficient-sol', 'sender-below-rent', 'recipient-below-rent', 'in-flight']);
const detailOf = (data: unknown): string | null => {
  const d = (data as {detail?: unknown} | undefined)?.detail;
  return typeof d === 'string' ? d : null;
};
/** "271 408 921": the slot in groups of three, as the design writes it. */
const groupSlot = (slot: number): string => slot.toLocaleString('en-US').replace(/,/g, ' ');

/**
 * #19 tx-simulate (spec §4.4): the engine's prepare is this screen (E2). It shows the simulation and what the
 * transaction does, or why the engine refused it — never a way on from a refusal (no "Continue anyway", D21).
 * A live prepared send of the same intent (back from #20) is shown again rather than prepared anew; anything else
 * is prepared, carrying the challenge of an earlier prepare of the same intent (D39). Leaving towards #12 (Cancel,
 * the back arrow, Esc) discards the prepared send and its challenge first (E7) — and a prepare that lands after
 * the screen was left is discarded too, so nothing outlives the review the user abandoned.
 */
export function Review({
  account,
  intent: given,
  notice,
  onCancel,
  onConfirm,
  onViewPending,
}: {
  account: string;
  intent: Intent;
  notice: 'confirmation-expired' | null;
  onCancel: () => void;
  /** Hands over the prepared send this screen showed, by id: #20 refuses a flow entry whose preparedFor is another. */
  onConfirm: (preparedId: string) => void;
  onViewPending: (p: Pending) => void;
}) {
  const m = useWallet();
  // The intent by value: a parent that rebuilds the same intent on a re-render must not start a new prepare.
  const intent = useMemo<Intent>(() => ({token: given.token, recipient: given.recipient, amount: given.amount}), [given.token, given.recipient, given.amount]);
  const {engine, reload, report, now: clock} = m;
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [startedAt, setStartedAt] = useState(clock);
  const [cache, setCache] = useState<{sol: bigint; at: number} | null>(null);
  const [open, setOpen] = useState<Pending | null>(null);
  const [leaveFailed, setLeaveFailed] = useState(false);
  const now = useNow(prepared === null && failure === null ? 100 : 30_000, clock);
  /** The run in flight; a reply for an older run, or after the screen was left, is dropped. */
  const run = useRef(0);
  const left = useRef(false);
  /** The account shown now: a prepare that lands for another (the account switched under it) is discarded too. */
  const shownAccount = useRef(account);
  shownAccount.current = account;

  const simulate = useCallback(
    async (fresh: boolean) => {
      const mine = ++run.current;
      setPrepared(null);
      setFailure(null);
      setStartedAt(clock());
      let carried: string | undefined;
      const resumable = await engine.preparedFor(account);
      if (run.current !== mine) return;
      if (resumable.ok && resumable.data !== null && sameIntent(resumable.data.intent, intent)) {
        if (!fresh && !resumable.data.expired) return setPrepared(resumable.data);
        carried = resumable.data.reauth?.challengeId;
      }
      const r = await engine.prepareSend(account, intent, carried);
      if (run.current !== mine) {
        // The screen was left (or a newer run started) while this one prepared: a prepared send it made must
        // not outlive the review — the same discard the leaving did (E7). So too for an account no longer shown;
        // a newer run for the same account is not discarded under it (Continue re-checks what the engine holds).
        if (r.ok && (left.current || shownAccount.current !== account)) void engine.discardPrepared(account);
        return;
      }
      if (r.ok) return setPrepared(r.data);
      if (r.error === 'locked') return void reload();
      if (r.error === 'coordinator-refused' || r.error === 'unreachable') report(r.error);
      if (r.error === 'unreachable') {
        const c = await engine.cached(account);
        if (run.current === mine && c.ok && c.data.balances !== null) setCache({sol: c.data.balances.sol, at: c.data.balances.at});
      }
      if (r.error === 'in-flight') {
        const p = await engine.pending();
        if (run.current === mine && p.ok) setOpen(p.data.find(x => x.account === account && (x.state === 'pending' || x.state === 'stuck')) ?? null);
      }
      if (run.current !== mine) return;
      setFailure({code: r.error, detail: detailOf(r.data)});
    },
    [account, intent, engine, reload, report, clock],
  );

  useEffect(() => {
    left.current = false;
    void simulate(false);
    // Unmounted (Continue to #20, or a lock): a reply still in flight is dropped. The route's account and intent do
    // not change while the screen is shown, so `simulate` runs once.
    return () => {
      run.current += 1;
    };
  }, [simulate]);

  const leaving = useRef(false);
  const leave = async () => {
    if (leaving.current) return;
    const busy = prepared === null && failure === null;
    leaving.current = true;
    left.current = true;
    run.current += 1;
    setLeaveFailed(false);
    const r = await engine.discardPrepared(account);
    if (r.ok) return onCancel();
    // Not discarded: never leave a prepared send and its challenge behind (E7). Stay, say so, and let the user try
    // again; a simulation the leaving cut off is started again, so the screen is never stuck on "Simulating…".
    leaving.current = false;
    left.current = false;
    setLeaveFailed(true);
    if (busy) void simulate(false);
  };
  useEscape(() => void leave());

  /**
   * Continue to #20 only while the engine's newest prepared send for this account is the one shown, and live. A
   * prepare dropped above (an older run's, or one an abandoned review left in flight) may still have landed
   * after this one and replaced it in the background, or that review's late discard removed it: #20 reads
   * whatever wallet.preparedFor answers, so a mismatch is shown again here (the live one of this intent, or a
   * fresh prepare) instead of handing over a send the user did not review.
   */
  const proceed = async () => {
    const shown = prepared;
    if (shown === null) return;
    const mine = run.current;
    const current = await engine.preparedFor(account);
    if (run.current !== mine) return;
    if (current.ok && current.data !== null && current.data.id === shown.id && !current.data.expired && sameIntent(current.data.intent, intent)) return onConfirm(shown.id);
    await simulate(false);
  };

  const token = intent.token;
  const amount = `${showExact(token, intent.amount)} ${token}`;
  const head = (eyebrow: ReactNode, pill: ReactNode) => (
    <div className="intent-card">
      {eyebrow}
      <div className="head">
        <span className="amount noc-balance-md noc-numeral">{amount}</span>
        <span className="arrow">→</span>
        <span className="to noc-mono">
          <AddressGroups address={intent.recipient} />
        </span>
      </div>
      {pill}
    </div>
  );
  const top = <TopBar title={REVIEW_TEXT.title} onBack={() => void leave()} trailing={<span className="step noc-overline">{REVIEW_TEXT.step}</span>} />;
  const cancel = (
    <button type="button" className="btn btn-tertiary" onClick={() => void leave()}>
      {REVIEW_TEXT.cancel}
    </button>
  );
  const expiredNotice = (
    <>
      {leaveFailed ? <Banner tone="danger" title={REVIEW_TEXT.leaveFailed} /> : null}
      {notice === 'confirmation-expired' ? <Banner tone="warning" title={REVIEW_TEXT.confirmationExpired} /> : null}
    </>
  );

  if (failure !== null) {
    // The D26 banner only for this refusal's own code: a refused net mode left from another read must not hide
    // another refusal's copy. Retry stays disabled while the app is in the D26 state, whatever the code.
    const refused = failure.code === 'coordinator-refused';
    const retryOff = refused || m.net.mode === 'refused';
    const unreachable = failure.code === 'unreachable';
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    const eyebrow = unreachable ? (online ? 'Could not reach the Noctura server' : "You're offline") : REVIEW_TEXT.couldNot;
    let banner;
    if (refused) banner = <RefusedBanner />;
    else if (failure.code === 'in-flight') {
      banner = (
        <div className="banner info" role="status">
          <ExtIcon name="info" size={18} />
          <div>
            <div className="noc-body-sm banner-title">{REVIEW_TEXT.pending}</div>
            {open === null ? null : (
              <button type="button" className="btn btn-tertiary app-btn-inline" onClick={() => onViewPending(open)}>
                View it
              </button>
            )}
          </div>
        </div>
      );
    } else banner = failureBanner(failure, token);
    const retry = NO_RETRY.has(failure.code) ? null : (
      <LockedButton className="btn btn-primary" disabled={retryOff} onPress={() => simulate(true)}>
        <ExtIcon name="refresh" size={18} />
        {REVIEW_TEXT.retry}
      </LockedButton>
    );
    return (
      <div className="screen s-sim">
        {top}
        <div className="scroll">
          {expiredNotice}
          {head(
            <div className="eyebrow app-failed">
              <ExtIcon name="alert-triangle" size={12} />
              {eyebrow}
            </div>,
            null,
          )}
          {banner}
          {unreachable ? (
            <div className="check-card">
              <h3 className="noc-overline">{cache === null ? 'Last known state' : `Last known state · ${ago(cache.at, now)}`}</h3>
              {cache === null ? null : (
                <div className="check-row warn">
                  <span className="ic">
                    <ExtIcon name="info" size={14} />
                  </span>
                  <div className="copy">
                    <span className="ttl">Stale balance</span>
                    <span className="meta">Showing balance from cache · {showAmount('SOL', cache.sol)} SOL</span>
                  </div>
                  <span className="badge">CACHED</span>
                </div>
              )}
              <div className="check-row warn">
                <span className="ic">
                  <ExtIcon name="info" size={14} />
                </span>
                <div className="copy">
                  <span className="ttl">Cannot verify recipient type</span>
                  <span className="meta">If recipient is an exchange wallet without memo support, funds may be lost</span>
                </div>
                <span className="badge">UNKNOWN</span>
              </div>
            </div>
          ) : null}
        </div>
        <div className="sticky-bar">
          {retry}
          {cancel}
        </div>
      </div>
    );
  }

  if (prepared === null) {
    return (
      <div className="screen s-sim">
        {top}
        <div className="scroll">
          {expiredNotice}
          <div className="m3-prog" aria-hidden="true" />
          {head(
            <div className="eyebrow">
              <ExtIcon name="cpu" size={12} />
              {REVIEW_TEXT.simulating}
            </div>,
            <span className="step-pill">Building call · {Math.max(0, now - startedAt)} ms</span>,
          )}
          <div className="skel-card" aria-busy="true" aria-label="Loading simulation result">
            <div className="skel-line short" />
            <div className="skel-line long" />
            <div className="skel-line med" />
            <div className="skel-line long" />
          </div>
          <div className="skel-card">
            <div className="skel-line short" />
            <div className="skel-line long" />
          </div>
          <div className="footer-meta">{REVIEW_TEXT.simulatingFooter}</div>
        </div>
        <div className="sticky-bar">
          <button type="button" className="btn btn-primary" disabled>
            {REVIEW_TEXT.simulatingCta}
          </button>
          {cancel}
        </div>
      </div>
    );
  }

  const sim = prepared.simulation;
  const sol = token === 'SOL';
  // E2 accepts the simulated state with or without the network fee: the After shown is the engine's own total
  // taken from the balance it read — what the account holds once the fee is paid, whichever form the node used.
  const solAfter = sim.sol.before - prepared.solRequiredLamports;
  const checks = [
    {
      tone: 'ok',
      ttl: 'No interactions with unknown contracts',
      meta: sol ? 'SystemProgram · transfer only' : `Token Program · transfer${prepared.fees.rentLamports > 0n ? " · creates the recipient's token account" : ''}`,
      mono: false,
      badge: 'PASS',
    },
    {tone: 'ok', ttl: 'No token approvals granted', meta: sol ? 'Native SOL transfer · zero allowances changed' : 'Token transfer · zero allowances changed', mono: false, badge: 'PASS'},
    sim.recipient === 'wallet'
      ? {tone: 'ok', ttl: 'Recipient is a regular wallet', meta: `no executable account at ${shortAddress(intent.recipient)}`, mono: true, badge: 'PASS'}
      : sim.recipient === 'new'
        ? {tone: 'ok', ttl: 'Recipient is a new address', meta: 'no account exists yet — this transfer creates it', mono: false, badge: 'PASS'}
        : sim.recipient === 'program'
          ? {tone: 'warn', ttl: 'Recipient is a program, not a wallet', meta: 'funds sent to a program address may not be recoverable', mono: false, badge: 'WARNING'}
          : {tone: 'warn', ttl: 'Recipient is not a regular wallet', meta: 'this address is owned by a program', mono: false, badge: 'WARNING'},
  ];
  return (
    <div className="screen s-sim">
      {top}
      <div className="scroll">
        {expiredNotice}
        {head(
          <div className="eyebrow">
            <ExtIcon name="check-circle" size={12} />
            {REVIEW_TEXT.passed}
          </div>,
          <span className="step-pill is-ready">Ready · {sim.elapsedMs} ms</span>,
        )}
        <div className="check-card">
          <h3 className="noc-overline">{REVIEW_TEXT.what}</h3>
          {checks.map(c => (
            <div className={`check-row ${c.tone}`} key={c.ttl}>
              <span className="ic">
                <ExtIcon name={c.tone === 'ok' ? 'check' : 'alert-triangle'} size={14} />
              </span>
              <div className="copy">
                <span className="ttl">{c.ttl}</span>
                <span className={`meta${c.mono ? ' mono noc-mono' : ''}`}>{c.meta}</span>
              </div>
              <span className="badge">{c.badge}</span>
            </div>
          ))}
        </div>
        <div className="delta-card">
          <h3 className="noc-overline">{REVIEW_TEXT.delta}</h3>
          <div className="delta-row">
            <span className="lbl">Sending</span>
            <span className="val neg noc-numeral">− {amount}</span>
          </div>
          {feeRows(prepared.fees).map(f => (
            <div className="delta-row" key={f.label}>
              <span className="lbl">{f.label}</span>
              {f.lamports === null ? null : <span className="val neg noc-numeral">− {showLamports(f.lamports)} SOL</span>}
            </div>
          ))}
          <div className="delta-row app-after">
            <span className="lbl noc-body">After</span>
            <span className="val noc-balance-md noc-numeral">{showExact('SOL', solAfter)} SOL</span>
          </div>
          {sim.token === null ? null : (
            <div className="delta-row app-after">
              <span className="lbl noc-body">After</span>
              <span className="val noc-balance-md noc-numeral">
                {showExact(sim.token.symbol, sim.token.after)} {sim.token.symbol}
              </span>
            </div>
          )}
        </div>
        <div className="footer-meta">
          Simulated against slot <code>{groupSlot(sim.slot)}</code> · result valid for 30 s
        </div>
      </div>
      <div className="sticky-bar">
        <LockedButton className="btn btn-primary" onPress={proceed}>
          <ExtIcon name="arrow-right" size={18} />
          {REVIEW_TEXT.continue}
        </LockedButton>
        {cancel}
      </div>
    </div>
  );
}

/** The danger banner of a refusal: its title and, where the spec gives one, its line (spec §4.4). */
function failureBanner(f: Failure, token: Intent['token']) {
  switch (f.code) {
    case 'simulation-failed':
      return (
        <Banner tone="danger" title="The network would reject this transfer">
          {f.detail === null ? undefined : <span className="noc-mono">{f.detail.slice(0, 240)}</span>}
        </Banner>
      );
    case 'unreachable':
      return <Banner tone="danger" title="No answer from the Noctura server within 20 s." />;
    case 'simulation-mismatch':
      return (
        <Banner tone="danger" title="Your balance changed while this was being checked">
          Review it again.
        </Banner>
      );
    case 'insufficient-sol':
      return (
        <Banner tone="danger" title="Not enough SOL for the network fee">
          {f.detail === null ? undefined : <span className="noc-mono">{f.detail.slice(0, 240)}</span>}
        </Banner>
      );
    case 'split-balance': {
      // The engine's detail is the largest single holding, in base units (plan 3).
      const most = f.detail !== null && /^\d{1,20}$/.test(f.detail) ? `${showExact(token, BigInt(f.detail))} ${token}` : null;
      return (
        <Banner
          tone="danger"
          title={most === null ? 'This token is spread across several accounts in your wallet. Send less, or move it into one account first.' : `This token is spread across several accounts in your wallet. Send at most ${most}, or move it into one account first.`}
        />
      );
    }
    case 'insufficient-token':
      return <Banner tone="danger" title={`Not enough ${token} in this account.`} />;
    case 'sender-below-rent':
      return <Banner tone="danger" title={REVIEW_TEXT.senderBelowRent} />;
    case 'recipient-below-rent':
      return <Banner tone="danger" title={REVIEW_TEXT.recipientBelowRent} />;
    default:
      return <Banner tone="danger" title="Something went wrong while checking this transfer." />;
  }
}
