import {test, expect, type Page} from '@playwright/test';
import {base58, base64} from '@scure/base';
import {BLOCKHASH_LIFETIME, FAKE_START_HEIGHT, parseV0} from './fakeCoordinator';
import {E2E_PASSWORD} from './makeEnvelope';
import {ACCOUNT, groups, msg, startSend} from './sendHelpers';
import {
  ALLOCATION_RENT,
  CONFIG_PDA,
  PRESALE_PROGRAM,
  SOL_TREASURY,
  USDC_MINT,
  USDC_VAULT,
  USER_ACCOUNT_RENT,
  allocationOf,
  allocationPda,
  configData,
  configPda,
  nocText,
  restrictedList,
  solCents,
  stableCents,
  tokensFor,
} from './presaleChain';
import {USDC_HOLDING, amount, buyAction, cspControl, detailRows, done, geoScreen, home, preparedPurchase, presaleWallet, quickLabels, scene} from './presaleHelpers';

declare const chrome: {storage: {local: {set(o: object): Promise<void>}}};

// B1d §6.3 E2E 1–6 and 8 (B1d-1b Task 8): the presale in the real extension (popup, vault page, UI tab, background)
// against the contained fake coordinator with the presale program's state on its chain (presaleChain.ts: the config,
// the buyer's PDAs, the treasury's vault ATAs; the program's checks and arithmetic applied to every simulated and
// broadcast purchase) and scriptable /geo/check and /geo/restricted-list. Every spec ends with contained(h) — the fake
// saw the worker's requests, nothing unexpected, Solscan and every other noc-tura.io name never contacted — and no CSP
// violation on any page. E2E 9 (#48's F12) is presaleDapp.spec.ts; E2E 7 (the off build) presaleOff.spec.ts.

const SOL = 1_000_000_000n;
/** The re-authentication line under #20's Buy for a popup (B1b): the proof opens in a new tab. */
const OPENS_TAB = 'Confirmation opens in a new tab.';
const Q = {
  q15: 'Price changed — review again',
  q11: 'Presale unavailable — try again later.',
  q17: 'Re-auth required for your first presale purchase from this account.',
  q20: 'NOC presale is open in your region',
  q21: "This wallet doesn't offer the presale in your region. You can still hold, send and receive any NOC you already have.",
  q23: "The presale can't be opened right now",
  q52: 'The presale is busy right now — try again.',
  q58: 'Confirmed. Review the fresh quote and buy.',
  sanctioned: "NOC presale isn't open in your region",
};
const ROW = {
  geofence: 'Presale geofence active | Checked by this wallet against the restricted-region list',
  required: 'Region check required | The presale opens only after a successful check against a current list',
  refused: "Region check required | Noctura's server did not answer requests from this network",
  why: 'Why this matters | Token sales are restricted by jurisdiction · this wallet checks before every purchase',
};

/** SOL as #11 shows it: four places, floored. */
const solText = (lamports: bigint): string => `${lamports / SOL}.${((lamports % SOL) / 100_000n).toString().padStart(4, '0')}`;
const feeRows = (p: Page) => p.locator('.fee-block .fee-row').evaluateAll(rs => rs.map(r => [...r.children].map(c => c.textContent ?? '').filter(t => t !== '')));
/** The prepared-purchase view the background answers, as far as these specs read it. */
type Prepared = {reauth: {proven: boolean} | null; stage: number; destination: string} | null;

