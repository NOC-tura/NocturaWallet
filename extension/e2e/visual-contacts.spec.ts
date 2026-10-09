import {test, expect, type Locator, type Page, type Worker} from '@playwright/test';
import {base58} from '@scure/base';
import {contained, launchPopup, SAVINGS, seedUnlockedWallet, type Harness} from './popupHarness';
import {ACCOUNT, RECIPIENT, realWallet} from './sendHelpers';
import {COUNTERPARTY, receivedUsdc, sentSol, sig} from './historyFixtures';
import {shot} from './visualTab';

// Spec B1b-2b §8.4, plan 2: every state of §6 the real extension can be put in, in the popup at 412 × 600, saved for
// the opus-tier review against index.html (#15 ix:7372-7552, its DS class map ix:7507-7516; #12 ix:6640-6700; #20
// ix:9343-9350; #27 ix:12143, 12272, 12350; #31 ix:13552; #37 ix:14981) with §8.4's checklist. Not a pixel diff. Every
// state asserts its own copy first; a screen state must be in the viewport and clear of the pinned bars (`pop`), a
// sheet state inside the sheet's panel (`sheetShot`). The contact sheet is undrawn (D20): its shots are reviewed
// against #43's sheet. Not shot (fault injection only, covered by the component tests): #15 `load failed` (O74), the
// sheet's `failed` line.
declare const chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}; storage: {local: {set(o: object): Promise<void>}}};
const DAY = 86_400_000;
/** The n-th distinct, canonical address (32 bytes, the first byte n + 1). */
const addr = (n: number): string => base58.encode(Uint8Array.from({length: 32}, (_, j) => (j === 0 ? n + 1 : 9)));
const set = (sw: Worker, o: object) => sw.evaluate(x => chrome.storage.local.set(x), o);

/** A popup shot clear of the pinned bars (B1b-2a plan 3's `seen()`, after visual-settings.spec.ts's `pop`). */
async function pop(page: Page, name: string, visible: Locator, ready?: Locator): Promise<void> {
  const bars = page.locator('main.app-content > .screen > .top-bar, main.app-content > .screen > .sticky-bar, nav.app-tab-bar');
  const under = async (): Promise<string | null> => {
    const box = await visible.boundingBox();
    if (box === null) return 'no box';
    const el = await visible.elementHandle();
    for (const bar of await bars.all()) {
      const b = await bar.boundingBox();
      if (b === null || (await bar.evaluate((e, x) => e.contains(x), el))) continue;
      if (box.y < b.y + b.height && b.y < box.y + box.height) return await bar.evaluate(e => e.className);
    }
    return null;
  };
  // Below the fold (#31's Connections, #27's actions row) it is scrolled to first, as a person would; under a bar, to the middle.
  await visible.scrollIntoViewIfNeeded();
  if ((await under()) !== null) await visible.evaluate(e => e.scrollIntoView({block: 'center'}));
  await expect(visible).toBeInViewport();
  expect(await under(), `${name}: the state's element clear of the pinned bars`).toBeNull();
  await still(page, name, ready);
}
/**
 * The shot itself (Task 10): the pointer moved off the column first — the last click left it over the next state's
 * button (#15's "Add first contact", the sheet's Save, #20's Send drew hovered) — and `ready`, a LockedButton the state
 * shows enabled, awaited past its 500 ms floor (a shot inside it draws the button busy, which is not the state).
 */
