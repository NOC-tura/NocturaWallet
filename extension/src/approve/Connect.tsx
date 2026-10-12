import {useState} from 'react';
import {ExtIcon} from '../app/ui/ExtIcon';
import {LockedButton} from '../app/ui/LockedButton';
import {shortAddress} from '../app/format';
import type {Decision, RequestView} from './client';
import {BlockSite, BudgetNotice, ConfirmButton, LookalikeBanner, OriginCard, RiskConfirm, Spinner, Waiting, WindowTop} from './ui';
import {useArmed} from './useArmed';
import {CONNECT_TEXT, WINDOW_TEXT} from './strings';

/**
 * #47 dapp-connect (spec §3.1; index.html ix:17686-18261), every state the spec builds:
 *  - 47a verified: one gate (the permissions ack), "Stay connected" with both scopes;
 *  - 47b unknown: two gates in order — the domain ack in the banner, then the permissions ack — and "Until I revoke"
 *    disabled (C12; the background refuses it too); Q18 for an `xn--` host;
 *  - lookalike: "Suspicious origin", the lookalike banner, the sticky bar flipped — [Reject and report] primary,
 *    "Connect anyway (not recommended)" tertiary → the 2-second confirm → 47b's two gates under the lookalike chrome;
 *  - cap (Q16): only [Reject];
 *  - in progress: "Connecting…", every CTA and ✕ disabled.
 * Connect is `.btn-secondary` (aria-disabled) until every gate clears, then `.btn-primary`; a tap on the locked one
 * shakes the unmet gate and says why. C15 holds the confirming CTAs; Reject is never held. The account picker (Q01)
 * offers the wallet's unlocked accounts, the active one chosen (C1: only a default).
 */
