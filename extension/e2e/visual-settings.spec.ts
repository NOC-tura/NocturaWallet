import {test, expect, type Locator, type Page, type Worker} from '@playwright/test';
import {base64} from '@scure/base';
import {MAIN, SAVINGS, contained, launchPopup, seedUnlockedWallet, type Harness} from './popupHarness';
import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {confirmWords, unlockWith} from './vaultPage';
import {holdKdf, releaseKdf, shot, vaultTab} from './visualTab';
import {addPrfAuthenticator, withAuthenticatorFocus} from './virtualAuthenticator';

// Spec B1b-2b §8.4, plan 1: every state of §§3–5 the real extension can be put in, rendered at the design's sizes —
// the popup at 412 × 600, the vault tab in its 412 px column (412 × 916) — and saved for the opus-tier review against
// index.html (#31, #35, #36, #37, #6, #3, #4) with §8.4's checklist. Not a pixel diff. Every state asserts its own copy
// (and, in the popup, that it is in the viewport clear of the pinned bars) before its shot; a state that lasts a moment
// (a mismatch clear, a hold, a toast) is shot under the page's paused clock, one that lasts as long as a computation
// (checking, changing, deleting, adding, removing) is held open by the test (holdKdf) — never raced. The popup's clock is
// never run past an expiry the background stamped (plan-3 lesson): the only clocks moved here are page-local timers.
declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; remove(k: string): Promise<void>}; session: {remove(k: string): Promise<void>}};
};
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const PASSKEY = {credentialId: B(16, 7), prfSalt: B(32, 8), wrapped: B(40, 9)};
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const NEW_PASSWORD = 'a brand new visual password';
const set = (sw: Worker, o: object) => sw.evaluate(x => chrome.storage.local.set(x), o);
const msg = async (page: Page, m: unknown) => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as {ok: boolean; error?: string; data?: unknown};
/**
 * A popup shot: the state's own element is in the viewport AND clear of the pinned bars first — not drawn under the top
 * bar, the action bar or the tab bar (B1b-2a plan 3's `seen()`): scrolled to the middle of the popup only when it is not
 * already clear, as a person would scroll to it. A control inside the action bar (#37's hold) is the bar's own content.
 */
async function pop(page: Page, name: string, visible: Locator): Promise<void> {
  const bars = page.locator('main.app-content > .screen > .top-bar, main.app-content > .screen > .sticky-bar, nav.app-tab-bar');
  const under = async (): Promise<string | null> => {
    const box = await visible.boundingBox();
    if (box === null) return 'no box';
    const el = await visible.elementHandle();
    for (const bar of await bars.all()) {
      const b = await bar.boundingBox();
      if (b === null || (await bar.evaluate((e, x) => e.contains(x), el))) continue;
      if (box.y < b.y + b.height && b.y < box.y + box.height) return await bar.evaluate(e => e.className);
    }
    return null;
  };
  if ((await under()) !== null) await visible.evaluate(e => e.scrollIntoView({block: 'center'}));
  await expect(visible).toBeInViewport();
  expect(await under(), `${name}: the state's element clear of the pinned bars`).toBeNull();
  await shot(page, name, {fullPage: false});
}
/**
 * Task 20 (Task 13 carry; B1b-2a plan 3's `pinned()` guard): with the content at its top, the screen's action bar and
 * every named control in it lie inside the 600 px popup — no scroll needed to reach them.
 */
async function pinned(p: Page, controls: Locator[]): Promise<void> {
  const inView = (what: string, box: {y: number; height: number} | null) => {
    expect(box, what).not.toBeNull();
    expect(box?.y ?? -1, what).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 601) + (box?.height ?? 0), what).toBeLessThanOrEqual(600);
  };
  await p.locator('main.app-content').evaluate(e => e.scrollTo(0, 0));
  inView('the action bar', await p.locator('main.app-content > .screen > .sticky-bar').boundingBox());
  for (const c of controls) inView(`${await c.textContent()}`, await c.boundingBox());
}
/**
 * Task 20 visual pass: a caption in a plan-1 action bar has the design's `margin: 0` (ix:15083) — computed, since the UA's
 * 1em paragraph margins are what made #6 `on`'s bar 261 px of the 600.
 */
