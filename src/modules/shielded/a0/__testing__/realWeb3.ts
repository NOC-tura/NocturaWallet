/**
 * TEST-ONLY: the REAL @solana/web3.js for a Jest suite (never imported by app code).
 *
 * The app's jest.config maps `@solana/web3.js` to `__mocks__/@solana/web3.js.ts`, whose
 * `PublicKey(string)` is 32 zero bytes and whose `findProgramAddressSync` hashes nothing — a PDA
 * or byte-level golden test under it is green and empty (presaleBuyModule.test.ts records the
 * time that hid a bug). `jest.requireActual` of the package's CJS build does not help either: the
 * same config maps `@noble/hashes/*` and `@noble/curves/*` to the root v2 copies, while web3.js
 * needs its nested v1 copies (`@noble/hashes/sha256` does not exist in v2).
 *
 * So a suite that needs the real library evaluates the package's own self-contained browser
 * bundle `lib/index.iife.js` (the same release, every dependency inlined), in the test's realm:
 *
 *   jest.mock('@solana/web3.js', () =>
 *     jest.requireActual<typeof import('../__testing__/realWeb3')>('../__testing__/realWeb3').loadRealWeb3(),
 *   );
 *
 * The mock then IS the real library for that file, for the test and the module under test alike.
 * This directory is not `__tests__`, so Jest does not run this file as a suite.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import type * as Web3 from '@solana/web3.js';

const BUNDLE = join(__dirname, '../../../../../node_modules/@solana/web3.js/lib/index.iife.js');

export function loadRealWeb3(): typeof Web3 {
  const src = readFileSync(BUNDLE, 'utf8');
  // The bundle is `var solanaWeb3 = (function (exports) {…})({});` — evaluated in a function
  // scope so it defines no global, and in this realm so its Uint8Array is the test's.
  // eslint-disable-next-line no-new-func
  const web3 = new Function(`${src}\nreturn solanaWeb3;`)() as typeof Web3;
  if (typeof web3.PublicKey?.findProgramAddressSync !== 'function') {
    throw new Error(`realWeb3: ${BUNDLE} did not evaluate to @solana/web3.js`);
  }
  return web3;
}
