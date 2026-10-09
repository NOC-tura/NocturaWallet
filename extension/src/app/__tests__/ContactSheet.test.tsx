// @vitest-environment happy-dom
import {useState} from 'react';
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {base58} from '@scure/base';
import {ContactSheet, CONTACT_TEXT, type ContactSheetMode} from '../ui/ContactSheet';
import {renderInWallet} from './harness';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {CONTACTS_KEY} from '../../background/contacts';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {lock} from '../../background/autolock';
import type {Token} from '../engine';
import {LockedButton} from '../ui/LockedButton';

// Pre-flight G3: "Delete contact" opens the confirm, so rule 6 makes it a LockedButton. Its second press is invisible
// (the content swaps and the button unmounts at once), so the lock is pinned by what renders it: the real LockedButton,
// passed through a spy that only records its props.
vi.mock('../ui/LockedButton', async original => {
  const real = await original<typeof import('../ui/LockedButton')>();
  return {...real, LockedButton: vi.fn(real.LockedButton)};
});

// B1b-2b §6.2 (D20, C12, C18, C19; review H3): the contact sheet — every state, against the real background.
const SELECTORS = selectorsOf(UI_SHEETS);
const SENDER = 'H4qZoWSv5iyeysmHzYnVfqVBtSfoJTZQJ33YtjAXm2N1';
const OTHER = '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm';
const addr = (n: number): string => base58.encode(Uint8Array.from({length: 32}, (_, j) => (j === 0 ? n + 1 : 7)));
const groupsOf = (a: string) => a.match(/.{1,4}/g) ?? [];
const shownGroups = () => [...document.querySelectorAll('.app-contact-addr .addr-groups > span')].map(s => s.textContent);
const nameField = () => document.getElementById('contact-name') as HTMLInputElement;
const save = () => screen.getByRole('button', {name: /^Save/});

type Over = {mode?: ContactSheetMode; received?: {token: Token | null; amount: bigint | null}; onSaved?: (c: {address: string; name: string}) => void; onDeleted?: (a: string) => void; onClose?: () => void};
function sheet(o: Over = {}) {
  return <ContactSheet mode={o.mode ?? {kind: 'add', address: SENDER}} received={o.received} onSaved={o.onSaved ?? (() => undefined)} onDeleted={o.onDeleted} onClose={o.onClose ?? (() => undefined)} />;
}

describe('the contact sheet: add · prefilled', () => {
  it('title, the full address read-only in groups of four, Name focused, Save and Cancel; never sent → O72', async () => {
    await renderInWallet(sheet());
    expect(screen.getByRole('dialog', {name: 'Add contact'})).toBeTruthy();
    expect(screen.getByText('Address')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(shownGroups()).toEqual(groupsOf(SENDER));
    expect(document.getElementById('contact-address')).toBeNull();
    expect(document.activeElement).toBe(nameField());
    expect(nameField().maxLength).toBe(32);
    expect(await screen.findByText('You have never sent to this address.')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Save'})).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeTruthy();
    expect(screen.queryByText('Delete contact')).toBeNull();
    // The tall panel (the address, its warnings, a field and the buttons fit at 412 × 600; visual pass).
    expect(document.querySelector('.s8-sheet')?.className).toBe('s8-sheet app-sheet-tall');
    expect(unstyledClasses(document.querySelector('.s8-sheet')!, SELECTORS)).toEqual([]);
  });

  // Fail closed (rev 3, L3's spirit): until wallet.recipientInfo answers, the line shows (the #27c half — O77, the dust
  // banner and "Save anyway" before the answer — is the next test). Silence never reads as "known".
  it('fail closed: while recipientInfo has not answered, O72 shows; it goes once known', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => {
      release = r;
    });
    const hold = {gate: (m: unknown) => ((m as {type: string}).type === 'wallet.recipientInfo' ? held : undefined)};
    await renderInWallet(sheet(), {...hold, before: ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: SENDER, at: 1}])});
    expect(screen.getByText('You have never sent to this address.')).toBeTruthy();
    release();
    // Known once it answers: the line goes.
    await waitFor(() => expect(screen.queryByText('You have never sent to this address.')).toBeNull());
  });

  it('fail closed from #27c: before the answer, O77, the dust banner and "Save anyway" for a dust transfer', async () => {
    const held = new Promise<void>(() => undefined);
    await renderInWallet(sheet({received: {token: 'USDC', amount: 1n}}), {gate: m => ((m as {type: string}).type === 'wallet.recipientInfo' ? held : undefined)});
    expect(screen.getByText('You have never sent to this address — it only sent to you.')).toBeTruthy();
    expect(document.querySelector('.banner.danger')).not.toBeNull();
    expect(save().textContent).toBe('Save anyway');
  });

  it('an address this wallet sent to: no never-sent line once recipientInfo answers known (positive control)', async () => {
    await renderInWallet(sheet(), {before: ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: SENDER, at: 1}])});
    await waitFor(() => expect(screen.queryByText('You have never sent to this address.')).toBeNull());
    expect(shownGroups()).toEqual(groupsOf(SENDER));
  });

  it('Save stores the trimmed name and hands the contact back', async () => {
    const onSaved = vi.fn();
    const w = await renderInWallet(sheet({onSaved}));
    fireEvent.change(nameField(), {target: {value: '  Supplier  '}});
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({address: SENDER, name: 'Supplier'}, 'add'));
    expect(await w.ext.local.get(CONTACTS_KEY)).toEqual([{address: SENDER, name: 'Supplier'}]);
  });

  it('Cancel and Esc close without saving', async () => {
    const onClose = vi.fn();
    const w = await renderInWallet(sheet({onClose}));
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(await w.ext.local.get(CONTACTS_KEY)).toBeUndefined();
  });
});

