import {showExact} from '../send/rules';
import {showUsd} from '../format';
import type {KindRecord, PresaleSlots} from '../router';
import {PURCHASE_KIND, presaleClient, purchaseDataOf} from './client';
import {BANNER_TEXT, CONFIRM_PURCHASE_TEXT, RECORD_TEXT, REFER_TEXT, priceText} from './text';
import {againRoute} from './routes';

/**
 * B1d §1.3, §4.2, §4.5: the presale entry's slots. `record` gives #21, #44 and #54 — and #11's and #26's pending rows
 * (Q33) — the words for the wallet's own purchase: a record of kind `presale-buy` whose §2.3 data reads back
 * (`purchaseDataOf`, every field strictly); any other kind, or data that does not read back, is null and the screen
 * shows it generically (Q42), never from partial data. Display only: what was paid, as the background recorded it.
 * `resume` is §4.2's resume paths: `presale.preparedFor` for the account, and #20's purchase variant (`resume`) for a
 * prepared purchase. `banner` and `buy` are #11's (§4.5): the banner as `presale.banner` answered it (no geo check;
 * null for any failure or an inactive sale), and Buy's routing from a fresh `presale.view` — an open purchase or an open
 * sale → #23, the gate closed → #50b, anything else → no route. `settings` is #31's row into #24 (B1d-2, C16).
 * `historyBadge` is #26's Q31 on every purchase row, and `unrecorded` #27's Q34 (B1d-2, §4.6): shown only while
 * `presale.unrecorded` lists the signature for that account — a failed read shows nothing (a display only).
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
      pending: RECORD_TEXT.pending,
      slow: RECORD_TEXT.slow,
      amount: `${amount} ${data.currency}`,
      to: CONFIRM_PURCHASE_TEXT.presale,
      // Display only: the dollars the program counted for it (§2.3's spentCents), as #20 showed them.
      card: {lead: RECORD_TEXT.lead, figure: amount, ticker: data.currency, usd: showUsd(Number(data.spentCents) / 100)},
      // C17: #21's Done after a purchase returns to #23.
      done: {screen: 'presale'},
      again: againRoute({currency: data.currency, amount: data.amount.toString(), code: null, challengeId: null}),
    };
  },
  async resume(engine, account) {
    const r = await presaleClient(engine).preparedFor(account);
    return r.ok && r.data !== null ? {screen: 'presale-confirm', account, entry: 'resume'} : null;
  },
  async banner(engine) {
    const r = await presaleClient(engine).banner();
    if (!r.ok || r.data === null) return null;
    return {title: BANNER_TEXT.title(r.data.stage + 1), line: BANNER_TEXT.line(priceText(r.data.priceTicks), r.data.stagePercent)};
  },
  async buy(engine, account) {
    const r = await presaleClient(engine).view(account);
    if (!r.ok) return null;
    const v = r.data;
    // C30: an open purchase is #23 (23b) whatever the answer says; then an open sale.
    if (v.pending !== null || v.open) return {screen: 'presale'};
    return v.why === 'geo' ? {screen: 'geo'} : null;
  },
  settings: {group: REFER_TEXT.group, title: REFER_TEXT.title, route: {screen: 'referral'}},
  historyBadge: RECORD_TEXT.badge,
  async unrecorded(engine, account, signature) {
    const r = await presaleClient(engine).unrecorded(account);
    return r.ok && r.data.includes(signature) ? RECORD_TEXT.unrecorded : null;
  },
};
