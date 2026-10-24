import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {EXT, EXT_NOPRESALE} from './launch';
import {MAIN, contained, launchPopup, seedUnlockedWallet} from './popupHarness';

declare const chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}};

// B1d §1.1: both builds boot — the module service worker loads and answers, the popup renders #11 — and each is the
// build it claims to be (its app.features.json, written by scripts/build.mjs next to the package). The on build is the
// positive control for the off build: the same steps, the same answers.
for (const [name, ext, presale] of [
  ['on (dist)', EXT, true],
  ['off (dist-nopresale)', EXT_NOPRESALE, false],
] as const) {
  test(`switch · the ${name} build boots: the background answers, the popup renders #11`, async () => {
    expect(JSON.parse(readFileSync(join(dirname(ext), 'app.features.json'), 'utf8'))).toEqual({presale});
    const h = await launchPopup(`noctura-e2e-switch-${presale ? 'on' : 'off'}-`, {ext});
    try {
      await seedUnlockedWallet(h.sw);
      const popup = await h.openPopup();
      await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
      const status = await popup.evaluate(() => chrome.runtime.sendMessage({type: 'vault.status'}));
      expect(status).toEqual({ok: true, data: {unlocked: true, accounts: [{index: MAIN.index, publicKey: MAIN.publicKey}, expect.objectContaining({index: 1})]}});
      // B1d-1b: the on build registers presale.view (its handler refuses a payload without an account); the off build has
      // no such type — an unknown type, refused before any handler.
      expect(await popup.evaluate(() => chrome.runtime.sendMessage({type: 'presale.view'}))).toEqual({ok: false, error: presale ? 'malformed' : 'unknown type'});
      contained(h);
    } finally {
      await h.close();
    }
  });
}