test('1 · SOL purchase end to end: #11 Buy → #23a → amount → #20 (rows, the simulation) → #10 (first purchase) → the tab’s #20 → #21 with the badge → confirmed; #11 and #26 while pending; #26’s row badged; #23 then shows the allocation', async () => {
  test.setTimeout(240_000);
  const {h, csp} = await scene('noctura-e2e-presale-sol-');
  try {
    // The fake's config is the spec's literal PDA, derived here the program's way.
    expect(configPda()).toBe(CONFIG_PDA);
    await presaleWallet(h);
    const popup = await home(h);
    await cspControl(popup, csp);
    // #11 (§4.5): the banner and Buy beside Send and Receive.
    await expect(popup.locator('.app-presale-banner')).toContainText('NOC Presale · Stage 1');
    await expect(popup.locator('.app-presale-banner .sm')).toHaveText('$ 0.1501 · 12% to next stage');
    expect(await quickLabels(popup)).toEqual(['Send', 'Receive', 'Buy']);
    await buyAction(popup).click();
    // #23a: the stage card, a first purchase (no allocation row), 0.5 SOL → the program's NOC at stage 1.
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live', {timeout: 30_000});
    await expect(popup.locator('.stage-card .price')).toHaveText('$ 0.1501/ NOC');
    await expect(popup.getByText('Your allocation')).toHaveCount(0);
    const lamports = SOL / 2n;
    const nocBase = tokensFor(solCents(lamports, 150), 0);
    await amount(popup, '0.5', nocText(nocBase));
    expect(h.fake.presale.simulated).toEqual([]);
    await popup.locator('.sticky-bar button').click();
    // #20's purchase variant: every number the background's simulation — the program's own NOC, at stage 1, to the treasury.
    await expect(popup.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
    await expect(popup.locator('.review-card .eyebrow')).toHaveText('You are about to buy');
    await expect(popup.locator('.review-card .head')).toHaveText('0.5000SOL');
    const rows = await detailRows(popup);
    expect(rows.slice(0, 3)).toEqual([
      ['You receive (est.)', `${nocText(nocBase)} NOC`],
      ['Stage', '1 of 10'],
      ['Price', '$ 0.1501 / NOC'],
    ]);
    expect(rows[4]?.[0]).toBe('To');
    expect(rows[4]?.[1]).toMatch(/^Noctura presale/);
    expect(await groups(popup, '.detail-row:nth-child(5)')).toBe(SOL_TREASURY);
    // Q09: the two PDAs this first purchase creates, at the rent the simulation took (not the bound).
    expect((await feeRows(popup)).find(r => r[0] === 'Account setup (first purchase)')?.[1]).toBe('0.00218948 SOL');
    await expect(popup.getByText(`Simulated at slot ${(FAKE_START_HEIGHT + 50).toLocaleString('en-US').replace(/,/g, ' ')}`)).toBeVisible();
    await expect(popup.getByText('Compute Budget · Noctura presale')).toBeVisible();
    await expect(popup.getByText(OPENS_TAB)).toBeVisible();
    // The program simulated exactly this purchase; nothing was signed.
    expect(h.fake.presale.simulated.map(e => [e.currency, e.amount, e.tokens, e.stage, e.destination, e.rent])).toEqual([['SOL', lamports, nocBase, 0, SOL_TREASURY, USER_ACCOUNT_RENT + ALLOCATION_RENT]]);
    expect(h.fake.broadcasts).toEqual([]);

    // Buy → #10 in a new tab (D3: the first purchase), from the background's description, never the URL.
    const opened = h.ctx.waitForEvent('page');
    await popup.getByRole('button', {name: 'Buy NOC'}).click();
    const tab = await opened;
    await tab.waitForURL(/unlock\.html\?mode=reauth&challenge=[0-9a-f]{32}$/);
    await expect(tab.locator('#ra-about')).toHaveText('Confirm buying NOC with', {timeout: 30_000});
    await expect(tab.locator('#ra-amount')).toHaveText('0.5000');
    await expect(tab.locator('#ra-symbol')).toHaveText('SOL');
    await expect(tab.locator('#ra-reasons')).toContainText(Q.q17);
    expect(await groups(tab, '#ra-rows')).toBe(SOL_TREASURY);
    await tab.fill('#ra-password', E2E_PASSWORD);
    await tab.click('#ra-confirm');
    // The tab's hand-over: #20's purchase variant, proven, and nothing is broadcast without a tap (10 s of quiet).
    await tab.waitForURL(`chrome-extension://${h.id}/wallet.html#/send/resume?account=${ACCOUNT}`, {timeout: 60_000});
    await expect(tab.getByText(Q.q58)).toBeVisible({timeout: 30_000});
    await expect(tab.getByText('Confirm purchase')).toBeVisible();
    const quietUntil = Date.now() + 10_000;
    await expect.poll(async () => (h.fake.broadcasts.length > 0 ? 'sent' : Date.now() >= quietUntil ? 'quiet' : 'waiting'), {timeout: 20_000, intervals: [250]}).toBe('quiet');
    // Held pending (the network does not see it yet), so #11 and #26 can be read while it is open.
    h.fake.mode = 'expire';
    await tab.getByRole('button', {name: 'Buy NOC'}).click();
    // #21: Q53 and the badge (Q31), Q32's line.
    await expect(tab.locator('.top-bar .title')).toHaveText('Buying NOC…', {timeout: 30_000});
    await expect(tab.locator('.top-bar .status-pill')).toHaveText('Presale');
    await expect(tab.locator('.amount-card')).toHaveText('Buying NOC with 0.5000 SOL ≈ $75.00 USD');
    // Exactly one broadcast, of the purchase the program simulated: the presale instruction paying the treasury.
    expect(h.fake.broadcasts).toHaveLength(1);
    const wire = parseV0(base64.decode(h.fake.broadcastWires[0] ?? ''));
    const ix = wire.instructions[2];
    expect(wire.keys[ix?.program ?? -1]).toBe(PRESALE_PROGRAM);
    expect(ix?.accounts.map(a => wire.keys[a])[6]).toBe(SOL_TREASURY);
    // #11's pending row and #26's (Q33).
    const seen = await h.openPopup();
    await expect(seen.locator('.app-pending-strip .noc-body-sm')).toHaveText('Buying NOC · pending', {timeout: 30_000});
    await seen.getByRole('button', {name: 'Activity'}).click();
    await expect(seen.locator('.tx-row[data-pending] .pri')).toHaveText('Buying NOC · pending', {timeout: 30_000});
    await seen.close();
    // The network confirms it: #21's Q54 with the badge.
    h.fake.mode = 'confirm';
    await expect(tab.locator('.stage-label')).toHaveText('Purchase confirmed', {timeout: 45_000});
    await expect(tab.locator('.top-bar .title')).toHaveText('Purchased');
    await expect(tab.locator('.top-bar .status-pill')).toHaveText('Presale');
    expect(h.fake.broadcasts).toHaveLength(1);
    // B1d-2 (§2.4, D28): the confirmed purchase is recorded with the coordinator, once, with the whole payload.
    await expect.poll(() => h.fake.purchaseRecords.length).toBe(1);
    expect(h.fake.purchaseRecords).toEqual([{txHash: h.fake.broadcasts[0], buyerAddress: ACCOUNT, paymentToken: 'SOL', paymentAmount: expect.stringMatching(/^\d+(\.\d+)?$/), nocAmount: expect.any(Number), usdValue: 75, stage: 1}]);
    // #26 now lists the landed purchase from the chain; #23 shows the allocation (D5: claimable after TGE).
    // The payer paid the amount, the two PDAs' rent and the network fee #20 showed — exactly, as the program takes them.
    const network = (await msg(tab, {type: 'wallet.pending'})).data as {fee: {networkLamports: string}}[];
    const left = 10n * SOL - lamports - BigInt(USER_ACCOUNT_RENT + ALLOCATION_RENT) - BigInt(network[0]?.fee.networkLamports ?? '0');
    expect(BigInt(h.fake.lamports.get(ACCOUNT) ?? 0)).toBe(left);
    const after = await home(h, `${solText(left)} SOL`);
    await after.getByRole('button', {name: 'Activity'}).click();
    // B1d-2 Task 5 (§4.6, Q31): the row carries the "Presale" badge beside its title (so the title is no longer the
    // whole of its element's text: the row is found by it).
    const landed = after.locator('.tx-row', {hasText: 'Presale purchase'});
    await expect(landed).toBeVisible({timeout: 30_000});
    await expect(landed.locator('.pri .status-pill.app-badge')).toHaveText('Presale');
    await after.getByRole('button', {name: 'Home'}).click();
    await buyAction(after).click();
    await expect(after.locator('.receipt .row')).toContainText(`Your allocation${nocText(nocBase)} NOC`, {timeout: 30_000});
    await expect(after.locator('.app-pre-claimable')).toHaveText('Claimable after TGE');
    expect(allocationOf(h.fake.presale.accounts.get(allocationPda(ACCOUNT))?.data ?? new Uint8Array(117))).toEqual({user: ACCOUNT, totalBase: nocBase, spentCents: 7_500n, count: 1});
    done(h, csp);
  } finally {
    await h.close();
  }
});

test('2 · USDC from a non-canonical holding account: a simulation that does not pay the pinned vault is refused (Q52, nothing prepared); then the purchase — account 4 the held account, account 5 the vault ATA — with no re-authentication for a returning buyer', async () => {
  test.setTimeout(240_000);
  const {h, csp} = await scene('noctura-e2e-presale-usdc-');
  try {
    // A returning buyer (two purchases on chain), 1 000 USDC in an account that is not the derived ATA.
    const before = {totalBase: 1_998_667_554_963n, spentCents: 30_000n, count: 2};
    await presaleWallet(h, {allocation: before});
    h.fake.tokenAccounts.get(ACCOUNT)?.push({pubkey: USDC_HOLDING, mint: USDC_MINT, amount: '1000000000', decimals: 6});
    const popup = await home(h);
    await buyAction(popup).click();
    await expect(popup.locator('.receipt .row')).toContainText(`Your allocation${nocText(before.totalBase)} NOC`, {timeout: 30_000});
    await popup.getByRole('button', {name: 'Currency: SOL'}).click();
    await popup.getByRole('dialog', {name: 'Choose a token'}).getByText('USD Coin').click();
    await expect(popup.locator('.input-card .lbl-row').first()).toContainText('Available 1,000.00 USDC', {timeout: 30_000});
    const amount6 = 25_000_000n;
    const nocBase = tokensFor(stableCents(amount6), 0);
    await amount(popup, '25', nocText(nocBase));

    // C28: the simulation shows the vault unchanged (the payment went elsewhere) — retried once, then Q52; nothing prepared.
    h.fake.presale.wrongDestination = true;
    await popup.locator('.sticky-bar button').click();
    await expect(popup.locator('.banner .banner-title')).toHaveText(Q.q52, {timeout: 30_000});
    await expect(popup.getByText('Confirm purchase')).toHaveCount(0);
    expect(h.fake.presale.simulated.map(e => [e.currency, e.amount, e.source, e.destination])).toEqual([
      ['USDC', amount6, USDC_HOLDING, USDC_VAULT],
      ['USDC', amount6, USDC_HOLDING, USDC_VAULT],
    ]);
    expect(await preparedPurchase(popup)).toBeNull();

    // The control: the vault credited exactly — #20, To the vault ATA, no account setup (both PDAs exist), no #10.
    h.fake.presale.wrongDestination = false;
    await popup.locator('.sticky-bar button').click();
    await expect(popup.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
    await expect(popup.locator('.review-card .head')).toHaveText('25.00USDC');
    expect((await detailRows(popup)).slice(0, 2)).toEqual([
      ['You receive (est.)', `${nocText(nocBase)} NOC`],
      ['Stage', '1 of 10'],
    ]);
    expect(await groups(popup, '.detail-row:nth-child(5)')).toBe(USDC_VAULT);
    expect((await feeRows(popup)).map(r => r[0])).not.toContain('Account setup (first purchase)');
    await expect(popup.getByText(OPENS_TAB)).toHaveCount(0);
    const pages = h.ctx.pages().length;
    await popup.getByRole('button', {name: 'Buy NOC'}).click();
    await expect(popup.locator('.stage-label')).toHaveText('Purchase confirmed', {timeout: 45_000});
    await expect(popup.locator('.top-bar .status-pill')).toHaveText('Presale');
    expect(h.ctx.pages()).toHaveLength(pages);
    // The one broadcast: the presale's USDC instruction, paid from the held account into the treasury's vault ATA.
    expect(h.fake.broadcasts).toHaveLength(1);
    const wire = parseV0(base64.decode(h.fake.broadcastWires[0] ?? ''));
    const accounts = wire.instructions[2]?.accounts.map(a => wire.keys[a]) ?? [];
    expect([accounts[4], accounts[5], accounts[6]]).toEqual([USDC_HOLDING, USDC_VAULT, USDC_MINT]);
    expect(h.fake.tokenAccounts.get(ACCOUNT)?.find(t => t.pubkey === USDC_HOLDING)?.amount).toBe('975000000');
    // Done → #23 (C17), the allocation grown by what the program credited.
    await popup.getByRole('button', {name: 'Done'}).click();
    await expect(popup.locator('.receipt .row')).toContainText(`Your allocation${nocText(before.totalBase + nocBase)} NOC`, {timeout: 30_000});
    done(h, csp);
  } finally {
    await h.close();
  }
});

test('3 · below the minimum: the line, Buy disabled; a forced prepare is refused by the background (C3); at the minimum the line goes', async () => {
  const {h, csp} = await scene('noctura-e2e-presale-min-');
  try {
    await presaleWallet(h);
    const popup = await home(h);
    await buyAction(popup).click();
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live', {timeout: 30_000});
    // 0.05 SOL at $150 is $7.50: under the config's $10.
    await popup.getByLabel('YOU PAY').fill('0.05');
    await expect(popup.locator('.input-card .helper.error')).toHaveText('Minimum $10', {timeout: 30_000});
    await expect(popup.locator('.sticky-bar button')).toBeDisabled();
    expect(await msg(popup, {type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '50000000', stage: 0}})).toEqual({ok: false, error: 'below-min'});
    expect(await preparedPurchase(popup)).toBeNull();
    expect(h.fake.presale.simulated).toEqual([]);
    // The negative control: $15 — no line, Buy enabled.
    await amount(popup, '0.1', nocText(tokensFor(solCents(SOL / 10n, 150), 0)));
    await expect(popup.locator('.input-card .helper.error')).toHaveCount(0);
    await expect(popup.locator('.sticky-bar button')).toBeEnabled();
    done(h, csp);
  } finally {
    await h.close();
  }
});

/**
 * #11 → Buy → #50b; [Got it] → #11 again, its banner read again — shown, or (after a 403: the coordinator's cool-down,
 * D26, refuses the banner's read too — §4.5 "null on any failure") no banner and no Buy.
 */
async function buyToGeo(p: Page, o: {refused?: boolean} = {}): Promise<Awaited<ReturnType<typeof geoScreen>>> {
  await buyAction(p).click();
  const shown = await geoScreen(p);
  await p.getByRole('button', {name: 'Got it'}).click();
  if (o.refused === true) {
    await expect(p.locator('.app-presale-banner')).toHaveCount(0, {timeout: 30_000});
    expect(await quickLabels(p)).toEqual(['Send', 'Receive']);
  } else await expect(p.locator('.app-presale-banner')).toBeVisible({timeout: 30_000});
  return shown;
}
/** The gate refuses a prepare however it is asked (C12), and nothing is prepared. */
async function refusedPrepare(p: Page, reason: string): Promise<void> {
  expect(await msg(p, {type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '500000000', stage: 0}})).toEqual({ok: false, error: 'geo-closed', data: {detail: reason}});
  expect(await preparedPurchase(p)).toBeNull();
}
const STILL_WORKS = true;
/** A well-formed signature (64 bytes) for a seeded record. */
const base58Sig = (id: string): string => base58.encode(Uint8Array.from({length: 64}, (_, i) => (i * 11 + id.charCodeAt(i % id.length)) % 251 || 1));

