import {test, expect, type Page, type Worker} from '@playwright/test';
import {contained, launchPopup, type Harness} from './popupHarness';
import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {BLOCKHASH_LIFETIME} from './fakeCoordinator';
import {createWallet, importWallet, pastePhrase, recordSent, sentFrom, setPassword, tryUnlock, unlockWith} from './vaultPage';

// Spec B1b-2a §8.5, plan 2: specs 1–3, 10 and 12, against the real extension (vault page + UI tab +
// popup) and the contained fake coordinator. Every spec ends with contained(h).
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
/** OTHER's SLIP-0010 account 0 (derived once with src/vault/accounts.ts). */
const OTHER_ACCOUNT = 'BLeUXTx9thHGT7VJUtF9vHEmfMDgW1nnKZ9UVer2CoLX';
const NEW_PASSWORD = 'a brand new e2e password';
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';

declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}};
};
const stored = (sw: Worker): Promise<string> => sw.evaluate(async () => JSON.stringify((await chrome.storage.local.get('v1_vault')).v1_vault));
const msg = async (page: Page, m: unknown) => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as {ok: boolean; error?: string; data?: unknown};
const groups = async (page: Page, scope: string): Promise<string> => (await page.locator(`${scope} .addr-groups > span`).allTextContents()).join('');
/** The vault.forgetWallet messages the recorded tab sent, as recordSent logged them. */
const forgets = async (page: Page) => (await sentFrom(page)).filter(m => m.type === 'vault.forgetWallet');

test('1 · onboarding create: #1 → #2 → #3 → #4 → #5 → #6 → #7 shows the address; then the popup is #11; the vault page has Geist', async () => {
  const h = await launchPopup('noctura-e2e-create-');
  try {
    const vault = await h.ctx.newPage();
    await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
    await expect(vault.getByText('A Solana wallet built for private, non-custodial holding.')).toBeVisible();
    // Review L5: the design's font reaches the vault page (a face that loads, not the fallback).
    expect(await vault.evaluate(async () => (await document.fonts.load('16px Geist')).length)).toBeGreaterThan(0);
    expect(await vault.evaluate(() => document.fonts.check('16px Geist'))).toBe(true);
    await createWallet(vault, h.id, NEW_PASSWORD, {fromWelcome: true});
    await expect(vault.getByText('Wallet created')).toBeVisible();
    const account = (JSON.parse(await stored(h.sw)) as {accounts: {publicKey: string}[]}).accounts[0]?.publicKey ?? '';
    expect(account).not.toBe('');
    expect(await groups(vault, '.addr-card')).toBe(account);
    await expect(vault.getByText('Wallet is ready — open the Noctura icon')).toBeVisible();
    const popup = await h.openPopup();
    await expect(popup.getByText('TOKENS')).toBeVisible();
    await expect(popup.locator('.tokens .row[data-token="SOL"] .meta .sec')).toHaveText('10.0000 SOL');
    contained(h);
  } finally {
    await h.close();
  }
});

