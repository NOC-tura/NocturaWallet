import type {PresaleRoute} from '../router';
import {PRESALE_ROUTE} from './routes';

/**
 * B1d §1.1: the popup's presale entry — the one module of `src/app/presale/` that shared code imports (the router and
 * App take `presaleRoutes`). The build without presale resolves it to `src/presale-off/app.ts`. B1d-1b: #23 (Task 4);
 * the later tasks add #20's purchase variant, #50b and the slots (#11 banner and Buy, the #31 row, the resume hook,
 * the kind renderers).
 */
export const presaleRoutes: readonly PresaleRoute[] = [PRESALE_ROUTE];
export const presaleSlots: null = null;
