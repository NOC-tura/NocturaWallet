import {test, expect, type Page} from '@playwright/test';
import {mkdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {base58, base64} from '@scure/base';
import {BLOCKHASH_LIFETIME, FAKE_START_HEIGHT} from './fakeCoordinator';
import {EXT_NOPRESALE} from './launch';
import {MAIN, contained, launchPopup, seedUnlockedWallet, type Harness} from './popupHarness';
import {RECIPIENT, msg} from './sendHelpers';

declare const chrome: {storage: {local: {set(o: object): Promise<void>}}};

// B1d §6.3 E2E 7 (B1d-1a, review 2 L10), C19, Q42: the build without presale (dist-nopresale) has no presale UI and no
// presale handler, and a purchase signed by an on build before an update — a v1_pending record of exactly §2.3's shape
// — is not lost: shown generically on #11, #26 and #21 (Q42: no amount, no recipient, nothing of its display data),
// counted in flight (a send is refused), and polled to confirmed. The visual shots (test-results/visual/q42-*.png) are
// for the review against the design's row styles (index.html #s11, #s26, #s21, #s44, #s54).
const DIR = 'test-results/visual';
const shot = async (page: Page, name: string) => {
  mkdirSync(DIR, {recursive: true});
  await page.screenshot({path: `${DIR}/${name}.png`});
};
const Q42 = {pending: 'Transaction · pending', slow: 'Transaction · taking longer than usual', line: 'Transaction'};
const SIGNATURE = base58.encode(Uint8Array.from({length: 64}, (_, i) => (i * 13 + 5) % 251 || 1));
/** B1d §2.3's display data: none of it may reach the screen of a build that cannot show it. */
const DATA = {currency: 'USDC', amount: '25000000', stage: '2', priceTicks: '1501', nocBase: '1998667554963357', spentCents: '2500', destination: RECIPIENT, referrer: null};
/** A purchase in v1_pending, B1d §2.3: the wallet's own record (origin null), no intent, its kind and data in `extra`. */
const purchase = (over: object = {}) => ({
  id: 'e7'.repeat(16),
  account: MAIN.publicKey,
  signature: SIGNATURE,
  wire: base64.encode(Uint8Array.of(1, 2, 3)),
  lastValidBlockHeight: FAKE_START_HEIGHT + BLOCKHASH_LIFETIME,
  createdAt: Date.now(),
  lastSentAt: Date.now(),
  state: 'pending',
  detail: null,
  detailCode: null,
  intent: null,
  origin: null,
  firstBroadcast: 'done',
  expiryNullSeenAt: null,
  failure: null,
  fee: {networkLamports: '5050', markupLamports: '0'},
  extra: {kind: 'presale-buy', data: DATA},
  ...over,
});
/** Nothing of the purchase's amount, destination or kind, and no presale word, anywhere in the popup. */
async function expectGeneric(p: Page) {
  const text = (await p.locator('body').textContent()) ?? '';
  for (const v of ['presale', 'Presale', 'PRESALE', 'USDC 25', '25.00', '1998667554963357', '1,998,667', RECIPIENT, 'Sending ']) expect([v, text.includes(v)]).toEqual([v, false]);
}
async function offBuild(prefix: string): Promise<Harness> {
  expect(JSON.parse(readFileSync(join(dirname(EXT_NOPRESALE), 'app.features.json'), 'utf8'))).toEqual({presale: false});
  return launchPopup(prefix, {ext: EXT_NOPRESALE});
}
/** #31's rows (visual.spec.ts's list): B1d-1b adds none — the referral row is B1d-2's, and never in this build. */
const SETTINGS_ROWS = ['Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Connected dApps', 'Address book', 'Delete wallet', 'About Noctura'];
const seed = (h: Harness, record: object) => h.sw.evaluate(r => chrome.storage.local.set({v1_pending: [r]}), record);
const meta = (p: Page) => p.locator('.meta-row').evaluateAll(rows => rows.map(r => [r.querySelector('.lbl')?.textContent, r.querySelector('.val')?.textContent]));

test('7 · off build: no presale UI or handler; a seeded purchase record is shown generically on #11, #26 and #21, blocks a send, and is polled to confirmed', async () => {
  const h = await offBuild('noctura-e2e-presale-off-');
  try {
    // Held pending until the test says otherwise: the network does not see it yet.
    h.fake.mode = 'expire';
    await seedUnlockedWallet(h.sw);
    await seed(h, purchase());
    const popup = await h.openPopup();
    await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
    // No banner, no Buy (B1d §4.5's slots are absent), and presale.view refused before any handler.
    expect(await popup.locator('.quick .qa .lbl').allTextContents()).toEqual(['Send', 'Receive']);
    expect(await msg(popup, {type: 'presale.view'})).toEqual({ok: false, error: 'unknown type'});
    // #11: the generic pending row (Q42a).
    await expect(popup.locator('.app-pending-strip .noc-body-sm')).toHaveText(Q42.pending, {timeout: 30_000});
    await expectGeneric(popup);
    await shot(popup, 'q42-11-pending');
    // In flight (C10): a send of this account is refused while the purchase is open.
    expect(await msg(popup, {type: 'wallet.prepareSend', account: MAIN.publicKey, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1000000'}})).toMatchObject({ok: false, error: 'in-flight'});
    // #26: the pending row, generic too.
    await popup.getByRole('button', {name: 'Activity'}).click();
    const row = popup.locator(`.tx-row[data-pending="${'e7'.repeat(16)}"]`);
    await expect(row.locator('.pri')).toHaveText(Q42.pending, {timeout: 30_000});
    await expect(row.locator('.sec')).toHaveText(/^waiting · \d+ m \d+ s$/);
    await expectGeneric(popup);
    await shot(popup, 'q42-26-pending');
    // #21 from the row: the amount line is "Transaction", no To row.
    await row.click();
    await expect(popup.getByText('Broadcasting transaction…')).toBeVisible({timeout: 30_000});
    await expect(popup.locator('.amount-card')).toHaveText(Q42.line);
    expect(await meta(popup)).toEqual([['Status', 'Broadcasting']]);
    await expectGeneric(popup);
    await shot(popup, 'q42-21-pending');
    // The network confirms it (B1b's fake: at its second status check): the background's poller, then #21's read.
    h.fake.mode = 'confirm';
    await expect(popup.getByText('Sent successfully')).toBeVisible({timeout: 45_000});
    await expect(popup.locator('.amount-card')).toHaveText(Q42.line);
    expect(await meta(popup)).toEqual([
      ['Tx hash', SIGNATURE],
      ['Fee paid', '0.00000505 SOL'],
    ]);
    await expectGeneric(popup);
    await shot(popup, 'q42-21-confirmed');
    expect((await msg(popup, {type: 'wallet.pending'})).data).toEqual([expect.objectContaining({id: 'e7'.repeat(16), state: 'confirmed', intent: null, extra: {kind: 'presale-buy', data: DATA}})]);
    // Nothing was broadcast: polling a record never sends it.
    expect(h.fake.broadcasts).toEqual([]);
    // #31 (Settings) has no presale row — read once its rows have rendered (B1d-1b Task 8: `.screen` alone was already
    // #11's, so the text below could be read before Settings drew anything).
    await popup.getByRole('button', {name: 'Done'}).click();
    await popup.getByRole('button', {name: 'Settings'}).click();
    await expect(popup.locator('.s7-row .s7-title')).toHaveText(SETTINGS_ROWS, {timeout: 30_000});
    expect(await popup.locator('main').textContent()).not.toMatch(/presale|referral/i);
    contained(h);
  } finally {
    await h.close();
  }
});

test('7 · visual: #54 and #44 for a purchase record in the off build — generic, no [Try again]', async () => {
  const h = await offBuild('noctura-e2e-presale-off-v-');
  try {
    h.fake.mode = 'expire';
    await seedUnlockedWallet(h.sw);
    // #54: a record the engine already calls stuck.
    await seed(h, purchase({state: 'stuck', createdAt: Date.now() - 95_000, lastSentAt: Date.now() - 95_000}));
    const popup = await h.openPopup();
    await expect(popup.locator('.app-pending-strip .noc-body-sm')).toHaveText(Q42.slow, {timeout: 30_000});
    await shot(popup, 'q42-11-slow');
    await popup.locator('.app-pending-strip').click();
    await expect(popup.getByText('Transaction stuck')).toBeVisible({timeout: 30_000});
    await expect(popup.locator('.orig-card .pill')).toHaveText(Q42.line);
    expect(await popup.locator('.orig-card .row .k').allTextContents()).toEqual(['Tx hash', 'Valid until block']);
    await expectGeneric(popup);
    await shot(popup, 'q42-54-stuck');
    // Its blockhash's life passed with margin: two null full-history checks, then the expired layout — Done only.
    h.fake.blockHeight = FAKE_START_HEIGHT + BLOCKHASH_LIFETIME + 33;
    await expect(popup.getByText('Not confirmed — no funds moved.')).toBeVisible({timeout: 45_000});
    await expect(popup.getByRole('button', {name: 'Try again'})).toHaveCount(0);
    await expect(popup.getByRole('button', {name: 'Done'})).toBeVisible();
    await expectGeneric(popup);
    await shot(popup, 'q42-54-expired');
    await popup.close();
    // #44: another purchase, open, that lands with a program error — in a popup opened after it was stored (the popup
    // re-reads wallet.pending every 2 s only while it knows an open record, B1b).
    h.fake.blockHeight = FAKE_START_HEIGHT;
    await seed(h, purchase({id: 'e8'.repeat(16)}));
    const again = await h.openPopup();
    await expect(again.locator('.app-pending-strip .noc-body-sm')).toHaveText(Q42.pending, {timeout: 30_000});
    await again.locator('.app-pending-strip').click();
    await expect(again.locator('.amount-card')).toHaveText(Q42.line, {timeout: 30_000});
    h.fake.mode = 'fail';
    await expect(again.getByText('Program rejected the transaction')).toBeVisible({timeout: 45_000});
    await expect(again.getByRole('button', {name: 'Try again'})).toHaveCount(0);
    await expect(again.getByRole('button', {name: 'View details'})).toBeVisible();
    await expectGeneric(again);
    await shot(again, 'q42-44-rejected');
    expect(h.fake.broadcasts).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});