test('2 · import: #8 paste → the scheme detected → #5 → #40 with the fake’s balances', async () => {
  const h = await launchPopup('noctura-e2e-import-');
  try {
    // Only SLIP-0010 account 0 holds anything: detection picks slip10 by itself, accounts 0 … 0.
    h.fake.defaultLamports = 0;
    h.fake.lamports.set(E2E_ACCOUNTS[0], 10_000_000_000);
    const vault = await h.ctx.newPage();
    await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=import`);
    await pastePhrase(vault, E2E_MNEMONIC);
    await expect(vault.getByText('Pasted from clipboard. Noctura cannot clear your clipboard — clear it yourself.')).toBeVisible();
    await expect(vault.getByText('Valid 12-word BIP-39 phrase · checksum OK')).toBeVisible();
    await vault.locator('#imp-continue').click();
    // The scheme was detected: no choice was offered, the run went straight on to #5.
    await expect(vault.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
    await expect(vault.locator('#imp-choose')).toBeHidden();
    await setPassword(vault, NEW_PASSWORD);
    await vault.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
    await expect(vault.getByText('Wallet imported', {exact: true})).toBeVisible({timeout: 30_000});
    await expect(vault.getByText('1 account · 1 token recovered. Welcome back.')).toBeVisible();
    await expect(vault.locator('.s8-token-row .amt')).toHaveText(['10.0000']);
    expect(await groups(vault, '.s8-addr-chip')).toBe(E2E_ACCOUNTS[0]);
    // Detected from the balances the probe read (getMultipleAccounts: account 0 funded, the CLI key empty): slip10, account 0 only.
    expect(h.fake.hits.some(x => x.rpcMethod === 'getMultipleAccounts')).toBe(true);
    const env = JSON.parse(await stored(h.sw)) as {scheme: string; accounts: {publicKey: string}[]};
    expect(env.scheme).toBe('slip10');
    expect(env.accounts.map(a => a.publicKey)).toEqual([E2E_ACCOUNTS[0]]);
    contained(h);
  } finally {
    await h.close();
  }
});

test('3 · unlock: the popup’s locked screen → the tab → wrong passwords → the cooldown → the right one → the popup is #11', async () => {
  const h = await launchPopup('noctura-e2e-unlock-');
  try {
    await h.sw.evaluate(async e => chrome.storage.local.set({v1_vault: e}), await makeEnvelope());
    const popup = await h.openPopup();
    await expect(popup.getByText('Welcome back')).toBeVisible();
    const [vault] = await Promise.all([h.ctx.waitForEvent('page'), popup.getByRole('button', {name: 'Unlock', exact: true}).click()]);
    await vault.waitForURL(`chrome-extension://${h.id}/unlock.html?mode=unlock`);
    // The page's clock, so the engine's 2 s wait can be held while the cooldown card is asserted: installed,
    // then the same URL loaded again. It follows real time until paused below.
    await vault.clock.install();
    await vault.reload();
    await expect(vault.locator('#unl-password')).toBeEditable();
    // The first wrong password: no wait. The second: the engine's 1 s, waited out on the real clock.
    for (let i = 0; i < 2; i++) {
      await vault.locator('#unl-password').fill('not the password at all');
      await vault.locator('#unl-submit').click();
      await expect(vault.locator('#unl-helper')).toHaveText('That did not unlock the wallet.', {timeout: 60_000});
      await expect(vault.locator('#unl-submit')).toBeEnabled({timeout: 10_000});
    }
    // The third: the engine's 2 s wait, as the design's cooldown card — held by the paused page clock (the
    // Argon2id check runs in a worker, which the page clock does not hold).
    await vault.clock.pauseAt(await vault.evaluate(() => Date.now() + 1_000));
    await vault.locator('#unl-password').fill('not the password at all');
    await vault.locator('#unl-submit').click();
    await expect(vault.locator('#unl-cooldown').getByText('Wait a moment', {exact: true})).toBeVisible({timeout: 60_000});
    await expect(vault.locator('#unl-timer')).toHaveText('0:02');
    await expect(vault.locator('#unl-paused')).toBeDisabled();
    await expect(vault.locator('#unl-submit')).toBeHidden();
    await vault.clock.resume();
    await expect(vault.locator('#unl-cooldown')).toBeHidden({timeout: 30_000});
    await expect(vault.locator('#unl-helper')).toHaveText('That did not unlock the wallet.');
    await expect(vault.locator('#unl-submit')).toBeEnabled({timeout: 10_000});
    await vault.locator('#unl-password').fill(E2E_PASSWORD);
    await vault.locator('#unl-submit').click();
    await expect(vault.locator('#unl-notice-line')).toHaveText('Unlocked.', {timeout: 60_000});
    const again = await h.openPopup();
    await expect(again.getByText('TOKENS')).toBeVisible();
    // #11 read the fake (the balance on screen is its 10 SOL), so contained() sees the route at work.
    await expect(again.locator('.tokens .row[data-token="SOL"] .meta .sec')).toHaveText('10.0000 SOL');
    contained(h);
  } finally {
    await h.close();
  }
});

