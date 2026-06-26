import {tgeCountdownDisplay} from '../tgeCountdown';

const NOW = 1_700_000_000;
const d = (days: number) => NOW + days * 86400;

it('empty for null', () => expect(tgeCountdownDisplay(null, NOW)).toBe(''));
it('months ~7 for 204 days', () => expect(tgeCountdownDisplay(d(204), NOW)).toBe('in ~7 months'));
it('weeks ~3 for 21 days', () => expect(tgeCountdownDisplay(d(21), NOW)).toBe('in ~3 weeks'));
it('days for 5 days', () => expect(tgeCountdownDisplay(d(5), NOW)).toBe('in 5 days'));
it('tomorrow for 1.5 days', () => expect(tgeCountdownDisplay(d(1.5), NOW)).toBe('tomorrow'));
it('today for 0.5 day', () => expect(tgeCountdownDisplay(d(0.5), NOW)).toBe('today'));
it('now for past', () => expect(tgeCountdownDisplay(d(-1), NOW)).toBe('now'));
