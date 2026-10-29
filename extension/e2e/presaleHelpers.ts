import {expect, type BrowserContext, type ConsoleMessage, type Page} from '@playwright/test';
import {base58} from '@scure/base';
import {contained, launchPopup, type Harness} from './popupHarness';
import {ACCOUNT, msg, realWallet} from './sendHelpers';
import {
  CONFIG_PDA,
  SOL_TREASURY,
  USDC_MINT,
  USDC_VAULT,
  USDT_MINT,
  USDT_VAULT,
  allocationData,
  allocationPda,
  configData,
  userData,
  userPda,
  type AllocationReferral,
  type ConfigFacts,
} from './presaleChain';

declare const chrome: {
  storage: {local: {get(k: string): Promise<Record<string, unknown>>; set(o: object): Promise<void>}};
  alarms: {get(name: string): Promise<{scheduledTime: number} | undefined>; clear(name: string): Promise<boolean>; create(name: string, o: {when: number}): Promise<void>};
};

// B1d §6.3's E2E helpers (B1d-1b Task 8): the presale on the fake chain, the CSP watch, #11 → Buy, #50b's reading, the
// background's own answers. Public constants only; nothing here is imported from core/ (the E2E rule).

/** A USDC token account the account holds that is NOT its associated token account (the user's wallet holds this way). */
export const USDC_HOLDING = base58.encode(new Uint8Array(32).fill(37));

/**
 * The config live (or as `config` says), the treasury's two vault ATAs, the account's PDAs when `allocation` is given
 * (B1d-2: with the bonus credited to it as a referrer and its own referrer, when given).
 */
export function installPresale(h: Harness, o: {config?: Partial<ConfigFacts>; allocation?: {totalBase: bigint; spentCents: bigint; count: number} & Partial<AllocationReferral>} = {}): void {
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

/** A presale scene: the contained popup harness and its CSP watch. */
export async function scene(prefix: string): Promise<{h: Harness; csp: string[]}> {
  const h = await launchPopup(prefix);
  return {h, csp: await watchCsp(h.ctx)};
}
/** What every presale spec ends with: contained (popupHarness.ts) and no CSP violation on any page. */
export function done(h: Harness, csp: string[]): void {
  contained(h);
  expect(csp).toEqual([]);
}
/** #20's detail rows as [label, value]. */
export const detailRows = (p: Page) => p.locator('.detail-row').evaluateAll(rs => rs.map(r => [r.querySelector('.lbl')?.textContent ?? '', r.querySelector('.val')?.textContent ?? '']));

/** B1d-2: a referrer that is no account of the test wallet — an address with a presale allocation of its own (`installReferrer`). */
export const REFERRER = base58.encode(new Uint8Array(32).fill(53));
/** The referrer's own allocation on the fake chain (it bought once): what makes it an address that can refer (§3.5). */
export function installReferrer(h: Harness, referrer = REFERRER): void {
  h.fake.presale.accounts.set(allocationPda(referrer), {lamports: 1_244_600, data: allocationData({user: referrer, totalBase: 666_222_518_321n, spentCents: 10_000n, count: 1})});
}

/** B1d-2 (§2.4): the background's record entries (`v1_presale_records`), as stored. */
export interface RecordEntry {
  signature: string;
  account: string;
  payload: Record<string, unknown>;
  confirmedAt: number;
  attempts: number;
  nextAt: number;
  state: 'due' | 'done' | 'refused' | 'given-up';
}
export const recordEntries = async (h: Harness): Promise<RecordEntry[]> => (await h.sw.evaluate(() => chrome.storage.local.get('v1_presale_records'))).v1_presale_records as RecordEntry[];
const RECORD_ALARM = 'presale-record';

/**
 * B1d-2 (§2.4): the record of `signature` after its `attempts`-th POST, once the worker's run is over — its retry alarm
 * armed at the entry's next slot (the run's last step) — and then the alarm cleared, so no slot comes due on the browser's
 * clock while the test looks (record.ts arms it never sooner than 30 s ahead). The entry as it stands.
 */
export async function heldRecord(h: Harness, signature: string, attempts: number): Promise<RecordEntry> {
  await expect
    .poll(
      async () => {
        const e = (await recordEntries(h)).find(x => x.signature === signature);
        const alarm = await h.sw.evaluate(name => chrome.alarms.get(name), RECORD_ALARM);
        return e?.state === 'due' && e.attempts === attempts && alarm !== undefined && Math.abs(alarm.scheduledTime - e.nextAt) < 2_000;
      },
      {timeout: 60_000},
    )
    .toBe(true);
  await h.sw.evaluate(name => chrome.alarms.clear(name), RECORD_ALARM);
  const e = (await recordEntries(h)).find(x => x.signature === signature);
  expect(e?.attempts).toBe(attempts);
  return e as RecordEntry;
}

/**
 * The test's way to make an entry's next slot come without a browser clock: the entry's whole schedule moved back so that
 * its `nextAt` is now (C24's slots are offsets from `confirmedAt` — both move together), then the record's own alarm fired
 * (an unpacked extension's alarm may be due at once): the background wakes exactly as at that slot.
 */
export async function slotComes(h: Harness, signature: string): Promise<void> {
  await h.sw.evaluate(
    async ({key, sig, name}) => {
      const entries = ((await chrome.storage.local.get(key))[key] ?? []) as {signature: string; confirmedAt: number; nextAt: number}[];
      const now = Date.now();
      const moved = entries.map(e => {
        if (e.signature !== sig) return e;
        const by = Math.max(0, e.nextAt - now + 1_000);
        return {...e, confirmedAt: e.confirmedAt - by, nextAt: e.nextAt - by};
      });
      await chrome.storage.local.set({[key]: moved});
      await chrome.alarms.create(name, {when: Date.now()});
    },
    {key: 'v1_presale_records', sig: signature, name: RECORD_ALARM},
  );
}

/** The record's alarm as the background holds it (undefined: none). */
export const recordAlarm = (h: Harness) => h.sw.evaluate(name => chrome.alarms.get(name), RECORD_ALARM);

/**
 * Final review T6 M2: makes the END of the next record run observable. A run's last step arms the record's alarm, or
 * clears it when nothing is due — and clearing an alarm that is not there leaves no trace. So the alarm is armed here an
 * hour ahead (it never fires within a test): it is gone again only once a run that found nothing due has finished. Arm
 * it while no run is going and before the act that starts the next one.
 */
export async function armRecordAlarmAhead(h: Harness): Promise<void> {
  await h.sw.evaluate(name => chrome.alarms.create(name, {when: Date.now() + 3_600_000}), RECORD_ALARM);
  expect(await recordAlarm(h)).toBeDefined();
}

/** The background's own answer: what is prepared for the account (null: nothing). */
export const preparedPurchase = async (p: Page) => (await msg(p, {type: 'presale.preparedFor', account: ACCOUNT})).data ?? null;
