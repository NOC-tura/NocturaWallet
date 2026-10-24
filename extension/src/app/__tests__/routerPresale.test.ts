import {presaleNav, presaleRouteOf, routeReducer, type PresaleRoute, type Route, type RouteAction} from '../router';

// B1d §1.1: the router takes the presale entry's routes (src/app/presale/index.ts, empty in B1d-1a and in the build
// without presale). Here the entry is replaced by a test double holding two: one with a screen of its own, and one
// that claims a screen the closed list already holds.
vi.mock('../presale', (): {presaleRoutes: readonly PresaleRoute[]; presaleSlots: null} => ({
  presaleRoutes: [
    {screen: 'x-presale', isRoute: o => Object.keys(o).length === 2 && o.n === 1, render: () => null},
    {screen: 'security', isRoute: () => true, render: () => null},
    {screen: 'resume', isRoute: () => true, render: () => null},
    {screen: 'created', isRoute: () => true, render: () => null},
    {screen: 'imported', isRoute: () => true, render: () => null},
  ],
  presaleSlots: null,
}));

const HOME: Route[] = [{screen: 'tab', tab: 'home'}];
const push = (route: unknown) => routeReducer(HOME, {type: 'push', route: route as Route});

describe('the router with presale routes', () => {
  it('a presale route of its own screen is decided by its own validator', () => {
    expect(push({screen: 'x-presale', n: 1})).toEqual([...HOME, {screen: 'x-presale', n: 1}]);
    expect(push({screen: 'x-presale', n: 2})).toBe(HOME);
    expect(push({screen: 'x-presale', n: 1, extra: true})).toBe(HOME);
  });

  it('a presale route cannot loosen a screen of the closed list; an unknown screen stays refused', () => {
    expect(push({screen: 'security', extra: true})).toBe(HOME);
    expect(push({screen: 'security'})).toEqual([...HOME, {screen: 'security'}]);
    expect(push({screen: 'x-other'})).toBe(HOME);
  });

  it('a presale route cannot make a TAB_ONLY hand-over screen pushable (final review I1)', () => {
    expect(push({screen: 'resume'})).toBe(HOME);
    expect(push({screen: 'resume', account: 'x'})).toBe(HOME);
    expect(push({screen: 'created'})).toBe(HOME);
    expect(push({screen: 'imported'})).toBe(HOME);
  });
});

describe('App’s way to a presale route (B1d-1b Task 4)', () => {
  it('presaleRouteOf: the entry’s route for its own screen; never for a screen of the closed list, even one an entry claims', () => {
    expect(presaleRouteOf({screen: 'x-presale', n: 1} as unknown as Route)?.screen).toBe('x-presale');
    expect(presaleRouteOf({screen: 'security'})).toBeUndefined();
    expect(presaleRouteOf({screen: 'x-other'} as unknown as Route)).toBeUndefined();
  });

  it('presaleNav: pop, home (a reset to the given route), push and reset (the given route, then these) — each one reducer action, the reducer deciding', () => {
    const actions: RouteAction[] = [];
    const nav = presaleNav(a => void actions.push(a), HOME[0] as Route);
    nav.pop();
    nav.home();
    nav.push({screen: 'x-presale', n: 1});
    nav.reset([{screen: 'x-presale', n: 1}, {screen: 'receive'}]);
    expect(actions).toEqual([
      {type: 'pop'},
      {type: 'reset', routes: HOME},
      {type: 'push', route: {screen: 'x-presale', n: 1}},
      {type: 'reset', routes: [...HOME, {screen: 'x-presale', n: 1}, {screen: 'receive'}]},
    ]);
    const reset = actions[3];
    if (reset === undefined) throw new Error('no reset');
    expect(routeReducer([{screen: 'about'}], reset)).toEqual([...HOME, {screen: 'x-presale', n: 1}, {screen: 'receive'}]);
    // One route the reducer refuses refuses the whole stack (negative control).
    expect(routeReducer(HOME, {type: 'reset', routes: [...HOME, {screen: 'x-presale', n: 2} as unknown as Route]})).toBe(HOME);
    const [, , pushed] = actions;
    if (pushed === undefined) throw new Error('no push');
    expect(routeReducer(HOME, pushed)).toEqual([...HOME, {screen: 'x-presale', n: 1}]);
    expect(routeReducer(HOME, {type: 'push', route: {screen: 'x-presale', n: 2} as unknown as Route})).toBe(HOME);
  });

  it('presaleNav.replace (B1d-1b Task 6): one replace action — the top route swapped for the given one, the reducer deciding', () => {
    const actions: RouteAction[] = [];
    const nav = presaleNav(a => void actions.push(a), HOME[0] as Route);
    nav.replace({screen: 'x-presale', n: 1});
    expect(actions).toEqual([{type: 'replace', route: {screen: 'x-presale', n: 1}}]);
    const [replaced] = actions;
    if (replaced === undefined) throw new Error('no replace');
    const stack: Route[] = [...HOME, {screen: 'receive'}];
    expect(routeReducer(stack, replaced)).toEqual([...HOME, {screen: 'x-presale', n: 1}]);
    // Refused by its validator: the stack stays (negative control).
    expect(routeReducer(stack, {type: 'replace', route: {screen: 'x-presale', n: 2} as unknown as Route})).toBe(stack);
  });
});
