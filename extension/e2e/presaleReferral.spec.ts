import {test, expect, type Page} from '@playwright/test';
import {base58, base64} from '@scure/base';
import {parseV0} from './fakeCoordinator';
import type {Harness} from './popupHarness';
import {E2E_PASSWORD} from './makeEnvelope';
import {ACCOUNT, msg} from './sendHelpers';
import {
  PRESALE_PROGRAM,
  REGISTER_REFERRER_DISCRIMINATOR,
  SOL_TREASURY,
  SYSTEM_PROGRAM_ID,
  allocationPda,
  allocationReferral,
  nocText,
  purchaseCurrency,
  solCents,
  tokensFor,
  userPda,
} from './presaleChain';
import {REFERRER, amount, buyAction, cspControl, done, home, installReferrer, preparedPurchase, presaleWallet, scene} from './presaleHelpers';

// B1d §6.3 E2E 11 and 12 (B1d-2 Task 6): #31 → #24 (§3.5, §4.4) and the referral address of a first purchase (§3.5,
// §4.1, §4.2, D8, C32) in the real extension, against the fake coordinator's /referral-stats and its presale program,
// which applies `register_referrer` (presaleChain.ts / fakeCoordinator.ts). Every spec ends contained, no CSP violation.

const SOL = 1_000_000_000n;
const LINK = `https://noc-tura.io?ref=${ACCOUNT}`;
const Q46B = "You can't refer yourself or another account in this wallet";
const Q47 = "Saved to your presale account with this purchase. It can't be changed later.";
/** A returning buyer: two purchases on chain. */
const RETURNING = {totalBase: 1_998_667_554_963n, spentCents: 30_000n, count: 2};

/** #11 → #31 → "Refer a friend" (the Rewards group) → #24, its figures read. */
async function referral(p: Page): Promise<void> {
  await p.getByRole('button', {name: 'Settings'}).click();
  await expect(p.locator('.s7-group-label', {hasText: 'Rewards'})).toBeVisible({timeout: 30_000});
  await p.locator('.s7-row', {hasText: 'Refer a friend'}).click();
  await expect(p.locator('.s-ref .top-bar .title')).toHaveText('Refer a friend', {timeout: 30_000});
  await expect(p.locator('.s-ref .stats .stat .val')).toHaveCount(3, {timeout: 30_000});
}
const stats = (p: Page) => p.locator('.s-ref .stats .stat .val').allTextContents();