describe('the contact sheet from #27c "Save sender" (review H3, C18)', () => {
  it('only sent to you: O77 in place of O72, no banner, a plain Save', async () => {
    await renderInWallet(sheet({received: {token: 'USDC', amount: 250_000_000n}}));
    expect(await screen.findByText('You have never sent to this address — it only sent to you.')).toBeTruthy();
    expect(screen.queryByText('You have never sent to this address.')).toBeNull();
    expect(document.querySelector('.banner.danger')).toBeNull();
    expect(save().textContent).toBe('Save');
  });

  it.each([
    ['USDC', 9_999n],
    ['SOL', 999_999n],
    ['NOC', 999_999_999n],
    ['USDT', null],
    [null, 5_000_000_000n],
  ] as const)('dust (%s %s): the danger banner O78 above Name, O77, and "Save anyway" — saving is not refused', async (token, amount) => {
    const onSaved = vi.fn();
    await renderInWallet(sheet({received: {token, amount}, onSaved}));
    const banner = document.querySelector('.banner.danger');
    expect(banner?.textContent).toBe(CONTACT_TEXT.dust);
    expect(banner?.compareDocumentPosition(nameField()) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(await screen.findByText('You have never sent to this address — it only sent to you.')).toBeTruthy();
    expect(save().textContent).toBe('Save anyway');
    fireEvent.change(nameField(), {target: {value: 'Binance'}});
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({address: SENDER, name: 'Binance'}, 'add'));
    expect(unstyledClasses(document.querySelector('.s8-sheet')!, SELECTORS)).toEqual([]);
  });

  it('the floor itself is not dust: USDC 10 000 base units → no banner, a plain Save', async () => {
    await renderInWallet(sheet({received: {token: 'USDC', amount: 10_000n}}));
    await screen.findByText('You have never sent to this address — it only sent to you.');
    expect(document.querySelector('.banner.danger')).toBeNull();
    expect(save().textContent).toBe('Save');
  });

  it('a sender this wallet has sent to: no line, no banner, even for dust', async () => {
    await renderInWallet(sheet({received: {token: 'USDC', amount: 1n}}), {before: ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: SENDER, at: 1}])});
    await waitFor(() => expect(document.querySelector('.banner.danger')).toBeNull());
    expect(screen.queryByText(/You have never sent/)).toBeNull();
    expect(save().textContent).toBe('Save');
  });
});

describe('the contact sheet: add · empty (#15’s +)', () => {
  it('an address input with Paste; an invalid address says O86 and Save is disabled; a valid one shows its groups and O72; the name comes pre-filled', async () => {
    await renderInWallet(sheet({mode: {kind: 'add', address: null, name: 'mark'}}));
    const input = document.getElementById('contact-address') as HTMLInputElement;
    expect(input.placeholder).toBe('Solana address');
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole('button', {name: 'Paste'})).toBeTruthy();
    expect(nameField().value).toBe('mark');
    fireEvent.change(input, {target: {value: 'not an address'}});
    expect(screen.getByText('That is not a Solana address.')).toBeTruthy();
    expect((save() as HTMLButtonElement).disabled).toBe(true);
    expect(shownGroups()).toEqual([]);
    fireEvent.change(input, {target: {value: ` ${OTHER} `}});
    expect(screen.queryByText('That is not a Solana address.')).toBeNull();
    expect(shownGroups()).toEqual(groupsOf(OTHER));
    expect(await screen.findByText('You have never sent to this address.')).toBeTruthy();
    expect((save() as HTMLButtonElement).disabled).toBe(false);
    expect(unstyledClasses(document.querySelector('.s8-sheet')!, SELECTORS)).toEqual([]);
  });

  it('Paste fills the address on the gesture; a refused clipboard says how to paste instead', async () => {
    await renderInWallet(sheet({mode: {kind: 'add', address: null}}));
    Object.defineProperty(navigator, 'clipboard', {value: {readText: async () => ` ${OTHER}\n`}, configurable: true});
    fireEvent.click(screen.getByRole('button', {name: 'Paste'}));
    await waitFor(() => expect((document.getElementById('contact-address') as HTMLInputElement).value).toBe(OTHER));
    fireEvent.change(document.getElementById('contact-address')!, {target: {value: ''}});
    Object.defineProperty(navigator, 'clipboard', {value: {readText: async () => Promise.reject(new Error('NotAllowedError'))}, configurable: true});
    fireEvent.click(screen.getByRole('button', {name: 'Paste'}));
    expect(await screen.findByText('Paste with Ctrl+V (⌘V on a Mac).')).toBeTruthy();
  });
});

