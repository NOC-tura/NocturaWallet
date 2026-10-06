import {test, expect, type Page, type Worker} from '@playwright/test';
import {contained, launchPopup, type Harness} from './popupHarness';
import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {confirmWords, pastePhrase, setPassword, tryUnlock, unlockWith} from './vaultPage';
import {addPrfAuthenticator, withAuthenticatorFocus} from './virtualAuthenticator';

// Spec B1b-2b §8.3, plan 1: specs 14–18 against the real extension (popup + vault tab) and the contained fake
// coordinator. A spec that reads from the network ends with contained(h) (the route saw hits); the two delete specs that
// read nothing (send-open, C17) end with quiet(h) — nothing unexpected, Solscan and noc-tura.io untouched. The passkey
// steps use the pinned virtual-authenticator recipe (M3); the PRF probe (passkeyProbe.spec.ts) established that the
// pinned Chromium gives PRF output here — if it ever stops, these steps FAIL, never skip.
declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}};
  alarms: {get(name: string): Promise<{scheduledTime: number} | undefined>};
};
type Env = {kdf: {salt: string}; seed: unknown; password: {wrapped: string}; passkey?: unknown; accounts: {index: number; publicKey: string}[]};
const NEW_PASSWORD = 'a brand new e2e password';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
/** OTHER's SLIP-0010 account 0 (derived once with src/vault/accounts.ts). */
const OTHER_ACCOUNT = 'BLeUXTx9thHGT7VJUtF9vHEmfMDgW1nnKZ9UVer2CoLX';
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
/** What spec 15's delete wipes (spec §8.3; plan 2 adds v1_contacts). */
const WIPED = ['v1_vault', 'v1_settings', 'v1_known_recipients', 'v1_balance_cache', 'v1_price_cache'] as const;

const local = (sw: Worker, key: string) => sw.evaluate(async k => (await chrome.storage.local.get(k))[k], key);
const envOf = async (sw: Worker) => (await local(sw, 'v1_vault')) as Env | undefined;
const msg = async (page: Page, m: unknown) => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as {ok: boolean; error?: string; data?: unknown};
const groups = async (page: Page, scope: string): Promise<string> => (await page.locator(`${scope} .addr-groups > span`).allTextContents()).join('');
/**
 * What a spec that reads nothing from the network ends with (spec §8.3: hits > 0 only "where it reads"): nothing
 * unexpected, and Solscan and every noc-tura.io name never contacted. containment.spec.ts proves the counters count.
 */
function quiet(h: Harness): void {
  expect(h.fake.unexpected).toEqual([]);
  expect(h.solscan.hits).toEqual([]);
  expect(h.nocTura.hits).toEqual([]);
}
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
    // The settings read is back (its metas drawn, and a toast would be set in the same answer): then no toast (fix round 1).
    await expect(third.locator('.s7-row', {hasText: 'Recovery phrase'}).locator('.s7-meta')).toHaveText('Not verified');
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
    // Under the pinned Chromium the async clipboard API throws in the vault tab (normal launch and `unshare -rn`, checked in
    // Task 18), so this sentinel branch does not run today: the coverage is the grid's `copy` being defaultPrevented
    // (above) plus the permissions gate (check-permissions.mjs: exactly storage + alarms, no clipboardWrite).
    if (clipboard) expect(await tab.evaluate(() => navigator.clipboard.readText())).toBe('e2e-sentinel');
    // Held past the 20 s auto-blur: "Still looking?", and no word of the phrase left in the DOM (fix round 1): every cell
    // is the stand-in, no cell is any word of the phrase, and the whole document — text, attributes (aria-*, title, data-*)
    // and all — carries no "abandon" (a word in no UI copy; "about" is, so it is no marker).
    await expect(tab.locator('#seed-overlay-title')).toHaveText('Still looking?', {timeout: 30_000});
    const terms = await tab.locator('#seed-grid .term').allTextContents();
    expect(terms).toEqual(Array.from({length: 12}, () => 'xxxxxx'));
    expect(terms.filter(t => E2E_MNEMONIC.split(' ').includes(t))).toEqual([]);
    expect(await tab.evaluate(() => document.documentElement.outerHTML.includes('abandon'))).toBe(false);
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