test('4 · geo: #50b for no_check, unknown_country and sanctioned (Got it → #11, nothing prepared), the open variant from #23’s link; with a purchase pending 23b stays with the region line beneath (C30); refused last (a 403 cools every route down)', async () => {
  test.setTimeout(240_000);
  const {h, csp} = await scene('noctura-e2e-presale-geo-');
  try {
    await presaleWallet(h);
    const popup = await home(h);
    // The open control first: #23a, and its "Not available in your region?" → #50b open (Q20, nothing restricted; the
    // region the gate detected, D22).
    await buyAction(popup).click();
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live', {timeout: 30_000});
    await popup.getByRole('button', {name: 'Not available in your region?'}).click();
    expect(await geoScreen(popup)).toEqual({headline: Q.q20, sub: null, region: 'Detected region: Slovenia · EU', rows: [ROW.why], works: false});
    await popup.getByRole('button', {name: 'Got it'}).click();
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live');
    await popup.getByRole('button', {name: 'Back'}).click();

    // no_check: /geo/check gets no answer.
    h.fake.geo.check = 'unreachable';
    expect(await buyToGeo(popup)).toEqual({headline: Q.q23, sub: 'The region check is unavailable — try again later.', region: null, rows: [ROW.required, ROW.why], works: STILL_WORKS});
    await refusedPrepare(popup, 'no_check');
    // A body of the wrong shape is no check either.
    h.fake.geo.check = 'malformed';
    expect((await buyToGeo(popup)).sub).toBe('The region check is unavailable — try again later.');
    // unknown_country: a placeholder code — no region named.
    h.fake.geo.check = {countryCode: 'XX', isVpn: false};
    expect(await buyToGeo(popup)).toEqual({headline: Q.q23, sub: 'Your region could not be determined from your IP.', region: null, rows: [ROW.required, ROW.why], works: STILL_WORKS});
    await refusedPrepare(popup, 'unknown_country');
    // sanctioned, whatever the VPN flag says.
    h.fake.geo.check = {countryCode: 'KP', isVpn: true};
    expect(await buyToGeo(popup)).toEqual({headline: Q.sanctioned, sub: Q.q21, region: 'Detected region: North Korea', rows: [ROW.geofence, ROW.why], works: STILL_WORKS});
    await refusedPrepare(popup, 'sanctioned');
    expect(h.fake.presale.simulated).toEqual([]);

    // C30: a purchase pending — Buy opens 23b, never #50b; the region line beneath it is a link to #50b; Got it → 23b.
    h.fake.mode = 'expire';
    const id = 'e9'.repeat(16);
    await h.sw.evaluate(r => chrome.storage.local.set({v1_pending: [r]}), pendingPurchase(id));
    const pending = await home(h);
    await expect(pending.locator('.app-pending-strip .noc-body-sm')).toHaveText('Buying NOC · pending', {timeout: 30_000});
    await buyAction(pending).click();
    await expect(pending.locator('.pending-card h3')).toHaveText('Order pending', {timeout: 30_000});
    await expect(pending.locator('.app-pre-region')).toHaveText("Not available here — This wallet doesn't offer the presale in your region.");
    await pending.locator('.app-pre-region').click();
    expect((await geoScreen(pending)).headline).toBe(Q.sanctioned);
    await pending.getByRole('button', {name: 'Got it'}).click();
    await expect(pending.locator('.pending-card h3')).toHaveText('Order pending');
    // It confirms; the strip goes.
    h.fake.mode = 'confirm';
    await pending.getByRole('button', {name: 'Done'}).click();
    await expect(pending.locator('.app-pending-strip')).toHaveCount(0, {timeout: 45_000});
    await pending.close();

    // refused: every coordinator route answers 403 (CrowdSec's HTML) — Q12 as #50b's sub, Q27 as its reason.
    h.fake.geo.check = {countryCode: 'SI', isVpn: false};
    const last = await home(h);
    h.fake.network = 'forbidden';
    expect(await buyToGeo(last, {refused: true})).toEqual({headline: Q.q23, sub: 'The presale service refused this network.', region: null, rows: [ROW.refused, ROW.why], works: STILL_WORKS});
    await refusedPrepare(last, 'refused');
    expect(h.fake.presale.simulated).toEqual([]);
    done(h, csp);
  } finally {
    await h.close();
  }
});

