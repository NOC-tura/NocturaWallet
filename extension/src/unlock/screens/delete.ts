import {evaluatePrf} from '../../vault/passkey';
import {unb64} from '../../vault/bytes';
import type {EnvelopeV1} from '../../vault/envelope';
import type {ReauthFactor} from '../../vault/reauth';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {deleteWallet, proveFactor, type FactorProof} from '../forgetFlow';
import {createWrongBackoff} from '../orchestrate';
import {exclusive, type PageDeps} from '../page';
import {storedVault} from '../stored';
import {COMMON, DELETE, RESTORE, cooldownLabel} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {startCooldown} from '../view/cooldown';
import {addressGroups} from '../view/words';

export interface DeleteScreen {
  show(): Promise<void>;
  /** For the tests: a typed password the screen still references. */
  holds(): boolean;
}

type View = 'loading' | 'entry' | 'notice';
type Action = 'unlock' | 'again' | 'setup' | 'close';

/** C17 (rev 3, review M1): "first account" is the account with the LOWEST index — never the display order, never list position. */
export function firstAccount(env: EnvelopeV1): string {
  let low = env.accounts[0];
  for (const a of env.accounts) if (low === undefined || a.index < low.index) low = a;
  return low?.publicKey ?? '';
}

/**
 * #37's proof (spec B1b-2b §3.2, E11, D9, D10, C17) in the vault tab, after #37's typed DELETE and 1 s hold in the popup.
 * The page names the wallet it deletes: it reads the envelope's public fields at load and shows the first account's
 * address (C17); at the click, BEFORE any KDF run or passkey prompt, it reads the envelope again and compares the
 * revision with the one it showed — a different one (another wallet, or any change) is `changed`: nothing proven,
 * nothing sent, never charged to the backoff, the new address shown. Only on a match does the factor proof run
 * (proveFactor: password or passkey, no session — it works locked), then deleteWallet: the one E5 delete message, with
 * neither `replacement` nor `guard` (D11: a funded wallet is deleted too). Deleted → the welcome page, no toast (the
 * absence of the wallet IS the confirmation, ix:15138). A damaged vault cannot be deleted here (D10).
 *
 * The password leaves the field at the click; a hidden tab or `pagehide` empties the field (2a §3.5). Rule 6: the
 * page's one `exclusive()` gate on every button, guarded by `view`.
 */