test('11 · referral: #31 → #24 — REFERRALS and REFERRED from /referral-stats, EARNED from the chain; Copy puts exactly the link in the clipboard and shows the checkmark (2 s); with /referral-stats failing its two stats are "—" and EARNED is still shown', async () => {
  test.setTimeout(180_000);
  const {h, csp} = await scene('noctura-e2e-presale-referral-');
  try {
    // EARNED is the allocation's referral_bonus_tokens (16.12… NOC credited by the program to this account as a referrer).
    await presaleWallet(h, {allocation: {...RETURNING, bonusBase: 16_123_456_789n}});
    h.fake.referralStats = {status: 200, body: {success: true, data: {totalReferrals: 3, totalReferredUsd: 1234.56, totalReferredPurchases: 4}}};
    // The popup's clipboard read is permission-denied: a spy on its write is what says what the clipboard was given.
    await h.ctx.addInitScript(() => {
      const clip = navigator.clipboard;
      if (clip === undefined) return;
      const write = clip.writeText.bind(clip);
      const copied: string[] = [];
      Object.defineProperty(window, 'e2eCopied', {value: copied});
      clip.writeText = (text: string) => {
        copied.push(text);
        return write(text);
      };
    });
    const p = await h.openPopup({clock: true});
    await expect(p.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
    await cspControl(p, csp);
    await referral(p);
    expect(await stats(p)).toEqual(['3', '16.1', '$1,234.56']);
    await expect(p.locator('.s-ref .stats .stat .val.acc')).toHaveText('16.1');
    await expect(p.locator('.s-ref .code-card .lbl-row .uses')).toHaveText('Used by 3 people');
    await expect(p.locator('.s-ref .code-card .code-row .code')).toHaveText(LINK);
    expect(h.fake.referralStatsReads).toEqual([ACCOUNT]);

    // Copy, with the popup's clock held: the checkmark and the accent border stay until the 2 s are run.
    const copy = p.locator('.s-ref .code-card .actions button');
    await expect(copy).toHaveAttribute('aria-label', 'Copy invite link');
    await p.clock.pauseAt(Date.now() + 1_000);
    await copy.click();
    await expect(copy).toHaveAttribute('aria-label', 'Copied');
    await expect(copy).toHaveClass('app-ref-check');
    await expect(p.locator('.s-ref .code-card .code-row.app-ref-copied')).toHaveCount(1);
    await expect(p.locator('.s-ref .share-btn')).toHaveText('Copied');
    expect(await p.evaluate(() => (window as unknown as {e2eCopied: string[]}).e2eCopied)).toEqual([LINK]);
    await p.clock.runFor(2_000);
    await expect(copy).toHaveAttribute('aria-label', 'Copy invite link');
    await expect(p.locator('.s-ref .code-card .code-row.app-ref-copied')).toHaveCount(0);
    await p.clock.resume();

    // /referral-stats fails (500): its two figures "—", no usage line; EARNED still the chain's; the link still whole.
    h.fake.referralStats = {status: 500, body: {success: false, error: 'connection terminated'}};
    await p.getByRole('button', {name: 'Back'}).click();
    await p.locator('.s7-row', {hasText: 'Refer a friend'}).click();
    await expect.poll(() => stats(p), {timeout: 30_000}).toEqual(['—', '16.1', '—']);
    await expect(p.locator('.s-ref .code-card .lbl-row .uses')).toHaveCount(0);
    await expect(p.locator('.s-ref .code-card .code-row .code')).toHaveText(LINK);
    expect(h.fake.referralStatsReads).toEqual([ACCOUNT, ACCOUNT]);
    done(h, csp);
  } finally {
    await h.close();
  }
});

/** Prepare's own refusal of an intent naming `referrer` (C3: the field is the popup's; the background decides). */
const forcedPrepare = (p: Page, referrer: string) => msg(p, {type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '500000000', stage: 0, referrer}});

/** #20's "Referred by" row: the whole address in groups of four and Q47's note (null: none). */
async function referredBy(p: Page): Promise<{address: string; note: string | null}> {
  const row = p.locator('.detail-row', {hasText: 'Referred by'});
  await expect(row).toHaveCount(1);
  const note = row.locator('.app-pre-note');
  return {address: (await row.locator('.addr-groups > span').allTextContents()).join(''), note: (await note.count()) === 0 ? null : await note.textContent()};
}

