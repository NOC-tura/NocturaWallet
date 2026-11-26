/** post-M1d §3.2 / §3.3 / R16: the stale copy and the age. */
import {SEND_BALANCE_STALE, STALE_ROW_SUFFIX, relativeAge, splitA11y, staleLine, staleNote, staleRow} from '../accounts';

const MIN = 60_000;
const H = 60 * MIN;
const D = 24 * H;

// C1 (Review Focus 4)
it.each<[string, number, string]>([
  ['0 ms', 0, 'just now'],
  ['59.999 s', MIN - 1, 'just now'],
  ['exactly 1 min', MIN, '1 min ago'],
  ['5 min', 5 * MIN, '5 min ago'],
  ['59 min 59 s', H - 1, '59 min ago'],
  ['exactly 60 min', H, '1 h ago'],
  ['2 h', 2 * H, '2 h ago'],
  ['23 h 59 min', D - MIN, '23 h ago'],
  ['exactly 24 h', D, '1 d ago'],
  ['3 d', 3 * D, '3 d ago'],
  ['the clock moved backwards (a negative age)', -5 * MIN, 'just now'],
])('relativeAge: %s → %s', (_n, elapsed, expected) => {
  expect(relativeAge(1_000_000_000, 1_000_000_000 + elapsed)).toBe(expected);
});

it('the three lines, exactly', () => {
  expect(staleLine('5 min ago')).toBe('Not updated · 5 min ago · pull to refresh');
  expect(staleNote('2 h ago')).toBe('Not updated · 2 h ago');
  expect(STALE_ROW_SUFFIX).toBe('not updated');
  expect(staleRow('0.5 SOL')).toBe('0.5 SOL · not updated');
  expect(SEND_BALANCE_STALE).toBe('Not updated · tap to retry');
});

it('splitA11y says "not updated" for a stale side, and is unchanged otherwise', () => {
  expect(splitA11y('Public', '$12.40', true)).toBe('Public, $12.40');
  expect(splitA11y('Public', '$12.40', true, true)).toBe('Public, $12.40, not updated');
  expect(splitA11y('Public', '$12.40', false, true)).toBe('Public, $12.40, not updated, switch to Public');
  expect(splitA11y('Public', '•••', true, true)).toBe('Public, •••, not updated'); // hidden: no figure, still said
});
