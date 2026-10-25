import type {OtherDescription} from '../unlock/challenge';

/**
 * B1d §1.1: what `src/unlock/presale.ts` resolves to in the build without presale (scripts/presaleSwitch.mjs): it
 * describes nothing — a challenge of any other kind is one #10 cannot describe (only Cancel).
 */
export function describePresale(about: Readonly<Record<string, unknown>>): OtherDescription | null {
  return null;
}
