import type {PresaleRoute, PresaleSlots} from '../app/router';

/**
 * B1d §1.1: what `src/app/presale/index.ts` resolves to in the build without presale (scripts/presaleSwitch.mjs): no
 * presale route and no slot — no #11 banner, no Buy, no #31 row, no record words (a purchase is shown generically, Q42),
 * no resume of a prepared purchase.
 */
export const presaleRoutes: readonly PresaleRoute[] = [];
export const presaleSlots: PresaleSlots | null = null;
