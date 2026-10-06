// @vitest-environment happy-dom
import {act, cleanup, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {AccountsManager} from '../screens/AccountsManager';
import {ENV, renderInWallet, walletReader} from './harness';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {VAULT_KEY} from '../../background/accountsStore';
import {PENDING_KEY} from '../../background/pendingStore';
import {SETTINGS_KEY} from '../../background/settings';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';
import {fakeReader} from '../../background/__tests__/fakeDeps';
import {useWallet, type WalletModel} from '../WalletContext';
import {isOpen} from '../engine';
import {isOpen as backgroundIsOpen} from '../../background/pendingStore';

// B1b-2b §4.3 (D16, D17, C6, C14): the accounts manager against the real background.
const SELECTORS = selectorsOf(UI_SHEETS);
const THIRD = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const ENV3 = {...ENV, accounts: [...ENV.accounts, {index: 2, name: 'Third', publicKey: THIRD}]};
const CLI_ENV = {v: 1, scheme: 'cli', accounts: [{index: 0, name: 'CLI', publicKey: ACCOUNT.publicKey}]};
/** An open send from Savings, in the shape wallet.pending reports (a real signature, a real recipient). */
const OPEN_FROM_SAVINGS = pendingRecord({account: RECIPIENT, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: ACCOUNT.publicKey, amount: '1'}});
const names = () => [...document.querySelectorAll('.app-account-row .pri')].map(e => e.textContent);
const shown = (o: Parameters<typeof renderInWallet>[1] = {}) => renderInWallet(<AccountsManager onBack={() => undefined} />, {env: ENV3, ...o});
const settle = () => act(async () => new Promise(r => setTimeout(r, 30)));

/** The manager plus a probe that hands the test the live model (to lock, and to watch the selected account). */
async function withModel(o: Parameters<typeof renderInWallet>[1] = {}) {
  let current: WalletModel | null = null;
  function Probe() {
    current = useWallet();
    return null;
  }
  const w = await renderInWallet(
    <>
      <AccountsManager onBack={() => undefined} />
      <Probe />
    </>,
    {env: ENV3, ...o},
  );
  const model = (): WalletModel => {
    if (current === null) throw new Error('no model yet');
    return current;
  };
  return {...w, model};
}

/** Holds the first message of `type` until released; counts every message by type. */
function hold(type: string, match: (m: Record<string, unknown>) => boolean = () => true) {
  let release: () => void = () => undefined;
  let held = false;
  const seen: Record<string, unknown>[] = [];
  const gate = async (raw: unknown) => {
    const m = raw as Record<string, unknown>;
    seen.push(m);
    if (!held && m.type === type && match(m)) {
      held = true;
      await new Promise<void>(r => (release = r));
    }
  };
  const count = (t: string, f: (m: Record<string, unknown>) => boolean = () => true) => seen.filter(m => m.type === t && f(m)).length;
  return {gate, release: () => release(), isHeld: () => held, count};
}

