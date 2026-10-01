import {evaluatePrf} from '../../vault/passkey';
import {unb64} from '../../vault/bytes';
import type {EnvelopeV1} from '../../vault/envelope';
import type {ReturnTo} from '../mode';
import {attemptPasskeyUnlock, attemptUnlock, createWrongBackoff, type Outcome} from '../orchestrate';
import {CLOSE_CHECK_MS, exclusive, type PageDeps} from '../page';
import {passkeyOf, storedVault} from '../stored';
import {COMMON, UNLOCK, cooldownLabel} from '../strings';
import {unlockFlow} from '../unlockFlow';
import {byId, closeOrHide, setText, showScreen, shown} from '../view/dom';
import {startCooldown} from '../view/cooldown';

export interface UnlockScreen {
  show(returnTo: ReturnTo | null): Promise<void>;
  /** Whether the screen still references a typed password (the field, or one not yet handed to the attempt). */
  holds(): boolean;
}

/**
 * Where #9 is: `reading` what is stored (nothing to type yet — a damaged vault is said before any password
 * is typed), `entry` (idle, error, unlocking, cooldown), or one of its notices. Every button acts only in
 * its own phase (rule 6's phase guard), whatever `hidden` or `disabled` say.
 */
type Phase = 'off' | 'reading' | 'entry' | 'unlocked' | 'no-wallet' | 'damaged' | 'unreadable';

/**
 * #9 unlock (spec §3.9), in a tab (D12): the password (or the passkey, when the envelope has one) →
 * vault.setKeys. A wrong password gets the engine's backoff only (D11: ≤ 30 s in this page's memory,
 * no counter, no wipe), shown as the design's cooldown card. "Forgot password?" → #39. With
 * `&return=created|imported` a successful unlock goes straight on to that UI-tab route (#7, #40).
 * The page reads what is stored first: no wallet → "No wallet on this browser yet." + [Set up a wallet];
 * a damaged vault → the damaged line, never the password field (and never charged to the backoff).
 *
 * The password: taken out of the field at the click and handed to the attempt in the same turn, so the
 * screen holds no copy while Argon2id runs or the cooldown counts down; a hidden tab or `pagehide` empties
 * the field. JS strings cannot be zeroed — dropping every reference is all a page can do. A passkey's PRF
 * output is zeroed by attemptUnlock on every path (orchestrate.ts).
 *
 * Rule 6 (spec §7.6): every button runs through the page's one `exclusive()` gate. The backoff's wait runs
 * inside it, so the gate stays held through the cooldown: [Unlock paused] and "Forgot password?" wait for it.
 */
