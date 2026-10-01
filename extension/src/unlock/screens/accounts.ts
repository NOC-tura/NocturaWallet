import {addAccount, removeAccount} from '../accountsFlow';
import {createWrongBackoff} from '../orchestrate';
import {exclusive, type PageDeps} from '../page';
import {ACCOUNTS, COMMON} from '../strings';
import {byId, setText, showScreen} from '../view/dom';

/**
 * The add-account form (spec §1.2 `accounts`, opened by the switcher's [Add account]): the password →
 * a re-encrypted envelope with one more account. Restyled into the design's chrome; remove stays the
 * B1b-1 form (B1b-2b designs the accounts manager). Rule 6 on both buttons (the page's one gate). The
 * flows read v1_vault through stored.ts's storedVault (accountsFlow); this screen reads nothing itself.
 * The password leaves the field at the click, and a hidden tab or `pagehide` empties the field (§3.5).
 */
export function mountAccounts(deps: PageDeps): {show(): void} {
  const field = byId<HTMLInputElement>('acc-password');
  const add = byId<HTMLButtonElement>('acc-add');
  const remove = byId<HTMLButtonElement>('acc-remove');
  const backoff = createWrongBackoff(deps.sleep);
  const say = (text: string) => setText(byId('acc-helper'), text);
  const render = () => {
    const busy = deps.gate.isBusy();
    add.disabled = busy;
    remove.disabled = busy;
    field.disabled = busy;
  };
  const factor = () => {
    const password = field.value;
    field.value = '';
    return {password, kdf: deps.kdf};
  };
  const store = {...deps.store, send: deps.send};
  const doAdd = () =>
    void exclusive(deps, render, async () => {
      const f = factor();
      say(ACCOUNTS.adding);
      say(ACCOUNTS.outcome[await backoff.run(() => addAccount(store, f), () => say(COMMON.waitConfirm))]);
    });
  deps.gate.onIdle(render);
  add.addEventListener('click', doAdd);
  byId('acc-form').addEventListener('submit', e => {
    e.preventDefault();
    doAdd();
  });
  remove.addEventListener('click', () =>
    void exclusive(deps, render, async () => {
      const n = Number(byId<HTMLInputElement>('acc-remove-index').value);
      // The password leaves the field at the click on every branch, the refused number included.
      const f = factor();
      if (!Number.isSafeInteger(n) || n < 1) return say(ACCOUNTS.whichToRemove);
      say(ACCOUNTS.removing);
      say(ACCOUNTS.outcome[await backoff.run(() => removeAccount(store, f, n - 1), () => say(COMMON.waitConfirm))]);
    }),
  );
  // A hidden tab or a page left behind (the back/forward cache) keeps nothing typed (§3.5's memory rule).
  deps.onLeave(() => {
    field.value = '';
  });
  return {
    show() {
      showScreen('v-accounts');
      render();
      field.focus();
    },
  };
}
