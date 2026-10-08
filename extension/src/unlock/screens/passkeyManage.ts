import {evaluatePrf, type CredentialsApi} from '../../vault/passkey';
import {unb64} from '../../vault/bytes';
import type {EnvelopeV1} from '../../vault/envelope';
import type {ReauthFactor} from '../../vault/reauth';
import {addPasskey, type PasskeyOutcome} from '../onboarding';
import {createWrongBackoff} from '../orchestrate';
import {exclusive, type PageDeps} from '../page';
import {removePasskey, type RemovePasskeyOutcome} from '../passkeyFlow';
import {storedVault} from '../stored';
import type {Send, VaultStore} from '../types';
import {ACCOUNTS, COMMON, MANAGE, PASSKEY, RESTORE, cooldownLabel} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {startCooldown} from '../view/cooldown';

export interface PasskeyManageScreen {
  show(op: 'add' | 'remove'): Promise<void>;
  /** For the tests: a typed password the screen still references. */
  holds(): boolean;
}

type View = 'loading' | 'entry' | 'working' | 'end';
type Action = 'again' | 'unlock' | 'setup' | 'close';

/**
 * #6 "manage" (spec B1b-2b §3.3, E12, D12, D13, C3, C4) in the vault tab.
 * - `op=add` with no passkey stored: add — the password unwraps the data key and a new passkey wraps it (addPasskey,
 *   unchanged from #6). With one stored: the same operation REPLACES it (one slot, C4), worded as a replace. Password
 *   only (C4): a passkey holder must not enrol a passkey of their own.
 * - `op=remove`: the password OR the passkey itself proves the wallet against the session (a mismatch locks), then the
 *   background drops the wrap (vault.removePasskey: the page sends no envelope). The authenticator keeps the credential;
 *   the page says so (O24).
 * The password leaves the field at the click; a hidden tab or `pagehide` empties the field. A wrong factor gets the
 * page's backoff only; `damaged` and `no-wallet` are never charged. Rule 6: the page's one `exclusive()` gate.
 *
 * Leaving (the Task 8/9 reviews' rulings, as #37's proof): a hidden tab does NOT cancel an action already clicked — the
 * click is the decision — but a `pagehide` (the page actually left) does: `generation` is bumped, and every call the
 * flows make to the outside world (the envelope read, the background, the authenticator, the store) goes through
 * `guarded(mine)`, which refuses once the generation moved — so nothing is sent, stored or prompted after the page was
 * left, at whatever await the flow stood. The flows own their secrets and zero them on every path (addPasskey's keys
 * and PRF output, removePasskey's PRF output); the PRF output of [Confirm with passkey] is the screen's only until it
 * is handed to removePasskey, and the screen zeroes it itself if the page was left during the prompt. [Cancel] alone
 * closes the tab during the cooldown (the gate is held through the backoff's wait).
 */