/** #20 → Buy → #10 in a new tab (a first purchase); its rows read; proven → the tab's hand-over → Buy → #21 confirmed. */
async function proveAndBuy(h: Harness, popup: Page): Promise<string> {
  const opened = h.ctx.waitForEvent('page');
  await popup.getByRole('button', {name: 'Buy NOC'}).click();
  const tab = await opened;
  await expect(tab.locator('#ra-about')).toHaveText('Confirm buying NOC with', {timeout: 30_000});
  const rows = (await tab.locator('#ra-rows').textContent()) ?? '';
  await tab.fill('#ra-password', E2E_PASSWORD);
  await tab.click('#ra-confirm');
  await tab.waitForURL(`chrome-extension://${h.id}/wallet.html#/send/resume?account=${ACCOUNT}`, {timeout: 60_000});
  await expect(tab.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
  await tab.getByRole('button', {name: 'Buy NOC'}).click();
  await expect(tab.locator('.stage-label')).toHaveText('Purchase confirmed', {timeout: 45_000});
  await tab.close();
  return rows;
}

test('12 · referral address: the buyer’s own address → Q46b and Buy disabled (and prepare refuses it); a valid referrer → #20 "Referred by" with Q47 → #10 says it → the posted transaction carries register_referrer and account 3 = the referrer’s allocation; the chain records it, the coordinator record carries it, and #23 offers no field again', async () => {
  test.setTimeout(240_000);
  const {h, csp} = await scene('noctura-e2e-presale-referrer-');
  try {
    // A first purchase (no PDAs yet); the referrer bought once (its allocation exists).
    await presaleWallet(h);
    installReferrer(h);
    // The popup's referral messages as it sends them (Task 3 review: the real browser's order of blur and click).
    await h.ctx.addInitScript(() => {
      const rt = (globalThis as unknown as {chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}}}).chrome.runtime;
      const send = rt.sendMessage.bind(rt);
      const sent: [string, string | null][] = [];
      Object.defineProperty(window, 'e2eReferral', {value: sent});
      rt.sendMessage = (m: unknown) => {
        const x = m as {type?: string; referrer?: string; intent?: {referrer?: string}};
        if (x.type === 'presale.checkReferrer') sent.push([x.type, x.referrer ?? null]);
        if (x.type === 'presale.prepareBuy') sent.push([x.type, x.intent?.referrer ?? null]);
        return send(m);
      };
    });
    const popup = await home(h);
    await cspControl(popup, csp);
    await buyAction(popup).click();
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live', {timeout: 30_000});
    const field = popup.getByLabel('Referral address (optional)');
    await expect(field).toHaveAttribute('id', 'presale-referrer');
    const lamports = SOL / 2n;
    const nocBase = tokensFor(solCents(lamports, 150), 0);
    await amount(popup, '0.5', nocText(nocBase));
    const buy = popup.locator('.sticky-bar button');
    const line = popup.locator('.app-pre-referral .helper');

    // Self: the line on blur, Buy held; prepare refuses it however it is asked; nothing simulated.
    await field.fill(ACCOUNT);
    await field.blur();
    await expect(line).toHaveText(Q46B, {timeout: 30_000});
    await expect(buy).toBeDisabled();
    expect(await forcedPrepare(popup, ACCOUNT)).toEqual({ok: false, error: 'referrer-self'});
    expect(h.fake.presale.simulated).toEqual([]);

    // The referrer typed and Buy pressed at once, the field still focused (Task 3 review): the press blurs the field, the
    // check goes out and holds Buy before the click lands — one check of the text, no prepare; the second press prepares
    // with the checked address.
    const sent = () => popup.evaluate(() => [...(window as unknown as {e2eReferral: [string, string | null][]}).e2eReferral]);
    const before = (await sent()).length;
    await field.fill(REFERRER);
    await expect(field).toBeFocused();
    await expect(buy).toBeEnabled();
    await buy.click();
    await expect(field).not.toBeFocused();
    await expect(buy).toHaveText(`Buy ${nocText(nocBase)} NOC`, {timeout: 30_000});
    await expect(buy).toBeEnabled();
    await expect(line).toHaveCount(0);
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live');
    expect((await sent()).slice(before)).toEqual([['presale.checkReferrer', REFERRER]]);
    expect(h.fake.presale.simulated).toEqual([]);

    // The referrer: no line, Buy again; #20 says who, and that this purchase saves it (Q47).
    await buy.click();
    await expect.poll(async () => (await sent()).slice(before), {timeout: 30_000}).toEqual([
      ['presale.checkReferrer', REFERRER],
      ['presale.prepareBuy', REFERRER],
    ]);
    await expect(popup.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
    expect(await referredBy(popup)).toEqual({address: REFERRER, note: Q47});
    // The program simulated the registration with the purchase.
    expect(h.fake.presale.simulated.map(e => [e.currency, e.amount, e.registers])).toEqual([['SOL', lamports, REFERRER]]);
    expect(((await preparedPurchase(popup)) as {reauth: {proven: boolean} | null} | null)?.reauth?.proven).toBe(false);

    // #10 repeats it (Q47's note its own row), from the background's description.
    const rows = await proveAndBuy(h, popup);
    expect(rows).toContain('Referred by');
    expect(rows).toContain(Q47);
    expect(rows).toContain(REFERRER);

    // The one broadcast: compute budget ×2, register_referrer(referrer) on the buyer's PDAs, then the purchase crediting
    // the referrer's allocation (account 3).
    expect(h.fake.broadcasts).toHaveLength(1);
    const wire = parseV0(base64.decode(h.fake.broadcastWires[0] ?? ''));
    expect(wire.instructions).toHaveLength(4);
    const register = wire.instructions[2];
    expect(wire.keys[register?.program ?? -1]).toBe(PRESALE_PROGRAM);
    expect([...(register?.data ?? [])]).toEqual([...REGISTER_REFERRER_DISCRIMINATOR, ...base58.decode(REFERRER)]);
    expect(register?.accounts.map(a => wire.keys[a])).toEqual([userPda(ACCOUNT), allocationPda(ACCOUNT), ACCOUNT, SYSTEM_PROGRAM_ID]);
    const purchase = wire.instructions[3];
    expect(wire.keys[purchase?.program ?? -1]).toBe(PRESALE_PROGRAM);
    expect(purchaseCurrency(purchase?.data ?? new Uint8Array())).toBe('SOL');
    const accounts = purchase?.accounts.map(a => wire.keys[a]) ?? [];
    expect([accounts[3], accounts[6]]).toEqual([allocationPda(REFERRER), SOL_TREASURY]);
    // On chain: the buyer's allocation names the referrer (D8); the coordinator record carries it (§2.4).
    expect(allocationReferral(h.fake.presale.accounts.get(allocationPda(ACCOUNT))?.data ?? new Uint8Array(117)).referrer).toBe(REFERRER);
    await expect.poll(() => h.fake.purchaseRecords.length, {timeout: 30_000}).toBe(1);
    expect(h.fake.purchaseRecords[0]).toMatchObject({txHash: h.fake.broadcasts[0], buyerAddress: ACCOUNT, stage: 1, referrerAddress: REFERRER});

    // #23 again: a repeat purchase with a referrer on chain — no field.
    const again = await h.openPopup();
    await expect(buyAction(again)).toBeVisible({timeout: 30_000});
    await buyAction(again).click();
    await expect(again.locator('.receipt .row')).toContainText(`Your allocation${nocText(nocBase)} NOC`, {timeout: 30_000});
    await expect(again.locator('#presale-referrer')).toHaveCount(0);
    done(h, csp);
  } finally {
    await h.close();
  }
});