/** #9 → "Forgot password?" → #39 (three steps) → #8 on the restore path. */
async function toRestore(vault: Page, id: string): Promise<void> {
  await vault.goto(`chrome-extension://${id}/unlock.html`);
  await vault.getByRole('button', {name: 'Forgot password?'}).click();
  await expect(vault.locator('#fg-step')).toHaveText('1 / 3');
  await expect(vault.locator('#fg-title')).toHaveText('Forgot your password?');
  await vault.locator('#fg-next').click();
  await expect(vault.locator('#fg-step')).toHaveText('2 / 3');
  await vault.locator('#fg-next').click();
  await expect(vault.locator('#fg-step')).toHaveText('3 / 3');
  await vault.locator('#fg-next').click();
  await vault.waitForURL(/mode=import&source=forgot$/);
  await expect(vault.locator('#imp-phrase')).toBeEditable();
}

test('10 · forgot password → restore (E5): a different phrase changes nothing; the right one restores both accounts under a new password', async () => {
  const h = await launchPopup('noctura-e2e-restore-');
  try {
    await h.sw.evaluate(async ({e, r}) => chrome.storage.local.set({v1_vault: e, v1_known_recipients: [{address: r, at: 1}]}), {e: await makeEnvelope({accounts: 2}), r: RECIPIENT});
    const vault = await h.ctx.newPage();
    await recordSent(vault);
    await toRestore(vault, h.id);
    const before = await stored(h.sw);
    await pastePhrase(vault, OTHER);
    await vault.locator('#imp-continue').click();
    await expect(vault.locator('#imp-notice-line')).toHaveText('This phrase does not belong to the wallet in this browser. Nothing was changed.', {timeout: 30_000});
    expect(await stored(h.sw)).toBe(before);
    // The seed proof is local: nothing was asked of the background to tell it apart.
    expect(await forgets(vault)).toEqual([]);
    await vault.getByRole('button', {name: 'Try another phrase'}).click();
    await pastePhrase(vault, E2E_MNEMONIC);
    await vault.locator('#imp-continue').click();
    await expect(vault.locator('#pw-step')).toHaveText('Restore · 2 / 2', {timeout: 30_000});
    await setPassword(vault, NEW_PASSWORD);
    await vault.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
    await expect(vault.getByText('2 accounts · 1 token recovered.')).toBeVisible({timeout: 30_000});
    await expect(vault.locator('.s8-token-row .sec')).toHaveText(['Solana · 2 accounts']);
    // The same wallet, both accounts and their names, re-encrypted: one forget, always with its replacement.
    const after = JSON.parse(await stored(h.sw)) as {accounts: {index: number; name: string; publicKey: string}[]};
    expect(after.accounts).toEqual([
      {index: 0, name: 'Account 1', publicKey: E2E_ACCOUNTS[0]},
      {index: 1, name: 'Savings', publicKey: E2E_ACCOUNTS[1]},
    ]);
    expect(await forgets(vault)).toEqual([{type: 'vault.forgetWallet', guard: null, replacement: true}]);
    // The old password no longer unlocks; the new one does.
    expect(await tryUnlock(vault, h.id, E2E_PASSWORD)).toBe('That did not unlock the wallet.');
    expect(await tryUnlock(vault, h.id, NEW_PASSWORD)).toBe('Unlocked.');
    // D40: the same wallet was proven, so its known recipients stay. (#12's "Verified · sent before" hint
    // is plan 3's screen; the engine message it reads is checked here.)
    const ui = await h.ctx.newPage();
    await ui.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    expect(await msg(ui, {type: 'wallet.recipientInfo', account: E2E_ACCOUNTS[0], recipient: RECIPIENT})).toMatchObject({ok: true, data: {known: true}});
    expect((await sentFrom(vault)).map(m => m.type)).not.toContain('wallet.send');
    contained(h);
  } finally {
    await h.close();
  }
});

