import {test, expect, type Page} from '@playwright/test';
import {base58} from '@scure/base';
import {contained, launchPopup, type Harness} from './popupHarness';
import {ACCOUNT, RECIPIENT, realWallet} from './sendHelpers';
import {COUNTERPARTY, receivedUsdc, sig} from './historyFixtures';
import {E2E_ACCOUNTS} from './makeEnvelope';

// Spec B1b-2b §8.3, plan 2: spec 19 — a contact is a label, never trust (D19), against the real extension and the
// contained fake coordinator. Both runs read history and balances from the fake, so each ends with contained(h).
// The negative control (rev 2, review H3) is the address-poisoning picture: a dust transfer from a look-alike of an
// address this wallet has paid, saved as "Binance" — the sheet warns, a second "binance" is refused, and the pick row
// shows the whole address and "You have never sent to this address."; #12 still says "Never sent here before".

/**
 * A look-alike of `address`: the same length, the same first four and last four characters, a different middle — the
 * number plus 58^20 changes base58 digits in the middle only. Poisoning works on exactly this truncation.
 */
function lookalike(address: string): string {
  const bytes = base58.decode(address);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  n += 58n ** 20n;
  // Still 32 bytes (review L7): the encoding below would silently drop an overflow.
  if (n >= 2n ** 256n) throw new Error('look-alike overflows 32 bytes');
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return base58.encode(out);
}
const groupsOf = (a: string) => a.match(/.{1,4}/g) ?? [];

/** The popup on #11, its first balance read answered (under `unshare -rn` it starts offline). */
async function popup(h: Harness): Promise<Page> {
  const p = await h.openPopup();
  await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
  return p;
}
/** #26 → the received row → #27c → [Save sender] → the sheet. */
async function saveSender(p: Page): Promise<void> {
  await p.getByRole('button', {name: 'Activity'}).click();
  await p.getByText('Received USDC').click();
  await expect(p.getByText('RECEIVED', {exact: true})).toBeVisible();
  await p.getByRole('button', {name: 'Save sender'}).click();
  await expect(p.getByRole('dialog', {name: 'Add contact'})).toBeVisible();
}

