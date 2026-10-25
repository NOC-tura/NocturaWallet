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
import {CONFIG_PDA, SOL_TREASURY, USDC_MINT, configData, nocText, restrictedList, solCents, solPurchaseIx, stableCents, tokensFor, userData, userPda} from './presaleChain';
import {USDC_HOLDING, amount, buyAction, home, installPresale, presaleWallet, quickLabels, watchCsp} from './presaleHelpers';
import {DIR} from './visualTab';

declare const chrome: {storage: {local: {set(o: object): Promise<void>}}};

// B1d §6.4 (B1d-1b Task 9): every state B1d-1b built, driven through the real extension against the contained fake
// coordinator (the presale program on its chain, /geo/check and /geo/restricted-list scripted) and saved for the
// opus-tier review against index.html (#23 ix 10603-10902, #50 ix 19612-19906, #11 ix 6272-6621, #20, #21, #44, #54,
// #48 ix 18261-18705, #10). The popup at 412 × 600 (its frame, §4), the approval window at 412 × 720 (its
// windows.create size), the vault page at 412 × 916. Every shot asserts its own copy first, then that its sticky bar
// is wholly in the frame and the copy clear of the pinned bars, and is taken after the screen's holds (a LockedButton's
// 500 ms floor, #48's 1.5 s arming): an enabled CTA is awaited enabled. A screen taller than its frame is shot again
// scrolled to its end (`-end`), the bar still wholly in view. Not a pixel diff.

const SOL = 1_000_000_000n;
/** A returning buyer's allocation on chain (two purchases): no account setup, no first-purchase re-authentication. */
const RETURNING = {totalBase: 1_998_667_554_963n, spentCents: 30_000n, count: 2};

/**
 * A popup or tab shot from the screen's top: `copy` visible, wholly in the frame and clear of the pinned bars (scrolled
 * to the middle of the frame only when it is not), the sticky bar and each of its buttons wholly in the frame, `ready` awaited enabled, the pointer off the column.
 * `end`: the screen is taller than the frame (asserted, so the check is not vacuous) and is shot again at its end.
 */
async function frame(p: Page, name: string, copy: Locator, o: {ready?: Locator; end?: boolean} = {}): Promise<void> {
  await expect(copy).toBeVisible({timeout: 30_000});
  await top(p);
  const bars = p.locator('main.app-content > .screen > .top-bar, main.app-content > .screen > .sticky-bar, nav.app-tab-bar');
  const vh = p.viewportSize()?.height ?? 0;
  const under = async (): Promise<string | null> => {
    const box = await copy.boundingBox();
    if (box === null) return 'no box';
    if (box.y < 0 || box.y + box.height > vh) return 'outside the frame';
    const el = await copy.elementHandle();
    for (const bar of await bars.all()) {
      const b = await bar.boundingBox();
      if (b === null || (await bar.evaluate((e, x) => e.contains(x), el))) continue;
      if (box.y < b.y + b.height && b.y < box.y + box.height) return await bar.evaluate(e => e.className);
    }
    return null;
  };
  if ((await under()) !== null) await copy.evaluate(e => e.scrollIntoView({block: 'center'}));
  await expect(copy).toBeInViewport();
  expect(await under(), `${name}: the copy clear of the pinned bars`).toBeNull();
  await wholeBar(p, name);
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
  await wholeBar(p, `${name} (end)`);
  await p.screenshot({path: `${DIR}/${name}-end.png`});
  await top(p);
}
/** Every scroll area of the screen back at its top: each shot starts from the screen as it opens. */
const top = (p: Page) =>
  p.evaluate(() => {
    for (const e of document.querySelectorAll<HTMLElement>('main.app-content, main.app-content *')) if (e.scrollTop > 0) e.scrollTo(0, 0);
  });
/** The screen's sticky bar and every button in it wholly inside the viewport (none: nothing to check, asserted by the caller's copy). */
async function wholeBar(p: Page, name: string): Promise<void> {
  const bar = p.locator('.sticky-bar').filter({visible: true});
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
    await frame(p, '11-presale-banner', p.locator('.app-presale-banner'), {ready: p.locator('.app-presale-banner')});

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

    // 0.05 SOL at $150 is $7.50: under the config's $10 — the line, Buy disabled (no estimate in its label).
    await p.getByLabel('YOU PAY').fill('0.05');
    await expect(p.locator('.input-card .helper.error')).toHaveText('Minimum $10', {timeout: 30_000});
    await expect(buyButton(p)).toBeDisabled();
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
    await frame(q, '11-pending-row', q.locator('.app-pending-strip'));
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
    await expect(a.getByText('The presale program returned an error. The network fee was charged; no NOC was bought.')).toBeVisible();
    await expect(a.getByText('Buying NOC with 0.1000 SOL')).toBeVisible();
    await frame(a, '44-purchase-rejected', a.getByText('The presale program returned an error. The network fee was charged; no NOC was bought.'), {ready: a.getByRole('button', {name: 'Try again'}), end: true});
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
      await frame(s, name, s.locator('.banner .banner-title'));
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

/** #50b's own copy: the headline. */
const headline = (p: Page) => p.locator('.s11-geo-hero h2');
/** #11 → Buy → #50b, shot, [Got it] → #11. */
async function geoShot(p: Page, name: string, title: string, sub: string, o: {refused?: boolean} = {}): Promise<void> {
  await buyAction(p).click();
  await expect(headline(p)).toHaveText(title, {timeout: 30_000});
  await expect(p.locator('.s11-geo-hero p')).toHaveText(sub);
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
    await geoShot(p, '50b-no-check', "The presale can't be opened right now", 'The region check is unavailable — try again later.');
    h.fake.geo.check = {countryCode: 'XX', isVpn: false};
    await geoShot(p, '50b-unknown-country', "The presale can't be opened right now", 'Your region could not be determined from your IP.');
    h.fake.geo.check = {countryCode: 'KP', isVpn: true};
    await geoShot(p, '50b-sanctioned', "NOC presale isn't open in your region", "This wallet doesn't offer the presale in your region. You can still hold, send and receive any NOC you already have.");
    await expect(p.locator('.s11-geo-region')).toHaveCount(0);

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
    await geoShot(r, '50b-refused', "The presale can't be opened right now", 'The presale service refused this network.', {refused: true});
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
  await wholeBar(win, name);
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
