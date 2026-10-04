import {test, expect} from '@playwright/test';
import {contained, launchPopup} from './popupHarness';
import {msg, realWallet, startSend} from './sendHelpers';

// Spec B1b-2a §8.5, plan 3: spec 5 — a send the network never sees: #21 → #54 at 90 s, "Send again" re-sends the
// SAME signed bytes (D23), and only once its blockhash has expired (two null full-history checks) is a new
// attempt offered. The popup runs on Playwright's clock so its 90 s pass at once; the background keeps real time.

test('5 · stuck → send again (the same bytes) → expire: #21 → #54 at 90 s, one re-send of the same transaction, "Not confirmed — no funds moved.", [Try again] prepares anew', async () => {
  const h = await launchPopup('noctura-e2e-stuck-');
  try {
    h.fake.mode = 'expire';
    await realWallet(h, {known: true});
    // Playwright's clock in the popup, so its 90 s can pass at once; the background keeps real time.
    const popup = await startSend(h, '0.01', {firstTime: false, clock: true});
    await popup.getByRole('button', {name: 'Continue to confirm'}).click();
    await popup.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    await expect(popup.getByText('Broadcasting transaction…')).toBeVisible({timeout: 30_000});
    expect(h.fake.broadcastWires).toHaveLength(1);
    const first = h.fake.broadcastWires[0];
    const signature = h.fake.broadcasts[0];
    const created = (await msg(popup, {type: 'wallet.pending'})).data as {createdAt: number}[];
    const createdAt = created[0]?.createdAt ?? 0;
    // The popup's clock paused, so each of #21's timed states holds while it is asserted, its counters exact. 80 s:
    // "Taking longer than usual", 10 s to the recovery options; 89 s: still #21, 1 s left; 90 s: #54.
    await popup.clock.pauseAt(createdAt + 80_000);
    await expect(popup.getByText('Taking longer than usual')).toBeVisible();
    await expect(popup.getByText('Waiting · 1 m 20 s')).toBeVisible();
    await expect(popup.locator('.stuck-watch .countdown')).toHaveText('10 s');
    await popup.clock.fastForward(9_000);
    await expect(popup.getByText('Waiting · 1 m 29 s')).toBeVisible();
    await expect(popup.locator('.stuck-watch .countdown')).toHaveText('01 s');
    await expect(popup.getByText('Transaction stuck')).toHaveCount(0);
    await popup.clock.fastForward(1_000);
    await expect(popup.getByText('Transaction stuck')).toBeVisible();
    await expect(popup.locator('.pending-counter .time')).toHaveText('01:30');
    await expect(popup.getByText('Speed up')).toHaveCount(0);
    await expect(popup.getByText('Cancel with replacement')).toHaveCount(0);
    // From here every state is held by the fake (the network never sees the transaction; the height moves only
    // when the test moves it): the popup's clock runs again, for its 2 s reads of the record.
    await popup.clock.resume();
    // The engine refuses a re-send within 2 s of the last one (real time): wait it out, then one tap.
    await popup.waitForTimeout(2_500);
    await popup.getByRole('button', {name: 'Send again (same transaction)'}).click();
    await expect(popup.getByText('The same transaction was sent to the network again. Its signature is unchanged, so only one copy can land.')).toBeVisible({timeout: 30_000});
    // The same signed bytes twice, and nothing else.
    expect(h.fake.broadcastWires).toEqual([first, first]);
    // Nothing has asked the full history yet: the checks below are the expiry's, caused by the height moved here.
    expect(h.fake.historyChecks).toEqual([]);
    // Past the blockhash's life with margin: two null full-history checks ≥ 2 s apart, then expired.
    const pending = (await msg(popup, {type: 'wallet.pending'})).data as {lastValidBlockHeight: number}[];
    h.fake.blockHeight = (pending[0]?.lastValidBlockHeight ?? 0) + 33;
    await expect(popup.getByText('Not confirmed — no funds moved.')).toBeVisible({timeout: 45_000});
    await expect(popup.getByText('Its blockhash expired and two checks found it on no block. You can now make a new attempt.')).toBeVisible();
    // Offered only after two null checks of this signature, at least 2 s apart — never after one.
    const checks = h.fake.historyChecks.filter(c => c.signature === signature);
    expect(checks.length).toBeGreaterThanOrEqual(2);
    expect((checks.at(-1)?.at ?? 0) - (checks[0]?.at ?? 0)).toBeGreaterThanOrEqual(2_000);
    expect(h.fake.historyChecks.map(c => c.signature)).toEqual(checks.map(c => c.signature));
    expect(h.fake.broadcastWires).toEqual([first, first]);
    // [Try again] → #19 with the same intent: a fresh prepare (a new simulation, a new blockhash).
    const simulations = h.fake.simulations.length;
    const blockhashes = h.fake.hits.filter(x => x.rpcMethod === 'getLatestBlockhash').length;
    await popup.getByRole('button', {name: 'Try again'}).click();
    await expect(popup.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
    await expect(popup.locator('.delta-row').first()).toHaveText('Sending− 0.0100 SOL');
    expect(h.fake.simulations.length).toBe(simulations + 1);
    expect(h.fake.hits.filter(x => x.rpcMethod === 'getLatestBlockhash').length).toBeGreaterThan(blockhashes);
    // Nothing more was sent: a new attempt starts at #19, and only a tap on #20 sends it.
    expect(h.fake.broadcastWires).toEqual([first, first]);
    contained(h);
  } finally {
    await h.close();
  }
});
