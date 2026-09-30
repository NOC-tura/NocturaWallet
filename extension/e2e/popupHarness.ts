import {expect, type BrowserContext, type Page, type Worker} from '@playwright/test';
import {rmSync} from 'node:fs';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {installFakeCoordinator, type FakeCoordinator} from './fakeCoordinator';
import {containSolscan, expectContained, launchContained} from './launch';

declare const chrome: {storage: {local: {set(o: object): Promise<void>}; session: {set(o: object): Promise<void>}}};

/** Two accounts with known keys (32-byte seeds of 1s and 2s): public data only reaches the popup. */
export function account(index: number, name: string, fill: number) {
  const seed = new Uint8Array(32).fill(fill);
  const pub = ed25519.getPublicKey(seed);
  return {index, name, publicKey: base58.encode(pub), secretKey: base64.encode(new Uint8Array([...seed, ...pub]))};
}
export const MAIN = account(0, 'Main', 1);
export const SAVINGS = account(1, 'Savings', 2);

const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));

/**
 * A wallet the popup can show: an envelope of the right shape (the popup reads only its public part)
 * and the two signing keys in storage.session — written by the test, not through the vault page, which
 * these specs are not about (unlock.spec.ts and wallet.spec.ts cover it).
 */
export async function seedUnlockedWallet(sw: Worker, accounts = [MAIN, SAVINGS]): Promise<void> {
  const envelope = {
    v: 1,
    scheme: 'slip10',
    kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
    seed: {iv: B(12, 2), ct: B(48, 3)},
    password: {wrapped: B(40, 4)},
    accounts: accounts.map(a => ({index: a.index, name: a.name, publicKey: a.publicKey})),
  };
  const session = {accounts: accounts.map(a => ({index: a.index, publicKey: a.publicKey, secretKey: a.secretKey}))};
  await sw.evaluate(({e, s}) => Promise.all([chrome.storage.local.set({v1_vault: e}), chrome.storage.session.set({v1_session: s})]), {e: envelope, s: session});
}

export interface Harness {
  ctx: BrowserContext;
  fake: FakeCoordinator;
  sw: Worker;
  id: string;
  solscan: {hits: string[]};
  openPopup(): Promise<Page>;
  close(): Promise<void>;
}

/** The contained browser (noc-tura.io and solscan.io unresolvable, both routed), the fake, a popup opener at 412 × 600. */
export async function launchPopup(prefix: string): Promise<Harness> {
  const {ctx, profile} = await launchContained(prefix);
  const fake = await installFakeCoordinator(ctx);
  const solscan = await containSolscan(ctx);
  await expectContained(ctx);
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  const id = new URL(sw.url()).host;
  return {
    ctx,
    fake,
    sw,
    id,
    solscan,
    // Playwright cannot click the toolbar action: the popup page is opened as a page, at the popup's size.
    async openPopup() {
      const page = await ctx.newPage();
      await page.setViewportSize({width: 412, height: 600});
      await page.goto(`chrome-extension://${id}/popup.html`);
      return page;
    },
    async close() {
      await ctx.close();
      rmSync(profile, {recursive: true, force: true});
    },
  };
}

/** What every spec ends with: the route saw the worker's requests, nothing unexpected, Solscan never contacted. */
export function contained(h: Harness): void {
  expect(h.fake.hits.length).toBeGreaterThan(0);
  expect(h.fake.unexpected).toEqual([]);
  expect(h.solscan.hits).toEqual([]);
}
