// @vitest-environment happy-dom
import {act, cleanup, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {base58} from '@scure/base';
import {Contacts} from '../screens/Contacts';
import {avatarOf} from '../addressBook';
import {renderInWallet, type WalletOptions} from './harness';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {CONTACTS_KEY} from '../../background/contacts';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {lock} from '../../background/autolock';
import {RECIPIENT} from '../../background/__tests__/fixtures';
import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// B1b-2b §6.1 (D18, D21, C12; review H3): #15 — populated, empty, search, no result, pick, full, load failed.
const SELECTORS = selectorsOf(UI_SHEETS);
const MARKO = 'GabcQwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeYxyz9';
const BISTRO = '3jkLmUeyKhsnLj9SNQcdNhAFaapuTr5DPeR2S1PepT8c';
const TINA = '8qWeRT6vqbDrdEwV1dwQi6AtEcY6CT7Xf3aRt8EXfD2x';
const addr = (n: number): string => base58.encode(Uint8Array.from({length: 32}, (_, j) => (j === 0 ? n + 1 : 7)));
const DAY = 86_400_000;
async function book(ext: {local: {set(k: string, v: unknown): Promise<void>}}): Promise<void> {
  await ext.local.set(CONTACTS_KEY, [
    {address: MARKO, name: 'Marko · Mom'},
    {address: BISTRO, name: 'Bistro · for Marketing'},
    {address: TINA, name: 'Tina'},
  ]);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: MARKO, at: Date.now() - 3 * DAY}]);
}
const rows = () => [...document.querySelectorAll('.s-abook .row')] as HTMLElement[];
const show = (o: {pick?: boolean; onPick?: (a: string) => void; onBack?: () => void} = {}, w: WalletOptions = {before: book}) =>
  renderInWallet(<Contacts pick={o.pick ?? false} onBack={o.onBack ?? (() => undefined)} onPick={o.onPick ?? (() => undefined)} />, w);

