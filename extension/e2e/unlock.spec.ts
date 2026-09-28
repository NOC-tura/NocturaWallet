import {test, expect, chromium} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeEnvelope, E2E_PASSWORD} from './makeEnvelope';

declare const chrome: {storage: {local: {set(o: object): Promise<void>}; session: {get(k: null): Promise<object>; clear(): Promise<void>}}};

// The package is an ES module ("type": "module"), where __dirname does not exist.
const EXT = fileURLToPath(new URL('../dist/chrome', import.meta.url));

test('unlocking in the vault page puts only signing keys into session storage', async () => {
  const profile = mkdtempSync(join(tmpdir(), 'noctura-e2e-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    // The default headless browser is chrome-headless-shell, which does not load extensions
    // (the service worker never starts). channel 'chromium' is Playwright's full Chromium build
    // in new headless mode, which does.
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  try {
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
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});
