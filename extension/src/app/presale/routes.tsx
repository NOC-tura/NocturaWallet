import type {PresaleRoute, PresaleRouteValue} from '../router';
import {Presale} from './Presale';
import {PresaleConfirm} from './PresaleConfirm';
import {PREPARE_REFUSALS, PRESALE_CURRENCIES, type PrepareRefusal, type PresaleCurrency} from './client';

/**
 * #23 again with what the user was buying (B1d-1b Task 5): #20's back arrow and the sign-time refusals that keep the
 * prepared purchase (§3.3: `price-changed`, `state-changed`, a limit that moved), and #44's / #54's [Try again]. Only
 * what the user chose — the currency and the amount, base units as a decimal string — the refusal #23 shows for it,
 * and the purchase's challenge id, which #23's next Buy carries (§3.3 step 6: the background decides whether it still
 * applies). Never a prepared purchase: #23 prepares again on its own Buy.
 */
export interface PresaleAgain {
  currency: PresaleCurrency;
  amount: string;
  code: PrepareRefusal | null;
  challengeId: string | null;
}

const AMOUNT = /^[1-9]\d{0,19}$/;
const U64_MAX = 18_446_744_073_709_551_615n;
const HEX_ID = /^[0-9a-f]{32}$/;
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const exactly = (o: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean => Object.keys(o).length === keys.length && keys.every(k => k in o);

function isAgain(x: unknown): x is PresaleAgain {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  if (!exactly(o, ['currency', 'amount', 'code', 'challengeId'])) return false;
  if (typeof o.currency !== 'string' || !(PRESALE_CURRENCIES as readonly string[]).includes(o.currency)) return false;
  if (typeof o.amount !== 'string' || !AMOUNT.test(o.amount) || BigInt(o.amount) > U64_MAX) return false;
  if (o.code !== null && (typeof o.code !== 'string' || !(PREPARE_REFUSALS as readonly string[]).includes(o.code))) return false;
  return o.challengeId === null || (typeof o.challengeId === 'string' && HEX_ID.test(o.challengeId));
}

/** #23's route carrying what to restore (see PresaleAgain). */
export const againRoute = (again: PresaleAgain): PresaleRouteValue => ({screen: 'presale', again: {...again}});

/**
 * B1d §4: #23 — the route `presale`, carrying nothing (it reads `presale.view` itself), or `again` (above). Its exits:
 * back, [Done] → #11, Buy → #20's purchase variant (`presale-confirm`, `flow`, the prepared id) and "Not available in
 * your region?" → #50b (`geo`, carrying nothing — Task 6 registers it). The reducer decides every push by the target's
 * own validator: until a route is registered, the push leaves the stack as it is.
 */
export const PRESALE_ROUTE: PresaleRoute = {
  screen: 'presale',
  isRoute: o => o.screen === 'presale' && (Object.keys(o).length === 1 || (exactly(o, ['screen', 'again']) && isAgain(o.again))),
  render: (route, nav) => (
    <Presale
      again={isAgain(route.again) ? route.again : null}
      onBack={nav.pop}
      onDone={nav.home}
      onPrepared={(account, view) => nav.push({screen: 'presale-confirm', account, entry: 'flow', preparedId: view.id})}
      onRegion={() => nav.push({screen: 'geo'})}
    />
  ),
};

/**
 * B1d §4.2: #20's purchase variant — `presale-confirm` with the account and `entry: 'flow'` and the prepared id #23
 * handed over, or `entry: 'resume'` (a reopened popup, the tab's hand-over after #10), never anything else: what it
 * shows comes from `presale.preparedFor`. It handles Esc itself (back to #23 with the amount kept).
 */
export const PRESALE_CONFIRM_ROUTE: PresaleRoute = {
  screen: 'presale-confirm',
  isRoute: o => {
    if (typeof o.account !== 'string' || !ADDRESS.test(o.account)) return false;
    if (o.entry === 'flow') return exactly(o, ['screen', 'account', 'entry', 'preparedId']) && typeof o.preparedId === 'string' && HEX_ID.test(o.preparedId);
    return o.entry === 'resume' && exactly(o, ['screen', 'account', 'entry']);
  },
  render: (route, nav) => (
    <PresaleConfirm
      account={route.account as string}
      preparedId={route.entry === 'flow' ? (route.preparedId as string) : null}
      onPresale={again => nav.reset([again === null ? {screen: 'presale'} : againRoute(again)])}
      onTrack={(account, id, since) => nav.reset([{screen: 'status', account, id, since}])}
      onHome={nav.home}
    />
  ),
  ownEscape: true,
};
