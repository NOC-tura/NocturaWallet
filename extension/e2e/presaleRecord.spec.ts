import {test, expect, type Page} from '@playwright/test';
import {base58} from '@scure/base';
import type {Harness} from './popupHarness';
import {ACCOUNT, msg} from './sendHelpers';
import {nocText, solCents, tokensFor} from './presaleChain';
import {amount, armRecordAlarmAhead, buyAction, cspControl, done, heldRecord, home, presaleWallet, recordAlarm, recordEntries, scene, slotComes} from './presaleHelpers';

declare const chrome: {storage: {local: {get(k: string): Promise<Record<string, unknown>>; set(o: object): Promise<void>}}};

// B1d §6.3 E2E 10 (B1d-2 Task 6): the coordinator record of a confirmed purchase (§2.4, C24, D28–D30) in the real
// extension against the fake coordinator's scripted record route. A slot of C24's schedule is made to come without a
// browser clock (presaleHelpers.ts `heldRecord` / `slotComes`: the entry's schedule moved back, the record's own alarm
// fired). Every spec ends contained, with no CSP violation.

const SOL = 1_000_000_000n;
const Q34 = 'Recorded on chain; presale service not yet updated';
/** Q60 (rev 3.6): #27's line for a record the route refused (D29) — it will never be updated. */
const Q60 = 'Recorded on chain; the presale service declined to record it';
/** A returning buyer (no re-authentication for a small purchase): two purchases on chain. */
const RETURNING = {totalBase: 1_998_667_554_963n, spentCents: 30_000n, count: 2};
/** 0.1 SOL at the fake's $150: $15 — above the $10 minimum, 1 % of the balance. */
const LAMPORTS = SOL / 10n;
const NOC_BASE = tokensFor(solCents(LAMPORTS, 150), 0);
/** NOC as the coordinator's decimal number (D28: converted at the background's edge only). */
const nocNumber = (base: bigint): number => Number(`${base / SOL}.${(base % SOL).toString().padStart(9, '0')}`);
/** D28: the whole payload of a 0.1 SOL purchase at stage 1 by ACCOUNT. */
const payloadOf = (signature: string) => ({txHash: signature, buyerAddress: ACCOUNT, paymentToken: 'SOL', paymentAmount: '0.1', nocAmount: nocNumber(NOC_BASE), usdValue: 15, stage: 1});

