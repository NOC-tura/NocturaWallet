/**
 * M1d spec §3.4 (plan A1): the Accounts sheet's balances — read while the sheet is open, at most
 * ROW_WINDOW (the extension's FRESH_ROWS) in flight: each settled row lets the next one start, so
 * every row is read. A row in flight or waiting is "not checked yet", a failed one "Balance
 * unavailable". The query key is the dashboard's (`['accountSnapshot', address]`), so a row and
 * the dashboard share one read.
 */
import {useEffect, useState} from 'react';
import {useQueries} from '@tanstack/react-query';
import {fetchAccountSnapshot} from '../modules/accounts/accountSnapshot';
import type {AccountSnapshot} from '../modules/accounts/accountSnapshot';
import {ACCOUNT_SNAPSHOT_KEY} from './useAccountPublicData';

export const ROW_WINDOW = 10;

export type RowBalance = {state: 'not-checked'} | {state: 'failed'} | {state: 'ready'; data: AccountSnapshot; at: number};

export function useAccountRowBalances(addresses: readonly string[], active: boolean): Record<string, RowBalance> {
  const [released, setReleased] = useState(ROW_WINDOW);
  const results = useQueries({
    queries: addresses.map((address, i) => ({
      queryKey: [ACCOUNT_SNAPSHOT_KEY, address],
      queryFn: () => fetchAccountSnapshot(address),
      enabled: active && i < released,
      staleTime: 10_000,
      gcTime: 5 * 60_000,
    })),
  });
  const settled = results.slice(0, released).filter(r => !r.isFetching && (r.isSuccess || r.isError)).length;
  useEffect(() => {
    const next = Math.min(addresses.length, settled + ROW_WINDOW);
    if (next > released) {
      setReleased(next);
    }
  }, [settled, addresses.length, released]);
  const rows: Record<string, RowBalance> = {};
  addresses.forEach((address, i) => {
    const r = results[i];
    if (r?.isError) {
      // a failed (re-)read never shows the older figure as current: none beats a stale one
      rows[address] = {state: 'failed'};
    } else if (r?.data) {
      rows[address] = {state: 'ready', data: r.data, at: r.dataUpdatedAt};
    } else {
      rows[address] = {state: 'not-checked'};
    }
  });
  return rows;
}
