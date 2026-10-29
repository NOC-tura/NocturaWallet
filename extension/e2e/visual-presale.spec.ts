import {test, expect, type Locator, type Page} from '@playwright/test';
import {base58, base64} from '@scure/base';
import {mkdirSync} from 'node:fs';
import {BLOCKHASH_LIFETIME, FAKE_START_HEIGHT} from './fakeCoordinator';
import {contained, launchPopup, type Harness} from './popupHarness';
import {EXT, EXT_NOPRESALE} from './launch';
import {E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {unlockWith} from './vaultPage';
import {ACCOUNT, msg} from './sendHelpers';
import {DAPP_HOSTS, adapter, approvalWindow, openDapp, serveDapp, windowClosed} from './dappPage';
import {CONFIG_PDA, SOL_TREASURY, USDC_MINT, allocationData, allocationPda, configData, nocText, restrictedList, solCents, solPurchaseIx, stableCents, tokensFor, userData, userPda} from './presaleChain';
import {REFERRER, USDC_HOLDING, amount, buyAction, home, installPresale, installReferrer, presaleWallet, quickLabels, watchCsp} from './presaleHelpers';
import {presalePurchase, sentSol, sig} from './historyFixtures';
import {DIR} from './visualTab';

declare const chrome: {storage: {local: {set(o: object): Promise<void>}}};

// B1d §6.4 (B1d-1b Task 9): every state B1d-1b built, driven through the real extension against the contained fake
// coordinator (the presale program on its chain, /geo/check and /geo/restricted-list scripted) and saved for the
// opus-tier review against index.html (#23 ix 10603-10902, #50 ix 19612-19906, #11 ix 6272-6621, #20, #21, #44, #54,
// #48 ix 18261-18705, #10). The popup at 412 × 600 (its frame, §4), the approval window at 412 × 720 (its
// windows.create size), the vault page at 412 × 916. Every shot asserts its own copy first, then that its sticky bar
// is wholly in the frame and the copy clear of the pinned bars, and is taken after the screen's holds (a LockedButton's
// 500 ms floor, #48's 1.5 s arming): an enabled CTA is awaited enabled. A screen taller than its frame is shot again
// scrolled to its end (`-end`), the bar still wholly in view. Not a pixel diff. B1d-2 (Task 7) adds its states in the same
// way: #31's "Refer a friend" row, #24 (populated, copied, a null stat, empty), #23a's referral address with each of its
// lines (Q46 a–c, Q48), #20 and #10 with "Referred by" (with and without Q47's note), #26's "Presale" badge (a site's
// purchase with two) and #27 with Q34 (index.html #24 ix 10903-11233, #23 ix 10603-10902, #20, #10, #26, #27, #31).

const SOL = 1_000_000_000n;
/** A returning buyer's allocation on chain (two purchases): no account setup, no first-purchase re-authentication. */
const RETURNING = {totalBase: 1_998_667_554_963n, spentCents: 30_000n, count: 2};

/**
 * A popup or tab shot from the screen's top: `copy` visible, wholly in the frame and clear of the pinned bars (scrolled
 * to the middle of the frame only when it is not), the sticky bar and each of its buttons wholly in the frame, `ready` awaited enabled, the pointer off the column.
 * `end`: the screen is taller than the frame (asserted, so the check is not vacuous) and is shot again at its end.
 * `bars`: how many sticky bars the screen draws (default 1; 0 for a screen with none, as #11 and #23's closed answers).
 */
async function frame(p: Page, name: string, copy: Locator, o: {ready?: Locator; end?: boolean; bars?: 0 | 1} = {}): Promise<void> {
  const bars = o.bars ?? 1;
  await expect(copy).toBeVisible({timeout: 30_000});
  await top(p);
  const pinned = p.locator('main.app-content > .screen > .top-bar, main.app-content > .screen > .sticky-bar, nav.app-tab-bar');
  const vh = p.viewportSize()?.height ?? 0;
  const under = async (): Promise<string | null> => {
    const box = await copy.boundingBox();
    if (box === null) return 'no box';
    if (box.y < 0 || box.y + box.height > vh) return 'outside the frame';
    const el = await copy.elementHandle();
    for (const bar of await pinned.all()) {
      const b = await bar.boundingBox();
      if (b === null || (await bar.evaluate((e, x) => e.contains(x), el))) continue;
      if (box.y < b.y + b.height && b.y < box.y + box.height) return await bar.evaluate(e => e.className);
    }
    return null;
  };
  if ((await under()) !== null) await copy.evaluate(e => e.scrollIntoView({block: 'center'}));
  await expect(copy).toBeInViewport();
  expect(await under(), `${name}: the copy clear of the pinned bars`).toBeNull();
  await wholeBar(p, name, bars);
  if (o.ready !== undefined) await expect(o.ready).toBeEnabled();
  await p.mouse.move(0, 0);
  mkdirSync(DIR, {recursive: true});
  await p.screenshot({path: `${DIR}/${name}.png`});
  if (o.end !== true) return;
  const scrolled = await p.evaluate(() => {
    let any = false;
    for (const e of document.querySelectorAll<HTMLElement>('main.app-content, main.app-content *')) {
      if (e.scrollHeight > e.clientHeight + 40 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)) {
        e.scrollTo(0, e.scrollHeight);
        any = any || e.scrollTop > 0;
      }
    }
    return any;
  });
  expect(scrolled, `${name}: a screen taller than its frame`).toBe(true);
  await wholeBar(p, `${name} (end)`, bars);
  await p.screenshot({path: `${DIR}/${name}-end.png`});
  await top(p);
}
/** Every scroll area of the screen back at its top: each shot starts from the screen as it opens. */
const top = (p: Page) =>
  p.evaluate(() => {
    for (const e of document.querySelectorAll<HTMLElement>('main.app-content, main.app-content *')) if (e.scrollTop > 0) e.scrollTo(0, 0);
  });
/** Exactly `count` visible sticky bars (a bar that lost its class fails here, not silently), each and every button in it wholly inside the viewport. */
async function wholeBar(p: Page, name: string, count: number): Promise<void> {
  const bar = p.locator('.sticky-bar').filter({visible: true});
  await expect(bar, `${name}: ${count} sticky bar(s)`).toHaveCount(count);
  for (const b of await bar.all()) {
    await expect(b, `${name}: the sticky bar wholly in the frame`).toBeInViewport({ratio: 1});
    for (const button of await b.locator('button, a').all()) await expect(button, `${name}: a bar control wholly in the frame`).toBeInViewport({ratio: 1});
  }
}