test('17 · a weakened auto-lock is applied once, by the background: #35 → 15 → #10 → applied; a replay is unknown-challenge; 1 min applies with no tab', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-settings-apply-');
  try {
    await unlockedWallet(h);
    const popup = await settings(h);
    await popup.locator('.s7-title', {hasText: 'Security center'}).click();
    await popup.locator('.s7-title', {hasText: 'Auto-lock'}).last().click();
    const tab = await opened(h, () => popup.getByRole('button', {name: '15 min'}).click());
    const challengeId = /challenge=([0-9a-f]{32})$/.exec(tab.url())?.[1] ?? '';
    expect(challengeId).toMatch(/^[0-9a-f]{32}$/);
    await expect(tab.locator('#ra-rows')).toHaveText('Auto-lock → 15 minutes');
    // Nothing applied before #10's proof.
    expect(((await local(h.sw, 'v1_settings')) as {autoLockMinutes?: number} | undefined)?.autoLockMinutes ?? 5).toBe(5);
    await tab.locator('#ra-password').fill(E2E_PASSWORD);
    await tab.locator('#ra-confirm').click();
    await expect(tab.locator('#ra-notice-line')).toHaveText('Confirmed. The change is saved — you can close this tab.', {timeout: 60_000});
    expect(await local(h.sw, 'v1_settings')).toMatchObject({autoLockMinutes: 15});
    const alarm = await h.sw.evaluate(() => chrome.alarms.get('autolock'));
    const minutes = ((alarm?.scheduledTime ?? 0) - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15.01);
    // The replay, sent from the unlock tab's own context (review L10: VAULT_PAGE_ONLY refuses any other page).
    expect(await tab.evaluate(id => chrome.runtime.sendMessage({type: 'vault.reauthOk', challengeId: id}), challengeId)).toEqual({ok: false, error: 'unknown-challenge'});
    expect(await local(h.sw, 'v1_settings')).toMatchObject({autoLockMinutes: 15});
    // A strengthening applies at once, with no tab.
    const again = await settings(h);
    await again.locator('.s7-title', {hasText: 'Security center'}).click();
    await again.locator('.s7-title', {hasText: 'Auto-lock'}).last().click();
    const pages = h.ctx.pages().length;
    await again.getByRole('button', {name: '1 min'}).click();
    await expect.poll(async () => ((await local(h.sw, 'v1_settings')) as {autoLockMinutes?: number}).autoLockMinutes).toBe(1);
    expect(h.ctx.pages().length).toBe(pages);
    // 35c (Task 16's ruling): the card replaces its row in place and stays open on the stored value; closed, the row's
    // meta reads it.
    await expect(again.getByRole('group', {name: 'Auto-lock'}).getByRole('button', {name: '1 min'})).toHaveAttribute('aria-pressed', 'true');
    await again.locator('.app-picker-head').click();
    await expect(again.locator('.s7-row', {hasText: 'Auto-lock'}).last().locator('.s7-meta')).toHaveText('1 min');
    contained(h);
  } finally {
    await h.close();
  }
});

test('18 · remove → re-add: account 2 removed after a proof (its balance and the D16 line first), then added again at the pre-filled number — the same address', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-accounts-');
  try {
    await unlockedWallet(h, 3);
    const popup = await settings(h);
    await popup.locator('.s7-title', {hasText: 'Profile'}).click();
    await expect(popup.locator('.app-account-row .pri')).toHaveText(['Account 1', 'Savings', 'Account 3']);
    await popup.getByRole('button', {name: 'Remove Savings'}).click();
    const sheet = popup.getByRole('dialog', {name: 'Remove Savings?'});
    expect(await groups(popup, '.app-remove-sheet')).toBe(E2E_ACCOUNTS[1]);
    await expect(sheet.getByText('Holds 10.0000 SOL · $1,500.00')).toBeVisible({timeout: 30_000});
    await expect(sheet.getByText('Its funds stay on Solana; add it again to use them.')).toBeVisible();
    const tab = await opened(h, () => sheet.getByRole('button', {name: 'Continue to remove'}).click());
    await expect(tab).toHaveURL(/mode=accounts&op=remove&index=1$/);
    await expect(tab.locator('#acc-title')).toHaveText('Remove Account 2?');
    expect(await groups(tab, '#acc-address')).toBe(E2E_ACCOUNTS[1]);
    await tab.locator('#acc-password').fill(E2E_PASSWORD);
    await tab.locator('#acc-act').click();
    await expect(tab.locator('#acc-helper')).toHaveText('Done. The accounts are updated.', {timeout: 60_000});
    expect((await envOf(h.sw))?.accounts.map(a => a.index)).toEqual([0, 2]);
    expect((await envOf(h.sw))?.accounts.map(a => a.publicKey)).toEqual([E2E_ACCOUNTS[0], E2E_ACCOUNTS[2]]);

    const manager = await settings(h);
    await manager.locator('.s7-title', {hasText: 'Profile'}).click();
    await expect(manager.locator('.app-account-row .pri')).toHaveText(['Account 1', 'Account 3']);
    const add = await opened(h, () => manager.getByRole('button', {name: 'Add account'}).click());
    await expect(add.locator('#acc-title')).toHaveText('Add an account');
    await expect(add.locator('#acc-index')).toHaveValue('2');
    await add.locator('#acc-password').fill(E2E_PASSWORD);
    await add.locator('#acc-act').click();
    await expect(add.locator('#acc-helper')).toHaveText('Done. The accounts are updated.', {timeout: 60_000});
    expect((await envOf(h.sw))?.accounts.find(a => a.index === 1)?.publicKey).toBe(E2E_ACCOUNTS[1]);
    contained(h);
  } finally {
    await h.close();
  }
});