test('12 · an account with a referrer on chain (registered, no purchase yet) gets no field; #20 and #10 name that referrer without Q47; the purchase credits its allocation (account 3) and registers nothing; prepare refuses another referrer', async () => {
  test.setTimeout(240_000);
  const {h, csp} = await scene('noctura-e2e-presale-onchain-referrer-');
  try {
    // Still a first purchase (purchase_count 0), but the allocation already names a referrer.
    await presaleWallet(h, {allocation: {totalBase: 0n, spentCents: 0n, count: 0, referrer: REFERRER}});
    installReferrer(h);
    const other = base58.encode(new Uint8Array(32).fill(54));
    installReferrer(h, other);
    const popup = await home(h);
    await buyAction(popup).click();
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live', {timeout: 30_000});
    const lamports = SOL / 2n;
    const nocBase = tokensFor(solCents(lamports, 150), 0);
    await amount(popup, '0.5', nocText(nocBase));
    await expect(popup.locator('#presale-referrer')).toHaveCount(0);
    expect(await forcedPrepare(popup, other)).toEqual({ok: false, error: 'referrer-not-applicable'});
    expect(h.fake.presale.simulated).toEqual([]);

    await popup.locator('.sticky-bar button').click();
    await expect(popup.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
    expect(await referredBy(popup)).toEqual({address: REFERRER, note: null});
    expect(h.fake.presale.simulated.map(e => e.registers)).toEqual([null]);
    const rows = await proveAndBuy(h, popup);
    expect(rows).toContain('Referred by');
    expect(rows).not.toContain(Q47);

    const wire = parseV0(base64.decode(h.fake.broadcastWires[0] ?? ''));
    expect(wire.instructions).toHaveLength(3);
    const accounts = wire.instructions[2]?.accounts.map(a => wire.keys[a]) ?? [];
    expect(accounts[3]).toBe(allocationPda(REFERRER));
    expect(allocationReferral(h.fake.presale.accounts.get(allocationPda(ACCOUNT))?.data ?? new Uint8Array(117)).referrer).toBe(REFERRER);
    await expect.poll(() => h.fake.purchaseRecords.length, {timeout: 30_000}).toBe(1);
    expect(h.fake.purchaseRecords[0]).toMatchObject({referrerAddress: REFERRER});
    done(h, csp);
  } finally {
    await h.close();
  }
});