describe('the contact sheet: edit and delete', () => {
  const saved = (ext: {local: {set(k: string, v: unknown): Promise<void>}}) => ext.local.set(CONTACTS_KEY, [{address: SENDER, name: 'Supplier'}]);

  it('edit: "Edit contact", the address read-only, the name pre-filled, Save renames in place; "Delete contact"', async () => {
    const onSaved = vi.fn();
    const w = await renderInWallet(sheet({mode: {kind: 'edit', address: SENDER, name: 'Supplier'}, onSaved}), {before: saved});
    expect(screen.getByRole('dialog', {name: 'Edit contact'})).toBeTruthy();
    expect(shownGroups()).toEqual(groupsOf(SENDER));
    expect(nameField().value).toBe('Supplier');
    expect(screen.getByRole('button', {name: 'Delete contact'}).className).toBe('btn btn-tertiary noc-danger');
    fireEvent.change(nameField(), {target: {value: 'Supplier GmbH'}});
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({address: SENDER, name: 'Supplier GmbH'}, 'edit'));
    expect(await w.ext.local.get(CONTACTS_KEY)).toEqual([{address: SENDER, name: 'Supplier GmbH'}]);
  });

  it('delete confirm: "Delete this contact?" — Keep goes back; Delete removes it and closes', async () => {
    const onDeleted = vi.fn();
    const onClose = vi.fn();
    const w = await renderInWallet(sheet({mode: {kind: 'edit', address: SENDER, name: 'Supplier'}, onDeleted, onClose}), {before: saved});
    fireEvent.click(screen.getByRole('button', {name: 'Delete contact'}));
    expect(screen.getByText('Delete this contact?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Keep'}));
    expect(nameField().value).toBe('Supplier');
    fireEvent.click(screen.getByRole('button', {name: 'Delete contact'}));
    expect(unstyledClasses(document.querySelector('.s8-sheet')!, SELECTORS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onDeleted).toHaveBeenCalledWith(SENDER);
    expect(await w.ext.local.get(CONTACTS_KEY)).toEqual([]);
  });
});

describe('the contact sheet: errors', () => {
  it('duplicate-name (C19): "binance" beside a saved "Binance" → O85, nothing stored', async () => {
    const onSaved = vi.fn();
    const w = await renderInWallet(sheet({onSaved}), {before: ext => ext.local.set(CONTACTS_KEY, [{address: OTHER, name: 'Binance'}])});
    fireEvent.change(nameField(), {target: {value: 'binance'}});
    fireEvent.click(save());
    expect(await screen.findByText('Another contact already has this name.')).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(await w.ext.local.get(CONTACTS_KEY)).toEqual([{address: OTHER, name: 'Binance'}]);
  });

  it.each(['', '   ', 'Mo\u200Bm', 'a\u202eb'])('a name cleanName refuses (%j) → 2a’s name line, nothing sent', async bad => {
    const sent: string[] = [];
    await renderInWallet(sheet(), {gate: m => void sent.push((m as {type: string}).type)});
    fireEvent.change(nameField(), {target: {value: bad}});
    fireEvent.click(save());
    expect(await screen.findByText('Names are 1 to 32 characters, without control characters.')).toBeTruthy();
    expect(sent).not.toContain('contacts.set');
  });

  it('full: a new address with 200 saved → O87', async () => {
    await renderInWallet(sheet(), {before: ext => ext.local.set(CONTACTS_KEY, Array.from({length: 200}, (_, i) => ({address: addr(i), name: `C${i}`})))});
    fireEvent.change(nameField(), {target: {value: 'One more'}});
    fireEvent.click(save());
    expect(await screen.findByText('The address book is full (200 contacts). Delete one to add another.')).toBeTruthy();
  });

  it('a failed save says so (2a) and stays open', async () => {
    const onSaved = vi.fn();
    await renderInWallet(sheet({onSaved}), {
      gate: m => {
        if ((m as {type: string}).type === 'contacts.set') throw new Error('worker restarting');
      },
    });
    fireEvent.change(nameField(), {target: {value: 'Supplier'}});
    fireEvent.click(save());
    expect(await screen.findByText('Something went wrong. Try again.')).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', {name: 'Add contact'})).toBeTruthy();
  });

  // Pre-flight R2: the background answers `locked`; the sheet stores nothing (v1_contacts stays unset), hands nothing
  // back, and re-reads the wallet (reload → a wallet.state read after the contacts.set).
  it('locked mid-save: v1_contacts stays unset, nothing handed back, the wallet re-read', async () => {
    const onSaved = vi.fn();
    const sent: string[] = [];
    let ext: Parameters<typeof lock>[0] | null = null;
    const w = await renderInWallet(sheet({onSaved}), {
      before: async e => {
        ext = e;
      },
      gate: async m => {
        const type = (m as {type: string}).type;
        sent.push(type);
        if (type === 'contacts.set' && ext !== null) await lock(ext);
      },
    });
    // recipientInfo answers (unlocked) first, so the only wallet.state read after the set is the save's own reload.
    await screen.findByText(CONTACT_TEXT.neverSent);
    await waitFor(() => expect(sent).toContain('wallet.recipientInfo'));
    await act(async () => new Promise(r => setTimeout(r, 50)));
    fireEvent.change(nameField(), {target: {value: 'Supplier'}});
    fireEvent.click(save());
    await waitFor(() => expect(sent).toContain('contacts.set'));
    await waitFor(() => expect(sent.lastIndexOf('wallet.state')).toBeGreaterThan(sent.indexOf('contacts.set')));
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(onSaved).not.toHaveBeenCalled();
    expect(await w.ext.local.get(CONTACTS_KEY)).toBeUndefined();
  });
});

