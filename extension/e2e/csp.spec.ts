import {test, expect, type ConsoleMessage, type Page} from '@playwright/test';
import {contained, launchPopup, type Harness} from './popupHarness';
import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {createWallet, pastePhrase} from './vaultPage';

// Final review item 2: the vault page's boundary is the CSP (the source gates are a backstop). This walks the
// create run and opens every other vault-page mode — unlock with the cooldown ring, forgot, import, the restore
// (source=forgot) and retry (source=retry) paths, accounts, reveal, verify, password, delete, passkey (add and remove),
// reauth (a send and a settings change), welcome — and expects no CSP
// violation at all: none reported to the page (`securitypolicyviolation`), none in the console. A positive
// control in the same browser proves the watch sees one: an inline <style> and a remote <img> are both reported.
const PASSWORD = 'a long enough password';
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
/** Never resolves (RFC 6761): the control's image is refused by the CSP before any request; were it not, nothing answers. */
const REMOTE_IMG = 'https://csp-control.invalid/pixel.png';

declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>}};
};

interface Violation {
  directive: string;
  blocked: string;
  url: string;
}

/**
 * Watches one tab: every `securitypolicyviolation` its documents see is kept in the tab's sessionStorage (it
 * survives the same-origin navigations between unlock.html and wallet.html), and every console line about the
 * Content Security Policy is collected here.
 */
async function watched(h: Harness): Promise<{page: Page; console: string[]}> {
  const page = await h.ctx.newPage();
  const lines: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (/Content Security Policy|Content-Security-Policy/i.test(m.text())) lines.push(m.text());
  });
  // A settled blank document before the clock goes in (visual-vault.spec.ts: installing it into a page still being created failed once).
  await page.goto('about:blank');
  await page.clock.install();
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', e => {
      const log = JSON.parse(sessionStorage.getItem('e2e_csp') ?? '[]') as unknown[];
      log.push({directive: e.effectiveDirective, blocked: e.blockedURI, url: e.documentURI});
      sessionStorage.setItem('e2e_csp', JSON.stringify(log));
    });
  });
  return {page, console: lines};
}
const violations = (p: Page): Promise<Violation[]> => p.evaluate(() => JSON.parse(sessionStorage.getItem('e2e_csp') ?? '[]') as Violation[]);

