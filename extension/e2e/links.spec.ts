import {readFileSync} from 'node:fs';
import {test, expect, type Page} from '@playwright/test';
import {EXT, EXT_NOPRESALE} from './launch';
import {launchPopup, seedUnlockedWallet, type Harness} from './popupHarness';

// B1e §4.1, §4.4: #1's Terms and Privacy Policy and #38's four rows, in both builds. A noc-tura.io link opens a new tab
// — its navigation is the only request it makes, caught by the contained browser's route and aborted (noc-tura.io does
// not resolve here either), so no test contacts the host. Open-source licenses opens the package's own licenses.html
// in a new tab: it loads nothing beyond itself.
const TERMS = 'https://noc-tura.io/extension/terms';
const PRIVACY = 'https://noc-tura.io/extension/privacy';
const HELP = 'https://noc-tura.io/extension/help';
const PACKAGE_VERSION: unknown = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/** Clicks a link and returns the tab it opened; the click must open one. */
async function opensTab(h: Harness, click: () => Promise<void>): Promise<Page> {
  const [tab] = await Promise.all([h.ctx.waitForEvent('page'), click()]);
  return tab;
}
/** Every request a fresh tab makes while it loads one of the package's pages, read through the DevTools protocol. */
async function requestsOf(h: Harness, page: string): Promise<string[]> {
  const tab = await h.ctx.newPage();
  try {
    const cdp = await h.ctx.newCDPSession(tab);
    const urls: string[] = [];
    cdp.on('Network.requestWillBeSent', e => urls.push(e.request.url));
    await cdp.send('Network.enable');
    await tab.goto(`chrome-extension://${h.id}/${page}`, {waitUntil: 'networkidle'});
    return urls;
  } finally {
    await tab.close();
  }
}
/** What every spec here ends with: nothing reached the network but the routes; noc-tura.io saw exactly these navigations. */
function containedExcept(h: Harness, navigations: string[]): void {
  expect(h.fake.unexpected).toEqual([]);
  expect(h.solscan.hits).toEqual([]);
  expect(h.nocTura.hits).toEqual(navigations);
}

for (const [build, ext] of [
  ['presale', EXT],
  ['no-presale', EXT_NOPRESALE],
] as const) {
  test.describe(`links (${build} build)`, () => {
    test('#1 welcome: Terms and Privacy Policy open noc-tura.io in a new tab, noopener noreferrer', async () => {
      const h = await launchPopup(`noctura-e2e-links-welcome-${build}-`, {ext});
      try {
        const vault = await h.ctx.newPage();
        await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
        const terms = vault.locator('#wel-terms');
        await expect(terms).toHaveText('By continuing you agree to the Terms and Privacy Policy.');
        for (const [name, href] of [
          ['Terms', TERMS],
          ['Privacy Policy', PRIVACY],
        ] as const) {
          const link = terms.getByRole('link', {name, exact: true});
          await expect(link).toHaveAttribute('href', href);
          await expect(link).toHaveAttribute('target', '_blank');
          await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        }
        const first = await opensTab(h, () => terms.getByRole('link', {name: 'Terms', exact: true}).click());
        await expect.poll(() => h.nocTura.hits).toEqual([TERMS]);
        expect(first).not.toBe(vault);
        const second = await opensTab(h, () => terms.getByRole('link', {name: 'Privacy Policy', exact: true}).click());
        await expect.poll(() => h.nocTura.hits).toEqual([TERMS, PRIVACY]);
        expect(second).not.toBe(vault);
        expect(vault.url()).toBe(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
        containedExcept(h, [TERMS, PRIVACY]);
      } finally {
        await h.close();
      }
    });

    test('#38 about: Terms of Service, Privacy Policy and Help & support open noc-tura.io in a new tab; Open-source licenses opens licenses.html', async () => {
      const h = await launchPopup(`noctura-e2e-links-about-${build}-`, {ext});
      try {
        await seedUnlockedWallet(h.sw);
        const p = await h.openPopup();
        await p.getByRole('button', {name: 'Settings'}).click();
        await p.getByText('About Noctura').click();
        // B1e §5.2: #38's version line is runtime.getManifest().version — package.json's, read here on its own.
        await expect(p.locator('.app-about-card .noc-mono')).toHaveText(`v${PACKAGE_VERSION}`);
        const rows = [
          ['Terms of Service', TERMS],
          ['Privacy Policy', PRIVACY],
          ['Open-source licenses', 'licenses.html'],
          ['Help & support', HELP],
        ] as const;
        for (const [name, href] of rows) {
          const link = p.getByRole('link', {name: `${name} (opens in a new tab)`});
          await expect(link).toHaveAttribute('href', href);
          await expect(link).toHaveAttribute('target', '_blank');
          await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        }
        const opened: string[] = [];
        for (const [name, href] of rows.filter(([, href]) => href !== 'licenses.html')) {
          await opensTab(h, () => p.getByRole('link', {name: `${name} (opens in a new tab)`}).click());
          opened.push(href);
          await expect.poll(() => h.nocTura.hits).toEqual(opened);
        }

        const licences = await opensTab(h, () => p.getByRole('link', {name: 'Open-source licenses (opens in a new tab)'}).click());
        await licences.waitForLoadState('load');
        expect(licences.url()).toBe(`chrome-extension://${h.id}/licenses.html`);
        await expect(licences.getByRole('heading', {level: 1})).toHaveText('Open-source licenses');
        const headings = await licences.getByRole('heading', {level: 2}).allTextContents();
        expect(headings[0]).toBe('Noctura');
        for (const want of ['@solana/web3.js 1.99.0', 'text-encoding-utf-8 1.0.2', 'geist 1.7.2', 'react-dom 18.3.1']) expect(headings).toContain(want);
        expect(headings).not.toContain('rpc-websockets 9.3.9');
        expect(await licences.locator('a, script, style, link, iframe, form, img').count()).toBe(0);
        // What the page loads, from the browser's own network log (Playwright reports no chrome-extension:// request):
        // the document itself, nothing else. Positive control: the same log of popup.html sees its scripts.
        expect(await requestsOf(h, 'popup.html')).toEqual(expect.arrayContaining([`chrome-extension://${h.id}/popup.html`, expect.stringMatching(/\.js$/)]));
        expect(await requestsOf(h, 'licenses.html')).toEqual([`chrome-extension://${h.id}/licenses.html`]);
        containedExcept(h, [TERMS, PRIVACY, HELP]);
      } finally {
        await h.close();
      }
    });
  });
}
