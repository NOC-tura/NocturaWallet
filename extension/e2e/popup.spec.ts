import {test, expect} from '@playwright/test';
import {MAIN, SAVINGS, contained, launchPopup, seedUnlockedWallet} from './popupHarness';
import {COUNTERPARTY, failedTx, otherTx, presalePurchase, receivedUsdc, sentSol, sig} from './historyFixtures';

// Spec B1b-2a §8.5, plan 1: specs 6–9, against the real popup and the contained fake coordinator.
const REFUSED = 'The server is not answering for now — try again in 10 minutes.';

test('6 · 403: the D26 banner, and no further coordinator request while it shows', async () => {
  const h = await launchPopup('noctura-e2e-403-');
  try {
    await seedUnlockedWallet(h.sw);
    h.fake.network = 'forbidden';
    const popup = await h.openPopup();
    await expect(popup.getByText(REFUSED)).toBeVisible();
    await expect(popup.getByRole('button', {name: 'Refresh'})).toBeDisabled();
    const seen = h.fake.hits.length;
    expect(seen).toBe(1); // the first read tripped the latch; everything after it was refused locally
    await popup.waitForTimeout(6_000); // past one 5 s wallet.state poll
    expect(h.fake.hits.length).toBe(seen);
    contained(h);
  } finally {
    await h.close();
  }
});

test('7 · offline: cached balances with #42, Receive still works (D36), then reconnecting → live', async () => {
  const h = await launchPopup('noctura-e2e-offline-');
  try {
    await seedUnlockedWallet(h.sw);
    const first = await h.openPopup();
    // 10 SOL × $150: an earlier good read fills the cache.
    await expect(first.getByText('$1,500', {exact: true})).toBeVisible();
    await first.close();

    // The server gives no answer. "Offline" is the browser's word only (review L3): with navigator
    // online the banner says the server could not be reached. (Inside an offline network namespace —
    // the plan's dry run — navigator itself is offline, and the banner rightly says so.)
    h.fake.network = 'unreachable';
    const quiet = await h.openPopup();
    const online = await quiet.evaluate(() => navigator.onLine);
    await expect(quiet.getByText(online ? 'Could not reach the Noctura server' : "You're offline", {exact: true})).toBeVisible();
    if (online) await expect(quiet.getByText("You're offline")).toHaveCount(0);
    await expect(quiet.getByText('10.0000 SOL · cached')).toBeVisible();
    await quiet.close();

    // The browser itself offline: the design's just-disconnected state.
    await h.ctx.setOffline(true);
    const offline = await h.openPopup();
    await expect(offline.getByText("You're offline")).toBeVisible();
    await expect(offline.getByText('Network just dropped · the Noctura server is unreachable')).toBeVisible();
    await expect(offline.getByText(/Total balance · cached|Stale ·/)).toBeVisible();
    await offline.getByRole('button', {name: 'Receive'}).click();
    await expect(offline.getByText('Public address')).toBeVisible();
    const groups = await offline.locator('.addr-groups span').allTextContents();
    expect(groups.join('')).toBe(MAIN.publicKey);
    await offline.getByRole('button', {name: 'Back'}).click();

    // Back online: the first good read shows "Connected · syncing", then the rows are live.
    h.fake.network = 'ok';
    await h.ctx.setOffline(false);
    await offline.getByRole('button', {name: 'Refresh'}).click();
    await expect(offline.getByText('Connected · syncing')).toBeVisible();
    await expect(offline.getByText('live').first()).toBeVisible();
    contained(h);
  } finally {
    await h.close();
  }
});

