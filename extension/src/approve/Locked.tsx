import {ExtIcon} from '../app/ui/ExtIcon';
import {LockedButton} from '../app/ui/LockedButton';
import {PhraseLine} from '../app/ui/PhraseLine';
import type {RequestView} from './client';
import {BudgetNotice, OriginCard, Waiting} from './ui';
import {WINDOW_TEXT} from './strings';
import type {PhraseRead} from '../shared/phraseRead';

/**
 * The locked window (spec §4.3, D11): the Noctura mark, Q22, Q23, the request's origin card, and [Reject]. No password
 * field and no link into the vault page — the user learns one rule: the password is typed only after clicking the
 * Noctura icon. The window polls every second; when the unlock lands it shows the request. `notice` (fix round 1, I1):
 * Q24 is latched by `Approve`, so it shows here too, not only once the window has unlocked — in normal flow above the
 * centred group (fix round 1, M-b), not swept into it: it used to inherit the group's `text-align: center` and land
 * wherever the (short) centred content happened to put it, instead of sitting at the scroll area's own top inset like
 * every other banner in this window. B1e §1.2: the anti-phishing phrase above it all — this window has no top bar.
 */
export function Locked({request, waiting, notice, onReject, phrase}: {request: RequestView; waiting: number; notice: boolean; onReject: () => Promise<unknown>; phrase: PhraseRead}) {
  return (
    <div className="screen app-approve app-approve-locked">
      <div className="scroll-area app-approve-scroll">
        <PhraseLine phrase={phrase} />
        {notice ? <BudgetNotice /> : null}
        <div className="app-approve-locked-center">
          <div className="app-lock-tile" aria-hidden="true">
            <ExtIcon name="lock" size={28} />
          </div>
          <h2 className="s7-wordmark">
            noctura<span className="dot">.</span>
          </h2>
          <h1 className="noc-h1">{WINDOW_TEXT.lockedTitle}</h1>
          <p className="noc-body app-muted">{WINDOW_TEXT.lockedBody}</p>
          <div className="app-origin-slot">
            <OriginCard site={request.site} origin={request.origin} host={request.host} />
          </div>
        </div>
      </div>
      <Waiting n={waiting} />
      <div className="sticky-bar">
        <LockedButton className="btn btn-secondary" onPress={onReject}>
          {WINDOW_TEXT.reject}
        </LockedButton>
      </div>
    </div>
  );
}
