import type {PresaleHost} from '../background/presaleHost';

/**
 * B1d §1.1: what `src/background/presale/api.ts` resolves to in the build without presale (scripts/presaleSwitch.mjs):
 * no message type — every `presale.*` message is refused as an unknown type — and nothing registered.
 */
export const PRESALE_MESSAGE_TYPES: readonly string[] = [];

export function registerPresale(host: PresaleHost): void {}