test('csp: every vault-page mode runs with zero CSP violations; an inline style and a remote image are both reported (positive control)', async () => {
  const h = await launchPopup('noctura-e2e-csp-');
  try {
    const {page: p, console: lines} = await watched(h);
    const base = `chrome-extension://${h.id}/unlock.html`;
    const seen: string[] = [];
    /** Every page this walk leaves is checked before it goes: its document's violations, then the console's. */
    const clean = async (what: string) => {
      seen.push(what);
      expect(await violations(p), what).toEqual([]);
      expect(lines, what).toEqual([]);
    };

    // welcome → the create run (#1 → #2 → #3 → #4 → #5 → #6 skip → #7).
    await p.goto(`${base}?mode=welcome`);
    await expect(p.locator('#wel-create')).toBeVisible();
    await createWallet(p, h.id, PASSWORD, {fromWelcome: true});
    await expect(p.getByText('Wallet created', {exact: false}).first()).toBeVisible();
    await clean('welcome + create run + #7');

    // The known E2E wallet in place of the new one, locked: #9 with a wrong password, the cooldown ring, then unlocked.
    await h.sw.evaluate(async e => chrome.storage.local.set({v1_vault: e}), await makeEnvelope());
    await p.evaluate(() => chrome.runtime.sendMessage({type: 'vault.lock'}));
    await p.goto(base);
    await expect(p.getByText('Enter your password to unlock.')).toBeVisible();
    await p.locator('#unl-password').fill('not the password at all');
    await p.locator('#unl-submit').click();
    await expect(p.locator('#unl-helper')).toHaveText('That did not unlock the wallet.', {timeout: 60_000});
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#unl-password').fill('not the password at all');
    await p.locator('#unl-submit').click();
    await expect(p.locator('#unl-cooldown').getByText('Wait a moment', {exact: true})).toBeVisible({timeout: 60_000});
    await expect(p.locator('#unl-cooldown-label')).toHaveText('Cooldown · 1 second remaining');
    // The ring's one inline-style write (a --vlt-… custom property, set through the CSSOM) is not a violation.
    await expect(p.locator('#unl-ring')).toHaveAttribute('style', /--vlt-ring/);
    await p.clock.runFor(1_600);
    await p.clock.resume();
    await expect(p.locator('#unl-submit')).toBeEnabled();
    await p.locator('#unl-password').fill(E2E_PASSWORD);
    await p.locator('#unl-submit').click();
    await expect(p.locator('#unl-notice-line')).toHaveText('Unlocked.', {timeout: 60_000});
    await clean('unlock + cooldown ring');

    // B1b-2b §3.6: the accounts mode, add and remove.
    await p.goto(`${base}?mode=accounts&op=add`);
    await expect(p.locator('#acc-title')).toHaveText('Add an account');
    await clean('accounts, add');
    await p.goto(`${base}?mode=accounts&op=remove&index=0`);
    await expect(p.locator('#acc-title')).toHaveText('Remove Account 1?');
    await clean('accounts, remove');
    // B1b-2b §3.4 / §3.5: the reveal and verify modes' proof.
    await p.goto(`${base}?mode=reveal`);
    await expect(p.locator('#pp-title')).toHaveText('Show your recovery phrase');
    await clean('reveal');
    await p.goto(`${base}?mode=verify`);
    await expect(p.locator('#pp-title')).toHaveText('Verify your recovery phrase');
    await clean('verify');
    // B1b-2b §3.1–§3.3: #36, #37's proof and the passkey actions.
    await p.goto(`${base}?mode=password`);
    await expect(p.locator('#cp-title')).toHaveText('Enter current password');
    await clean('password');
    await p.goto(`${base}?mode=delete`);
    await expect(p.locator('#dl-address .addr-groups')).toBeVisible();
    await clean('delete');
    await p.goto(`${base}?mode=passkey&op=add`);
    await expect(p.locator('#pm-title')).toHaveText('Unlock Noctura with a passkey');
    await clean('passkey, add');
    await p.goto(`${base}?mode=passkey&op=remove`);
    await expect(p.locator('#pm-title')).toHaveText('Remove your passkey');
    await clean('passkey, remove');

    // #10 with a live challenge: a send of 2.48 of the fake's 10 SOL to a new address.
    let challengeId: string | null = null;
    for (let i = 0; i < 3 && challengeId === null; i++) {
      const r = (await p.evaluate(m => chrome.runtime.sendMessage(m), {type: 'wallet.prepareSend', account: E2E_ACCOUNTS[0], intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}})) as {ok: boolean; data?: {reauth: {challengeId: string} | null}};
      if (r.ok && r.data?.reauth) challengeId = r.data.reauth.challengeId;
    }
    expect(challengeId).not.toBeNull();
    await p.goto(`${base}?mode=reauth&challenge=${challengeId ?? ''}`);
    await expect(p.locator('#ra-about')).toHaveText('You are about to send');
    await expect(p.locator('#ra-amount')).toHaveText('2.4800');
    await clean('reauth');
    // B1b-2b §3.7 (E9): #10's settings kind — a weakening of auto-lock answers with a challenge; its tab renders the change.
    const weaken = (await p.evaluate(m => chrome.runtime.sendMessage(m), {type: 'settings.set', patch: {autoLockMinutes: 15}})) as {ok: boolean; error?: string; data?: {challengeId?: string}};
    expect(weaken.error).toBe('reauth-required');
    await p.goto(`${base}?mode=reauth&challenge=${weaken.data?.challengeId ?? ''}`);
    await expect(p.locator('#ra-about')).toHaveText('You are about to change');
    await clean('reauth, settings');

    await p.goto(`${base}?mode=forgot`);
    await expect(p.locator('#fg-title')).toHaveText('Forgot your password?');
    for (const title of ['Enter your words', 'Set a new password']) {
      await p.locator('#fg-next').click();
      await expect(p.locator('#fg-title')).toHaveText(title);
    }
    await clean('forgot');
    await p.locator('#fg-next').click();
    await expect(p).toHaveURL(/mode=import&source=forgot$/);
    await pastePhrase(p, E2E_MNEMONIC);
    await p.locator('#imp-continue').click();
    await expect(p.locator('#pw-step')).toHaveText('Restore · 2 / 2', {timeout: 30_000});
    await clean('import, source=forgot');

    await p.goto(`${base}?mode=import&source=retry`);
    await expect(p.getByText('Confirm with the password of the wallet you are replacing')).toBeVisible();
    await clean('import, source=retry');

    await p.goto(`${base}?mode=import`);
    await expect(p.locator('#imp-phrase')).toBeVisible();
    await clean('import');

    expect(seen).toHaveLength(16);

    // The positive control, on the same page and watch: an inline <style> and a remote <img> are both refused and reported.
    await p.evaluate(src => {
      const style = document.createElement('style');
      style.textContent = 'body{outline:1px solid red}';
      document.head.append(style);
      const img = document.createElement('img');
      img.src = src;
      document.body.append(img);
    }, REMOTE_IMG);
    await expect.poll(async () => (await violations(p)).map(v => v.directive).sort(), {timeout: 10_000}).toEqual(['img-src', 'style-src-elem']);
    expect((await violations(p)).find(v => v.directive === 'img-src')?.blocked).toBe(REMOTE_IMG);
    // And the console channel sees them too: one refusal line for each.
    await expect.poll(() => lines.length, {timeout: 10_000}).toBe(2);
    expect(lines.some(l => l.includes(REMOTE_IMG))).toBe(true);
    expect(lines.some(l => /inline style/i.test(l))).toBe(true);
    contained(h);
  } finally {
    await h.close();
  }
});