test('4 · geo: a stale restricted list — #50b with the detected region, nothing prepared', async () => {
  const {h, csp} = await scene('noctura-e2e-presale-stale-');
  try {
    // The gate keeps a list for 10 minutes: a stale one is this browser's from its first read.
    h.fake.geo.list = restrictedList({ageDays: 40});
    await presaleWallet(h);
    const popup = await home(h);
    expect(await buyToGeo(popup)).toEqual({headline: Q.q23, sub: 'The restricted-region list is out of date.', region: 'Detected region: Slovenia · EU', rows: [ROW.required, ROW.why], works: STILL_WORKS});
    await refusedPrepare(popup, 'stale_list');
    expect(h.fake.presale.simulated).toEqual([]);
    done(h, csp);
  } finally {
    await h.close();
  }
});

/** A purchase in v1_pending (§2.3), the wallet's own, open. */
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

test('5 · the presale’s reads unreachable: #23 closed with Q11 and no Buy; #11 drops the banner and Buy; Send and Receive still work', async () => {
  test.setTimeout(180_000);
  const {h, csp} = await scene('noctura-e2e-presale-down-');
  try {
    await presaleWallet(h);
    const popup = await home(h);
    await buyAction(popup).click();
    await amount(popup, '0.5', nocText(tokensFor(solCents(SOL / 2n, 150), 0)));
    // The presale's chain reads now get no answer (the rest of the coordinator answers).
    h.fake.presale.read = 'unreachable';
    await popup.locator('.sticky-bar button').click();
    await expect(popup.locator('.banner .banner-title')).toHaveText(Q.q11, {timeout: 30_000});
    await expect(popup.locator('.stage-card')).toHaveCount(0);
    await expect(popup.locator('.sticky-bar')).toHaveCount(0);
    expect(await preparedPurchase(popup)).toBeNull();
    await popup.getByRole('button', {name: 'Back'}).click();
    await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible();
    await expect(popup.locator('.app-presale-banner')).toHaveCount(0, {timeout: 30_000});
    expect(await quickLabels(popup)).toEqual(['Send', 'Receive']);
    // Send: a known recipient, under 5 % and the dollar threshold — #12 → #19 → #20 → #21, one broadcast.
    const send = await startSend(h, '0.01', {firstTime: false});
    await send.getByRole('button', {name: 'Continue to confirm'}).click();
    await send.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    await expect(send.getByText('Sent successfully')).toBeVisible({timeout: 45_000});
    expect(h.fake.broadcasts).toHaveLength(1);
    // Receive: the address, whole.
    const receive = await h.openPopup();
    await receive.getByRole('button', {name: 'Receive'}).click();
    await expect(receive.getByText('Public address')).toBeVisible({timeout: 30_000});
    expect((await receive.locator('.addr-groups span').allTextContents()).join('')).toBe(ACCOUNT);
    expect(h.fake.presale.simulated).toEqual([]);
    done(h, csp);
  } finally {
    await h.close();
  }
});