test('8 · activity: kinds, filters, a detail page, Load more, and the explorer link (never followed)', async () => {
  const h = await launchPopup('noctura-e2e-activity-');
  try {
    await seedUnlockedWallet(h.sw);
    const now = Math.floor(Date.now() / 1000);
    const list = [
      {signature: sig(1), tx: sentSol(MAIN.publicKey, SAVINGS.publicKey, 2_480_000_000, now - 60)},
      {signature: sig(2), tx: receivedUsdc(MAIN.publicKey, COUNTERPARTY, 250_000_000, now - 120)},
      {signature: sig(3), tx: presalePurchase(MAIN.publicKey, 1_000_000_000, now - 180)},
      {signature: sig(4), tx: otherTx(MAIN.publicKey, now - 240)},
      {signature: sig(5), tx: failedTx(MAIN.publicKey, now - 300)},
      ...Array.from({length: 7}, (_, i) => ({signature: sig(10 + i), tx: otherTx(MAIN.publicKey, now - 400 - i)})),
    ];
    h.fake.history.set(MAIN.publicKey, list);
    const popup = await h.openPopup();
    await popup.getByRole('button', {name: 'Activity'}).click();
    await expect(popup.getByText('Sent SOL')).toBeVisible({timeout: 30_000});
    await expect(popup.getByText('Received USDC')).toBeVisible();
    await expect(popup.getByText('Presale purchase')).toBeVisible();
    await expect(popup.getByText('Failed · transaction')).toBeVisible();
    await expect(popup.getByText(/^to Your account: Savings/)).toBeVisible();

    await popup.getByRole('tab', {name: 'Received'}).click();
    await expect(popup.getByText('Sent SOL')).toHaveCount(0);
    await popup.getByRole('tab', {name: 'All'}).click();

    await popup.getByRole('button', {name: 'Load more'}).click();
    await expect(popup.locator('button.tx-row')).toHaveCount(12, {timeout: 30_000});

    await popup.getByText('Sent SOL').click();
    await expect(popup.getByText('SENT', {exact: true})).toBeVisible();
    const link = popup.getByRole('link', {name: 'Explorer'});
    await expect(link).toHaveAttribute('href', `https://solscan.io/tx/${sig(1)}`);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    contained(h);
  } finally {
    await h.close();
  }
});

test('9 · switcher: rename, select — the dashboard follows select()’s own reload, not the 5 s poll', async () => {
  const h = await launchPopup('noctura-e2e-switcher-');
  try {
    await seedUnlockedWallet(h.sw);
    h.fake.lamports.set(SAVINGS.publicKey, 2_500_000_000);
    // Playwright's clock, installed before load: it follows real time until paused below, so the
    // rename flow's LockedButton floor (500 ms, a real setTimeout under the fake clock) still fires.
    const popup = await h.openPopup({clock: true});
    await expect(popup.getByText('10.0000 SOL')).toBeVisible();
    await popup.getByRole('button', {name: 'Accounts'}).click();
    const sheet = popup.getByRole('dialog', {name: 'Accounts'});
    await expect(sheet.getByText('2.5000 SOL · $375.00')).toBeVisible();
    await sheet.getByRole('button', {name: 'Rename Savings'}).click();
    await sheet.getByRole('textbox', {name: 'Account name'}).fill('Rainy day');
    await sheet.getByRole('button', {name: 'Save'}).click();
    await expect(sheet.getByText('Rainy day')).toBeVisible();

    // Freeze the popup's own clock right here, so WalletContext's 5 s wallet.state poll
    // (STATE_POLL_MS) can never fire again in this test — Playwright's own assertion retries below
    // still run on the real host clock, only the PAGE's timers are frozen. If the dashboard still
    // follows the selection below, it is select()'s own `await m.reload()` (Switcher.tsx) doing it,
    // never the poll's coattails under Playwright's 5 s default assertion timeout (review round 1).
    await popup.clock.pauseAt(await popup.evaluate(() => Date.now() + 1_000));

    await sheet.getByText('Rainy day').click();
    await expect(popup.getByRole('dialog')).toHaveCount(0);
    await expect(popup.getByRole('button', {name: 'Accounts'})).toContainText('Rainy day');
    await expect(popup.getByText('2.5000 SOL', {exact: true})).toBeVisible();
    contained(h);
  } finally {
    await h.close();
  }
});
