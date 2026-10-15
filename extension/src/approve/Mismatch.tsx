import {ExtIcon} from '../app/ui/ExtIcon';
import {LockedButton} from '../app/ui/LockedButton';
import type {Decision, RequestView} from './client';
import {BudgetNotice, Waiting, WindowTop, siteLabel} from './ui';
import {MISMATCH_TEXT} from './strings';

/**
 * #48 "origin-mismatch · auto-reject" (index.html ix:18484-18521; B1 §3: "request origin differs from the granted origin
 * → blocked, no override"): a site asked to sign with an account another origin was granted. The page was answered
 * `unauthorized` before this window opened — there is no Approve path; [OK, return to dApp] only dismisses the notice
 * (the background refuses any other decision). Declared departures: "Review session in Settings" is not offered (the
 * approval window never opens the wallet's pages — D11's rule, as the locked screen), and the caption names Settings →
 * Connected dApps (Q03, D1).
 */
export function Mismatch({request, waiting, notice, busy, onDecide}: {request: RequestView; waiting: number; notice: boolean; busy: boolean; onDecide: (d: Decision) => Promise<unknown>}) {
  // Fix round 1 (promoted minor 4): the same host-display source as the popup's strip and #10 (siteLabel) — never a
  // second, slightly different implementation of the same idea.
  const granted = request.mismatch === null ? '—' : siteLabel(request.mismatch.granted, request.mismatch.granted);
  const here = siteLabel(request.origin, request.host);
  const dismiss = () => onDecide({decision: 'reject'});
  const body = MISMATCH_TEXT.flagBody(granted, here);
  const caption = MISMATCH_TEXT.caption(granted);
  return (
    <div className="screen app-approve">
      <WindowTop overline={MISMATCH_TEXT.overline} tone="danger" onClose={dismiss} disabled={busy} />
      <div className="scroll-area app-approve-scroll">
        {notice ? <BudgetNotice /> : null}
        <div className="s9-fail-hero">
          <div className="ring">
            <div className="ring-inner">
              <ExtIcon name="close" size={32} />
            </div>
          </div>
          <h1 className="head">{MISMATCH_TEXT.head}</h1>
          <p className="sub">{MISMATCH_TEXT.sub}</p>
        </div>
        <div className="s9-flag-banner danger app-tx-block" role="alert">
          <ExtIcon name="alert-triangle" size={18} />
          <div>
            <p className="head">{MISMATCH_TEXT.flagHead}</p>
            <p className="body">
              {body[0]}
              <code className="noc-mono">{body[1]}</code>
              {body[2]}
              <code className="noc-mono noc-danger">{body[3]}</code>
              {body[4]}
            </p>
          </div>
        </div>
        <div className="s9-payload-card app-tx-block">
          <span className="label">{MISMATCH_TEXT.detail}</span>
          <div className="row">
            <span className="k">{MISMATCH_TEXT.activeSession}</span>
            <span className="v mono noc-success">{granted}</span>
          </div>
          <div className="row">
            <span className="k">{MISMATCH_TEXT.requestOrigin}</span>
            <span className="v mono noc-danger">{here}</span>
          </div>
          <div className="row">
            <span className="k">{MISMATCH_TEXT.match}</span>
            <span className="v noc-danger">{MISMATCH_TEXT.matchValue}</span>
          </div>
          <div className="row">
            <span className="k">{MISMATCH_TEXT.action}</span>
            <span className="v noc-danger">{MISMATCH_TEXT.actionValue}</span>
          </div>
        </div>
        <p className="noc-caption app-dim app-tx-caption">
          {caption[0]}
          <code className="noc-mono">{caption[1]}</code>
          {caption[2]}
        </p>
      </div>
      <Waiting n={waiting} />
      <div className="sticky-bar">
        <LockedButton className="btn btn-primary" onPress={dismiss} disabled={busy}>
          <ExtIcon name="shield-check" size={18} />
          {MISMATCH_TEXT.ok}
        </LockedButton>
      </div>
    </div>
  );
}