/** #11 with its presale banner, whatever the balance (a purchase before it changed it). */
async function homeAfter(h: Harness): Promise<Page> {
  const p = await h.openPopup();
  await expect(p.locator('.app-presale-banner')).toBeVisible({timeout: 30_000});
  return p;
}
/** #11 → Buy → #23a, its stage card read. */
async function toPresale(p: Page): Promise<void> {
  await buyAction(p).click();
  await expect(p.locator('.stage-card .eyebrow')).toHaveText(/^ ?Stage \d+ of 10 · live$/, {timeout: 30_000});
}
const buyButton = (p: Page) => p.locator('.sticky-bar button');
/** #23's currency through the unit label (#43 with the three presale currencies). */
async function currency(p: Page, name: 'USD Coin' | 'Solana', ticker: string): Promise<void> {
  await p.locator('.input-card .ticker').first().click();
  await p.getByRole('dialog', {name: 'Choose a token'}).getByText(name).click();
  await expect(p.locator('.input-card .lbl-row').first()).toContainText(`Available`, {timeout: 30_000});
  await expect(p.locator('.input-card .ticker').first()).toHaveText(ticker);
}

/** A well-formed signature (64 bytes) for a seeded record. */
const base58Sig = (id: string): string => base58.encode(Uint8Array.from({length: 64}, (_, i) => (i * 11 + id.charCodeAt(i % id.length)) % 251 || 1));
/** A purchase in v1_pending (§2.3), the wallet's own, open: 0.5 SOL at stage 1. */
const pendingPurchase = (id: string) => ({
  id,
  account: ACCOUNT,
  signature: base58Sig(id),
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
  extra: {kind: 'presale-buy', data: {currency: 'SOL', amount: '500000000', stage: '0', priceTicks: '1501', nocBase: '499666888740', spentCents: '7500', destination: SOL_TREASURY, referrer: null}},
});

