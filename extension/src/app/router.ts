import type {Tab} from './ui/TabBar';
import type {Surface} from './WalletContext';
import type {Intent} from './engine';
import {isDraft, isIntent, type Draft} from './send/rules';

/**
 * In-memory navigation (spec §1.6): a stack of routes in a reducer — push, pop, replace, reset, back to a
 * tab. No router library, and no route that acts: every value a screen shows comes from the background.
 *
 * The pushable screens are a closed list, and the reducer refuses anything outside it — a forged or
 * future route leaves the stack as it was rather than dangling. The send flow's routes (plan 3) carry only
 * what the user typed (#12's draft, #19's intent) and which account and pending record a screen reads —
 * never a prepared send: #20 reads that from the background every time (D38); from #19 it carries the
 * reference id of the one #19 showed, which #20 only compares against what `wallet.preparedFor` answers
 * (Task 8). A route with any key beyond its own is refused whole. The UI tab's hand-over screens (#7
 * `created`, #40 `imported`, #20's `resume` entry) are first routes only: chosen by the tab's hash, never
 * pushed. No route broadcasts: #20 sends on its Send button's tap alone.
 */
export type Route =
  | {screen: 'tab'; tab: Tab}
  | {screen: 'receive'}
  | {screen: 'tx'; signature: string; account: string}
  | {screen: 'about'}
  | {screen: 'send'; draft: Draft | null; notice: 'start-again' | null}
  | {screen: 'review'; account: string; intent: Intent; notice: 'confirmation-expired' | null}
  | {screen: 'confirm'; account: string; entry: 'flow'; preparedId: string}
  | {screen: 'confirm'; account: string; entry: 'resume'}
  | {screen: 'status'; account: string; id: string | null; since: number}
  | {screen: 'created'}
  | {screen: 'imported'}
  | {screen: 'resume'; account: string};
export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab} | {type: 'replace'; route: Route} | {type: 'reset'; routes: Route[]};

export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about', 'send', 'review', 'confirm', 'status']);
/** The send flow's screens: each handles Esc itself (#19 discards first, #20 keeps, #21 has no back while open). */
export const FLOW: ReadonlySet<string> = new Set<Route['screen']>(['send', 'review', 'confirm', 'status', 'resume']);
/** The UI tab's hand-over screens: a first route from `location.hash`, never pushed. */
export const TAB_ONLY: ReadonlySet<string> = new Set<Route['screen']>(['created', 'imported', 'resume']);
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** Pending-record and prepared-send ids: 16 random bytes as 32 hex characters (background/digest.ts). */
const HEX_ID = /^[0-9a-f]{32}$/;
const TABS: ReadonlySet<string> = new Set<Tab>(['home', 'activity', 'settings']);
const isAddress = (x: unknown): x is string => typeof x === 'string' && ADDRESS.test(x);
/** The route has exactly these keys: a flow route carries nothing beyond its own fields (no prepared send). */
const only = (o: Record<string, unknown>, keys: string[]): boolean => Object.keys(o).length === keys.length && keys.every(k => k in o);

function isRoute(r: unknown): r is Route {
  if (typeof r !== 'object' || r === null) return false;
  const o = r as Record<string, unknown>;
  if (typeof o.screen !== 'string' || !SCREENS.has(o.screen)) return false;
  if (o.screen === 'tab') return typeof o.tab === 'string' && TABS.has(o.tab);
  // #27 carries the account whose history the signature came from: its [Try again] is offered only while that account is selected (fix round 1).
  if (o.screen === 'tx') return only(o, ['screen', 'signature', 'account']) && typeof o.signature === 'string' && o.signature.length > 0 && isAddress(o.account);
  if (o.screen === 'send') return only(o, ['screen', 'draft', 'notice']) && (o.draft === null || isDraft(o.draft)) && (o.notice === null || o.notice === 'start-again');
  if (o.screen === 'review') return only(o, ['screen', 'account', 'intent', 'notice']) && isAddress(o.account) && isIntent(o.intent) && (o.notice === null || o.notice === 'confirmation-expired');
  if (o.screen === 'confirm') {
    if (!isAddress(o.account)) return false;
    if (o.entry === 'flow') return only(o, ['screen', 'account', 'entry', 'preparedId']) && typeof o.preparedId === 'string' && HEX_ID.test(o.preparedId);
    return o.entry === 'resume' && only(o, ['screen', 'account', 'entry']);
  }
  if (o.screen === 'status') return only(o, ['screen', 'account', 'id', 'since']) && isAddress(o.account) && (o.id === null || (typeof o.id === 'string' && HEX_ID.test(o.id))) && typeof o.since === 'number' && Number.isFinite(o.since);
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
    case 'replace':
      return isRoute(action.route) ? [...stack.slice(0, -1), action.route] : stack;
    case 'reset':
      return action.routes.length > 0 && action.routes.every(isRoute) ? action.routes : stack;
  }
}

/**
 * The first route (spec §1.6). The popup always starts at #11. The tab reads `location.hash`: `#/created`
 * (#7), `#/imported` (#40), `#/send/resume?account=<address>` (the hand-over from #10: #20, which reads the
 * prepared send through wallet.preparedFor and waits for a tap — D38) and `#/home`; anything else is #11
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
