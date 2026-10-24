import type {PresaleRoute, PresaleSlots} from '../router';
import {GEO_ROUTE, PRESALE_CONFIRM_ROUTE, PRESALE_ROUTE} from './routes';
import {PRESALE_SLOTS} from './records';

/**
 * B1d §1.1: the popup's presale entry — the one module of `src/app/presale/` that shared code imports (the router, App
 * and the screens that show a record take `presaleRoutes` / `presaleSlots`). The build without presale resolves it to
 * `src/presale-off/app.ts`. B1d-1b: #23 (Task 4), #20's purchase variant and the slots — the record words of #21, #44
 * and #54 and the resume paths (Task 5); #50b (`geo`) and #11's banner, Buy and pending row (Task 6).
 */
export const presaleRoutes: readonly PresaleRoute[] = [PRESALE_ROUTE, PRESALE_CONFIRM_ROUTE, GEO_ROUTE];
export const presaleSlots: PresaleSlots | null = PRESALE_SLOTS;
