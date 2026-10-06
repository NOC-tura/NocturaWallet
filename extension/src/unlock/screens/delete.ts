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
 * Fix round 1 (review I1): the compare at the click and the proof are two reads — on the passkey path the whole OS
 * prompt lies between them — so the proof's own revision (minted from proveFactor's read) is compared with the shown
 * one again before the send: a mismatch is `changed` too (nothing sent, never charged; the proof is dropped).
 *
 * The password leaves the field at the click; a hidden tab or `pagehide` empties the field (2a §3.5). Fix round 1
 * (review I3, the controller's ruling): a hidden tab does NOT cancel a delete already clicked — the click is the
 * decision, as #36 while changing — but a `pagehide` (the page actually left) before the forget is sent aborts it:
 * `generation` is bumped and every await before the send re-checks it (no forget; the proof and any PRF output
 * dropped). Rule 6: the page's one `exclusive()` gate on every button, guarded by `view`; [Cancel] alone closes the tab
 * during the cooldown (review M1: the gate is held through the backoff's wait).
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
  /** Bumped on `pagehide`: a delete in flight that sees a new value stops before the send (review I3). */
  let generation = 0;

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
  /** C17's `changed`: the wallet now stored goes on screen with O14 — nothing proven is kept, nothing charged. */
  const changed = (env: EnvelopeV1) => {
    showWallet(env);
    field.value = '';
    helper(DELETE.changed, 'warn');
    render();
  };
  /** C17: the wallet under the tab is still the one on screen — checked before any KDF run or passkey prompt. */
  const stillShown = async (mine: number): Promise<boolean> => {
    const env = await readWallet();
    if (mine !== generation || env === null) return false;
    if (envelopeRevision(env) === shownRevision) return true;
    changed(env);
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
  /** The proof and the delete, under the backoff (only a wrong factor is charged). `mine`: the generation at the click. */
  const prove = async (factor: ReauthFactor, mine: number) => {
    helper(DELETE.deleting, 'plain');
    let proof: FactorProof | null = null;
    const out = await backoff.run(async () => {
      const r = await proveFactor(deps.store.readEnvelope, factor);
      if (r.outcome !== 'proven') return r.outcome;
      proof = r.proof;
      return 'proven' as const;
    }, cooldown);
    endCooldown();
    // The page was left (pagehide) while the proof ran: no forget; the proof (no secret in it) is dropped here.
    if (mine !== generation) return helper('', 'plain');
    const p = proof as FactorProof | null;
    if (out === 'wrong') return helper(COMMON.wrongConfirm, 'error');
    if (out === 'no-wallet') return notice(COMMON.noWallet, '', ['setup']);
    if (out === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, []);
    if (out !== 'proven' || p === null) return helper(DELETE.failed, 'plain');
    // Review I1: the proof ran on its own read of the envelope — it must be the wallet on screen, or it is `changed`.
    if (p.revision !== shownRevision) {
      const env = await readWallet();
      if (mine === generation && env !== null) changed(env);
      return;
    }
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
      const mine = generation;
      if (!(await stillShown(mine))) return;
      await prove({password, kdf: deps.kdf}, mine);
    });
  };
  const withPasskey = () => {
    if (view !== 'entry' || pk === null) return;
    void exclusive(deps, render, async () => {
      if (view !== 'entry') return;
      field.value = '';
      const mine = generation;
      if (!(await stillShown(mine))) return;
      const key = pk;
      if (key === null) return;
      let prfOutput: Uint8Array | null;
      try {
        prfOutput = await evaluatePrf(deps.credentials, unb64(key.credentialId), unb64(key.prfSalt));
      } catch {
        prfOutput = null;
      }
      if (prfOutput === null) return helper(COMMON.passkeyUnavailableConfirm, 'plain');
      // Left during the prompt: the PRF output is zeroed, nothing proven, nothing sent.
      if (mine !== generation) return prfOutput.fill(0);
      // proveFactor zeroes the PRF output on every path.
      await prove({prfOutput}, mine);
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
  cancel.addEventListener('click', () => {
    // Review M1: during the cooldown the gate is held by the backoff's wait — [Cancel] closes the tab regardless (the
    // wait ends in a wrong outcome; nothing is proven or sent).
    if (stopCooldown !== null) return deps.closeTab();
    void exclusive(deps, render, async () => deps.closeTab());
  });
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
  deps.onLeave(why => {
    field.value = '';
    // Review I3: hidden is not a cancel (the click decided); pagehide is — a delete in flight stops before its send.
    if (why === 'pagehide') generation += 1;
  });

  return {
    async show() {
      showScreen('v-delete');
      await load();
    },
    holds: () => typed !== null || field.value !== '',
  };
}