test('6 · the stage moves between the view and Buy: Q15, nothing simulated; #23 re-reads at the new stage and the next Buy simulates at its price', async () => {
  const {h, csp} = await scene('noctura-e2e-presale-stage-');
  try {
    await presaleWallet(h);
    const popup = await home(h);
    await buyAction(popup).click();
    const lamports = SOL / 2n;
    const cents = solCents(lamports, 150);
    await amount(popup, '0.5', nocText(tokensFor(cents, 0)));
    // The program moves to stage 2 (0-indexed 1) before the tap.
    h.fake.presale.accounts.set(CONFIG_PDA, {lamports: 3_466_080, data: configData({stage: 1, stageSold: 0n})});
    await popup.locator('.sticky-bar button').click();
    await expect(popup.locator('.banner .banner-title')).toHaveText(Q.q15, {timeout: 30_000});
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 2 of 10 · live', {timeout: 30_000});
    await expect(popup.locator('.stage-card .price')).toHaveText('$ 0.1723/ NOC');
    expect(h.fake.presale.simulated).toEqual([]);
    expect(await preparedPurchase(popup)).toBeNull();
    // The same amount, quoted and simulated at stage 2's price.
    await expect(popup.locator('.sticky-bar button')).toHaveText(`Buy ${nocText(tokensFor(cents, 1))} NOC`, {timeout: 30_000});
    await popup.locator('.sticky-bar button').click();
    await expect(popup.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
    expect((await detailRows(popup)).slice(0, 3)).toEqual([
      ['You receive (est.)', `${nocText(tokensFor(cents, 1))} NOC`],
      ['Stage', '2 of 10'],
      ['Price', '$ 0.1723 / NOC'],
    ]);
    expect(h.fake.presale.simulated.map(e => [e.stage, e.tokens])).toEqual([[1, tokensFor(cents, 1)]]);
    expect(((await preparedPurchase(popup)) as Prepared)?.stage).toBe(1);
    // Cancel discards it: #23 again, nothing prepared, nothing broadcast.
    await popup.getByRole('button', {name: 'Cancel'}).click();
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 2 of 10 · live', {timeout: 30_000});
    expect(await preparedPurchase(popup)).toBeNull();
    expect(h.fake.broadcasts).toEqual([]);
    done(h, csp);
  } finally {
    await h.close();
  }
});

test('8 · resume: the popup closed on #10, proven in the vault page — the tab’s hand-over lands on #20’s purchase variant, and a reopened popup on the same, proven, Buy enabled; one tap signs with no second proof', async () => {
  test.setTimeout(240_000);
  const {h, csp} = await scene('noctura-e2e-presale-resume-');
  try {
    await presaleWallet(h);
    const popup = await home(h);
    await buyAction(popup).click();
    await amount(popup, '0.5', nocText(tokensFor(solCents(SOL / 2n, 150), 0)));
    await popup.locator('.sticky-bar button').click();
    await expect(popup.getByText(OPENS_TAB)).toBeVisible({timeout: 30_000});
    const opened = h.ctx.waitForEvent('page');
    await popup.getByRole('button', {name: 'Buy NOC'}).click();
    const tab = await opened;
    // The popup closes itself when #10 opens (B1b); closed here too, as a user would, should it not have.
    if (!popup.isClosed()) await popup.close();
    await expect(tab.locator('#ra-about')).toHaveText('Confirm buying NOC with', {timeout: 30_000});
    // The vault page may not ask the presale (the privileged partition: the popup and the full tab only).
    expect(await msg(tab, {type: 'presale.preparedFor', account: ACCOUNT})).toMatchObject({ok: false});
    const ui = await h.ctx.newPage();
    await ui.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    expect(((await preparedPurchase(ui)) as Prepared)?.reauth?.proven).toBe(false);
    await tab.fill('#ra-password', E2E_PASSWORD);
    await tab.click('#ra-confirm');
    // The tab's hand-over: #20's purchase variant, proven (Q58). Left without a tap.
    await tab.waitForURL(`chrome-extension://${h.id}/wallet.html#/send/resume?account=${ACCOUNT}`, {timeout: 60_000});
    await expect(tab.getByText(Q.q58)).toBeVisible({timeout: 30_000});
    await tab.close();
    expect(((await preparedPurchase(ui)) as Prepared)?.reauth?.proven).toBe(true);
    await ui.close();
    // The popup reopened: App's hook finds the purchase and opens #20's purchase variant — proven, Buy enabled.
    const again = await h.openPopup();
    await expect(again.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
    await expect(again.getByText(Q.q58)).toBeVisible();
    await expect(again.getByText(OPENS_TAB)).toHaveCount(0);
    const buy = again.getByRole('button', {name: 'Buy NOC'});
    await expect(buy).toBeEnabled();
    const pages = h.ctx.pages().length;
    await buy.click();
    await expect(again.locator('.stage-label')).toHaveText('Purchase confirmed', {timeout: 45_000});
    expect(h.ctx.pages()).toHaveLength(pages);
    expect(h.fake.broadcasts).toHaveLength(1);
    expect(h.fake.presale.landed.map(e => [e.currency, e.amount])).toEqual([['SOL', SOL / 2n]]);
    done(h, csp);
  } finally {
    await h.close();
  }
});
