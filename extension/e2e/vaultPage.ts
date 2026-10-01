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
