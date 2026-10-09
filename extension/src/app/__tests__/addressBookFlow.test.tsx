// @vitest-environment happy-dom
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {renderApp} from './appHarness';
import {CONTACTS_KEY} from '../../background/contacts';

// B1b-2b plan 2: the address book inside the whole App — #31's row → #15, and Esc over the contact sheet.
const MARKO = 'GabcQwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeYxyz9';
const saved = (ext: {local: {set(k: string, v: unknown): Promise<void>}}) => ext.local.set(CONTACTS_KEY, [{address: MARKO, name: 'Marko · Mom'}]);

async function toBook(o: Parameters<typeof renderApp>[0] = {}) {
  const w = await renderApp(o);
  await screen.findByText('TOKENS');
  fireEvent.click(screen.getByRole('button', {name: 'Settings'}));
  fireEvent.click(await screen.findByText('Address book', {selector: '.s7-title'}));
  await screen.findByText('Address book', {selector: '.top-bar .title'});
  return w;
}

describe('#31 → #15 (plan 2)', () => {
  it('the Address book row opens #15 standalone; Back returns to #31', async () => {
    await toBook({before: saved});
    expect(await screen.findByText('Marko · Mom')).toBeTruthy();
    expect(screen.getByText('Gabc…xyz9')).toBeTruthy();
    expect(document.querySelector('.s-abook .addr-groups')).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByRole('heading', {name: 'Settings'})).toBeTruthy();
  });

  it('Esc over the contact sheet closes the sheet only; Esc again leaves #15', async () => {
    await toBook({before: saved});
    fireEvent.click(await screen.findByText('Marko · Mom'));
    expect(await screen.findByRole('dialog', {name: 'Edit contact'})).toBeTruthy();
    fireEvent.keyDown(document, {key: 'Escape'});
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Address book', {selector: '.top-bar .title'})).toBeTruthy();
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(await screen.findByRole('heading', {name: 'Settings'})).toBeTruthy();
  });

  it('a contact saved on #15 shows up there and in #31’s count', async () => {
    await toBook();
    expect(await screen.findByText('No saved contacts yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Add contact'}));
    const dialog = await screen.findByRole('dialog', {name: 'Add contact'});
    fireEvent.change(dialog.querySelector('#contact-address')!, {target: {value: MARKO}});
    fireEvent.change(dialog.querySelector('#contact-name')!, {target: {value: 'Marko · Mom'}});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Save'}));
    expect(await screen.findByText('Marko · Mom')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    await waitFor(() => expect(screen.getByText('Address book', {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta')?.textContent).toBe('1 contact'));
  });
});