async function still(page: Page, name: string, ready?: Locator): Promise<void> {
  await page.mouse.move(0, 0);
  await shot(page, name, {fullPage: false, ...(ready === undefined ? {} : {ready})});
}
/** A computed style in Chromium (happy-dom lacks `:focus-within` and the UA sheet). */
const css = (l: Locator, prop: string) => l.evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);
/** A token's computed value, as a colour the browser resolves (a probe element takes `color: var(--x)`). */
const token = (page: Page, name: string) =>
  page.evaluate(n => {
    const probe = document.createElement('span');
    probe.style.color = `var(${n})`;
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, name);
/**
 * Holds the popup's messages of one type (contacts.set / contacts.remove) until `release()`: the engine looks up
 * runtime.sendMessage on every call (src/ui/send.ts), so a wrapper installed now sees the next one. A request out is a
 * transient state; this keeps it on screen while it is asserted.
 */
async function holdMessages(page: Page, type: string): Promise<{release(): Promise<void>; held(): Promise<number>}> {
  await page.evaluate(t => {
    type Send = (m: unknown) => Promise<unknown>;
    const w = globalThis as unknown as {chrome: {runtime: {sendMessage: Send}}; __held: (() => void)[]; __real?: Send};
    // One wrapper at a time: a second hold replaces the first rather than wrapping it.
    w.__real ??= w.chrome.runtime.sendMessage.bind(w.chrome.runtime);
    const real = w.__real;
    w.__held = [];
    w.chrome.runtime.sendMessage = (m: unknown) =>
      (m as {type?: string}).type === t ? new Promise(r => w.__held.push(() => void real(m).then(r))) : real(m);
  }, type);
  return {
    held: () => page.evaluate(() => (globalThis as unknown as {__held: unknown[]}).__held.length),
    release: () => page.evaluate(() => (globalThis as unknown as {__held: (() => void)[]}).__held.splice(0).forEach(f => f())),
  };
}
/** Where the focus is: the active element's role/name and whether it is inside the open sheet. */
const focusAt = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return {tag: a?.tagName ?? null, role: a?.getAttribute('role') ?? null, text: (a?.textContent ?? '').trim(), label: a?.getAttribute('aria-label') ?? null, inSheet: a !== null && a.closest('.s8-sheet') !== null};
  });
/** A sheet shot: the state's element inside the sheet's panel and in the viewport (the panel scrolls its own body). */
async function sheetShot(page: Page, name: string, visible: Locator, ready?: Locator): Promise<void> {
  await visible.scrollIntoViewIfNeeded();
  await expect(visible).toBeInViewport();
  const panel = await page.locator('.s8-sheet').boundingBox();
  const box = await visible.boundingBox();
  expect(panel, `${name}: a sheet`).not.toBeNull();
  expect(box, `${name}: the element`).not.toBeNull();
  if (panel !== null && box !== null) {
    expect(box.y, `${name}: inside the panel`).toBeGreaterThanOrEqual(panel.y);
    expect(box.y + box.height, `${name}: inside the panel`).toBeLessThanOrEqual(panel.y + panel.height + 0.5);
  }
  await still(page, name, ready);
}
async function popup(h: Harness): Promise<Page> {
  const p = await h.openPopup();
  await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
  return p;
}
/** contacts.set as the UI sends it (a wallet tab; the wallet is unlocked). */
async function saveContacts(h: Harness, list: {address: string; name: string}[]): Promise<void> {
  const ui = await h.ctx.newPage();
  await ui.goto(`chrome-extension://${h.id}/wallet.html#/home`);
  // Oldest first: the book keeps the newest first.
  for (const c of [...list].reverse()) {
    const r = (await ui.evaluate(m => chrome.runtime.sendMessage(m), {type: 'contacts.set', ...c})) as {ok: boolean};
    expect(r.ok, c.name).toBe(true);
  }
  await ui.close();
}
const toBook = async (p: Page) => {
  await p.getByRole('button', {name: 'Settings'}).click();
  await p.locator('.s7-title', {hasText: 'Address book'}).click();
  await expect(p.locator('.s-abook .top-bar .title')).toHaveText('Address book');
};