describe('#15 address book — standalone', () => {
  it('populated: the drawn rows — avatar gradient + initial, name, first 4 … last 4, when — newest first; back, "Add contact", search', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(screen.getByText('Address book', {selector: '.top-bar .title.noc-h1'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Back'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Add contact'})).toBeTruthy();
    expect((screen.getByRole('textbox', {name: 'Search contacts'}) as HTMLInputElement).placeholder).toBe('Search contacts');
    const [marko, bistro, tina] = rows();
    expect(marko?.querySelector('.ava')?.className).toBe(`ava ${avatarOf(MARKO)}`);
    expect(marko?.querySelector('.ava')?.textContent).toBe('M');
    expect(marko?.querySelector('.name')?.textContent).toBe('Marko · Mom');
    expect(marko?.querySelector('.addr')?.textContent).toBe('Gabc…xyz9');
    expect(marko?.querySelector('.when')?.textContent).toBe('3 days ago');
    expect(bistro?.querySelector('.when')?.textContent).toBe('never');
    expect(tina?.querySelector('.addr')?.textContent).toBe('8qWe…fD2x');
    // The standalone list keeps the drawn truncation: no full address, no never-sent line.
    expect(document.querySelector('.s-abook .addr-groups')).toBeNull();
    expect(screen.queryByText('You have never sent to this address.')).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-abook')!, SELECTORS)).toEqual([]);
  });

  it('empty: the search disabled, the empty state, "Add first contact" opens the add sheet with an address field', async () => {
    await show({}, {});
    expect(await screen.findByText('No saved contacts yet')).toBeTruthy();
    expect((screen.getByRole('textbox', {name: 'Search contacts'}) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText('Save aliases for the wallets you send to most often. Each one shows up here with the truncated address and last-sent date.')).toBeTruthy();
    expect(screen.getByText("Or save one from a transaction's details.")).toBeTruthy();
    expect(document.querySelector('.s-abook .empty .ic svg')).toBeTruthy();
    expect(unstyledClasses(document.querySelector('.s-abook')!, SELECTORS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', {name: /Add first contact/}));
    expect(await screen.findByRole('dialog', {name: 'Add contact'})).toBeTruthy();
    expect(document.getElementById('contact-address')).toBeTruthy();
  });

  it('search active: "mark" → "2 results for "mark"", the matches marked, "No more matches.", and "Add new contact "mark" →" opens the sheet with the name', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.change(screen.getByRole('textbox', {name: 'Search contacts'}), {target: {value: 'mark'}});
    expect(screen.getByText('2 results for "mark"')).toBeTruthy();
    expect(rows().map(r => r.querySelector('.name')?.textContent)).toEqual(['Marko · Mom', 'Bistro · for Marketing']);
    expect([...document.querySelectorAll('.s-abook .row mark')].map(m => m.textContent)).toEqual(['Mark', 'Mark']);
    expect(screen.getByText('No more matches.')).toBeTruthy();
    expect(unstyledClasses(document.querySelector('.s-abook')!, SELECTORS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', {name: 'Add new contact "mark" →'}));
    expect(((await screen.findByRole('dialog', {name: 'Add contact'})).querySelector('#contact-name') as HTMLInputElement).value).toBe('mark');
  });

  it('search by address, case-insensitive; one match says "1 result"; Clear search empties it', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.change(screen.getByRole('textbox', {name: 'Search contacts'}), {target: {value: 'FD2X'}});
    expect(screen.getByText('1 result for "FD2X"')).toBeTruthy();
    expect(rows().map(r => r.querySelector('.name')?.textContent)).toEqual(['Tina']);
    fireEvent.click(screen.getByRole('button', {name: 'Clear search'}));
    expect(rows()).toHaveLength(3);
    expect(screen.queryByText(/result/)).toBeNull();
  });

  it('search · no result: O71 and the same add button', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.change(screen.getByRole('textbox', {name: 'Search contacts'}), {target: {value: 'zed'}});
    expect(screen.getByText('No contacts match "zed".')).toBeTruthy();
    expect(screen.queryByText('No more matches.')).toBeNull();
    expect(screen.queryByText(/results? for/)).toBeNull();
    expect(screen.getByRole('button', {name: 'Add new contact "zed" →'})).toBeTruthy();
  });

  // Review L1: an address typed into the search, with no match, seeds the sheet's address field — not the name.
  it('"Add new contact" for an address query: the address field holds it, the name is empty', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.change(screen.getByRole('textbox', {name: 'Search contacts'}), {target: {value: addr(9)}});
    expect(screen.getByText(`No contacts match "${addr(9)}".`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: `Add new contact "${addr(9)}" →`}));
    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
    expect((dialog.querySelector('#contact-address') as HTMLInputElement).value).toBe(addr(9));
    expect((dialog.querySelector('#contact-name') as HTMLInputElement).value).toBe('');
  });

  it('D21: a row tap opens the edit sheet; a rename shows in the list; a delete removes the row', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.click(rows()[2]!);
    const dialog = await screen.findByRole('dialog', {name: 'Edit contact'});
    fireEvent.change(dialog.querySelector('#contact-name')!, {target: {value: 'Tina K.'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save'}));
    await waitFor(() => expect(rows()[2]?.querySelector('.name')?.textContent).toBe('Tina K.'));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(rows()[2]!);
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', {name: 'Delete contact'}));
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    await waitFor(() => expect(rows()).toHaveLength(2));
  });

  it('full (200): the +, and "Add new contact", disabled; O73', async () => {
    await show({}, {before: ext => ext.local.set(CONTACTS_KEY, Array.from({length: 200}, (_, i) => ({address: addr(i), name: `C${i}`})))});
    expect(await screen.findByText('The address book is full (200 contacts).')).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Add contact'}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', {name: 'Search contacts'}), {target: {value: 'C19'}});
    expect((screen.getByRole('button', {name: 'Add new contact "C19" →'}) as HTMLButtonElement).disabled).toBe(true);
    expect(unstyledClasses(document.querySelector('.s-abook')!, SELECTORS)).toEqual([]);
  });

  it('load failed: O74 and Try again, which reads again', async () => {
    let fail = true;
    await show({}, {
      before: book,
      gate: m => {
        if ((m as {type: string}).type === 'contacts.list' && fail) throw new Error('worker restarting');
      },
    });
    expect(await screen.findByText('Could not load your contacts. Try again.')).toBeTruthy();
    expect(unstyledClasses(document.querySelector('.s-abook')!, SELECTORS)).toEqual([]);
    fail = false;
    fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
    await waitFor(() => expect(rows()).toHaveLength(3));
  });

  // Pre-flight G2 (spec §7 rule 6, Differs): the `+` and the add buttons open a sheet, so a second press is invisible —
  // the lock itself is asserted: disabled and is-busy right after the press.
  it('rule 6: the + and "Add new contact" are locked on the press (disabled + is-busy) while their sheet opens', async () => {
    await show();
    await waitFor(() => expect(rows()).toHaveLength(3));
    const plus = screen.getByRole('button', {name: 'Add contact'}) as HTMLButtonElement;
    fireEvent.click(plus);
    expect(plus.disabled).toBe(true);
    expect(plus.classList.contains('is-busy')).toBe(true);
    expect(await screen.findByRole('dialog', {name: 'Add contact'})).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.change(screen.getByRole('textbox', {name: 'Search contacts'}), {target: {value: 'zed'}});
    const addNew = screen.getByRole('button', {name: 'Add new contact "zed" →'}) as HTMLButtonElement;
    fireEvent.click(addNew);
    expect(addNew.disabled).toBe(true);
    expect(addNew.classList.contains('is-busy')).toBe(true);
    expect(await screen.findByRole('dialog', {name: 'Add contact'})).toBeTruthy();
  });

  // Pre-flight R9: "Add contact" and O72 have one home, CONTACT_TEXT (the contact sheet); #15 reuses them.
  it('"Add contact" and O72 are not written a second time in Contacts.tsx (CONTACTS_TEXT reuses CONTACT_TEXT)', () => {
    const source = readFileSync(join(__dirname, '../screens/Contacts.tsx'), 'utf8');
    expect(source).not.toContain("'Add contact'");
    expect(source).not.toContain('You have never sent to this address.');
  });

  it('back pops', async () => {
    const onBack = vi.fn();
    await show({onBack});
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // The alive guard, made observable: a `locked` answer would call reload() (a wallet.state read) — after the screen
  // went, it must not.
  it('an answer after the screen went does nothing: a late `locked` reloads nothing', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => {
      release = r;
    });
    let gone = false;
    const after: string[] = [];
    let ext: Parameters<typeof lock>[0] | null = null;
    await show({}, {
      before: async e => {
        ext = e;
        await book(e);
      },
      gate: async m => {
        const type = (m as {type: string}).type;
        if (gone) after.push(type);
        if (type === 'contacts.list') await held;
      },
    });
    expect(document.querySelector('.s-abook[aria-busy="true"]')).toBeTruthy();
    await lock(ext!);
    gone = true;
    cleanup();
    release();
    await act(async () => new Promise(r => setTimeout(r, 30)));
    expect(after).toEqual([]);
  });
});

