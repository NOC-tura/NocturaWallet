import {MIN_PASSWORD_LENGTH} from '../onboarding';
import {createWrongBackoff} from '../orchestrate';
import {exclusive, type PageDeps} from '../page';
import {changePassword, isCurrentPassword, proveCurrent, type HeldProof} from '../passwordFlow';
import {ACCOUNTS, CHANGE, COMMON, PASSWORD, RESTORE, cooldownLabel} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {startCooldown} from '../view/cooldown';
import {renderMeter} from '../view/meter';
import {MISMATCH_CLEAR_MS} from './password';

/** C20: the held proof and #36's fields live at most this long from the step-1 proof, renewed by each keystroke in steps 2–3. */
export const HOLD_TTL_MS = 5 * 60_000;

export interface ChangePasswordScreen {
  show(): void;
  /** For the tests: what the screen still references — the held proof's data key, a typed or chosen password. */
  holds(): {key: boolean; password: boolean};
}

type Phase = 'step1' | 'step2' | 'step3' | 'changing' | 'notice' | 'done';
type Action = 'again' | 'unlock' | 'setup' | 'close' | null;

/**
 * #36 change password (spec B1b-2b §3.1, E10, D8, C20) in the vault tab. Step 1: the CURRENT password (never a passkey,
 * D8) is proven against the session — the proof's data key is held for step 3. Step 2: a new password of at least 12
 * characters, with #5's length meter; one Argon2id run checks it is not the current one (`same`, never charged to the
 * backoff). Step 3: the same password again; a mismatch shakes the field and clears it after 600 ms. Then the background
 * stores exactly a new salt and a new wrap (vault.changePassword).
 *
 * Memory (rev 2 ruling on review-1 M2, bounded by C20): the held key and the fields are NOT dropped when the tab is
 * hidden — changing a password means fetching one from a password manager in another tab — but on `pagehide`, on leave
 * (the X → [Cancel change]), after success, and at the 5-minute TTL from the step-1 proof (each keystroke in steps 2–3
 * renews it). The deadline is re-checked when the tab is shown again and before every step change and every send, so a
 * timer delayed by a throttled background tab never leaves an expired proof usable (`dropped`: step 1, O10).
 *
 * Rule 6: every button runs through the page's one `exclusive()` gate, guarded by `phase`.
 */
