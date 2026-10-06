import {test, expect, type Page, type Worker} from '@playwright/test';
import {contained, launchPopup, type Harness} from './popupHarness';
import {E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {confirmWords, tryUnlock, unlockWith} from './vaultPage';
import {addPrfAuthenticator, withAuthenticatorFocus} from './virtualAuthenticator';

// Spec B1b-2b §8.3, plan 1: specs 14 and 16 (Task 18; 15, 17 and 18 are Task 19's) against the real extension (popup + vault tab) and the contained fake
// coordinator. Every spec ends with contained(h). The passkey steps use the pinned virtual-authenticator recipe (M3);
// the PRF probe (passkeyProbe.spec.ts) established that the pinned Chromium gives PRF output here — if it ever stops,
// these steps FAIL, never skip.
declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}};
  alarms: {get(name: string): Promise<{scheduledTime: number} | undefined>};
};
type Env = {kdf: {salt: string}; seed: unknown; password: {wrapped: string}; passkey?: unknown; accounts: {index: number; publicKey: string}[]};
const NEW_PASSWORD = 'a brand new e2e password';

const local = (sw: Worker, key: string) => sw.evaluate(async k => (await chrome.storage.local.get(k))[k], key);
const envOf = async (sw: Worker) => (await local(sw, 'v1_vault')) as Env | undefined;
const msg = async (page: Page, m: unknown) => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as {ok: boolean; error?: string; data?: unknown};
/** The tab the popup opens (platform.openPage → tabs.create) while `act` runs. */
async function opened(h: Harness, act: () => Promise<unknown>): Promise<Page> {
  const [tab] = await Promise.all([h.ctx.waitForEvent('page'), act()]);
  await tab.waitForLoadState('domcontentloaded');
  return tab;
}
/** A popup on #31. */
async function settings(h: Harness): Promise<Page> {
  const popup = await h.openPopup();
  // #11's first read answered first: under `unshare -rn` the popup starts offline (navigator.onLine false) and the
  // screens below read balances only once a read got through (2a review M5).
  await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
  await popup.getByRole('button', {name: 'Settings'}).click();
  await expect(popup.locator('.s7-title', {hasText: 'Security center'})).toBeVisible();
  return popup;
}
/** The vault tab's own visibility, as a tab switch would set it (the page's listeners read document.visibilityState). */
const visibility = (page: Page, state: 'hidden' | 'visible') =>
  page.evaluate(s => {
    Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => s});
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
/** A real wallet of `accounts` accounts, unlocked in `vault` (a vault tab that may carry the virtual authenticator). */
async function unlockedWallet(h: Harness, accounts: 1 | 2 | 3 = 1, o: {passkey?: boolean} = {}): Promise<Page> {
  await h.sw.evaluate(e => chrome.storage.local.set({v1_vault: e}), await makeEnvelope({accounts}));
  const vault = await h.ctx.newPage();
  await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
  if (o.passkey === true) await addPrfAuthenticator(h.ctx, vault);
  await unlockWith(vault, h.id, E2E_PASSWORD);
  if (o.passkey === true) {
    await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=passkey&op=add`);
    await vault.locator('#pm-password').fill(E2E_PASSWORD);
    await withAuthenticatorFocus(vault, () => vault.locator('#pm-act').click());
    await expect(vault.locator('#pm-line')).toHaveText('Passkey added.', {timeout: 60_000});
  }
  return vault;
}

test('14 · change password: wrong → right → same → new → mismatch → confirm; only the salt and the wrap changed; 36e once; the old password fails, the new one and the passkey unlock', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-change-password-');
  try {
    const vault = await unlockedWallet(h, 1, {passkey: true});
    const before = (await envOf(h.sw)) as Env;
    expect(before.passkey).toBeDefined();
    const popup = await settings(h);
    const tab = await opened(h, () => popup.locator('.s7-title', {hasText: 'Change password'}).click());
    await expect(tab).toHaveURL(/mode=password$/);
    await expect(tab.locator('#cp-step')).toHaveText('Step 1 of 3');
    await tab.locator('#cp-field').fill('not the password at all');
    await tab.locator('#cp-cta').click();
    await expect(tab.locator('#cp-helper')).toHaveText('That did not confirm it.', {timeout: 60_000});
    await tab.locator('#cp-field').fill(E2E_PASSWORD);
    await tab.locator('#cp-cta').click();
    await expect(tab.locator('#cp-step')).toHaveText('Step 2 of 3', {timeout: 60_000});
    await expect(tab.locator('#cp-meter-label')).toHaveText('0 of 12 characters');
    // The current password again: `step-2 same` (review H2) — nothing sent.
    await tab.locator('#cp-field').fill(E2E_PASSWORD);
    await tab.locator('#cp-cta').click();
    await expect(tab.locator('#cp-helper')).toHaveText('That is your current password. Choose a new one.', {timeout: 60_000});
    await tab.locator('#cp-field').fill(NEW_PASSWORD);
    await expect(tab.locator('#cp-meter-label')).toHaveText('Long enough');
    await tab.locator('#cp-cta').click();
    await expect(tab.locator('#cp-step')).toHaveText('Step 3 of 3', {timeout: 60_000});
    // M2: the tab hidden and shown again (a password manager in another tab) keeps step 3 and its field.
    await tab.locator('#cp-field').fill('half typed');
    await visibility(tab, 'hidden');
    await visibility(tab, 'visible');
    await expect(tab.locator('#cp-step')).toHaveText('Step 3 of 3');
    await expect(tab.locator('#cp-field')).toHaveValue('half typed');
    await tab.locator('#cp-field').fill(`${NEW_PASSWORD}!`);
    await tab.locator('#cp-cta').click();
    await expect(tab.locator('#cp-helper')).toHaveText("Passwords don't match — try again");
    await expect(tab.locator('#cp-field')).toHaveValue('', {timeout: 5_000});
    await tab.locator('#cp-field').fill(NEW_PASSWORD);
    await tab.locator('#cp-cta').click();
    await expect(tab.locator('#cp-notice-line')).toHaveText('Password updated.', {timeout: 60_000});
    await expect(tab.locator('#cp-notice-help')).toHaveText('You can close this tab. Your passkey still works.');

    const after = (await envOf(h.sw)) as Env;
    expect([after.seed, after.accounts, after.passkey]).toEqual([before.seed, before.accounts, before.passkey]);
    expect(after.kdf.salt).not.toBe(before.kdf.salt);
    expect(after.password.wrapped).not.toBe(before.password.wrapped);

    // 36e (C10): the next #31 shows "Just updated" and the toast — once.
    const again = await settings(h);
    await expect(again.getByText('Password updated')).toBeVisible();
    await expect(again.locator('.s7-row.app-just-updated .s7-meta')).toHaveText('Just updated');
    await again.close();
    const third = await settings(h);
    await expect(third.locator('.s7-title', {hasText: 'Change password'})).toBeVisible();
    await third.waitForTimeout(500);
    await expect(third.getByText('Password updated')).toHaveCount(0);

    // Lock: the old password fails, the new one unlocks, and the passkey (the same data key) unlocks.
    expect((await msg(vault, {type: 'vault.lock'})).ok).toBe(true);
    expect(await tryUnlock(vault, h.id, E2E_PASSWORD)).toBe('That did not unlock the wallet.');
    expect(await tryUnlock(vault, h.id, NEW_PASSWORD)).toBe('Unlocked.');
    expect((await msg(vault, {type: 'vault.lock'})).ok).toBe(true);
    await vault.goto(`chrome-extension://${h.id}/unlock.html`);
    // Popups and tabs opened since took the window's focus (review M2).
    await withAuthenticatorFocus(vault, () => vault.locator('#unl-passkey').click());
    await expect(vault.locator('#unl-notice-line')).toHaveText('Unlocked.', {timeout: 60_000});
    contained(h);
  } finally {
    await h.close();
  }
});

