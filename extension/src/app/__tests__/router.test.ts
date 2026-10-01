// @vitest-environment happy-dom
import {SCREENS, TAB_ONLY, firstRoute, routeReducer, type Route} from '../router';

const HOME: Route[] = [{screen: 'tab', tab: 'home'}];

const ADDR = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';

// Spec §1.6: an in-memory stack; "No hash causes an action." No route leads into the send flow until
// plan 3; the resume hand-over is a plan-2 stand-in that only says where to go.
describe('the router', () => {
  it('push, pop (never below the first route), and a tab resets the stack', () => {
    const s1 = routeReducer(HOME, {type: 'push', route: {screen: 'receive'}});
    expect(s1).toEqual([...HOME, {screen: 'receive'}]);
    expect(routeReducer(s1, {type: 'pop'})).toEqual(HOME);
    expect(routeReducer(HOME, {type: 'pop'})).toBe(HOME);
    expect(routeReducer([...s1, {screen: 'about'}], {type: 'tab', tab: 'activity'})).toEqual([{screen: 'tab', tab: 'activity'}]);
  });

  it('the pushable screens are a closed list with no send; the hand-over screens are first routes only', () => {
    expect([...SCREENS].sort()).toEqual(['about', 'receive', 'tab', 'tx']);
    expect([...TAB_ONLY].sort()).toEqual(['created', 'imported', 'resume']);
    for (const route of [{screen: 'created'}, {screen: 'imported'}, {screen: 'resume', account: ADDR}] as Route[]) expect(routeReducer(HOME, {type: 'push', route})).toBe(HOME);
  });

  it.each(['send', 'resume', 'send/resume', 'confirm'])('refuses a pushed "%s" route: the stack is unchanged', screen => {
    const forged = {screen} as unknown as Route;
    expect(routeReducer(HOME, {type: 'push', route: forged})).toBe(HOME);
  });

  it('refuses a route of a known screen with a malformed shape', () => {
    expect(routeReducer(HOME, {type: 'push', route: {screen: 'tx'} as unknown as Route})).toBe(HOME);
    expect(routeReducer(HOME, {type: 'tab', tab: 'send' as unknown as 'home'})).toBe(HOME);
  });

  it.each(['', '#/home', '#/send', '#/send/resume', '#/resume?id=1', '#/tx/abc', '#/about', '#/send/resume?account=', '#/send/resume?account=not-an-address', `#/send/resume?account=${ADDR}&amount=1`])(
    'the tab’s first route for hash "%s" is Home: a hash never acts',
    hash => {
      expect(firstRoute('tab', hash)).toEqual(HOME);
    },
  );

  it('the tab reads #/created (#7), #/imported (#40) and #/send/resume?account=<address> (the plan-2 stand-in); the popup ignores the hash', () => {
    expect(firstRoute('tab', '#/created')).toEqual([{screen: 'created'}]);
    expect(firstRoute('tab', '#/imported')).toEqual([{screen: 'imported'}]);
    expect(firstRoute('tab', `#/send/resume?account=${ADDR}`)).toEqual([{screen: 'resume', account: ADDR}]);
    expect(firstRoute('popup', '#/created')).toEqual(HOME);
    expect(firstRoute()).toEqual(HOME);
  });

  it('the Route type itself has no send screen', () => {
    // @ts-expect-error — plan 2's Route has no 'send' screen (tsc fails this file if one is added).
    const r: Route = {screen: 'send'};
    expect(r.screen).toBe('send');
  });
});
