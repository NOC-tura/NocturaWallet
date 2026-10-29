import type {Ext} from '../ext';
import {createMutex} from './mutex';

/**
 * B1d §2.4: storage.local `v1_presale_records` — the coordinator record of each confirmed purchase, written only by the
 * background (scripts/check-vault-isolation.mjs BACKGROUND_OWNED_KEYS), by `presale/record.ts` in the presale build.
 * The key and its lock live here, in both builds, because a delete wipes a wallet's data in both (accountsStore's
 * WALLET_DATA_KEYS): an update that turns presale off must not leave a deleted wallet's purchases behind.
 */
export const PRESALE_RECORDS_KEY = 'v1_presale_records';

/** Every write of PRESALE_RECORDS_KEY runs inside this section, so a wipe is never undone by a write-back in flight. */
export const presaleRecordsSection = createMutex();

/** A delete's (and a first write's) removal of the records, behind any write in flight. */
export async function wipePresaleRecords(ext: Ext): Promise<void> {
  await presaleRecordsSection(() => ext.local.remove(PRESALE_RECORDS_KEY));
}