test('18 · a send from account 2 still open: the remove is refused (send-open) and the envelope is unchanged', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-accounts-open-');
  try {
    const vault = await unlockedWallet(h, 2);
    // The fake answers the poller's reads of the open send with `expire` from the moment it is written (as spec 15).
    h.fake.mode = 'expire';
    // An open send from account 2, as the engine records one (the background refuses the store, C5).
    await h.sw.evaluate(
      ([account, recipient]) =>
        chrome.storage.local.set({
          v1_pending: [{id: 'ab'.repeat(16), account, signature: '5'.repeat(88), wire: 'AQ==', lastValidBlockHeight: 1150, createdAt: Date.now(), lastSentAt: Date.now(), state: 'pending', detail: null, detailCode: null, intent: {token: 'SOL', recipient, amount: '1'}, expiryNullSeenAt: null, failure: null, fee: null}],
        }),
      [E2E_ACCOUNTS[1], RECIPIENT] as const,
    );
    const before = JSON.stringify(await envOf(h.sw));
    await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=accounts&op=remove&index=1`);
    await vault.locator('#acc-password').fill(E2E_PASSWORD);
    await vault.locator('#acc-act').click();
    await expect(vault.locator('#acc-helper')).toHaveText('A transaction from this account is still pending. Wait until it confirms or expires — about two minutes — then try again.', {timeout: 60_000});
    expect(JSON.stringify(await envOf(h.sw))).toBe(before);
    // The manager says so first: its [Continue to remove] is disabled for that account.
    const popup = await settings(h);
    await popup.locator('.s7-title', {hasText: 'Profile'}).click();
    await popup.getByRole('button', {name: 'Remove Savings'}).click();
    await expect(popup.getByRole('button', {name: 'Continue to remove'})).toBeDisabled();
    contained(h);
  } finally {
    await h.close();
  }
});

/**
 * #31 → #37 → DELETE → the hold (Space on the focused CTA, 1 s) → the delete tab. Fix round 1 (review M1): the tab must
 * not open within 800 ms of the key-down — a short hold would (the hold needs a full 1 s); the key is held to 1.2 s.
 */
async function toDeleteTab(h: Harness, popup: Page, o: {checkPartial?: boolean} = {}): Promise<Page> {
  await popup.locator('.s7-title', {hasText: 'Delete wallet'}).click();
  await expect(popup.getByText('Delete this wallet?')).toBeVisible();
  const field = popup.getByRole('textbox', {name: 'Type DELETE here'});
  if (o.checkPartial === true) {
    await field.fill('DEL');
    await expect(popup.locator('.app-delete-help')).toHaveText('3 of 6 characters · keep going');
  }
  await field.fill('DELETE');
  await expect(popup.getByText('Confirmation matched')).toBeVisible();
  const hold = popup.locator('.app-hold');
  await hold.focus();
  const pageAt: number[] = [];
  const onPage = () => pageAt.push(Date.now());
  h.ctx.on('page', onPage);
  try {
    const next = h.ctx.waitForEvent('page');
    const down = Date.now();
    await popup.keyboard.down(' ');
    // A Node timer, not the popup's: the popup closes itself once the proof page opens (a short hold would close it early).
    await new Promise(r => setTimeout(r, 800));
    // Timestamps, not "nothing yet": a late timer cannot turn a correct 1 s hold into a failure.
    expect(pageAt.filter(t => t - down < 800)).toEqual([]);
    await new Promise(r => setTimeout(r, 400));
    // The key-up may land on a closed page.
    await popup.keyboard.up(' ').catch(() => undefined);
    const tab = await next;
    await tab.waitForLoadState('domcontentloaded');
    return tab;
  } finally {
    h.ctx.off('page', onPage);
  }
}
/**
 * Records, in a vault tab, whether #dl-cooldown was ever shown from now on (a MutationObserver on its `hidden`) — a
 * cooldown that came and went before a retrying assertion looked would otherwise pass `toBeHidden()` (fix round 1, I2).
 */
const watchCooldown = (page: Page) =>
  page.evaluate(() => {
    const el = document.getElementById('dl-cooldown') as HTMLElement;
    const w = window as unknown as {cooldownShown: boolean};
    w.cooldownShown = !el.hidden;
    new MutationObserver(() => {
      if (!el.hidden) w.cooldownShown = true;
    }).observe(el, {attributes: true, attributeFilter: ['hidden']});
  });
const cooldownShown = (page: Page) => page.evaluate(() => (window as unknown as {cooldownShown: boolean}).cooldownShown);

test('15 · delete a funded wallet: #37 says so and names the lowest index (not the top row) → DELETE → 1 s hold → the tab shows the same address → wrong, then right → welcome; everything wiped', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-delete-');
  try {
    await unlockedWallet(h, 2);
    // Account 2 moved to the top of the display order (E14; rev 3, review M1).
    const manager = await settings(h);
    await manager.locator('.s7-title', {hasText: 'Profile'}).click();
    await manager.getByRole('button', {name: 'Move Savings up'}).click();
    await expect(manager.locator('.app-account-row .pri')).toHaveText(['Savings', 'Account 1']);
    const popup = await settings(h);
    const delPage = popup.locator('.s7-title', {hasText: 'Delete wallet'});
    await expect(delPage).toBeVisible();
    await delPage.click();
    await expect(popup.getByText('This wallet holds funds')).toBeVisible({timeout: 30_000});
    await expect(popup.locator('.app-delete-funds')).toContainText('20.0000 SOL');
    expect(await groups(popup, '.app-delete-first')).toBe(E2E_ACCOUNTS[0]);
    await popup.getByRole('button', {name: 'Back'}).click();
    const tab = await toDeleteTab(h, popup, {checkPartial: true});
    await expect(tab).toHaveURL(/mode=delete$/);
    await expect(tab.locator('#dl-address .addr-groups > span')).toHaveText(E2E_ACCOUNTS[0].match(/.{1,4}/g) ?? []);
    // Fix round 1 (review I1): every key the wipe must remove exists first, so each toBeUndefined() below proves a
    // removal. The known recipients are written as the background writes them after a confirmed send ({address, at}).
    await h.sw.evaluate(r => chrome.storage.local.set({v1_known_recipients: [{address: r, at: Date.now()}]}), RECIPIENT);
    for (const key of WIPED) await expect.poll(() => local(h.sw, key), {message: key, timeout: 30_000}).toBeDefined();
    const before = JSON.stringify(await envOf(h.sw));
    await tab.locator('#dl-password').fill('not the password at all');
    await tab.locator('#dl-delete').click();
    await expect(tab.locator('#dl-helper')).toHaveText('That did not confirm it.', {timeout: 60_000});
    expect(JSON.stringify(await envOf(h.sw))).toBe(before);
    await tab.locator('#dl-password').fill(E2E_PASSWORD);
    await tab.locator('#dl-delete').click();
    await tab.waitForURL(/mode=welcome$/, {timeout: 60_000});
    for (const key of WIPED) expect(await local(h.sw, key), key).toBeUndefined();
    contained(h);
  } finally {
    await h.close();
  }
});

test('15 · a send still open: send-open — the vault intact, the wallet locked, [Unlock] → ?mode=unlock', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-delete-open-');
  try {
    const vault = await unlockedWallet(h, 1);
    h.fake.mode = 'expire';
    await h.sw.evaluate(
      ([account, recipient]) =>
        chrome.storage.local.set({
          v1_pending: [{id: 'cd'.repeat(16), account, signature: '5'.repeat(88), wire: 'AQ==', lastValidBlockHeight: 1150, createdAt: Date.now(), lastSentAt: Date.now(), state: 'pending', detail: null, detailCode: null, intent: {token: 'SOL', recipient, amount: '1'}, expiryNullSeenAt: null, failure: null, fee: null}],
        }),
      [E2E_ACCOUNTS[0], RECIPIENT] as const,
    );
    const before = JSON.stringify(await envOf(h.sw));
    await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=delete`);
    await vault.locator('#dl-password').fill(E2E_PASSWORD);
    await vault.locator('#dl-delete').click();
    await expect(vault.locator('#dl-notice-line')).toHaveText('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.', {timeout: 60_000});
    await expect(vault.locator('#dl-notice-help')).toHaveText('The wallet has been locked. Nothing was deleted.');
    expect(JSON.stringify(await envOf(h.sw))).toBe(before);
    expect(await msg(vault, {type: 'vault.status'})).toMatchObject({ok: true, data: {unlocked: false}});
    await vault.locator('#dl-unlock').click();
    await vault.waitForURL(/mode=unlock$/);
    quiet(h);
  } finally {
    await h.close();
  }
});

