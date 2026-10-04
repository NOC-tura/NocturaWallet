import {expect, type Page} from '@playwright/test';
import type {Harness} from './popupHarness';
import {E2E_ACCOUNTS, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {unlockWith} from './vaultPage';

// The send flow's E2E helpers (plan 3): send.spec.ts (specs 4, 5, 11) and visual-send.spec.ts. Public constants
// only; nothing here is imported from core/ (the E2E rule).
export const ACCOUNT = E2E_ACCOUNTS[0];
export const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const NOC_MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
/** Any valid token-account address (an E2E-only constant). */
const NOC_HOLDING = 'FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU';
/** A challenge id the background never issued: 32 lowercase hex. */
export const OTHER_CHALLENGE = 'ab'.repeat(16);

declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}};
};
export const msg = async (page: Page, m: unknown) => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as {ok: boolean; error?: string; data?: unknown};
export const groups = async (page: Page, scope: string): Promise<string> => (await page.locator(`${scope} .addr-groups > span`).allTextContents()).join('');
/** Lamports as #19 and #20 write SOL: every digit, at least four places. */
export function sol(lamports: number): string {
  const whole = Math.floor(lamports / 1e9);
  let frac = String(lamports % 1e9).padStart(9, '0');
  while (frac.length > 4 && frac.endsWith('0')) frac = frac.slice(0, -1);
  return `${whole}.${frac}`;
}

/**
 * The makeEnvelope wallet (a real envelope, so #10 can prove the password), unlocked through the vault page, with
 * 1 000 NOC in a token account of the node's jsonParsed shape, and — when asked — RECIPIENT already known.
 */
export async function realWallet(h: Harness, o: {known?: boolean} = {}): Promise<void> {
  h.fake.tokenAccounts.set(ACCOUNT, [{pubkey: NOC_HOLDING, mint: NOC_MINT, amount: '1000000000000', decimals: 9}]);
  h.fake.accountKinds.set(RECIPIENT, 'wallet');
  await h.sw.evaluate(({env, known}) => chrome.storage.local.set({v1_vault: env, ...(known === null ? {} : {v1_known_recipients: [known]})}), {env: await makeEnvelope(), known: o.known === true ? RECIPIENT : null});
  const vault = await h.ctx.newPage();
  await unlockWith(vault, h.id, E2E_PASSWORD);
  await vault.close();
}

/** #11 → #12 (SOL from #43) → the recipient and amount → the CTA. Returns the popup on #19. */
export async function startSend(h: Harness, amount: string, o: {firstTime: boolean; clock?: boolean}): Promise<Page> {
  const popup = await h.openPopup({clock: o.clock});
  await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
  await popup.getByRole('button', {name: 'Send', exact: true}).click();
  await popup.getByRole('button', {name: 'Token: SOL'}).click();
  const sheet = popup.getByRole('dialog', {name: 'Choose a token'});
  // #43 reads the token account the fake answers in the node's jsonParsed shape: 1 000 NOC.
  await expect(sheet.locator('.app-token-row').nth(1).locator('.amt')).toHaveText('1,000.00');
  await sheet.getByText('Solana').click();
  await popup.getByLabel('Recipient', {exact: true}).fill(RECIPIENT);
  await popup.getByLabel('Amount').fill(amount);
  if (o.firstTime) {
    // Spec 11's first half: a first-time address shows design state 6, and the CTA says a proof comes.
    await expect(popup.getByText('First-time recipient')).toBeVisible();
    await expect(popup.getByText('Never sent here before')).toBeVisible();
    await expect(popup.locator('.sticky-bar button')).toHaveText(/Review & unlock to send/);
  }
  await popup.locator('.sticky-bar button').click();
  await expect(popup.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
  return popup;
}