test('visual: #31’s Address book row, #15’s states and the contact sheet (412 × 600)', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-vis-contacts-');
  try {
    await seedUnlockedWallet(h.sw);
    let p = await popup(h);
    await toBook(p);
    // 15 · empty (ix:7437-7461).
    await expect(p.getByText('No saved contacts yet')).toBeVisible();
    await expect(p.getByText("Or save one from a transaction's details.")).toBeVisible();
    await expect(p.getByRole('textbox', {name: 'Search contacts'})).toBeDisabled();
    // Task 10 fix: the design resets every margin (index.html:98 `* {margin: 0}`); the UA's h3/p margins had pushed the
    // heading and the line apart (the empty state's `gap` is the only spacing drawn, ix:7452-7456).
    for (const el of [p.locator('.s-abook .empty h3'), p.locator('.s-abook .empty p')]) {
      expect(await css(el, 'margin-top'), 'the empty state: no UA margin').toBe('0px');
      expect(await css(el, 'margin-bottom'), 'the empty state: no UA margin').toBe('0px');
    }
    // Task 10 fix: the "+" in "Add first contact" is the button's ink (ix:7455), not web's `.empty svg` --fg-tertiary.
    const first = p.getByRole('button', {name: 'Add first contact'});
    expect(await css(first.locator('svg'), 'color'), 'the + in the button ink').toBe(await css(first, 'color'));
    await pop(p, '15-empty', p.locator('.s-abook .empty'));
    // The sheet · add · empty, then a typed address that is not one (O86), then a valid one (groups + O72).
    await p.getByRole('button', {name: 'Add first contact'}).click();
    const sheet = p.getByRole('dialog', {name: 'Add contact'});
    await expect(sheet.getByPlaceholder('Solana address')).toBeFocused();
    await sheetShot(p, 'sheet-add-empty', sheet.getByRole('button', {name: 'Save', exact: true}));
    await sheet.getByLabel('Address').fill('7xKX0OIl');
    await expect(sheet.getByText('That is not a Solana address.')).toBeVisible();
    await sheetShot(p, 'sheet-bad-address', sheet.getByText('That is not a Solana address.'));
    await sheet.getByLabel('Address').fill(addr(1));
    await expect(sheet.getByText('You have never sent to this address.')).toBeVisible();
    await expect(sheet.locator('.app-contact-addr .addr-groups > span')).toHaveText(addr(1).match(/.{1,4}/g) ?? []);
    await sheet.getByLabel('Name').fill('Mo\u200Bm');
    await sheet.getByRole('button', {name: 'Save', exact: true}).click();
    await expect(sheet.getByText('Names are 1 to 32 characters, without control characters.')).toBeVisible();
    const save = sheet.getByRole('button', {name: 'Save', exact: true});
    await sheetShot(p, 'sheet-bad-name', sheet.getByText('Names are 1 to 32 characters, without control characters.'), save);
    await sheet.getByLabel('Name').fill('Marko · Mom');
    await sheetShot(p, 'sheet-add-typed-never-sent', sheet.getByText('You have never sent to this address.'), save);
    await sheet.getByRole('button', {name: 'Cancel'}).click();
    await p.close();

    // 15 · populated (ix:7380-7434): the design's seven rows, their dates from local activity.
    const book = [
      {address: addr(1), name: 'Marko · Mom'},
      {address: addr(2), name: 'Aleks · DeFi pool'},
      {address: addr(3), name: 'Luka · Designer'},
      {address: addr(4), name: 'Bistro · for Marketing'},
      {address: addr(5), name: 'Noctura · Cold storage'},
      {address: addr(6), name: 'Tina'},
      {address: addr(7), name: 'Daniel · Co-founder'},
    ];
    await saveContacts(h, book);
    const now = Date.now();
    await set(h.sw, {
      v1_known_recipients: [
        {address: addr(1), at: now - 3 * DAY},
        {address: addr(2), at: now - 12 * DAY},
        {address: addr(3), at: now - 40 * DAY},
        {address: addr(4), at: now - 65 * DAY},
        {address: addr(7), at: now - 245 * DAY},
      ],
    });
    p = await popup(h);
    await toBook(p);
    await expect(p.locator('.s-abook .row')).toHaveCount(7);
    await expect(p.locator('.s-abook .row').first().locator('.when')).toHaveText('3 days ago');
    await expect(p.locator('.s-abook .row').nth(4).locator('.when')).toHaveText('never');
    await pop(p, '15-populated', p.locator('.s-abook .row').first());
    // Pre-flight G4: the search's `:focus-within` (happy-dom lacks it) — the icon takes --accent with the field focused
    // (ix:7475), --fg-tertiary without; the field its accent ring (ix:7476 `.focused`).
    const accent = await token(p, '--accent');
    const ic = p.locator('.s-abook .search .ic');
    expect(await css(ic, 'color'), 'the search icon, unfocused').not.toBe(accent);
    await p.getByRole('textbox', {name: 'Search contacts'}).focus();
    expect(await css(ic, 'color'), 'the search icon, focused (:focus-within)').toBe(accent);
    expect(await css(p.getByRole('textbox', {name: 'Search contacts'}), 'box-shadow'), 'the focused field').toContain(accent);
    // 15 · search active (ix:7464-7501) and no result (O71).
    await p.getByRole('textbox', {name: 'Search contacts'}).fill('mark');
    await expect(p.getByText('2 results for "mark"')).toBeVisible();
    await expect(p.locator('.s-abook .row mark')).toHaveText(['Mark', 'Mark']);
    await pop(p, '15-search-active', p.getByText('2 results for "mark"'));
    await p.getByRole('textbox', {name: 'Search contacts'}).fill('zed');
    await expect(p.getByText('No contacts match "zed".')).toBeVisible();
    await pop(p, '15-search-no-result', p.getByRole('button', {name: 'Add new contact "zed" →'}));
    await p.getByRole('button', {name: 'Clear search'}).click();
    // The sheet · edit (D21), duplicate-name (O85), delete confirm.
    await p.locator('.s-abook .row', {hasText: 'Tina'}).click();
    const edit = p.getByRole('dialog', {name: 'Edit contact'});
    await expect(edit.getByLabel('Name')).toHaveValue('Tina');
    await expect(edit.getByText('You have never sent to this address.')).toBeVisible();
    // Task 4 carry: "Delete contact"'s focus handle (`.app-contact-delete`) is `display: contents` — it generates no box,
    // so the button lays out as the sheet column's own item: the full width of the Cancel | Save row above it.
    expect(await css(edit.locator('.app-contact-delete'), 'display')).toBe('contents');
    const delBox = await edit.getByRole('button', {name: 'Delete contact'}).boundingBox();
    const rowBox = await edit.locator('.app-contact-actions').boundingBox();
    expect(delBox?.x, 'Delete contact spans the actions row').toBeCloseTo(rowBox?.x ?? -1, 0);
    expect(delBox?.width, 'Delete contact spans the actions row').toBeCloseTo(rowBox?.width ?? -1, 0);
    await sheetShot(p, 'sheet-edit', edit.getByRole('button', {name: 'Delete contact'}));
    await edit.getByLabel('Name').fill('marko · MOM');
    await edit.getByRole('button', {name: 'Save', exact: true}).click();
    await expect(edit.getByText('Another contact already has this name.')).toBeVisible();
    await sheetShot(p, 'sheet-duplicate-name', edit.getByText('Another contact already has this name.'), edit.getByRole('button', {name: 'Save', exact: true}));
    await edit.getByRole('button', {name: 'Delete contact'}).click();
    await expect(edit.getByText('Delete this contact?')).toBeVisible();
    await expect(edit.getByRole('button', {name: 'Keep'}), 'review M2: the confirm takes the focus to Keep').toBeFocused();
    await sheetShot(p, 'sheet-delete-confirm', edit.getByRole('button', {name: 'Keep'}), edit.getByRole('button', {name: 'Delete', exact: true}));
    await edit.getByRole('button', {name: 'Keep'}).click();
    await edit.getByRole('button', {name: 'Cancel'}).click();
    // #31 · Connections › Address book · 7 contacts (ix:13552).
    await p.getByRole('button', {name: 'Back'}).click();
    await expect(p.locator('.s7-row', {hasText: 'Address book'}).locator('.s7-meta')).toHaveText('7 contacts');
    await pop(p, '31-connections-address-book', p.locator('.s7-row', {hasText: 'Address book'}));
    // #37 · the plan-2 bullet: the address book is erased with the rest.
    await p.locator('.s7-title', {hasText: 'Delete wallet'}).click();
    const bullet = p.locator('.app-delete-bullets li').nth(1);
    await expect(bullet).toHaveText('Local settings, cached balances, your address book and the list of addresses you have sent to are erased and not recoverable.');
    await pop(p, '37a-bullet-address-book', bullet);
    await p.close();

    // 15 · full (200): every add disabled, O73.
    await saveContacts(h, Array.from({length: 193}, (_, i) => ({address: addr(20 + i), name: `Contact ${i + 1}`})));
    p = await popup(h);
    await toBook(p);
    await expect(p.getByText('The address book is full (200 contacts).')).toBeVisible();
    await expect(p.getByRole('button', {name: 'Add contact'})).toBeDisabled();
    await pop(p, '15-full', p.getByText('The address book is full (200 contacts).'));

    // Task 7 carry, Task 10 fix round 0b (C1), in real Chromium: a focused Cancel, Keep or Save disabled under the focus
    // by a request that is out (the sheet ignores every close until it answers). Chromium drops such a focus to <body>,
    // and Tab from there reached the screen behind the modal (after Keep: #15's Back). Now the dialog itself takes the
    // focus (tabindex -1, drawn without a ring and with its own corners), Tab enters the sheet at its first control, and
    // once the answer closes the sheet the focus is back on the row that opened it. The request is held; the press
    // reaches the button without moving the focus (an activation that does not focus, as assistive technology may send).
    const onDialog = (what: string) =>
      expect.poll(() => focusAt(p), {message: `${what}: the dialog holds the focus`}).toMatchObject({tag: 'DIV', role: 'dialog', inSheet: true});
    const tabInside = async (what: string) => {
      await p.keyboard.press('Tab');
      expect(await focusAt(p), `${what}: Tab enters the sheet at its first control`).toMatchObject({tag: 'BUTTON', label: 'Close', inSheet: true});
    };
    const backOnRow = (name: string) =>
      expect.poll(() => p.evaluate(() => document.activeElement?.closest('.s-abook .row')?.querySelector('.name')?.textContent ?? null), {message: `${name}: the focus back on its row`}).toBe(name);
    const held = await holdMessages(p, 'contacts.set');
    await p.locator('.s-abook .row', {hasText: 'Contact 1'}).first().click();
    const ed = p.getByRole('dialog', {name: 'Edit contact'});
    const radius = await css(ed, 'border-top-left-radius');
    await ed.getByLabel('Name').fill('Contact one');
    const cancel = ed.getByRole('button', {name: 'Cancel'});
    await cancel.focus();
    await ed.getByRole('button', {name: 'Save', exact: true}).dispatchEvent('click');
    await expect.poll(held.held).toBe(1);
    await expect(cancel).toBeDisabled();
    await onDialog('Cancel');
    expect(await css(ed, 'outline-style'), 'the focused dialog: no ring').toBe('none');
    expect(await css(ed, 'border-top-left-radius'), 'the focused dialog keeps its corners').toBe(radius);
    await tabInside('Cancel');
    await held.release();
    await expect(ed).toHaveCount(0);
    await backOnRow('Contact one');
    const heldRemove = await holdMessages(p, 'contacts.remove');
    await p.locator('.s-abook .row', {hasText: 'Contact 2'}).first().click();
    const del = p.getByRole('dialog', {name: 'Edit contact'});
    await del.getByRole('button', {name: 'Delete contact'}).click();
    const keep = del.getByRole('button', {name: 'Keep'});
    await expect(keep).toBeFocused();
    await del.getByRole('button', {name: 'Delete', exact: true}).dispatchEvent('click');
    await expect.poll(heldRemove.held).toBe(1);
    await expect(keep).toBeDisabled();
    await onDialog('Keep');
    await tabInside('Keep');
    await heldRemove.release();
    await expect(del).toHaveCount(0);
    // The common path: Save pressed with the pointer (the focus on Save, which its own lock disables).
    const heldClick = await holdMessages(p, 'contacts.set');
    await p.locator('.s-abook .row', {hasText: 'Contact 3'}).first().click();
    const ed3 = p.getByRole('dialog', {name: 'Edit contact'});
    await ed3.getByLabel('Name').fill('Contact three');
    await ed3.getByRole('button', {name: 'Save', exact: true}).click();
    await expect.poll(heldClick.held).toBe(1);
    await onDialog('Save');
    await tabInside('Save');
    await heldClick.release();
    await expect(ed3).toHaveCount(0);
    await backOnRow('Contact three');
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: the hooks — #12’s contact icon, #15 pick, #12 after a pick, #20’s Save as, #27 Save / Save sender, the sheet from #27c (only sent to you, dust, full), the labels', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-vis-contact-hooks-');
  try {
    await realWallet(h);
    const DUSTER = addr(90);
    const t = Math.floor(Date.now() / 1000);
    h.fake.history.set(ACCOUNT, [
      {signature: sig(51), tx: sentSol(ACCOUNT, COUNTERPARTY, 2_480_000_000, t - 60)},
      {signature: sig(52), tx: receivedUsdc(ACCOUNT, addr(91), 250_000_000, t - 120)},
      {signature: sig(53), tx: sentSol(DUSTER, ACCOUNT, 500_000, t - 180)},
    ]);
    await saveContacts(h, [{address: addr(92), name: 'Binance'}]);
    let p = await popup(h);
    // #12 idle: Paste and Address book (ix:6652).
    await p.getByRole('button', {name: 'Send', exact: true}).click();
    await expect(p.locator('.recipient-row .input-actions button')).toHaveCount(2);
    await pop(p, '12-idle-contact-icon', p.getByRole('button', {name: 'Address book'}));
    // #15 pick: the whole address and O72.
    await p.getByLabel('Amount').fill('0.01');
    await p.getByRole('button', {name: 'Address book'}).click();
    const row = p.locator('.s-abook .row', {hasText: 'Binance'});
    await expect(row.locator('.when')).toHaveText('You have never sent to this address.');
    // Task 10 fix: O72 is `.noc-caption` --warning (§6.1); the design's `.s-abook .row .when` (--fg-tertiary, three
    // classes) out-ranked `.noc-warning` and drew it grey.
    expect(await css(row.locator('.when'), 'color'), 'O72 in --warning').toBe(await token(p, '--warning'));
    await pop(p, '15-pick', row);
    // #12 after the pick: the label above "Never sent here before", state 6.
    await row.click();
    await expect(p.locator('.recipient-row .app-contact-label')).toHaveText('From your address book: Binance');
    await expect(p.locator('.recipient-row .helper.warn')).toHaveText('Never sent here before');
    await pop(p, '12-picked-contact', p.locator('.recipient-row .app-contact-label'));
    await p.close();

    // #20 first-time: the Save-as row (ix:9349-9350) → the sheet prefilled (never sent) → saved, the To label.
    p = await popup(h);
    await p.getByRole('button', {name: 'Send', exact: true}).click();
    await p.getByLabel('Recipient', {exact: true}).fill(RECIPIENT);
    await p.getByLabel('Amount').fill('0.01');
    await p.locator('.sticky-bar button').click();
    await expect(p.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
    await p.getByRole('button', {name: 'Continue to confirm'}).click();
    const saveAs = p.locator('.detail-row.app-save-as');
    await expect(saveAs.locator('.val')).toHaveText('Add to address book? · Add · Skip');
    await pop(p, '20-first-time-save-as', saveAs);
    await saveAs.getByRole('button', {name: 'Add'}).click();
    const prefilled = p.getByRole('dialog', {name: 'Add contact'});
    await expect(prefilled.getByText('You have never sent to this address.')).toBeVisible();
    await expect(prefilled.getByLabel('Name')).toBeFocused();
    await sheetShot(p, 'sheet-add-prefilled-never-sent', prefilled.getByText('You have never sent to this address.'));
    await prefilled.getByLabel('Name').fill('Savings jar');
    await prefilled.getByRole('button', {name: 'Save', exact: true}).click();
    await expect(p.locator('.detail-row', {hasText: 'From your address book: Savings jar'})).toBeVisible();
    await expect(saveAs).toHaveCount(0);
    await pop(p, '20-saved-label', p.locator('.detail-row', {hasText: 'From your address book: Savings jar'}));
    // Cancel discards the prepared send (E7): the next popup opens on #11, not on #20's resume.
    await p.getByRole('button', {name: 'Cancel'}).click();
    await expect(p.getByText('Transaction cancelled. No fees charged.')).toBeVisible();
    await p.close();

    // #27a [Save]; #27c [Save sender] → only sent to you; the dust one → the banner and Save anyway; then the label.
    p = await popup(h);
    await p.getByRole('button', {name: 'Activity'}).click();
    await p.getByText('Sent SOL', {exact: true}).click();
    await expect(p.getByRole('button', {name: 'Save'})).toBeVisible();
    await pop(p, '27a-save', p.getByRole('button', {name: 'Save'}));
    await p.getByRole('button', {name: 'Back'}).click();
    await p.getByText('Received USDC').click();
    await expect(p.getByRole('button', {name: 'Save sender'})).toBeVisible();
    await pop(p, '27c-save-sender', p.getByRole('button', {name: 'Save sender'}));
    await p.getByRole('button', {name: 'Save sender'}).click();
    const sender = p.getByRole('dialog', {name: 'Add contact'});
    await expect(sender.getByText('You have never sent to this address — it only sent to you.')).toBeVisible();
    await expect(sender.locator('.app-contact-addr')).toBeInViewport({ratio: 1});
    await sheetShot(p, 'sheet-only-sent-to-you', sender.getByText('You have never sent to this address — it only sent to you.'));
    await sender.getByLabel('Name').fill('Client');
    await sender.getByRole('button', {name: 'Save', exact: true}).click();
    const fromRow = p.locator('.detail-row', {hasText: 'From your address book: Client'});
    await expect(fromRow.locator('.lbl')).toHaveText('From');
    await pop(p, '27c-from-label', fromRow);
    await p.getByRole('button', {name: 'Back'}).click();
    await p.getByText('Received SOL').click();
    await p.getByRole('button', {name: 'Save sender'}).click();
    const dust = p.getByRole('dialog', {name: 'Add contact'});
    await expect(dust.locator('.banner.danger')).toHaveText('Tiny transfer — a common way to plant a look-alike address. Compare every character with an address you trust before saving.');
    await expect(dust.getByRole('button', {name: 'Save anyway'})).toBeVisible();
    // Opened with the focus in Name, the whole sheet is in view: the address it saves and Save anyway wholly, the banner
    // at 95 % (review L3: one wrapped line under another font must not fail a product that is right).
    for (const part of [dust.locator('.app-contact-addr'), dust.getByRole('button', {name: 'Save anyway'})]) await expect(part).toBeInViewport({ratio: 1});
    await expect(dust.locator('.banner.danger')).toBeInViewport({ratio: 0.95});
    await sheetShot(p, 'sheet-dust', dust.locator('.banner.danger'));
    await sheetShot(p, 'sheet-dust-save-anyway', dust.getByRole('button', {name: 'Save anyway'}));
    await dust.getByRole('button', {name: 'Cancel'}).click();
    await p.close();

    // The book full: a new contact from #27c is refused with O87.
    await saveContacts(h, Array.from({length: 197}, (_, i) => ({address: addr(100 + i), name: `Contact ${i + 1}`})));
    p = await popup(h);
    await p.getByRole('button', {name: 'Activity'}).click();
    await p.getByText('Received SOL').click();
    await p.getByRole('button', {name: 'Save sender'}).click();
    const full = p.getByRole('dialog', {name: 'Add contact'});
    await full.getByLabel('Name').fill('Duster');
    await full.getByRole('button', {name: 'Save anyway'}).click();
    await expect(full.getByText('The address book is full (200 contacts). Delete one to add another.')).toBeVisible();
    // D35: "Save anyway" stays wholly in view in the sheet's longest state too (Task 10 fix: the tall sheet drops #43's
    // 24 px gesture-bar allowance, which cut it).
    await expect(full.locator('.app-contact-addr')).toBeInViewport({ratio: 1});
    await expect(full.getByRole('button', {name: 'Save anyway'})).toBeInViewport({ratio: 1});
    await sheetShot(p, 'sheet-full', full.getByText('The address book is full (200 contacts). Delete one to add another.'), full.getByRole('button', {name: 'Save anyway'}));
    contained(h);
  } finally {
    await h.close();
  }
});

/**
 * Fix round 0b (controller): the poisoning-relevant states the first two specs did not reach. The fee treasury's address
 * (core/fees MAINNET_FEE_TREASURY = core/presale MAINNET_SOL_TREASURY, written out here: e2e imports nothing from core/).
 */
const TREASURY = '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd';
/** `a` with one middle character's case swapped — still a canonical 32-byte address, a different one. */
function caseVariant(a: string): string {
  for (let i = 12; i < a.length - 4; i++) {
    const c = a[i]!;
    const swapped = c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase();
    if (swapped === c) continue;
    const v = a.slice(0, i) + swapped + a.slice(i + 1);
    try {
      if (base58.decode(v).length === 32 && base58.encode(base58.decode(v)) === v) return v;
    } catch {
      // not in base58's alphabet (I, O, l): the next character
    }
  }
  throw new Error('no case variant');
}

test('visual: poisoning — an exact address search with a case look-alike, a known contact with no date, #15 pick for the treasury (never sent) and an own account', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-vis-contact-poison-');
  try {
    await seedUnlockedWallet(h.sw);
    const ALICE = addr(1);
    const LOOKALIKE = caseVariant(ALICE);
    expect(LOOKALIKE).not.toBe(ALICE);
    expect(LOOKALIKE.toLowerCase()).toBe(ALICE.toLowerCase());
    await saveContacts(h, [
      {address: ALICE, name: 'Alice'},
      {address: LOOKALIKE, name: 'Alice (planted)'},
      {address: TREASURY, name: 'Fees'},
      {address: SAVINGS.publicKey, name: 'My savings'},
    ]);
    // Alice is known with no time (a B1b-1 entry: the bare address); the look-alike and the treasury were never paid.
    await set(h.sw, {v1_known_recipients: [ALICE]});
    let p = await popup(h);
    await toBook(p);
    // An exact full-address search (spec §6.1, Task 3 ruling M4): only the exact address — never its case look-alike.
    await p.getByRole('textbox', {name: 'Search contacts'}).fill(ALICE);
    await expect(p.getByText(`1 result for "${ALICE}"`)).toBeVisible();
    await expect(p.locator('.s-abook .row')).toHaveCount(1);
    await expect(p.locator('.s-abook .row .name')).toHaveText('Alice');
    // Fix round 0b: the overline's uppercase (the design's "2 RESULTS FOR "MARK"") would draw the address case-folded —
    // the very difference this search refuses to ignore — so an address query keeps its case; and neither that line nor
    // "Add new contact "<address>" →" runs past the column (no horizontal scroll, §8.4 item 6).
    const count = p.locator('.app-abook-count');
    expect(await count.evaluate(e => (e as HTMLElement).innerText), 'the address drawn in its own case').toBe(`1 result for "${ALICE}"`);
    const addNew = p.getByRole('button', {name: `Add new contact "${ALICE}" →`});
    for (const [what, el] of [['the count line', count], ['Add new contact', addNew]] as const) {
      const box = await el.boundingBox();
      expect(box?.x ?? -1, `${what}: inside the column`).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 1e6), `${what}: inside the column`).toBeLessThanOrEqual(412);
      expect(await el.evaluate(e => e.scrollWidth <= e.clientWidth), `${what}: no overflow`).toBe(true);
    }
    expect(await p.evaluate(() => document.scrollingElement!.scrollWidth <= window.innerWidth), 'no horizontal scroll').toBe(true);
    await pop(p, '15-search-exact-address', p.locator('.s-abook .row'));
    // Positive control: the look-alike's own address finds the look-alike alone.
    await p.getByRole('textbox', {name: 'Search contacts'}).fill(LOOKALIKE);
    await expect(p.locator('.s-abook .row .name')).toHaveText(['Alice (planted)']);
    await p.getByRole('button', {name: 'Clear search'}).click();
    // A known contact whose last send has no time: no date text ("never" means only "not known"; Task 5 ruling).
    const alice = p.locator('.s-abook .row', {has: p.locator('.name', {hasText: /^Alice$/})});
    await expect(alice.locator('.when')).toHaveText('');
    await expect(p.locator('.s-abook .row', {hasText: 'Alice (planted)'}).locator('.when')).toHaveText('never');
    await pop(p, '15-known-no-date', alice);
    await p.close();

    // #15 pick from #12: the treasury never sent to says O72, not "Noctura treasury"; an own account says its label.
    p = await popup(h);
    await p.getByRole('button', {name: 'Send', exact: true}).click();
    await p.getByRole('button', {name: 'Address book'}).click();
    const fees = p.locator('.s-abook .row', {hasText: 'Fees'});
    await expect(fees.locator('.when')).toHaveText('You have never sent to this address.');
    await expect(fees).not.toContainText('Noctura treasury');
    expect(await css(fees.locator('.when'), 'color'), 'O72 in --warning').toBe(await token(p, '--warning'));
    await pop(p, '15-pick-treasury-never-sent', fees);
    const own = p.locator('.s-abook .row', {hasText: 'My savings'});
    await expect(own.locator('.when')).toHaveText('Your account: Savings');
    await expect(own).not.toContainText('You have never sent to this address.');
    await pop(p, '15-pick-own-account', own);
    contained(h);
  } finally {
    await h.close();
  }
});
