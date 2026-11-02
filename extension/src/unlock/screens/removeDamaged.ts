import {removeDamaged} from '../damagedFlow';
import {exclusive, type PageDeps} from '../page';
import {vaultReading} from '../stored';
import {COMMON, DAMAGED, DELETE, RESTORE, WELCOME} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {mountDeleteConfirm} from '../view/deleteConfirm';
import {fillSaveLink} from '../view/saveDamaged';
import {addressGroups} from '../view/words';
import type {DamagedScreen} from './damaged';

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * B1e §2.2 (Minor 5): the address the removal screen names — among the `accounts` entries that are objects with a safe
 * integer `index` ≥ 0 and a `publicKey` of the address shape, the one with the LOWEST index; null when there is none.
 * Never `accounts[0]`, and nothing else of the value is shown.
 */
export function readableAddress(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const accounts = (raw as {accounts?: unknown}).accounts;
  if (!Array.isArray(accounts)) return null;
  let low: {index: number; publicKey: string} | null = null;
  for (const a of accounts as unknown[]) {
    if (typeof a !== 'object' || a === null || Array.isArray(a)) continue;
    const {index, publicKey} = a as {index?: unknown; publicKey?: unknown};
    if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || typeof publicKey !== 'string' || !ADDRESS.test(publicKey)) continue;
    if (low === null || index < low.index) low = {index, publicKey};
  }
  return low?.publicKey ?? null;
}

type View = 'loading' | 'entry' | 'notice';
type Action = 'again' | 'setup' | 'close';

/**
 * B1e §2.2, §2.4 (E9, E11, E12): `unlock.html?mode=remove-damaged`, the one screen that removes a wallet without its
 * password — and only a value the frozen predicate calls unreadable. It reads v1_vault itself and shows what it finds:
 * unreadable → the lines, the address (readableAddress), "Save the damaged data" (the value's exact text) and #37's typed
 * DELETE + (the hold, or the checkbox and one activation — B1e §3, view/deleteConfirm.ts); refused by this version → the refused state (no removal); a wallet → "A wallet
 * already exists", nothing offered; no wallet → set up. The confirmation hands over to damagedFlow's removeDamaged, which
 * reads again and sends only for the value shown (its digest); the background re-judges. Removed → #1, as #37.
 */
