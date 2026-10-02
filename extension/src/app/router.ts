import type {Tab} from './ui/TabBar';
import type {Surface} from './WalletContext';

/**
 * In-memory navigation (spec §1.6): a stack of routes in a reducer — push, pop, replace, back to a
 * tab. No router library, and no route that acts: every value a screen shows comes from the
 * background. Plan 3 adds the send flow.
 *
 * The pushable screens are a closed list, and the reducer refuses anything outside it — a forged or
 * future route leaves the stack as it was rather than dangling. The UI tab's hand-over screens (#7
 * `created`, #40 `imported`, and plan 2's `resume` stand-in) are first routes only: chosen by the tab's
 * hash, never pushed.
 */
export type Route =
  | {screen: 'tab'; tab: Tab}
  | {screen: 'receive'}
  | {screen: 'tx'; signature: string}
  | {screen: 'about'}
  | {screen: 'created'}
  | {screen: 'imported'}
  | {screen: 'resume'; account: string};
export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab};

export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about']);
/** The UI tab's hand-over screens: a first route from `location.hash`, never pushed. */
export const TAB_ONLY: ReadonlySet<string> = new Set<Route['screen']>(['created', 'imported', 'resume']);
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
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
 * The first route (spec §1.6). The popup always starts at #11. The tab reads `location.hash`: `#/created`
 * (#7), `#/imported` (#40), `#/send/resume?account=<address>` (the hand-over from #10 — plan 2 shows
 * "Open the Noctura icon to continue." there; plan 3 makes it #20) and `#/home`; anything else is #11
 * too. The hash only ever chooses a screen — it never acts, and the account is only an address.
 */
export function firstRoute(surface: Surface = 'popup', hash = ''): Route[] {
  if (surface === 'tab') {
    if (hash === '#/created') return [{screen: 'created'}];
    if (hash === '#/imported') return [{screen: 'imported'}];
    const resume = /^#\/send\/resume\?account=([^&#]*)$/.exec(hash);
    if (resume !== null && ADDRESS.test(resume[1] ?? '')) return [{screen: 'resume', account: resume[1] ?? ''}];
  }
  return [{screen: 'tab', tab: 'home'}];
}
