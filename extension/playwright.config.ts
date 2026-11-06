import {defineConfig} from '@playwright/test';

// Every coordinator request is made by the extension's service worker; e2e/wallet.spec.ts routes
// them to a fake coordinator (e2e/fakeCoordinator.ts) through BrowserContext.route. Older Playwright
// releases routed service-worker requests only with this set. The locked 1.63 routes them without it
// (checked: the wallet E2E passes with it unset); it stays so a downgrade cannot silently lose the
// routing — and wallet.spec.ts asserts hits > 0, so a lost route fails the run either way.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

// A one-off failure keeps its trace (test-results/), so it can be diagnosed after the fact.
// B1e §6.4: e2e/storeScreenshots.spec.ts makes the store screenshots — release material, not a regression check — and
// runs only through `npm run screenshots` (playwright.screenshots.config.ts), never in `npm run e2e` or CI.
export const STORE_SCREENSHOTS = 'storeScreenshots.spec.ts';
export default defineConfig({testDir: 'e2e', testIgnore: STORE_SCREENSHOTS, timeout: 120_000, workers: 1, use: {trace: 'retain-on-failure'}});