test('16 · reveal: proof → modal → hold → the words → "Still looking?" with no word in the DOM; Ctrl+C cancelled; → the check → verified; #35 all clear', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-reveal-');
  try {
    await unlockedWallet(h, 1, {passkey: true});
    const popup = await settings(h);
    await expect(popup.locator('.s7-row', {hasText: 'Recovery phrase'}).locator('.s7-meta')).toHaveText('Not verified');
    const tab = await opened(h, () => popup.locator('.s7-title', {hasText: 'Recovery phrase'}).click());
    await expect(tab).toHaveURL(/mode=reveal$/);
    await expect(tab.locator('#pp-title')).toHaveText('Show your recovery phrase');
    // D23: no passkey button on the proof, a passkey stored or not.
    await expect(tab.locator('#v-phrase-proof').getByText(/passkey/i)).toHaveCount(0);
    // The clipboard recipe (M3): a sentinel written in this tab first, where the API allows it; a document-level probe
    // records whether the grid's `copy` was cancelled (it bubbles after the grid's own listener).
    const clipboard = await tab.evaluate(async () => {
      (window as unknown as {copies: boolean[]}).copies = [];
      document.addEventListener('copy', e => (window as unknown as {copies: boolean[]}).copies.push(e.defaultPrevented));
      try {
        await navigator.clipboard.writeText('e2e-sentinel');
        return (await navigator.clipboard.readText()) === 'e2e-sentinel';
      } catch {
        return false;
      }
    });
    await tab.locator('#pp-password').fill(E2E_PASSWORD);
    await tab.locator('#pp-continue').click();
    await expect(tab.locator('#v-seed-gate')).toBeVisible({timeout: 60_000});
    await expect(tab.locator('#sg-body')).toHaveText('Move to a private place. Anyone who sees these 12 words can spend everything in this wallet, forever.');
    await tab.locator('#sg-continue').click();
    await expect(tab.locator('#seed-eyebrow')).toHaveText('Recovery phrase');
    await tab.locator('#seed-grid').focus();
    await tab.locator('#seed-grid').hover();
    await tab.mouse.down();
    await expect(tab.locator('#seed-chip')).toBeVisible({timeout: 10_000});
    expect(await tab.locator('#seed-grid .term').allTextContents()).toEqual(E2E_MNEMONIC.split(' '));
    // Ctrl+C while revealed: cancelled on the grid, and the clipboard (where readable here) still holds the sentinel.
    // Review L7: `copy` goes to the focused element — this relies on #seed-grid's tabindex="0" (unlock.html) and on
    // focus() + hover() + mouse.down() leaving the focus on the grid. A tabindex change must keep the grid focusable.
    await tab.keyboard.press('Control+c');
    await expect.poll(() => tab.evaluate(() => (window as unknown as {copies: boolean[]}).copies)).toEqual([true]);
    if (clipboard) expect(await tab.evaluate(() => navigator.clipboard.readText())).toBe('e2e-sentinel');
    // Held past the 20 s auto-blur: "Still looking?", and no word of the phrase left in the DOM.
    await expect(tab.locator('#seed-overlay-title')).toHaveText('Still looking?', {timeout: 30_000});
    expect(await tab.locator('#seed-grid .term').allTextContents()).not.toContain('abandon');
    expect(await tab.evaluate(() => document.body.innerText.includes('abandon'))).toBe(false);
    await tab.mouse.up();
    // Released after the auto-blur: "Still looking?" stays; one full hold happened, so the CTA is offered (#3's rule).
    await expect(tab.locator('#seed-cta')).toBeEnabled();
    await tab.locator('#seed-cta').click();
    await expect(tab.locator('#cnf-eyebrow')).toHaveText('Recovery phrase');
    await confirmWords(tab, E2E_MNEMONIC.split(' '));
    await tab.locator('#cnf-cta').click();
    await expect(tab.locator('#cnf-success-title')).toHaveText('Recovery phrase verified');
    await expect(tab.locator('#cnf-success-body')).toHaveText('All three words matched. You can close this tab.');
    await expect.poll(async () => ((await local(h.sw, 'v1_settings')) as {phraseVerifiedAt?: unknown} | undefined)?.phraseVerifiedAt ?? null, {timeout: 10_000}).not.toBeNull();

    const after = await settings(h);
    await expect(after.locator('.s7-row', {hasText: 'Recovery phrase'}).locator('.s7-meta')).toHaveText('Verified');
    await after.locator('.s7-title', {hasText: 'Security center'}).click();
    await expect(after.getByText('Looks great')).toBeVisible();
    await expect(after.getByText('Outstanding tasks')).toHaveCount(0);
    await expect(after.locator('.s7-row', {hasText: 'Recovery phrase verified'}).locator('.s7-meta')).toHaveText('Yes');
    contained(h);
  } finally {
    await h.close();
  }
});
