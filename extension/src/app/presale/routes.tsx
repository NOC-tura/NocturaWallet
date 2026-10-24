import type {PresaleRoute} from '../router';
import {Presale} from './Presale';

/**
 * B1d §4: #23 — the route `presale`, carrying nothing (it reads `presale.view` itself). Its exits: back, [Done] → #11,
 * Buy → #20's purchase variant (`presale-confirm`, `flow`, the prepared id — B1d-1b Task 5 registers that route) and
 * "Not available in your region?" → #50b (`geo`, carrying nothing — Task 6 registers it). The reducer decides every
 * push by the target's own validator: until a route is registered, the push leaves the stack as it is.
 */
export const PRESALE_ROUTE: PresaleRoute = {
  screen: 'presale',
  isRoute: o => Object.keys(o).length === 1 && o.screen === 'presale',
  render: (_route, nav) => (
    <Presale
      onBack={nav.pop}
      onDone={nav.home}
      onPrepared={(account, view) => nav.push({screen: 'presale-confirm', account, entry: 'flow', preparedId: view.id})}
      onRegion={() => nav.push({screen: 'geo'})}
    />
  ),
};
