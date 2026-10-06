import {test, expect, type Page, type Worker} from '@playwright/test';
import {MAIN, SAVINGS, contained, launchPopup, seedUnlockedWallet} from './popupHarness';
import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {confirmWords, pastePhrase, setPassword, unlockWith} from './vaultPage';
import {holdKdf, releaseKdf, shot, vaultTab} from './visualTab';

// Spec B1b-2a §8.6, plan 2: every vault-page state (#1–#6, #8–#10, #39; the accounts and reveal modes are B1b-2b's visual-settings.spec.ts)
// and the UI tab's #7 and #40, rendered by the real extension at the design's 412 px width (412 × 916,
// the mockups' size), saved for the review against index.html (#sNN). Not a pixel diff: an opus-tier
// reviewer compares each image with the same state using the plan's checklist. Every state asserts its
// own copy before its shot; a state that lasts a moment (the hold, the cooldown, the wrong-word reset,
// the mismatch clear) is shot under Playwright's paused clock, and a state that lasts as long as a
// computation (creating, adding, checking, loading) is held open by the test — never raced.
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const PASSWORD = 'a long enough password';
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';

declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; remove(k: string): Promise<void>}; session: {set(o: object): Promise<void>}};
};

const text = (p: Page, sel: string) => p.locator(sel);
const stored = (sw: Worker): Promise<string> => sw.evaluate(async () => JSON.stringify(((await (chrome.storage.local as unknown as {get(k: string): Promise<Record<string, unknown>>}).get('v1_vault')) as Record<string, unknown>).v1_vault));

