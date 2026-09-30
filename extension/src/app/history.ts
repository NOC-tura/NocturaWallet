import type {Account, HistoryItem} from './engine';
import {shortAddress, showAmount} from './format';

export type Filter = 'all' | 'sent' | 'received' | 'purchases';
export const FILTERS: readonly {value: Filter; text: string}[] = [
  {value: 'all', text: 'All'},
  {value: 'sent', text: 'Sent'},
  {value: 'received', text: 'Received'},
  {value: 'purchases', text: 'Purchases'},
];
export const isFilter = (x: string | null): x is Filter => x === 'all' || x === 'sent' || x === 'received' || x === 'purchases';

/** D24: the filters apply to the rows already loaded; "Load more" continues underneath. */
export function matches(item: HistoryItem, f: Filter): boolean {
  if (f === 'all') return true;
  if (item.failed) return false;
  if (f === 'sent') return item.kind === 'sent';
  if (f === 'received') return item.kind === 'received';
  return item.kind === 'purchase';
}

/** An own account's label, for "to Your account: Savings" (spec §3 labels). */
function counterpartyText(address: string | null, accounts: readonly Account[]): string {
  if (address === null) return 'an unknown address';
  const own = accounts.find(a => a.publicKey === address);
  return own === undefined ? shortAddress(address) : `Your account: ${own.name}`;
}

const MINUS = '−';

/** One #26 row's words: title, meta (before the time), amount, and its tone. */
export function rowText(item: HistoryItem, accounts: readonly Account[]): {title: string; meta: string; amount: string; tone: 'send' | 'recv' | 'swap' | 'fail'} {
  if (item.failed) {
    // The engine decodes a failed transaction as `other` with no token (core/solana/history.ts): the
    // kind and token of what was attempted are not known here.
    const what = item.kind === 'other' || item.token === null ? 'transaction' : `${item.kind} ${item.token}`;
    return {title: `Failed · ${what}`, meta: 'the network fee was charged', amount: '—', tone: 'fail'};
  }
  const amount = (sign: string) => (item.amount === null || item.token === null ? '—' : `${sign}${showAmount(item.token, item.amount)}`);
  switch (item.kind) {
    case 'sent':
      return {title: `Sent ${item.token ?? ''}`.trim(), meta: `to ${counterpartyText(item.counterparty, accounts)}`, amount: amount(MINUS), tone: 'send'};
    case 'received':
      return {title: `Received ${item.token ?? ''}`.trim(), meta: `from ${counterpartyText(item.counterparty, accounts)}`, amount: amount('+'), tone: 'recv'};
    case 'purchase':
      return {title: 'Presale purchase', meta: 'NOC', amount: amount(MINUS), tone: 'swap'};
    case 'other':
      return {title: 'Other transaction', meta: 'no transfer to or from this account', amount: '—', tone: 'swap'};
  }
}