/** #23 (open, its stage card read) → 0.1 SOL → #20 → Buy → #21 confirmed. The purchase's signature (the one broadcast since). */
async function buy(h: Harness, popup: Page): Promise<string> {
  const before = h.fake.broadcasts.length;
  await amount(popup, '0.1', nocText(NOC_BASE));
  await popup.locator('.sticky-bar button').click();
  await expect(popup.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
  await popup.getByRole('button', {name: 'Buy NOC'}).click();
  await expect(popup.locator('.stage-label')).toHaveText('Purchase confirmed', {timeout: 45_000});
  expect(h.fake.broadcasts).toHaveLength(before + 1);
  return h.fake.broadcasts[before] as string;
}

/** #26 → the purchase's row (`index`, newest first) → #27, read once (§4.6: one `presale.unrecorded` per open). Q34's and Q60's banners. */
async function openPurchase(h: Harness, index: number): Promise<{p: Page; q34: ReturnType<Page['locator']>; q60: ReturnType<Page['locator']>}> {
  const p = await h.openPopup();
  await p.getByRole('button', {name: 'Activity'}).click();
  const rows = p.locator('.tx-row', {hasText: 'Presale purchase'});
  await expect(rows.nth(index)).toBeVisible({timeout: 30_000});
  await rows.nth(index).click();
  await expect(p.locator('.s-txd .amount-card .eyebrow')).toHaveText('PRESALE PURCHASE', {timeout: 30_000});
  return {p, q34: p.locator('.s-txd .banner.info', {hasText: Q34}), q60: p.locator('.s-txd .banner.info', {hasText: Q60})};
}
/** The background's own answer for #27 (§1.4 `presale.unrecorded`, rev 3.6): the purchases it says Q34 or Q60 for, with their states. */
const unrecorded = async (p: Page) => (await msg(p, {type: 'presale.unrecorded', account: ACCOUNT})).data;

test('10 · recording: the record POST answered 500, then never answered (the timeout), then accepted at the third slot — each attempt the whole D28 payload; #27 says Q34 until it is accepted, and reopened it is gone', async () => {
  test.setTimeout(300_000);
  const {h, csp} = await scene('noctura-e2e-presale-record-');
  try {
    await presaleWallet(h, {allocation: RETURNING});
    h.fake.recordAnswers.push({status: 500, body: {success: false, error: 'connection terminated'}}, 'timeout');
    const popup = await home(h);
    await cspControl(popup, csp);
    await buyAction(popup).click();
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live', {timeout: 30_000});
    const signature = await buy(h, popup);

    // Slot 0 (at confirmation): the 500. The entry waits for its next slot, C24's 1 min after confirmation.
    const first = await heldRecord(h, signature, 1);
    expect(h.fake.purchaseRecords).toEqual([payloadOf(signature)]);
    expect(first.nextAt - first.confirmedAt).toBe(60_000);
    const due = await openPurchase(h, 0);
    await expect(due.q34).toBeVisible({timeout: 30_000});
    expect(await unrecorded(due.p)).toEqual([{signature, state: 'due'}]);
    await due.p.close();

    // Slot 1: the POST gets no answer — the extension's request times out (20 s); the next slot is 5 min.
    await slotComes(h, signature);
    const second = await heldRecord(h, signature, 2);
    expect(h.fake.purchaseRecords).toEqual([payloadOf(signature), payloadOf(signature)]);
    expect(second.nextAt - second.confirmedAt).toBe(5 * 60_000);
    const still = await openPurchase(h, 0);
    await expect(still.q34).toBeVisible({timeout: 30_000});
    await still.p.close();

    // Slot 2: accepted (200, success) — done; nothing is due, so the alarm is cleared.
    await slotComes(h, signature);
    await expect.poll(async () => (await recordEntries(h)).find(e => e.signature === signature)?.state, {timeout: 30_000}).toBe('done');
    expect(h.fake.purchaseRecords).toEqual([payloadOf(signature), payloadOf(signature), payloadOf(signature)]);
    const gone = await openPurchase(h, 0);
    expect(await unrecorded(gone.p)).toEqual([]);
    await expect(gone.p.locator('.s-txd .detail-card')).toBeVisible();
    await expect(gone.q34).toHaveCount(0);
    expect(h.fake.recordAnswers).toEqual([]);
    done(h, csp);
  } finally {
    await h.close();
  }
});

/** A well-formed signature for a seeded entry (64 bytes). */
const seededSignature = base58.encode(Uint8Array.from({length: 64}, (_, i) => (i * 7 + 3) % 251 || 1));

test('10 · D29 and D30: a 400 that is the route’s own refusal is final (refused — never POSTed again, #27 says Q60); a 200 that says verified: false (duplicate) is done (no line); a wake POSTs only what is due', async () => {
  test.setTimeout(300_000);
  const {h, csp} = await scene('noctura-e2e-presale-refused-');
  try {
    await presaleWallet(h, {allocation: RETURNING});
    h.fake.recordAnswers.push(
      {status: 400, body: {success: false, error: 'not_a_presale_purchase', reason: 'no_presale_instruction'}},
      {status: 200, body: {success: true, verified: false, duplicate: true, data: null}},
    );
    const popup = await home(h);
    await buyAction(popup).click();
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live', {timeout: 30_000});
    // Final review T6 M2: each purchase's record run is seen to END (presaleHelpers.ts armRecordAlarmAhead: the alarm
    // armed an hour ahead is cleared only by a run's last step), never only its entry's state — so the control below is
    // seeded with no run going, and only the alarm's wake can POST it.
    await armRecordAlarmAhead(h);
    const refused = await buy(h, popup);
    await expect.poll(async () => [(await recordEntries(h)).find(e => e.signature === refused)?.state, h.fake.purchaseRecords.length, await recordAlarm(h)], {timeout: 30_000}).toEqual(['refused', 1, undefined]);
    // Done → #23 (C17), the second purchase.
    await popup.getByRole('button', {name: 'Done'}).click();
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live', {timeout: 30_000});
    await armRecordAlarmAhead(h);
    const accepted = await buy(h, popup);
    await expect.poll(async () => [(await recordEntries(h)).find(e => e.signature === accepted)?.state, h.fake.purchaseRecords.length, await recordAlarm(h)], {timeout: 30_000}).toEqual(['done', 2, undefined]);
    expect(h.fake.purchaseRecords).toEqual([payloadOf(refused), payloadOf(accepted)]);

    // The control in the same wake: an entry due now (seeded, no run going) is POSTed; the refused and the done ones are
    // not. Read from the poll that waits for it: the whole record list and the entries at once, the fired alarm gone and
    // none armed again (nothing due). sendNext takes due entries in stored order, so a re-POST of either earlier entry
    // would come before the control's and never match.
    const control = {signature: seededSignature, account: ACCOUNT, payload: payloadOf(seededSignature), confirmedAt: Date.now(), attempts: 0, nextAt: Date.now(), state: 'due'};
    await h.sw.evaluate(async c => {
      const key = 'v1_presale_records';
      await chrome.storage.local.set({[key]: [...((await chrome.storage.local.get(key))[key] as unknown[]), c]});
    }, control);
    await slotComes(h, refused);
    await expect
      .poll(async () => [h.fake.purchaseRecords, (await recordEntries(h)).map(e => [e.signature, e.state, e.attempts]), await recordAlarm(h)], {timeout: 30_000})
      .toEqual([
        [payloadOf(refused), payloadOf(accepted), payloadOf(seededSignature)],
        [
          [refused, 'refused', 1],
          [accepted, 'done', 1],
          [seededSignature, 'done', 1],
        ],
        undefined,
      ]);

    // #27: Q60 for the refused purchase (D29: the purchase stands; the service declined it and never will record it), no
    // Q34 there, and no line for the done one.
    const kept = await openPurchase(h, 1);
    await expect(kept.q60).toBeVisible({timeout: 30_000});
    await expect(kept.q34).toHaveCount(0);
    expect(await unrecorded(kept.p)).toEqual([{signature: refused, state: 'refused'}]);
    await kept.p.close();
    const fine = await openPurchase(h, 0);
    await expect(fine.p.locator('.s-txd .detail-card')).toBeVisible();
    await expect(fine.p.locator('.s-txd .banner.info')).toHaveCount(0);
    done(h, csp);
  } finally {
    await h.close();
  }
});
