/**
 * Owner Q3 (2026-11-27): the Accounts sheet's "Link check not finished". Subscribing re-renders the caller
 * when a scan running in the background records its result (`linkScanResults.ts`); the caller reads the
 * answer during render, so it never holds a stale one.
 */
import {useSyncExternalStore} from 'react';
import {linkCheckUnfinished, linkScanResultsVersion, subscribeLinkScanResults} from '../modules/accounts/linkScanResults';

export function useLinkCheckUnfinished(): (exit: string) => boolean {
  useSyncExternalStore(subscribeLinkScanResults, linkScanResultsVersion);
  return linkCheckUnfinished;
}