async function barCaptionsFlush(p: Page): Promise<void> {
  const captions = p.locator('main.app-content > .screen > .sticky-bar > p');
  expect(await captions.count(), 'a caption in the bar').toBeGreaterThan(0);
  for (const c of await captions.all()) {
    await expect(c).toHaveCSS('margin-top', '0px');
    await expect(c).toHaveCSS('margin-bottom', '0px');
  }
}
/** The content region scrolled to its end, for a screen taller than the popup (asserted, so the shot is not vacuous). */
async function toEnd(p: Page): Promise<void> {
  const main = p.locator('main.app-content');
  expect(await main.evaluate(e => e.scrollHeight > e.clientHeight), 'a screen taller than the popup').toBe(true);
  await main.evaluate(e => e.scrollTo(0, e.scrollHeight));
  await expect.poll(() => main.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
}
/** The popup on #11, its first read answered (see settings.spec.ts: the offline start under `unshare -rn`). */
async function popup(h: Harness, o: {clock?: boolean} = {}): Promise<Page> {
  const p = await h.openPopup(o);
  await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
  return p;
}
const toSettings = async (p: Page) => {
  await p.getByRole('button', {name: 'Settings'}).click();
  await expect(p.locator('.s7-title', {hasText: 'Security center'})).toBeVisible();
};
const openPending = (account: string) => ({
  v1_pending: [{id: 'ef'.repeat(16), account, signature: '5'.repeat(88), wire: 'AQ==', lastValidBlockHeight: 1150, createdAt: Date.now(), lastSentAt: Date.now(), state: 'pending', detail: null, detailCode: null, intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}, expiryNullSeenAt: null, failure: null, fee: null}],
});