test('10 · restore while a send is still pending: send-open, nothing changed; once it expires, [Try again] restores', async () => {
  const h = await launchPopup('noctura-e2e-restore-pending-');
  try {
    h.fake.mode = 'expire';
    await h.sw.evaluate(async ({e, r}) => chrome.storage.local.set({v1_vault: e, v1_known_recipients: [{address: r, at: 1}]}), {e: await makeEnvelope(), r: RECIPIENT});
    const vault = await h.ctx.newPage();
    await unlockWith(vault, h.id, E2E_PASSWORD);
    const ui = await h.ctx.newPage();
    await ui.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    // A known recipient and a small amount: no re-authentication. A slow runner may pass the 30 s prepared TTL: prepare again.
    let signature = '';
    for (let attempt = 0; attempt < 3 && signature === ''; attempt++) {
      const prep = await msg(ui, {type: 'wallet.prepareSend', account: E2E_ACCOUNTS[0], intent: {token: 'SOL', recipient: RECIPIENT, amount: '1000000'}});
      expect(prep).toMatchObject({ok: true, data: {reauth: null}});
      const sent = await msg(ui, {type: 'wallet.send', id: (prep.data as {id: string}).id});
      if (sent.ok) signature = (sent.data as {signature: string}).signature;
    }
    expect(signature).not.toBe('');
    expect((await msg(ui, {type: 'vault.lock'})).ok).toBe(true);

    await toRestore(vault, h.id);
    const before = await stored(h.sw);
    await pastePhrase(vault, E2E_MNEMONIC);
    await vault.locator('#imp-continue').click();
    await expect(vault.locator('#pw-step')).toHaveText('Restore · 2 / 2', {timeout: 30_000});
    await setPassword(vault, NEW_PASSWORD);
    await expect(vault.locator('#pw-helper')).toHaveText('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.', {timeout: 60_000});
    await expect(vault.locator('#pw-cta')).toHaveText('Try again');
    expect(await stored(h.sw)).toBe(before);

    // Past the blockhash's life with margin: two null history rounds, then expired (wallet.spec's rule).
    const record = (await msg(ui, {type: 'wallet.pending'})).data as {signature: string; lastValidBlockHeight: number; state: string}[];
    h.fake.blockHeight = (record.find(r => r.signature === signature)?.lastValidBlockHeight ?? h.fake.blockHeight + BLOCKHASH_LIFETIME) + 33;
    await expect
      .poll(async () => ((await msg(ui, {type: 'wallet.pending'})).data as {signature: string; state: string}[]).find(r => r.signature === signature)?.state, {timeout: 60_000, intervals: [1_000]})
      .toBe('expired');
    // [Try again]: the same password, held by #5 behind the button (E5).
    await vault.getByRole('button', {name: 'Try again'}).click();
    await vault.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
    expect(await stored(h.sw)).not.toBe(before);
    expect(await tryUnlock(vault, h.id, NEW_PASSWORD)).toBe('Unlocked.');
    // Exactly the one send, made before the restore; nothing re-sent.
    expect(h.fake.broadcasts).toEqual([signature]);
    contained(h);
  } finally {
    await h.close();
  }
});

/** #40 empty → [Try a different seed] → the vault page's retry path (password first). */
async function toRetry(h: Harness, vault: Page): Promise<void> {
  h.fake.defaultLamports = 0;
  await importWallet(vault, h.id, E2E_MNEMONIC, E2E_PASSWORD);
  await expect(vault.getByText('Wallet imported · empty')).toBeVisible({timeout: 30_000});
  await vault.getByRole('button', {name: 'Try a different seed'}).click();
  await vault.waitForURL(/mode=import&source=retry$/);
  await expect(vault.getByText('Confirm with the password of the wallet you are replacing')).toBeVisible();
  await expect(vault.locator('#rp-password')).toBeEditable();
}

