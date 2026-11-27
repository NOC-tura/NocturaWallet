/**
 * History spec (2026-11-26) §3.3, §3.4: the selected account's history for #26.
 *
 * THE KEY keeps the prefix #21 invalidates (`['txHistory', address]`,
 * TransactionStatusScreen.tsx) and holds the cluster and the address, so another account's or
 * another network's rows are never shown. The query's own fetch — on mount once it is stale, on
 * pull-to-refresh, after an invalidation — is `loadHistory(…, 'head')`: the first page, or the
 * refresh that puts new rows on top. Its `staleTime` is 60 s because a refresh can cost up to 25
 * signature calls. "Load older" asks the session for the next page and writes the answer into the
 * same cache entry.
 *
 * AN ACCOUNT SWITCH drops every other account's session together with its cache entry: the two
 * are only ever dropped together, so cached rows are never continued by a session that started over.
 */
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {NETWORK} from '../constants/programs';
import {getConnection} from '../modules/solana/connection';
import {activityContext} from '../modules/solana/activityContext';
import {loadHistory} from '../modules/solana/history';
import type {HistorySnapshot} from '../modules/solana/history';
import {HISTORY_PAGE_SIZE, dropHistorySessionsExcept} from '../modules/solana/historySession';

export const HISTORY_STALE_MS = 60_000;

export const historyQueryKey = (account: string | null): readonly [string, string | null, string, number] => ['txHistory', account, NETWORK, HISTORY_PAGE_SIZE];

/**
 * Two loadHistory calls for one account never overlap: each takes its "rows before" at the start,
 * so a second one begun mid-flight would share a stale set. "Load older" during a refetch (or the
 * reverse) waits its turn here; a call always settles (every chain call has a time limit).
 */
const turns = new Map<string, Promise<unknown>>();
function inTurn<T>(account: string, fn: () => Promise<T>): Promise<T> {
  const previous = turns.get(account) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  const tail = next.catch(() => undefined);
  turns.set(account, tail);
  tail.then(() => {
    if (turns.get(account) === tail) {
      turns.delete(account);
    }
  });
  return next;
}

export interface ActivityHistory {
  data: HistorySnapshot | undefined;
  /** a first read completed (the list may be empty) */
  isSuccess: boolean;
  /** the last read failed; `data` keeps what was read before */
  isError: boolean;
  /** the first page, or the refresh once a page is loaded */
  refetch: () => Promise<unknown>;
  /** the next page; resolves to the new snapshot, or null when it could not be read or nothing was started */
  loadOlder: () => Promise<HistorySnapshot | null>;
  loadingOlder: boolean;
}

export function useActivityHistory(account: string | null): ActivityHistory {
  const client = useQueryClient();
  const queryKey = useMemo(() => historyQueryKey(account), [account]);
  const env = useCallback(() => ({connection: getConnection(), client, cluster: NETWORK, context: activityContext}), [client]);

  useEffect(() => {
    dropHistorySessionsExcept(account);
    client.removeQueries({predicate: q => q.queryKey[0] === 'txHistory' && q.queryKey[1] !== account});
  }, [account, client]);

  const query = useQuery<HistorySnapshot>({
    queryKey,
    queryFn: () => {
      if (account === null) {
        throw new Error('No account');
      }
      return inTurn(account, () => loadHistory(account, 'head', env()));
    },
    enabled: account !== null,
    staleTime: HISTORY_STALE_MS,
  });

  const olderRef = useRef(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const accountRef = useRef(account);
  accountRef.current = account;
  const loadOlder = useCallback(async (): Promise<HistorySnapshot | null> => {
    if (account === null || olderRef.current) {
      return null;
    }
    olderRef.current = true;
    setLoadingOlder(true);
    try {
      const snapshot = await inTurn(account, () => loadHistory(account, 'older', env()));
      if (accountRef.current !== account) {
        return null; // the account changed while the page was read: it is not this list's page
      }
      client.setQueryData(queryKey, snapshot);
      return snapshot;
    } catch {
      return null; // the rows already loaded stay; "Load older" can be tapped again
    } finally {
      olderRef.current = false;
      setLoadingOlder(false);
    }
  }, [account, client, env, queryKey]);

  return {
    data: query.data,
    isSuccess: query.isSuccess,
    isError: query.isError,
    refetch: query.refetch,
    loadOlder,
    loadingOlder,
  };
}