describe('#15 address book — pick (from #12; review H3)', () => {
  it('every row shows the full address in groups of four; a contact never sent to says O72 in place of the date; one sent to keeps its date', async () => {
    await show({pick: true});
    await waitFor(() => expect(rows()).toHaveLength(3));
    const [marko, bistro] = rows();
    expect([...(marko?.querySelectorAll('.addr .addr-groups > span') ?? [])].map(s => s.textContent)).toEqual(MARKO.match(/.{1,4}/g));
    expect(marko?.querySelector('.when')?.textContent).toBe('3 days ago');
    expect(bistro?.querySelector('.when')?.textContent).toBe('You have never sent to this address.');
    expect(bistro?.querySelector('.when')?.className).toBe('when noc-caption noc-warning');
    expect(screen.queryByText('Gabc…xyz9')).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-abook')!, SELECTORS)).toEqual([]);
  });

  // Review L5: a saved address that is one of this wallet's accounts says "Your account: <name>" in its pick row.
  it('an own account saved as a contact: the pick row says "Your account: Savings", not a date or O72', async () => {
    await show({pick: true}, {before: ext => ext.local.set(CONTACTS_KEY, [{address: RECIPIENT, name: 'Not my savings'}])});
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]?.querySelector('.when')?.textContent).toBe('Your account: Savings');
  });

  // Task 2 carry: the precedence own > treasury > contact — the fee treasury saved as a contact reads "Noctura treasury".
  it('the fee treasury saved as a contact: the pick row says "Noctura treasury", not a date or O72', async () => {
    await show({pick: true}, {before: ext => ext.local.set(CONTACTS_KEY, [{address: MAINNET_FEE_TREASURY, name: 'Treasury?'}])});
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]?.querySelector('.when')?.textContent).toBe('Noctura treasury');
    expect(rows()[0]?.querySelector('.name')?.textContent).toBe('Treasury?');
  });

  it('a row tap hands the address back (no edit sheet)', async () => {
    const onPick = vi.fn();
    await show({pick: true, onPick});
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.click(rows()[1]!);
    expect(onPick).toHaveBeenCalledWith(BISTRO);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a contact added from pick is picked at once', async () => {
    const onPick = vi.fn();
    await show({pick: true, onPick});
    await waitFor(() => expect(rows()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', {name: 'Add contact'}));
    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
    fireEvent.change(dialog.querySelector('#contact-address')!, {target: {value: addr(9)}});
    fireEvent.change(dialog.querySelector('#contact-name')!, {target: {value: 'New one'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save'}));
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(addr(9)));
  });
});
