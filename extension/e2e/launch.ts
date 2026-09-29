import {expect, chromium, type BrowserContext} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// The package is an ES module ("type": "module"), where __dirname does not exist.
export const EXT = fileURLToPath(new URL('../dist/chrome', import.meta.url));

/**
 * The safety net under any ctx.route: every noc-tura.io name fails to resolve inside this
 * browser, so a request nothing catches fails locally instead of reaching the real host (a
 * CrowdSec bouncer bans IPs on 403s). Every E2E launches through launchContained.
 */
export const HOST_RESOLVER_RULES = '--host-resolver-rules=MAP *.noc-tura.io ~NOTFOUND, MAP noc-tura.io ~NOTFOUND';

/** Chromium with the built extension loaded and noc-tura.io unresolvable, in a fresh profile. */
export async function launchContained(profilePrefix: string): Promise<{ctx: BrowserContext; profile: string}> {
  const profile = mkdtempSync(join(tmpdir(), profilePrefix));
  const ctx = await chromium.launchPersistentContext(profile, {
    // The default headless browser is chrome-headless-shell, which does not load extensions
    // (the service worker never starts). channel 'chromium' is Playwright's full Chromium build
    // in new headless mode, which does.
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, HOST_RESOLVER_RULES],
  });
  return {ctx, profile};
}

/** Positive proof the resolver rule is in force: the running browser's own command line carries it. */
export async function expectContained(ctx: BrowserContext): Promise<void> {
  const page = await ctx.newPage();
  try {
    await page.goto('chrome://version');
    await expect(page.locator('#command_line')).toContainText('MAP *.noc-tura.io ~NOTFOUND, MAP noc-tura.io ~NOTFOUND');
  } finally {
    await page.close();
  }
}