describe('the contact sheet: rule 6 and late answers', () => {
  it('rule 6: a second Save inside 500 ms sends nothing more', async () => {
    const sets: unknown[] = [];
    await renderInWallet(sheet(), {gate: m => void ((m as {type: string}).type === 'contacts.set' && sets.push(m))});
    fireEvent.change(nameField(), {target: {value: 'Supplier'}});
    const button = save();
    fireEvent.click(button);
    (button as HTMLButtonElement).disabled = false;
    fireEvent.click(button);
    await waitFor(() => expect(sets).toHaveLength(1));
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(sets).toHaveLength(1);
  });

  it('rule 6: a second Delete inside 500 ms sends nothing more', async () => {
    const removes: unknown[] = [];
    await renderInWallet(sheet({mode: {kind: 'edit', address: SENDER, name: 'Supplier'}}), {
      before: ext => ext.local.set(CONTACTS_KEY, [{address: SENDER, name: 'Supplier'}]),
      gate: m => void ((m as {type: string}).type === 'contacts.remove' && removes.push(m)),
    });
    fireEvent.click(screen.getByRole('button', {name: 'Delete contact'}));
    const del = screen.getByRole('button', {name: 'Delete'});
    fireEvent.click(del);
    (del as HTMLButtonElement).disabled = false;
    fireEvent.click(del);
    await waitFor(() => expect(removes).toHaveLength(1));
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(removes).toHaveLength(1);
  });

  it('closed while a save was out: the answer calls nothing', async () => {
    const onSaved = vi.fn();
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => {
      release = r;
    });
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            hide
          </button>
          {open ? sheet({onSaved}) : null}
        </>
      );
    }
    await renderInWallet(<Host />, {gate: m => ((m as {type: string}).type === 'contacts.set' ? held : undefined)});
    fireEvent.change(nameField(), {target: {value: 'Supplier'}});
    fireEvent.click(save());
    fireEvent.click(screen.getByRole('button', {name: 'hide'}));
    release();
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(onSaved).not.toHaveBeenCalled();
  });

  // Pre-flight G1 (a): the alive check after contacts.remove.
  it('hidden while a delete was out: the answer calls nothing and draws nothing', async () => {
    const onDeleted = vi.fn();
    const onClose = vi.fn();
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => {
      release = r;
    });
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            hide
          </button>
          {open ? sheet({mode: {kind: 'edit', address: SENDER, name: 'Supplier'}, onDeleted, onClose}) : null}
        </>
      );
    }
    const w = await renderInWallet(<Host />, {
      before: ext => ext.local.set(CONTACTS_KEY, [{address: SENDER, name: 'Supplier'}]),
      gate: m => ((m as {type: string}).type === 'contacts.remove' ? held : undefined),
    });
    fireEvent.click(screen.getByRole('button', {name: 'Delete contact'}));
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    fireEvent.click(screen.getByRole('button', {name: 'hide'}));
    expect(screen.queryByRole('dialog')).toBeNull();
    release();
    // The remove itself lands (the background does it); the gone sheet only stays silent.
    await waitFor(async () => expect(await w.ext.local.get(CONTACTS_KEY)).toEqual([]));
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(CONTACT_TEXT.failed)).toBeNull();
  });

  // Pre-flight G1 (b): a late answer for an earlier address. A was sent to (known), B never was; A's answer is held
  // until after B's has landed, then released — it must not hide O72 for B. (Fix round 1, M3: pinned by the answer's
  // key — an answer stands only for the account|address it was asked for.)
  it('a stale known:true for an EARLIER address does not hide O72 for the current one', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => {
      release = r;
    });
    const asked: string[] = [];
    await renderInWallet(sheet({mode: {kind: 'add', address: null}}), {
      before: ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: SENDER, at: 1}]),
      gate: m => {
        const msg = m as {type: string; recipient?: string};
        if (msg.type !== 'wallet.recipientInfo') return undefined;
        asked.push(msg.recipient ?? '');
        return msg.recipient === SENDER ? held : undefined;
      },
    });
    const input = document.getElementById('contact-address') as HTMLInputElement;
    fireEvent.change(input, {target: {value: SENDER}});
    await waitFor(() => expect(asked).toContain(SENDER));
    fireEvent.change(input, {target: {value: OTHER}});
    await waitFor(() => expect(asked).toContain(OTHER));
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(screen.getByText(CONTACT_TEXT.neverSent)).toBeTruthy();
    await act(async () => release());
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(shownGroups()).toEqual(groupsOf(OTHER));
    expect(screen.getByText(CONTACT_TEXT.neverSent)).toBeTruthy();
  });

  // Pre-flight G3 (rule 6): "Delete contact" is a LockedButton. A second press in the same frame, `disabled` lifted,
  // opens the confirm once; the second press is otherwise invisible (the button unmounts as the confirm swaps in), so
  // what renders "Delete contact" is asserted too.
  it('rule 6: "Delete contact" is a LockedButton — a same-frame second press, disabled lifted, opens the confirm once', async () => {
    vi.mocked(LockedButton).mockClear();
    await renderInWallet(sheet({mode: {kind: 'edit', address: SENDER, name: 'Supplier'}}), {before: ext => ext.local.set(CONTACTS_KEY, [{address: SENDER, name: 'Supplier'}])});
    const rendered = vi.mocked(LockedButton).mock.calls.map(([p]) => p.children);
    expect(rendered).toContain(CONTACT_TEXT.deleteContact);
    const del = screen.getByRole('button', {name: 'Delete contact'}) as HTMLButtonElement;
    act(() => {
      del.click();
      del.disabled = false;
      del.click();
    });
    expect(screen.getAllByText('Delete this contact?')).toHaveLength(1);
    expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Keep'}));
  });
});

