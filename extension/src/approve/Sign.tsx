import {useState, type ReactNode} from 'react';
import {ExtIcon} from '../app/ui/ExtIcon';
import {LockedButton} from '../app/ui/LockedButton';
import type {Decision, RequestView} from './client';
import {BlockSite, BudgetNotice, ConfirmButton, LookalikeBanner, OriginCard, RiskConfirm, Spinner, Waiting, WindowTop} from './ui';
import {useArmed} from './useArmed';
import {SIGN_TEXT, WINDOW_TEXT} from './strings';

/** The message as text, with the background's ranges <mark>ed (rule 6's keyword; a lookalike's homoglyphs). */
function preview(text: string, marks: readonly {start: number; end: number}[]): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  for (const [i, m] of marks.entries()) {
    if (m.start < at) continue;
    if (m.start > at) out.push(text.slice(at, m.start));
    out.push(<mark key={i}>{text.slice(m.start, m.end)}</mark>);
    at = m.end;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/**
 * #46 sign-message (spec §3.2 steps 4–7; index.html ix:17442-17686), every state the spec builds:
 *  - idle: "Signature request", the origin card (verified / unknown), "Message · UTF-8 (n chars)", the message as text in
 *    mono (scrollable), the disclaimer, [Reject] + [Sign];
 *  - the structured-approval alert when a keyword fired (rule 6): the design's head and body, the word marked, the label
 *    "Message · with structured-approval flag";
 *  - lookalike: "Suspicious origin", the short lede, the banner, "Message preview" with every homoglyph marked, [Reject
 *    and report] primary and "Sign anyway (not recommended)" → the 2-second confirm — only "I understand the risk" signs;
 *  - a sign-in message for another domain (rule 3): the red banner Q20 and no Sign — only [Reject];
 *  - signing: "Signing", "Signing…" with the ring, the origin card at .55 and the message at .7, every CTA and ✕ off.
 * C15 holds Sign, Sign anyway and I understand the risk; Reject is never held. The armed key folds in `busy` too
 * (controller ruling, this task): a stale poll that clears busy without the user re-arming anything must not leave a
 * confirming CTA already armed from before the busy window — it is a state change like any other and re-starts the hold.
 */
export function Sign({request, waiting, notice, busy, onDecide}: {request: RequestView; waiting: number; notice: boolean; busy: boolean; onDecide: (d: Decision) => Promise<unknown>}) {
  const detail = request.sign;
  const lookalike = request.site.kind === 'lookalike';
  const [confirming, setConfirming] = useState(false);
  const armed = useArmed([request.requestId, confirming, busy].join('|'));
  if (detail === null) return null;
  const mismatch = detail.siwsMismatch;
  const sign = () => onDecide({decision: 'approve', account: detail.account.publicKey});
  const reject = () => onDecide({decision: 'reject'});
  const label = lookalike ? SIGN_TEXT.labelLookalike : detail.keyword !== null ? SIGN_TEXT.labelKeyword : SIGN_TEXT.label(detail.chars);
  return (
    <div className="screen app-approve">
      <WindowTop overline={busy ? SIGN_TEXT.overlineSigning : lookalike ? SIGN_TEXT.overlineLookalike : SIGN_TEXT.overline} tone={busy ? 'neutral' : lookalike ? 'danger' : 'neutral'} onClose={reject} disabled={busy} />
      <div className="scroll-area app-approve-scroll">
        {notice ? <BudgetNotice /> : null}
        <h1 className="noc-h1 app-approve-title">{SIGN_TEXT.title}</h1>
        {busy ? null : <p className="noc-body-sm app-muted app-approve-lede">{lookalike ? SIGN_TEXT.ledeShort : SIGN_TEXT.lede}</p>}
        <div className={busy ? 'app-origin-slot app-busy-dim' : 'app-origin-slot'}>
          <OriginCard site={request.site} origin={request.origin} host={request.host} />
        </div>
        {lookalike ? <LookalikeBanner site={request.site} host={request.host} /> : null}
        {mismatch !== null ? (
          <div className="s9-domain-warn" role="alert">
            <ExtIcon name="alert-triangle" size={20} />
            <div className="body">{SIGN_TEXT.siwsMismatch(mismatch, request.host)}</div>
          </div>
        ) : null}
        {detail.keyword !== null ? (
          <div className="s9-struct-alert" role="alert">
            <ExtIcon name="alert-triangle" size={20} />
            <div>
              <p className="head">{SIGN_TEXT.alertHead}</p>
              <p className="body">
                {SIGN_TEXT.alertLead}
                <code className="noc-mono noc-warning">{detail.keyword}</code>
                {SIGN_TEXT.alertTail}
              </p>
            </div>
          </div>
        ) : null}
        <div className={busy ? 's9-msg-card app-busy-dim-msg' : 's9-msg-card'}>
          <span className="label">{label}</span>
          <div className="s9-msg-preview" tabIndex={0}>
            {preview(detail.text, detail.marks)}
          </div>
        </div>
        {busy ? null : (
          <div className="s9-disclaimer">
            <ExtIcon name="info" size={16} />
            <p>{SIGN_TEXT.disclaimer(request.site.name)}</p>
          </div>
        )}
      </div>
      {request.offerBlock && !busy ? <BlockSite onBlock={() => onDecide({decision: 'block'})} /> : null}
      <Waiting n={waiting} />
      {mismatch !== null ? (
        <div className="sticky-bar">
          <LockedButton className="btn btn-secondary" onPress={reject}>
            {WINDOW_TEXT.reject}
          </LockedButton>
        </div>
      ) : lookalike && !busy ? (
        <div className="sticky-bar">
          <LockedButton className="btn btn-destructive" onPress={() => onDecide({decision: 'report'})}>
            <ExtIcon name="close" size={18} />
            {WINDOW_TEXT.rejectAndReport}
          </LockedButton>
          <ConfirmButton armed={armed} className="btn btn-tertiary noc-body-sm app-dim" onPress={() => setConfirming(true)}>
            {SIGN_TEXT.signAnyway}
          </ConfirmButton>
        </div>
      ) : (
        <div className="sticky-bar row">
          <LockedButton className="btn btn-secondary" onPress={reject} disabled={busy}>
            {WINDOW_TEXT.reject}
          </LockedButton>
          {busy ? (
            <button type="button" className="btn btn-primary app-cta-wide app-cta-busy" disabled>
              <Spinner />
              {SIGN_TEXT.signing}
            </button>
          ) : (
            <ConfirmButton armed={armed} className="btn btn-primary app-cta-wide" onPress={sign}>
              <ExtIcon name="key" size={18} />
              {SIGN_TEXT.sign}
            </ConfirmButton>
          )}
        </div>
      )}
      {confirming ? (
        <RiskConfirm
          onCancel={() => setConfirming(false)}
          onProceed={async () => {
            setConfirming(false);
            await sign();
          }}
        />
      ) : null}
    </div>
  );
}
