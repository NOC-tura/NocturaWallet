import type {PresaleRoute} from '../app/router';

/**
 * B1d §1.1: what `src/app/presale/index.ts` resolves to in the build without presale (scripts/presaleSwitch.mjs): no
 * presale route and no slot — no #11 banner, no Buy, no #31 row.
 */
export const presaleRoutes: readonly PresaleRoute[] = [];
export const presaleSlots: null = null;