// Review H1: the screen under a sheet re-renders on its clock (#20 every second, #15 and #27 every 30 s) and passes an
// inline onClose. The sheet's focus must survive those renders — never pulled back to data-autofocus — and Esc and the
// backdrop must still reach the latest onClose.
describe('the contact sheet under a re-rendering screen (review H1)', () => {
  function Ticking({mode, onClose}: {mode: ContactSheetMode; onClose: () => void}) {
    const [tick, setTick] = useState(0);
    return (
      <>
        <button type="button" onClick={() => setTick(t => t + 1)}>
          tick {tick}
        </button>
        <ContactSheet mode={mode} onSaved={() => undefined} onClose={() => onClose()} />
      </>
    );
  }
  const tick = (n = 3) => {
    for (let i = 0; i < n; i++) act(() => void (screen.getByText(/^tick /) as HTMLButtonElement).click());
  };

  it('add · empty: the caret stays in Name across renders (never moved back to the address field)', async () => {
    await renderInWallet(<Ticking mode={{kind: 'add', address: null}} onClose={() => undefined} />);
    fireEvent.change(document.getElementById('contact-address')!, {target: {value: OTHER}});
    nameField().focus();
    tick();
    expect(document.activeElement).toBe(nameField());
  });

  it('Cancel keeps the focus across renders', async () => {
    await renderInWallet(<Ticking mode={{kind: 'add', address: SENDER}} onClose={() => undefined} />);
    const cancel = screen.getByRole('button', {name: 'Cancel'});
    cancel.focus();
    tick();
    expect(document.activeElement).toBe(cancel);
  });

  it('after many renders, Esc and the backdrop still call the latest onClose', async () => {
    const onClose = vi.fn();
    await renderInWallet(<Ticking mode={{kind: 'add', address: SENDER}} onClose={onClose} />);
    tick(5);
    fireEvent.keyDown(document, {key: 'Escape'});
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

// Review M2: the delete confirm keeps the focus inside the sheet.
describe('the contact sheet: the focus through the delete confirm (review M2)', () => {
  it('"Delete contact" → the focus on Keep; Keep → back on "Delete contact"', async () => {
    await renderInWallet(sheet({mode: {kind: 'edit', address: SENDER, name: 'Supplier'}}), {before: ext => ext.local.set(CONTACTS_KEY, [{address: SENDER, name: 'Supplier'}])});
    fireEvent.click(screen.getByRole('button', {name: 'Delete contact'}));
    expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Keep'}));
    fireEvent.click(screen.getByRole('button', {name: 'Keep'}));
    expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Delete contact'}));
  });
});

// Review L1 (the sheet half): #15's search query, when it is an address, seeds the address field.
describe('the contact sheet: add · empty seeded with an address (review L1)', () => {
  it('`typed` fills the address input; the name stays empty', async () => {
    await renderInWallet(sheet({mode: {kind: 'add', address: null, typed: OTHER}}));
    expect((document.getElementById('contact-address') as HTMLInputElement).value).toBe(OTHER);
    expect(nameField().value).toBe('');
    expect(shownGroups()).toEqual(groupsOf(OTHER));
  });
});

// Review fix round 1: the reviewer's probes P1–P5, adopted, and the M5 / M6 fixes.
describe('the contact sheet: review fix round 1', () => {
  const settle = () => act(async () => new Promise(r => setTimeout(r, 50)));

  // I2 / M3: A is known; B's read fails. B must not inherit A's answer.
  it('P1 a known A then a look-alike B whose read FAILS: O72 for B', async () => {
    await renderInWallet(sheet({mode: {kind: 'add', address: null}}), {
      before: ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: OTHER, at: 1}]),
      gate: m => {
        const x = m as {type: string; recipient?: string};
        if (x.type === 'wallet.recipientInfo' && x.recipient === SENDER) throw new Error('worker restarting');
      },
    });
    fireEvent.change(document.getElementById('contact-address')!, {target: {value: OTHER}});
    await waitFor(() => expect(screen.queryByText(CONTACT_TEXT.neverSent)).toBeNull());
    fireEvent.change(document.getElementById('contact-address')!, {target: {value: SENDER}});
    // In the same render as the change — no frame of A's answer (M3).
    expect(screen.getByText(CONTACT_TEXT.neverSent)).toBeTruthy();
    await settle();
    expect(shownGroups()).toEqual(groupsOf(SENDER));
    expect(screen.getByText(CONTACT_TEXT.neverSent)).toBeTruthy();
  });

  // I1: a failed read stores nothing — fail closed, even for an address this wallet did send to.
  it('P2 a failed recipientInfo read for a known address keeps O77, the dust banner and "Save anyway" (fail closed)', async () => {
    await renderInWallet(sheet({received: {token: 'USDC', amount: 1n}}), {
      before: ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: SENDER, at: 1}]),
      gate: m => {
        if ((m as {type: string}).type === 'wallet.recipientInfo') throw new Error('worker restarting');
      },
    });
    await settle();
    expect(screen.getByText(CONTACT_TEXT.onlySentToYou)).toBeTruthy();
    expect(document.querySelector('.banner.danger')).not.toBeNull();
    expect(save().textContent).toBe('Save anyway');
  });

  // M4: Esc reaches the latest onClose, not the closure of the first render.
  it('P3 Esc reaches the LATEST onClose (not the first closure)', async () => {
    const calls: number[] = [];
    function Ticking({mode}: {mode: ContactSheetMode}) {
      const [tick, setTick] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setTick(t => t + 1)}>
            tick {tick}
          </button>
          <ContactSheet mode={mode} onSaved={() => undefined} onClose={() => calls.push(tick)} />
        </>
      );
    }
    await renderInWallet(<Ticking mode={{kind: 'add', address: SENDER}} />);
    for (let i = 0; i < 3; i++) act(() => void (screen.getByText(/^tick /) as HTMLButtonElement).click());
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(calls).toEqual([3]);
  });

  it('P4 duplicate-name in EDIT mode is surfaced (a rename to another contact’s name)', async () => {
    await renderInWallet(sheet({mode: {kind: 'edit', address: SENDER, name: 'Supplier'}}), {
      before: ext =>
        ext.local.set(CONTACTS_KEY, [
          {address: SENDER, name: 'Supplier'},
          {address: OTHER, name: 'Binance'},
        ]),
    });
    fireEvent.change(nameField(), {target: {value: 'BINANCE'}});
    fireEvent.click(save());
    expect(await screen.findByText(CONTACT_TEXT.duplicateName)).toBeTruthy();
  });

  it('P5 prefilled: the address is shown complete and is not editable (the only input is Name)', async () => {
    await renderInWallet(sheet());
    expect(shownGroups().join('')).toBe(SENDER);
    expect(document.querySelectorAll('input')).toHaveLength(1);
    expect(document.querySelector('input')).toBe(nameField());
  });

  // M5: the paste's own generation — a clipboard read that lands after the user typed does not overwrite the field.
  it('M5 a clipboard read that lands after the user typed leaves the typed address', async () => {
    let give: (t: string) => void = () => undefined;
    await renderInWallet(sheet({mode: {kind: 'add', address: null}}));
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        readText: () =>
          new Promise<string>(r => {
            give = r;
          }),
      },
      configurable: true,
    });
    fireEvent.click(screen.getByRole('button', {name: 'Paste'}));
    const input = document.getElementById('contact-address') as HTMLInputElement;
    fireEvent.change(input, {target: {value: OTHER}});
    await act(async () => give(SENDER));
    await settle();
    expect(input.value).toBe(OTHER);
    expect(shownGroups()).toEqual(groupsOf(OTHER));
  });

  // M6: a failed delete's message is the confirm's; Keep goes back to a clean edit sheet.
  it('M6 Keep clears a failed delete’s message', async () => {
    await renderInWallet(sheet({mode: {kind: 'edit', address: SENDER, name: 'Supplier'}}), {
      before: ext => ext.local.set(CONTACTS_KEY, [{address: SENDER, name: 'Supplier'}]),
      gate: m => {
        if ((m as {type: string}).type === 'contacts.remove') throw new Error('worker restarting');
      },
    });
    fireEvent.click(screen.getByRole('button', {name: 'Delete contact'}));
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    expect(await screen.findByText(CONTACT_TEXT.failed)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Keep'}));
    expect(nameField().value).toBe('Supplier');
    expect(screen.queryByText(CONTACT_TEXT.failed)).toBeNull();
  });
});

