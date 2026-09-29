import {test, expect} from '@playwright/test';
import {rmSync} from 'node:fs';
import {makeEnvelope, E2E_PASSWORD} from './makeEnvelope';
import {expectContained, launchContained} from './launch';

declare const chrome: {storage: {local: {set(o: object): Promise<void>}; session: {get(k: null): Promise<object>; clear(): Promise<void>}}};

test('unlocking in the vault page puts only signing keys into session storage', async () => {
  // Contained like the wallet E2E: noc-tura.io does not resolve in this browser, and a route
  // records (and aborts) anything addressed to it — unlocking needs no network at all.
  const {ctx, profile} = await launchContained('noctura-e2e-');
  const contacted: string[] = [];
  await ctx.route(/^https?:\/\/([^/]*\.)?noc-tura\.io(\/|$)/, route => {
    contacted.push(route.request().url());
    return route.abort();
  });
  try {
    await expectContained(ctx);
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
    const id = new URL(sw.url()).host;

    const env = await makeEnvelope();
    await sw.evaluate(e => chrome.storage.local.set({v1_vault: e}), env);

    const page = await ctx.newPage();
    await page.goto(`chrome-extension://${id}/unlock.html`);
    await page.fill('#password', E2E_PASSWORD);
    await page.click('#unlock');
    await expect(page.locator('#status')).toHaveText('Unlocked. You can close this tab.', {timeout: 60_000});

    const session = await sw.evaluate(() => chrome.storage.session.get(null));
    const json = JSON.stringify(session);
    expect(json).toContain('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    expect(json).not.toContain('abandon');
    // Only the session key, and nothing of the envelope: not its ciphertext, not its wrapped
    // data key, and no field that so much as names a mnemonic.
    expect(Object.keys(session)).toEqual(['v1_session']);
    expect(json).not.toContain(env.seed.ct);
    expect(json).not.toContain(env.password.wrapped);
    expect(json.toLowerCase()).not.toContain('mnemonic');

    // Negative control: a wrong password sends nothing and leaves the session untouched.
    await sw.evaluate(() => chrome.storage.session.clear());
    await page.fill('#password', 'wrong horse battery staple');
    await page.click('#unlock');
    await expect(page.locator('#status')).toHaveText('That did not unlock the wallet.', {timeout: 60_000});
    expect(await sw.evaluate(() => chrome.storage.session.get(null))).toEqual({});

    // A malformed stored envelope is named as damaged — not a wrong password — and sends nothing.
    await sw.evaluate(e => chrome.storage.local.set({v1_vault: e}), {...env, password: {wrapped: 'AAAA'}});
    await page.reload();
    await page.fill('#password', E2E_PASSWORD);
    await page.click('#unlock');
    await expect(page.locator('#status')).toHaveText("This wallet's stored data is damaged.", {timeout: 60_000});
    expect(await sw.evaluate(() => chrome.storage.session.get(null))).toEqual({});
    expect(contacted).toEqual([]);
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});
