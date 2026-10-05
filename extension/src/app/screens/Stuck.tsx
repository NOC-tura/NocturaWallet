import {useEffect, useRef, useState} from 'react';
import {useWallet} from '../WalletContext';
import {shortAddress} from '../format';
import {showExact} from '../send/rules';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {ExtIcon} from '../ui/ExtIcon';
import {RefusedBanner} from '../ui/Banner';
import {LockedButton} from '../ui/LockedButton';
import {useCopy} from '../ui/useCopy';
import type {Intent, Pending, PendingState} from '../engine';

/** The fixed strings #54 shows (spec §4.8, D23); adapted ones are marked there. */
export const STUCK_TEXT = {
  title: 'Transaction stuck',
  chip: '90 s timeout',
  pendingFor: 'Pending for',
  bannerBold: "The network hasn't confirmed it yet — it may be congested, or the transaction may have been dropped.",
  bannerLine: 'Funds have not moved yet. This transaction can still land until its blockhash expires.',
  original: 'Original transaction',
  stillPending: 'Original (still pending)',
  againName: 'Send again',
  recommended: 'Recommended',
  againWhat: 'Re-send the exact same signed transaction. Same signature — it can land at most once, and you pay its fee at most once.',
  waitName: 'Wait for expiry',
  waitWhat: 'If it has not landed when its blockhash expires, Noctura checks twice and then tells you no funds moved. Only then can you try again.',
  sendAgain: 'Send again (same transaction)',
  close: 'Close',
  sendingTitle: 'Sending again…',
  sendingLine: 'Re-sending the same transaction.',
  sentTitle: 'Sent again',
  sentLine: 'The same transaction was sent to the network again. Its signature is unchanged, so only one copy can land.',
  watching: 'Watching',
  viewActivity: 'View in Activity',
  done: 'Done',
  expiredTitle: 'Transaction',
  expiredHead: 'Not confirmed — no funds moved.',
  expiredLine: 'Its blockhash expired and two checks found it on no block. You can now make a new attempt.',
  tryAgain: 'Try again',
  tooSoon: 'Wait a moment before sending again.',
  untracked: 'This transaction is no longer tracked.',
  openActivity: 'Open Activity',
} as const;

/** "01:34" — minutes and seconds since `from` (the design's counter; a send is open for minutes, never hours). */
export function mmss(from: number, now: number): {mm: string; ss: string} {
  const s = Math.max(0, Math.floor((now - from) / 1000));
  return {mm: String(Math.floor(s / 60)).padStart(2, '0'), ss: String(s % 60).padStart(2, '0')};
}

/**
 * The hash's copy control with CopyButton's honesty ("Copied" only when the clipboard took it): the design's
 * `.copy-chip` on the original's card, and its accent "Copy" inside 54d's hash line.
 */
function HashCopy({signature, variant}: {signature: string; variant: 'chip' | 'link'}) {
  const [state, copy] = useCopy();
  const text = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy';
  return (
    <button type="button" className={variant === 'chip' ? 'copy-chip' : 'app-hash-copy'} aria-label={state === 'idle' ? 'Copy transaction hash' : text} onClick={() => copy(signature)}>
      <ExtIcon name="copy" size={11} />
      {text}
    </button>
  );
}

const OPEN: readonly PendingState[] = ['pending', 'stuck'];

/**
 * #54 stuck-tx, the safe variant (spec §4.8, D23): the design's layout, only the levers differ. "Send again"
 * re-sends the SAME signed bytes (wallet.resend: same signature, it can land at most once); "Wait for expiry"
 * explains what happens without a tap. "Speed up" and "Cancel with replacement" are not built — both are new
 * transactions while the original can still land. The record comes from #21's 2 s poll; when it confirms or
 * fails, #21 shows that instead (until then this screen shows only its neutral top bar); when it expires, this
 * screen shows its expired layout — the engine's `expired` (the record's, or a resend answer's), never a judgement of
 * the screen's own. No fee is shown on any of its layouts: none of them has paid one (feePaidLamports is null for
 * stuck and expired, and a re-send pays nothing new).
 */
