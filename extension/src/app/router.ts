import type {Tab} from './ui/TabBar';

/**
 * In-memory navigation (spec §1.6): a stack of routes in a reducer — push, pop, replace, back to a
 * tab. No router library, and no route that acts: every value a screen shows comes from the
 * background. Plan 1's routes only; plan 3 adds the send flow.
 *
 * Resume (§1.6 step 3) is absent in plan 1 by design (review M8): there is no send screen, so no route
 * may lead into a send or a resumed one. The list below is closed, and the reducer refuses anything
 * outside it — a forged or future route leaves the stack as it was rather than dangling.
 */
export type Route = {screen: 'tab'; tab: Tab} | {screen: 'receive'} | {screen: 'tx'; signature: string} | {screen: 'about'};
export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab};

export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about']);
const TABS: ReadonlySet<string> = new Set<Tab>(['home', 'activity', 'settings']);

function isRoute(r: unknown): r is Route {
  if (typeof r !== 'object' || r === null) return false;
  const o = r as Record<string, unknown>;
  if (typeof o.screen !== 'string' || !SCREENS.has(o.screen)) return false;
  if (o.screen === 'tab') return typeof o.tab === 'string' && TABS.has(o.tab);
  if (o.screen === 'tx') return typeof o.signature === 'string' && o.signature.length > 0;
  return true;
}

export function routeReducer(stack: Route[], action: RouteAction): Route[] {
  switch (action.type) {
    case 'push':
      return isRoute(action.route) ? [...stack, action.route] : stack;
    case 'pop':
      return stack.length > 1 ? stack.slice(0, -1) : stack;
    case 'tab':
      return TABS.has(action.tab) ? [{screen: 'tab', tab: action.tab}] : stack;
  }
}

/**
 * The tab surface's first route, from `location.hash`. Plan 1 has one route, `#/home` (#11 in a
 * column); any other hash shows it too — `#/send`, `#/send/resume` included. The hash only ever
 * chooses a screen — it never acts.
 */
export function firstRoute(): Route[] {
  return [{screen: 'tab', tab: 'home'}];
}