export function mountDelete(deps: PageDeps): DeleteScreen {
  const field = byId<HTMLInputElement>('dl-password');
  const del = byId<HTMLButtonElement>('dl-delete');
  const passkey = byId<HTMLButtonElement>('dl-passkey');
  const cancel = byId<HTMLButtonElement>('dl-cancel');
  const buttons = {unlock: byId<HTMLButtonElement>('dl-unlock'), again: byId<HTMLButtonElement>('dl-again'), setup: byId<HTMLButtonElement>('dl-setup'), close: byId<HTMLButtonElement>('dl-close')};
  const helperEl = byId('dl-helper');
  const live = byId('dl-cooldown-live');
  const backoff = createWrongBackoff(deps.sleep);
  let view: View = 'loading';
  /** The notice's buttons (none: the page's [Cancel] closes the tab). */
  let actions: readonly Action[] = [];
  /** The revision of the envelope whose address is on screen (C17). */
  let shownRevision: string | null = null;
  let pk: NonNullable<EnvelopeV1['passkey']> | null = null;
  let stopCooldown: (() => void) | null = null;
  let typed: string | null = null;

  const render = () => {
    const busy = deps.gate.isBusy();
    const entry = view === 'entry';
    const cooling = stopCooldown !== null;
    shown(byId('dl-entry'), entry && !cooling);
    shown(helperEl, entry && !cooling);
    shown(byId('dl-cooldown'), cooling);
    shown(byId('dl-notice'), view === 'notice');
    shown(del, entry && !cooling);
    shown(byId('dl-paused'), cooling);
    shown(passkey, entry && !cooling && pk !== null);
    field.disabled = busy || !entry;
    del.disabled = busy || !entry;
    passkey.disabled = busy || !entry || pk === null;
    cancel.disabled = busy && !cooling;
    for (const [name, b] of Object.entries(buttons)) {
      shown(b, view === 'notice' && actions.includes(name as Action));
      b.disabled = busy;
    }
    shown(cancel, view !== 'notice' || actions.length === 0);
  };
  const helper = (text: string, tone: 'plain' | 'error' | 'warn') => {
    setText(helperEl, text);
    helperEl.classList.toggle('error', tone === 'error');
    helperEl.classList.toggle('warn', tone === 'warn');
    field.classList.toggle('is-error', tone === 'error');
  };
  const notice = (line: string, help: string, next: readonly Action[]) => {
    view = 'notice';
    actions = next;
    field.value = '';
    setText(byId('dl-notice-line'), line);
    setText(byId('dl-notice-help'), help);
    shown(byId('dl-notice-help'), help !== '');
    render();
  };
  /** The stored envelope's first account and revision on screen (C17). */
  const showWallet = (env: EnvelopeV1) => {
    shownRevision = envelopeRevision(env);
    pk = env.passkey ?? null;
    byId('dl-address').replaceChildren(addressGroups(firstAccount(env)));
  };
  /** Reads what is stored now: the envelope, or the notice it reads as (null). */
  const readWallet = async (): Promise<EnvelopeV1 | null> => {
    let raw: unknown;
    try {
      raw = await deps.store.readEnvelope();
    } catch {
      notice(COMMON.unreadable, '', []);
      return null;
    }
    const stored = storedVault(raw);
    if (stored.kind === 'none') {
      notice(COMMON.noWallet, '', ['setup']);
      return null;
    }
    if (stored.kind === 'damaged') {
      notice(COMMON.damaged, COMMON.damagedHelp, []);
      return null;
    }
    return stored.env;
  };
  /** C17: the wallet under the tab is still the one on screen — checked before any KDF run or passkey prompt. */
  const stillShown = async (): Promise<boolean> => {
    const env = await readWallet();
    if (env === null) return false;
    if (envelopeRevision(env) === shownRevision) return true;
    showWallet(env);
    field.value = '';
    helper(DELETE.changed, 'warn');
    render();
    return false;
  };
  const endCooldown = () => {
    stopCooldown?.();
    stopCooldown = null;
    setText(live, '');
  };
  const cooldown = (ms: number) => {
    field.value = '';
    stopCooldown = startCooldown(deps.timers, ms, {timer: byId('dl-timer'), label: byId('dl-cooldown-label'), ring: byId('dl-ring')});
    setText(live, cooldownLabel(Math.ceil(ms / 1000)));
    render();
  };
  /** The proof and the delete, under the backoff (only a wrong factor is charged). */
  const prove = async (factor: ReauthFactor) => {
    helper(DELETE.deleting, 'plain');
    let proof: FactorProof | null = null;
    const out = await backoff.run(async () => {
      const r = await proveFactor(deps.store.readEnvelope, factor);
      if (r.outcome !== 'proven') return r.outcome;
      proof = r.proof;
      return 'proven' as const;
    }, cooldown);
    endCooldown();
    const p = proof as FactorProof | null;
    if (out === 'wrong') return helper(COMMON.wrongConfirm, 'error');
    if (out === 'no-wallet') return notice(COMMON.noWallet, '', ['setup']);
    if (out === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, []);
    if (out !== 'proven' || p === null) return helper(DELETE.failed, 'plain');
    const r = await deleteWallet(deps.send, p);
    if (r === 'deleted') return deps.go('unlock.html?mode=welcome');
    // E5 locked the wallet before it refused (review M1): the way back in, and the way out.
    if (r === 'send-open') return notice(RESTORE.sendOpen, DELETE.lockedNothingDeleted, ['unlock', 'close']);
    if (r === 'busy') return notice(RESTORE.busy, '', ['again']);
    if (r === 'unlocked') return notice(RESTORE.unlocked, '', ['again']);
    if (r === 'no-wallet') return notice(COMMON.noWallet, '', ['setup']);
    if (r === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, []);
    helper(DELETE.failed, 'plain');
  };
  const withPassword = () => {
    if (view !== 'entry' || field.value === '') return;
    void exclusive(deps, render, async () => {
      if (view !== 'entry' || field.value === '') return;
      typed = field.value;
      field.value = '';
      const password = typed;
      typed = null;
      if (!(await stillShown())) return;
      await prove({password, kdf: deps.kdf});
    });
  };
  const withPasskey = () => {
    if (view !== 'entry' || pk === null) return;
    void exclusive(deps, render, async () => {
      if (view !== 'entry') return;
      field.value = '';
      if (!(await stillShown())) return;
      const key = pk;
      if (key === null) return;
      let prfOutput: Uint8Array | null;
      try {
        prfOutput = await evaluatePrf(deps.credentials, unb64(key.credentialId), unb64(key.prfSalt));
      } catch {
        prfOutput = null;
      }
      if (prfOutput === null) return helper(COMMON.passkeyUnavailableConfirm, 'plain');
      // proveFactor zeroes the PRF output on every path.
      await prove({prfOutput});
    });
  };
  const load = async () => {
    view = 'loading';
    actions = [];
    endCooldown();
    helper('', 'plain');
    render();
    const env = await readWallet();
    if (env === null) return;
    showWallet(env);
    view = 'entry';
    render();
    field.focus();
  };

  deps.gate.onIdle(render);
  byId('dl-form').addEventListener('submit', e => {
    e.preventDefault();
    withPassword();
  });
  del.addEventListener('click', withPassword);
  passkey.addEventListener('click', withPasskey);
  cancel.addEventListener('click', () => void exclusive(deps, render, async () => deps.closeTab()));
  buttons.unlock.addEventListener('click', () => {
    if (actions.includes('unlock')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=unlock'));
  });
  buttons.setup.addEventListener('click', () => {
    if (actions.includes('setup')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=welcome'));
  });
  buttons.close.addEventListener('click', () => {
    if (actions.includes('close')) void exclusive(deps, render, async () => deps.closeTab());
  });
  buttons.again.addEventListener('click', () => {
    if (actions.includes('again')) void exclusive(deps, render, load);
  });
  deps.onLeave(() => {
    field.value = '';
  });

  return {
    async show() {
      showScreen('v-delete');
      await load();
    },
    holds: () => typed !== null || field.value !== '',
  };
}
