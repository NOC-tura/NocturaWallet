import {presaleSlots} from './presale';
import type {Pending} from './engine';
import type {KindRecord} from './router';

/**
 * B1d Q42 (C19, §1.3 "Screens that read intent"): the words for the wallet's own record of a kind this build cannot show
 * (`intent: null` — a purchase, while no kind renderer exists). Only the transaction's own facts go beside them: never an
 * amount, a recipient or anything from `extra.data`.
 */
export const GENERIC_TEXT = {
  pending: 'Transaction · pending',
  slow: 'Transaction · taking longer than usual',
  line: 'Transaction',
} as const;

/**
 * B1d §1.3: the words a record without an intent is shown with — its kind's, when the build's presale entry renders that
 * kind and its data reads back (§4.2, Q32), else null: the screen shows it generically (Q42). A send is never asked.
 */
export function kindRecord(p: Pick<Pending, 'intent' | 'extra'>): KindRecord | null {
  if (p.intent !== null || p.extra === null || presaleSlots === null) return null;
  return presaleSlots.record(p.extra);
}
