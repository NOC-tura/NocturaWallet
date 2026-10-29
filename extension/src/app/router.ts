import type {ReactNode} from 'react';
import type {Tab} from './ui/TabBar';
import type {Surface} from './WalletContext';
import type {Engine, Intent, PendingExtra} from './engine';
import {isDraft, isIntent, type Draft} from './send/rules';
import {presaleRoutes} from './presale';

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
  /** B1b-2b §1.4: #35 security center, the accounts manager, the passkey screen, #37 delete wallet — no data on any. */
  | {screen: 'security'}
  | {screen: 'accounts'}
  | {screen: 'passkey'}
  | {screen: 'delete'}
  /**
   * B1b-2b §1.4, plan 2: #15 address book. `pick`: opened from #12's contact icon — a row tap hands the address back
   * through the `send` route's own draft (a reset, review M4), never through a key of this route.
   */
  | {screen: 'contacts'; pick: boolean}
  /** B1c §4.4: #49 connected apps, from #31's Connected dApps row — no data. */
  | {screen: 'connected'}
  | {screen: 'send'; draft: Draft | null; notice: 'start-again' | null}
  | {screen: 'review'; account: string; intent: Intent; notice: 'confirmation-expired' | null}
  | {screen: 'confirm'; account: string; entry: 'flow'; preparedId: string}
  | {screen: 'confirm'; account: string; entry: 'resume'}
  | {screen: 'status'; account: string; id: string | null; since: number}
  | {screen: 'created'}
  | {screen: 'imported'}
  | {screen: 'resume'; account: string};
/**
 * B1d §1.1: a route the presale entry adds (src/app/presale/index.ts — none in B1d-1a, none in the build without
 * presale). Its screen is outside the closed list below, and its own validator decides it: exactly its keys, each one
 * checked. It can only add a screen — a name the list already holds, or a TAB_ONLY hand-over name, is decided by
 * that list, never by it (final review I1): `created`/`imported`/`resume` are first routes from the tab's hash only,
 * and a presale route cannot make them pushable.
 */
export interface PresaleRoute {
  screen: string;
  isRoute(o: Readonly<Record<string, unknown>>): boolean;
  /** B1d-1b: the route's screen, drawn by App for a route this validator accepted; it moves only through `nav`. */
  render(route: PresaleRouteValue, nav: PresaleNav): ReactNode;
  /** B1d-1b: the screen handles Esc itself, as the send flow's screens do (FLOW) — App's Esc-goes-back leaves it alone. */
  ownEscape?: boolean;
}
/** A presale route as its entry builds it: a screen name and that route's own keys, which its validator decides. */
export type PresaleRouteValue = {readonly screen: string} & Readonly<Record<string, unknown>>;
/**
 * The ways a presale screen leaves (B1d-1b): back one step, home to #11, or a push the reducer decides like any other
 * — a route no entry accepts leaves the stack as it is.
 */
export interface PresaleNav {
  pop(): void;
  home(): void;
  push(route: PresaleRouteValue): void;
  /** B1d-1b Task 6: this screen replaced by `route` (#23 by #50b, §4.3) — the reducer decides it; refused, the stack stays. */
  replace(route: PresaleRouteValue): void;
  /** B1d-1b: a new stack — #11, then these routes; the reducer decides every one, and refuses the whole stack for one it refuses. */
  reset(routes: readonly PresaleRouteValue[]): void;
}
/**
 * B1d §1.3, §4.2: how #21, #44 and #54 show a wallet record of a kind the presale entry renders — its own words, and
 * where its own flow goes on. Every string is the entry's (shared code names none of them); nothing in it decides
 * anything: the record's state, signature, fee and actions are the record's own, as for a send.
 */
export interface KindRecord {
  /** The amount line: #21's amount card, under #44's head, #54's original-transaction row. */
  line: string;
  /** The badge beside #21's status, and #54's original-transaction pill. */
  badge: string;
  /** #21's top-bar title while the record is open, and once it is confirmed. */
  sending: string;
  sent: string;
  /** #21's confirmed line. */
  sentOk: string;
  /** B1d-1b Task 6: #11's and #26's pending row while the record is open, and once it takes longer than usual (Q33). */
  pending: string;
  slow: string;
  /** #44's sub when the program refused it on chain (the network fee paid). */
  rejectedSub: string;
  /** #44's kept payload (an expired blockhash) and #54's rows: what was paid, and to whom (#21's To row too). */
  amount: string;
  to: string;
  /**
   * B1d-1b Task 9: #21's amount card as drawn (index.html #s21: eyebrow, figure, ticker, the dollar line) — the line's
   * words before the amount as the eyebrow, the amount and its ticker as the figure, and the dollars it was worth.
   */
  card: {lead: string; figure: string; ticker: string; usd: string};
  /** #21's Done and close: where the record's own flow goes on. */
  done: PresaleRouteValue;
  /** #44's and #54's [Try again] (and #44's back arrow): a fresh start of that flow with what the record paid. */
  again: PresaleRouteValue;
}
/**
 * B1d §4.5: #11's presale banner — the entry's words for the sale as `presale.banner` answered it (two lines, as drawn).
 * Nothing in it decides anything: Home shows it and its Buy only while the entry answers one.
 */
