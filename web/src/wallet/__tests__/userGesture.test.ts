import {userHasActed, resetUserGestureForTests} from '../userGesture';

/**
 * This flag decides whether the page may connect a wallet on its own, so both answers
 * matter and both are pinned. Getting it stuck on `true` would restore the behaviour the
 * whole arrangement exists to prevent — connecting on arrival.
 */
describe('userHasActed', () => {
  beforeEach(() => {
    resetUserGestureForTests();
  });

  it('is false before anyone has touched the page', () => {
    // The load case: a wallet restored from localStorage must NOT be connected to.
    expect(userHasActed()).toBe(false);
  });

  it.each(['pointerdown', 'keydown', 'touchstart'])('becomes true after %s', type => {
    document.dispatchEvent(new Event(type, {bubbles: true}));
    expect(userHasActed()).toBe(true);
  });

  it('is not tripped by an event the user did not cause', () => {
    // The control: without this, any dispatched event would do and the flag would mean
    // "something happened" rather than "the user did something".
    document.dispatchEvent(new Event('scroll', {bubbles: true}));
    document.dispatchEvent(new Event('visibilitychange', {bubbles: true}));
    expect(userHasActed()).toBe(false);
  });
});
