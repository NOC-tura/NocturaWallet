import type {PresaleRoute} from '../router';

/**
 * B1d §1.1: the popup's presale entry — the one module of `src/app/presale/` that shared code imports (the router takes
 * `presaleRoutes`). The build without presale resolves it to `src/presale-off/app.ts`. B1d-1a: no route and no slot;
 * B1d-1b adds #23's routes and the slots (#11 banner and Buy, the #31 row, the resume hook, the kind renderers).
 */
export const presaleRoutes: readonly PresaleRoute[] = [];
export const presaleSlots: null = null;