test('visual: #31, #35, the passkey screen, the accounts manager and #37 in the popup (412 × 600)', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-vis-settings-');
  try {
    await seedUnlockedWallet(h.sw);
    let p = await popup(h);
    await toSettings(p);
    await expect(p.locator('.s7-tip p')).toHaveText('Tip — add a passkey to unlock with your fingerprint, face or security key. Your password always works too.');
    await expect(p.locator('.s7-row', {hasText: 'Security center'}).locator('.s7-meta')).toHaveText('3 to do');
    await pop(p, '31a-default-no-passkey', p.locator('.s7-tip'));
    await p.locator('.app-content').evaluate(e => e.scrollTo(0, e.scrollHeight));
    await pop(p, '31c-scrolled-advanced', p.locator('.s7-row.danger'));

    // #35 · 35a, 35c, the threshold card, 35d.
    await p.locator('.app-content').evaluate(e => e.scrollTo(0, 0));
    await p.locator('.s7-title', {hasText: 'Security center'}).click();
    await expect(p.getByText('3 outstanding tasks.')).toBeVisible();
    await pop(p, '35a-tasks-outstanding', p.getByText('Improve your security'));
    await p.locator('.s7-title', {hasText: 'Auto-lock'}).click();
    await expect(p.getByText('When idle, lock the wallet after')).toBeVisible();
    await p.getByText('A longer time asks for your password in a new tab.').scrollIntoViewIfNeeded();
    await pop(p, '35c-auto-lock-expanded', p.locator('.s7-picker'));
    await p.locator('.s7-title', {hasText: 'Re-authentication threshold'}).click();
    await expect(p.getByText('Ask for your password before sends worth more than')).toBeVisible();
    await p.getByText('A higher amount asks for your password in a new tab.').scrollIntoViewIfNeeded();
    await pop(p, '35-threshold-expanded', p.locator('.s7-picker'));
    await p.locator('.app-content').evaluate(e => e.scrollTo(0, e.scrollHeight));
    await expect(p.getByText('Danger zone')).toBeVisible();
    await pop(p, '35d-danger-zone', p.locator('.app-danger-card'));

    // The passkey screen, off.
    await p.locator('.app-content').evaluate(e => e.scrollTo(0, 0));
    await p.locator('.s7-title', {hasText: 'Passkey'}).click();
    await expect(p.getByRole('heading', {name: 'Unlock Noctura with a passkey'})).toBeVisible();
    await pinned(p, [p.getByRole('button', {name: 'Add a passkey'}), p.getByText('Confirmation opens in a new tab.')]);
    await barCaptionsFlush(p);
    await pop(p, '06m-passkey-off', p.getByRole('heading', {name: 'Unlock Noctura with a passkey'}));
    // The rows and the tip below the fold at 412 × 600 (the design's frame holds them all at 916).
    await toEnd(p);
    await expect(p.locator('.s-bio .s7-tip p')).toHaveText('Your password always works too.');
    await pop(p, '06m-passkey-off-end', p.locator('.s-bio .s7-tip'));
    await p.close();

    // A passkey stored and the phrase verified: #31 passkey on, #35 all clear (35b), the passkey screen on.
    await set(h.sw, {
      v1_vault: {v: 1, scheme: 'slip10', kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)}, seed: {iv: B(12, 2), ct: B(48, 3)}, password: {wrapped: B(40, 4)}, passkey: PASSKEY, accounts: [MAIN, SAVINGS].map(a => ({index: a.index, name: a.name, publicKey: a.publicKey}))},
      v1_settings: {phraseVerifiedAt: Date.now()},
    });
    p = await popup(h);
    await toSettings(p);
    await expect(p.locator('.s7-row', {hasText: 'Security center'}).locator('.s7-meta')).toHaveText('All done');
    await expect(p.locator('.s7-row', {hasText: 'Recovery phrase'}).locator('.s7-meta')).toHaveText('Verified');
    await pop(p, '31a-passkey-on-verified', p.locator('.s7-row', {hasText: 'Profile'}));
    await p.locator('.s7-title', {hasText: 'Security center'}).click();
    await expect(p.getByText('Looks great')).toBeVisible();
    await pop(p, '35b-all-clear', p.getByText('Active protections'));
    await p.getByRole('button', {name: 'Back'}).click();
    await p.locator('.s7-title', {hasText: 'Passkey'}).click();
    await expect(p.getByRole('heading', {name: 'Passkey is on'})).toBeVisible();
    // Task 13 carry: the `on` bar holds two buttons, a note and a caption — all of it inside 412 × 600.
    await pinned(p, [p.getByRole('button', {name: 'Replace passkey'}), p.getByRole('button', {name: 'Remove passkey'}), p.getByText('Removing it here does not delete it from your passkey manager.'), p.getByText('Confirmation opens in a new tab.')]);
    await barCaptionsFlush(p);
    await pop(p, '06m-passkey-on', p.getByRole('heading', {name: 'Passkey is on'}));
    await toEnd(p);
    await expect(p.getByText('You can unlock and confirm with it. A wallet has one passkey: a new one replaces this one.')).toBeVisible();
    await pop(p, '06m-passkey-on-end', p.locator('.s-bio .s7-tip'));
    await p.close();

    // 35: a stored value that is no preset.
    await set(h.sw, {v1_settings: {autoLockMinutes: 7, reauthUsdCents: 25_000, phraseVerifiedAt: Date.now()}});
    p = await popup(h);
    await toSettings(p);
    await p.locator('.s7-title', {hasText: 'Security center'}).click();
    await p.locator('.s7-title', {hasText: 'Auto-lock'}).last().click();
    await expect(p.locator('.s7-row', {hasText: 'Auto-lock'}).last().locator('.s7-meta')).toHaveText('7 min');
    await expect(p.locator('.s7-picker .opt.sel')).toHaveCount(0);
    await pop(p, '35-value-not-a-preset', p.locator('.s7-picker'));
    await p.close();

    // 36e on #31: the toast held under the paused clock (a page-local timer).
    await set(h.sw, {v1_settings: {passwordChangedAt: Date.now() - 30_000}});
    p = await popup(h, {clock: true});
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await toSettings(p);
    await expect(p.getByText('Password updated')).toBeVisible();
    await expect(p.locator('.s7-row.app-just-updated .s7-meta')).toHaveText('Just updated');
    // Task 17 carry: the 36e border is drawn, not just named — computed in Chromium (it once lost the cascade to the row reset).
    const decorated = p.locator('.s7-row.app-just-updated');
    await expect(decorated).toHaveCSS('border-top-width', '1px');
    await expect(decorated).toHaveCSS('border-top-style', 'solid');
    await expect(p.locator('.s7-row', {hasText: 'Lock now'})).toHaveCSS('border-top-width', '0px');
    await pop(p, '36e-password-updated', p.locator('.s7-toast'));
    await p.close();
    // Task 17 carry: the same toast on the wide tab surface (wallet.html, a normal browser window): where it sits.
    await set(h.sw, {v1_settings: {passwordChangedAt: Date.now() - 20_000}});
    const tab = await h.ctx.newPage();
    await tab.setViewportSize({width: 1280, height: 800});
    await tab.clock.install();
    await tab.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    await expect(tab.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await tab.clock.pauseAt(await tab.evaluate(() => Date.now() + 1_000));
    await toSettings(tab);
    await expect(tab.locator('.s7-toast')).toHaveText('Password updated');
    await expect(tab.locator('.s7-row.app-just-updated .s7-meta')).toHaveText('Just updated');
    await expect(tab.locator('.s7-toast')).toBeInViewport();
    await shot(tab, '36e-password-updated-tab-1280', {fullPage: false});
    await tab.close();

    // The accounts manager: the list, the remove sheet, the stale line.
    p = await popup(h);
    await toSettings(p);
    await p.locator('.s7-title', {hasText: 'Profile'}).click();
    await expect(p.locator('.app-account-row .pri')).toHaveText(['Main', 'Savings']);
    await expect(p.getByText('10.0000 SOL · $1,500.00').first()).toBeVisible();
    // Fix round 0b: the address and the balance each on one full-width line under the name and tools (they wrapped to two
    // and three lines inside a ~90 px column beside five 48 px tools).
    for (const line of await p.locator('.app-account-sub .sec').all()) expect((await line.boundingBox())?.height ?? 99, await line.textContent() ?? '').toBeLessThanOrEqual(18);
    await pop(p, '43m-accounts-list', p.locator('.app-account-row').first());
    await p.getByRole('button', {name: 'Remove Savings'}).click();
    await expect(p.getByText('Holds 10.0000 SOL · $1,500.00')).toBeVisible();
    await pop(p, '43m-remove-sheet', p.getByRole('button', {name: 'Continue to remove'}));
    await p.getByRole('button', {name: 'Cancel'}).click();
    await set(h.sw, {v1_vault: {v: 1, scheme: 'slip10', kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)}, seed: {iv: B(12, 2), ct: B(48, 3)}, password: {wrapped: B(40, 4)}, accounts: [MAIN].map(a => ({index: a.index, name: a.name, publicKey: a.publicKey}))}});
    await p.getByRole('button', {name: 'Move Main down'}).click();
    await expect(p.getByText('The accounts changed. Try again.')).toBeVisible();
    await expect(p.getByText('The last account cannot be removed.')).toBeVisible();
    await pop(p, '43m-stale-and-last-account', p.getByText('The accounts changed. Try again.'));
    await p.close();

    // #37: idle (funded), partial, not a prefix, matched, mid-hold; then send open and balances unknown.
    await seedUnlockedWallet(h.sw);
    p = await popup(h, {clock: true});
    await toSettings(p);
    await p.locator('.s7-title', {hasText: 'Delete wallet'}).click();
    await expect(p.getByText('This wallet holds funds')).toBeVisible({timeout: 30_000});
    await pop(p, '37a-idle-funded', p.getByText('Delete this wallet?'));
    const field = p.getByRole('textbox', {name: 'Type DELETE here'});
    // Task 15 M6: the EMPTY field focused shows a ring (37b's accent border), computed in Chromium — design-ext's
    // `.s7-pw input {outline: 0}` had left it with none. The colour is the one 37b's typed state draws.
    await expect(field.locator('xpath=..')).toHaveCSS('border-top-style', 'none');
    await field.focus();
    await expect(field).toHaveValue('');
    await expect(field.locator('xpath=..')).toHaveCSS('border-top-width', '1px');
    await expect(field.locator('xpath=..')).toHaveCSS('border-top-style', 'solid');
    const ring = await field.locator('xpath=..').evaluate(e => getComputedStyle(e).borderTopColor);
    await pop(p, '37a-focused-empty', field);
    await field.fill('DEL');
    await expect(field.locator('xpath=..')).toHaveCSS('border-top-color', ring);
    await expect(p.locator('.app-delete-help')).toHaveText('3 of 6 characters · keep going');
    await pop(p, '37b-partial', field);
    await field.fill('DEX');
    await expect(p.getByText('Type DELETE exactly — it is case-sensitive.')).toBeVisible();
    await pop(p, '37-not-a-prefix', field);
    await field.fill('DELETE');
    await expect(p.getByText('Confirmation matched')).toBeVisible();
    await barCaptionsFlush(p);
    await pop(p, '37c-matched', p.locator('.app-hold'));
    // §8.4 item 10: the fill and the countdown at a mid-hold frame (~60 %), the page's clock paused.
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('.app-hold').hover();
    await p.mouse.down();
    await p.clock.runFor(600);
    await expect(p.locator('.app-hold')).toHaveText('Hold to delete · 0.4 s');
    await expect(p.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    await pop(p, '37c-hold-60', p.locator('.app-hold'));
    await p.mouse.move(0, 0);
    await p.mouse.up();
    await p.close();
    await set(h.sw, openPending(MAIN.publicKey));
    p = await popup(h);
    await toSettings(p);
    await p.locator('.s7-title', {hasText: 'Delete wallet'}).click();
    await expect(p.getByText('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.')).toBeVisible();
    await pop(p, '37-send-open', p.getByText('A transaction from this wallet is still pending', {exact: false}));
    await p.close();
    await h.sw.evaluate(() => chrome.storage.local.remove('v1_pending'));
    await h.sw.evaluate(() => chrome.storage.local.remove('v1_balance_cache'));
    p = await popup(h);
    h.fake.network = 'unreachable';
    await toSettings(p);
    await p.locator('.s7-title', {hasText: 'Delete wallet'}).click();
    await expect(p.getByText('Balances could not all be checked — this wallet may hold funds.')).toBeVisible({timeout: 30_000});
    await pop(p, '37-balances-unknown', p.getByText('Balances could not all be checked', {exact: false}));
    h.fake.network = 'ok';
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: the vault tab — #36, #37’s proof, the passkey actions, accounts, reveal and verify, #10’s settings kind (412 px)', async () => {
  test.setTimeout(600_000);
  const h = await launchPopup('noctura-e2e-vis-vault-2b-');
  try {
    await set(h.sw, {v1_vault: await makeEnvelope({accounts: 2})});
    const p = await vaultTab(h, 'unlock.html?mode=welcome');
    await addPrfAuthenticator(h.ctx, p);
    await unlockWith(p, h.id, E2E_PASSWORD);
    const go = (path: string) => p.goto(`chrome-extension://${h.id}/unlock.html?${path}`);

    // Passkey · add (idle, adding held, added), replace, remove (idle, removing held, removed), no passkey.
    await go('mode=passkey&op=add');
    await expect(p.locator('#pm-title')).toHaveText('Unlock Noctura with a passkey');
    // Fix round 0b: #6's top bar with the X (spec §3), so the hero sits under a bar as #6's does.
    await expect(p.locator('#pm-x')).toBeVisible();
    await expect(p.locator('#v-passkey-manage .top-bar .title')).toHaveText('Passkey');
    await shot(p, '06m-add-idle', {ready: p.locator('#pm-act')});
    await holdKdf(p);
    await p.locator('#pm-password').fill(E2E_PASSWORD);
    await withAuthenticatorFocus(p, () => p.locator('#pm-act').click());
    await expect(p.locator('#pm-line')).toHaveText('Waiting for your passkey…');
    await shot(p, '06m-adding');
    await releaseKdf(p);
    await expect(p.locator('#pm-line')).toHaveText('Passkey added.', {timeout: 60_000});
    await shot(p, '06m-added', {ready: p.locator('#pm-close')});
    await go('mode=passkey&op=add');
    await expect(p.locator('#pm-title')).toHaveText('Replace your passkey');
    await shot(p, '06m-replace-idle', {ready: p.locator('#pm-act')});
    await p.locator('#pm-password').fill(E2E_PASSWORD);
    await withAuthenticatorFocus(p, () => p.locator('#pm-act').click());
    await expect(p.locator('#pm-line')).toHaveText('Passkey replaced.', {timeout: 60_000});
    await shot(p, '06m-replaced', {ready: p.locator('#pm-close')});
    await go('mode=passkey&op=remove');
    await expect(p.locator('#pm-title')).toHaveText('Remove your passkey');
    // Fix round 0b: the remove field's visible label (the vault pages' "Password").
    await expect(p.locator('#pm-password-label')).toHaveText('Password');
    await expect(p.locator('#pm-password-label')).toBeVisible();
    await shot(p, '06m-remove-idle', {ready: p.locator('#pm-passkey')});
    await holdKdf(p);
    await p.locator('#pm-password').fill(E2E_PASSWORD);
    await p.locator('#pm-act').click();
    await expect(p.locator('#pm-line')).toHaveText('Removing the passkey…');
    await shot(p, '06m-removing');
    await releaseKdf(p);
    await expect(p.locator('#pm-line')).toHaveText('Passkey removed.', {timeout: 60_000});
    await shot(p, '06m-removed', {ready: p.locator('#pm-close')});
    await go('mode=passkey&op=remove');
    await p.locator('#pm-password').fill(E2E_PASSWORD);
    await p.locator('#pm-act').click();
    await expect(p.locator('#pm-line')).toHaveText('This wallet has no passkey. Nothing was changed.', {timeout: 60_000});
    await shot(p, '06m-no-passkey');
    // A passkey again, for #36's `done` line and the delete page's passkey button.
    await go('mode=passkey&op=add');
    await p.locator('#pm-password').fill(E2E_PASSWORD);
    await withAuthenticatorFocus(p, () => p.locator('#pm-act').click());
    await expect(p.locator('#pm-line')).toHaveText('Passkey added.', {timeout: 60_000});

    // #36 · 36a–36e and the extension-only states.
    await go('mode=password');
    await expect(p.locator('#cp-title')).toHaveText('Enter current password');
    await shot(p, '36a-step-1', {ready: p.locator('#cp-x')});
    await p.locator('#cp-field').fill('not the password at all');
    await p.locator('#cp-cta').click();
    await expect(p.locator('#cp-helper')).toHaveText('That did not confirm it.', {timeout: 60_000});
    await shot(p, '36-step-1-wrong', {ready: p.locator('#cp-x')});
    // The common `cooldown` in a new mode (2a's card, the page's own backoff): the second wrong password waits 1 s, held
    // under the page's paused clock (a page-local timer). The X still works during the wait (Task 9 review M1).
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#cp-field').fill('not the password at all');
    await p.locator('#cp-cta').click();
    await expect(p.locator('#cp-cooldown').getByText('Wait a moment', {exact: true})).toBeVisible({timeout: 60_000});
    await expect(p.locator('#cp-cooldown-label')).toHaveText('Cooldown · 1 second remaining');
    await expect(p.locator('#cp-paused')).toHaveText('Confirm paused');
    await expect(p.locator('#cp-paused')).toBeDisabled();
    await shot(p, '36-cooldown', {ready: p.locator('#cp-x')});
    await p.clock.runFor(1_600);
    await p.clock.resume();
    await expect(p.locator('#cp-cta')).toBeVisible();
    await p.locator('#cp-field').fill(E2E_PASSWORD);
    await p.locator('#cp-cta').click();
    await expect(p.locator('#cp-title')).toHaveText('Choose a new password', {timeout: 60_000});
    await p.locator('#cp-field').fill('a few words');
    await expect(p.locator('#cp-meter-label')).toHaveText('11 of 12 characters');
    await shot(p, '36b-step-2', {ready: p.locator('#cp-x')});
    await p.locator('#cp-field').fill(E2E_PASSWORD);
    await p.locator('#cp-cta').click();
    await expect(p.locator('#cp-helper')).toHaveText('That is your current password. Choose a new one.', {timeout: 60_000});
    await shot(p, '36-step-2-same', {ready: p.locator('#cp-x')});
    await p.locator('#cp-field').fill(NEW_PASSWORD);
    await p.locator('#cp-cta').click();
    await expect(p.locator('#cp-title')).toHaveText('Confirm new password', {timeout: 60_000});
    await shot(p, '36c-step-3', {ready: p.locator('#cp-x')});
    await p.locator('#cp-x').click();
    await expect(p.locator('#cpc-title')).toHaveText('Cancel password change?');
    await shot(p, '36-cancel-confirm', {ready: p.locator('#cpc-keep')});
    await p.locator('#cpc-keep').click();
    await expect(p.locator('#cp-title')).toHaveText('Confirm new password');
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#cp-field').fill(`${NEW_PASSWORD}!`);
    await p.locator('#cp-cta').click();
    await expect(p.locator('#cp-helper')).toHaveText("Passwords don't match — try again");
    await shot(p, '36d-mismatch');
    await p.clock.runFor(700);
    await p.clock.resume();
    await expect(p.locator('#cp-field')).toHaveValue('');
    await holdKdf(p);
    await p.locator('#cp-field').fill(NEW_PASSWORD);
    await p.locator('#cp-cta').click();
    await expect(p.getByText('Updating your password…')).toBeVisible();
    await shot(p, '36-changing');
    await releaseKdf(p);
    await expect(p.locator('#cp-notice-line')).toHaveText('Password updated.', {timeout: 60_000});
    await expect(p.locator('#cp-notice-help')).toHaveText('You can close this tab. Your passkey still works.');
    await shot(p, '36-done', {ready: p.locator('#cp-close')});
    // `dropped`: the 5-minute TTL (C20), a page-local timer, run on the page's own clock.
    await go('mode=password');
    await p.locator('#cp-field').fill(NEW_PASSWORD);
    await p.locator('#cp-cta').click();
    await expect(p.locator('#cp-title')).toHaveText('Choose a new password', {timeout: 60_000});
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.clock.runFor(5 * 60_000 + 1_000);
    await expect(p.locator('#cp-helper')).toHaveText('Enter your current password again.');
    await shot(p, '36-dropped');
    await p.clock.resume();

    // The accounts mode: add (idle, adding, done, taken, not a number), remove (idle, removing, send-open, unknown).
    await go('mode=accounts&op=add');
    await expect(p.locator('#acc-title')).toHaveText('Add an account');
    await expect(p.locator('#acc-index')).toHaveValue('3');
    await shot(p, 'accounts-add-idle', {ready: p.locator('#acc-act')});
    await holdKdf(p);
    await p.locator('#acc-password').fill(NEW_PASSWORD);
    await p.locator('#acc-act').click();
    await expect(p.locator('#acc-helper')).toHaveText('Adding an account…');
    await shot(p, 'accounts-adding');
    await releaseKdf(p);
    await expect(p.locator('#acc-helper')).toHaveText('Done. The accounts are updated.', {timeout: 60_000});
    await shot(p, 'accounts-done', {ready: p.locator('#acc-act')});
    await p.locator('#acc-index').fill('1');
    await p.locator('#acc-password').fill(NEW_PASSWORD);
    await p.locator('#acc-act').click();
    await expect(p.locator('#acc-helper')).toHaveText('That account is already in this wallet.', {timeout: 60_000});
    await shot(p, 'accounts-index-taken', {ready: p.locator('#acc-act')});
    await p.locator('#acc-index').fill('0');
    await p.locator('#acc-password').fill(NEW_PASSWORD);
    await p.locator('#acc-act').click();
    await expect(p.locator('#acc-helper')).toHaveText('That is not an account number.');
    await shot(p, 'accounts-bad-index', {ready: p.locator('#acc-act')});
    await go('mode=accounts&op=remove&index=0');
    await expect(p.locator('#acc-title')).toHaveText('Remove Account 1?');
    await shot(p, 'accounts-remove-idle', {ready: p.locator('#acc-act')});
    await set(h.sw, openPending(E2E_ACCOUNTS[0]));
    await holdKdf(p);
    await p.locator('#acc-password').fill(NEW_PASSWORD);
    await p.locator('#acc-act').click();
    await expect(p.locator('#acc-helper')).toHaveText('Removing the account…');
    await shot(p, 'accounts-removing');
    await releaseKdf(p);
    await expect(p.locator('#acc-helper')).toHaveText('A transaction from this account is still pending. Wait until it confirms or expires — about two minutes — then try again.', {timeout: 60_000});
    await shot(p, 'accounts-send-open', {ready: p.locator('#acc-act')});
    await h.sw.evaluate(() => chrome.storage.local.remove('v1_pending'));
    await go('mode=accounts&op=remove&index=9');
    await expect(p.locator('#acc-helper')).toHaveText('There is no account with that number.');
    await shot(p, 'accounts-unknown-index');
    // The review rounds' `changed` (Task 12 fix round 1, O14): the stored account at the shown number is no longer the
    // address the page shows — read again at the click, before any KDF run. The public field is swapped for the shot and
    // put back after (the page reads only public fields before a proof).
    await go('mode=accounts&op=remove&index=1');
    await expect(p.locator('#acc-title')).toHaveText('Remove Account 2?');
    const before = await h.sw.evaluate(async () => ((await (chrome.storage.local as unknown as {get(k: string): Promise<Record<string, unknown>>}).get('v1_vault')) as {v1_vault: unknown}).v1_vault);
    const swapped = JSON.parse(JSON.stringify(before)) as {accounts: {index: number; publicKey: string}[]};
    for (const a of swapped.accounts) if (a.index === 1) a.publicKey = MAIN.publicKey;
    await set(h.sw, {v1_vault: swapped});
    await p.locator('#acc-password').fill(NEW_PASSWORD);
    await p.locator('#acc-act').click();
    await expect(p.locator('#acc-helper')).toHaveText('The wallet in this browser changed. Check the address and try again.');
    await expect(p.locator('#acc-password')).toHaveValue('');
    await shot(p, 'accounts-changed', {ready: p.locator('#acc-act')});
    await set(h.sw, {v1_vault: before});

    // #10's settings kind: idle (described), applied; expired (the challenge gone before the proof); not unlocked (the
    // wallet locked from another page before the proof — O41, pre-flight F4).
    const reauth = async (minutes: number): Promise<string> => {
      const r = await msg(p, {type: 'settings.set', patch: {autoLockMinutes: minutes}});
      const id = (r.data as {challengeId: string}).challengeId;
      await go(`mode=reauth&challenge=${id}`);
      await expect(p.locator('#ra-about')).toHaveText('You are about to change');
      return id;
    };
    await reauth(15);
    await expect(p.locator('#ra-rows')).toHaveText('Auto-lock → 15 minutes');
    await shot(p, '10-settings-idle', {ready: p.locator('#ra-confirm')});
    await p.locator('#ra-password').fill(NEW_PASSWORD);
    await p.locator('#ra-confirm').click();
    await expect(p.locator('#ra-notice-line')).toHaveText('Confirmed. The change is saved — you can close this tab.', {timeout: 60_000});
    await shot(p, '10-settings-applied');
    await reauth(60);
    await h.sw.evaluate(() => chrome.storage.session.remove('v1_reauth'));
    await p.locator('#ra-password').fill(NEW_PASSWORD);
    await p.locator('#ra-confirm').click();
    await expect(p.locator('#ra-notice-line')).toHaveText('Took too long — try again', {timeout: 60_000});
    await expect(p.locator('#ra-notice-help')).toHaveText('Nothing was changed. Choose the setting again in Security center.');
    await shot(p, '10-settings-expired');
    await reauth(60);
    const locker = await h.ctx.newPage();
    await locker.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    await msg(locker, {type: 'vault.lock'});
    await locker.close();
    await p.locator('#ra-password').fill(NEW_PASSWORD);
    await p.locator('#ra-confirm').click();
    await expect(p.locator('#ra-notice-line')).toHaveText('The wallet locked while you were confirming. Nothing was changed. Unlock it and choose the setting again.', {timeout: 60_000});
    await shot(p, '10-settings-not-unlocked', {ready: p.locator('#ra-unlock')});
    // The common `not-unlocked` in a new mode (ACCOUNTS (2a) + [Unlock]), while the wallet is still locked.
    await go('mode=accounts&op=add');
    await expect(p.locator('#acc-title')).toHaveText('Add an account');
    await p.locator('#acc-password').fill(NEW_PASSWORD);
    await p.locator('#acc-act').click();
    await expect(p.locator('#acc-helper')).toHaveText('The wallet is locked. Unlock it first, then try again.', {timeout: 60_000});
    await shot(p, 'accounts-not-unlocked', {ready: p.locator('#acc-unlock')});
    await unlockWith(p, h.id, NEW_PASSWORD);

    // Reveal: the proof, checking, the modal, blurred, revealed, still looking; the check; verify; not recorded.
    await go('mode=reveal');
    await expect(p.locator('#pp-title')).toHaveText('Show your recovery phrase');
    await shot(p, 'reveal-proof', {ready: p.locator('#pp-continue')});
    await holdKdf(p);
    await p.locator('#pp-password').fill(NEW_PASSWORD);
    await p.locator('#pp-continue').click();
    await expect(p.locator('#pp-helper')).toHaveText('Checking…');
    await shot(p, 'reveal-checking');
    await releaseKdf(p);
    await expect(p.locator('#sg-body')).toHaveText('Move to a private place. Anyone who sees these 12 words can spend everything in this wallet, forever.', {timeout: 60_000});
    await shot(p, '03r-pre-reveal-modal', {ready: p.locator('#sg-continue')});
    await p.locator('#sg-continue').click();
    await expect(p.locator('#seed-overlay-title')).toHaveText('Press and hold to reveal');
    await expect(p.locator('#seed-lede')).toHaveText('12 words. Write them down on paper, in order. This is the only backup.');
    await shot(p, '03r-blurred', {ready: p.locator('#seed-back')});
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#seed-grid').hover();
    await p.mouse.down();
    await p.clock.runFor(2_030 + 7_000);
    await expect(p.locator('#seed-chip')).toHaveText('13 s· auto-blur');
    expect(await p.locator('#seed-grid .term').allTextContents()).toEqual(E2E_MNEMONIC.split(' '));
    await shot(p, '03r-revealed-13s', {fullPage: false});
    await p.clock.runFor(13_000);
    await expect(p.locator('#seed-overlay-title')).toHaveText('Still looking?');
    await shot(p, '03r-still-looking', {fullPage: false});
    await p.mouse.up();
    await p.mouse.down();
    await p.clock.runFor(2_030);
    await p.mouse.up();
    await expect(p.locator('#seed-stamp')).toHaveText('Acknowledged');
    await shot(p, '03r-confirmed', {ready: p.locator('#seed-cta')});
    await p.clock.resume();
    await p.locator('#seed-cta').click();
    await expect(p.locator('#cnf-eyebrow')).toHaveText('Recovery phrase');
    await shot(p, '04r-empty', {ready: p.locator('#cnf-back')});
    await confirmWords(p, E2E_MNEMONIC.split(' '));
    await p.locator('#cnf-cta').click();
    await expect(p.locator('#cnf-success-title')).toHaveText('Recovery phrase verified');
    await shot(p, '04r-verified', {ready: p.locator('#cnf-cta')});
    await go('mode=verify');
    await expect(p.locator('#pp-title')).toHaveText('Verify your recovery phrase');
    await shot(p, 'verify-proof', {ready: p.locator('#pp-continue')});
    await p.locator('#pp-password').fill(NEW_PASSWORD);
    await p.locator('#pp-continue').click();
    await expect(p.locator('#cnf-slots .slot')).toHaveCount(3, {timeout: 60_000});
    // The wallet locked meanwhile (another page): the background refuses the fact — O32.
    const other = await h.ctx.newPage();
    await other.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    await msg(other, {type: 'vault.lock'});
    await confirmWords(p, E2E_MNEMONIC.split(' '));
    await p.locator('#cnf-cta').click();
    await expect(p.locator('#cnf-success-body')).toHaveText('All three words matched, but this could not be saved. Try again later.');
    await shot(p, 'verify-not-recorded', {ready: p.locator('#cnf-cta')});
    await other.close();

    // #37's proof: idle (with the passkey button), deleting held, changed, send-open; then damaged and no wallet.
    await unlockWith(p, h.id, NEW_PASSWORD);
    await go('mode=delete');
    await expect(p.locator('#dl-passkey')).toBeVisible();
    await expect(p.locator('#dl-x')).toBeVisible();
    await shot(p, 'delete-idle', {ready: p.locator('#dl-x')});
    await p.locator('#dl-password').fill('not the password at all');
    await p.locator('#dl-delete').click();
    await expect(p.locator('#dl-helper')).toHaveText('That did not confirm it.', {timeout: 60_000});
    await shot(p, 'delete-wrong', {ready: p.locator('#dl-delete')});
    await msg(p, {type: 'accounts.rename', index: 0, name: 'Renamed'});
    // A rename moves no revision; a passkey removal does: the wallet under the tab changed.
    await go('mode=passkey&op=remove');
    await p.locator('#pm-password').fill(NEW_PASSWORD);
    await p.locator('#pm-act').click();
    await expect(p.locator('#pm-line')).toHaveText('Passkey removed.', {timeout: 60_000});
    await go('mode=delete');
    await expect(p.locator('#dl-address .addr-groups')).toBeVisible();
    await set(h.sw, {v1_vault: await makeEnvelope({accounts: 1})});
    await p.locator('#dl-password').fill(NEW_PASSWORD);
    await p.locator('#dl-delete').click();
    await expect(p.locator('#dl-helper')).toHaveText('The wallet in this browser changed. Check the address and try again.');
    await shot(p, 'delete-changed', {ready: p.locator('#dl-delete')});
    await set(h.sw, openPending(E2E_ACCOUNTS[0]));
    await holdKdf(p);
    await p.locator('#dl-password').fill(E2E_PASSWORD);
    await p.locator('#dl-delete').click();
    await expect(p.locator('#dl-helper')).toHaveText('Deleting…');
    await shot(p, 'delete-deleting');
    await releaseKdf(p);
    await expect(p.locator('#dl-notice-line')).toHaveText('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.', {timeout: 60_000});
    await shot(p, 'delete-send-open', {ready: p.locator('#dl-unlock')});
    await set(h.sw, {v1_vault: null});
    await go('mode=delete');
    await expect(p.locator('#dl-notice-line')).toHaveText("This wallet's stored data is damaged.");
    await shot(p, 'delete-damaged');
    await h.sw.evaluate(() => chrome.storage.local.remove('v1_vault'));
    await go('mode=delete');
    await expect(p.locator('#dl-notice-line')).toHaveText('No wallet on this browser yet.');
    await shot(p, 'delete-no-wallet', {ready: p.locator('#dl-setup')});
    await h.sw.evaluate(() => chrome.storage.local.remove('v1_pending'));
    // The popup's #11 reads the network, so contained() sees the route at work.
    await set(h.sw, {v1_vault: await makeEnvelope({accounts: 1})});
    await unlockWith(p, h.id, E2E_PASSWORD);
    const q = await h.openPopup();
    await expect(q.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await q.close();
    contained(h);
  } finally {
    await h.close();
  }
});
