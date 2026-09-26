import {decideAvailability, SETTLE_MS} from '../useWalletAvailability';

/**
 * The rule is asymmetric on purpose, and these tests exist to keep it that way: a wallet
 * that has registered is known immediately, but "no wallet" cannot be known from the first
 * paint, because Wallet Standard discovery is event-driven and an extension may register a
 * few hundred milliseconds late. Collapsing the two would tell a Phantom user to install
 * Phantom.
 */
describe('decideAvailability', () => {
  it('reports a detected wallet at once, without waiting to settle', () => {
    expect(decideAvailability(1, false)).toBe('available');
  });

  it('still reports it after settling', () => {
    expect(decideAvailability(2, true)).toBe('available');
  });

  it('says "searching", not "none", while an empty list could still fill', () => {
    expect(decideAvailability(0, false)).toBe('searching');
  });

  it('concludes "none" only once the window has passed', () => {
    expect(decideAvailability(0, true)).toBe('none');
  });

  it('waits long enough to be worth waiting for', () => {
    // A settle window short enough to beat extension injection would produce the confident
    // wrong answer this whole mechanism exists to avoid.
    expect(SETTLE_MS).toBeGreaterThanOrEqual(500);
  });
});
