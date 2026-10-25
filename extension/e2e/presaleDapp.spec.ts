import {test, expect, type Page} from '@playwright/test';
import {base58} from '@scure/base';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {contained, launchPopup, type Harness} from './popupHarness';
import {EXT, EXT_NOPRESALE} from './launch';
import {E2E_ACCOUNTS, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {unlockWith} from './vaultPage';
import {DAPP_HOSTS, adapter, approvalWindow, openDapp, serveDapp, windowClosed, type DappServer} from './dappPage';
import {SOL_TREASURY, solPurchaseIx} from './presaleChain';
import {installPresale, watchCsp} from './presaleHelpers';

declare const chrome: {storage: {local: {set(o: object): Promise<void>}}};

// B1d §6.3 E2E 9 (B1d-1b Task 8; §3.6, D9, D15): a site's presale purchase through the provider (the test dApp's
// StandardWalletAdapter, its own transaction bytes) reaches #48 with F12 while the jurisdiction gate is closed —
// sanctioned (Q50a with the country's name) or no check (Q50b) — and only Reject; with the gate open it is B1c's F2
// warning and approvable (the positive control). The same in the build without presale (D15: the gate and F12 are
// shared compliance code). Contained as every spec: the fake coordinator, the dApp's hosts, no CSP violation.
const ACCOUNT = E2E_ACCOUNTS[0];
const DAPP = 'https://dapp.test';
const BLOCKHASH = base58.encode(new Uint8Array(32).fill(7));
/** 0.1 SOL: 1 % of the account, $15 — no re-authentication rule of B1b's applies. */
const LAMPORTS = 100_000_000n;
const Q49 = 'Presale purchase blocked';
const Q50A = (country: string) => `This transaction buys NOC in the presale, which this wallet doesn't allow from your region (${country}).`;
const Q50B = "This transaction buys NOC in the presale. The wallet's region check did not succeed, so it can't be approved — try again later.";
const Q51 = 'Only Reject is available · no override';

async function scene(prefix: string, ext: string): Promise<{h: Harness; server: DappServer; csp: string[]}> {
  const h = await launchPopup(prefix, {hosts: DAPP_HOSTS, ext});
  const server = await serveDapp(h.ctx);
  const csp = await watchCsp(h.ctx);
  // A returning buyer (no PDA is created), the treasury already paid before (no first-time recipient).
  installPresale(h, {allocation: {totalBase: 1_998_667_554_963n, spentCents: 30_000n, count: 2}});
  await h.sw.evaluate(({env, treasury}) => chrome.storage.local.set({v1_vault: env, v1_known_recipients: [{address: treasury, at: Date.now()}]}), {env: await makeEnvelope(), treasury: SOL_TREASURY});
  const vault = await h.ctx.newPage();
  await unlockWith(vault, h.id, E2E_PASSWORD);
  await vault.close();
  return {h, server, csp};
}
/** A page connected through StandardWalletAdapter (its own connect → #47b's two gates). */
async function connected(h: Harness): Promise<Page> {
  const popup = await h.openPopup();
  await expect(popup.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
  const page = await openDapp(h.ctx, DAPP);
  let c!: Promise<unknown>;
  const win = await approvalWindow(h.ctx, () => (c = adapter.connect(page)));
  await win.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
  await win.getByRole('checkbox', {name: /I've read these permissions/}).click();
  await win.getByRole('button', {name: 'Connect for this session'}).click();
  expect(await c).toEqual({ok: true, value: ACCOUNT});
  await windowClosed(win);
  return page;
}
/** The site's purchase → #48: F12 as drawn, only Reject; Reject answers the site. */
async function refused(h: Harness, page: Page, body: string): Promise<void> {
  let request!: Promise<unknown>;
  const win = await approvalWindow(h.ctx, () => (request = adapter.customSign(page, BLOCKHASH, [solPurchaseIx(ACCOUNT, LAMPORTS)])));
  const f12 = win.locator('.s9-flag-banner.danger');
  await expect(f12).toHaveCount(1, {timeout: 15_000});
  await expect(f12.locator('.head')).toHaveText(Q49);
  await expect(f12).toContainText(body);
  await expect(f12).toContainText(Q51);
  await expect(win.locator('.s9-typed-confirm, input')).toHaveCount(0);
  expect(await win.locator('.sticky-bar button').allTextContents()).toEqual(['Reject']);
  await win.getByRole('button', {name: 'Reject'}).click();
  expect(((await request) as {ok: boolean}).ok).toBe(false);
  await windowClosed(win);
}

for (const [name, ext, presale] of [
  ['on (dist)', EXT, true],
  ['off (dist-nopresale)', EXT_NOPRESALE, false],
] as const) {
  test(`9 · #48 F12, ${name}: a site's presale purchase — sanctioned → Q50a, Reject only; no check → Q50b, Reject only; the gate open → F2, approved (positive control)`, async () => {
    test.setTimeout(240_000);
    expect(JSON.parse(readFileSync(join(dirname(ext), 'app.features.json'), 'utf8'))).toEqual({presale});
    const {h, server, csp} = await scene(`noctura-e2e-presale-f12-${presale ? 'on' : 'off'}-`, ext);
    try {
      const page = await connected(h);
      h.fake.geo.check = {countryCode: 'KP', isVpn: false};
      await refused(h, page, Q50A('North Korea'));
      h.fake.geo.check = 'unreachable';
      await refused(h, page, Q50B);
      expect(h.fake.broadcasts).toEqual([]);

      // The positive control: the gate open — no F12; the purchase is F2's non-transfer warning, and Approve signs it.
      h.fake.geo.check = {countryCode: 'SI', isVpn: false};
      let request!: Promise<unknown>;
      const win = await approvalWindow(h.ctx, () => (request = adapter.customSign(page, BLOCKHASH, [solPurchaseIx(ACCOUNT, LAMPORTS)])));
      await expect(win.getByText('Balance changes (post-simulation)').first()).toBeVisible({timeout: 15_000});
      await expect(win.locator('.s9-flag-banner.danger')).toHaveCount(0);
      await expect(win.locator('.s9-flag-banner.warn .head')).toHaveText('Instructions that are not transfers');
      await win.getByRole('button', {name: 'Approve', exact: true}).click();
      expect(((await request) as {ok: boolean}).ok).toBe(true);
      await windowClosed(win);
      // The gate was asked for every simulation and every decision of a purchase (C12).
      expect(h.fake.geo.checks).toBeGreaterThanOrEqual(4);
      expect(h.fake.lamports.get(SOL_TREASURY)).toBeUndefined();
      expect(csp).toEqual([]);
      contained(h);
      expect(server.unexpected).toEqual([]);
    } finally {
      await h.close();
    }
  });
}