export function mountUnlock(deps: PageDeps): UnlockScreen {
  const field = byId<HTMLInputElement>('unl-password');
  const submit = byId<HTMLButtonElement>('unl-submit');
  const passkey = byId<HTMLButtonElement>('unl-passkey');
  const forgot = byId<HTMLButtonElement>('unl-forgot');
  const setup = byId<HTMLButtonElement>('unl-setup');
  const close = byId<HTMLButtonElement>('unl-close');
  const live = byId('unl-cooldown-live');
  const backoff = createWrongBackoff(deps.sleep);
  let returnTo: ReturnTo | null = null;
  let pk: NonNullable<EnvelopeV1['passkey']> | null = null;
  let phase: Phase = 'off';
  let stopCooldown: (() => void) | null = null;
  /** The browser refused window.close(): [Close this tab] stays hidden. */
  let closeRefused = false;
  /** The typed password between the click and the attempt taking it (the same turn). */
  let typed: string | null = null;

  const render = () => {
    const busy = deps.gate.isBusy();
    const entry = phase === 'entry';
    const cooling = entry && stopCooldown !== null;
    const closing = phase === 'unlocked' && !closeRefused;
    shown(byId('unl-entry'), entry && !cooling);
    shown(byId('unl-cooldown'), cooling);
    shown(submit, entry && !cooling);
    shown(byId('unl-paused'), cooling);
    shown(passkey, entry && !cooling && pk !== null);
    shown(forgot, entry);
    shown(byId('unl-notice'), phase === 'unlocked' || phase === 'no-wallet' || phase === 'damaged' || phase === 'unreadable');
    shown(setup, phase === 'no-wallet');
    shown(close, closing);
    shown(byId('unl-actions'), entry || phase === 'no-wallet' || closing);
    field.disabled = busy || !entry;
    submit.disabled = busy || !entry;
    passkey.disabled = busy || !entry || pk === null;
    forgot.disabled = busy || !entry;
    setup.disabled = busy || phase !== 'no-wallet';
    close.disabled = busy || !closing;
  };
  const helper = (text: string, error: boolean) => {
    setText(byId('unl-helper'), text);
    byId('unl-helper').classList.toggle('error', error);
    byId('unl-tile').classList.toggle('is-error', error);
    field.classList.toggle('is-error', error);
  };
  /** A notice replaces the field: unlocked, no wallet, damaged, unreadable. An empty help line is hidden. */
  const notice = (next: Exclude<Phase, 'off' | 'reading' | 'entry'>, line: string, help: string) => {
    phase = next;
    field.value = '';
    helper('', false);
    setText(byId('unl-notice-line'), line);
    const helpEl = byId('unl-notice-help');
    setText(helpEl, help);
    shown(helpEl, help !== '');
    render();
  };
  const endCooldown = () => {
    stopCooldown?.();
    stopCooldown = null;
    setText(live, '');
  };
  const cooldown = (ms: number) => {
    field.value = ''; // nothing typed sits in the field through the wait
    stopCooldown = startCooldown(deps.timers, ms, {timer: byId('unl-timer'), label: byId('unl-cooldown-label'), ring: byId('unl-ring')});
    // Said once, politely: the card's figures change every second and are not a live region (the design's
    // note F: announce on the minute, never every second; the wait here is at most 30 s).
    setText(live, cooldownLabel(Math.ceil(ms / 1000)));
    render();
  };
  const settle = (out: Outcome | 'unavailable') => {
    endCooldown();
    if (out === 'unlocked') {
      if (returnTo !== null) {
        phase = 'off';
        helper('', false);
        render();
        deps.go(returnTo === 'created' ? 'wallet.html#/created' : 'wallet.html#/imported');
        return;
      }
      notice('unlocked', UNLOCK.unlocked, UNLOCK.openIcon);
      return;
    }
    if (out === 'damaged') return notice('damaged', COMMON.damaged, COMMON.damagedHelp);
    if (out === 'no-wallet') return notice('no-wallet', COMMON.noWallet, '');
    helper(out === 'wrong' ? UNLOCK.wrong : out === 'unavailable' ? UNLOCK.unavailable : UNLOCK.failed, out === 'wrong');
    render();
  };
  const open = () => phase === 'entry' && stopCooldown === null;

  const unlock = () => {
    if (!open() || field.value === '') return;
    void exclusive(deps, render, async () => {
      if (!open() || field.value === '') return;
      typed = field.value;
      field.value = '';
      helper(UNLOCK.unlocking, false);
      const out = await backoff.run(() => {
        const password = typed ?? '';
        typed = null;
        return attemptUnlock({readEnvelope: deps.store.readEnvelope, send: deps.send, unlockFlow}, {password, kdf: deps.kdf});
      }, cooldown);
      settle(out);
    });
  };
  const unlockWithPasskey = () => {
    if (!open() || pk === null) return;
    void exclusive(deps, render, async () => {
      const key = pk;
      if (!open() || key === null) return;
      field.value = '';
      helper(UNLOCK.unlocking, false);
      const out = await backoff.run(
        () =>
          attemptPasskeyUnlock({
            evaluatePrf: () => evaluatePrf(deps.credentials, unb64(key.credentialId), unb64(key.prfSalt)),
            readEnvelope: deps.store.readEnvelope,
            send: deps.send,
            unlockFlow,
          }),
        cooldown,
      );
      settle(out);
    });
  };

  deps.gate.onIdle(render);
  byId('unl-form').addEventListener('submit', e => {
    e.preventDefault();
    unlock();
  });
  submit.addEventListener('click', unlock);
  passkey.addEventListener('click', unlockWithPasskey);
  forgot.addEventListener('click', () => {
    if (phase !== 'entry') return;
    void exclusive(deps, render, async () => {
      if (phase !== 'entry') return;
      field.value = '';
      phase = 'off';
      deps.go('unlock.html?mode=forgot');
    });
  });
  setup.addEventListener('click', () => {
    if (phase !== 'no-wallet') return;
    void exclusive(deps, render, async () => {
      if (phase !== 'no-wallet') return;
      phase = 'off';
      deps.go('unlock.html?mode=welcome');
    });
  });
  close.addEventListener('click', () => {
    if (phase !== 'unlocked' || closeRefused) return;
    void exclusive(deps, render, async () => {
      if (phase !== 'unlocked' || closeRefused) return;
      closeOrHide(
        deps.closeTab,
        f =>
          void deps.timers.setTimeout(() => {
            closeRefused = true;
            f();
            render();
          }, CLOSE_CHECK_MS),
        close,
      );
    });
  });
  // A hidden tab or a page left behind (the back/forward cache) keeps nothing typed (§3.5's memory rule).
  deps.onLeave(() => {
    field.value = '';
  });

  return {
    async show(r) {
      returnTo = r;
      phase = 'reading';
      pk = null;
      endCooldown();
      helper('', false);
      showScreen('v-unlock');
      render();
      let raw: unknown;
      try {
        raw = await deps.store.readEnvelope();
      } catch {
        return notice('unreadable', COMMON.unreadable, '');
      }
      const stored = storedVault(raw);
      if (stored.kind === 'none') return notice('no-wallet', COMMON.noWallet, '');
      if (stored.kind === 'damaged') return notice('damaged', COMMON.damaged, COMMON.damagedHelp);
      pk = passkeyOf(raw) ?? null;
      phase = 'entry';
      render();
      field.focus();
    },
    holds: () => typed !== null || field.value !== '',
  };
}
