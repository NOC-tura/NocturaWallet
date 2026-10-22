import {routeReducer, type PresaleRoute, type Route} from '../router';

// B1d §1.1: the router takes the presale entry's routes (src/app/presale/index.ts, empty in B1d-1a and in the build
// without presale). Here the entry is replaced by a test double holding two: one with a screen of its own, and one
// that claims a screen the closed list already holds.
vi.mock('../presale', (): {presaleRoutes: readonly PresaleRoute[]; presaleSlots: null} => ({
  presaleRoutes: [
    {screen: 'x-presale', isRoute: o => Object.keys(o).length === 2 && o.n === 1},
    {screen: 'security', isRoute: () => true},
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
});
