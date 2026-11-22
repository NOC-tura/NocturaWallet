/** post-M1d §3.1: the main account's figure is stale when this session's last sync failed AND an older good read
 *  exists; it is unknown when the sync failed and nothing was ever read (review r1-1). Never both. */
import {mainBalanceIsStale, mainBalanceIsUnknown} from '../staleness';

it.each<[string, number | null, number | null, boolean, boolean]>([
  ['never read, never failed', null, null, false, false],
  ['never read, failed → unknown, not stale', null, 900, false, true],
  ['read, not failed → current', 500, null, false, false],
  ['read, then failed → stale, not unknown', 500, 900, true, false],
])('%s', (_n, syncedAt, failedAt, stale, unknown) => {
  expect(mainBalanceIsStale(syncedAt, failedAt)).toBe(stale);
  expect(mainBalanceIsUnknown(syncedAt, failedAt)).toBe(unknown);
});
