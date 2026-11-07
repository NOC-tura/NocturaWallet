import {defineConfig} from '@playwright/test';
import base, {STORE_SCREENSHOTS} from './playwright.config';

// B1e §6.4 (Minor 9): `npm run screenshots` — the five store screenshots (e2e/storeScreenshots.spec.ts) from the store
// build (dist-nopresale/chrome, built first by `npm run build`) into release/screenshots/out/ (git-ignored). The base
// config ignores that spec, so `npm run e2e` and CI never run it: it makes release material, not a regression check —
// the same screens are E2E-tested by the visual specs. The base is imported for its service-worker routing switch and
// its trace setting; only the spec it ignores is run here.
export default defineConfig({...base, testIgnore: [], testMatch: STORE_SCREENSHOTS, timeout: 600_000});
