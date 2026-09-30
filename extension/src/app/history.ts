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

/**
 * An own account's label, for "to Your account: Savings" (spec §3 labels); otherwise the address, short.
 * `mono`: the line shows an address, which the design sets in `noc-mono` (index.html 11796, 11804).
 */
function counterpartyText(address: string | null, accounts: readonly Account[]): {text: string; mono: boolean} {
  if (address === null) return {text: 'an unknown address', mono: false};
  const own = accounts.find(a => a.publicKey === address);
  return own === undefined ? {text: shortAddress(address), mono: true} : {text: `Your account: ${own.name}`, mono: false};
}

const MINUS = '−';

/**
 * A row's icon circle (index.html 26b): tinted per type, or `plain` — the design's neutral no-funds row
 * (`.ic` with #i-doc, 11845) — for a transaction that moved nothing to or from this account.
 */
export type RowTone = 'send' | 'recv' | 'swap' | 'fail' | 'plain';

/**
 * One #26 row's words: title, meta (before the time), amount, its tone, and whether the meta shows an
 * address (the design sets those lines in `noc-mono`, 11796/11804; a label or words stay in the body face).
 */
export function rowText(item: HistoryItem, accounts: readonly Account[]): {title: string; meta: string; amount: string; tone: RowTone; mono: boolean} {
  if (item.failed) {
    // The engine decodes a failed transaction as `other` with no token (core/solana/history.ts): the
    // kind and token of what was attempted are not known here.
    const what = item.kind === 'other' || item.token === null ? 'transaction' : `${item.kind} ${item.token}`;
    return {title: `Failed · ${what}`, meta: 'the network fee was charged', amount: '—', tone: 'fail', mono: false};
  }
  const amount = (sign: string) => (item.amount === null || item.token === null ? '—' : `${sign}${showAmount(item.token, item.amount)}`);
  switch (item.kind) {
    case 'sent': {
      const c = counterpartyText(item.counterparty, accounts);
      return {title: `Sent ${item.token ?? ''}`.trim(), meta: `to ${c.text}`, amount: amount(MINUS), tone: 'send', mono: c.mono};
    }
    case 'received': {
      const c = counterpartyText(item.counterparty, accounts);
      return {title: `Received ${item.token ?? ''}`.trim(), meta: `from ${c.text}`, amount: amount('+'), tone: 'recv', mono: c.mono};
    }
    case 'purchase':
      // The design has no purchase row: it follows 26b's swap row (a trade, NOC for SOL or a stablecoin),
      // `.ic.swap` with #i-swap — declared in spec §6.2 Differs.
      return {title: 'Presale purchase', meta: 'NOC', amount: amount(MINUS), tone: 'swap', mono: false};
    case 'other':
      return {title: 'Other transaction', meta: 'no transfer to or from this account', amount: '—', tone: 'plain', mono: false};
  }
}
