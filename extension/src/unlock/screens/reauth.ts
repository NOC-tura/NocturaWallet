import {evaluatePrf} from '../../vault/passkey';
import {unb64} from '../../vault/bytes';
import type {EnvelopeV1} from '../../vault/envelope';
import {discardPrepared, readChallenge, type Description} from '../challenge';
import {createWrongBackoff} from '../orchestrate';
import {exclusive, resumeTarget, type PageDeps} from '../page';
import {runReauth, type ReauthPageOutcome} from '../reauthFlow';
import {passkeyOf, storedVault} from '../stored';
import {COMMON, REAUTH, cooldownLabel} from '../strings';
import {byId, h, setText, showScreen, shown} from '../view/dom';
import {startCooldown} from '../view/cooldown';
import {addressGroups} from '../view/words';

export interface ReauthScreen {
  show(challengeId: string): Promise<void>;
  /** Whether the screen still references a typed password (the field, or one not yet handed to the attempt). */
  holds(): boolean;
}

/**
 * Where #10 is: `loading` (reading what is stored, then the description), `entry` (idle, error, checking,
 * cooldown), a `notice` (undescribable, expired, not-unlocked, mismatch-locked, damaged, no-wallet, unreadable,
 * cancelled, a settings confirmation), or `done` (the hand-over to the resume route: the tab is leaving). Every
 * button acts only in its own phase (rule 6's phase guard), whatever `hidden` or `disabled` say.
 */
type View = 'loading' | 'entry' | 'notice' | 'done';

/**
 * #10 unlock-send — re-authentication (spec §3.10, E3, D38, D39). The challenge id comes from the URL;
 * what it is for comes ONLY from vault.challengeInfo, re-validated by challenge.ts before any text is
 * built. A description that fails is "The details of this action could not be shown." with only
 * [Cancel send]. After a proven factor the send is NOT executed (D38): the same tab goes to the UI tab's
 * resume route, where #20 shows a fresh preview and one tap sends. [Cancel send] discards the prepared
 * send (E7) first, then says "Send cancelled. Nothing was sent." and closes the tab — also from the
 * `undescribable` state, with the one field it re-validated by itself (the account). When even that is
 * not an address, the button is [Close] and the line says only what is true: nothing was sent here
 * (plan review H1). In every other notice state the top bar's X closes the tab and claims nothing (L4).
 * A `vault.reauthOk` answered `unknown-challenge` is `expired`, never `failed` (D39).
 *
 * The password and the passkey follow #9's rules (Task 10): the typed password is taken out of the field at
 * the click and handed to the attempt in the same turn; a hidden tab or `pagehide` empties the field; a
 * passkey's PRF output is zeroed by runReauth on every path. A wrong factor gets the engine's backoff only
 * (D11), shown as #9's cooldown card and said once in a polite live region; damaged and no-wallet are never
 * charged to it (createWrongBackoff counts `wrong` only).
 *
 * Rule 6 (spec §7.6): every button runs through the page's one `exclusive()` gate, with its phase checked
 * before and inside it.
 */
