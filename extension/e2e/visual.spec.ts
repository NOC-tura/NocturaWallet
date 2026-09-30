import {test, expect, type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {MAIN, SAVINGS, contained, launchPopup, seedUnlockedWallet} from './popupHarness';
import {COUNTERPARTY, failedTx, otherTx, presalePurchase, receivedUsdc, sentSol, sig} from './historyFixtures';

// Spec B1b-2a §8.6: every plan-1 state, rendered by the real popup at 412 × 600, saved for the review
// against the design (index.html #sNN). Not a pixel diff: a reviewer compares each image with the
// mockup of the same state using the checklist in the plan. Screenshots are CI artifacts, never committed.
const DIR = 'test-results/visual';
const shot = async (page: Page, name: string) => {
  mkdirSync(DIR, {recursive: true});
  await page.screenshot({path: `${DIR}/${name}.png`});
};

test('visual: the plan-1 screens and states at 412 × 600', async () => {
  const h = await launchPopup('noctura-e2e-visual-');
  try {
    // #9-derived locked screen.
    await seedUnlockedWallet(h.sw);
    await h.sw.evaluate(() => (globalThis as unknown as {chrome: {storage: {session: {clear(): Promise<void>}}}}).chrome.storage.session.clear());
    const locked = await h.openPopup();
    await expect(locked.getByText('Welcome back')).toBeVisible();
    await shot(locked, '09-locked');
    await locked.close();

    await seedUnlockedWallet(h.sw);
    const now = Math.floor(Date.now() / 1000);
    h.fake.history.set(MAIN.publicKey, [
      {signature: sig(1), tx: sentSol(MAIN.publicKey, SAVINGS.publicKey, 2_480_000_000, now - 60)},
      {signature: sig(2), tx: receivedUsdc(MAIN.publicKey, COUNTERPARTY, 250_000_000, now - 120)},
      {signature: sig(3), tx: presalePurchase(MAIN.publicKey, 1_000_000_000, now - 90_000)},
      {signature: sig(4), tx: otherTx(MAIN.publicKey, now - 200_000)},
      {signature: sig(5), tx: failedTx(MAIN.publicKey, now - 3_000_000)},
    ]);
    const p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true})).toBeVisible();
    await shot(p, '11-loaded');
    await p.getByRole('button', {name: 'Hide balance'}).click();
    await shot(p, '11-hidden-balance');
    await p.getByRole('button', {name: 'Show balance'}).click();

    await p.getByRole('button', {name: 'Accounts'}).click();
    await expect(p.getByRole('dialog', {name: 'Accounts'}).getByText('10.0000 SOL · $1,500.00').first()).toBeVisible();
    await shot(p, '43-account-switcher');
    await p.keyboard.press('Escape');

    await p.getByRole('button', {name: 'Receive'}).click();
    await expect(p.getByText('Public address')).toBeVisible();
    await shot(p, '13-plain-address');
    await p.getByRole('textbox', {name: 'Request amount'}).fill('2.48');
    await expect(p.locator('.pay-ribbon')).toBeVisible();
    await shot(p, '13-pay-request');
    await p.getByRole('button', {name: 'Back'}).click();

    await p.getByRole('button', {name: 'Activity'}).click();
    await expect(p.getByText('Sent SOL')).toBeVisible({timeout: 30_000});
    await shot(p, '26-loaded-mixed');
    await p.getByRole('tab', {name: 'Sent'}).click();
    await shot(p, '26-filter-sent');
    await p.getByRole('tab', {name: 'All'}).click();
    for (const [title, name] of [['Sent SOL', '27-transparent-send'], ['Received USDC', '27-received'], ['Failed · transaction', '27-failed'], ['Presale purchase', '27-purchase']] as const) {
      await p.getByText(title).click();
      await expect(p.getByText('Transaction', {exact: true})).toBeVisible();
      await shot(p, name);
      await p.getByRole('button', {name: 'Back'}).click();
    }

    await p.getByRole('button', {name: 'Settings'}).click();
    await shot(p, '31-settings-minimal');
    await p.getByText('About Noctura').click();
    await shot(p, '38-about');
    await p.close();

    // #41: an account with no history.
    const empty = await h.openPopup();
    await empty.getByRole('button', {name: 'Accounts'}).click();
    await empty.getByRole('dialog', {name: 'Accounts'}).getByText('Savings').click();
    await empty.getByRole('button', {name: 'Activity'}).click();
    await expect(empty.getByText('No activity yet')).toBeVisible({timeout: 30_000});
    await shot(empty, '41-empty');
    await empty.getByRole('button', {name: 'Home'}).click();
    await empty.getByRole('button', {name: 'Accounts'}).click();
    await empty.getByRole('dialog', {name: 'Accounts'}).getByText('Main').click();
    await empty.close();

    // #42 and D26.
    h.fake.network = 'unreachable';
    await h.ctx.setOffline(true);
    const off = await h.openPopup();
    await expect(off.getByText("You're offline")).toBeVisible();
    await shot(off, '42-just-disconnected');
    await off.getByRole('button', {name: 'Refresh'}).click();
    await expect(off.getByText("You're offline · Showing cached data")).toBeVisible();
    await shot(off, '42-sustained');
    h.fake.network = 'ok';
    await h.ctx.setOffline(false);
    await off.getByRole('button', {name: 'Refresh'}).click();
    await expect(off.getByText('Connected · syncing')).toBeVisible();
    await shot(off, '42-reconnecting');
    await off.close();
    h.fake.network = 'forbidden';
    const refused = await h.openPopup();
    await expect(refused.getByText('The server is not answering for now — try again in 10 minutes.')).toBeVisible();
    await shot(refused, '42-refused-d26');
    contained(h);
  } finally {
    await h.close();
  }
});
