import {expect, type BrowserContext, type ConsoleMessage, type Page} from '@playwright/test';
import {base58} from '@scure/base';
import type {Harness} from './popupHarness';
import {ACCOUNT, msg, realWallet} from './sendHelpers';
import {CONFIG_PDA, SOL_TREASURY, USDC_MINT, USDC_VAULT, USDT_MINT, USDT_VAULT, allocationData, allocationPda, configData, userData, userPda, type ConfigFacts} from './presaleChain';

// B1d §6.3's E2E helpers (B1d-1b Task 8): the presale on the fake chain, the CSP watch, #11 → Buy, #50b's reading, the
// background's own answers. Public constants only; nothing here is imported from core/ (the E2E rule).

/** A USDC token account the account holds that is NOT its associated token account (the user's wallet holds this way). */
export const USDC_HOLDING = base58.encode(new Uint8Array(32).fill(37));

/** The config live (or as `config` says), the treasury's two vault ATAs, the account's PDAs when `allocation` is given. */
export function installPresale(h: Harness, o: {config?: Partial<ConfigFacts>; allocation?: {totalBase: bigint; spentCents: bigint; count: number}} = {}): void {
  h.fake.presale.accounts.set(CONFIG_PDA, {lamports: 3_466_080, data: configData(o.config)});
  h.fake.tokenAccounts.set(SOL_TREASURY, [
    {pubkey: USDC_VAULT, mint: USDC_MINT, amount: '172099207', decimals: 6},
    {pubkey: USDT_VAULT, mint: USDT_MINT, amount: '0', decimals: 6},
  ]);
  // The account's PDAs do not exist until a purchase creates them (the fake holds 10 SOL at any unlisted address).
  h.fake.lamports.set(userPda(ACCOUNT), 0);
  h.fake.lamports.set(allocationPda(ACCOUNT), 0);
  if (o.allocation !== undefined) {
    h.fake.presale.accounts.set(userPda(ACCOUNT), {lamports: 944_880, data: userData()});
    h.fake.presale.accounts.set(allocationPda(ACCOUNT), {lamports: 1_244_600, data: allocationData({user: ACCOUNT, ...o.allocation})});
  }
}

/**
 * Every Content Security Policy violation any page of the context reports (`securitypolicyviolation`, re-logged to the
 * console by an init script) and every console line about the policy. Asserted empty at the end of each spec; the
 * positive control (`cspControl`) proves the watch sees one.
 */
export async function watchCsp(ctx: BrowserContext): Promise<string[]> {
  const lines: string[] = [];
  ctx.on('console', (m: ConsoleMessage) => {
    if (/E2E_CSP|Content Security Policy|Content-Security-Policy/i.test(m.text())) lines.push(m.text());
  });
  await ctx.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', e => console.error(`E2E_CSP ${e.effectiveDirective} ${e.blockedURI} ${e.documentURI}`));
  });
  return lines;
}
/** The watch's positive control: a remote image in `page` is refused by the extension's policy and reported here. */
export async function cspControl(page: Page, lines: string[]): Promise<void> {
  await page.evaluate(() => {
    const img = document.createElement('img');
    img.src = 'https://csp-control.invalid/pixel.png';
    document.body.append(img);
  });
  await expect.poll(() => lines.some(l => l.startsWith('E2E_CSP img-src https://csp-control.invalid/pixel.png')), {timeout: 10_000}).toBe(true);
  lines.length = 0;
}

/** The wallet unlocked through the vault page, RECIPIENT known (a send of it needs no re-authentication), the presale installed. */
export async function presaleWallet(h: Harness, o: Parameters<typeof installPresale>[1] = {}): Promise<void> {
  installPresale(h, o);
  await realWallet(h, {known: true});
}

/** #11 with its presale banner: the popup, its balance read, the banner answered (presale.banner, no geo). */
export async function home(h: Harness, balance = '10.0000 SOL'): Promise<Page> {
  const p = await h.openPopup();
  await expect(p.getByText(balance, {exact: true})).toBeVisible({timeout: 30_000});
  await expect(p.locator('.app-presale-banner')).toBeVisible({timeout: 30_000});
  return p;
}
export const quickLabels = (p: Page) => p.locator('.quick .qa .lbl').allTextContents();
export const buyAction = (p: Page) => p.locator('.quick .qa').filter({hasText: 'Buy'});

/** #23a: the amount typed, its quote answered (the Buy button names the estimate). */
export async function amount(p: Page, text: string, estimate: string): Promise<void> {
  await p.getByLabel('YOU PAY').fill(text);
  await expect(p.locator('.sticky-bar button')).toHaveText(`Buy ${estimate} NOC`, {timeout: 30_000});
}

/** #50b as drawn: the headline, the sub (null: none), the detected-region line (null: none) and the reason rows' heads. */
export async function geoScreen(p: Page): Promise<{headline: string; sub: string | null; region: string | null; rows: string[]; works: boolean}> {
  const hero = p.locator('.s11-geo-hero');
  await expect(hero.locator('h2')).toBeVisible({timeout: 30_000});
  const sub = hero.locator('p');
  const region = p.locator('.s11-geo-region .app-geo-primary');
  return {
    headline: (await hero.locator('h2').textContent()) ?? '',
    sub: (await sub.count()) === 0 ? null : await sub.textContent(),
    region: (await region.count()) === 0 ? null : await region.textContent(),
    rows: await p.locator('.s11-reason-row .body').evaluateAll(rs => rs.map(r => [...r.children].map(c => c.textContent ?? '').join(' | '))),
    works: (await p.locator('.s11-stillworks').count()) === 1,
  };
}

/** The background's own answer: what is prepared for the account (null: nothing). */
export const preparedPurchase = async (p: Page) => (await msg(p, {type: 'presale.preparedFor', account: ACCOUNT})).data ?? null;