export function mountPasskeyManage(deps: PageDeps): PasskeyManageScreen {
  const field = byId<HTMLInputElement>('pm-password');
  const act = byId<HTMLButtonElement>('pm-act');
  const passkeyBtn = byId<HTMLButtonElement>('pm-passkey');
  const cancel = byId<HTMLButtonElement>('pm-cancel');
  const x = byId<HTMLButtonElement>('pm-x');
  const buttons = {again: byId<HTMLButtonElement>('pm-again'), unlock: byId<HTMLButtonElement>('pm-unlock'), setup: byId<HTMLButtonElement>('pm-setup'), close: byId<HTMLButtonElement>('pm-close')};
  const helperEl = byId('pm-helper');
  const live = byId('pm-cooldown-live');
  const backoff = createWrongBackoff(deps.sleep);
  let op: 'add' | 'remove' = 'add';
  let view: View = 'loading';
  let actions: readonly Action[] = [];
  /** The end is a success (added, replaced, removed): D26 draws it as 04r's hero. */
  let success = false;
  /** The passkey stored at load: `add` then words a replace (C4); `remove` offers it as a factor. */
  let pk: NonNullable<EnvelopeV1['passkey']> | null = null;
  let stopCooldown: (() => void) | null = null;
  let typed: string | null = null;
  /** Bumped on `pagehide`: an action in flight that sees a new value stops before its send. */
  let generation = 0;

  /** The page was left (pagehide) since `mine`: every call to the outside world is refused from here on. */
  const left = (mine: number) => {
    if (mine !== generation) throw new Error('the page was left');
  };
  /** The deps the flows run on, each call checked against the generation at the click (read at call time). */
  const guarded = (mine: number): VaultStore & {send: Send; credentials: CredentialsApi; randomBytes(n: number): Uint8Array} => ({
    readEnvelope: async () => (left(mine), deps.store.readEnvelope()),
    storeEnvelope: async (expectedRevision, env) => (left(mine), deps.store.storeEnvelope(expectedRevision, env)),
    // Fix round 1 (m1): vault.lock passes even after the page was left — a mismatch found by a proof already running
    // must still lock (it only moves the session the safe way); every other message is refused.
    send: async m => ((m as {type?: unknown}).type === 'vault.lock' ? deps.send(m) : (left(mine), deps.send(m))),
    credentials: {
      create: async o => (left(mine), deps.credentials.create(o)),
      get: async o => (left(mine), deps.credentials.get(o)),
    },
    randomBytes: n => deps.randomBytes(n),
  });
  /**
   * Left while the action ran: nothing of its outcome is shown. Fix round 1 (m2): the outcome may have landed anyway (a
   * send already on its way), so the page reads the vault again rather than show the entry it had (a back/forward-cache
   * return then shows what is stored now).
   */
  const dropped = () => load();

  const render = () => {
    const busy = deps.gate.isBusy();
    const entry = view === 'entry';
    const cooling = stopCooldown !== null;
    const replacing = op === 'add' && pk !== null;
    setText(byId('pm-title'), op === 'remove' ? MANAGE.removeTitle : replacing ? MANAGE.replaceTitle : MANAGE.addTitle);
    setText(byId('pm-lede'), op === 'remove' ? MANAGE.removeLede : replacing ? MANAGE.replaceLede : MANAGE.addLede);
    setText(act, op === 'remove' ? MANAGE.remove : replacing ? MANAGE.replace : MANAGE.add);
    // D26 (owner, 2026-10-08): a success end is 04r's hero in place of #6's key tile, title and lede.
    const done = view === 'end' && success;
    shown(byId('pm-done'), done);
    shown(byId('pm-icon'), !done);
    shown(byId('pm-head'), !done);
    // D27 (owner, 2026-10-08): the remove primary is the delete page's danger button.
    act.classList.toggle('btn-destructive', op === 'remove');
    act.classList.toggle('btn-primary', op !== 'remove');
    shown(byId('pm-form'), (entry || view === 'working') && !cooling);
    shown(byId('pm-ask'), op === 'add');
    // Fix round 0b: the remove page's field has the vault pages' visible label (the add line names the add).
    shown(byId('pm-password-label'), op === 'remove');
    shown(helperEl, entry && !cooling);
    shown(byId('pm-cooldown'), cooling);
    shown(act, entry && !cooling);
    shown(byId('pm-paused'), cooling);
    shown(passkeyBtn, entry && !cooling && op === 'remove' && pk !== null);
    field.disabled = busy || !entry;
    act.disabled = busy || !entry;
    // Fix round 1 (m4): C4 — never a factor for add or replace, disabled as well as hidden.
    passkeyBtn.disabled = busy || !entry || pk === null || op !== 'remove';
    for (const [name, b] of Object.entries(buttons)) {
      shown(b, view === 'end' && actions.includes(name as Action));
      b.disabled = busy;
    }
    shown(cancel, view !== 'end' || actions.length === 0);
    cancel.disabled = busy && !cooling;
    x.disabled = busy && !cooling;
  };
  const helper = (text: string, error: boolean) => {
    setText(helperEl, text);
    helperEl.classList.toggle('vlt-danger', error);
    field.classList.toggle('is-error', error);
  };
  const line = (text: string, help = '') => {
    setText(byId('pm-line'), text);
    shown(byId('pm-line'), text !== '');
    setText(byId('pm-line-help'), help);
    shown(byId('pm-line-help'), help !== '');
  };
  const end = (text: string, help: string, next: readonly Action[]) => {
    view = 'end';
    success = false;
    actions = next;
    field.value = '';
    helper('', false);
    line(text, help);
    render();
  };
  /** A success end (D26): the hero carries the copy; the line under the form stays empty. */
  const succeed = (title: string, body: string) => {
    setText(byId('pm-done-title'), title);
    setText(byId('pm-done-body'), body);
    end('', '', ['close']);
    success = true;
    render();
  };
  const endCooldown = () => {
    stopCooldown?.();
    stopCooldown = null;
    setText(live, '');
  };
  const cooldown = (ms: number) => {
    field.value = '';
    stopCooldown = startCooldown(deps.timers, ms, {timer: byId('pm-timer'), label: byId('pm-cooldown-label'), ring: byId('pm-ring')});
    setText(live, cooldownLabel(Math.ceil(ms / 1000)));
    render();
  };

  const added = (out: PasskeyOutcome, replacing: boolean) => {
    if (out === 'added') return succeed(replacing ? MANAGE.replaced : PASSKEY.added, MANAGE.closeTab);
    if (out === 'wrong') {
      view = 'entry';
      line('');
      return helper(COMMON.wrongConfirm, true);
    }
    if (out === 'unsupported') return end(PASSKEY.unsupported, '', []);
    if (out === 'no-wallet') return end(COMMON.noWallet, '', ['setup']);
    if (out === 'damaged') return end(COMMON.damaged, COMMON.damagedHelp, []);
    end(PASSKEY.failed, '', []);
  };
  const removed = (out: RemovePasskeyOutcome) => {
    if (out === 'removed') return succeed(MANAGE.removed, MANAGE.removedHelp);
    if (out === 'wrong') {
      view = 'entry';
      line('');
      return helper(COMMON.wrongConfirm, true);
    }
    if (out === 'no-passkey') return end(MANAGE.noPasskey, '', []);
    if (out === 'busy') return end(RESTORE.busy, '', ['again']);
    if (out === 'not-unlocked') return end(ACCOUNTS.outcome['not-unlocked'], '', ['unlock']);
    if (out === 'mismatch-locked') return end(COMMON.mismatchLocked, '', []);
    if (out === 'damaged') return end(COMMON.damaged, COMMON.damagedHelp, []);
    if (out === 'no-wallet') return end(COMMON.noWallet, '', ['setup']);
    end(MANAGE.failed, '', []);
  };

  /** `factor`'s PRF output, if any, is removePasskey's from this call on: it zeroes it on every path. */
  const runRemove = async (factor: ReauthFactor, mine: number) => {
    view = 'working';
    line(MANAGE.removing);
    render();
    const out = await backoff.run(() => removePasskey(guarded(mine), factor), cooldown);
    endCooldown();
    if (mine !== generation) return dropped();
    removed(out);
  };
  const withPassword = () => {
    if (view !== 'entry' || field.value === '') return;
    void exclusive(deps, render, async () => {
      if (view !== 'entry' || field.value === '') return;
      typed = field.value;
      field.value = '';
      const password = typed;
      typed = null;
      helper('', false);
      const mine = generation;
      if (op === 'remove') return runRemove({password, kdf: deps.kdf}, mine);
      view = 'working';
      line(PASSKEY.adding);
      render();
      // Fix round 1 (m3): add or replace is decided by the envelope the flow OPENS, not by the one seen at load — another
      // tab may have added a passkey since. Every read of the flow (the first, and the busy retry's) updates it, and the
      // title says "Replace" before the passkey prompt when it is one.
      const flow = guarded(mine);
      const read = flow.readEnvelope;
      flow.readEnvelope = async () => {
        const raw = await read();
        const now = storedVault(raw);
        if (now.kind === 'wallet' && mine === generation) {
          pk = now.env.passkey ?? null;
          render();
        }
        return raw;
      };
      // addPasskey owns the data keys and the new PRF output and zeroes them on every path.
      const out = await backoff.run(() => addPasskey(flow, {password, kdf: deps.kdf}), cooldown);
      endCooldown();
      if (mine !== generation) return dropped();
      added(out, pk !== null);
    });
  };
  const withPasskey = () => {
    if (view !== 'entry' || op !== 'remove' || pk === null) return;
    void exclusive(deps, render, async () => {
      const key = pk;
      if (view !== 'entry' || key === null) return;
      field.value = '';
      const mine = generation;
      let prfOutput: Uint8Array | null;
      try {
        prfOutput = await evaluatePrf(deps.credentials, unb64(key.credentialId), unb64(key.prfSalt));
      } catch {
        prfOutput = null;
      }
      // Left during the prompt: the screen still owns the PRF output — zeroed here, nothing proven, nothing sent.
      if (mine !== generation) {
        prfOutput?.fill(0);
        return dropped();
      }
      if (prfOutput === null) return helper(COMMON.passkeyUnavailableConfirm, false);
      // Ownership passes to removePasskey here: it zeroes the PRF output on every path (busy's retry reuses it first).
      await runRemove({prfOutput}, mine);
    });
  };
  const load = async () => {
    view = 'loading';
    actions = [];
    endCooldown();
    helper('', false);
    line('');
    render();
    let raw: unknown;
    try {
      raw = await deps.store.readEnvelope();
    } catch {
      return end(COMMON.unreadable, '', []);
    }
    const stored = storedVault(raw);
    if (stored.kind === 'none') return end(COMMON.noWallet, '', ['setup']);
    if (stored.kind === 'damaged') return end(COMMON.damaged, COMMON.damagedHelp, []);
    pk = stored.env.passkey ?? null;
    view = 'entry';
    render();
    field.focus();
  };

  deps.gate.onIdle(render);
  byId('pm-form').addEventListener('submit', e => {
    e.preventDefault();
    withPassword();
  });
  act.addEventListener('click', withPassword);
  passkeyBtn.addEventListener('click', withPasskey);
  /**
   * [Cancel] and the top bar's X (fix round 0b, spec §3's general rule). During the cooldown the gate is held by the
   * backoff's wait — they close the tab regardless (the wait ends in a wrong outcome; nothing is proven or sent). The
   * typed password goes and the generation moves, so a running call's held PRF output is zeroed and nothing is sent or
   * stored after it — even if the browser refuses to close the tab.
   */
  const close = () => {
    field.value = '';
    generation += 1;
    deps.closeTab();
  };
  const closing = () => {
    if (stopCooldown !== null) return close();
    void exclusive(deps, render, async () => close());
  };
  cancel.addEventListener('click', closing);
  x.addEventListener('click', closing);
  buttons.close.addEventListener('click', () => {
    if (actions.includes('close')) void exclusive(deps, render, async () => deps.closeTab());
  });
  buttons.again.addEventListener('click', () => {
    if (actions.includes('again')) void exclusive(deps, render, load);
  });
  buttons.unlock.addEventListener('click', () => {
    if (actions.includes('unlock')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=unlock'));
  });
  buttons.setup.addEventListener('click', () => {
    if (actions.includes('setup')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=welcome'));
  });
  // Fix round 1 (m2): back from the back/forward cache, the vault is read again (it may have changed while the page sat
  // there). An action still in flight reloads on its own (dropped()); an outcome on screen stays.
  deps.onReturn(why => {
    if (why === 'restored' && view === 'entry' && !deps.gate.isBusy()) void exclusive(deps, render, load);
  });
  deps.onLeave(why => {
    field.value = '';
    // Hidden is not a cancel (the click decided); pagehide is — an action in flight stops before its send.
    if (why === 'pagehide') generation += 1;
  });

  return {
    async show(which) {
      op = which;
      showScreen('v-passkey-manage');
      await load();
    },
    holds: () => typed !== null || field.value !== '',
  };
}