export function Connect({
  request,
  waiting,
  notice,
  busy,
  onDecide,
}: {
  request: RequestView;
  waiting: number;
  notice: boolean;
  busy: boolean;
  onDecide: (d: Decision) => Promise<unknown>;
}) {
  const detail = request.connect;
  const kind = request.site.kind;
  const [scope, setScope] = useState<'session' | 'persistent'>('session');
  const [account, setAccount] = useState<number>(detail?.selected ?? 0);
  const [permsAck, setPermsAck] = useState(false);
  const [domainAck, setDomainAck] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** A lookalike's "Connect anyway" passed the 2-second confirm: 47b's gates under the lookalike chrome. */
  const [anyway, setAnyway] = useState(false);
  const [hint, setHint] = useState(false);
  /** Which gate shakes, and a counter so a second tap shakes again. */
  const [shake, setShake] = useState<{gate: 'perms' | 'domain'; n: number} | null>(null);
  /** Controller ruling (task 9): busy/in-progress folds into the key too — a stale poll that clears it after
   * setBusy(false) must re-start the 500 ms hold like any other state change, never leave Connect already armed. */
  const armed = useArmed([request.requestId, permsAck, domainAck, scope, account, confirming, anyway, busy].join('|'));

  const chosen = detail?.accounts.find(a => a.index === account) ?? detail?.accounts[0];
  const verified = kind === 'verified';
  /** 47b's gates: an unknown origin, or a lookalike past the confirm. */
  const twoGates = kind === 'unknown' || (kind === 'lookalike' && anyway);
  const preConfirm = kind === 'lookalike' && !anyway;
  const cap = detail?.cap === true;
  const gatesOk = permsAck && (!twoGates || domainAck);
  const disabled = busy;
  const reject = () => onDecide({decision: 'reject'});
  const report = () => onDecide({decision: 'report'});
  const connect = async () => {
    if (chosen === undefined) return;
    await onDecide({decision: 'approve', account: chosen.publicKey, scope: twoGates ? 'session' : scope});
  };
  const lockedTap = () => {
    setHint(true);
    setShake(s => ({gate: twoGates && !domainAck ? 'domain' : 'perms', n: (s?.n ?? 0) + 1}));
  };
  const togglePerms = () => {
    // 47b's gates are in order: the permissions ack is the second ("second gate for unknown domain").
    if (twoGates && !domainAck) {
      setShake(s => ({gate: 'domain', n: (s?.n ?? 0) + 1}));
      return;
    }
    setPermsAck(a => !a);
    setHint(false);
  };
  // Odd and even taps use the two animation names, so every tap shakes.
  const permsShake = shake !== null && shake.gate === 'perms' ? (shake.n % 2 === 1 ? 1 : 2) : 0;
  const domainShake = shake !== null && shake.gate === 'domain' ? (shake.n % 2 === 1 ? 1 : 2) : 0;

  const overline = kind === 'verified' ? CONNECT_TEXT.overline.verified : kind === 'unknown' ? CONNECT_TEXT.overline.unknown : CONNECT_TEXT.overline.lookalike;
  const title = verified ? CONNECT_TEXT.title(request.site.name) : CONNECT_TEXT.titleUnknown;
  const short = chosen === undefined ? '' : shortAddress(chosen.publicKey);
  const gateText = twoGates
    ? gatesOk
      ? CONNECT_TEXT.readySession
      : CONNECT_TEXT.gate((domainAck ? 1 : 0) + (permsAck ? 1 : 0), 2)
    : gatesOk
      ? CONNECT_TEXT.ready
      : CONNECT_TEXT.gate(0, 1);
  const partial = twoGates && !gatesOk && (domainAck || permsAck);

  const perms = (
    <div className="s9-perm-card">
      <span className="noc-overline app-dim app-card-overline">{verified ? CONNECT_TEXT.permsVerified(request.site.name) : CONNECT_TEXT.permsUnknown}</span>
      <div className="s9-perm-row">
        <div className="check">
          <ExtIcon name="check" size={12} />
        </div>
        <div>
          <div className="pri">{CONNECT_TEXT.seeAddress}</div>
          <div className="sec">{verified ? CONNECT_TEXT.seeAddressSec(short) : CONNECT_TEXT.seeAddressSecUnknown(short)}</div>
        </div>
        <span className="badge">{CONNECT_TEXT.automatic}</span>
      </div>
      <div className="s9-perm-row">
        <div className="check">
          <ExtIcon name="check" size={12} />
        </div>
        <div>
          <div className="pri">{CONNECT_TEXT.signTx}</div>
          <div className="sec">{CONNECT_TEXT.signTxSec}</div>
        </div>
        <span className="badge">{CONNECT_TEXT.withPrompt}</span>
      </div>
      <div className="s9-perm-row">
        <div className="check">
          <ExtIcon name="check" size={12} />
        </div>
        <div>
          <div className="pri">{CONNECT_TEXT.signMsg}</div>
          <div className="sec">{CONNECT_TEXT.signMsgSec}</div>
        </div>
        <span className="badge">{CONNECT_TEXT.withPrompt}</span>
      </div>
      {preConfirm || cap ? null : (
        <button
          type="button"
          role="checkbox"
          aria-checked={permsAck}
          className={permsAck ? 's9-ack-row is-acked' : permsShake === 1 ? 's9-ack-row app-shake' : permsShake === 2 ? 's9-ack-row app-shake-again' : 's9-ack-row'}
          disabled={disabled}
          onClick={togglePerms}
        >
          <span className="box">
            <ExtIcon name="check" size={11} />
          </span>
          <span className="lbl">
            {permsAck ? CONNECT_TEXT.acked : CONNECT_TEXT.ack}
            <small>{permsAck ? (twoGates ? CONNECT_TEXT.ackedSecUnknown : CONNECT_TEXT.ackedSec) : !twoGates ? CONNECT_TEXT.ackSec : domainAck ? CONNECT_TEXT.ackSecFinal : CONNECT_TEXT.ackSecUnknown}</small>
          </span>
        </button>
      )}
    </div>
  );

  return (
    <div className="screen app-approve">
      <WindowTop overline={overline} tone={kind === 'verified' ? 'neutral' : kind === 'unknown' ? 'warning' : 'danger'} onClose={reject} disabled={disabled} />
      <div className="scroll-area app-approve-scroll">
        {notice ? <BudgetNotice /> : null}
        <h1 className="noc-h1 app-approve-title">{title}</h1>
        <p className="noc-body-sm app-muted app-approve-lede">
          {kind === 'lookalike'
            ? CONNECT_TEXT.ledeShort
            : kind === 'unknown'
              ? gatesOk
                ? [CONNECT_TEXT.ledeUnknownDone[0], <i key="i">{CONNECT_TEXT.ledeUnknownDone[1]}</i>, CONNECT_TEXT.ledeUnknownDone[2]]
                : CONNECT_TEXT.ledeUnknown
              : CONNECT_TEXT.lede}
        </p>
        <div className={busy ? 'app-origin-slot app-busy-dim' : 'app-origin-slot'}>
          <OriginCard site={request.site} origin={request.origin} host={request.host} />
        </div>
        {kind === 'lookalike' ? <LookalikeBanner site={request.site} host={request.host} /> : null}
        {cap ? (
          <div className="s9-flag-banner danger" role="alert">
            <ExtIcon name="alert-triangle" size={18} />
            <div>
              <p className="head">{CONNECT_TEXT.cap}</p>
            </div>
          </div>
        ) : null}
        {twoGates && !cap ? (
          <div className="s9-flag-banner warn">
            <ExtIcon name="alert-triangle" size={18} />
            <div>
              <p className="head">{CONNECT_TEXT.notListed}</p>
              {request.site.international && kind === 'unknown' ? <p className="body">{CONNECT_TEXT.international(request.host)}</p> : null}
              <button
                type="button"
                role="checkbox"
                aria-checked={domainAck}
                className={domainAck ? 'ack is-acked' : domainShake === 1 ? 'ack app-shake' : domainShake === 2 ? 'ack app-shake-again' : 'ack'}
                disabled={disabled}
                onClick={() => {
                  setDomainAck(a => !a);
                  if (domainAck) setPermsAck(false);
                  setHint(false);
                }}
              >
                <span className="box">
                  <ExtIcon name="check" size={10} />
                </span>
                <span className="ack-lbl">{domainAck ? CONNECT_TEXT.domainAcked : CONNECT_TEXT.domainAck}</span>
              </button>
            </div>
          </div>
        ) : null}
        {perms}
        {cap || preConfirm || detail === null ? null : (
          <>
            <label className="app-approve-account">
              <span className="noc-overline app-dim">{CONNECT_TEXT.account}</span>
              <select value={account} disabled={disabled} onChange={e => setAccount(Number(e.target.value))}>
                {detail.accounts.map(a => (
                  <option key={a.index} value={a.index}>
                    {`${a.name} · ${shortAddress(a.publicKey)}`}
                  </option>
                ))}
              </select>
            </label>
            <div className="s9-scope-card" role="radiogroup" aria-label={twoGates ? CONNECT_TEXT.recommended : CONNECT_TEXT.stay}>
              <span className={twoGates ? 'noc-overline noc-warning app-card-overline' : 'noc-overline app-dim app-card-overline'}>{twoGates ? CONNECT_TEXT.recommended : CONNECT_TEXT.stay}</span>
              <button type="button" role="radio" aria-checked={twoGates || scope === 'session'} className={twoGates || scope === 'session' ? 's9-scope-row sel' : 's9-scope-row'} disabled={disabled} onClick={() => setScope('session')}>
                <span className="radio" />
                <span>
                  <span className="pri">{CONNECT_TEXT.session}</span>
                  <span className="sec">{twoGates ? CONNECT_TEXT.sessionSecUnknown : CONNECT_TEXT.sessionSec}</span>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!twoGates && scope === 'persistent'}
                className={twoGates ? 's9-scope-row app-scope-off' : scope === 'persistent' ? 's9-scope-row sel' : 's9-scope-row'}
                disabled={disabled || twoGates}
                onClick={() => setScope('persistent')}
              >
                <span className="radio" />
                <span>
                  <span className="pri">{CONNECT_TEXT.persistent}</span>
                  <span className={twoGates ? 'sec noc-warning' : 'sec'}>{twoGates ? CONNECT_TEXT.persistentSecUnknown : CONNECT_TEXT.persistentSec}</span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>
      {request.offerBlock && !busy ? <BlockSite onBlock={() => onDecide({decision: 'block'})} /> : null}
      <Waiting n={waiting} />
      {cap || preConfirm ? null : (
        <div className={gatesOk ? 's9-gate-status is-ready' : partial ? 's9-gate-status app-gate-partial' : 's9-gate-status'} role="status" aria-live="polite">
          <span className="dot" />
          {gateText}
        </div>
      )}
      {hint && !gatesOk ? (
        <p className="field-msg noc-warning app-approve-hint" role="status">
          {twoGates ? CONNECT_TEXT.hintUnknown : CONNECT_TEXT.hint}
        </p>
      ) : null}
      {cap ? (
        <div className="sticky-bar">
          <LockedButton className="btn btn-secondary" onPress={reject}>
            {WINDOW_TEXT.reject}
          </LockedButton>
        </div>
      ) : preConfirm ? (
        <div className="sticky-bar">
          <LockedButton className="btn btn-destructive" onPress={report} disabled={disabled}>
            <ExtIcon name="close" size={18} />
            {WINDOW_TEXT.rejectAndReport}
          </LockedButton>
          <ConfirmButton armed={armed && !disabled} className="btn btn-tertiary noc-body-sm app-dim" onPress={() => setConfirming(true)}>
            {CONNECT_TEXT.connectAnyway}
          </ConfirmButton>
        </div>
      ) : (
        <div className="sticky-bar row">
          <LockedButton className="btn btn-secondary" onPress={reject} disabled={disabled}>
            {WINDOW_TEXT.reject}
          </LockedButton>
          {busy ? (
            <button type="button" className="btn btn-primary app-cta-wide app-cta-busy" disabled>
              <Spinner />
              {CONNECT_TEXT.connecting}
            </button>
          ) : gatesOk ? (
            <ConfirmButton armed={armed} className="btn btn-primary app-cta-wide" onPress={connect}>
              {kind === 'verified' ? <ExtIcon name="link" size={18} /> : null}
              {twoGates ? CONNECT_TEXT.connectSession : CONNECT_TEXT.connect}
            </ConfirmButton>
          ) : (
            <button type="button" className="btn btn-secondary app-cta-wide" aria-disabled="true" title={twoGates ? CONNECT_TEXT.hintUnknown : CONNECT_TEXT.hint} onClick={lockedTap}>
              {kind === 'verified' ? <ExtIcon name="link" size={18} /> : null}
              {twoGates ? CONNECT_TEXT.connectSession : CONNECT_TEXT.connect}
            </button>
          )}
        </div>
      )}
      {confirming ? (
        <RiskConfirm
          onCancel={() => setConfirming(false)}
          onProceed={() => {
            setConfirming(false);
            setAnyway(true);
          }}
        />
      ) : null}
    </div>
  );
}