// Task 7 review fix round 1 (I1): the sheet cannot be closed while a save or a delete is out — every close path is
// ignored (Cancel and Keep disabled) until the answer lands; after a failed answer it closes again.
describe('the contact sheet: no close while a save or delete is out (Task 7 fix round 1)', () => {
  const hold = (type: string) => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => {
      release = r;
    });
    return {release, gate: (m: unknown) => ((m as {type: string}).type === type ? held : undefined)};
  };
  const tryEveryClose = () => {
    fireEvent.keyDown(document, {key: 'Escape'});
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    for (const b of screen.getAllByRole('button', {name: 'Close'})) fireEvent.click(b);
  };

  it('save out: Esc, backdrop, grabber, ✕ and Cancel (disabled) do nothing; the answer hands the contact back', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const h = hold('contacts.set');
    await renderInWallet(sheet({onSaved, onClose}), {gate: h.gate});
    fireEvent.change(nameField(), {target: {value: 'Supplier'}});
    fireEvent.click(save());
    const cancel = screen.getByRole('button', {name: 'Cancel'}) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    cancel.disabled = false;
    fireEvent.click(cancel);
    tryEveryClose();
    await act(async () => new Promise(r => setTimeout(r, 20)));
    expect(onClose).not.toHaveBeenCalled();
    h.release();
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({address: SENDER, name: 'Supplier'}, 'add'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a failed save: the sheet closes again (Cancel enabled, Esc closes)', async () => {
    const onClose = vi.fn();
    await renderInWallet(sheet({onClose}), {
      gate: m => {
        if ((m as {type: string}).type === 'contacts.set') throw new Error('worker restarting');
      },
    });
    fireEvent.change(nameField(), {target: {value: 'Supplier'}});
    fireEvent.click(save());
    expect(await screen.findByText(CONTACT_TEXT.failed)).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Cancel'}) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('delete out: Esc, backdrop, grabber, ✕ and Keep (disabled) do nothing; the answer closes once', async () => {
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    const h = hold('contacts.remove');
    await renderInWallet(sheet({mode: {kind: 'edit', address: SENDER, name: 'Supplier'}, onClose, onDeleted}), {
      before: ext => ext.local.set(CONTACTS_KEY, [{address: SENDER, name: 'Supplier'}]),
      gate: h.gate,
    });
    fireEvent.click(screen.getByRole('button', {name: 'Delete contact'}));
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    const keep = screen.getByRole('button', {name: 'Keep'}) as HTMLButtonElement;
    expect(keep.disabled).toBe(true);
    tryEveryClose();
    await act(async () => new Promise(r => setTimeout(r, 20)));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(CONTACT_TEXT.deleteQuestion)).toBeTruthy();
    h.release();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onDeleted).toHaveBeenCalledWith(SENDER);
  });

  // Task 10 fix round 0b (C1): the focus stays in the sheet while a request disables the focused control.
  it('save out with the focus on Cancel: the dialog holds the focus; a failed answer gives it back to Cancel', async () => {
    let fail: () => void = () => undefined;
    const out = new Promise<void>((_, reject) => {
      fail = () => reject(new Error('worker restarting'));
    });
    await renderInWallet(sheet(), {gate: m => ((m as {type: string}).type === 'contacts.set' ? out : undefined)});
    fireEvent.change(nameField(), {target: {value: 'Supplier'}});
    const cancel = screen.getByRole('button', {name: 'Cancel'}) as HTMLButtonElement;
    cancel.focus();
    fireEvent.click(save());
    expect(cancel.disabled).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('dialog', {name: CONTACT_TEXT.addTitle})));
    fail();
    expect(await screen.findByText(CONTACT_TEXT.failed)).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(cancel));
  });

  it('delete out with the focus on Keep: the dialog holds the focus, Tab stays inside it', async () => {
    const h = hold('contacts.remove');
    await renderInWallet(sheet({mode: {kind: 'edit', address: SENDER, name: 'Supplier'}}), {
      before: ext => ext.local.set(CONTACTS_KEY, [{address: SENDER, name: 'Supplier'}]),
      gate: h.gate,
    });
    fireEvent.click(screen.getByRole('button', {name: 'Delete contact'}));
    const keep = screen.getByRole('button', {name: 'Keep'}) as HTMLButtonElement;
    expect(document.activeElement).toBe(keep);
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    expect(keep.disabled).toBe(true);
    const dialog = screen.getByRole('dialog', {name: CONTACT_TEXT.editTitle});
    await waitFor(() => expect(document.activeElement).toBe(dialog));
    fireEvent.keyDown(document, {key: 'Tab'});
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(dialog);
    h.release();
  });

  it('idle (positive control): Esc, the backdrop and ✕ each close', async () => {
    const onClose = vi.fn();
    await renderInWallet(sheet({onClose}));
    fireEvent.keyDown(document, {key: 'Escape'});
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    fireEvent.click(screen.getAllByRole('button', {name: 'Close'})[1]!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

// Final review I1: #15's add sheet (`add`, no address) reads the book again at Save. That read is an await like the others:
// `locked` re-reads the wallet and saves nothing; an answer after the sheet went calls nothing.
describe('the contact sheet: the re-read of the book at Save (final review I1)', () => {
  const typedAdd: ContactSheetMode = {kind: 'add', address: null};
  const fill = () => {
    fireEvent.change(document.getElementById('contact-address')!, {target: {value: OTHER}});
    fireEvent.change(nameField(), {target: {value: 'Mom'}});
  };

  it('the book given at open: a saved address typed in turns the sheet into its edit sheet; saving is an edit', async () => {
    const onSaved = vi.fn();
    const w = await renderInWallet(<ContactSheet mode={typedAdd} book={[{address: OTHER, name: 'Binance'}]} onSaved={onSaved} onClose={() => undefined} />, {
      before: ext => ext.local.set(CONTACTS_KEY, [{address: OTHER, name: 'Binance'}]),
    });
    fireEvent.change(nameField(), {target: {value: 'Mom'}});
    fireEvent.change(document.getElementById('contact-address')!, {target: {value: OTHER}});
    expect(await screen.findByRole('dialog', {name: 'Edit contact'})).toBeTruthy();
    expect(nameField().value).toBe('Binance');
    fireEvent.change(nameField(), {target: {value: 'Mom'}});
    fireEvent.click(save());
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({address: OTHER, name: 'Mom'}, 'edit'));
    expect(await w.ext.local.get(CONTACTS_KEY)).toEqual([{address: OTHER, name: 'Mom'}]);
  });

  it('locked at the re-read: nothing saved, nothing handed back, the wallet re-read', async () => {
    const onSaved = vi.fn();
    const sent: string[] = [];
    let ext: Parameters<typeof lock>[0] | null = null;
    const w = await renderInWallet(<ContactSheet mode={typedAdd} book={[]} onSaved={onSaved} onClose={() => undefined} />, {
      before: async e => {
        ext = e;
      },
      gate: async m => {
        const type = (m as {type: string}).type;
        sent.push(type);
        if (type === 'contacts.list' && ext !== null) await lock(ext);
      },
    });
    fill();
    await waitFor(() => expect(sent).toContain('wallet.recipientInfo'));
    await act(async () => new Promise(r => setTimeout(r, 50)));
    fireEvent.click(save());
    await waitFor(() => expect(sent).toContain('contacts.list'));
    await waitFor(() => expect(sent.lastIndexOf('wallet.state')).toBeGreaterThan(sent.indexOf('contacts.list')));
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(sent).not.toContain('contacts.set');
    expect(onSaved).not.toHaveBeenCalled();
    expect(await w.ext.local.get(CONTACTS_KEY)).toBeUndefined();
  });

  it('gone while the re-read was out: a late `locked` reloads nothing and nothing is saved', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => {
      release = r;
    });
    let gone = false;
    const after: string[] = [];
    let ext: Parameters<typeof lock>[0] | null = null;
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(false)}>
            hide
          </button>
          {open ? <ContactSheet mode={typedAdd} book={[]} onSaved={() => undefined} onClose={() => undefined} /> : null}
        </>
      );
    }
    await renderInWallet(<Host />, {
      before: async e => {
        ext = e;
      },
      gate: async m => {
        const type = (m as {type: string}).type;
        if (gone) after.push(type);
        if (type === 'contacts.list') await held;
      },
    });
    fill();
    await act(async () => new Promise(r => setTimeout(r, 50)));
    fireEvent.click(save());
    await act(async () => new Promise(r => setTimeout(r, 20)));
    await lock(ext!);
    gone = true;
    fireEvent.click(screen.getByRole('button', {name: 'hide'}));
    release();
    await act(async () => new Promise(r => setTimeout(r, 50)));
    expect(after).toEqual([]);
  });
});
