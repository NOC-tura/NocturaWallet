import {test, expect, type Request} from '@playwright/test';
import {rmSync} from 'node:fs';
import {EXT_NOPRESALE, containNocTura, containSolscan, expectContained, launchContained} from './launch';
import {installFakeCoordinator} from './fakeCoordinator';
import {launchPopup, seedUnlockedWallet} from './popupHarness';

// B1e §6.1 / §6.2 (privacy sentences P2, R2, R8): what the store build's requests to the coordinator carry, as the
// coordinator's access log would see them. The background's real code paths (wallet.prices: two GETs; wallet.balances:
// RPC POSTs) and the broadcast route's request shape, each recorded with its headers before the fake answers it. The
// B1e-2 dry run read the same headers on the wire from a local TLS server (Task 3 Notes): they agree with these.
//
// Positive control: a request from an ordinary https page to the same host IS recorded with its Referer and Origin —
// so "none" below means the extension sent none, not that the recorder cannot see one.

// The extension page's own API, as e2e/csp.spec.ts declares it (only what this spec calls).
declare const chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}};

const HOST = 'headers.test';
const OWNER = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';

interface Seen {
  method: string;
  url: string;
  headers: Record<string, string>;
}

test('the store build: no Referer on any coordinator request; Origin only on the POSTs, the extension origin; no cookie', async () => {
  const {ctx, profile} = await launchContained('noctura-e2e-headers-', {ext: EXT_NOPRESALE, hosts: [HOST]});
  const nocTura = await containNocTura(ctx);
  const fake = await installFakeCoordinator(ctx);
  const solscan = await containSolscan(ctx);
  const seen: Seen[] = [];
  const record = async (req: Request) => seen.push({method: req.method(), url: req.url(), headers: await req.allHeaders()});
  // Registered last, so it runs first: it records, then hands the request to the fake coordinator.
  await ctx.route(/^https:\/\/api\.noc-tura\.io\//, async route => {
    await record(route.request());
    return route.fallback();
  });
  await ctx.route(`https://${HOST}/**`, route => route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><title>t</title><p>page</p>'}));
  try {
    await expectContained(ctx);
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
    const id = new URL(sw.url()).host;
    const page = await ctx.newPage();
    await page.goto(`chrome-extension://${id}/wallet.html`);

    // The real paths: the background's own requests, asked for by an extension page.
    const prices = await page.evaluate(() => chrome.runtime.sendMessage({type: 'wallet.prices'}));
    expect(prices).toMatchObject({ok: true});
    const balances = await page.evaluate(account => chrome.runtime.sendMessage({type: 'wallet.balances', account}), OWNER);
    expect(balances).toMatchObject({ok: true});
    // The broadcast route's request exactly as core/solana/broadcast.ts sends it (its init, from the worker).
    await sw.evaluate(() =>
      fetch('https://api.noc-tura.io/api/v1/tx/broadcast', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({transaction: ''}), credentials: 'omit'}).then(
        r => r.status,
        () => 0,
      ),
    );

    const ours = [...seen];
    const paths = ours.map(s => `${s.method} ${new URL(s.url).pathname}`);
    expect(paths).toContain('GET /api/v1/wallet/prices');
    expect(paths).toContain('GET /api/v1/stats');
    expect(paths).toContain('POST /api/v1/rpc');
    expect(paths).toContain('POST /api/v1/tx/broadcast');
    for (const s of ours) {
      const where = `${s.method} ${s.url}`;
      expect(s.headers.referer, `${where}: Referer`).toBeUndefined();
      expect(s.headers.cookie, `${where}: Cookie`).toBeUndefined();
      expect(s.headers['user-agent'], `${where}: User-Agent`).toMatch(/Chrome\//);
      if (s.method === 'GET') expect(s.headers.origin, `${where}: Origin`).toBeUndefined();
      else expect(s.headers.origin, `${where}: Origin`).toBe(`chrome-extension://${id}`);
    }

    // Positive control: an https page's request to the same host is seen with both headers.
    const site = await ctx.newPage();
    await site.goto(`https://${HOST}/page`);
    await site.evaluate(() => fetch('https://api.noc-tura.io/api/v1/stats').then(r => r.status, () => 0));
    const control = seen.slice(ours.length).find(s => new URL(s.url).pathname === '/api/v1/stats');
    expect(control?.headers.referer).toBe(`https://${HOST}/`);
    expect(control?.headers.origin).toBe(`https://${HOST}`);

    expect(fake.unexpected).toEqual([]);
    expect(nocTura.hits).toEqual([]);
    expect(solscan.hits).toEqual([]);
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});

// Privacy sentence L1: the noc-tura.io pages the extension links to (#1's Terms and Privacy Policy, #38's Help &
// support) are opened by the browser with no Referer. Each real link is clicked; its navigation is recorded with its
// headers, then handed on to containNocTura (counted, aborted — noc-tura.io is never reached). Positive control: a link
// to the same host clicked on an ordinary https page IS recorded with its Referer.
test('the store build: #1 and #38 open noc-tura.io with no Referer (privacy sentence L1)', async () => {
  const h = await launchPopup('noctura-e2e-headers-links-', {ext: EXT_NOPRESALE, hosts: [HOST]});
  const navigations: Seen[] = [];
  await h.ctx.route(/^https:\/\/noc-tura\.io\//, async route => {
    const req = route.request();
    navigations.push({method: req.method(), url: req.url(), headers: await req.allHeaders()});
    return route.fallback();
  });
  await h.ctx.route(`https://${HOST}/**`, route =>
    route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><title>t</title><a id="out" href="https://noc-tura.io/extension/help">help</a>'}),
  );
  const TERMS = 'https://noc-tura.io/extension/terms';
  const PRIVACY = 'https://noc-tura.io/extension/privacy';
  const HELP = 'https://noc-tura.io/extension/help';
  const opens = async (click: () => Promise<void>) => {
    const [tab] = await Promise.all([h.ctx.waitForEvent('page'), click()]);
    return tab;
  };
  try {
    const vault = await h.ctx.newPage();
    await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
    await opens(() => vault.locator('#wel-terms-link').click());
    await expect.poll(() => navigations.length).toBe(1);
    await opens(() => vault.locator('#wel-privacy-link').click());
    await expect.poll(() => navigations.length).toBe(2);

    await seedUnlockedWallet(h.sw);
    const p = await h.openPopup();
    await p.getByRole('button', {name: 'Settings'}).click();
    await p.getByText('About Noctura').click();
    await opens(() => p.getByRole('link', {name: 'Help & support (opens in a new tab)'}).click());
    await expect.poll(() => navigations.length).toBe(3);

    expect(navigations.map(n => `${n.method} ${n.url}`)).toEqual([`GET ${TERMS}`, `GET ${PRIVACY}`, `GET ${HELP}`]);
    for (const n of navigations) {
      expect(n.headers.referer, `${n.url}: Referer`).toBeUndefined();
      expect(n.headers.cookie, `${n.url}: Cookie`).toBeUndefined();
      expect(n.headers['user-agent'], `${n.url}: User-Agent`).toMatch(/Chrome\//);
    }

    // Positive control: the same host, a link on an https page — the recorder sees the Referer that page sends.
    const site = await h.ctx.newPage();
    await site.goto(`https://${HOST}/page`);
    await site.locator('#out').click().catch(() => undefined);
    await expect.poll(() => navigations.length).toBe(4);
    expect(navigations[3]?.url).toBe(HELP);
    expect(navigations[3]?.headers.referer).toBe(`https://${HOST}/`);

    expect(h.nocTura.hits).toEqual([TERMS, PRIVACY, HELP, HELP]);
    expect(h.fake.unexpected).toEqual([]);
    expect(h.solscan.hits).toEqual([]);
  } finally {
    await h.close();
  }
});