test('12 · try a different seed (D41): a wrong password changes nothing; the right one, then phrase B, replaces the empty wallet', async () => {
  const h = await launchPopup('noctura-e2e-retry-');
  try {
    const vault = await h.ctx.newPage();
    await recordSent(vault);
    await toRetry(h, vault);
    const before = await stored(h.sw);
    await vault.locator('#rp-password').fill('not the password at all');
    await vault.locator('#rp-confirm').click();
    await expect(vault.locator('#rp-helper')).toHaveText('That did not confirm it.', {timeout: 60_000});
    expect(await stored(h.sw)).toBe(before);
    await vault.locator('#rp-password').fill(E2E_PASSWORD);
    await vault.locator('#rp-confirm').click();
    await expect(vault.locator('#v-import')).toBeVisible({timeout: 60_000});
    await expect(vault.locator('#imp-phrase')).toHaveValue('');
    // The factor proof is local: nothing deleted yet.
    expect(await forgets(vault)).toEqual([]);
    expect(await stored(h.sw)).toBe(before);
    await pastePhrase(vault, OTHER);
    await vault.locator('#imp-continue').click();
    await expect(vault.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
    await setPassword(vault, NEW_PASSWORD);
    await vault.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
    await expect(vault.getByText('Wallet imported · empty')).toBeVisible({timeout: 30_000});
    expect(await groups(vault, '.s8-addr-chip')).toBe(OTHER_ACCOUNT);
    // A was deleted while unfunded, under the guard — one forget, never without it.
    expect(await forgets(vault)).toEqual([{type: 'vault.forgetWallet', guard: 'unfunded', replacement: false}]);
    expect((JSON.parse(await stored(h.sw)) as {accounts: {publicKey: string}[]}).accounts.map(a => a.publicKey)).toEqual([OTHER_ACCOUNT]);
    expect(await tryUnlock(vault, h.id, E2E_PASSWORD)).toBe('That did not unlock the wallet.');
    expect(await tryUnlock(vault, h.id, NEW_PASSWORD)).toBe('Unlocked.');
    contained(h);
  } finally {
    await h.close();
  }
});

test('12 · funds that arrive after #40 rendered empty refuse the delete in the background (C6): "This wallet now holds funds."', async () => {
  const h = await launchPopup('noctura-e2e-retry-funded-');
  try {
    const vault = await h.ctx.newPage();
    await recordSent(vault);
    await toRetry(h, vault);
    const before = await stored(h.sw);
    // Past the #40 click: the chain credits account 0.
    h.fake.lamports.set(E2E_ACCOUNTS[0], 1_000_000_000);
    await vault.locator('#rp-password').fill(E2E_PASSWORD);
    await vault.locator('#rp-confirm').click();
    await expect(vault.locator('#v-import')).toBeVisible({timeout: 60_000});
    await pastePhrase(vault, OTHER);
    await vault.locator('#imp-continue').click();
    await expect(vault.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
    await setPassword(vault, NEW_PASSWORD);
    // `funded` stops the run: the line replaces #5's field.
    await expect(vault.locator('#pw-notice-line')).toHaveText('This wallet now holds funds. Nothing was changed.', {timeout: 60_000});
    await expect(vault.locator('#pw-field')).toBeHidden();
    expect(await stored(h.sw)).toBe(before);
    // The delete was asked, with the guard, and the guard refused it: A is still there, under its own password.
    expect(await forgets(vault)).toEqual([{type: 'vault.forgetWallet', guard: 'unfunded', replacement: false}]);
    expect(await tryUnlock(vault, h.id, E2E_PASSWORD)).toBe('Unlocked.');
    contained(h);
  } finally {
    await h.close();
  }
});
