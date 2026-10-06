import type {BrowserContext, Page} from '@playwright/test';

/**
 * B1b-2b spec §8.3 (review M3), the pinned recipe: a CDP virtual authenticator on the tab, added BEFORE the first
 * create(). PRF is CTAP2-only, and the vault's userVerification: 'required' (src/vault/passkey.ts) needs both UV
 * flags. The authenticator lives as long as the page's CDP session: one per vault-page tab.
 */
export async function addPrfAuthenticator(ctx: BrowserContext, page: Page): Promise<string> {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const {authenticatorId} = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true},
  });
  // WebAuthn refuses a page without focus (NotAllowedError, "the page does not have focus"): the full E2E run left
  // another page focused once (dry run). The tab that will call create()/get() is brought to the front here.
  await page.bringToFront();
  return authenticatorId;
}

/**
 * Review M2: Chromium's WebAuthn focus check is browser-side, and every new popup or tab takes the window's focus.
 * Every action that drives create() or get() brings its tab to the front first — a stated precondition, not timing.
 */
export async function withAuthenticatorFocus(page: Page, act: () => Promise<void>): Promise<void> {
  await page.bringToFront();
  await act();
}
