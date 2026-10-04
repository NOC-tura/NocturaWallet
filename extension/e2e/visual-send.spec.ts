import {test, expect, type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {contained, launchPopup} from './popupHarness';
import {E2E_PASSWORD} from './makeEnvelope';
import {ACCOUNT, RECIPIENT, msg, realWallet} from './sendHelpers';

// Spec B1b-2a §8.6, plan 3: every send-flow state the real extension can be driven to, at 412 × 600 (the popup) —
// the UI tab's #20 after #10 at the same width — saved for the review against the design (index.html #s12, #s43,
// #s19, #s20, #s21, #s54, #s44, #s10). Not a pixel diff: an opus-tier reviewer compares each image with the
// mockup of the same state using the checklist in the plan. Every shot asserts its own copy first; a transient
// state is held open by the fake (hold) or shot under the popup's paused clock. Screenshots are CI artifacts.
const DIR = 'test-results/visual';
const shot = async (page: Page, name: string, end = false) => {
  mkdirSync(DIR, {recursive: true});
  await page.screenshot({path: `${DIR}/${name}.png`});
  if (!end) return;
  await page.locator('main.app-content').evaluate(e => e.scrollTo(0, e.scrollHeight));
  await page.screenshot({path: `${DIR}/${name}-end.png`});
  await page.locator('main.app-content').evaluate(e => e.scrollTo(0, 0));
};
const toSend = async (p: Page) => {
  await expect(p.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
  await p.getByRole('button', {name: 'Send', exact: true}).click();
  await expect(p.getByLabel('Recipient', {exact: true})).toBeVisible();
};
const fill = async (p: Page, recipient: string, amount: string) => {
  await p.getByLabel('Recipient', {exact: true}).fill(recipient);
  await p.getByLabel('Amount').fill(amount);
};
/** #19's Cancel discards first, then shows #12: wait for #12 before the next step. */
const cancelToSend = async (p: Page) => {
  await p.getByRole('button', {name: 'Cancel'}).click();
  await expect(p.getByLabel('Recipient', {exact: true})).toBeVisible();
};
const review = async (p: Page) => {
  await p.locator('.sticky-bar button').click();
  await expect(p.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
};

test('visual: #11 with Send, #12’s states, #43, #19’s states', async () => {
  const h = await launchPopup('noctura-e2e-visual-send-');
  try {
    await realWallet(h);
    const p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
    await expect(p.locator('.quick .qa .lbl')).toHaveText(['Send', 'Receive']);
    await expect(p.getByText('Connected · syncing')).toHaveCount(0);
    await shot(p, '11-loaded-send');
    await p.getByRole('button', {name: 'Send', exact: true}).click();
    await expect(p.getByText('Set automatically — shown on the next step')).toBeVisible();
    await expect(p.getByLabel('Recipient', {exact: true})).toHaveAttribute('placeholder', 'Solana address');
    await shot(p, '12-idle');
    await p.getByLabel('Recipient', {exact: true}).fill('7xKXtgZASfW87dQQQbadinput123');
    await expect(p.getByText('Not a valid Solana address — check length & characters')).toBeVisible();
    await shot(p, '12-invalid-recipient');
    await p.getByRole('button', {name: 'Clear recipient'}).click();
    await p.getByRole('button', {name: 'Token: SOL'}).click();
    await expect(p.getByRole('dialog', {name: 'Choose a token'})).toBeVisible();
    await expect(p.locator('.app-token-row .amt')).toHaveText(['10.0000', '1,000.00', '0.00', '0.00']);
    await shot(p, '43-default');
    await p.getByRole('dialog', {name: 'Choose a token'}).getByText('Solana').click();
    await fill(p, RECIPIENT, '0.5');
    await expect(p.getByText('First-time recipient')).toBeVisible();
    await expect(p.locator('.available')).toHaveText('≈ $75.00 · 5% of balance — re-auth required');
    await shot(p, '12-first-time', true);
    await p.getByLabel('Amount').fill('75');
    await expect(p.getByText(/Insufficient balance — short by/)).toBeVisible();
    await shot(p, '12-insufficient');
    await p.getByRole('button', {name: 'MAX'}).click();
    await expect(p.getByText('MAX keeps 0.00089 SOL so the account stays open, plus the network fee.')).toBeVisible();
    await shot(p, '12-max');
    // #19 simulating, held open by the fake.
    await p.getByLabel('Amount').fill('0.01');
    const release = h.fake.hold();
    await p.locator('.sticky-bar button').click();
    await expect(p.getByText('Simulating on Solana mainnet')).toBeVisible();
    await expect(p.getByRole('button', {name: 'Simulating…'})).toBeDisabled();
    await shot(p, '19-simulating');
    release();
    await expect(p.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
    await expect(p.getByText('Recipient is a regular wallet')).toBeVisible();
    await shot(p, '19-ready', true);
    await cancelToSend(p);
    // #19 failed: the network would reject it.
    h.fake.simulateError = true;
    await p.locator('.sticky-bar button').click();
    await expect(p.getByText('The network would reject this transfer')).toBeVisible({timeout: 30_000});
    await expect(p.getByText('Continue to confirm')).toHaveCount(0);
    await shot(p, '19-failed-simulation');
    h.fake.simulateError = false;
    await cancelToSend(p);
    // #19 failed: a remainder below the rent minimum (refused before simulating).
    await p.getByLabel('Amount').fill('9.9999');
    await p.locator('.sticky-bar button').click();
    await expect(p.getByText('This would leave less than 0.00089088 SOL in your account, which Solana does not allow. Send less, so at least that much stays.')).toBeVisible({timeout: 30_000});
    await expect(p.getByRole('button', {name: 'Retry simulation'})).toHaveCount(0);
    await shot(p, '19-failed-rent');
    await cancelToSend(p);
    // #19 failed: the server gives no answer.
    h.fake.network = 'unreachable';
    await p.getByLabel('Amount').fill('0.01');
    await p.locator('.sticky-bar button').click();
    await expect(p.getByText('No answer from the Noctura server within 20 s.')).toBeVisible({timeout: 30_000});
    await expect(p.getByText('Cannot verify recipient type')).toBeVisible();
    await shot(p, '19-failed-unreachable');
    h.fake.network = 'ok';
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: #20’s states — first-time, high-value, the proof in #10 with its priority row, confirmed, the quote expired', async () => {
  const h = await launchPopup('noctura-e2e-visual-confirm-');
  try {
    await realWallet(h);
    const p = await h.openPopup();
    await toSend(p);
    await fill(p, RECIPIENT, '0.01');
    await review(p);
    await p.getByRole('button', {name: 'Continue to confirm'}).click();
    await expect(p.getByText("You've never sent to this address")).toBeVisible();
    await expect(p.getByText('Confirmation opens in a new tab.')).toBeVisible();
    await shot(p, '20-first-time', true);
    await p.getByRole('button', {name: 'Back'}).click();
    await expect(p.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
    await cancelToSend(p);
    await p.getByLabel('Amount').fill('1');
    await review(p);
    await p.getByRole('button', {name: 'Continue to confirm'}).click();
    await expect(p.getByText('High-value transfer')).toBeVisible();
    await expect(p.getByText("You'll confirm with your password (or passkey) in a new tab before this is sent.")).toBeVisible();
    await shot(p, '20-high-value', true);
    // The proof: #10 in a new tab, its fee rows as §4.5 defines them (the priority row, plan 3 carry 1).
    const opened = h.ctx.waitForEvent('page');
    await p.getByRole('button', {name: 'Send 1.0000 SOL'}).click();
    const tab = await opened;
    await tab.setViewportSize({width: 412, height: 916});
    await expect(tab.locator('#ra-rows .intent-row .label')).toHaveText(['To', 'Network fee', 'Priority', 'No Noctura fee (status unknown)'], {timeout: 30_000});
    mkdirSync(DIR, {recursive: true});
    await tab.screenshot({path: `${DIR}/10-idle-priority.png`, fullPage: true});
    await tab.fill('#ra-password', E2E_PASSWORD);
    await tab.click('#ra-confirm');
    await expect(tab.getByText('Confirmed. Review the fresh quote and send.')).toBeVisible({timeout: 60_000});
    await tab.setViewportSize({width: 412, height: 600});
    await shot(tab, '20-confirmed', true);
    await tab.close();
    // The quote ends untouched, on a popup whose clock runs ahead: one automatic re-prepare, then "Quote expired —
    // refresh" (C5). Shot and closed: a page whose clock is ahead of the background's cannot take a fresh quote.
    const q = await h.openPopup({clock: true});
    await expect(q.getByText('Confirmed. Review the fresh quote and send.')).toBeVisible({timeout: 30_000});
    await q.clock.fastForward(31_000);
    await expect(q.getByText('Updated with a fresh network quote')).toBeVisible({timeout: 30_000});
    await q.clock.fastForward(31_000);
    await expect(q.getByText('Quote expired — refresh')).toBeVisible({timeout: 30_000});
    await expect(q.getByRole('button', {name: 'Refresh'})).toBeVisible();
    await shot(q, '20-quote-expired', true);
    expect(h.fake.broadcasts).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: #21 and #54 — broadcasting, slow, stuck, sending again, sent again, expired; success; the popup’s resume; #26’s pending row', async () => {
  const h = await launchPopup('noctura-e2e-visual-status-');
  try {
    await realWallet(h, {known: true});
    // Success first, on the real clock: Playwright's clock is the whole context's, so every page after a
    // clock popup runs ahead of the background and cannot take a quote.
    h.fake.mode = 'confirm';
    const r = await h.openPopup();
    await toSend(r);
    await fill(r, RECIPIENT, '0.01');
    await review(r);
    await r.getByRole('button', {name: 'Continue to confirm'}).click();
    await r.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    await expect(r.getByText('Sent successfully')).toBeVisible({timeout: 30_000});
    await shot(r, '21-success', true);
    await r.close();
    h.fake.mode = 'expire';
    // #20 resumed on popup open (a prepared send waiting).
    const prep = await h.openPopup();
    await expect(prep.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
    expect((await msg(prep, {type: 'wallet.prepareSend', account: ACCOUNT, intent: {token: 'SOL', recipient: RECIPIENT, amount: '10000000'}})).ok).toBe(true);
    await prep.close();
    const p = await h.openPopup({clock: true});
    await expect(p.getByText('You have a send waiting.')).toBeVisible({timeout: 30_000});
    await shot(p, '20-resume');
    await p.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    await expect(p.getByText('Broadcasting transaction…')).toBeVisible({timeout: 30_000});
    await shot(p, '21-broadcasting', true);
    await p.clock.fastForward(83_000);
    await expect(p.getByText('Taking longer than usual')).toBeVisible();
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 500));
    await shot(p, '21-slow', true);
    await p.clock.resume();
    await p.clock.fastForward(8_000);
    await expect(p.getByText('Transaction stuck')).toBeVisible();
    await shot(p, '54-stuck', true);
    // #26's pending row, from a second popup.
    const other = await h.openPopup();
    await other.getByRole('button', {name: 'Activity'}).click();
    await expect(other.getByText('PENDING')).toBeVisible({timeout: 30_000});
    await shot(other, '26-pending-row');
    await other.close();
    // Sending again, held open by the fake; then sent again.
    await p.waitForTimeout(2_500);
    const release = h.fake.hold();
    await p.getByRole('button', {name: 'Send again (same transaction)'}).click();
    await expect(p.getByText('Re-sending the same transaction.')).toBeVisible();
    await shot(p, '54-sending-again');
    release();
    await expect(p.getByText('The same transaction was sent to the network again. Its signature is unchanged, so only one copy can land.')).toBeVisible({timeout: 30_000});
    await shot(p, '54-sent-again');
    const pending = (await msg(p, {type: 'wallet.pending'})).data as {lastValidBlockHeight: number}[];
    h.fake.blockHeight = (pending[0]?.lastValidBlockHeight ?? 0) + 33;
    await expect(p.getByText('Not confirmed — no funds moved.')).toBeVisible({timeout: 45_000});
    await shot(p, '54-expired');
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: #44 — blockhash expired, rejected by the program, refused by the route; #11’s cancelled toast', async () => {
  const h = await launchPopup('noctura-e2e-visual-failed-');
  try {
    await realWallet(h, {known: true});
    const send = async (p: Page) => {
      await toSend(p);
      await fill(p, RECIPIENT, '0.01');
      await review(p);
      await p.getByRole('button', {name: 'Continue to confirm'}).click();
      await p.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    };
    // Refused by the route before forwarding: network-error.
    h.fake.broadcastReject = true;
    const a = await h.openPopup();
    await send(a);
    await expect(a.getByText("Couldn't send")).toBeVisible({timeout: 30_000});
    await expect(a.getByText('Reason · network-error')).toBeVisible();
    await shot(a, '44-network-error');
    h.fake.broadcastReject = false;
    await a.close();
    // Landed with an error: rejected-by-program.
    h.fake.mode = 'fail';
    const b = await h.openPopup();
    await send(b);
    await expect(b.getByText('Program rejected the transaction')).toBeVisible({timeout: 30_000});
    await shot(b, '44-rejected-by-program', true);
    await b.close();
    // Never seen, past its blockhash before #54 showed: blockhash-expired.
    h.fake.mode = 'expire';
    const c = await h.openPopup();
    await send(c);
    await expect(c.getByText('Broadcasting transaction…')).toBeVisible({timeout: 30_000});
    const pending = (await msg(c, {type: 'wallet.pending'})).data as {lastValidBlockHeight: number; state: string}[];
    h.fake.blockHeight = (pending.find(r => r.state === 'pending')?.lastValidBlockHeight ?? 0) + 33;
    await expect(c.getByText('Recent blockhash expired')).toBeVisible({timeout: 45_000});
    await shot(c, '44-blockhash-expired', true);
    await c.close();
    // #11's cancelled toast after #20's Cancel, under a paused clock (1.8 s).
    h.fake.mode = 'confirm';
    const e = await h.openPopup({clock: true});
    await toSend(e);
    await fill(e, RECIPIENT, '0.01');
    await review(e);
    await e.getByRole('button', {name: 'Continue to confirm'}).click();
    await e.clock.pauseAt(await e.evaluate(() => Date.now() + 1_000));
    await e.getByRole('button', {name: 'Cancel'}).click();
    await expect(e.getByText('Transaction cancelled. No fees charged.')).toBeVisible();
    await shot(e, '44-user-cancelled-toast');
    contained(h);
  } finally {
    await h.close();
  }
});