test('visual · #11 with the presale banner and Buy; #23a — SOL, the allocation row, below the minimum, MAX, the currency sheet, USDC, a prepare refusal (Q15); #20 without account setup; #21 confirmed with the badge', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-visual-presale-buy-');
  const csp = await watchCsp(h.ctx);
  try {
    await presaleWallet(h, {allocation: RETURNING});
    h.fake.tokenAccounts.get(ACCOUNT)?.push({pubkey: USDC_HOLDING, mint: USDC_MINT, amount: '1000000000', decimals: 6});
    const p = await home(h);
    await expect(p.locator('.app-presale-banner')).toContainText('NOC Presale · Stage 1');
    await expect(p.locator('.app-presale-banner .sm')).toHaveText('$ 0.1501 · 12% to next stage');
    expect(await quickLabels(p)).toEqual(['Send', 'Receive', 'Buy']);
    await frame(p, '11-presale-banner', p.locator('.app-presale-banner'), {ready: p.locator('.app-presale-banner'), bars: 0});

    await toPresale(p);
    await expect(p.locator('.stage-card .price')).toHaveText('$ 0.1501/ NOC');
    await expect(p.locator('.stage-card .meta').first()).toHaveText('$ 196,967 raised10.24 M NOC stage cap');
    await expect(p.locator('.app-pre-meta2')).toHaveText('Next stage $ 0.1723');
    await amount(p, '0.5', nocText(tokensFor(solCents(SOL / 2n, 150), 0)));
    await expect(p.locator('.input-card .lbl-row').nth(1)).toHaveText('YOU RECEIVE (EST.)@ $ 0.1501 · 1 SOL ≈ $ 150.00');
    await expect(p.locator('.input-card .lbl-row').first()).toHaveText('YOU PAYAvailable 10.0000 SOL');
    await frame(p, '23a-sol', p.locator('.input-card .est'), {ready: buyButton(p), end: true});

    await expect(p.locator('.receipt .row')).toContainText(`Your allocation${nocText(RETURNING.totalBase)} NOC`);
    await expect(p.locator('.app-pre-claimable')).toHaveText('Claimable after TGE');
    await frame(p, '23a-allocation', p.locator('.receipt'), {ready: buyButton(p)});

    // 0.05 SOL at $150 is $7.50: under the config's $10 — the line, Buy disabled with the estimate in its label
    // (§4.1: "[Buy <estimate> NOC]" while there is an estimate).
    await p.getByLabel('YOU PAY').fill('0.05');
    await expect(p.locator('.input-card .helper.error')).toHaveText('Minimum $10', {timeout: 30_000});
    await expect(buyButton(p)).toBeDisabled();
    await expect(buyButton(p)).toHaveText(`Buy ${nocText(tokensFor(solCents(SOL / 20n, 150), 0))} NOC`);
    await frame(p, '23a-below-min', p.locator('.input-card .helper.error'));

    // MAX: the background's amount (10 SOL less the fee bound and the rent-exempt minimum), quoted.
    await p.getByRole('button', {name: 'MAX', exact: true}).click();
    await expect(p.getByLabel('YOU PAY')).toHaveValue(/^9\.99\d*$/, {timeout: 30_000});
    await expect(buyButton(p)).toHaveText(/^Buy [\d,]+\.\d\d NOC$/, {timeout: 30_000});
    await expect(p.locator('.input-card .helper.error')).toHaveCount(0);
    await frame(p, '23a-max', p.getByLabel('YOU PAY'), {ready: buyButton(p)});

    // The currency choice: #43 with the presale's three currencies.
    await p.locator('.input-card .ticker').first().click();
    const sheet = p.getByRole('dialog', {name: 'Choose a token'});
    await expect(sheet.locator('.app-token-row')).toHaveCount(3);
    await expect(sheet).toContainText('USD Coin');
    mkdirSync(DIR, {recursive: true});
    await p.mouse.move(0, 0);
    await p.screenshot({path: `${DIR}/23a-currency-sheet.png`});
    await sheet.getByText('USD Coin').click();
    await expect(p.locator('.input-card .lbl-row').first()).toHaveText('YOU PAYAvailable 1,000.00 USDC', {timeout: 30_000});
    await amount(p, '25', nocText(tokensFor(stableCents(25_000_000n), 0)));
    await expect(p.locator('.input-card .lbl-row').nth(1)).toHaveText('YOU RECEIVE (EST.)@ $ 0.1501');
    await frame(p, '23a-usdc', p.locator('.input-card .est'), {ready: buyButton(p)});

    // A prepare refusal (§5): the program moved to stage 2 before the tap — Q15 above the stage card, the view read again.
    h.fake.presale.accounts.set(CONFIG_PDA, {lamports: 3_466_080, data: configData({stage: 1, stageSold: 0n})});
    await buyButton(p).click();
    await expect(p.locator('.banner .banner-title')).toHaveText('Price changed — review again', {timeout: 30_000});
    await expect(p.locator('.stage-card .eyebrow')).toHaveText(/Stage 2 of 10 · live$/, {timeout: 30_000});
    await expect(buyButton(p)).toHaveText(`Buy ${nocText(tokensFor(stableCents(25_000_000n), 1))} NOC`, {timeout: 30_000});
    await frame(p, '23a-refused-price', p.locator('.banner .banner-title'), {ready: buyButton(p)});

    // #20's purchase variant for a returning buyer: no account setup, no #10 (2.5 % of the USDC, $25).
    await buyButton(p).click();
    await expect(p.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
    await expect(p.locator('.review-card .eyebrow')).toHaveText('You are about to buy');
    await expect(p.locator('.review-card .head')).toHaveText('25.00USDC');
    await expect(p.getByText('Account setup (first purchase)')).toHaveCount(0);
    await expect(p.getByText('Confirmation opens in a new tab.')).toHaveCount(0);
    await expect(p.getByText('Compute Budget · Noctura presale')).toBeAttached();
    const buy = p.getByRole('button', {name: 'Buy NOC'});
    await frame(p, '20-purchase', p.locator('.review-card'), {ready: buy, end: true});
    // The To row (Q10 over the vault ATA in groups) and the Network row's words wrapping between words, not inside one.
    const to = p.locator('.detail-row').filter({hasText: 'Noctura presale'});
    await frame(p, '20-purchase-to', to, {ready: buy});
    const network = p.locator('.detail-row .val.app-prose');
    await expect(network).toHaveText("Solana mainnet · sent through Noctura's broadcast route");
    await expect(network).toHaveCSS('word-break', 'normal');

    await buy.click();
    await expect(p.locator('.stage-label')).toHaveText('Purchase confirmed', {timeout: 45_000});
    await expect(p.locator('.top-bar .title')).toHaveText('Purchased');
    await expect(p.locator('.top-bar .status-pill')).toHaveText('Presale');
    await expect(p.locator('.amount-card')).toHaveText('Buying NOC with 25.00 USDC ≈ $25.00 USD');
    await expect(p.locator('.meta-row').first()).toHaveText('ToNoctura presale');
    await frame(p, '21-purchase-confirmed', p.locator('.top-bar .status-pill'), {ready: p.getByRole('button', {name: 'Done'}), end: true});
    expect(h.fake.broadcasts).toHaveLength(1);
    expect(csp).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual · a first purchase: #20 with account setup, #10 describing the purchase, #20 proven (Q58), #21 pending with the badge, #11’s pending row (Q33), 23b, #54 slow and stuck', async () => {
  test.setTimeout(360_000);
  const h = await launchPopup('noctura-e2e-visual-presale-first-');
  const csp = await watchCsp(h.ctx);
  try {
    await presaleWallet(h);
    const p = await home(h);
    await toPresale(p);
    await expect(p.getByText('Your allocation')).toHaveCount(0);
    await amount(p, '0.5', nocText(tokensFor(solCents(SOL / 2n, 150), 0)));
    await buyButton(p).click();
    await expect(p.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
    await expect(p.getByText('Account setup (first purchase)')).toBeVisible();
    await expect(p.getByText('Confirmation opens in a new tab.')).toBeVisible();
    await frame(p, '20-purchase-setup', p.locator('.review-card'), {ready: p.getByRole('button', {name: 'Buy NOC'}), end: true});
    await frame(p, '20-purchase-setup-fees', p.getByText('Account setup (first purchase)'), {ready: p.getByRole('button', {name: 'Buy NOC'})});

    // #10 in a new tab, from the background's description of the purchase (Q18, Q17, the rows).
    const opened = h.ctx.waitForEvent('page');
    await p.getByRole('button', {name: 'Buy NOC'}).click();
    const tab = await opened;
    await tab.setViewportSize({width: 412, height: 916});
    await expect(tab.locator('#ra-about')).toHaveText('Confirm buying NOC with', {timeout: 30_000});
    await expect(tab.locator('#ra-amount')).toHaveText('0.5000');
    await expect(tab.locator('#ra-symbol')).toHaveText('SOL');
    await expect(tab.locator('#ra-reasons')).toContainText('Re-auth required for your first presale purchase from this account.');
    await expect(tab.locator('#ra-confirm')).toBeEnabled();
    await tab.mouse.move(0, 0);
    mkdirSync(DIR, {recursive: true});
    await tab.screenshot({path: `${DIR}/10-purchase.png`, fullPage: true});
    await tab.fill('#ra-password', E2E_PASSWORD);
    await tab.click('#ra-confirm');
    await expect(tab.getByText('Confirmed. Review the fresh quote and buy.')).toBeVisible({timeout: 60_000});
    await tab.setViewportSize({width: 412, height: 600});
    await frame(tab, '20-purchase-proven', tab.getByText('Confirmed. Review the fresh quote and buy.'), {ready: tab.getByRole('button', {name: 'Buy NOC'}), end: true});

    // Held pending (the network never sees it): #21's Q53 with the badge.
    h.fake.mode = 'expire';
    await tab.getByRole('button', {name: 'Buy NOC'}).click();
    await expect(tab.locator('.top-bar .title')).toHaveText('Buying NOC…', {timeout: 30_000});
    await expect(tab.locator('.top-bar .status-pill')).toHaveText('Presale');
    await expect(tab.locator('.amount-card')).toHaveText('Buying NOC with 0.5000 SOL ≈ $75.00 USD');
    await frame(tab, '21-purchase-pending', tab.locator('.top-bar .status-pill'), {end: true});
    await tab.close();

    // #11's pending row (Q33) and 23b from Buy (C30).
    const q = await h.openPopup();
    await expect(q.locator('.app-pending-strip .noc-body-sm')).toHaveText('Buying NOC · pending', {timeout: 30_000});
    await expect(q.locator('.app-presale-banner')).toBeVisible({timeout: 30_000});
    await frame(q, '11-pending-row', q.locator('.app-pending-strip'), {bars: 0});
    await buyAction(q).click();
    await expect(q.locator('.pending-card h3')).toHaveText('Order pending', {timeout: 30_000});
    await expect(q.locator('.pending-card .copy p')).toHaveText('Waiting for confirmation. Claimable after TGE.');
    expect(await q.locator('.pending-card .row').evaluateAll(rs => rs.map(r => [r.querySelector('.l')?.textContent ?? '', r.querySelector('.r')?.textContent ?? '']))).toEqual([
      ['Paid', '0.5000 SOL'],
      ['Estimated NOC', `${nocText(tokensFor(solCents(SOL / 2n, 150), 0))} NOC`],
      ['Stage', '1 of 10 · @ $ 0.1501'],
      ['Tx hash', expect.stringMatching(/^[1-9A-HJ-NP-Za-km-z]{4}…[1-9A-HJ-NP-Za-km-z]{6}$/)],
    ]);
    await expect(q.locator('.s-pre .banner.info')).toHaveText('You can close the popup — Noctura keeps watching this purchase. Funds are non-refundable per presale terms.');
    await expect(q.getByText('View on Solana explorer')).toBeVisible();
    await frame(q, '23b-pending', q.locator('.pending-card'), {ready: q.getByRole('button', {name: 'Done'}), end: true});
    await q.close();

    // #21 → slow → #54 stuck, under the popup's clock (last: the clock runs this context ahead of the background).
    const c = await h.openPopup({clock: true});
    await c.locator('.app-pending-strip').click();
    await expect(c.locator('.top-bar .title')).toHaveText('Buying NOC…', {timeout: 30_000});
    await c.clock.fastForward(83_000);
    await expect(c.getByText('Taking longer than usual')).toBeVisible({timeout: 30_000});
    await c.clock.pauseAt(await c.evaluate(() => Date.now() + 500));
    await expect(c.locator('.top-bar .status-pill')).toHaveText('Presale');
    await frame(c, '21-purchase-slow', c.getByText('Taking longer than usual'), {end: true});
    await c.clock.resume();
    await c.clock.fastForward(8_000);
    await expect(c.getByText('Transaction stuck')).toBeVisible({timeout: 30_000});
    await expect(c.getByText('Buying NOC with 0.5000 SOL')).toBeVisible();
    await frame(c, '54-purchase-stuck', c.getByText('Buying NOC with 0.5000 SOL'), {ready: c.getByRole('button', {name: 'Send again (same transaction)'}), end: true});
    expect(h.fake.broadcasts).toHaveLength(1);
    expect(csp).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual · #44 for a purchase: rejected by the program (Q55) and the blockhash expired; #54 expired', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-visual-presale-failed-');
  const csp = await watchCsp(h.ctx);
  try {
    await presaleWallet(h, {allocation: RETURNING});
    const toConfirm = async (p: Page) => {
      await toPresale(p);
      await amount(p, '0.1', nocText(tokensFor(solCents(SOL / 10n, 150), 0)));
      await buyButton(p).click();
      await expect(p.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
      await p.getByRole('button', {name: 'Buy NOC'}).click();
    };
    // Landed with an error.
    h.fake.mode = 'fail';
    const a = await home(h);
    await toConfirm(a);
    await expect(a.getByText('Program rejected the transaction')).toBeVisible({timeout: 45_000});
    await expect(a.getByText('The presale program rejected the purchase. Only the network fee was charged; your payment did not move and no NOC was bought.')).toBeVisible();
    await expect(a.getByText('Buying NOC with 0.1000 SOL')).toBeVisible();
    await frame(a, '44-purchase-rejected', a.getByText('The presale program rejected the purchase. Only the network fee was charged; your payment did not move and no NOC was bought.'), {ready: a.getByRole('button', {name: 'Try again'}), end: true});
    await a.close();
    // Never seen, past its blockhash before #54 showed.
    h.fake.mode = 'expire';
    const b = await homeAfter(h);
    await toConfirm(b);
    await expect(b.locator('.top-bar .title')).toHaveText('Buying NOC…', {timeout: 30_000});
    const pending = (await msg(b, {type: 'wallet.pending'})).data as {lastValidBlockHeight: number; state: string}[];
    h.fake.blockHeight = (pending.find(r => r.state === 'pending')?.lastValidBlockHeight ?? 0) + 33;
    await expect(b.getByText('Recent blockhash expired')).toBeVisible({timeout: 45_000});
    await expect(b.getByText('Buying NOC with 0.1000 SOL')).toBeVisible();
    await frame(b, '44-purchase-expired', b.getByText('Recent blockhash expired'), {ready: b.getByRole('button', {name: 'Try again'}), end: true});
    await b.close();
    // #54 expired: stuck first (the popup's clock), then past its blockhash.
    const c = await homeAfter(h);
    await toConfirm(c);
    await expect(c.locator('.top-bar .title')).toHaveText('Buying NOC…', {timeout: 30_000});
    await c.close();
    const s = await h.openPopup({clock: true});
    await s.locator('.app-pending-strip').click();
    await s.clock.fastForward(91_000);
    await expect(s.getByText('Transaction stuck')).toBeVisible({timeout: 30_000});
    const open = (await msg(s, {type: 'wallet.pending'})).data as {lastValidBlockHeight: number; state: string}[];
    h.fake.blockHeight = (open.find(r => r.state === 'pending')?.lastValidBlockHeight ?? 0) + 33;
    await expect(s.getByText('Not confirmed — no funds moved.')).toBeVisible({timeout: 45_000});
    await frame(s, '54-purchase-expired', s.getByText('Not confirmed — no funds moved.'), {ready: s.getByRole('button', {name: 'Try again'})});
    expect(csp).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual · #23 with no SOL price (Q19), and its closed answers: inactive (Q13), blocked (Q14), unavailable (Q11)', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-visual-presale-closed-');
  const csp = await watchCsp(h.ctx);
  try {
    h.fake.marketSolUsd = null;
    await presaleWallet(h, {allocation: RETURNING});
    h.fake.tokenAccounts.get(ACCOUNT)?.push({pubkey: USDC_HOLDING, mint: USDC_MINT, amount: '1000000000', decimals: 6});
    const p = await home(h);
    await toPresale(p);
    // C8: no estimate for SOL without its price — the line before any amount, Buy disabled, the sub without "1 SOL ≈".
    await expect(p.locator('.input-card .helper.error')).toHaveText('SOL price unavailable — pay with USDC or USDT, or try again later.', {timeout: 30_000});
    await expect(p.locator('.input-card .lbl-row').nth(1)).toHaveText('YOU RECEIVE (EST.)@ $ 0.1501');
    await expect(buyButton(p)).toHaveText('Buy NOC');
    await expect(buyButton(p)).toBeDisabled();
    await frame(p, '23a-no-sol-price', p.locator('.input-card .helper.error'));

    const closedBy = async (name: string, change: () => void, line: string, eyebrow: string | null) => {
      const s = await homeAfter(h);
      await toPresale(s);
      await currency(s, 'USD Coin', 'USDC');
      await amount(s, '25', nocText(tokensFor(stableCents(25_000_000n), 0)));
      change();
      await buyButton(s).click();
      await expect(s.locator('.banner .banner-title')).toHaveText(line, {timeout: 30_000});
      await expect(s.locator('.sticky-bar')).toHaveCount(0);
      if (eyebrow === null) await expect(s.locator('.stage-card')).toHaveCount(0);
      else await expect(s.locator('.stage-card .eyebrow')).toHaveText(eyebrow);
      await frame(s, name, s.locator('.banner .banner-title'), {bars: 0});
      await s.close();
    };
    // Blocked and unavailable first: an inactive sale empties #11's banner (and its Buy) for the banner's minute.
    await closedBy('23-closed-blocked', () => h.fake.presale.accounts.set(userPda(ACCOUNT), {lamports: 944_880, data: userData({blocked: true})}), "This account can't buy in the presale.", 'Stage 1 of 10 · live');
    h.fake.presale.accounts.set(userPda(ACCOUNT), {lamports: 944_880, data: userData()});
    await closedBy('23-closed-unavailable', () => void (h.fake.presale.read = 'unreachable'), 'Presale unavailable — try again later.', null);
    h.fake.presale.read = 'ok';
    await closedBy('23-closed-inactive', () => h.fake.presale.accounts.set(CONFIG_PDA, {lamports: 3_466_080, data: configData({active: false})}), 'The presale is not open.', 'Stage 1 of 10');
    expect(h.fake.broadcasts).toEqual([]);
    expect(csp).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual · #23 when the coordinator refuses this network at the Buy tap (Q12)', async () => {
  test.setTimeout(240_000);
  // Its own browser: the 403 latches every coordinator request of this browser for 10 minutes (the shared cool-down).
  const h = await launchPopup('noctura-e2e-visual-presale-refused-');
  const csp = await watchCsp(h.ctx);
  try {
    await presaleWallet(h, {allocation: RETURNING});
    h.fake.tokenAccounts.get(ACCOUNT)?.push({pubkey: USDC_HOLDING, mint: USDC_MINT, amount: '1000000000', decimals: 6});
    const p = await home(h);
    await toPresale(p);
    await currency(p, 'USD Coin', 'USDC');
    await amount(p, '25', nocText(tokensFor(stableCents(25_000_000n), 0)));
    // §5: "coordinator-refused (403 / cool-down) · anywhere · Q12 on #23". A ban that starts mid-prepare — after the
    // gate and the state read answered, at the simulation: #23a stays as read, Q12 above the stage card, Buy disabled for
    // the cool-down; nothing prepared. A ban already in place refuses the gate first, which is #50b `refused` (shot as
    // 50b-refused); the view's own closed `refused` answer is not reachable for the same reason (its gate is asked in
    // the same breath as its state read and shares the latch).
    h.fake.presale.read = 'refused';
    await buyButton(p).click();
    await expect(p.locator('.banner .banner-title')).toHaveText('The presale service refused this network.', {timeout: 30_000});
    await expect(p.locator('.stage-card .eyebrow')).toHaveText(/^ ?Stage 1 of 10 · live$/);
    await expect(buyButton(p)).toBeDisabled();
    await frame(p, '23-closed-refused', p.locator('.banner .banner-title'));
    expect(h.fake.presale.simulated).toEqual([]);
    expect(h.fake.hits.filter(x => x.rpcMethod === 'simulateTransaction')).toHaveLength(1);
    expect(h.fake.broadcasts).toEqual([]);
    expect(csp).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});

/** #50b's own copy: the headline. */
const headline = (p: Page) => p.locator('.s11-geo-hero h2');
/** #11 → Buy → #50b, shot, [Got it] → #11. */
async function geoShot(p: Page, name: string, title: string, sub: string, region: string | null, o: {refused?: boolean} = {}): Promise<void> {
  await buyAction(p).click();
  await expect(headline(p)).toHaveText(title, {timeout: 30_000});
  await expect(p.locator('.s11-geo-hero p')).toHaveText(sub);
  // §4.3's table: the region card names the country for `sanctioned` (and `stale_list`); the disclosure line alone otherwise.
  const named = p.locator('.s11-geo-region .app-geo-primary');
  if (region === null) await expect(named).toHaveCount(0);
  else await expect(named).toHaveText(region);
  await expect(p.locator('.s11-geo-region .app-geo-disclosure')).toHaveText('Approximated from your IP. No GPS, no device location.');
  await frame(p, name, headline(p), {ready: p.getByRole('button', {name: 'Got it'}), end: true});
  await p.getByRole('button', {name: 'Got it'}).click();
  if (o.refused === true) await expect(p.locator('.app-presale-banner')).toHaveCount(0, {timeout: 30_000});
  else await expect(p.locator('.app-presale-banner')).toBeVisible({timeout: 30_000});
}

test('visual · #50b: open (from #23’s link), no check, unknown country, sanctioned; 23b with the region line beneath; refused', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-visual-presale-geo-');
  const csp = await watchCsp(h.ctx);
  try {
    await presaleWallet(h);
    const p = await home(h);
    await toPresale(p);
    await p.getByRole('button', {name: 'Not available in your region?'}).click();
    await expect(headline(p)).toHaveText('NOC presale is open in your region', {timeout: 30_000});
    await expect(p.locator('.s11-geo-hero p')).toHaveCount(0);
    await expect(p.locator('.s11-stillworks')).toHaveCount(0);
    // D22: the open variant names the region the gate detected, above the disclosure line.
    await expect(p.locator('.s11-geo-region .col > *')).toHaveText(['Detected region: Slovenia · EU', 'Approximated from your IP. No GPS, no device location.']);
    await frame(p, '50b-open', headline(p), {ready: p.getByRole('button', {name: 'Got it'})});
    await p.getByRole('button', {name: 'Got it'}).click();
    await p.getByRole('button', {name: 'Back'}).click();

    h.fake.geo.check = 'unreachable';
    await geoShot(p, '50b-no-check', "The presale can't be opened right now", 'The region check is unavailable — try again later.', null);
    h.fake.geo.check = {countryCode: 'XX', isVpn: false};
    await geoShot(p, '50b-unknown-country', "The presale can't be opened right now", 'Your region could not be determined from your IP.', null);
    h.fake.geo.check = {countryCode: 'KP', isVpn: true};
    await geoShot(p, '50b-sanctioned', "NOC presale isn't open in your region", "This wallet doesn't offer the presale in your region. You can still hold, send and receive any NOC you already have.", 'Detected region: North Korea');

    // C30: a purchase pending — 23b with the region line beneath (a link to #50b).
    h.fake.mode = 'expire';
    await h.sw.evaluate(r => chrome.storage.local.set({v1_pending: [r]}), pendingPurchase('e9'.repeat(16)));
    const q = await home(h);
    await buyAction(q).click();
    await expect(q.locator('.pending-card h3')).toHaveText('Order pending', {timeout: 30_000});
    await expect(q.locator('.app-pre-region')).toHaveText("Not available here — This wallet doesn't offer the presale in your region.");
    await frame(q, '23b-region', q.locator('.app-pre-region'), {ready: q.getByRole('button', {name: 'Done'}), end: true});
    h.fake.mode = 'confirm';
    await q.getByRole('button', {name: 'Done'}).click();
    await expect(q.locator('.app-pending-strip')).toHaveCount(0, {timeout: 45_000});
    await q.close();

    h.fake.geo.check = {countryCode: 'SI', isVpn: false};
    const r = await home(h);
    h.fake.network = 'forbidden';
    await geoShot(r, '50b-refused', "The presale can't be opened right now", 'The presale service refused this network.', null, {refused: true});
    expect(h.fake.presale.simulated).toEqual([]);
    expect(csp).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual · #50b: a stale restricted list, with the detected region', async () => {
  const h = await launchPopup('noctura-e2e-visual-presale-stale-');
  const csp = await watchCsp(h.ctx);
  try {
    h.fake.geo.list = restrictedList({ageDays: 40});
    await presaleWallet(h);
    const p = await home(h);
    await buyAction(p).click();
    await expect(headline(p)).toHaveText("The presale can't be opened right now", {timeout: 30_000});
    await expect(p.locator('.s11-geo-region .app-geo-primary')).toHaveText('Detected region: Slovenia · EU');
    await expect(p.locator('.s11-geo-hero p')).toHaveText('The restricted-region list is out of date.');
    await frame(p, '50b-stale-list', headline(p), {ready: p.getByRole('button', {name: 'Got it'}), end: true});
    expect(csp).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});

const BLOCKHASH = base58.encode(new Uint8Array(32).fill(7));
/** #48 for a site's presale purchase, F12 (Q49–Q51): Reject only, wholly in the 412 × 720 window, shot; Reject answers the site. */
async function f12(h: Harness, page: Page, name: string, body: string): Promise<void> {
  let request!: Promise<unknown>;
  const win = await approvalWindow(h.ctx, () => (request = adapter.customSign(page, BLOCKHASH, [solPurchaseIx(ACCOUNT, 100_000_000n)])));
  await win.setViewportSize({width: 412, height: 720});
  const banner = win.locator('.s9-flag-banner.danger');
  await expect(banner.locator('.head')).toHaveText('Presale purchase blocked', {timeout: 15_000});
  await expect(banner).toContainText(body);
  await expect(banner).toContainText('Only Reject is available · no override');
  expect(await win.locator('.sticky-bar button').allTextContents()).toEqual(['Reject']);
  await expect(banner).toBeInViewport();
  await wholeBar(win, name, 1);
  await expect(win.getByRole('button', {name: 'Reject'})).toBeEnabled();
  await win.mouse.move(0, 0);
  mkdirSync(DIR, {recursive: true});
  await win.screenshot({path: `${DIR}/${name}.png`});
  await win.getByRole('button', {name: 'Reject'}).click();
  expect(((await request) as {ok: boolean}).ok).toBe(false);
  await windowClosed(win);
}
for (const [build, ext, suffix] of [
  ['on', EXT, ''],
  ['off', EXT_NOPRESALE, '-off'],
] as const) {
  test(`visual · #48 F12 (${build} build): sanctioned (Q50a with the country) and no check (Q50b)`, async () => {
    test.setTimeout(240_000);
    const h = await launchPopup(`noctura-e2e-visual-presale-f12-${build}-`, {hosts: DAPP_HOSTS, ext});
    const server = await serveDapp(h.ctx);
    const csp = await watchCsp(h.ctx);
    try {
      installPresale(h, {allocation: RETURNING});
      await h.sw.evaluate(({env, treasury}) => chrome.storage.local.set({v1_vault: env, v1_known_recipients: [{address: treasury, at: Date.now()}]}), {env: await makeEnvelope(), treasury: SOL_TREASURY});
      const vault = await h.ctx.newPage();
      await unlockWith(vault, h.id, E2E_PASSWORD);
      await vault.close();
      const popup = await h.openPopup();
      await expect(popup.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
      const page = await openDapp(h.ctx, 'https://dapp.test');
      let c!: Promise<unknown>;
      const win = await approvalWindow(h.ctx, () => (c = adapter.connect(page)));
      await win.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
      await win.getByRole('checkbox', {name: /I've read these permissions/}).click();
      await win.getByRole('button', {name: 'Connect for this session'}).click();
      expect(await c).toEqual({ok: true, value: ACCOUNT});
      await windowClosed(win);
      h.fake.geo.check = {countryCode: 'KP', isVpn: false};
      await f12(h, page, `48-f12-sanctioned${suffix}`, "This transaction buys NOC in the presale, which this wallet doesn't allow from your region (North Korea).");
      h.fake.geo.check = 'unreachable';
      await f12(h, page, `48-f12-no-check${suffix}`, "This transaction buys NOC in the presale. The wallet's region check did not succeed, so it can't be approved — try again later.");
      expect(h.fake.broadcasts).toEqual([]);
      expect(csp).toEqual([]);
      contained(h);
      expect(server.unexpected).toEqual([]);
    } finally {
      await h.close();
    }
  });
}

// ---- B1d-2 (Task 7) ----

const Q47 = "Saved to your presale account with this purchase. It can't be changed later.";
/** The element's text sits on one line (its box less than one and a half of its line height). */
const oneLine = (l: Locator) => l.evaluate(e => e.getBoundingClientRect().height < 1.5 * parseFloat(getComputedStyle(e).lineHeight));
/** #24's three figures as shown (REFERRALS, EARNED, REFERRED). */
const figures = (p: Page) => p.locator('.s-ref .stats .stat .val').allTextContents();
test('visual · #31 with "Refer a friend"; #24 populated, copied (24a-bis without the toast), a null stat, empty (24b)', async () => {
  test.setTimeout(240_000);
  const h = await launchPopup('noctura-e2e-visual-presale-referral-');
  const csp = await watchCsp(h.ctx);
  try {
    await presaleWallet(h, {allocation: {...RETURNING, bonusBase: 32_412_345_678n}});
    h.fake.referralStats = {status: 200, body: {success: true, data: {totalReferrals: 12, totalReferredUsd: 1234.56, totalReferredPurchases: 14}}};
    const p = await h.openPopup({clock: true});
    await expect(p.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
    await p.getByRole('button', {name: 'Settings'}).click();
    const row = p.locator('.s7-row', {hasText: 'Refer a friend'});
    await expect(p.locator('.s7-group-label', {hasText: 'Rewards'})).toBeVisible({timeout: 30_000});
    await frame(p, '31-refer-row', row, {ready: row, bars: 0});
    await row.click();
    await expect(p.locator('.s-ref .top-bar .title')).toHaveText('Refer a friend', {timeout: 30_000});
    await expect.poll(() => figures(p), {timeout: 30_000}).toEqual(['12', '32.4', '$1,234.56']);
    await expect(p.locator('.s-ref .stats .stat .val.acc')).toHaveText('32.4');
    // Found by this pass: "$1,234.56" wrapped after its comma in its third of the row — now a size smaller, on one line.
    expect(await oneLine(p.locator('.s-ref .stats .stat .val').nth(2)), 'REFERRED on one line').toBe(true);
    await expect(p.locator('.s-ref .code-card .lbl-row')).toHaveText('YOUR INVITE LINKUsed by 12 people', {timeout: 30_000});
    await expect(p.locator('.s-ref .code-card .code-row .code')).toHaveText(`https://noc-tura.io?ref=${ACCOUNT}`);
    await expect(p.locator('.s-ref .banner')).toHaveText('Earn NOC when friends you invite buy in the presale.');
    await expect(p.locator('.s-ref .legalese')).toHaveText('Referral payouts are subject to program terms. Self-referrals are detected and rejected.');
    const copy = p.locator('.s-ref .code-card .actions button');
    await frame(p, '24-referral', p.locator('.s-ref .code-card'), {ready: copy, bars: 0});

    // 24a-bis: the checkmark and the accent border while useCopy says copied (its 2 s, the popup's clock held).
    await p.clock.pauseAt(Date.now() + 1_000);
    await copy.click();
    await expect(copy).toHaveAttribute('aria-label', 'Copied');
    await expect(p.locator('.s-ref .code-card .code-row.app-ref-copied')).toHaveCount(1);
    await expect(p.locator('.s-ref .share-btn')).toHaveText('Copied');
    await frame(p, '24-referral-copied', p.locator('.s-ref .code-card'), {bars: 0});
    await p.clock.runFor(2_000);
    await expect(p.locator('.s-ref .code-card .code-row.app-ref-copied')).toHaveCount(0);
    await p.clock.resume();

    // A null stat: /referral-stats fails — its two figures "—", the usage line hidden, EARNED still the chain's.
    h.fake.referralStats = {status: 500, body: {success: false, error: 'connection terminated'}};
    await p.getByRole('button', {name: 'Back'}).click();
    await p.locator('.s7-row', {hasText: 'Refer a friend'}).click();
    await expect.poll(() => figures(p), {timeout: 30_000}).toEqual(['—', '32.4', '—']);
    await expect(p.locator('.s-ref .code-card .lbl-row .uses')).toHaveCount(0);
    await frame(p, '24-referral-null-stat', p.locator('.s-ref .stats'), {ready: copy, bars: 0});

    // 24b: nobody referred yet and no allocation on chain — zeros, "Not used yet", EARNED in the tertiary tone.
    h.fake.referralStats = {status: 200, body: {success: true, data: {totalReferrals: 0, totalReferredUsd: 0}}};
    h.fake.presale.accounts.delete(allocationPda(ACCOUNT));
    await p.getByRole('button', {name: 'Back'}).click();
    await p.locator('.s7-row', {hasText: 'Refer a friend'}).click();
    await expect.poll(() => figures(p), {timeout: 30_000}).toEqual(['0', '0.0', '$0.00']);
    await expect(p.locator('.s-ref .stats .stat .val.app-ref-muted')).toHaveText('0.0');
    await expect(p.locator('.s-ref .code-card .lbl-row .uses')).toHaveText('Not used yet');
    await frame(p, '24-referral-empty', p.locator('.s-ref .code-card'), {ready: copy, bars: 0});
    expect(h.fake.referralStatsReads).toEqual([ACCOUNT, ACCOUNT, ACCOUNT]);
    expect(csp).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});

/** #23a's referral address: `text` typed, the field left (blur — the background's check), its line awaited (null: none). */
async function referrerTyped(p: Page, text: string, line: string | null): Promise<void> {
  const field = p.getByLabel('Referral address (optional)');
  await field.fill(text);
  await field.blur();
  const helper = p.locator('.app-pre-referral .helper');
  if (line === null) {
    await expect(buyButton(p)).toBeEnabled({timeout: 30_000});
    await expect(helper).toHaveCount(0);
  } else {
    await expect(helper).toHaveText(line, {timeout: 30_000});
    await expect(buyButton(p)).toBeDisabled();
  }
}
/** #20's "Referred by": the whole address in groups of four, and Q47's note (null: none). */
async function referredBy(p: Page): Promise<{address: string; note: string | null}> {
  const row = p.locator('.detail-row', {hasText: 'Referred by'});
  await expect(row).toHaveCount(1);
  const note = row.locator('.app-pre-note');
  return {address: (await row.locator('.addr-groups > span').allTextContents()).join(''), note: (await note.count()) === 0 ? null : await note.textContent()};
}

test('visual · #23a’s referral address: Q46a, Q46b, Q46c and a valid address; #20 with "Referred by" and Q47; #10 saying it', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-visual-presale-referrer-');
  const csp = await watchCsp(h.ctx);
  try {
    await presaleWallet(h);
    installReferrer(h);
    const p = await home(h);
    await toPresale(p);
    await amount(p, '0.5', nocText(tokensFor(solCents(SOL / 2n, 150), 0)));
    const field = p.getByLabel('Referral address (optional)');
    await expect(field).toHaveAttribute('placeholder', 'Solana address of the person who invited you');
    await frame(p, '23a-referrer-empty', field, {ready: buyButton(p), end: true});
    await referrerTyped(p, 'not-an-address', 'Not a valid Solana address');
    await frame(p, '23a-referrer-invalid', p.locator('.app-pre-referral'), {end: true});
    await referrerTyped(p, ACCOUNT, "You can't refer yourself or another account in this wallet");
    await frame(p, '23a-referrer-self', p.locator('.app-pre-referral'));
    await referrerTyped(p, base58.encode(new Uint8Array(32).fill(55)), "This address has no presale allocation, so it can't receive a referral bonus");
    await frame(p, '23a-referrer-no-allocation', p.locator('.app-pre-referral'));
    await referrerTyped(p, REFERRER, null);
    await expect(field).toHaveValue(REFERRER);
    await frame(p, '23a-referrer-valid', p.locator('.app-pre-referral'), {ready: buyButton(p)});

    await buyButton(p).click();
    await expect(p.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
    expect(await referredBy(p)).toEqual({address: REFERRER, note: Q47});
    const buy = p.getByRole('button', {name: 'Buy NOC'});
    await frame(p, '20-referred-by', p.locator('.detail-row', {hasText: 'Referred by'}), {ready: buy, end: true});

    // #10 in a new tab: the background's description repeats who, and that this purchase saves it.
    const opened = h.ctx.waitForEvent('page');
    await buy.click();
    const tab = await opened;
    await tab.setViewportSize({width: 412, height: 916});
    await expect(tab.locator('#ra-about')).toHaveText('Confirm buying NOC with', {timeout: 30_000});
    await expect(tab.locator('#ra-rows')).toContainText('Referred by');
    await expect(tab.locator('#ra-rows')).toContainText(REFERRER);
    await expect(tab.locator('#ra-rows')).toContainText(Q47);
    // Found by this pass: the label wrapped ("Referred / by") beside the address's groups — one line now, as "To".
    expect(await oneLine(tab.locator('#ra-rows .intent-row .label', {hasText: /^Referred by$/})), '#10: "Referred by" on one line').toBe(true);
    await expect(tab.locator('#ra-confirm')).toBeEnabled();
    await tab.mouse.move(0, 0);
    mkdirSync(DIR, {recursive: true});
    await tab.screenshot({path: `${DIR}/10-referred-by.png`, fullPage: true});
    expect(h.fake.broadcasts).toEqual([]);
    expect(csp).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual · #23a when the address can no longer apply (Q48: a referrer registered meanwhile — the field gone); #20 and #10 naming the on-chain referrer without Q47', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-visual-presale-q48-');
  const csp = await watchCsp(h.ctx);
  try {
    await presaleWallet(h);
    installReferrer(h);
    const p = await home(h);
    await toPresale(p);
    await amount(p, '0.5', nocText(tokensFor(solCents(SOL / 2n, 150), 0)));
    await p.getByLabel('Referral address (optional)').fill(REFERRER);
    // Another device registers REFERRER for this account (no purchase yet) before the field is left.
    h.fake.presale.accounts.set(userPda(ACCOUNT), {lamports: 944_880, data: userData()});
    h.fake.presale.accounts.set(allocationPda(ACCOUNT), {lamports: 1_244_600, data: allocationData({user: ACCOUNT, totalBase: 0n, spentCents: 0n, count: 0, referrer: REFERRER})});
    await p.getByLabel('Referral address (optional)').blur();
    await expect(p.locator('.banner .banner-title')).toHaveText('This account can no longer take a referrer — review again', {timeout: 30_000});
    await expect(p.locator('#presale-referrer')).toHaveCount(0);
    await frame(p, '23a-referrer-not-applicable', p.locator('.banner .banner-title'), {ready: buyButton(p)});

    await buyButton(p).click();
    await expect(p.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
    expect(await referredBy(p)).toEqual({address: REFERRER, note: null});
    const buy = p.getByRole('button', {name: 'Buy NOC'});
    await frame(p, '20-referred-onchain', p.locator('.detail-row', {hasText: 'Referred by'}), {ready: buy, end: true});
    const opened = h.ctx.waitForEvent('page');
    await buy.click();
    const tab = await opened;
    await tab.setViewportSize({width: 412, height: 916});
    await expect(tab.locator('#ra-rows')).toContainText('Referred by', {timeout: 30_000});
    await expect(tab.locator('#ra-rows')).not.toContainText(Q47);
    await expect(tab.locator('#ra-confirm')).toBeEnabled();
    await tab.mouse.move(0, 0);
    mkdirSync(DIR, {recursive: true});
    await tab.screenshot({path: `${DIR}/10-referred-onchain.png`, fullPage: true});
    expect(h.fake.broadcasts).toEqual([]);
    expect(csp).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});

const Q34 = 'Recorded on chain; presale service not yet updated';
test('visual · #26 with the "Presale" badge (the wallet’s purchase, and a site’s with two badges wrapped under its title); #27 with Q34', async () => {
  test.setTimeout(240_000);
  const h = await launchPopup('noctura-e2e-visual-presale-history-');
  const csp = await watchCsp(h.ctx);
  try {
    await presaleWallet(h, {allocation: RETURNING});
    const now = Math.floor(Date.now() / 1000);
    const ours = sig(31);
    const sites = sig(32);
    h.fake.history.set(ACCOUNT, [
      {signature: sig(30), tx: sentSol(ACCOUNT, SOL_TREASURY, 120_000_000, now - 60)},
      {signature: ours, tx: presalePurchase(ACCOUNT, 500_000_000, now - 3_600)},
      {signature: sites, tx: presalePurchase(ACCOUNT, 250_000_000, now - 7_200)},
    ]);
    // The site's purchase is B1c-2's record of what a site had this wallet sign; ours was given up by the coordinator
    // record (§2.4: 72 h without an accepted POST — nothing is POSTed for it any more).
    const payload = {txHash: ours, buyerAddress: ACCOUNT, paymentToken: 'SOL', paymentAmount: '0.5', nocAmount: 499.66688874, usdValue: 75, stage: 1};
    const confirmedAt = Date.now() - 80 * 3_600_000;
    await h.sw.evaluate(
      ({site, entry}) => chrome.storage.local.set({v1_dapp_txs: [{signature: site, origin: 'https://presale.example', at: 1}], v1_presale_records: [entry]}),
      {site: sites, entry: {signature: ours, account: ACCOUNT, payload, confirmedAt, attempts: 9, nextAt: confirmedAt + 72 * 3_600_000, state: 'given-up'}},
    );
    const p = await home(h);
    await p.getByRole('button', {name: 'Activity'}).click();
    const purchases = p.locator('.tx-row', {hasText: 'Presale purchase'});
    await expect(purchases).toHaveCount(2, {timeout: 30_000});
    await expect(purchases.nth(0).locator('.pri .status-pill.app-badge')).toHaveText('Presale');
    await expect(purchases.nth(1).locator('.pri > span')).toHaveText(['Presale', 'Dapp · simulated']);
    await expect(p.locator('.tx-row', {hasText: 'Sent SOL'}).locator('.app-badge')).toHaveCount(0);
    // The site's row: its badges wrap under the title — the meta column holds the row, the amount clear of it.
    const pri = purchases.nth(1).locator('.pri');
    expect(await pri.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    await frame(p, '26-presale-badges', purchases.nth(1), {bars: 0});

    await purchases.nth(0).click();
    await expect(p.locator('.s-txd .amount-card .eyebrow')).toHaveText('PRESALE PURCHASE', {timeout: 30_000});
    await expect(p.locator('.s-txd .banner.info')).toHaveText(Q34, {timeout: 30_000});
    await frame(p, '27-unrecorded', p.locator('.s-txd .banner.info'), {end: true, bars: 0});
    expect(h.fake.purchaseRecords).toEqual([]);
    expect(csp).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});
