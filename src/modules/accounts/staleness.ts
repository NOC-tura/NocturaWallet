/**
 * post-M1d spec §3.1 (R1, R13): the MAIN account's figure (walletStore, written by forceSync) is stale
 * when the last sync attempt of this session failed and an older fully successful read exists. With no
 * successful read ever the figure is unknown, not stale. One rule, read by useAccountPublicData and by
 * the Accounts sheet's main row (R10). Pure.
 */
export function mainBalanceIsStale(lastSyncedAt: number | null, lastSyncFailedAt: number | null): boolean {
  return lastSyncFailedAt !== null && lastSyncedAt !== null;
}

/**
 * Review r1-1: nothing was ever read and this session's sync failed. walletStore then holds its
 * defaults ('0'), which are not a balance: every consumer must show "unknown", never 0.
 */
export function mainBalanceIsUnknown(lastSyncedAt: number | null, lastSyncFailedAt: number | null): boolean {
  return lastSyncFailedAt !== null && lastSyncedAt === null;
}