test('19 · a contact is a label, not trust: saved from #27c, #12 says "From your address book" AND "Never sent here before"; #20’s first-time banner; #10 asks the first-send re-auth', async () => {
  test.setTimeout(180_000);
  const h = await launchPopup('noctura-e2e-contacts-');
  try {
    await realWallet(h);
    h.fake.accountKinds.set(COUNTERPARTY, 'wallet');
    h.fake.history.set(ACCOUNT, [{signature: sig(41), tx: receivedUsdc(ACCOUNT, COUNTERPARTY, 250_000_000, Math.floor(Date.now() / 1000) - 120)}]);
    const p = await popup(h);
    await saveSender(p);
    const sheet = p.getByRole('dialog', {name: 'Add contact'});
    expect(await sheet.locator('.app-contact-addr .addr-groups > span').allTextContents()).toEqual(groupsOf(COUNTERPARTY));
    await expect(sheet.getByText('You have never sent to this address — it only sent to you.')).toBeVisible();
    await expect(sheet.locator('.banner.danger')).toHaveCount(0);
    await sheet.getByLabel('Name').fill('Client');
    await sheet.getByRole('button', {name: 'Save', exact: true}).click();
    await expect(p.getByRole('dialog')).toHaveCount(0);
    await expect(p.getByText('From your address book: Client')).toBeVisible();

    // #12 with that address: the label above 2a's helper, which still says never sent (D19), and design state 6.
    await p.getByRole('button', {name: 'Back'}).click();
    await p.getByRole('button', {name: 'Home'}).click();
    await p.getByRole('button', {name: 'Send', exact: true}).click();
    await p.getByLabel('Recipient', {exact: true}).fill(COUNTERPARTY);
    await expect(p.locator('.recipient-row .app-contact-label')).toHaveText('From your address book: Client');
    await expect(p.locator('.recipient-row .helper.warn')).toHaveText('Never sent here before');
    await expect(p.locator('.banner.warning .banner-title')).toHaveText('First-time recipient');
    await p.getByLabel('Amount').fill('0.01');
    await p.locator('.sticky-bar button').click();
    await expect(p.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
    await p.getByRole('button', {name: 'Continue to confirm'}).click();
    // #20: the first-time banner stays; the To row carries the label; no "Save as" for a saved address.
    await expect(p.getByText("You've never sent to this address")).toBeVisible();
    await expect(p.locator('.detail-row', {hasText: 'From your address book: Client'})).toBeVisible();
    await expect(p.getByText('Save as')).toHaveCount(0);
    const opened = h.ctx.waitForEvent('page');
    await p.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    const tab = await opened;
    await tab.waitForURL(/unlock\.html\?mode=reauth&challenge=[0-9a-f]{32}$/);
    await expect(tab.locator('#ra-about')).toHaveText('You are about to send', {timeout: 30_000});
    await expect(tab.locator('#ra-reasons p').first()).toHaveText('Re-auth required for the first send to a new address.');
    // #10 renders closed-alphabet fields only: never a contact name (C12).
    await expect(tab.getByText('Client')).toHaveCount(0);
    expect(h.fake.broadcasts).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});

test('19 · negative control: a dust transfer from a look-alike of a paid address — dust banner, "only sent to you", Save anyway; a second "binance" refused; the pick row shows the whole address and O72; #12 still "Never sent here before"', async () => {
  test.setTimeout(180_000);
  const h = await launchPopup('noctura-e2e-contacts-dust-');
  try {
    // RECIPIENT is known: this wallet has sent to it. The poisoner's address truncates identically.
    await realWallet(h, {known: true});
    const fake = lookalike(RECIPIENT);
    expect(fake).not.toBe(RECIPIENT);
    expect([fake.length, fake.slice(0, 4), fake.slice(-4)]).toEqual([RECIPIENT.length, RECIPIENT.slice(0, 4), RECIPIENT.slice(-4)]);
    // 0.005 USDC: below C18's 0.01 floor (5 000 < 10 000 base units).
    h.fake.history.set(ACCOUNT, [{signature: sig(42), tx: receivedUsdc(ACCOUNT, fake, 5_000, Math.floor(Date.now() / 1000) - 60)}]);
    const p = await popup(h);
    await saveSender(p);
    const sheet = p.getByRole('dialog', {name: 'Add contact'});
    expect(await sheet.locator('.app-contact-addr .addr-groups > span').allTextContents()).toEqual(groupsOf(fake));
    await expect(sheet.locator('.banner.danger')).toHaveText('Tiny transfer — a common way to plant a look-alike address. Compare every character with an address you trust before saving.');
    await expect(sheet.getByText('You have never sent to this address — it only sent to you.')).toBeVisible();
    await sheet.getByLabel('Name').fill('Binance');
    await sheet.getByRole('button', {name: 'Save anyway'}).click();
    await expect(p.getByRole('dialog')).toHaveCount(0);

    // C19: another address may not be called "binance".
    await p.getByRole('button', {name: 'Back'}).click();
    await p.getByRole('button', {name: 'Settings'}).click();
    await p.locator('.s7-title', {hasText: 'Address book'}).click();
    await expect(p.getByText('Binance', {exact: true})).toBeVisible();
    await p.getByRole('button', {name: 'Add contact'}).click();
    const add = p.getByRole('dialog', {name: 'Add contact'});
    await add.getByLabel('Address').fill(E2E_ACCOUNTS[2]);
    await add.getByLabel('Name').fill('binance');
    await add.getByRole('button', {name: 'Save', exact: true}).click();
    await expect(add.getByText('Another contact already has this name.')).toBeVisible();
    await add.getByRole('button', {name: 'Cancel'}).click();

    // #12 → the book (pick): the whole address in groups of four and O72 — then picked, #12 runs as for a paste.
    await p.getByRole('button', {name: 'Back'}).click();
    await p.getByRole('button', {name: 'Home'}).click();
    await p.getByRole('button', {name: 'Send', exact: true}).click();
    await p.getByRole('button', {name: 'Address book'}).click();
    const row = p.locator('.s-abook .row', {hasText: 'Binance'});
    await expect(row.locator('.addr .addr-groups > span')).toHaveText(groupsOf(fake));
    await expect(row.locator('.when')).toHaveText('You have never sent to this address.');
    await row.click();
    await expect(p.getByLabel('Recipient', {exact: true})).toHaveValue(fake);
    await expect(p.locator('.recipient-row .helper.warn')).toHaveText('Never sent here before');
    await expect(p.locator('.recipient-row .app-contact-label')).toHaveText('From your address book: Binance');
    await expect(p.locator('.banner.warning .banner-title')).toHaveText('First-time recipient');
    // The send still asks for the password: the name added no trust (D19).
    await expect(p.locator('.banner.warning .banner-line')).toHaveText('Re-auth (password) required before broadcast · verify the address character-by-character below.');
    expect(await p.locator('.app-send-addr .addr-groups > span').allTextContents()).toEqual(groupsOf(fake));
    // The label is exact-address only (Task 8, O88): the real RECIPIENT, which truncates identically, is known — 2a's
    // "sent before" helper — and carries no "Binance". Waited on the helper first, so the absent label is an answer.
    // (State 6 draws no Clear: the field is refilled.)
    await p.getByLabel('Recipient', {exact: true}).fill(RECIPIENT);
    await expect(p.locator('.recipient-row .helper.ok')).toBeVisible();
    await expect(p.locator('.recipient-row .helper.warn')).toHaveCount(0);
    await expect(p.locator('.recipient-row .app-contact-label')).toHaveCount(0);
    contained(h);
  } finally {
    await h.close();
  }
});