export function Stuck({
  record,
  now,
  canRetry,
  onClose,
  onActivity,
  onTryAgain,
}: {
  record: Pending;
  now: number;
  /** The record's account is the selected one (#27's owner rule; final review I1): only then is the expired [Try again] offered. */
  canRetry: boolean;
  onClose: () => void;
  onActivity: () => void;
  onTryAgain: (intent: Intent) => void;
}) {
  const m = useWallet();
  const [phase, setPhase] = useState<'stuck' | 'sending' | 'sent' | 'untracked'>('stuck');
  const [line, setLine] = useState<string | null>(null);
  /**
   * The record's state as a resend answered it, when that is no longer open (a poll moved it meanwhile), or
   * `not-open` (refused for that reason): it overrides an open `record.state` until the poll hands in the new one.
   */
  const [moved, setMoved] = useState<PendingState | 'not-open' | null>(null);
  /**
   * Bumped when what a resend answers for is gone — unmount, another record or state handed in, another account
   * selected: an answer to an older generation is dropped, and the screen starts again from its stuck layout.
   */
  const gen = useRef(0);
  // Another account selected (not the first read of this one: null → the record's account is no switch).
  const elsewhere = m.account !== null && m.account.publicKey !== record.account;
  useEffect(() => {
    setPhase('stuck');
    setLine(null);
    setMoved(null);
    return () => {
      gen.current += 1;
    };
  }, [record.id, record.state, record.account, elsewhere]);
  const refused = m.net.mode === 'refused';
  const amount = `${showExact(record.intent.token, record.intent.amount)} ${record.intent.token}`;
  const {mm, ss} = mmss(record.createdAt, now);
  const hash = shortAddress(record.signature);
  const state = OPEN.includes(record.state) ? moved ?? record.state : record.state;

  const sendAgain = async () => {
    const g = gen.current;
    setLine(null);
    setPhase('sending');
    const r = await m.engine.resend(record.id);
    if (gen.current !== g) return;
    setPhase('stuck');
    if (r.ok) {
      // The answer's own state first: a poll may have moved the record meanwhile (confirmed, failed, expired) —
      // then nothing about this re-send is claimed and the poll routes.
      if (!OPEN.includes(r.data.state)) return setMoved(r.data.state);
      // Acknowledged: the route took the same bytes. Otherwise the engine's own words say why, and the screen stays
      // stuck — the bytes may still have reached the network, so never "Sent again" and never "nothing sent". A 403
      // (or the cool-down after one) is the D26 state for the whole popup. Chosen on the code, never the text.
      if (r.data.detailCode === null) return setPhase('sent');
      setLine(r.data.detail);
      if (r.data.detailCode === 'forbidden' || r.data.detailCode === 'cooling') m.report('coordinator-refused');
      return;
    }
    if (r.error === 'too-soon') setLine(STUCK_TEXT.tooSoon);
    else if (r.error === 'unknown') setPhase('untracked');
    else if (r.error === 'not-open') setMoved('not-open');
    else if (r.error === 'coordinator-refused' || r.error === 'unreachable') m.report(r.error);
    // failed / malformed: the outcome is not known, so the stuck layout stays as it was (it claims nothing about this
    // re-send) and the 2 s poll goes on.
  };

  const top = (title: string, close: boolean) => (
    <div className="top-bar">
      <button type="button" className="icon-btn" aria-label="Close" disabled={!close} onClick={onClose}>
        <ExtIcon name="close" size={22} />
      </button>
      <div className="title">{title}</div>
      {title === STUCK_TEXT.title ? <span className="step">{STUCK_TEXT.chip}</span> : null}
    </div>
  );

  if (state === 'expired') {
    return (
      <div className="screen s-stuck">
        {top(STUCK_TEXT.expiredTitle, true)}
        {/* §7.2 (D26; final review M2): the banner says why [Try again] is disabled. */}
        {refused ? <RefusedBanner /> : null}
        <div className="progress-state done-cancelled">
          <div className="ring">
            <ExtIcon name="close" size={26} />
          </div>
          <div className="head">{STUCK_TEXT.expiredHead}</div>
          <div className="sub">{STUCK_TEXT.expiredLine}</div>
          <div className="meta-grid">
            <span className="k">Tx hash</span>
            <span className="v mono noc-mono">{hash}</span>
          </div>
        </div>
        <div className="sticky-bar">
          {canRetry ? (
            <LockedButton className="btn btn-primary" disabled={refused} onPress={() => onTryAgain(record.intent)}>
              {STUCK_TEXT.tryAgain}
            </LockedButton>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {STUCK_TEXT.done}
          </button>
        </div>
      </div>
    );
  }

  // Confirmed, failed, or refused as no longer open: #21 (success) or #44 shows it — here only the neutral top bar.
  if (state !== 'pending' && state !== 'stuck') {
    return (
      <div className="screen s-stuck" aria-busy="true">
        {top(STUCK_TEXT.expiredTitle, true)}
      </div>
    );
  }

  if (phase === 'untracked') {
    return (
      <div className="screen s-stuck">
        {top(STUCK_TEXT.title, true)}
        <p className="noc-body app-muted">{STUCK_TEXT.untracked}</p>
        <div className="sticky-bar">
          <button type="button" className="btn btn-primary" onClick={onActivity}>
            {STUCK_TEXT.openActivity}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'sent') {
    return (
      <div className="screen s-stuck">
        {top(STUCK_TEXT.sentTitle, true)}
        <div className="progress-state done-success">
          <div className="ring">
            <ExtIcon name="check" size={32} />
          </div>
          <div className="head">{STUCK_TEXT.sentTitle}</div>
          <div className="sub">{STUCK_TEXT.sentLine}</div>
          <div className="new-tx-hash noc-mono">
            {hash} · <HashCopy signature={record.signature} variant="link" />
          </div>
          <div className="meta-grid">
            <span className="k">Tx hash</span>
            <span className="v mono noc-mono">{hash}</span>
            <span className="k">Status</span>
            <span className="v app-success">{STUCK_TEXT.watching}</span>
          </div>
        </div>
        <div className="sticky-bar">
          <button type="button" className="btn btn-primary" onClick={onActivity}>
            {STUCK_TEXT.viewActivity}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {STUCK_TEXT.done}
          </button>
        </div>
      </div>
    );
  }

  // stuck and sending share one tree, so the Send again LockedButton stays mounted (disabled) while the resend is out
  // and its 500 ms floor holds when the stuck layout comes back (rule 6).
  const sending = phase === 'sending';
  return (
    <div className="screen s-stuck">
      {sending ? top(STUCK_TEXT.sendingTitle, false) : top(STUCK_TEXT.title, true)}
      {sending ? (
        <>
          <div className="progress-state">
            <div className="ring" />
            <div className="head">{STUCK_TEXT.sendingLine}</div>
          </div>
          <div className="orig-card app-dim-card">
            <div className="head">
              <span className="label">{STUCK_TEXT.stillPending}</span>
              <span className="pill app-pill-warning noc-numeral">
                {mm}:{ss} elapsed
              </span>
            </div>
            <div className="row">
              <span className="k">Amount</span>
              <span className="v amount noc-numeral">{amount}</span>
            </div>
            <div className="row">
              <span className="k">Tx hash</span>
              <span className="v mono noc-mono">{hash}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {refused ? <RefusedBanner /> : null}
          <div className="pending-counter" aria-live="polite">
            <div className="label">{STUCK_TEXT.pendingFor}</div>
            <div className="time">
              <span className="mm">{mm}</span>
              <span className="sep">:</span>
              <span className="ss">{ss}</span>
            </div>
          </div>
          <div className="warn-banner" role="status">
            <ExtIcon name="alert-triangle" size={16} />
            <div className="body">
              <b>{STUCK_TEXT.bannerBold}</b>
              <br />
              {STUCK_TEXT.bannerLine}
            </div>
          </div>
          {record.detail === null || record.detail === line ? null : <p className="noc-caption app-muted">{record.detail}</p>}
          <div className="orig-card">
            <div className="head">
              <span className="label">{STUCK_TEXT.original}</span>
              <span className="pill">Send</span>
            </div>
            <div className="row">
              <span className="k">Amount</span>
              <span className="v amount noc-numeral">{amount}</span>
            </div>
            <div className="row">
              <span className="k">Recipient</span>
              <span className="v mono noc-mono">
                <AddressGroups address={record.intent.recipient} />
              </span>
            </div>
            <div className="row">
              <span className="k">Tx hash</span>
              <span className="v mono noc-mono">
                {hash}
                <HashCopy signature={record.signature} variant="chip" />
              </span>
            </div>
            <div className="row">
              <span className="k">Valid until block</span>
              <span className="v noc-numeral">{record.lastValidBlockHeight}</span>
            </div>
          </div>
          <div className="recovery-card recommended">
            <div className="rec-head">
              <span className="name">{STUCK_TEXT.againName}</span>
              <span className="recommended-pill">{STUCK_TEXT.recommended}</span>
            </div>
            <div className="what">{STUCK_TEXT.againWhat}</div>
          </div>
          <div className="recovery-card">
            <div className="rec-head">
              <span className="name">{STUCK_TEXT.waitName}</span>
            </div>
            <div className="what">{STUCK_TEXT.waitWhat}</div>
          </div>
        </>
      )}
      <div className="sticky-bar">
        <LockedButton className="btn btn-primary" disabled={refused || sending} onPress={sendAgain}>
          {STUCK_TEXT.sendAgain}
        </LockedButton>
        <button type="button" className="btn btn-secondary" disabled={sending} onClick={onClose}>
          {STUCK_TEXT.close}
        </button>
        {line === null || sending ? null : (
          <p className="noc-caption app-warning app-center-text" role="alert">
            {line}
          </p>
        )}
      </div>
    </div>
  );
}
