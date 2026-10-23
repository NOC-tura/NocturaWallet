import type {PresaleHost} from '../presaleHost';
// B1d-1a: the program-state reader (§2.1) joins the presale build here; B1d-1b's handlers call it.
import './state';

/**
 * B1d §1.1, §1.2: the background's presale entry — the one module of `presale/` that shared code imports (index.ts
 * calls `registerPresale`, messages.ts adds `PRESALE_MESSAGE_TYPES` to the privileged partition). The build without
 * presale resolves it to `src/presale-off/background.ts`. B1d-1a: registers nothing and adds no message type; B1d-1b
 * registers the `presale-buy` intent kind and the `presale.*` handlers here.
 */
export const PRESALE_MESSAGE_TYPES: readonly string[] = [];

export function registerPresale(host: PresaleHost): void {}