export function mountRemoveDamaged(deps: PageDeps, damaged: DamagedScreen): {show(): Promise<void>} {
  const helperEl = byId('rd-helper');
  const cancel = byId<HTMLButtonElement>('rd-cancel');
  const x = byId<HTMLButtonElement>('rd-x');
  const buttons = {again: byId<HTMLButtonElement>('rd-again'), setup: byId<HTMLButtonElement>('rd-setup'), close: byId<HTMLButtonElement>('rd-close')};
  let view: View = 'loading';
  let actions: readonly Action[] = [];
  /** The digest of the value on screen: the only value a removal may name. */
  let shownDigest: string | null = null;

  const confirm = mountDeleteConfirm(
    {
      field: byId<HTMLInputElement>('rd-word'),
      eyebrow: byId('rd-eyebrow'),
      matched: byId('rd-matched'),
      box: byId('rd-box'),
      check: byId('rd-check'),
      help: byId('rd-help'),
      caption: byId('rd-caption'),
      button: byId<HTMLButtonElement>('rd-hold'),
      name: byId('rd-name'),
      fill: byId('rd-fill'),
      count: byId('rd-count'),
      understood: byId<HTMLInputElement>('rd-understood'),
      understoodRow: byId('rd-understood-row'),
    },
    deps.timers,
    {
      allowed: () => view === 'entry' && !deps.gate.isBusy(),
      // A confirmation the gate refuses (another action holds it) removes nothing, and is asked for again.
      onConfirmed: () =>
        void exclusive(deps, render, removeShown).then(r => {
          if (r === 'busy') confirm.reset();
        }),
      onPressing: pressing => {
        cancel.disabled = pressing;
        x.disabled = pressing;
      },
      onceName: DAMAGED.remove,
    },
  );

  function render(): void {
    const busy = deps.gate.isBusy();
    const entry = view === 'entry';
    shown(byId('rd-entry'), entry);
    shown(byId('rd-hold'), entry);
    shown(byId('rd-notice'), view === 'notice');
    byId<HTMLInputElement>('rd-word').disabled = busy || !entry;
    for (const [name, b] of Object.entries(buttons)) {
      shown(b, view === 'notice' && actions.includes(name as Action));
      b.disabled = busy;
    }
    // A notice with its own way out ([Close this tab], [Start again], [Set up a wallet]) drops the bar's Cancel, as #37's.
    shown(cancel, view !== 'notice' || actions.length === 0);
    cancel.disabled = busy;
    x.disabled = busy;
    confirm.render();
  }
  const helper = (text: string) => setText(helperEl, text);
  const notice = (line: string, help: string, next: readonly Action[]) => {
    view = 'notice';
    actions = next;
    shownDigest = null;
    setText(byId('rd-notice-line'), line);
    setText(byId('rd-notice-help'), help);
    shown(byId('rd-notice-help'), help !== '');
    // B1e §3 (Task 3 fix round 1, I1): a notice removes nothing, so its bar carries no confirmation — the word emptied,
    // which clears and hides the checkbox row (it sits in the bar, outside #rd-entry).
    confirm.reset();
    render();
  };
  /** Reads what is stored now and shows it; true when the removal is offered. */
  const load = async (): Promise<boolean> => {
    view = 'loading';
    actions = [];
    shownDigest = null;
    helper('');
    confirm.reset();
    showScreen('v-remove-damaged');
    render();
    let raw: unknown;
    try {
      raw = await deps.store.readEnvelope();
    } catch {
      notice(COMMON.unreadable, '', []);
      return false;
    }
    const reading = vaultReading(raw);
    if (reading.kind === 'none') {
      notice(COMMON.noWallet, '', ['setup']);
      return false;
    }
    if (reading.kind === 'wallet') {
      notice(COMMON.exists, WELCOME.useIt, ['close']);
      return false;
    }
    if (reading.kind === 'refused') {
      damaged.show('refused', raw);
      return false;
    }
    shownDigest = fillSaveLink(byId<HTMLAnchorElement>('rd-save'), raw);
    const address = readableAddress(raw);
    shown(byId('rd-address'), address !== null);
    shown(byId('rd-no-address'), address === null);
    byId('rd-address').replaceChildren(...(address === null ? [] : [addressGroups(address)]));
    setText(byId('rd-no-address'), DAMAGED.noAddress);
    view = 'entry';
    render();
    return true;
  };
  async function removeShown(): Promise<void> {
    const digest = shownDigest;
    if (view !== 'entry' || digest === null) return;
    const out = await removeDamaged({send: deps.send, readEnvelope: deps.store.readEnvelope}, digest);
    if (out === 'removed') return deps.go('unlock.html?mode=welcome');
    if (out === 'changed') {
      if (await load()) helper(DAMAGED.changed);
      return;
    }
    if (out === 'not-unreadable') {
      await load();
      return;
    }
    if (out === 'no-wallet') return notice(COMMON.noWallet, '', ['setup']);
    if (out === 'send-open') return notice(RESTORE.sendOpen, '', ['again', 'close']);
    if (out === 'unlocked') return notice(DAMAGED.unlocked, '', ['again', 'close']);
    confirm.reset();
    helper(DELETE.failed);
  }

  deps.gate.onIdle(render);
  const closing = () => void exclusive(deps, render, async () => deps.closeTab());
  cancel.addEventListener('click', closing);
  x.addEventListener('click', closing);
  buttons.again.addEventListener('click', () => {
    if (view === 'notice' && actions.includes('again')) void exclusive(deps, render, load);
  });
  buttons.setup.addEventListener('click', () => {
    if (view === 'notice' && actions.includes('setup')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=welcome'));
  });
  buttons.close.addEventListener('click', () => {
    if (view === 'notice' && actions.includes('close')) void exclusive(deps, render, async () => deps.closeTab());
  });

  return {
    async show() {
      await load();
    },
  };
}
