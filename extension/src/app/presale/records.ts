import {showExact} from '../send/rules';
import type {KindRecord, PresaleSlots} from '../router';
import {PURCHASE_KIND, presaleClient, purchaseDataOf} from './client';
import {CONFIRM_PURCHASE_TEXT, RECORD_TEXT} from './text';
import {againRoute} from './routes';

/**
 * B1d §1.3, §4.2: the presale entry's slots. `record` gives #21, #44 and #54 the words for the wallet's own purchase —
 * a record of kind `presale-buy` whose §2.3 data reads back (`purchaseDataOf`, every field strictly); any other kind, or
 * data that does not read back, is null and the screen shows it generically (Q42), never from partial data. Display
 * only: what was paid, as the background recorded it. `resume` is §4.2's resume paths: `presale.preparedFor` for the
 * account, and #20's purchase variant (`resume`) for a prepared purchase.
 */
export const PRESALE_SLOTS: PresaleSlots = {
  record(extra): KindRecord | null {
    if (extra.kind !== PURCHASE_KIND) return null;
    const data = purchaseDataOf(extra.data);
    if (data === undefined) return null;
    const amount = showExact(data.currency, data.amount);
    return {
      line: RECORD_TEXT.line(amount, data.currency),
      badge: RECORD_TEXT.badge,
      sending: RECORD_TEXT.sending,
      sent: RECORD_TEXT.sent,
      sentOk: RECORD_TEXT.sentOk,
      rejectedSub: RECORD_TEXT.rejectedSub,
      amount: `${amount} ${data.currency}`,
      to: CONFIRM_PURCHASE_TEXT.presale,
      // C17: #21's Done after a purchase returns to #23.
      done: {screen: 'presale'},
      again: againRoute({currency: data.currency, amount: data.amount.toString(), code: null, challengeId: null}),
    };
  },
  async resume(engine, account) {
    const r = await presaleClient(engine).preparedFor(account);
    return r.ok && r.data !== null ? {screen: 'presale-confirm', account, entry: 'resume'} : null;
  },
};