export function mountReauth(deps: PageDeps): ReauthScreen {
  const field = byId<HTMLInputElement>('ra-password');
  const confirm = byId<HTMLButtonElement>('ra-confirm');
  const passkey = byId<HTMLButtonElement>('ra-passkey');
  const cancel = byId<HTMLButtonElement>('ra-cancel');
  const x = byId<HTMLButtonElement>('ra-x');
  const unlock = byId<HTMLButtonElement>('ra-unlock');
  const live = byId('ra-cooldown-live');
  const backoff = createWrongBackoff(deps.sleep);
  let challengeId = '';
  let described: Description | null = null;
  /** `undescribable` only: the send's account, valid by itself — what [Cancel send] discards. */
  let orphan: string | null = null;
  /** `undescribable` with no valid account: the button only closes the tab. */
  let closeOnly = false;
  let pk: NonNullable<EnvelopeV1['passkey']> | null = null;
  let view: View = 'loading';
  /** The not-unlocked notice offers [Unlock]. */
  let offerUnlock = false;
  let canCancel = false;
  let stopCooldown: (() => void) | null = null;
  /** The typed password between the click and the attempt taking it (the same turn). */
  let typed: string | null = null;

  const render = () => {
    const busy = deps.gate.isBusy();
    const entry = view === 'entry';
    const cooling = entry && stopCooldown !== null;
    shown(byId('ra-loading'), view === 'loading');
    shown(byId('ra-intent'), described !== null && (entry || view === 'done'));
    shown(byId('ra-entry'), (entry && !cooling) || view === 'done');
    shown(byId('ra-cooldown'), cooling);
    shown(byId('ra-notice'), view === 'notice');
    shown(confirm, entry && !cooling);
    shown(byId('ra-paused'), cooling);
    shown(passkey, entry && !cooling && pk !== null);
    shown(cancel, canCancel);
    shown(unlock, view === 'notice' && offerUnlock);
    field.disabled = busy || !entry;
    confirm.disabled = busy || !entry;
    passkey.disabled = busy || !entry || pk === null;
    cancel.disabled = busy || !canCancel;
    unlock.disabled = busy || !offerUnlock;
    x.disabled = busy || !(canCancel || view === 'notice');
    x.setAttribute('aria-label', canCancel && !closeOnly && described?.kind !== 'settings' ? REAUTH.cancel : REAUTH.close);
  };
  const helper = (text: string, error: boolean) => {
    setText(byId('ra-helper'), text);
    byId('ra-helper').classList.toggle('error', error);
    field.classList.toggle('is-error', error);
  };
  /** A notice replaces the field. An empty help line is hidden. */
  const notice = (line: string, o: {help?: string; cancel?: boolean; unlock?: boolean} = {}) => {
    view = 'notice';
    field.value = '';
    helper('', false);
    canCancel = o.cancel === true;
    offerUnlock = o.unlock === true;
    setText(byId('ra-notice-line'), line);
    noticeHelp(o.help ?? '');
    render();
  };
  const noticeHelp = (help: string) => {
    const el = byId('ra-notice-help');
    setText(el, help);
    shown(el, help !== '');
  };
  const failed = () => (view === 'notice' ? noticeHelp(COMMON.failedTryAgain) : helper(COMMON.failedTryAgain, false));
  const row = (label: string, value: Node | string | null) => {
    const r = h('div', 'intent-row');
    r.append(h('span', 'label noc-body-sm', label));
    if (value !== null) {
      const v = h('span', 'value noc-body-sm noc-numeral');
      v.append(value);
      r.append(v);
    }
    return r;
  };
  const describe = (d: Description) => {
    if (d.kind === 'send') {
      setText(byId('ra-about'), REAUTH.aboutSend);
      setText(byId('ra-amount'), d.amount);
      setText(byId('ra-symbol'), d.symbol);
      shown(byId('ra-amount-row'), true);
      byId('ra-rows').replaceChildren(row(REAUTH.to, addressGroups(d.recipient)), ...d.fees.map(f => row(f.label, f.value)));
      byId('ra-reasons').replaceChildren(...d.reasons.map(r => h('p', 'noc-body-sm vlt-lede', r)));
      setText(cancel, REAUTH.cancelSend);
    } else {
      setText(byId('ra-about'), REAUTH.aboutChange);
      shown(byId('ra-amount-row'), false);
      byId('ra-rows').replaceChildren(...d.lines.map(l => row(l, null)));
      byId('ra-reasons').replaceChildren();
      setText(cancel, REAUTH.cancel);
    }
  };
  const endCooldown = () => {
    stopCooldown?.();
    stopCooldown = null;
    setText(live, '');
  };
  const cooldown = (ms: number) => {
    field.value = ''; // nothing typed sits in the field through the wait
    stopCooldown = startCooldown(deps.timers, ms, {timer: byId('ra-timer'), label: byId('ra-cooldown-label'), ring: byId('ra-ring')});
    // Said once, politely: the card's figures change every second and are not a live region (as #9).
    setText(live, cooldownLabel(Math.ceil(ms / 1000)));
    render();
  };
  const settle = (out: ReauthPageOutcome | 'unavailable') => {
    endCooldown();
    field.value = '';
    if (out === 'confirmed') {
      helper('', false);
      if (described?.kind === 'send') {
        // D38: the hand-over is the only thing a confirmed send does here; the account is the one challenge.ts
        // validated, checked again by resumeTarget. Nothing is sent from #10.
        const target = resumeTarget(described.account);
        if (target !== null) {
          view = 'done';
          canCancel = false;
          render();
          deps.go(target);
          return;
        }
      }
      return notice(REAUTH.settingsConfirmed);
    }
    if (out === 'wrong') return helper(COMMON.wrongConfirm, true);
    if (out === 'unavailable') return helper(COMMON.passkeyUnavailableConfirm, false);
    if (out === 'failed') return helper(COMMON.failedTryAgain, false);
    if (out === 'expired') return notice(REAUTH.expired);
    if (out === 'not-unlocked') return notice(REAUTH.notUnlocked, {unlock: true});
    if (out === 'mismatch-locked') return notice(COMMON.mismatchLocked);
    if (out === 'damaged') return notice(COMMON.damaged, {help: COMMON.damagedHelp});
    return notice(COMMON.noWallet);
  };
  const open = () => view === 'entry' && stopCooldown === null;
  const flow = () => ({readEnvelope: deps.store.readEnvelope, send: deps.send});

  const proveWithPassword = () => {
    if (!open() || field.value === '') return;
    void exclusive(deps, render, async () => {
      if (!open() || field.value === '') return;
      typed = field.value;
      field.value = '';
      helper(REAUTH.checking, false);
      const out = await backoff.run(() => {
        const password = typed ?? '';
        typed = null;
        return runReauth(flow(), challengeId, {password, kdf: deps.kdf});
      }, cooldown);
      settle(out);
    });
  };
  const proveWithPasskey = () => {
    if (!open() || pk === null) return;
    void exclusive(deps, render, async () => {
      const key = pk;
      if (!open() || key === null) return;
      field.value = '';
      let prfOutput: Uint8Array | null;
      try {
        prfOutput = await evaluatePrf(deps.credentials, unb64(key.credentialId), unb64(key.prfSalt));
      } catch {
        prfOutput = null;
      }
      if (prfOutput === null) return settle('unavailable');
      const proof = {prfOutput};
      helper(REAUTH.checking, false);
      // runReauth zeroes the PRF output on every path (reauthFlow.ts).
      settle(await backoff.run(() => runReauth(flow(), challengeId, proof), cooldown));
    });
  };
  /** [Cancel send], and the X while there is something to cancel. */
  const doCancel = () => {
    if (!canCancel) return;
    void exclusive(deps, render, async () => {
      if (!canCancel) return;
      if (described?.kind === 'settings' || closeOnly) return deps.closeTab();
      // E7: nothing of this send may outlive the cancel — its prepared send and its challenge go. The account is
      // the one challenge.ts validated (the description's, or the undescribable record's own).
      const account = described?.kind === 'send' ? described.account : orphan;
      if (account === null || !(await discardPrepared(deps.send, account))) return failed();
      described = null;
      orphan = null;
      endCooldown();
      notice(REAUTH.cancelled);
      deps.closeTab();
    });
  };
  /** The top bar's X: Cancel while there is something to cancel; in any other notice, only a close (L4). */
  const doX = () => {
    if (canCancel) return doCancel();
    if (view !== 'notice') return;
    void exclusive(deps, render, async () => {
      if (view !== 'notice' || canCancel) return;
      deps.closeTab();
    });
  };

  deps.gate.onIdle(render);
  byId('ra-form').addEventListener('submit', e => {
    e.preventDefault();
    proveWithPassword();
  });
  confirm.addEventListener('click', proveWithPassword);
  passkey.addEventListener('click', proveWithPasskey);
  cancel.addEventListener('click', doCancel);
  x.addEventListener('click', doX);
  unlock.addEventListener('click', () => {
    if (view !== 'notice' || !offerUnlock) return;
    void exclusive(deps, render, async () => {
      if (view !== 'notice' || !offerUnlock) return;
      // M7: no return target — the lock cleared the prepared send, so there is nothing to resume.
      offerUnlock = false;
      deps.go('unlock.html?mode=unlock');
    });
  });
  // A hidden tab or a page left behind (the back/forward cache) keeps nothing typed (§3.5's memory rule).
  deps.onLeave(() => {
    field.value = '';
  });

  return {
    async show(id) {
      challengeId = id;
      view = 'loading';
      described = null;
      orphan = null;
      closeOnly = false;
      canCancel = false;
      offerUnlock = false;
      pk = null;
      endCooldown();
      helper('', false);
      showScreen('v-reauth');
      render();
      let raw: unknown;
      try {
        raw = await deps.store.readEnvelope();
      } catch {
        return notice(COMMON.unreadable);
      }
      const stored = storedVault(raw);
      if (stored.kind === 'none') return notice(COMMON.noWallet);
      if (stored.kind === 'damaged') return notice(COMMON.damaged, {help: COMMON.damagedHelp});
      pk = passkeyOf(raw) ?? null;
      const read = await readChallenge(deps.send, id);
      if (read.state === 'undescribable') {
        // Fail closed: what cannot be described is never offered for confirmation — only Cancel, which
        // discards the send by its own re-validated account; without one, only Close (plan review H1).
        orphan = read.account;
        closeOnly = orphan === null;
        setText(cancel, closeOnly ? REAUTH.close : REAUTH.cancelSend);
        return notice(REAUTH.undescribable, {cancel: true, help: closeOnly ? REAUTH.nothingSent : ''});
      }
      if (read.state !== 'described') return read.state === 'expired' ? notice(REAUTH.expired) : notice(REAUTH.notUnlocked, {unlock: true});
      described = read.description;
      describe(read.description);
      view = 'entry';
      canCancel = true;
      render();
      field.focus();
    },
    holds: () => typed !== null || field.value !== '',
  };
}
