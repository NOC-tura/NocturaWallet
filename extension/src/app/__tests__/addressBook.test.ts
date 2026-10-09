import {AVATARS, DUST_FLOOR, avatarOf, contactsCount, initialOf, isDust, markParts, resultsLine, searchContacts, whenText} from '../addressBook';
import type {Contact} from '../engine';

// B1b-2b §6: the address book's display rules. C18's floors are base units compared as bigint (rev 3, review L2).
describe('C18: the dust floor, in base units', () => {
  it('pins the four floors: 0.001 SOL, 0.01 USDC and USDT, 1 NOC', () => {
    expect(DUST_FLOOR).toEqual({SOL: 1_000_000n, USDC: 10_000n, USDT: 10_000n, NOC: 1_000_000_000n});
  });

  it.each([
    ['SOL', 999_999n, true],
    ['SOL', 1_000_000n, false],
    ['USDC', 9_999n, true],
    ['USDC', 10_000n, false],
    ['USDT', 9_999n, true],
    ['USDT', 10_000n, false],
    ['NOC', 999_999_999n, true],
    ['NOC', 1_000_000_000n, false],
    ['SOL', 0n, true],
    ['NOC', 18_446_744_073_709_551_615n, false],
  ] as const)('%s %s → dust %s', (token, amount, dust) => {
    expect(isDust(token, amount)).toBe(dust);
  });

  it('fails closed: an amount or a token the decoder could not read is dust', () => {
    expect(isDust('SOL', null)).toBe(true);
    expect(isDust(null, 5_000_000_000n)).toBe(true);
  });
});

describe('#15 when (ix:7522: relative natural language)', () => {
  // Local wall-clock dates (the rule reads calendar days and months in local time).
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
  const NOW = at(2026, 5, 8, 9);
  it.each([
    [null, 'never'],
    [at(2026, 5, 8, 1), 'today'],
    [at(2026, 5, 9), 'today'],
    [at(2026, 5, 7, 23), 'yesterday'],
    [at(2026, 5, 5), '3 days ago'],
    [at(2026, 4, 26), '12 days ago'],
    [at(2026, 4, 9), '29 days ago'],
    [at(2026, 4, 8), 'last month'],
    [at(2026, 3, 9), 'last month'],
    [at(2026, 3, 8), '2 months ago'],
    [at(2025, 9, 8), '8 months ago'],
    [at(2025, 5, 9), '11 months ago'],
    [at(2025, 5, 8), 'last year'],
    [at(2024, 5, 9), 'last year'],
    [at(2024, 5, 8), '2 years ago'],
  ] as const)('%s → %s', (when, text) => {
    expect(whenText(when, NOW)).toBe(text);
  });
});

describe('#15 rows and search', () => {
  const C = (address: string, name: string): Contact => ({address, name, lastSentAt: null, known: false});
  const MARKO = C('Gabc1111111111111111111111111111111111xyz9', 'Marko · Mom');
  const BISTRO = C('3jkLm22222222222222222222222222222222pT8c', 'Bistro · for Marketing');
  const TINA = C('8qWeR33333333333333333333333333333333fD2x', 'Tina');

  it('search: by name or address, case-insensitive; an empty query is everything', () => {
    expect(searchContacts([MARKO, BISTRO, TINA], 'mark')).toEqual([MARKO, BISTRO]);
    expect(searchContacts([MARKO, BISTRO, TINA], 'FD2X')).toEqual([TINA]);
    expect(searchContacts([MARKO, BISTRO, TINA], '  ')).toEqual([MARKO, BISTRO, TINA]);
    expect(searchContacts([MARKO, BISTRO, TINA], 'zzz')).toEqual([]);
  });

  it('markParts: the first case-insensitive match in the name, or null for an address match', () => {
    expect(markParts('Marko · Mom', 'mark')).toEqual(['', 'Mark', 'o · Mom']);
    expect(markParts('Bistro · for Marketing', 'mark')).toEqual(['Bistro · for ', 'Mark', 'eting']);
    expect(markParts('Tina', 'fd2x')).toBeNull();
    expect(markParts('Tina', '')).toBeNull();
  });

  it('avatar: one of the design’s five gradients, always the same for an address; the initial is one whole character', () => {
    expect(AVATARS).toEqual(['violet', 'mint', 'coral', 'amber', 'blue']);
    expect(avatarOf(MARKO.address)).toBe(avatarOf(MARKO.address));
    expect(new Set([MARKO, BISTRO, TINA].map(c => avatarOf(c.address))).size).toBeGreaterThan(1);
    expect(initialOf('marko')).toBe('M');
    expect(initialOf('😀 Party')).toBe('😀');
  });

  it('counts: "N contacts" / "1 contact"; "N results for "q"" / "1 result for "q""', () => {
    expect(contactsCount(7)).toBe('7 contacts');
    expect(contactsCount(1)).toBe('1 contact');
    expect(contactsCount(0)).toBe('0 contacts');
    expect(resultsLine(2, 'mark')).toBe('2 results for "mark"');
    expect(resultsLine(1, 'mark ')).toBe('1 result for "mark"');
  });
});