export interface HomeBanner {
  title: string;
  line: string;
}
/** B1d §1.1, §1.3, §4.2: the presale entry's slots — `presaleSlots`, null in the build without presale. */
export interface PresaleSlots {
  /** The words for a record of the entry's own kind whose data reads back; null for any other. */
  record(extra: PendingExtra): KindRecord | null;
  /** §4.2's resume paths: the route that shows this account's prepared entry of the entry's own kind, or null for none. */
  resume(engine: Engine, account: string): Promise<PresaleRouteValue | null>;
  /** B1d-1b Task 6, §4.5: #11's banner, or null — no sale shown (inactive, unreadable, refused, locked). */
  banner(engine: Engine): Promise<HomeBanner | null>;
  /** §4.5: where #11's Buy (and its banner) goes for this account — #23, #50b, or null: no route, the action hides. */
  buy(engine: Engine, account: string): Promise<PresaleRouteValue | null>;
  /** B1d-2 (C16, §4.4): #31's row into the entry's own screen — its group label, its title, and the route it pushes. */
  settings: {group: string; title: string; route: PresaleRouteValue};
  /** B1d-2 (§4.6, Q31): the badge on every `purchase` row of #26 — the history's kind, a site's purchase included. */
  historyBadge: string;
  /** §4.6 (Q34, D29): #27's line for this account's purchase while presale.unrecorded lists its signature; null otherwise and on any failure. */
  unrecorded(engine: Engine, account: string, signature: string): Promise<string | null>;
}
export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab} | {type: 'replace'; route: Route} | {type: 'reset'; routes: Route[]};

export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about', 'send', 'review', 'confirm', 'status', 'security', 'accounts', 'passkey', 'delete', 'contacts', 'connected']);
/** B1b-2b: the settings screens carry nothing but their name — no secret, no challenge, no address to act on. */
const BARE: ReadonlySet<string> = new Set<Route['screen']>(['security', 'accounts', 'passkey', 'delete', 'connected']);
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
  if (typeof o.screen !== 'string') return false;
  if (!SCREENS.has(o.screen)) return !TAB_ONLY.has(o.screen) && presaleRoutes.some(p => p.screen === o.screen && p.isRoute(o));
  if (o.screen === 'tab') return typeof o.tab === 'string' && TABS.has(o.tab);
  if (BARE.has(o.screen)) return only(o, ['screen']);
  if (o.screen === 'contacts') return only(o, ['screen', 'pick']) && typeof o.pick === 'boolean';
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

/** The presale route a stack's top is, if any (B1d §1.1): never a screen of the closed list. */
export function presaleRouteOf(route: Route): PresaleRoute | undefined {
  return SCREENS.has(route.screen) ? undefined : presaleRoutes.find(p => p.screen === route.screen);
}

/** How a presale screen moves the stack: each a reducer action, a push or reset decided by the targets' own validators. */
export function presaleNav(go: (action: RouteAction) => void, home: Route): PresaleNav {
  return {
    pop: () => go({type: 'pop'}),
    home: () => go({type: 'reset', routes: [home]}),
    push: route => go({type: 'push', route: route as Route}),
    replace: route => go({type: 'replace', route: route as Route}),
    reset: routes => go({type: 'reset', routes: [home, ...(routes as readonly Route[])]}),
  };
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
 * #15's pick hand-back (spec §1.4, review M4): the address goes into the `send` route's OWN draft — the route under #15
 * — and the stack ends there, so #12 mounts again holding it and treats it exactly as a paste (isDraft checks it like
 * any draft). No route gains a key. Null when no `send` route is below (plan 2 review L8): the caller pops instead, so a
 * pick screen never has dead rows.
 */
export function pickStack(stack: readonly Route[], address: string): Route[] | null {
  const at = stack.map(r => r.screen).lastIndexOf('send');
  const below = stack[at];
  if (below?.screen !== 'send') return null;
  const draft: Draft = {...(below.draft ?? {token: 'SOL', recipient: '', amount: ''}), recipient: address};
  return [...stack.slice(0, at), {screen: 'send', draft, notice: null}];
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
