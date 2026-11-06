import {test, expect, type Page} from '@playwright/test';
import {base58} from '@scure/base';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {account, contained, launchPopup, type Harness} from './popupHarness';
import {EXT_NOPRESALE} from './launch';
import {E2E_ACCOUNTS, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {unlockWith} from './vaultPage';
import {associatedTokenAddress} from './sendHelpers';
import {DAPP_HOSTS, approvalWindow, connect, customSignTx, openDapp, serveDapp, windowClosed, type RawIx} from './dappPage';
import {dateViolations, forbiddenForms} from '../scripts/check-no-tge-date.mjs';
import {STORE_SHOT, pngHeader, storeShotProblems} from '../scripts/png.mjs';

declare const chrome: {storage: {local: {set(o: object): Promise<void>}}};

// B1e §6.4 (Minor 9), §9: the five Chrome Web Store screenshots, 1280 × 800, 24-bit PNG, from the real store build
// (`--no-presale`, E2), contained like every E2E (noc-tura.io and solscan.io unresolvable and routed, the coordinator the
// E2E suite's fake, the site the suite's test dApp served by a route). The wallet tab is captured at 1280 × 800; the popup
// (412 × 600) and the approval window (412 × 720, its windows.create size) are captured at their real size and composed
// 1 : 1, unscaled, centred on backdrop.html (the design background). The TGE-date check runs on each captured state's
// text (document.body.innerText against forbiddenForms() of scripts/check-no-tge-date.mjs), never on the pixels; its
// positive control plants every form first. `npm run screenshots` (its own config; playwright.config.ts ignores this
// file, so `npm run e2e` and CI never run it). In e2e/ because it is never bundled: the vault-isolation gate skips e2e/
// at the package root, and this spec writes background-owned storage keys as every E2E seeding a wallet does.
const OUT = fileURLToPath(new URL('../release/screenshots/out/', import.meta.url));
const BACKDROP = new URL('../release/screenshots/backdrop.html', import.meta.url).href;
const NAMES = ['1-home', '2-send-review', '3-site-request', '4-wallet-tab', '5-security'] as const;
const POPUP = {width: 412, height: 600};
const WINDOW = {width: 412, height: 720};

/** The wallet: the suite's test mnemonic (abandon … about), its accounts 0 and 1 — a public test vector, nobody's funds. */
const ACCOUNT = E2E_ACCOUNTS[0];
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
/** 12.4836 SOL, 1,250.00 USDC, 480.50 USDT on the fake chain. */
const LAMPORTS = 12_483_600_000;
const TOKENS = [
  {pubkey: associatedTokenAddress(ACCOUNT, USDC_MINT), mint: USDC_MINT, amount: '1250000000', decimals: 6},
  {pubkey: associatedTokenAddress(ACCOUNT, USDT_MINT), mint: USDT_MINT, amount: '480500000', decimals: 6},
];
/** The send's recipient and the site's payee: public keys of fixed 32-byte seeds (popupHarness's `account`), nobody's. */
const FRIEND = account(0, 'Friend', 0x33).publicKey;
const SHOP = account(0, 'Shop', 0x2a).publicKey;
const PHRASE = 'Violet otter 19';
const SITE = 'https://dapp.test';
const BLOCKHASH = base58.encode(new Uint8Array(32).fill(7));
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const u64le = (n: bigint): number[] => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return Array.from(b);
};
/** The site's request: one System transfer of 0.25 SOL from the wallet's account to SHOP. */
const PAYMENT: RawIx = {
  programId: SYSTEM_PROGRAM,
  keys: [
    {pubkey: ACCOUNT, isSigner: true, isWritable: true},
    {pubkey: SHOP, isSigner: false, isWritable: true},
  ],
  data: [2, 0, 0, 0, ...u64le(250_000_000n)],
};
/** Text no store screenshot may show: anything presale, and the failure lines a broken state draws. */
const REFUSED_TEXT = [/presale/i, /couldn.t|could not/i, /offline/i, /not answering/i, /went wrong/i];