test('visual: the create run — #1, #2, #3, #4, #5, #6 and #7', async () => {
  const h = await launchPopup('noctura-e2e-vis-create-');
  try {
    const p = await vaultTab(h, 'unlock.html?mode=welcome', {passkeyCreate: 'null'});
    await expect(p.getByText('A Solana wallet built for private, non-custodial holding.')).toBeVisible();
    await expect(text(p, '.trust-chip')).toHaveText(['E2E encrypted', 'Non-custodial']);
    // The terms line and both CTAs are unhidden by the page's one vault read: idle is after it (fix round 1).
    await expect(p.locator('#wel-terms')).toBeVisible();
    await expect(p.locator('#wel-terms')).toHaveText('By continuing you agree to the Terms and Privacy Policy.');
    await expect(p.locator('#wel-import')).toBeVisible();
    await shot(p, '01-welcome-idle', {ready: p.locator('#wel-create')});
    await p.locator('#wel-create').click();
    await expect(p.getByText('Three layers protect your wallet')).toBeVisible();
    await shot(p, '02-security-intro', {ready: p.locator('#int-continue')});
    await p.locator('#int-continue').click();
    await expect(p.getByText('About to show your recovery phrase')).toBeVisible();
    await shot(p, '03-pre-reveal-modal', {ready: p.locator('#sg-continue')});
    await p.locator('#sg-continue').click();
    await expect(text(p, '#seed-overlay-title')).toHaveText('Press and hold to reveal');
    await shot(p, '03-blurred', {ready: p.locator('#seed-back')});

    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#seed-grid').hover();
    await p.mouse.down();
    await p.clock.runFor(2_030 + 7_000);
    await expect(text(p, '#seed-chip')).toHaveText('13 s· auto-blur');
    await expect(text(p, '#seed-helper')).toHaveText('Holding to reveal · Auto-blurs at 20 s for safety. Screen readers announce at 10 s and 5 s only.');
    await shot(p, '03-revealed-countdown-13s', {fullPage: false});
    // The words are in the DOM only while revealed (the blurred cells hold a fixed stand-in): read them now.
    const words = await text(p, '#seed-grid .term').allTextContents();
    expect(words).toHaveLength(24);
    expect(words).not.toContain('xxxxxx');
    await p.clock.runFor(8_000);
    await expect(text(p, '#seed-chip')).toHaveText('5 s— still memorizing?');
    await shot(p, '03-revealed-countdown-5s', {fullPage: false});
    await p.clock.runFor(5_000);
    await expect(text(p, '#seed-overlay-title')).toHaveText('Still looking?');
    await shot(p, '03-re-blurred-still-looking', {fullPage: false});
    await p.mouse.up();
    await p.mouse.down();
    await p.clock.runFor(2_030);
    await p.mouse.up();
    await expect(text(p, '#seed-stamp')).toHaveText('Acknowledged');
    await expect(text(p, '#seed-lede')).toHaveText('Phrase locked in. Tap continue to verify a few words.');
    await shot(p, '03-confirmed', {ready: p.locator('#seed-cta')});
    await p.clock.resume();

    await p.locator('#seed-cta').click();
    await expect(p.getByText('Tap the correct word for each position.')).toBeVisible();
    await shot(p, '04-empty', {ready: p.locator('#cnf-back')});
    const labels = await text(p, '#cnf-slots .label').allTextContents();
    const nth = (i: number) => words[Number(/#(\d+)/.exec(labels[i] ?? '')?.[1]) - 1] ?? '';
    // By index among the pool's buttons, the first unused one with that text (a pool may repeat a word).
    const pick = async (word: string) => {
      const buttons = await p.locator('#cnf-pool button').evaluateAll(bs => bs.map(b => ({text: b.textContent ?? '', used: b.classList.contains('used')})));
      const at = buttons.findIndex(b => b.text === word && !b.used);
      expect(at).toBeGreaterThanOrEqual(0);
      await p.locator('#cnf-pool button').nth(at).click();
    };
    await pick(nth(0));
    await expect(text(p, '#cnf-slots .slot.filled')).toHaveCount(1);
    await shot(p, '04-partial-correct', {ready: p.locator('#cnf-back')});
    const unused = await p.locator('#cnf-pool button').evaluateAll(bs => bs.filter(b => !b.classList.contains('used')).map(b => b.textContent ?? ''));
    const wrong = unused.find(w => w !== nth(1)) ?? '';
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await pick(wrong);
    await expect(text(p, '#cnf-lede')).toHaveText("That's not the right word — let's start over.");
    await expect(text(p, '#cnf-helper')).toHaveText(/^Word #\d+ was wrong\. Slots will reset in a moment\.$/);
    await shot(p, '04-wrong-answer');
    await p.clock.runFor(700);
    await p.clock.resume();
    await expect(text(p, '#cnf-slots .slot.empty')).toHaveCount(3);
    await confirmWords(p, words);
    await p.locator('#cnf-cta').click();
    await expect(p.getByText('All three words matched. Now lock the wallet with a password.')).toBeVisible();
    await shot(p, '04-success', {ready: p.locator('#cnf-cta')});
    await p.locator('#cnf-cta').click();

    await expect(text(p, '#pw-title')).toHaveText('Create a password');
    await p.locator('#pw-field').fill('a few words');
    await expect(text(p, '#pw-meter-label')).toHaveText('11 of 12 characters');
    await shot(p, '05-enter', {ready: p.locator('#pw-back')});
    await p.locator('#pw-field').fill(PASSWORD);
    await expect(text(p, '#pw-meter-label')).toHaveText('Long enough');
    await p.locator('#pw-cta').click();
    await expect(text(p, '#pw-title')).toHaveText('Confirm your password');
    await shot(p, '05-confirm', {ready: p.locator('#pw-back')});
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#pw-field').fill(`${PASSWORD}!`);
    await p.locator('#pw-cta').click();
    await expect(text(p, '#pw-helper')).toHaveText("Passwords don't match — try again.");
    await shot(p, '05-mismatch');
    await p.clock.runFor(700);
    await p.clock.resume();
    await expect(p.locator('#pw-field')).toHaveValue('');
    await expect(p.locator('#pw-cta')).toBeDisabled();
    await holdKdf(p);
    await p.locator('#pw-field').fill(PASSWORD);
    await p.locator('#pw-cta').click();
    await expect(p.getByText('Creating your wallet…')).toBeVisible();
    // Scoped: #36's `changing` section (B1b-2b) carries the same line, hidden.
    await expect(p.locator('#pw-creating').getByText('Securing your password takes a few seconds.')).toBeVisible();
    await shot(p, '05-creating');
    await releaseKdf(p);

    await expect(p.getByText('Unlock Noctura with a passkey')).toBeVisible({timeout: 60_000});
    await shot(p, '06-passkey-idle', {ready: p.locator('#pk-add')});
    await holdKdf(p);
    await p.locator('#pk-add').click();
    await expect(text(p, '#pk-line')).toHaveText('Waiting for your passkey…');
    await shot(p, '06-adding');
    await releaseKdf(p);
    await expect(text(p, '#pk-line')).toHaveText('This device cannot unlock the wallet with a passkey; your password still works.', {timeout: 60_000});
    await shot(p, '06-unsupported', {ready: p.locator('#pk-continue')});
    await p.locator('#pk-continue').click();

    await p.waitForURL(/wallet\.html#\/created$/);
    await expect(p.getByText('Wallet created')).toBeVisible();
    await expect(p.getByText('Wallet is ready — open the Noctura icon')).toBeVisible();
    await shot(p, '07-created');
    // #7 reads nothing from the network; the popup's #11 does, so contained() sees the route at work.
    const popup = await h.openPopup();
    await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible();
    await popup.close();
    await p.evaluate(() => chrome.runtime.sendMessage({type: 'vault.lock'}));
    await p.reload();
    await expect(p.getByText('Wallet created. Unlock it to use it.')).toBeVisible();
    await shot(p, '07-created-locked');

    // #1 again, now that a wallet exists.
    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
    await expect(p.getByText('A wallet already exists in this browser. Nothing was changed.')).toBeVisible();
    await shot(p, '01-welcome-exists');
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: import — #8’s states, #5 import, and #40', async () => {
  const h = await launchPopup('noctura-e2e-vis-import-');
  try {
    const p = await vaultTab(h, 'unlock.html?mode=import');
    await expect(p.getByText('Bring an existing wallet onto this device.')).toBeVisible();
    await shot(p, '08-phrase-idle');
    // The clock paused BEFORE typing: the idle timer counts from this keystroke, exactly.
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#imp-phrase').fill('legend frost marble river coral anchor valid echo raven');
    await expect(text(p, '#imp-count')).toHaveText('9 of 12 words entered.');
    await shot(p, '08-typing');
    await p.clock.runFor(48_000);
    await expect(text(p, '#imp-idle-title')).toHaveText('Auto-clearing in 12 s');
    await expect(p.locator('#imp-keep')).toBeVisible();
    await shot(p, '08-idle-timer-active');
    await p.locator('#imp-keep').click();
    await p.clock.resume();
    await p.locator('#imp-phrase').fill('');
    await pastePhrase(p, E2E_MNEMONIC);
    await expect(p.getByText('Pasted from clipboard. Noctura cannot clear your clipboard — clear it yourself.')).toBeVisible();
    await expect(p.getByText('Valid 12-word BIP-39 phrase · checksum OK')).toBeVisible();
    await shot(p, '08-paste-detected');

    // The probe unanswered: "Checking…" held open, then the scheme choice (balances could not be checked).
    const release = h.fake.hold();
    h.fake.network = 'unreachable';
    await p.locator('#imp-continue').click();
    await expect(text(p, '#imp-line')).toHaveText('Checking which addresses hold funds…');
    await shot(p, '08-checking');
    release();
    await expect(text(p, '#imp-choose-why')).toHaveText('Balances could not be checked. Choose the address type to use.');
    // A viewport shot scrolled to the two choices: a full-page capture keeps the sticky bar where the
    // viewport ended, over the second choice (it scrolls clear in the page).
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    // Checklist 6: scrolled to its end, the sticky bar covers neither choice.
    const cliBottom = await p.locator('#imp-choose-cli').evaluate(e => e.getBoundingClientRect().bottom);
    const barTop = await p.locator('#v-import .sticky-bar').evaluate(e => e.getBoundingClientRect().top);
    expect(cliBottom).toBeLessThanOrEqual(barTop);
    await shot(p, '08-choose-scheme', {fullPage: false, ready: p.locator('#imp-choose-cli')});
    h.fake.network = 'ok';
    await p.locator('#imp-choose-slip10').click();
    await expect(text(p, '#pw-step')).toHaveText('Import · 2 / 2');
    await shot(p, '05-import-enter', {ready: p.locator('#pw-back')});
    await setPassword(p, PASSWORD);
    await p.waitForURL(/wallet\.html#\/imported$/, {timeout: 60_000});
    await expect(p.getByText('1 account · 1 token recovered. Welcome back.')).toBeVisible();
    await expect(p.getByText('Copying puts the address on your clipboard. Noctura does not clear it afterwards.')).toBeVisible();
    await shot(p, '40-single-account');

    const hold = h.fake.hold();
    await p.reload();
    await expect(p.getByText('Checking what this wallet holds…')).toBeVisible();
    await shot(p, '40-loading');
    hold();
    await expect(p.getByText('Wallet imported', {exact: true})).toBeVisible();

    h.fake.defaultLamports = 0;
    await p.reload();
    await expect(p.getByText('Wallet imported · empty')).toBeVisible();
    await expect(p.getByRole('button', {name: 'Try a different seed'})).toBeInViewport();
    await shot(p, '40-no-assets-empty');
    // The tab scrolls inside its content region, which a full-page capture does not follow: the rest of
    // the screen, scrolled to its end, under the sticky bar.
    await p.locator('main.app-content').evaluate(e => e.scrollTo(0, e.scrollHeight));
    await expect(p.getByText('You can send SOL to this address to fund the wallet.')).toBeInViewport();
    await shot(p, '40-no-assets-empty-end');
    h.fake.network = 'unreachable';
    await p.reload();
    await expect(p.getByText('Balances could not be read right now.')).toBeVisible();
    await shot(p, '40-unreachable');
    h.fake.network = 'ok';
    await p.evaluate(() => chrome.runtime.sendMessage({type: 'vault.lock'}));
    await p.reload();
    await expect(p.getByText('Wallet imported. Unlock it to see what was recovered.')).toBeVisible();
    await shot(p, '40-locked');
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: #40 with two accounts, and the D26 state', async () => {
  const h = await launchPopup('noctura-e2e-vis-40-');
  try {
    await seedUnlockedWallet(h.sw, [MAIN, SAVINGS]);
    const p = await vaultTab(h, 'wallet.html#/imported');
    await expect(p.getByText('2 accounts · 1 token recovered.')).toBeVisible();
    await expect(text(p, '.s8-token-row .sec')).toHaveText(['Solana · 2 accounts']);
    await shot(p, '40-multi-account');
    h.fake.network = 'forbidden';
    const q = await vaultTab(h, 'wallet.html#/imported');
    await expect(q.getByText('The server is not answering for now — try again in 10 minutes.')).toBeVisible();
    await shot(q, '40-refused-d26');
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: #9, #39, the restore and retry steps', async () => {
  const h = await launchPopup('noctura-e2e-vis-unlock-');
  try {
    await h.sw.evaluate(async e => chrome.storage.local.set({v1_vault: e}), await makeEnvelope());
    const p = await vaultTab(h, 'unlock.html');
    await expect(p.getByText('Enter your password to unlock.')).toBeVisible();
    await shot(p, '09-idle');
    await p.locator('#unl-password').fill('not the password at all');
    await p.locator('#unl-submit').click();
    await expect(text(p, '#unl-helper')).toHaveText('That did not unlock the wallet.', {timeout: 60_000});
    await shot(p, '09-error', {ready: p.locator('#unl-submit')});
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#unl-password').fill('not the password at all');
    await p.locator('#unl-submit').click();
    await expect(p.locator('#unl-cooldown').getByText('Wait a moment', {exact: true})).toBeVisible({timeout: 60_000});
    await expect(text(p, '#unl-timer')).toHaveText('0:01');
    await expect(text(p, '#unl-cooldown-label')).toHaveText('Cooldown · 1 second remaining');
    await expect(p.locator('#unl-paused')).toHaveText('Unlock paused');
    await expect(p.locator('#unl-paused')).toBeDisabled();
    await shot(p, '09-cooldown');
    await p.clock.runFor(1_600);
    // The next wrong password waits 2 s: one second in, the ring has half of its arc left (fix round 1).
    await expect(p.locator('#unl-submit')).toBeEnabled();
    await p.locator('#unl-password').fill('not the password at all');
    await p.locator('#unl-submit').click();
    await expect(text(p, '#unl-timer')).toHaveText('0:02', {timeout: 60_000});
    await p.clock.runFor(1_000);
    await expect(text(p, '#unl-timer')).toHaveText('0:01');
    await expect(text(p, '#unl-cooldown-label')).toHaveText('Cooldown · 1 second remaining');
    await expect(p.locator('#unl-paused')).toHaveText('Unlock paused');
    await expect(p.locator('#unl-ring')).toHaveAttribute('style', /--vlt-ring:\s*0\.5/);
    await shot(p, '09-cooldown-mid');
    await p.clock.runFor(1_600);
    await p.clock.resume();
    await expect(p.locator('#unl-submit')).toBeEnabled();
    await p.locator('#unl-password').fill(E2E_PASSWORD);
    await p.locator('#unl-submit').click();
    await expect(text(p, '#unl-notice')).toHaveText('Unlocked. Open the Noctura icon to continue.', {timeout: 60_000});
    await shot(p, '09-unlocked', {ready: p.locator('#unl-close')});
    // The popup reads the fake once, so contained() sees the route at work.
    const popup = await h.openPopup();
    await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible();
    await popup.close();

    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=forgot`);
    for (const [n, title] of [[1, 'Forgot your password?'], [2, 'Enter your words'], [3, 'Set a new password']] as const) {
      await expect(text(p, '#fg-title')).toHaveText(title);
      await expect(text(p, '#fg-step')).toHaveText(`${n} / 3`);
      await shot(p, `39-step-${n}-card`, {ready: p.locator('#fg-next')});
      if (n < 3) {
        // The rest of the step, scrolled to its end under the sticky bar (fix round 1).
        await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const last = p.locator('#v-forgot .scroll-area > :not([hidden])').last();
        await expect(last).toBeInViewport();
        // Checklist 6: at the end the sticky bar covers none of it.
        const lastBottom = await last.evaluate(e => e.getBoundingClientRect().bottom);
        const barTop = await p.locator('#v-forgot .sticky-bar').evaluate(e => e.getBoundingClientRect().top);
        expect(lastBottom).toBeLessThanOrEqual(barTop);
        await shot(p, `39-step-${n}-card-end`, {fullPage: false});
        await p.evaluate(() => window.scrollTo(0, 0));
      }
      if (n < 3) await p.locator('#fg-next').click();
    }
    await p.locator('#fg-next').click();
    await pastePhrase(p, OTHER);
    await p.locator('#imp-continue').click();
    await expect(p.getByText('This phrase does not belong to the wallet in this browser. Nothing was changed.')).toBeVisible({timeout: 30_000});
    await shot(p, '08-restore-not-this-wallet', {ready: p.getByRole('button', {name: 'Try another phrase'})});
    await p.getByRole('button', {name: 'Try another phrase'}).click();
    await pastePhrase(p, E2E_MNEMONIC);
    await p.locator('#imp-continue').click();
    await expect(text(p, '#pw-step')).toHaveText('Restore · 2 / 2', {timeout: 30_000});
    await shot(p, '05-restore-enter', {ready: p.locator('#pw-back')});

    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=import&source=retry`);
    await expect(p.getByText('Confirm with the password of the wallet you are replacing')).toBeVisible();
    await shot(p, '08-retry-password');

    await h.sw.evaluate(() => chrome.storage.local.set({v1_vault: null}));
    await p.goto(`chrome-extension://${h.id}/unlock.html`);
    await expect(text(p, '#unl-notice-line')).toHaveText("This wallet's stored data is damaged.");
    await shot(p, '09-damaged');
    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
    await expect(text(p, '#wel-notice-line')).toHaveText("This wallet's stored data is damaged.");
    await shot(p, '01-welcome-damaged');
    await h.sw.evaluate(() => chrome.storage.local.remove('v1_vault'));
    await p.goto(`chrome-extension://${h.id}/unlock.html`);
    await expect(text(p, '#unl-notice-line')).toHaveText('No wallet on this browser yet.');
    await shot(p, '09-no-wallet');
    expect(await stored(h.sw)).toBeUndefined();
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: #10 — the action from the background, and each of its states', async () => {
  const h = await launchPopup('noctura-e2e-vis-reauth-');
  try {
    await h.sw.evaluate(async e => chrome.storage.local.set({v1_vault: e}), await makeEnvelope());
    const ui = await h.ctx.newPage();
    await unlockWith(ui, h.id, E2E_PASSWORD);
    await ui.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    const challenge = async (): Promise<string> => {
      for (let i = 0; i < 3; i++) {
        const r = (await ui.evaluate(m => chrome.runtime.sendMessage(m), {type: 'wallet.prepareSend', account: E2E_ACCOUNTS[0], intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}})) as {ok: boolean; data?: {reauth: {challengeId: string} | null}};
        if (r.ok && r.data?.reauth) return r.data.reauth.challengeId;
      }
      throw new Error('no challenge');
    };
    const id = await challenge();
    const p = await vaultTab(h, `unlock.html?mode=reauth&challenge=${id}`);
    await expect(text(p, '#ra-about')).toHaveText('You are about to send');
    await expect(text(p, '#ra-amount')).toHaveText('2.4800');
    // 2.48 of 10 SOL to a new address at $150: the engine's three reasons, one fixed line each.
    await expect(text(p, '#ra-reasons p')).toHaveText([
      'Re-auth required for the first send to a new address.',
      'Re-auth required for transactions over 5 % of balance.',
      'Re-auth required for transactions over $100.',
    ]);
    await shot(p, '10-idle');
    await p.locator('#ra-password').fill('not the password at all');
    await p.locator('#ra-confirm').click();
    await expect(text(p, '#ra-helper')).toHaveText('That did not confirm it.', {timeout: 60_000});
    await shot(p, '10-error', {ready: p.locator('#ra-confirm')});
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#ra-password').fill('not the password at all');
    await p.locator('#ra-confirm').click();
    await expect(p.locator('#ra-cooldown').getByText('Wait a moment', {exact: true})).toBeVisible({timeout: 60_000});
    await expect(text(p, '#ra-timer')).toHaveText('0:01');
    await expect(text(p, '#ra-cooldown-label')).toHaveText('Cooldown · 1 second remaining');
    await expect(p.locator('#ra-paused')).toHaveText('Confirm paused');
    await expect(p.locator('#ra-paused')).toBeDisabled();
    await shot(p, '10-cooldown');
    await p.clock.runFor(1_600);
    // The next wrong password waits 2 s: one second in, half of the arc is left (fix round 1).
    await expect(p.locator('#ra-confirm')).toBeEnabled();
    await p.locator('#ra-password').fill('not the password at all');
    await p.locator('#ra-confirm').click();
    await expect(text(p, '#ra-timer')).toHaveText('0:02', {timeout: 60_000});
    await p.clock.runFor(1_000);
    await expect(text(p, '#ra-timer')).toHaveText('0:01');
    await expect(text(p, '#ra-cooldown-label')).toHaveText('Cooldown · 1 second remaining');
    await expect(p.locator('#ra-paused')).toHaveText('Confirm paused');
    await expect(p.locator('#ra-ring')).toHaveAttribute('style', /--vlt-ring:\s*0\.5/);
    await shot(p, '10-cooldown-mid');
    await p.clock.runFor(1_600);
    await p.clock.resume();

    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=reauth&challenge=${'ab'.repeat(16)}`);
    await expect(text(p, '#ra-notice-line')).toHaveText('This confirmation has expired. Start the send again from the Noctura icon.');
    await shot(p, '10-expired');
    const bad = 'cd'.repeat(16);
    await h.sw.evaluate(
      async ({b, about}) => chrome.storage.session.set({v1_reauth: {[b]: {digest: 'd', issuedAt: Date.now(), expiresAt: Date.now() + 120_000, satisfied: false, about}}}),
      {b: bad, about: {kind: 'send', account: E2E_ACCOUNTS[0], token: 'SOL', recipient: RECIPIENT, amount: '1', networkLamports: '5000', priorityLamports: '0', markupLamports: '0', markupReason: 'charged', rentLamports: '0', reasons: ['first-send'], thresholdCents: 10_000}},
    );
    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=reauth&challenge=${bad}`);
    await expect(text(p, '#ra-notice-line')).toHaveText('The details of this action could not be shown.');
    await expect(p.locator('#ra-confirm')).toBeHidden();
    // Its account is an address by itself, so Cancel can discard the send (plan-2 review H1). The
    // [Close] variant needs a stored record whose account is not an address, which the background
    // never keeps (it drops the record): asserted in the DOM test only.
    await expect(text(p, '#ra-cancel')).toHaveText('Cancel send');
    await shot(p, '10-undescribable');

    const live = await challenge();
    await p.addInitScript(() => Object.defineProperty(window, 'close', {value: () => undefined}));
    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=reauth&challenge=${live}`);
    await expect(text(p, '#ra-about')).toHaveText('You are about to send');
    await p.locator('#ra-cancel').click();
    await expect(text(p, '#ra-notice-line')).toHaveText('Send cancelled. Nothing was sent.');
    await shot(p, '10-cancelled');

    await ui.evaluate(() => chrome.runtime.sendMessage({type: 'vault.lock'}));
    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=reauth&challenge=${live}`);
    await expect(text(p, '#ra-notice-line')).toHaveText('The wallet locked while you were confirming. Unlock it and start the send again.');
    await shot(p, '10-not-unlocked', {ready: p.locator('#ra-unlock')});
    contained(h);
  } finally {
    await h.close();
  }
});
