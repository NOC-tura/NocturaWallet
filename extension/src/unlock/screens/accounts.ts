import {evaluatePrf} from '../../vault/passkey';
import {unb64} from '../../vault/bytes';
import type {EnvelopeV1} from '../../vault/envelope';
import type {ReauthFactor} from '../../vault/reauth';
import {addAccount, isAccountIndex, lowestFreeIndex, removeAccount, type AccountsOutcome} from '../accountsFlow';
import {createWrongBackoff} from '../orchestrate';
import {exclusive, type PageDeps} from '../page';
import {storedVault} from '../stored';
import type {Send, VaultStore} from '../types';
import {ACCOUNTS, COMMON, DELETE, cooldownLabel} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {startCooldown} from '../view/cooldown';
import {addressGroups} from '../view/words';

export type AccountsOp = {op: 'add'} | {op: 'remove'; index: number | null};

export interface AccountsScreen {
  show(op: AccountsOp): Promise<void>;
  /** For the tests: a typed password the screen still references. */
  holds(): boolean;
}

type View = 'loading' | 'entry' | 'working' | 'end';
type Action = 'unlock' | 'setup';

/**
 * The accounts mode (spec B1b-2b §3.6; D16, C6, C14, E13, E16). Opened by the accounts manager.
 * - `op=add`: the account number (1-based) is pre-filled with the LOWEST free one (C6: "add it again" is the default
 *   after a remove) and may be changed — adding a number this wallet had before brings back the same address. The
 *   extension-only notice (B1 §2) stands under it.
 * - `op=remove&index=N`: "Remove Account N+1?" with the address of envelope index N in groups of four, read from the
 *   stored envelope before any proof — never the account's name (C14: the vault page shows no user text but the phrase).
 *   An index the envelope does not hold (or that did not parse) is "There is no account with that number." with no
 *   action. The background refuses a remove while a send from it is open (C5).
 * Both prove with the password or — when one is stored — the passkey (E16; a mismatch locks). The screen reads the stored
 * envelope itself at load (public fields only: the indexes, the address, whether a passkey is stored); a read that
 * throws is the `unreadable` line, never a page stuck mid-action. The flows read it again for the proof.
 *
 * The common notices (§3): `not-unlocked` + [Unlock], `no-wallet` + [Set up a wallet], `damaged` + damagedHelp. A wrong
 * factor gets the page's backoff, shown as the cooldown card with "Confirm paused"; Cancel (remove) and the top bar's X
 * close the tab during it (the gate is held through the backoff's wait). Rule 6: the page's one `exclusive()` gate on
 * every button.
 *
 * Leaving (the Task 8–11 reviews' rulings, as #6 manage): the password leaves the field at the click; a hidden tab or
 * `pagehide` empties the field. A hidden tab does NOT cancel an action already clicked; a `pagehide` does — `generation`
 * is bumped, and every call the flows make to the outside world (the envelope read and store, the background) goes
 * through `guarded(mine)`, which refuses once the generation moved — except `vault.lock`, which a mismatch (or a failed
 * key hand-over) found by a proof already running must still send. A dropped action reads the vault again rather than
 * show a stale entry; so does a return from the back/forward cache. The PRF output of [Confirm with passkey] is the
 * screen's only until it is handed to the flow (which zeroes it on every path, after its busy retry); the screen zeroes
 * it itself if the page was left during the prompt.
 */