describe('the accounts manager', () => {
  it('list: rows in the display order (E14), each with rename, ↑, ↓ and remove; the ends disabled; Add account', async () => {
    await shown({before: async ext => ext.local.set(SETTINGS_KEY, {accountOrder: [2, 0, 1]})});
    await waitFor(() => expect(names()).toEqual(['Third', 'Main', 'Savings']));
    expect(screen.getByText('Accounts', {selector: '.top-bar .title'})).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Move Third up'}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Move Savings down'}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Move Main up'}) as HTMLButtonElement).disabled).toBe(false);
    for (const n of ['Third', 'Main', 'Savings']) {
      expect(screen.getByRole('button', {name: `Rename ${n}`})).toBeTruthy();
      expect(screen.getByRole('button', {name: `Remove ${n}`})).toBeTruthy();
    }
    expect(screen.getByRole('button', {name: /Add account/})).toBeTruthy();
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
  });

  it('↓ writes accounts.order: the list follows and focus stays on the moved row’s same button', async () => {
    const w = await shown();
    await waitFor(() => expect(names()).toEqual(['Main', 'Savings', 'Third']));
    const down = screen.getByRole('button', {name: 'Move Main down'});
    down.focus();
    fireEvent.click(down);
    await waitFor(() => expect(names()).toEqual(['Savings', 'Main', 'Third']));
    expect(await w.ext.local.get(SETTINGS_KEY)).toMatchObject({accountOrder: [1, 0, 2]});
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Move Main down'));
  });

  it('↑ writes accounts.order the other way', async () => {
    const w = await shown();
    await waitFor(() => expect(names()).toEqual(['Main', 'Savings', 'Third']));
    fireEvent.click(screen.getByRole('button', {name: 'Move Third up'}));
    await waitFor(() => expect(names()).toEqual(['Main', 'Third', 'Savings']));
    expect(await w.ext.local.get(SETTINGS_KEY)).toMatchObject({accountOrder: [0, 2, 1]});
  });

  it('stale: the account set changed under the manager — O55, the list re-read; nothing written', async () => {
    const w = await shown();
    await waitFor(() => expect(names()).toEqual(['Main', 'Savings', 'Third']));
    await w.ext.local.set(VAULT_KEY, ENV);
    fireEvent.click(screen.getByRole('button', {name: 'Move Main down'}));
    expect(await screen.findByText('The accounts changed. Try again.')).toBeTruthy();
    await waitFor(() => expect(names()).toEqual(['Main', 'Savings']));
    expect(await w.ext.local.get(SETTINGS_KEY)).toBeUndefined();
  });

  it('remove: the sheet — O57, the address in groups of four, what it holds, the D16 line, [Continue to remove] → the remove page', async () => {
    const w = await shown();
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Remove Savings'}));
    const sheet = await screen.findByRole('dialog', {name: 'Remove Savings?'});
    expect([...sheet.querySelectorAll('.addr-groups span')].map(s => s.textContent).join('')).toBe(RECIPIENT);
    // walletReader: 62.4821 SOL, 4 200 NOC, 740.21 USDC; SOL $150, USDC $1 → $10,112.52 (NOC at stage price is not in the total).
    await waitFor(() => expect(within(sheet).getByText('Holds 62.4821 SOL · 4,200.00 NOC · 740.21 USDC · $10,112.52')).toBeTruthy());
    expect(within(sheet).getByText('Its funds stay on Solana; add it again to use them.')).toBeTruthy();
    expect(within(sheet).getByText('Confirmation opens in a new tab.')).toBeTruthy();
    fireEvent.click(within(sheet).getByRole('button', {name: 'Continue to remove'}));
    expect(w.platform.opened).toEqual(['unlock.html?mode=accounts&op=remove&index=1']);
    expect(w.platform.closed).toBe(1);
  });

  it('remove: [Cancel] closes the sheet without opening anything', async () => {
    const w = await shown();
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Remove Savings'}));
    const sheet = await screen.findByRole('dialog', {name: 'Remove Savings?'});
    fireEvent.click(within(sheet).getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(w.platform.opened).toEqual([]);
  });

  it('remove: "Holds no funds" for an empty account', async () => {
    await shown({reader: fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []})});
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Remove Main'}));
    expect(await screen.findByText('Holds no funds')).toBeTruthy();
  });

  it('remove: "Balance not checked" when no read answered', async () => {
    await shown({reader: walletReader({getBalance: async () => new Promise<bigint>(() => undefined)})});
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Remove Third'}));
    expect(await screen.findByText('Balance not checked')).toBeTruthy();
  });

  it('remove · send open: [Continue to remove] disabled and the adapted pending line', async () => {
    await shown({before: async ext => ext.local.set(PENDING_KEY, [OPEN_FROM_SAVINGS])});
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Remove Savings'}));
    const sheet = await screen.findByRole('dialog', {name: 'Remove Savings?'});
    await waitFor(() => expect(within(sheet).getByText('A transaction from this account is still pending. Wait until it confirms or expires — about two minutes — then try again.')).toBeTruthy());
    expect((within(sheet).getByRole('button', {name: 'Continue to remove'}) as HTMLButtonElement).disabled).toBe(true);
  });

  it('remove · the send closes while the sheet is open: [Continue to remove] enables without leaving (the sheet re-reads wallet.pending)', async () => {
    // Savings is not the selected account: the provider polls wallet.pending only for Main's sends, so the sheet reads its own.
    const w = await shown({before: async ext => ext.local.set(PENDING_KEY, [OPEN_FROM_SAVINGS])});
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Remove Savings'}));
    const sheet = await screen.findByRole('dialog', {name: 'Remove Savings?'});
    const go = () => within(sheet).getByRole('button', {name: 'Continue to remove'}) as HTMLButtonElement;
    await waitFor(() => expect(go().disabled).toBe(true));
    await w.ext.local.set(PENDING_KEY, [{...OPEN_FROM_SAVINGS, state: 'confirmed'}]);
    await waitFor(() => expect(go().disabled).toBe(false), {timeout: 4_000});
    expect(within(sheet).queryByText(/still pending/)).toBeNull();
  }, 10_000);

  it('remove · a stuck send is open too: [Continue to remove] disabled', async () => {
    await shown({before: async ext => ext.local.set(PENDING_KEY, [{...OPEN_FROM_SAVINGS, state: 'stuck'}])});
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Remove Savings'}));
    const sheet = await screen.findByRole('dialog', {name: 'Remove Savings?'});
    await waitFor(() => expect((within(sheet).getByRole('button', {name: 'Continue to remove'}) as HTMLButtonElement).disabled).toBe(true));
  });

  it('isOpen: the popup’s and the background’s open-send rule agree on every state', () => {
    for (const state of ['pending', 'stuck', 'confirmed', 'failed', 'expired'] as const) {
      expect(isOpen({state})).toBe(backgroundIsOpen(pendingRecord({state})));
    }
    expect(isOpen({state: 'stuck'})).toBe(true);
  });

  it('remove names the envelope index, never the display position', async () => {
    const w = await shown({before: async ext => ext.local.set(SETTINGS_KEY, {accountOrder: [2, 0, 1]})});
    await waitFor(() => expect(names()).toEqual(['Third', 'Main', 'Savings']));
    fireEvent.click(screen.getByRole('button', {name: 'Remove Third'}));
    fireEvent.click(within(await screen.findByRole('dialog', {name: 'Remove Third?'})).getByRole('button', {name: 'Continue to remove'}));
    expect(w.platform.opened).toEqual(['unlock.html?mode=accounts&op=remove&index=2']);
  });

  it('a move reads no balances again (the rows are keyed on the set of addresses, not their order)', async () => {
    const seen: {type: string; account?: string}[] = [];
    await shown({gate: m => void seen.push(m as {type: string; account?: string})});
    const reads = () => seen.filter(m => m.type === 'wallet.balances' && (m.account === RECIPIENT || m.account === THIRD)).length;
    await waitFor(() => expect(reads()).toBe(2));
    await settle();
    fireEvent.click(screen.getByRole('button', {name: 'Move Main down'}));
    await waitFor(() => expect(names()).toEqual(['Savings', 'Main', 'Third']));
    await settle();
    expect(reads()).toBe(2);
  });

  it('one move at a time: while a move is in flight every ↑/↓ is disabled', async () => {
    const h = hold('accounts.order');
    await shown({gate: h.gate});
    await waitFor(() => expect(names()).toEqual(['Main', 'Savings', 'Third']));
    fireEvent.click(screen.getByRole('button', {name: 'Move Main down'}));
    await waitFor(() => expect(h.isHeld()).toBe(true));
    for (const n of ['Move Third up', 'Move Savings up', 'Move Savings down']) expect((screen.getByRole('button', {name: n}) as HTMLButtonElement).disabled).toBe(true);
    h.release();
    await waitFor(() => expect((screen.getByRole('button', {name: 'Move Third up'}) as HTMLButtonElement).disabled).toBe(false));
    expect(h.count('accounts.order')).toBe(1);
  });

  it('a row moved to the end: its ↓ is disabled, so the focus goes to the same row’s ↑', async () => {
    await shown();
    await waitFor(() => expect(names()).toEqual(['Main', 'Savings', 'Third']));
    const down = () => screen.getByRole('button', {name: 'Move Main down'}) as HTMLButtonElement;
    down().focus();
    fireEvent.click(down());
    await waitFor(() => expect(names()).toEqual(['Savings', 'Main', 'Third']));
    await waitFor(() => expect(document.activeElement).toBe(down()));
    fireEvent.click(down());
    await waitFor(() => expect(names()).toEqual(['Savings', 'Third', 'Main']));
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Move Main up'));
    expect(down().disabled).toBe(true);
  });

  it('the last account: its trash button disabled, and "The last account cannot be removed."', async () => {
    await renderInWallet(<AccountsManager onBack={() => undefined} />, {env: {...ENV, accounts: [ENV.accounts[0]]}, accounts: [ACCOUNT]});
    await waitFor(() => expect(names()).toEqual(['Main']));
    expect((screen.getByRole('button', {name: 'Remove Main'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('The last account cannot be removed.')).toBeTruthy();
  });

  it('rename inline (2a’s rule and errors); select from a row', async () => {
    const w = await shown();
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Rename Third'}));
    fireEvent.change(screen.getByRole('textbox', {name: 'Account name'}), {target: {value: 'Rainy day'}});
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    await waitFor(() => expect(names()).toContain('Rainy day'));
    fireEvent.click(screen.getByText('Savings'));
    await waitFor(async () => expect(await w.ext.local.get(SETTINGS_KEY)).toMatchObject({selectedAccount: 1}));
  });

  it('rename: a refused name says why (2a’s strings), and the editor stays', async () => {
    await shown();
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Rename Third'}));
    fireEvent.change(screen.getByRole('textbox', {name: 'Account name'}), {target: {value: ''}});
    fireEvent.click(screen.getByRole('button', {name: 'Save'}));
    expect((await screen.findByRole('alert')).textContent).toBe('Names are 1 to 32 characters, without control characters.');
    expect(screen.getByRole('textbox', {name: 'Account name'})).toBeTruthy();
  });

  it('[Add account] opens accounts&op=add and closes; a cli wallet cannot add', async () => {
    const w = await shown();
    fireEvent.click(await screen.findByRole('button', {name: /Add account/}));
    expect(w.platform.opened).toEqual(['unlock.html?mode=accounts&op=add']);
    expect(w.platform.closed).toBe(1);
    cleanup();

    // Pre-flight F8: the cli half, asserted — its one account offers no remove and no reorder, and Add account is disabled with 2a's reason.
    const c = await renderInWallet(<AccountsManager onBack={() => undefined} />, {env: CLI_ENV, accounts: [ACCOUNT]});
    await waitFor(() => expect(names()).toEqual(['CLI']));
    expect((screen.getByRole('button', {name: 'Remove CLI'}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Move CLI up'}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Move CLI down'}) as HTMLButtonElement).disabled).toBe(true);
    const add = screen.getByRole('button', {name: /Add account/}) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(screen.getByText('A Solana CLI wallet has exactly one account.')).toBeTruthy();
    fireEvent.click(add);
    expect(c.platform.opened).toEqual([]);
  });

  describe('rule 6: every button is a LockedButton (`disabled` lifted, a second press inside 500 ms does nothing)', () => {
    it('↓: no second order', async () => {
      let orders = 0;
      await shown({gate: m => void ((m as {type: string}).type === 'accounts.order' && (orders += 1))});
      await waitFor(() => expect(names()).toHaveLength(3));
      const down = screen.getByRole('button', {name: 'Move Main down'}) as HTMLButtonElement;
      fireEvent.click(down);
      down.disabled = false;
      fireEvent.click(down);
      await settle();
      expect(orders).toBe(1);
    });

    it('↑: no second order', async () => {
      let orders = 0;
      await shown({gate: m => void ((m as {type: string}).type === 'accounts.order' && (orders += 1))});
      await waitFor(() => expect(names()).toHaveLength(3));
      const up = screen.getByRole('button', {name: 'Move Third up'}) as HTMLButtonElement;
      fireEvent.click(up);
      up.disabled = false;
      fireEvent.click(up);
      await settle();
      expect(orders).toBe(1);
    });

    it('Save (rename): no second rename', async () => {
      let renames = 0;
      await shown({gate: m => void ((m as {type: string}).type === 'accounts.rename' && (renames += 1))});
      await waitFor(() => expect(names()).toHaveLength(3));
      fireEvent.click(screen.getByRole('button', {name: 'Rename Third'}));
      fireEvent.change(screen.getByRole('textbox', {name: 'Account name'}), {target: {value: ''}});
      const save = screen.getByRole('button', {name: 'Save'}) as HTMLButtonElement;
      fireEvent.click(save);
      save.disabled = false;
      fireEvent.click(save);
      await settle();
      expect(renames).toBe(1);
    });

    it('the trash (remove): locked when pressed; pressed again inside the lock, no sheet', async () => {
      await shown();
      await waitFor(() => expect(names()).toHaveLength(3));
      const trash = screen.getByRole('button', {name: 'Remove Savings'}) as HTMLButtonElement;
      fireEvent.click(trash);
      expect(trash.disabled).toBe(true);
      fireEvent.click(within(await screen.findByRole('dialog', {name: 'Remove Savings?'})).getByRole('button', {name: 'Cancel'}));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      trash.disabled = false;
      fireEvent.click(trash);
      await settle();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('[Continue to remove]: one page opened', async () => {
      const w = await shown({surface: 'tab'});
      await waitFor(() => expect(names()).toHaveLength(3));
      fireEvent.click(screen.getByRole('button', {name: 'Remove Savings'}));
      const go = within(await screen.findByRole('dialog', {name: 'Remove Savings?'})).getByRole('button', {name: 'Continue to remove'}) as HTMLButtonElement;
      fireEvent.click(go);
      go.disabled = false;
      fireEvent.click(go);
      expect(w.platform.opened).toEqual(['unlock.html?mode=accounts&op=remove&index=1']);
    });

    it('[Add account]: one page opened', async () => {
      const w = await shown({surface: 'tab'});
      const add = (await screen.findByRole('button', {name: /Add account/})) as HTMLButtonElement;
      fireEvent.click(add);
      add.disabled = false;
      fireEvent.click(add);
      expect(w.platform.opened).toEqual(['unlock.html?mode=accounts&op=add']);
    });
  });

  describe('every await is guarded: an answer after unmount, lock or an account switch sets nothing and reads nothing', () => {
    /** A move whose answer is `stale` (the vault changed under the manager), held at the gate. */
    async function heldStaleMove() {
      const h = hold('accounts.order');
      const w = await withModel({gate: h.gate});
      await waitFor(() => expect(names()).toEqual(['Main', 'Savings', 'Third']));
      await w.ext.local.set(VAULT_KEY, ENV);
      fireEvent.click(screen.getByRole('button', {name: 'Move Main down'}));
      await waitFor(() => expect(h.isHeld()).toBe(true));
      return {...w, h};
    }

    it('move · unmount: no re-read', async () => {
      const {h} = await heldStaleMove();
      cleanup();
      const before = h.count('wallet.state');
      h.release();
      await settle();
      expect(h.count('wallet.state')).toBe(before);
    });

    it('move · lock: no O55, no re-read', async () => {
      const {h, model} = await heldStaleMove();
      await act(async () => void (await model().lock()));
      await waitFor(() => expect(model().phase).toBe('locked'));
      const before = h.count('wallet.state');
      h.release();
      await settle();
      expect(h.count('wallet.state')).toBe(before);
      expect(screen.queryByText('The accounts changed. Try again.')).toBeNull();
    });

    it('move · account switch: no O55, no re-read', async () => {
      const {h, model} = await heldStaleMove();
      fireEvent.click(screen.getByText('Savings'));
      await waitFor(() => expect(model().wallet?.selected).toBe(1));
      await settle();
      const before = h.count('wallet.state');
      h.release();
      await settle();
      expect(h.count('wallet.state')).toBe(before);
      expect(screen.queryByText('The accounts changed. Try again.')).toBeNull();
    });

    it('move · the re-read itself answering after an unmount sets no line', async () => {
      // The order answers, then the re-read (wallet.state after the order) is held; the screen goes; nothing follows.
      let ordered = false;
      let release: () => void = () => undefined;
      let held = false;
      const w = await withModel({
        gate: async raw => {
          const m = raw as {type: string};
          if (m.type === 'accounts.order') ordered = true;
          else if (m.type === 'wallet.state' && ordered && !held) {
            held = true;
            await new Promise<void>(r => (release = r));
          }
        },
      });
      await waitFor(() => expect(names()).toEqual(['Main', 'Savings', 'Third']));
      await w.ext.local.set(VAULT_KEY, ENV);
      fireEvent.click(screen.getByRole('button', {name: 'Move Main down'}));
      await waitFor(() => expect(held).toBe(true));
      await act(async () => void (await w.model().lock()));
      release();
      await settle();
      expect(screen.queryByText('The accounts changed. Try again.')).toBeNull();
    });

    /** The remove sheet's own wallet.pending read, held at the gate (Savings has an open send, so it would poll on). */
    async function heldSheetRead() {
      let armed = false;
      const h = hold('wallet.pending', () => armed);
      const w = await withModel({gate: h.gate, before: async ext => ext.local.set(PENDING_KEY, [OPEN_FROM_SAVINGS])});
      await waitFor(() => expect(names()).toHaveLength(3));
      await settle();
      armed = true;
      fireEvent.click(screen.getByRole('button', {name: 'Remove Savings'}));
      await waitFor(() => expect(h.isHeld()).toBe(true));
      return {...w, h};
    }

    it('sheet read · the sheet closed: no poll scheduled', async () => {
      const {h} = await heldSheetRead();
      fireEvent.click(within(screen.getByRole('dialog', {name: 'Remove Savings?'})).getByRole('button', {name: 'Cancel'}));
      const before = h.count('wallet.pending');
      h.release();
      await act(async () => new Promise(r => setTimeout(r, 2_500)));
      expect(h.count('wallet.pending')).toBe(before);
    }, 10_000);

    it('sheet read · lock: no poll scheduled', async () => {
      const {h, model} = await heldSheetRead();
      await act(async () => void (await model().lock()));
      await waitFor(() => expect(model().phase).toBe('locked'));
      const before = h.count('wallet.pending');
      h.release();
      await act(async () => new Promise(r => setTimeout(r, 2_500)));
      expect(h.count('wallet.pending')).toBe(before);
    }, 10_000);

    /** A rename held at the gate; '' is refused (`malformed`), a real name succeeds (and re-reads). */
    async function heldRename(value: string) {
      const h = hold('accounts.rename');
      const w = await withModel({gate: h.gate});
      await waitFor(() => expect(names()).toHaveLength(3));
      fireEvent.click(screen.getByRole('button', {name: 'Rename Third'}));
      fireEvent.change(screen.getByRole('textbox', {name: 'Account name'}), {target: {value}});
      fireEvent.click(screen.getByRole('button', {name: 'Save'}));
      await waitFor(() => expect(h.isHeld()).toBe(true));
      return {...w, h};
    }

    it('rename · unmount: no re-read', async () => {
      const {h} = await heldRename('Rainy day');
      cleanup();
      const before = h.count('wallet.state');
      h.release();
      await settle();
      expect(h.count('wallet.state')).toBe(before);
    });

    it('rename · lock: no error line', async () => {
      const {h, model} = await heldRename('');
      await act(async () => void (await model().lock()));
      await waitFor(() => expect(model().phase).toBe('locked'));
      h.release();
      await settle();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('rename · an account switch does not drop the answer: the editor gets its error (fix round 1, 6)', async () => {
      const {h, model} = await heldRename('');
      fireEvent.click(screen.getByText('Savings'));
      await waitFor(() => expect(model().wallet?.selected).toBe(1));
      h.release();
      expect((await screen.findByRole('alert')).textContent).toBe('Names are 1 to 32 characters, without control characters.');
    });

    /** A select held at the gate. */
    async function heldSelect() {
      const h = hold('accounts.select');
      const w = await withModel({gate: h.gate});
      await waitFor(() => expect(names()).toHaveLength(3));
      await settle();
      fireEvent.click(screen.getByText('Savings'));
      await waitFor(() => expect(h.isHeld()).toBe(true));
      return {...w, h};
    }

    it('select · unmount: no re-read', async () => {
      const {h} = await heldSelect();
      cleanup();
      const before = h.count('wallet.state');
      h.release();
      await settle();
      expect(h.count('wallet.state')).toBe(before);
    });

    it('select · lock: no re-read', async () => {
      const {h, model} = await heldSelect();
      await act(async () => void (await model().lock()));
      await waitFor(() => expect(model().phase).toBe('locked'));
      const before = h.count('wallet.state');
      h.release();
      await settle();
      expect(h.count('wallet.state')).toBe(before);
    });

    // The balances pass (useAccountBalances, shared with the Switcher): per address, so a switch does not concern it.
    async function heldBalances() {
      const h = hold('wallet.balances', m => m.account === RECIPIENT);
      const w = await withModel({gate: h.gate});
      await waitFor(() => expect(h.isHeld()).toBe(true));
      return {...w, h};
    }

    it('balances · unmount: the pass stops (the third account is never read)', async () => {
      const {h} = await heldBalances();
      cleanup();
      h.release();
      await settle();
      expect(h.count('wallet.balances', m => m.account === THIRD)).toBe(0);
    });

    it('balances · lock: the pass stops (the third account is never read)', async () => {
      const {h, model} = await heldBalances();
      await act(async () => void (await model().lock()));
      await waitFor(() => expect(model().phase).toBe('locked'));
      h.release();
      await settle();
      expect(h.count('wallet.balances', m => m.account === THIRD)).toBe(0);
    });

    it('balances · account switch: the pass goes on (rows are per address, not per selected account)', async () => {
      const {h, model} = await heldBalances();
      // To Savings (the held row): the provider's own read is of Savings, never of the third account.
      fireEvent.click(screen.getByText('Savings'));
      await waitFor(() => expect(model().wallet?.selected).toBe(1));
      expect(h.count('wallet.balances', m => m.account === THIRD)).toBe(0);
      h.release();
      await waitFor(() => expect(h.count('wallet.balances', m => m.account === THIRD)).toBeGreaterThan(0));
    });
  });
});