/** What the TGE-date gate and REFUSED_TEXT find in the page's rendered text — the one reading both the states and the control use. */
async function textProblems(page: Page, name: string): Promise<string[]> {
  const text = await page.evaluate(() => document.body.innerText);
  return [...dateViolations([{path: name, text}]), ...REFUSED_TEXT.filter(r => r.test(text)).map(r => `${name}: shows ${String(r)}`)];
}
/** A state's checks before it is captured: some text, none of it refused. */
async function cleanText(page: Page, name: string): Promise<void> {
  expect((await page.evaluate(() => document.body.innerText)).trim().length, `${name}: the state has text`).toBeGreaterThan(0);
  expect(await textProblems(page, name)).toEqual([]);
}
/** Writes one screenshot and reads it back: exactly STORE_SHOT, no transparency. */
function save(name: (typeof NAMES)[number], png: Buffer): void {
  writeFileSync(`${OUT}${name}.png`, png);
  const back = readFileSync(`${OUT}${name}.png`);
  expect(storeShotProblems(back), `${name}.png`).toEqual([]);
  expect(pngHeader(back)).toMatchObject(STORE_SHOT);
}
/** The state's own frame, captured at its real size (the viewport — never the full page). */
async function capture(page: Page, size: {width: number; height: number}): Promise<Buffer> {
  expect(page.viewportSize()).toEqual(size);
  await page.mouse.move(0, 0);
  return page.screenshot({fullPage: false});
}
/**
 * `shot` on the backdrop: an <img> at its natural size, unscaled (device pixel ratio 1, its CSS box its pixel size),
 * centred on the 1280 × 800 page; the composed frame's pixels are the capture's own (the clip of the composed page
 * encodes to the capture's bytes); the page's ground is the design system's (--bg-base under the accent wash).
 */
