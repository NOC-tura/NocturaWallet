import {expect, chromium, type BrowserContext, type Route} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// The package is an ES module ("type": "module"), where __dirname does not exist.
export const EXT = fileURLToPath(new URL('../dist/chrome', import.meta.url));

/**
 * The safety net under any ctx.route: every noc-tura.io name fails to resolve inside this
 * browser, so a request nothing catches fails locally instead of reaching the real host (a
 * CrowdSec bouncer bans IPs on 403s). solscan.io too (B1b-2a §6.5): #27's Explorer link is a link
 * only, and no test may reach it. Every E2E launches through launchContained.
 */
export const RESOLVER_MAP = 'MAP *.noc-tura.io ~NOTFOUND, MAP noc-tura.io ~NOTFOUND, MAP *.solscan.io ~NOTFOUND, MAP solscan.io ~NOTFOUND';
export const HOST_RESOLVER_RULES = `--host-resolver-rules=${RESOLVER_MAP}`;
/** Any request to solscan.io, whatever the page: routed here, recorded and aborted. */
export const SOLSCAN = /^https?:\/\/([^/]*\.)?solscan\.io(\/|$)/;

/**
 * The explorer link's host, routed and counted: any request to solscan.io is aborted and recorded.
 * Every spec asserts the count is 0 — the link's href is checked, never followed.
 */
export async function containSolscan(ctx: BrowserContext): Promise<{hits: string[]}> {
  const hits: string[] = [];
  const abort = (route: Route) => {
    hits.push(route.request().url());
    return route.abort();
  };
  await ctx.route(SOLSCAN, abort);
  return {hits};
}

/** Any request to noc-tura.io or a name under it, whatever the page. */
export const NOC_TURA = /^https?:\/\/([^/]*\.)?noc-tura\.io(\/|$)/;

/**
 * Every noc-tura.io name, routed and counted: recorded and aborted. Install it BEFORE the fake
 * coordinator — Playwright runs the last-registered matching route first, so the fake answers
 * api.noc-tura.io and this sees only what the fake does not (any other name). Every spec asserts it 0.
 */
export async function containNocTura(ctx: BrowserContext): Promise<{hits: string[]}> {
  const hits: string[] = [];
  const abort = (route: Route) => {
    hits.push(route.request().url());
    return route.abort();
  };
  await ctx.route(NOC_TURA, abort);
  return {hits};
}

/** Chromium with the built extension loaded and noc-tura.io and solscan.io unresolvable, in a fresh profile. */
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
    await expect(page.locator('#command_line')).toContainText(RESOLVER_MAP);
  } finally {
    await page.close();
  }
}
