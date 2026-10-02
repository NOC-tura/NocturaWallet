import {addPasskey} from '../onboarding';
import {exclusive, type PageDeps} from '../page';
import {COMMON, PASSKEY} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';

/** The create run's hold on the password #5 just set: read it, or let it go. */
export interface HeldPassword {
  get(): string | null;
  drop(): void;
}

export interface PasskeyScreen {
  show(password: HeldPassword): void;
  /** Whether the screen still references a password (plan-2 review H2): false once #6 has ended. */
  holds(): boolean;
}

const NONE: HeldPassword = {get: () => null, drop: () => undefined};

/**
 * #6 biometric-setup → passkey (spec §3.6, D9): an optional step after the password, on the create path
 * only. [Add a passkey] runs addPasskey with the password #5 just set — held by the create run until this
 * step ends, and dropped when the tab is hidden or left; then this screen asks for it once more ("Enter
 * your password to add the passkey."). Any end — added, unsupported, failed, or Skip — hands over to the
 * UI tab's #7 (`done`), and every end drops the password. No back arrow: the wallet is already stored
 * (plan Scope 12).
 *
 * Rule 6 (spec §7.6): Add, Skip and Continue run through the page's one `exclusive()` gate; `phase` is the
 * `offered`-style guard (welcome.ts) — Add and Skip act while the step is offered, Continue once it ended.
 */
export function mountPasskey(deps: PageDeps, next: {done(): void}): PasskeyScreen {
  const add = byId<HTMLButtonElement>('pk-add');
  const skip = byId<HTMLButtonElement>('pk-skip');
  const proceed = byId<HTMLButtonElement>('pk-continue');
  const ask = byId('pk-ask');
  const input = byId<HTMLInputElement>('pk-password');
  const lineEl = byId('pk-line');
  let held: HeldPassword = NONE;
  let phase: 'off' | 'offer' | 'ended' = 'off';

  const render = () => {
    const busy = deps.gate.isBusy();
    add.disabled = busy || phase !== 'offer';
    skip.disabled = busy || phase !== 'offer';
    proceed.disabled = busy || phase !== 'ended';
    shown(add, phase !== 'ended');
    shown(skip, phase !== 'ended');
    shown(proceed, phase === 'ended');
  };
  const line = (text: string) => {
    setText(lineEl, text);
    shown(lineEl, text !== '');
  };
  const letGo = () => {
    held.drop();
    held = NONE;
    input.value = '';
  };
  const end = (text: string) => {
    letGo();
    phase = 'ended';
    shown(ask, false);
    line(text);
  };

  const run = () => {
    if (phase !== 'offer') return;
    void exclusive(deps, render, async () => {
      if (phase !== 'offer') return;
      const password = held.get() ?? (ask.hidden ? null : input.value);
      if (password === null || password === '') {
        shown(ask, true);
        input.focus();
        return;
      }
      input.value = '';
      line(PASSKEY.adding);
      const out = await addPasskey({...deps.store, credentials: deps.credentials, randomBytes: deps.randomBytes}, {password, kdf: deps.kdf});
      if (out === 'wrong') {
        // Only a re-typed password can be wrong: the one #5 set just opened this wallet.
        letGo();
        shown(ask, true);
        line(COMMON.wrongConfirm);
        return;
      }
      end(out === 'added' ? PASSKEY.added : out === 'unsupported' ? PASSKEY.unsupported : PASSKEY.failed);
    });
  };

  deps.gate.onIdle(render);
  add.addEventListener('click', run);
  ask.addEventListener('submit', e => {
    e.preventDefault();
    run();
  });
  skip.addEventListener('click', () => {
    if (phase !== 'offer') return;
    void exclusive(deps, render, async () => {
      if (phase !== 'offer') return;
      letGo();
      phase = 'off';
      next.done();
    });
  });
  proceed.addEventListener('click', () => {
    if (phase !== 'ended') return;
    void exclusive(deps, render, async () => {
      if (phase !== 'ended') return;
      phase = 'off';
      next.done();
    });
  });
  // A re-typed password goes with a hidden tab too (the run drops the held one: createRun.ts).
  deps.onLeave(() => {
    input.value = '';
  });

  return {
    show(password) {
      held = password;
      phase = 'offer';
      input.value = '';
      shown(ask, false);
      line('');
      render();
      showScreen('v-passkey');
    },
    holds: () => held.get() !== null || input.value !== '',
  };
}
