import {describe, expectTypeOf, it} from 'vitest';
import type {Approval as BackgroundApproval, AuthorityInstruction as BackgroundAuthorityInstruction, RedFlag} from '../redFlags';
import type {Approval as WindowApproval, AuthorityInstruction as WindowAuthorityInstruction, Flag} from '../../../approve/client';

/**
 * Fix round 1 (Task 4 ⚠️, type parity): the background (`redFlags.ts`) and the window (`approve/client.ts`) declare
 * `RedFlag`/`Flag`, `Approval` and `AuthorityInstruction` independently — nothing imports one side's types from the
 * other, so nothing stopped them drifting apart at compile time even after Task 5 narrowed each side's own fields to
 * match (by the producer's own proof: `tokenForMint` never returns 'SOL'; `isToken` is the only producer of
 * `AuthorityInstruction.program`). This file is pure type-level assertion — no runtime behaviour, no import outside
 * `import type`, and it proves nothing beyond "these two independently-declared types are structurally identical".
 * `expectTypeOf(...).toEqualTypeOf<...>()` fails to compile (not merely to run) when the two sides disagree, so a
 * future change to either file that reintroduces drift fails `tsc --noEmit` here, not silently at runtime.
 */
describe('background ↔ window type parity (fix round 1, Task 4 ⚠️)', () => {
  it('F5\'s word: the background\'s RedFlag and the window\'s Flag agree', () => {
    type BackgroundWord = Extract<RedFlag, {kind: 'unlimited-approve'}>['word'];
    type WindowWord = Extract<Flag, {kind: 'unlimited-approve'}>['word'];
    expectTypeOf<BackgroundWord>().toEqualTypeOf<WindowWord>();
  });

  it('AuthorityInstruction.program: the background and the window agree', () => {
    expectTypeOf<BackgroundAuthorityInstruction['program']>().toEqualTypeOf<WindowAuthorityInstruction['program']>();
  });

  it('Approval.symbol: the background and the window agree', () => {
    expectTypeOf<BackgroundApproval['symbol']>().toEqualTypeOf<WindowApproval['symbol']>();
  });
});