test('15 · C17: the same wallet at a new revision under the delete tab (an account added) — `changed`, nothing deleted', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-delete-changed-');
  try {
    const vault = await unlockedWallet(h, 1);
    const del = await h.ctx.newPage();
    await del.goto(`chrome-extension://${h.id}/unlock.html?mode=delete`);
    await expect(del.locator('#dl-address .addr-groups')).toBeVisible();
    await watchCooldown(del);
    await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=accounts&op=add`);
    await vault.locator('#acc-password').fill(E2E_PASSWORD);
    await vault.locator('#acc-act').click();
    await expect(vault.locator('#acc-helper')).toHaveText('Done. The accounts are updated.', {timeout: 60_000});
    await del.locator('#dl-password').fill(E2E_PASSWORD);
    await del.locator('#dl-delete').click();
    await expect(del.locator('#dl-helper')).toHaveText('The wallet in this browser changed. Check the address and try again.', {timeout: 30_000});
    // Fix round 1 (review M6): the gate released, no cooldown ever shown, and the address shown is the stored wallet's
    // lowest index (still account 1: the added account has a higher index).
    await expect(del.locator('#dl-delete')).toBeEnabled();
    expect(await cooldownShown(del)).toBe(false);
    expect(await groups(del, '#dl-address')).toBe(E2E_ACCOUNTS[0]);
    expect((await envOf(h.sw))?.accounts).toHaveLength(2);
    quiet(h);
  } finally {
    await h.close();
  }
});

test('15 · rev 3 (the hard case): wallet A replaced by wallet B under the tab — A’s password is `changed` with B’s address, no `wrong`, no cooldown; B untouched', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-delete-replaced-');
  try {
    h.fake.defaultLamports = 0;
    await h.sw.evaluate(e => chrome.storage.local.set({v1_vault: e}), await makeEnvelope());
    const del = await h.ctx.newPage();
    await del.goto(`chrome-extension://${h.id}/unlock.html?mode=delete`);
    await expect(del.locator('#dl-address .addr-groups > span')).toHaveText(E2E_ACCOUNTS[0].match(/.{1,4}/g) ?? []);
    // Fix round 1 (review I2): one wrong password first — streak 1, no wait (wrongDelayMs(1) = 0). Were `changed`
    // charged to the backoff, the next outcome would be streak 2: a 1 s cooldown the watcher below records.
    await del.locator('#dl-password').fill('not the password at all');
    await del.locator('#dl-delete').click();
    await expect(del.locator('#dl-helper')).toHaveText('That did not confirm it.', {timeout: 60_000});
    await expect(del.locator('#dl-delete')).toBeEnabled();
    await watchCooldown(del);
    // A replaced by B through #40's retry path (E5 with the unfunded guard) in another tab.
    const other = await h.ctx.newPage();
    await other.goto(`chrome-extension://${h.id}/unlock.html?mode=import&source=retry`);
    await other.locator('#rp-password').fill(E2E_PASSWORD);
    await other.locator('#rp-confirm').click();
    await expect(other.locator('#v-import')).toBeVisible({timeout: 60_000});
    await pastePhrase(other, OTHER);
    await other.locator('#imp-continue').click();
    await expect(other.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
    await setPassword(other, NEW_PASSWORD);
    await other.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
    const b = JSON.stringify(await envOf(h.sw));
    expect((JSON.parse(b) as Env).accounts.map(a => a.publicKey)).toEqual([OTHER_ACCOUNT]);
    await del.locator('#dl-password').fill(E2E_PASSWORD);
    await del.locator('#dl-delete').click();
    await expect(del.locator('#dl-helper')).toHaveText('The wallet in this browser changed. Check the address and try again.', {timeout: 30_000});
    expect(await groups(del, '#dl-address')).toBe(OTHER_ACCOUNT);
    // The gate released (a charged wait would hold it), and no cooldown was ever shown.
    await expect(del.locator('#dl-delete')).toBeEnabled();
    expect(await cooldownShown(del)).toBe(false);
    await expect(del.locator('#dl-cooldown')).toBeHidden();
    expect(JSON.stringify(await envOf(h.sw))).toBe(b);
    contained(h);
  } finally {
    await h.close();
  }
});
