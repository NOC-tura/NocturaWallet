// @vitest-environment happy-dom
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {renderApp} from './appHarness';
import {CONTACTS_KEY} from '../../background/contacts';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {sendingReader} from './harness';
import {fromBook} from '../addressBook';
import {SEND_TEXT} from '../screens/Send';
import {REVIEW_TEXT} from '../screens/Review';
import {CONFIRM_TEXT} from '../screens/Confirm';

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

// Spec §1.4 (review M4): #12 → #15 pick → #12 holding the picked address, exactly as a paste.
describe('#12 → #15 pick → #12 (the hand-back)', () => {
  const BINANCE_LOOKALIKE = 'H4qZoWSv5iyeysmHzYnVfqVBtSfoJTZQJ33YtjAXm2N1';
  async function toPick(asked: unknown[]) {
    await renderApp({
      before: async ext => ext.local.set(CONTACTS_KEY, [{address: BINANCE_LOOKALIKE, name: 'Binance'}]),
      spy: m => void ((m as {type: string}).type === 'wallet.recipientInfo' && asked.push(m)),
    });
    fireEvent.click(await screen.findByRole('button', {name: /^Send$/}));
    fireEvent.change(screen.getByLabelText('Amount'), {target: {value: '0.5'}});
    fireEvent.click(screen.getByRole('button', {name: 'Address book'}));
    await screen.findByText('Address book', {selector: '.top-bar .title'});
  }

  it('the pick row shows the full address and O72; the pick puts the address in #12’s field, keeps the amount, and asks recipientInfo for it', async () => {
    const asked: unknown[] = [];
    await toPick(asked);
    const row = (await screen.findByText('Binance')).closest('button') as HTMLButtonElement;
    expect([...row.querySelectorAll('.addr-groups > span')].map(s => s.textContent)).toEqual(BINANCE_LOOKALIKE.match(/.{1,4}/g));
    expect(within(row).getByText('You have never sent to this address.')).toBeTruthy();
    fireEvent.click(row);
    await screen.findByText('Send', {selector: '.title'});
    expect((screen.getByLabelText('Recipient', {exact: true}) as HTMLInputElement).value).toBe(BINANCE_LOOKALIKE);
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('0.5');
    await waitFor(() => expect(asked).toEqual([expect.objectContaining({type: 'wallet.recipientInfo', recipient: BINANCE_LOOKALIKE})]));
    // Exactly as a paste of a never-sent address: state 6, and the contact label above it.
    expect(await screen.findByText('From your address book: Binance')).toBeTruthy();
    expect(screen.getByText('Never sent here before', {exact: false})).toBeTruthy();
    expect(screen.getByText('First-time recipient')).toBeTruthy();
    // The stack is [#11, #12]: Back from #12 is #11, not #15.
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByText('TOKENS')).toBeTruthy();
  });

  it('Back from #15 without a pick returns to #12 with the draft untouched', async () => {
    await toPick([]);
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    await screen.findByText('Send', {selector: '.title'});
    expect((screen.getByLabelText('Recipient', {exact: true}) as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('0.5');
  });
});

// The threat model (address poisoning, §6.3, D19): the user has paid PAID; a look-alike — the same first four and last
// four characters — sits in the book under the paid address's friendly name. Picked, it is still a stranger everywhere:
// #12's first-time banner and "Never sent here before" stay beside the label, the full address shows in groups of four,
// the CTA predicts the re-authentication, and the engine's own answer (#19 → #20) carries `first-send` and the proof line.
describe('#12 → #15 pick of a look-alike (address poisoning)', () => {
  const PAID = 'H4qZoWSv5iyeysmHzYnVfqVBtSfoJTZQJ33YtjAXm2N1';
  const LOOKALIKE: string = 'H4qZ7Lp2Wc9tKqRbV3mXnYdE8sFgUhJk2PzT6vB4m2N1';

  it('the label never hides the first-send warning, and the re-authentication is still required', async () => {
    expect([LOOKALIKE.slice(0, 4), LOOKALIKE.slice(-4), LOOKALIKE === PAID]).toEqual([PAID.slice(0, 4), PAID.slice(-4), false]);
    const sent: string[] = [];
    const w = await renderApp({
      reader: sendingReader(),
      // The background's clock is the real one (as sendFlow's): #20's quote is fresh when it is tapped.
      deps: {now: () => Date.now()},
      spy: m => void sent.push((m as {type: string}).type),
      before: async ext => {
        await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: PAID, at: Date.now() - 86_400_000}]);
        await ext.local.set(CONTACTS_KEY, [{address: LOOKALIKE, name: 'Binance'}]);
      },
    });
    // Positive control: the paid address IS known, so "never sent" below is about the look-alike, not the setup.
    const paid = await w.engine.recipientInfo(ACCOUNT.publicKey, PAID);
    expect(paid.ok ? paid.data.known : null).toBe(true);
    fireEvent.click(await screen.findByRole('button', {name: /^Send$/}));
    fireEvent.change(screen.getByLabelText('Amount'), {target: {value: '0.01'}});
    fireEvent.click(screen.getByRole('button', {name: 'Address book'}));
    fireEvent.click((await screen.findByText('Binance')).closest('button') as HTMLButtonElement);
    await screen.findByText('Send', {selector: '.title'});
    expect((screen.getByLabelText('Recipient', {exact: true}) as HTMLInputElement).value).toBe(LOOKALIKE);
    // #12, exactly as a paste of a never-sent address: the label AND every warning.
    expect(await screen.findByText(fromBook('Binance'))).toBeTruthy();
    expect(screen.getByText(SEND_TEXT.neverSent, {exact: false})).toBeTruthy();
    expect(screen.getByText(SEND_TEXT.firstTitle)).toBeTruthy();
    expect(screen.getByText(SEND_TEXT.firstLine)).toBeTruthy();
    expect([...document.querySelectorAll('.app-send-addr .addr-groups > span')].map(s => s.textContent)).toEqual(LOOKALIKE.match(/.{1,4}/g));
    const cta = document.querySelector('.sticky-bar button') as HTMLButtonElement;
    expect(cta.textContent).toContain(SEND_TEXT.reviewUnlock);
    // The engine decides: #19 prepares, and the prepared send carries `first-send`; #20 says the proof is needed.
    fireEvent.click(cta);
    fireEvent.click(await screen.findByRole('button', {name: REVIEW_TEXT.continue}));
    expect(await screen.findByText(CONFIRM_TEXT.firstTitle)).toBeTruthy();
    expect(screen.getByText(CONFIRM_TEXT.opensTab)).toBeTruthy();
    const held = await w.engine.preparedFor(ACCOUNT.publicKey);
    expect(held.ok && held.data !== null ? [held.data.intent.recipient, held.data.reauth?.reasons] : null).toEqual([LOOKALIKE, expect.arrayContaining(['first-send'])]);
    // The tap opens #10 for the proof; nothing is sent.
    fireEvent.click(await screen.findByRole('button', {name: /^Send 0\.0100 SOL$/}));
    const challenge = held.ok && held.data !== null ? held.data.reauth?.challengeId : 'none';
    await waitFor(() => expect(w.platform.opened).toEqual([`unlock.html?mode=reauth&challenge=${challenge}`]));
    expect(sent).not.toContain('wallet.send');
  });
});
