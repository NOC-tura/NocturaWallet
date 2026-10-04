import {test, expect} from '@playwright/test';
import {contained, launchPopup} from './popupHarness';
import {E2E_PASSWORD} from './makeEnvelope';
import {ACCOUNT, OTHER_CHALLENGE, RECIPIENT, groups, msg, realWallet, sol, startSend} from './sendHelpers';

// Spec B1b-2a §8.5, plan 3: specs 4 and 11 (spec 5 in stuck.spec.ts) — the send flow in the real extension (popup, vault page, UI tab)
// against the contained fake coordinator. Every spec ends with contained(h): the fake saw the worker's requests,
// nothing unexpected, Solscan and every other noc-tura.io name never contacted. The sends are SOL: the fake
// models token accounts for the balances #43 shows, and no E2E sends a token (component tests cover SPL sends
// against the real background).

test('4 · send with re-authentication: #11 → #12 → #43 → #19 → #20 → #10 from the background → #20 confirmed, no broadcast → one tap → #21 — and a cancel on #10 discards', async () => {
  const h = await launchPopup('noctura-e2e-send-');
  try {
    await realWallet(h);
    const popup = await startSend(h, '0.01', {firstTime: true});
    // #19: the balance delta, and "After" from the fake's simulated state (fee included, as a node answers).
    const after = h.fake.simulatedPayerAfter.at(-1) ?? -1;
    expect(after).toBe(10_000_000_000 - 10_000_000 - 5_050);
    await expect(popup.locator('.delta-row').first()).toHaveText('Sending− 0.0100 SOL');
    await expect(popup.locator('.delta-row.app-after')).toHaveText(`After${sol(after)} SOL`);
    await popup.getByRole('button', {name: 'Continue to confirm'}).click();
    // #20: the first-time banner; the proof will be asked in a new tab.
    await expect(popup.getByText("You've never sent to this address")).toBeVisible();
    await expect(popup.getByText('Confirmation opens in a new tab.')).toBeVisible();
    expect(await groups(popup, '.headline')).toBe(RECIPIENT);
    const opened = h.ctx.waitForEvent('page');
    await popup.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    const tab = await opened;
    await tab.waitForURL(/unlock\.html\?mode=reauth&challenge=[0-9a-f]{32}$/);
    // #10 shows the amount and the whole recipient read from vault.challengeInfo — never from its URL.
    await expect(tab.locator('#ra-about')).toHaveText('You are about to send', {timeout: 30_000});
    await expect(tab.locator('#ra-amount')).toHaveText('0.0100');
    expect(await groups(tab, '#ra-rows')).toBe(RECIPIENT);
    // A crafted link with another (valid-looking) challenge id describes nothing.
    const crafted = await h.ctx.newPage();
    await crafted.goto(`chrome-extension://${h.id}/unlock.html?mode=reauth&challenge=${OTHER_CHALLENGE}`);
    await expect(crafted.locator('#ra-notice-line')).toHaveText('This confirmation has expired. Start the send again from the Noctura icon.', {timeout: 30_000});
    await crafted.close();
    expect(h.fake.broadcasts).toEqual([]);
    await tab.fill('#ra-password', E2E_PASSWORD);
    await tab.click('#ra-confirm');
    // D38: the same tab shows #20 confirmed with a fresh preview — and nothing is broadcast without a tap.
    await tab.waitForURL(`chrome-extension://${h.id}/wallet.html#/send/resume?account=${ACCOUNT}`, {timeout: 60_000});
    await expect(tab.getByText('Confirmed. Review the fresh quote and send.')).toBeVisible();
    // 10 s of quiet before the tap (fix round 1: 3 s let a self-send delayed by 4 s through).
    const quietUntil = Date.now() + 10_000;
    await expect.poll(async () => (h.fake.broadcasts.length > 0 ? 'sent' : Date.now() >= quietUntil ? 'quiet' : 'waiting'), {timeout: 20_000, intervals: [250]}).toBe('quiet');
    await tab.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    await expect(tab.getByText('Sent successfully')).toBeVisible({timeout: 30_000});
    await expect(tab.getByText('Done — open the Noctura icon any time.')).toBeVisible();
    // Exactly one broadcast, of one transaction.
    expect(h.fake.broadcasts).toHaveLength(1);
    expect(new Set(h.fake.broadcastWires).size).toBe(1);

    // A second run, cancelled on #10: the tab closes and nothing is left to resume (E7). 1 SOL is over 5 % of 10.
    const again = await startSend(h, '1', {firstTime: false});
    await again.getByRole('button', {name: 'Continue to confirm'}).click();
    const second = h.ctx.waitForEvent('page');
    await again.getByRole('button', {name: 'Send 1.0000 SOL'}).click();
    const cancelTab = await second;
    await expect(cancelTab.locator('#ra-cancel')).toHaveText('Cancel send', {timeout: 30_000});
    // The positive control: before the cancel, the send is prepared and waits for its proof.
    const ui = await h.ctx.newPage();
    await ui.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    const before = await msg(ui, {type: 'wallet.preparedFor', account: ACCOUNT});
    expect(before.ok).toBe(true);
    expect(before.data).not.toBeNull();
    const closed = cancelTab.waitForEvent('close');
    await cancelTab.click('#ra-cancel');
    await closed;
    expect(await msg(ui, {type: 'wallet.preparedFor', account: ACCOUNT})).toEqual({ok: true, data: null});
    expect(h.fake.broadcasts).toHaveLength(1);
    contained(h);
  } finally {
    await h.close();
  }
});

test('11 · #12’s recipient hints (E6): a first-time address shows design state 6; after a confirmed send to it, "Verified · sent before · today"', async () => {
  const h = await launchPopup('noctura-e2e-hints-');
  try {
    await realWallet(h);
    // The first-time state, then a confirmed send through the real flow: #20 → #10 → #20 confirmed → one tap.
    const popup = await startSend(h, '0.01', {firstTime: true});
    await popup.getByRole('button', {name: 'Continue to confirm'}).click();
    const opened = h.ctx.waitForEvent('page');
    await popup.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    const tab = await opened;
    await expect(tab.locator('#ra-about')).toHaveText('You are about to send', {timeout: 30_000});
    await tab.fill('#ra-password', E2E_PASSWORD);
    await tab.click('#ra-confirm');
    await expect(tab.getByText('Confirmed. Review the fresh quote and send.')).toBeVisible({timeout: 60_000});
    await tab.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    await expect(tab.getByText('Sent successfully')).toBeVisible({timeout: 30_000});
    // The same address on #12 now: known, with the day of its last confirmed send — and no first-time banner.
    const next = await h.openPopup();
    await next.getByRole('button', {name: 'Send', exact: true}).click();
    await next.getByLabel('Recipient', {exact: true}).fill(RECIPIENT);
    await expect(next.locator('.helper.ok')).toHaveText(/^\s*Verified · sent before · today$/);
    await expect(next.getByText('First-time recipient')).toHaveCount(0);
    await next.getByLabel('Amount').fill('0.01');
    await expect(next.locator('.sticky-bar button')).toHaveText('Send 0.01 SOL');
    contained(h);
  } finally {
    await h.close();
  }
});