async function compose(h: Harness, name: (typeof NAMES)[number], shot: Buffer, size: {width: number; height: number}): Promise<void> {
  const page = await h.ctx.newPage();
  try {
    await page.setViewportSize({width: STORE_SHOT.width, height: STORE_SHOT.height});
    await page.goto(BACKDROP);
    const box = await page.evaluate(async src => {
      const img = document.getElementById('shot') as HTMLImageElement;
      img.src = src;
      await img.decode();
      const r = img.getBoundingClientRect();
      const cs = getComputedStyle(document.body);
      const root = getComputedStyle(document.documentElement);
      return {
        dpr: devicePixelRatio,
        natural: [img.naturalWidth, img.naturalHeight],
        rect: [r.left, r.top, r.width, r.height],
        ground: cs.backgroundColor,
        wash: cs.backgroundImage,
        bgBase: root.getPropertyValue('--bg-base').trim(),
        edge: getComputedStyle(img).outlineColor,
        surface3: root.getPropertyValue('--bg-surface-3').trim(),
      };
    }, `data:image/png;base64,${shot.toString('base64')}`);
    expect(box.dpr).toBe(1);
    expect(box.natural, `${name}: the capture's size`).toEqual([size.width, size.height]);
    const left = (STORE_SHOT.width - size.width) / 2;
    const top = (STORE_SHOT.height - size.height) / 2;
    expect(box.rect, `${name}: unscaled and centred`).toEqual([left, top, size.width, size.height]);
    expect(box.bgBase.toLowerCase()).toBe('#0a0a0a');
    expect(box.ground, `${name}: the ground is --bg-base`).toBe('rgb(10, 10, 10)');
    expect(box.wash, `${name}: the design system's accent wash`).toMatch(/^radial-gradient\(/);
    expect(box.surface3.toLowerCase()).toBe('#212126');
    expect(box.edge, `${name}: the frame line is --bg-surface-3`).toBe('rgb(33, 33, 38)');
    expect(await textProblems(page, `${name} (backdrop)`)).toEqual([]);
    const inner = await page.screenshot({clip: {x: left, y: top, width: size.width, height: size.height}});
    expect(inner.equals(shot), `${name}: the composed frame is the capture, pixel for pixel`).toBe(true);
    save(name, await page.screenshot({fullPage: false}));
  } finally {
    await page.close();
  }
}

test('the five store screenshots, 1280 × 800, from the store build', async () => {
  expect(existsSync(`${EXT_NOPRESALE}/manifest.json`), 'the store build: run `npm run build` first').toBe(true);
  expect(JSON.parse(readFileSync(fileURLToPath(new URL('../dist-nopresale/app.features.json', import.meta.url)), 'utf8'))).toEqual({presale: false});
  mkdirSync(OUT, {recursive: true});
  for (const n of NAMES) rmSync(`${OUT}${n}.png`, {force: true});

  const h = await launchPopup('noctura-screenshots-', {hosts: DAPP_HOSTS, ext: EXT_NOPRESALE});
  const server = await serveDapp(h.ctx);
  try {
    // The control: the same reading finds every written form of the date, and each refused line, when a page shows it.
    const control = await h.ctx.newPage();
    for (const form of forbiddenForms()) {
      await control.setContent(`<p>Launch on ${form}</p>`);
      expect((await textProblems(control, 'control')).length, 'a planted date form is caught').toBeGreaterThan(0);
    }
    for (const line of ['Presale', 'Couldn’t simulate', "You're offline", 'The server is not answering', 'Something went wrong']) {
      await control.setContent(`<p>${line}</p>`);
      expect((await textProblems(control, 'control')).length, `"${line}" is caught`).toBe(1);
    }
    await control.setContent('<p>12.4836 SOL</p>');
    expect(await textProblems(control, 'control')).toEqual([]);
    await control.close();

    h.fake.lamports.set(ACCOUNT, LAMPORTS);
    h.fake.tokenAccounts.set(ACCOUNT, TOKENS);
    h.fake.accountKinds.set(FRIEND, 'wallet');
    const at = Date.now();
    const grant = {origin: SITE, account: ACCOUNT, scope: 'persistent', connectedAt: at - 86_400_000, lastUsedAt: at, recent: []};
    await h.sw.evaluate(o => chrome.storage.local.set(o), {
      v1_vault: await makeEnvelope({accounts: 2}),
      v1_phishing_phrase: PHRASE,
      v1_known_recipients: [
        {address: FRIEND, at},
        {address: SHOP, at},
      ],
      v1_dapp_grants: [grant],
      v1_dapp_limits: {rejections: [], cooldowns: [], windows: [], notice: false},
      // The recovery phrase verified (as #4's check would record it): #35 lists only the passkey as outstanding.
      v1_settings: {phraseVerifiedAt: at - 86_400_000},
    });
    const vault = await h.ctx.newPage();
    await unlockWith(vault, h.id, E2E_PASSWORD);
    await vault.close();

    // 1 — the popup's home as it opens, loaded (not #42's "Connected · syncing"): the total of SOL, USDC and USDT in the
    // frame, the token list starting under the actions (USDC and USDT are below the popup's fold; #4 shows them).
    const p = await h.openPopup();
    await expect(p.getByText('12.4836 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await expect(p.getByText('Connected · syncing')).toHaveCount(0);
    await expect(p.getByText('$3,603', {exact: true})).toBeInViewport({ratio: 1});
    await expect(p.getByText('Solana', {exact: true})).toBeInViewport({ratio: 1});
    await cleanText(p, NAMES[0]);
    await compose(h, NAMES[0], await capture(p, POPUP), POPUP);

    // 2 — the send review (#19): 1.25 SOL to a known wallet, simulated.
    await p.getByRole('button', {name: 'Send', exact: true}).click();
    await p.getByLabel('Recipient', {exact: true}).fill(FRIEND);
    await p.getByLabel('Amount').fill('1.25');
    await p.locator('.sticky-bar button').click();
    await expect(p.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
    await expect(p.getByText('Recipient is a regular wallet')).toBeVisible();
    await expect(p.getByRole('button', {name: 'Continue to confirm'})).toBeEnabled();
    await p.locator('main.app-content').evaluate(e => e.scrollTo(0, 0));
    await cleanText(p, NAMES[1]);
    await compose(h, NAMES[1], await capture(p, POPUP), POPUP);
    await p.getByRole('button', {name: 'Cancel'}).click();
    await expect(p.getByLabel('Recipient', {exact: true})).toBeVisible();
    await p.close();

    // 3 — a site's transaction (#48) in the approval window: the anti-phishing line, the simulation, Approve armed.
    const site = await openDapp(h.ctx, SITE);
    await expect.poll(() => connect(site, true)).toEqual({ok: true, value: [ACCOUNT]});
    let request!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (request = customSignTx(site, BLOCKHASH, ACCOUNT, [PAYMENT])));
    await win.setViewportSize(WINDOW);
    await expect(win.getByText('Balance changes (post-simulation)').first()).toBeVisible({timeout: 30_000});
    await expect(win.locator('.app-phrase-line')).toHaveText(`Anti-phishing phrase: ${PHRASE}`);
    await expect(win.getByRole('button', {name: 'Approve', exact: true})).toBeEnabled();
    await cleanText(win, NAMES[2]);
    await compose(h, NAMES[2], await capture(win, WINDOW), WINDOW);
    await win.getByRole('button', {name: 'Reject'}).click();
    expect(((await request) as {ok: boolean}).ok).toBe(false);
    await windowClosed(win);
    await site.close();

    // 4 — the wallet tab (wallet.html) at 1280 × 800: its home.
    const tab = await h.ctx.newPage();
    await tab.setViewportSize({width: STORE_SHOT.width, height: STORE_SHOT.height});
    await tab.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    await expect(tab.getByText('12.4836 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await expect(tab.getByText('Connected · syncing')).toHaveCount(0);
    for (const t of ['Solana', 'USD Coin', 'Tether', '$1,250.00', '$480.50']) await expect(tab.getByText(t, {exact: true})).toBeInViewport({ratio: 1});
    await cleanText(tab, NAMES[3]);
    save(NAMES[3], await capture(tab, {width: STORE_SHOT.width, height: STORE_SHOT.height}));
    await tab.close();

    // 5 — Settings › Security center (#35): the anti-phishing phrase On.
    const s = await h.openPopup();
    await expect(s.getByText('12.4836 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await s.getByRole('button', {name: 'Settings'}).click();
    await s.locator('.s7-title', {hasText: 'Security center'}).click();
    await expect(s.getByText('1 outstanding task.')).toBeVisible();
    const row = s.locator('.s7-row', {hasText: 'Anti-phishing phrase'});
    await expect(row.locator('.s7-meta')).toHaveText('On');
    // Scrolled so the Locks group starts directly under the pinned top bar (--space-3 below it): Auto-lock … the phrase's
    // row … Change password in the frame, the danger zone below it.
    const locks = s.locator('p.app-overline', {hasText: 'Locks'});
    await s.locator('main.app-content').evaluate((main, el) => {
      const bar = main.querySelector('.top-bar');
      if (el === null || bar === null) throw new Error('no Locks overline or top bar');
      const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-3'));
      main.scrollTop += el.getBoundingClientRect().top - bar.getBoundingClientRect().bottom - gap;
    }, await locks.elementHandle());
    await expect(locks).toBeInViewport({ratio: 1});
    await expect(row).toBeInViewport({ratio: 1});
    const barBottom = await s.locator('main.app-content .top-bar').evaluate(e => e.getBoundingClientRect().bottom);
    expect((await locks.boundingBox())?.y ?? 0, 'the Locks overline clear of the top bar').toBeGreaterThanOrEqual(barBottom);
    await cleanText(s, NAMES[4]);
    await compose(h, NAMES[4], await capture(s, POPUP), POPUP);
    await s.close();

    for (const n of NAMES) expect(storeShotProblems(readFileSync(`${OUT}${n}.png`)), `${n}.png at the end`).toEqual([]);
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});
