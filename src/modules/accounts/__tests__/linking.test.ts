/** M1d spec §4.4 (M1 spec §10 C2; plan A2): every source/recipient role pair, a foreign address, the same address. */
import {linkedParticipants, linkingWarningApplies} from '../linking';
import type {SeedAccount} from '../accountList';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const A2 = '7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const CLI = 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o';
const FOREIGN = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
const SEED: SeedAccount[] = [
  {address: MAIN, role: 'main'},
  {address: A3, role: 'fresh-exit'},
  {address: A2, role: 'fresh-exit'},
  {address: A1, role: 'fresh-pending'},
];

it.each<[string, string, string | null, boolean]>([
  ['main → exit', MAIN, A3, true],
  ['exit → main', A3, MAIN, true],
  ['exit → another exit', A3, A2, true],
  ['Review Focus 3: main → a fresh-pending reservation', MAIN, A1, true],
  ['exit → a fresh-pending reservation', A3, A1, true],
  ['main → a foreign address', MAIN, FOREIGN, false],
  ['exit → a foreign address', A3, FOREIGN, false],
  ['main → itself (truth table; only exit → itself bites on the same-address guard)', MAIN, MAIN, false],
  ['exit → itself', A3, A3, false],
  ['no recipient recognised yet', A3, null, false],
  ['a source outside the seed (never a Send source)', FOREIGN, A3, false],
])('%s → %s', (_name, source, recipient, expected) => {
  expect(linkingWarningApplies(SEED, source, recipient)).toBe(expected);
});

it('no exit in the seed: main → anything is never a warning (a wallet that never made public to a new account)', () => {
  expect(linkingWarningApplies([{address: MAIN, role: 'main'}], MAIN, FOREIGN)).toBe(false);
});

it('a cli wallet has one account (S9): never a warning', () => {
  expect(linkingWarningApplies([{address: CLI, role: 'main'}], CLI, MAIN)).toBe(false);
});

it('stated limit (spec §3.1): an unreadable registry knows only the main account — nothing can be recognised', () => {
  expect(linkingWarningApplies([{address: MAIN, role: 'main'}], MAIN, A3)).toBe(false);
});

describe('post-M1d §4 / P3: linkedParticipants — every fresh-exit account taking part, never main', () => {
  it.each<[string, string, string | null, string[]]>([
    ['main → exit: the recipient', MAIN, A3, [A3]],
    ['exit → main: the source', A3, MAIN, [A3]],
    ['exit → another exit: both', A3, A2, [A3, A2]],
    ['R3: main → a fresh-pending reservation (queued until it is promoted)', MAIN, A1, [A1]],
    ['exit → a fresh-pending reservation: both', A3, A1, [A3, A1]],
    ['main → a foreign address: none (no warning)', MAIN, FOREIGN, []],
    ['exit → a foreign address: none (no warning, nothing is linked to another own account)', A3, FOREIGN, []],
    ['exit → itself: none', A3, A3, []],
    ['no recipient: none', A3, null, []],
  ])('%s', (_n, source, recipient, expected) => {
    expect(linkedParticipants(SEED, source, recipient)).toEqual(expected);
  });

  it('agrees with the warning on every pair: non-empty exactly when linkingWarningApplies', () => {
    const all = [MAIN, A1, A2, A3, FOREIGN];
    for (const s of all) {
      for (const r of [...all, null]) {
        expect(linkedParticipants(SEED, s, r).length > 0).toBe(linkingWarningApplies(SEED, s, r));
      }
    }
  });
});
