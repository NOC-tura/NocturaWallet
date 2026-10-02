import {expect, type Page} from '@playwright/test';

/**
 * Drives the real vault page (unlock.html) through its screens, as a person would: clicks, a real
 * 2 s press-and-hold on #3, typed passwords. Every step waits on what the page shows — Playwright's
 * click and fill wait for an enabled control, so the page's 500 ms rule-6 floor is waited out, never slept.
 */

/**
 * The create run (#2 → #3 → #4 → #5 → #6 skip), handed over to #7 (wallet.html#/created). Returns the 24
 * words #3 showed. `fromWelcome`: the page is on #1 already (?mode=welcome), so the run starts at its Create.
 */
export async function createWallet(vault: Page, id: string, password: string, o: {fromWelcome?: boolean} = {}): Promise<string[]> {
  if (o.fromWelcome === true) await vault.locator('#wel-create').click();
  else await vault.goto(`chrome-extension://${id}/unlock.html?mode=create`);
  await vault.locator('#int-continue').click();
  await vault.locator('#sg-continue').click();
  const words = await holdToReveal(vault);
  expect(words).toHaveLength(24);
  await expect(vault.locator('#seed-stamp')).toBeVisible();
  // Released: the cells hold the stand-in again, never the words.
  expect(await vault.locator('#seed-grid .term').allTextContents()).not.toContain(words[0]);
  await vault.locator('#seed-cta').click();
  await confirmWords(vault, words);
  await vault.locator('#cnf-cta').click();
  await expect(vault.getByText('Phrase verified')).toBeVisible();
  await vault.locator('#cnf-cta').click();
  await setPassword(vault, password);
  await expect(vault.locator('#v-passkey')).toBeVisible({timeout: 60_000});
  await vault.locator('#pk-skip').click();
  await vault.waitForURL(/\/wallet\.html#\/created$/);
  return words;
}

/** #3: a real press-and-hold, past the 2 s hold; returns the 24 words read while they are revealed. */
export async function holdToReveal(vault: Page): Promise<string[]> {
  await vault.locator('#seed-grid').hover();
  await vault.mouse.down();
  await expect(vault.locator('#seed-chip')).toBeVisible({timeout: 5_000});
  const words = await vault.locator('#seed-grid .term').allTextContents();
  await vault.mouse.up();
  return words;
}

/**
 * #4: picks each slot's word from the pool — by its index among the pool's buttons, the first unused one
 * with that word (a phrase may repeat a word, so a pool may too; a by-name locator would be ambiguous).
 */
export async function confirmWords(vault: Page, words: readonly string[]): Promise<void> {
  const pool = vault.locator('#cnf-pool button');
  for (const label of await vault.locator('#cnf-slots .label').allTextContents()) {
    const word = words[Number(/#(\d+)/.exec(label)?.[1]) - 1];
    const buttons = await pool.evaluateAll(bs => bs.map(b => ({text: b.textContent ?? '', used: b.classList.contains('used')})));
    const at = buttons.findIndex(b => b.text === word && !b.used);
    expect(at).toBeGreaterThanOrEqual(0);
    await pool.nth(at).click();
  }
}

/** #5: enter, then confirm. */
export async function setPassword(vault: Page, password: string): Promise<void> {
  await vault.locator('#pw-field').fill(password);
  await vault.locator('#pw-cta').click();
  await expect(vault.locator('#pw-title')).toHaveText('Confirm your password');
  await vault.locator('#pw-field').fill(password);
  await vault.locator('#pw-cta').click();
}

/** #9: unlocks with the password and waits for "Unlocked." (no return target). */
export async function unlockWith(vault: Page, id: string, password: string): Promise<void> {
  await vault.goto(`chrome-extension://${id}/unlock.html`);
  await vault.locator('#unl-password').fill(password);
  await vault.locator('#unl-submit').click();
  await expect(vault.locator('#unl-notice-line')).toHaveText('Unlocked.', {timeout: 60_000});
}

/** #8 (a plain import): pastes the phrase, Continue, then #5. The tab ends on #40 (#/imported). */
export async function importWallet(vault: Page, id: string, phrase: string, password: string): Promise<void> {
  await vault.goto(`chrome-extension://${id}/unlock.html?mode=import`);
  await pastePhrase(vault, phrase);
  await vault.locator('#imp-continue').click();
  await expect(vault.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
  await setPassword(vault, password);
  await vault.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
}

/** A paste into #8's field: the paste event, then the text (what the browser does). */
export async function pastePhrase(vault: Page, phrase: string): Promise<void> {
  await vault.locator('#imp-phrase').dispatchEvent('paste');
  await vault.locator('#imp-phrase').fill(phrase);
}

/** Tries a password on #9 (a fresh page load, so a fresh backoff); resolves with what the helper or the notice says. */
export async function tryUnlock(vault: Page, id: string, password: string): Promise<string> {
  await vault.goto(`chrome-extension://${id}/unlock.html`);
  await vault.locator('#unl-password').fill(password);
  await vault.locator('#unl-submit').click();
  await expect(vault.locator('#unl-helper, #unl-notice-line').filter({hasText: /did not unlock|Unlocked\./})).toHaveCount(1, {timeout: 60_000});
  return (await vault.locator('#unl-notice').isVisible()) ? ((await vault.locator('#unl-notice-line').textContent()) ?? '') : ((await vault.locator('#unl-helper').textContent()) ?? '');
}

/** What recordSent logs per runtime message: its type, the forget guard, whether it carried a replacement — never a secret. */
export interface SentMessage {
  type: string;
  guard: string | null;
  replacement: boolean;
}

/**
 * Records, in the tab's sessionStorage, every runtime message the tab's pages send — across the tab's
 * same-origin navigations (the vault page hands over to wallet.html in the same tab). Install it before
 * the tab's first navigation. Only the message's type, the forget guard and whether a replacement rode
 * along are kept: a vault.setKeys carries signing keys, and they are never copied anywhere.
 */
export async function recordSent(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const g = globalThis as unknown as {chrome?: {runtime?: {sendMessage(m: unknown): Promise<unknown>}}};
    const runtime = g.chrome?.runtime;
    if (runtime === undefined) return;
    const original = runtime.sendMessage.bind(runtime);
    runtime.sendMessage = (m: unknown) => {
      const o = (typeof m === 'object' && m !== null ? m : {}) as {type?: unknown; guard?: unknown; replacement?: unknown};
      const log = JSON.parse(sessionStorage.getItem('e2e_sent') ?? '[]') as unknown[];
      log.push({type: String(o.type), guard: typeof o.guard === 'string' ? o.guard : null, replacement: o.replacement !== undefined});
      sessionStorage.setItem('e2e_sent', JSON.stringify(log));
      return original(m);
    };
  });
}

/** What recordSent logged in this tab so far. */
export async function sentFrom(page: Page): Promise<SentMessage[]> {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e_sent') ?? '[]') as SentMessage[]);
}