export function mountChangePassword(deps: PageDeps): ChangePasswordScreen {
  const field = byId<HTMLInputElement>('cp-field');
  const cta = byId<HTMLButtonElement>('cp-cta');
  const toggle = byId<HTMLButtonElement>('cp-toggle');
  const x = byId<HTMLButtonElement>('cp-x');
  const again = byId<HTMLButtonElement>('cp-again');
  const unlock = byId<HTMLButtonElement>('cp-unlock');
  const setup = byId<HTMLButtonElement>('cp-setup');
  const close = byId<HTMLButtonElement>('cp-close');
  const keep = byId<HTMLButtonElement>('cpc-keep');
  const cancelChange = byId<HTMLButtonElement>('cpc-cancel');
  const helperEl = byId('cp-helper');
  const live = byId('cp-cooldown-live');
  const backoff = createWrongBackoff(deps.sleep);
  let phase: Phase = 'step1';
  let held: HeldProof | null = null;
  /** Bumped whenever the proof is dropped or the page is left: a step-1 proof that settles after is not kept (review M1). */
  let generation = 0;
  /** The new password from step 2, until step 3's send answers or the proof is dropped. */
  let chosen: string | null = null;
  /** Whether the held envelope had a passkey (the `done` line). */
  let hadPasskey = false;
  let deadline = 0;
  let ttl: number | null = null;
  let clearing: number | null = null;
  let stopCooldown: (() => void) | null = null;
  let action: Action = null;
  /** The cancel-confirm modal is up (over steps 2–3). */
  let asking = false;
  let reveal = false;
  /** Step 1's proof or step 2's `same` check is running: the field takes nothing. */
  let checking = false;

  const step = (): 1 | 2 | 3 => (phase === 'step2' ? 2 : phase === 'step3' || phase === 'changing' ? 3 : 1);
  const render = () => {
    const busy = deps.gate.isBusy();
    const s = step();
    const entry = phase === 'step1' || phase === 'step2' || phase === 'step3';
    const cooling = stopCooldown !== null;
    for (const n of [1, 2, 3] as const) {
      byId(`cp-seg-${n}`).classList.toggle('done', n < s || phase === 'done');
      byId(`cp-seg-${n}`).classList.toggle('cur', n === s && phase !== 'done');
    }
    setText(byId('cp-step'), CHANGE.stepOf(s));
    shown(byId('cp-stepper'), phase !== 'notice' && phase !== 'done');
    setText(byId('cp-title'), CHANGE.title[s]);
    setText(byId('cp-lede'), CHANGE.lede[s]);
    shown(byId('cp-entry'), entry && !cooling);
    shown(byId('cp-cooldown'), cooling);
    shown(byId('cp-changing'), phase === 'changing');
    shown(byId('cp-notice'), phase === 'notice');
    // D26 (owner, 2026-10-08): done is 04r's hero, not a notice.
    shown(byId('cp-done'), phase === 'done');
    shown(helperEl, entry && !cooling);
    const newPassword = phase === 'step2' || phase === 'step3';
    field.type = newPassword && reveal ? 'text' : 'password';
    field.autocomplete = newPassword ? 'new-password' : 'current-password';
    shown(toggle, newPassword);
    toggle.setAttribute('aria-label', reveal ? PASSWORD.hide : PASSWORD.show);
    byId('cp-toggle-icon').setAttribute('href', reveal ? '#i-eye-off' : '#i-eye-on');
    shown(byId('cp-meter'), phase === 'step2');
    shown(byId('cp-meter-label'), phase === 'step2');
    renderMeter(byId('cp-meter'), byId('cp-meter-label'), field.value.length);
    // Typing is not a click: the field follows the phase, not the 500 ms floor (as #5, M2).
    field.disabled = !entry || cooling || checking;
    toggle.disabled = !newPassword;
    shown(cta, entry && !cooling);
    shown(byId('cp-paused'), cooling);
    setText(cta, phase === 'step3' ? CHANGE.change : CHANGE.continue);
    cta.disabled = busy || !entry || cooling || clearing !== null || (phase === 'step2' ? field.value.length < MIN_PASSWORD_LENGTH : field.value.length === 0);
    for (const [b, a] of [[again, 'again'], [unlock, 'unlock'], [setup, 'setup'], [close, 'close']] as const) {
      shown(b, (phase === 'notice' || phase === 'done') && action === a);
      b.disabled = busy;
    }
    x.disabled = busy && !cooling;
    keep.disabled = busy;
    cancelChange.disabled = busy;
  };
  const helper = (text: string, error: boolean) => {
    setText(helperEl, text);
    helperEl.classList.toggle('error', error);
    field.classList.toggle('is-error', error);
  };
  const noticeLines = (line: string, help: string) => {
    setText(byId('cp-notice-line'), line);
    setText(byId('cp-notice-help'), help);
    shown(byId('cp-notice-help'), help !== '');
  };

  /** Zero the held key and forget everything typed or chosen. Bumps `generation`: a proof still running is spent. */
  const dropProof = () => {
    generation += 1;
    held?.dataKey.fill(0);
    held = null;
    chosen = null;
    field.value = '';
    reveal = false;
    if (ttl !== null) deps.timers.clearTimeout(ttl);
    ttl = null;
    if (clearing !== null) deps.timers.clearTimeout(clearing);
    clearing = null;
  };
  /** `dropped` (C20, or the page left): step 1 again, with O10. */
  const dropped = () => {
    dropProof();
    asking = false;
    phase = 'step1';
    showScreen('v-change-password');
    helper(CHANGE.dropped, false);
    render();
  };
  const arm = () => {
    deadline = deps.timers.now() + HOLD_TTL_MS;
    if (ttl !== null) deps.timers.clearTimeout(ttl);
    ttl = deps.timers.setTimeout(() => {
      ttl = null;
      // Fix round 1 (C1): while `changing` the proof belongs to changePassword — nothing here touches it.
      if (held !== null && phase !== 'changing') dropped();
    }, HOLD_TTL_MS);
  };
  /** True — and the proof is dropped — when the deadline has passed (whatever the timer did). Never while `changing` (C1). */
  const expired = (): boolean => {
    if (phase === 'changing' || held === null || deps.timers.now() < deadline) return false;
    dropped();
    return true;
  };
  const notice = (line: string, help: string, next: Action) => {
    dropProof();
    phase = 'notice';
    action = next;
    noticeLines(line, help);
    render();
  };
  const endCooldown = () => {
    stopCooldown?.();
    stopCooldown = null;
    setText(live, '');
  };
  const cooldown = (ms: number) => {
    field.value = '';
    stopCooldown = startCooldown(deps.timers, ms, {timer: byId('cp-timer'), label: byId('cp-cooldown-label'), ring: byId('cp-ring')});
    setText(live, cooldownLabel(Math.ceil(ms / 1000)));
    render();
  };

  const proveStep = () =>
    void exclusive(deps, render, async () => {
      if (phase !== 'step1' || field.value === '') return;
      const password = field.value;
      field.value = '';
      helper(CHANGE.checking, false);
      checking = true;
      render();
      const flow = {readEnvelope: deps.store.readEnvelope, send: deps.send};
      let proof: HeldProof | null = null;
      // Review M1: a `pagehide` during this KDF finds nothing held yet; the counter is how the settled proof learns it.
      const mine = generation;
      const out = await backoff.run(async () => {
        const r = await proveCurrent(flow, password, deps.kdf);
        if (r.outcome !== 'proven') return r.outcome;
        proof = r.held;
        return 'proven' as const;
      }, cooldown);
      checking = false;
      endCooldown();
      const p = proof as HeldProof | null;
      if (out === 'proven' && p !== null) {
        // The page was left (pagehide) or the proof otherwise dropped while it ran: nothing is kept.
        if (mine !== generation) {
          p.dataKey.fill(0);
          return dropped();
        }
        if (phase !== 'step1') return p.dataKey.fill(0);
        held = p;
        hadPasskey = p.env.passkey !== undefined;
        arm();
        phase = 'step2';
        helper('', false);
        render();
        field.focus();
        return;
      }
      if (out === 'wrong') return helper(COMMON.wrongConfirm, true);
      if (out === 'not-unlocked') return notice(ACCOUNTS.outcome['not-unlocked'], '', 'unlock');
      if (out === 'mismatch-locked') return notice(COMMON.mismatchLocked, '', null);
      if (out === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, null);
      if (out === 'no-wallet') return notice(COMMON.noWallet, '', 'setup');
      helper(CHANGE.failed, false);
    });

  const chooseStep = () => {
    if (expired()) return;
    void exclusive(deps, render, async () => {
      if (phase !== 'step2' || held === null || field.value.length < MIN_PASSWORD_LENGTH) return;
      const candidate = field.value;
      const proof = held;
      helper(CHANGE.checking, false);
      checking = true;
      render();
      let same: boolean;
      try {
        same = await isCurrentPassword(proof.env, candidate, deps.kdf);
      } catch {
        // isCurrentPassword rethrows all but WrongPassword (a KDF failure). Dropped meanwhile: `dropped` stays shown.
        if (held !== proof || phase !== 'step2' || expired()) return;
        helper(CHANGE.failed, false);
        return;
      } finally {
        checking = false;
      }
      // Dropped (TTL, pagehide) while the check ran: nothing moves on.
      if (held !== proof || phase !== 'step2' || expired()) return;
      field.value = '';
      if (same) return helper(CHANGE.same, true);
      chosen = candidate;
      reveal = false;
      phase = 'step3';
      helper('', false);
      arm();
      render();
      field.focus();
    });
  };

  const changeStep = () => {
    if (expired()) return;
    void exclusive(deps, render, async () => {
      if (phase !== 'step3' || held === null || chosen === null || clearing !== null) return;
      const typed = field.value;
      if (typed !== chosen) {
        helper(CHANGE.mismatch, true);
        clearing = deps.timers.setTimeout(() => {
          clearing = null;
          field.value = '';
          field.classList.toggle('is-error', false);
          render();
        }, MISMATCH_CLEAR_MS);
        return;
      }
      const proof = held;
      const password = chosen;
      // Fix round 1 (C1): ownership passes to changePassword BEFORE the await — it wraps this key after its Argon2id run
      // and zeroes it in its own `finally`. A drop on this page (pagehide, the deadline seen on `visible`) must never
      // zero the key mid-wrap: that stored a wrap of an all-zero key and bricked the wallet.
      held = null;
      field.value = '';
      phase = 'changing';
      if (ttl !== null) deps.timers.clearTimeout(ttl);
      ttl = null;
      render();
      // changePassword zeroes the data key on every path: the proof is spent either way.
      const out = await changePassword({send: deps.send, kdf: deps.kdf}, proof, password);
      chosen = null;
      if (out === 'changed') {
        phase = 'done';
        action = 'close';
        setText(byId('cp-done-title'), CHANGE.updated);
        setText(byId('cp-done-body'), hadPasskey ? `${CHANGE.closeTab} ${CHANGE.passkeyStillWorks}` : CHANGE.closeTab);
        return render();
      }
      if (out === 'busy') return notice(RESTORE.busy, '', 'again');
      if (out === 'locked') return notice(ACCOUNTS.outcome['not-unlocked'], '', 'unlock');
      if (out === 'no-wallet') return notice(COMMON.noWallet, '', 'setup');
      if (out === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, null);
      notice(CHANGE.failed, '', 'again');
    });
  };

  /** The X: at step 1 (nothing held) it closes; over steps 2–3 it asks first (cancel-confirm). */
  const doX = () => {
    if (phase === 'step2' || phase === 'step3') {
      if (expired()) return;
      void exclusive(deps, render, async () => {
        if (phase !== 'step2' && phase !== 'step3') return;
        asking = true;
        showScreen('v-cp-cancel');
      });
      return;
    }
    if (phase === 'changing') return;
    // Fix round 1 (Task 9 review M1): during step 1's cooldown the gate is held by the backoff's wait — the X closes
    // the tab regardless (nothing is held; the wait ends in a wrong outcome, and dropProof spends any proof).
    if (stopCooldown !== null) {
      dropProof();
      deps.closeTab();
      return;
    }
    void exclusive(deps, render, async () => {
      dropProof();
      deps.closeTab();
    });
  };

  deps.gate.onIdle(render);
  byId('cp-form').addEventListener('submit', e => {
    e.preventDefault();
    if (phase === 'step1') proveStep();
    else if (phase === 'step2') chooseStep();
    else if (phase === 'step3') changeStep();
  });
  cta.addEventListener('click', () => {
    if (phase === 'step1') proveStep();
    else if (phase === 'step2') chooseStep();
    else if (phase === 'step3') changeStep();
  });
  field.addEventListener('input', () => {
    // C20: each keystroke in steps 2–3 renews the deadline — unless it has already passed.
    if ((phase === 'step2' || phase === 'step3') && !expired()) arm();
    if (clearing === null) field.classList.toggle('is-error', false);
    render();
  });
  toggle.addEventListener('click', () => {
    if (phase !== 'step2' && phase !== 'step3') return;
    reveal = !reveal;
    render();
  });
  x.addEventListener('click', doX);
  keep.addEventListener('click', () => {
    if (!asking) return;
    void exclusive(deps, render, async () => {
      asking = false;
      showScreen('v-change-password');
      if (!expired()) field.focus();
    });
  });
  byId('cpc-backdrop').addEventListener('click', () => keep.click());
  cancelChange.addEventListener('click', () => {
    if (!asking) return;
    void exclusive(deps, render, async () => {
      asking = false;
      dropProof();
      phase = 'notice';
      action = null;
      noticeLines(CHANGE.closeTab, '');
      showScreen('v-change-password');
      deps.closeTab();
    });
  });
  again.addEventListener('click', () => {
    if (action !== 'again') return;
    void exclusive(deps, render, async () => {
      action = null;
      phase = 'step1';
      helper('', false);
      render();
      field.focus();
    });
  });
  unlock.addEventListener('click', () => {
    if (action !== 'unlock') return;
    void exclusive(deps, render, async () => deps.go('unlock.html?mode=unlock'));
  });
  setup.addEventListener('click', () => {
    if (action !== 'setup') return;
    void exclusive(deps, render, async () => deps.go('unlock.html?mode=welcome'));
  });
  close.addEventListener('click', () => {
    if (action !== 'close') return;
    void exclusive(deps, render, async () => deps.closeTab());
  });
  // The M2 ruling: a hidden tab keeps steps 2–3 and the held key (a password manager is in another tab). Step 1's typed
  // password follows 2a's rule. `pagehide` drops everything (the page may sit in the back/forward cache).
  deps.onLeave(why => {
    // Fix round 1 (C1): the send is in flight and owns the proof; it finishes (or fails) on its own.
    if (phase === 'changing') return;
    if (why === 'pagehide') {
      if (held !== null || chosen !== null) dropped();
      else {
        // Nothing held — but a step-1 proof may be running: it must not be kept when it settles (review M1).
        generation += 1;
        field.value = '';
      }
      return;
    }
    if (phase === 'step1') {
      field.value = '';
      // Fix round 1 (M1): [Continue] follows the emptied field.
      render();
    }
  });
  deps.onReturn(why => {
    // Fix round 1 (C1): never while `changing` — the proof is changePassword's.
    if (phase === 'changing') return;
    // `restored`: back from the back/forward cache, where timers were frozen (review M1).
    if (why === 'visible' || why === 'restored') expired();
  });

  return {
    show() {
      phase = 'step1';
      showScreen('v-change-password');
      helper('', false);
      render();
      field.focus();
    },
    holds: () => ({key: held !== null && held.dataKey.some(b => b !== 0), password: chosen !== null || field.value !== ''}),
  };
}
