// @vitest-environment happy-dom
import {SCREENS, firstRoute, routeReducer, type Route} from '../router';

const HOME: Route[] = [{screen: 'tab', tab: 'home'}];

// Spec §1.6: an in-memory stack; "No hash causes an action." Review M8: resume (§1.6 step 3) is absent
// in plan 1 by design — so no route may lead into the send flow or a resumed send.
describe('the router (plan 1)', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('push, pop (never below the first route), and a tab resets the stack', () => {
    const s1 = routeReducer(HOME, {type: 'push', route: {screen: 'receive'}});
    expect(s1).toEqual([...HOME, {screen: 'receive'}]);
    expect(routeReducer(s1, {type: 'pop'})).toEqual(HOME);
    expect(routeReducer(HOME, {type: 'pop'})).toBe(HOME);
    expect(routeReducer([...s1, {screen: 'about'}], {type: 'tab', tab: 'activity'})).toEqual([{screen: 'tab', tab: 'activity'}]);
  });

  it("plan 1's screens are a closed list with no send or resume", () => {
    expect([...SCREENS].sort()).toEqual(['about', 'receive', 'tab', 'tx']);
  });

  it.each(['send', 'resume', 'send/resume', 'confirm'])('refuses a pushed "%s" route: the stack is unchanged', screen => {
    const forged = {screen} as unknown as Route;
    expect(routeReducer(HOME, {type: 'push', route: forged})).toBe(HOME);
  });

  it('refuses a route of a known screen with a malformed shape', () => {
    expect(routeReducer(HOME, {type: 'push', route: {screen: 'tx'} as unknown as Route})).toBe(HOME);
    expect(routeReducer(HOME, {type: 'tab', tab: 'send' as unknown as 'home'})).toBe(HOME);
  });

  it.each(['', '#/home', '#/send', '#/send/resume', '#/resume?id=1', '#/tx/abc', '#/about'])('the first route for hash "%s" is Home: a hash never acts', hash => {
    window.location.hash = hash;
    expect(firstRoute()).toEqual(HOME);
  });

  it('the Route type itself has no send screen', () => {
    // @ts-expect-error — plan 1's Route has no 'send' screen (tsc fails this file if one is added).
    const r: Route = {screen: 'send'};
    expect(r.screen).toBe('send');
  });
});