export function mountAccounts(deps: PageDeps): AccountsScreen {
  const field = byId<HTMLInputElement>('acc-password');
  const number = byId<HTMLInputElement>('acc-index');
  const act = byId<HTMLButtonElement>('acc-act');
  const passkeyBtn = byId<HTMLButtonElement>('acc-passkey');
  const cancel = byId<HTMLButtonElement>('acc-cancel');
  const x = byId<HTMLButtonElement>('acc-x');
  const buttons = {unlock: byId<HTMLButtonElement>('acc-unlock'), setup: byId<HTMLButtonElement>('acc-setup')};
  const helperEl = byId('acc-helper');
  const live = byId('acc-cooldown-live');
  // Every element the screen touches, looked up once at mount: a render always draws THIS page's elements.
  const part = {
    addFields: byId('acc-add-fields'),
    only: byId('acc-only'),
    removeInfo: byId('acc-remove-info'),
    passwordLabel: byId('acc-password-label'),
    form: byId('acc-form'),
    cooldown: byId('acc-cooldown'),
    paused: byId('acc-paused'),
    help: byId('acc-help'),
    title: byId('acc-title'),
    address: byId('acc-address'),
    timer: byId('acc-timer'),
    cooldownLabel: byId('acc-cooldown-label'),
    ring: byId('acc-ring'),
  };
  const backoff = createWrongBackoff(deps.sleep);
  let op: AccountsOp = {op: 'add'};
  let view: View = 'loading';
  let actions: readonly Action[] = [];
  let pk: NonNullable<EnvelopeV1['passkey']> | null = null;
  let typed: string | null = null;
  let stopCooldown: (() => void) | null = null;
  /** remove: the address the page showed for the URL's index — the only account a proof from this page may remove. */
  let shownKey: string | null = null;
  /** Bumped on `pagehide`: an action in flight that sees a new value stops before its next call out. */
  let generation = 0;

  /** The page was left (pagehide) since `mine`: every call to the outside world but `vault.lock` is refused from here on. */
  const left = (mine: number) => {
    if (mine !== generation) throw new Error('the page was left');
  };
  const guarded = (mine: number): VaultStore & {send: Send} => ({
    readEnvelope: async () => (left(mine), deps.store.readEnvelope()),
    storeEnvelope: async (expectedRevision, env) => (left(mine), deps.store.storeEnvelope(expectedRevision, env)),
    send: async m => ((m as {type?: unknown}).type === 'vault.lock' ? deps.send(m) : (left(mine), deps.send(m))),
  });

  const render = () => {
    const busy = deps.gate.isBusy();
    const entry = view === 'entry';
    const cooling = stopCooldown !== null;
    const remove = op.op === 'remove';
    const form = (entry || view === 'working') && !cooling;
    shown(part.addFields, !remove && form);
    shown(part.only, !remove && (form || cooling));
    shown(part.removeInfo, remove && (form || cooling));
    shown(part.passwordLabel, form);
    shown(part.form, form);
    shown(part.cooldown, cooling);
    shown(helperEl, !cooling);
    shown(part.title, (part.title.textContent ?? '') !== '');
    shown(part.paused, cooling);
    shown(act, form);
    setText(act, remove ? ACCOUNTS.remove : ACCOUNTS.add);
    shown(passkeyBtn, form && pk !== null);
    shown(cancel, remove && view !== 'end');
    for (const [name, b] of Object.entries(buttons)) {
      shown(b, view === 'end' && actions.includes(name as Action));
      b.disabled = busy;
    }
    field.disabled = busy || !entry;
    number.disabled = busy || !entry;
    act.disabled = busy || !entry;
    passkeyBtn.disabled = busy || !entry || pk === null;
    cancel.disabled = busy && !cooling;
    x.disabled = busy && !cooling;
  };
  /**
   * `true`: a refusal (2a's field error) — the helper in --danger and the field it is about bordered (`on`: the password
   * field, or the number field for O36/O37). `'warn'`: O14, the delete page's tone (fix round 1, visual review M3).
   */
  const helper = (text: string, tone: boolean | 'warn' = false, on: HTMLInputElement = field) => {
    setText(helperEl, text);
    helperEl.classList.toggle('error', tone === true);
    helperEl.classList.toggle('warn', tone === 'warn');
    field.classList.toggle('is-error', tone === true && on === field);
    number.classList.toggle('is-error', tone === true && on === number);
  };
  const help = (text: string) => {
    setText(part.help, text);
    shown(part.help, text !== '');
  };
  const end = (text: string, more: string, next: readonly Action[]) => {
    view = 'end';
    actions = next;
    field.value = '';
    helper(text);
    help(more);
    render();
  };
  const endCooldown = () => {
    stopCooldown?.();
    stopCooldown = null;
    setText(live, '');
  };
  const cooldown = (ms: number) => {
    field.value = '';
    stopCooldown = startCooldown(deps.timers, ms, {timer: part.timer, label: part.cooldownLabel, ring: part.ring});
    setText(live, cooldownLabel(Math.ceil(ms / 1000)));
    render();
  };

  /**
   * Reads the stored envelope: what the page shows comes from its public fields only, before any proof. It sends nothing,
   * so it needs no generation check; it runs once at show, or under the gate (a return, a dropped action), never twice at once.
   */
  const load = async () => {
    view = 'loading';
    actions = [];
    pk = null;
    shownKey = null;
    endCooldown();
    helper('');
    help('');
    setText(part.title, op.op === 'add' ? ACCOUNTS.addTitle : '');
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
    const env = stored.env;
    if (op.op === 'add') {
      number.value = String(lowestFreeIndex(env.accounts.map(a => a.index)) + 1);
    } else {
      const index = op.index;
      const account = index === null ? undefined : env.accounts.find(a => a.index === index);
      if (index === null || account === undefined) return end(ACCOUNTS.outcome['no-such-account'], '', []);
      setText(part.title, ACCOUNTS.removeTitle(index + 1));
      part.address.replaceChildren(addressGroups(account.publicKey));
      shownKey = account.publicKey;
    }
    pk = env.passkey ?? null;
    view = 'entry';
    render();
    field.focus();
  };

  /**
   * Fix round 1 (review I1, as delete's C17): does `raw` still hold, at the URL's index, the address this page showed?
   * Add binds nothing (it shows no address).
   */
  const holdsShown = (raw: unknown): boolean => {
    if (op.op !== 'remove') return true;
    const index = op.index;
    const stored = storedVault(raw);
    return stored.kind === 'wallet' && shownKey !== null && stored.env.accounts.find(a => a.index === index)?.publicKey === shownKey;
  };
  /** The wallet under the tab is not the one shown: read it again, show what is there now, and say so (O14). Never charged. */
  const changed = async () => {
    await load();
    if (view === 'entry') helper(DELETE.changed, 'warn');
  };
  /**
   * At the click, before any KDF run or passkey prompt: the stored envelope still holds the shown address. False: the
   * page was reloaded (and says why); nothing is proven, nothing sent.
   */
  const stillShown = async (mine: number): Promise<boolean> => {
    if (op.op !== 'remove') return true;
    let raw: unknown;
    try {
      raw = await deps.store.readEnvelope();
    } catch {
      await load();
      return false;
    }
    if (mine !== generation) {
      await load();
      return false;
    }
    if (holdsShown(raw)) return true;
    await changed();
    return false;
  };

  /** What the flow's outcome leaves on screen. `opened`: the account indexes of the envelope the flow last read. */
  const settle = (out: AccountsOutcome, added: number, opened: readonly number[] | null) => {
    if (out === 'done' && op.op === 'add') {
      // The account list changed: the next free number moves on (from the envelope the flow opened, plus the one added —
      // no second read that could fail after the add landed).
      if (opened !== null) number.value = String(lowestFreeIndex([...opened, added]) + 1);
      view = 'entry';
      return helper(ACCOUNTS.outcome.done);
    }
    if (out === 'wrong') {
      view = 'entry';
      return helper(COMMON.wrongConfirm, true);
    }
    if (out === 'bad-index' || out === 'index-taken') {
      view = 'entry';
      return helper(ACCOUNTS.outcome[out], true, number);
    }
    if (out === 'send-open' || out === 'failed') {
      view = 'entry';
      return helper(ACCOUNTS.outcome[out]);
    }
    if (out === 'not-unlocked' || out === 'done-locked') return end(ACCOUNTS.outcome[out], '', ['unlock']);
    if (out === 'no-wallet') return end(COMMON.noWallet, '', ['setup']);
    if (out === 'damaged') return end(COMMON.damaged, COMMON.damagedHelp, []);
    end(ACCOUNTS.outcome[out], '', []);
  };

  /** The 1-based number as typed → the envelope index; anything that is not a whole number from 1 is out of range. */
  const typedIndex = () => {
    const n = Number(number.value);
    return number.value.trim() === '' || !Number.isSafeInteger(n) ? -1 : n - 1;
  };

  /** `factor`'s PRF output, if any, is the flow's from this call on: it zeroes it on every path. */
  /** "Adding an account…" / "Removing the account…", from the click on (the shown-address check reads first). */
  const working = () => {
    view = 'working';
    helper(op.op === 'remove' ? ACCOUNTS.removing : ACCOUNTS.adding);
    help('');
    render();
  };
  const run = async (factor: ReauthFactor, mine: number, index: number) => {
    const current = op;
    working();
    const flow = guarded(mine);
    let opened: number[] | null = null;
    let moved = false;
    const read = flow.readEnvelope;
    flow.readEnvelope = async () => {
      const raw = await read();
      // Fix round 1 (I1): every read the flow proves against (the first and the busy retry's) must still hold the shown
      // address; the store is compare-and-set on THAT read's revision, so a change after it is the flow's `busy`. A
      // refusal here is before the proof (the flow reads first) and ends as `failed`, which the backoff never charges.
      if (!holdsShown(raw)) {
        moved = true;
        throw new Error('the wallet changed');
      }
      const now = storedVault(raw);
      opened = now.kind === 'wallet' ? now.env.accounts.map(a => a.index) : null;
      return raw;
    };
    const out = await backoff.run(() => (current.op === 'remove' ? removeAccount(flow, factor, index) : addAccount(flow, factor, index)), cooldown);
    endCooldown();
    // Left (pagehide) while the action ran: nothing of its outcome is shown — the vault is read again (it may have landed).
    if (mine !== generation) return load();
    if (moved) return changed();
    settle(out, index, opened);
    render();
  };
  /** The envelope index this click acts on: the URL's (remove) or the number typed (add). Null: nothing to act on. */
  const target = (): number | null => (op.op === 'remove' ? op.index : typedIndex());

  const withPassword = () => {
    if (view !== 'entry' || field.value === '') return;
    void exclusive(deps, render, async () => {
      const index = target();
      if (view !== 'entry' || field.value === '' || index === null) return;
      typed = field.value;
      field.value = '';
      const password = typed;
      typed = null;
      const mine = generation;
      working();
      if (!(await stillShown(mine))) return;
      await run({password, kdf: deps.kdf}, mine, index);
    });
  };
  const withPasskey = () => {
    if (view !== 'entry' || pk === null) return;
    void exclusive(deps, render, async () => {
      const key = pk;
      const index = target();
      if (view !== 'entry' || key === null || index === null) return;
      field.value = '';
      // A number that is not one is refused before the authenticator is asked (addAccount would refuse it after).
      if (op.op === 'add' && !isAccountIndex(index)) return helper(ACCOUNTS.outcome['bad-index'], true, number);
      const mine = generation;
      if (!(await stillShown(mine))) return;
      let prfOutput: Uint8Array | null;
      try {
        prfOutput = await evaluatePrf(deps.credentials, unb64(key.credentialId), unb64(key.prfSalt));
      } catch {
        prfOutput = null;
      }
      // Left during the prompt: the screen still owns the PRF output — zeroed here, nothing proven, nothing sent.
      if (mine !== generation) {
        prfOutput?.fill(0);
        return load();
      }
      if (prfOutput === null) return helper(COMMON.passkeyUnavailableConfirm);
      // Ownership passes to the flow here: it zeroes the PRF output on every path (its busy retry reuses it first).
      await run({prfOutput}, mine, index);
    });
  };
  const close = () => {
    field.value = '';
    deps.closeTab();
  };
  /** [Cancel] and X: during the cooldown the gate is held by the backoff's wait — they close the tab regardless. */
  const closing = () => {
    if (stopCooldown !== null) return close();
    void exclusive(deps, render, async () => close());
  };

  deps.gate.onIdle(render);
  act.addEventListener('click', withPassword);
  // Enter in the number field submits too (it stands outside the password's form): the same gated action.
  number.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    withPassword();
  });
  part.form.addEventListener('submit', e => {
    e.preventDefault();
    withPassword();
  });
  passkeyBtn.addEventListener('click', withPasskey);
  cancel.addEventListener('click', closing);
  x.addEventListener('click', closing);
  buttons.unlock.addEventListener('click', () => {
    if (actions.includes('unlock')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=unlock'));
  });
  buttons.setup.addEventListener('click', () => {
    if (actions.includes('setup')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=welcome'));
  });
  // Back from the back/forward cache, the vault is read again (it may have changed while the page sat there). An action
  // still in flight reloads on its own; an outcome on screen stays.
  deps.onReturn(why => {
    if (why === 'restored' && view === 'entry' && !deps.gate.isBusy()) void exclusive(deps, render, load);
  });
  // A hidden tab or a page left behind (the back/forward cache) keeps nothing typed (2a §3.5's memory rule); a hidden tab
  // is not a cancel (the click decided), `pagehide` is.
  deps.onLeave(why => {
    field.value = '';
    if (why === 'pagehide') generation += 1;
  });
  return {
    async show(which) {
      op = which;
      showScreen('v-accounts');
      await load();
    },
    holds: () => typed !== null || field.value !== '',
  };
}
