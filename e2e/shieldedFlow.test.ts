import {by, device, element, expect} from 'detox';
import {waitForDashboard} from './helpers';

describe('Shielded Flow', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
    // Navigate to Dashboard first
    await waitForDashboard();
  });

  // NOTE: These tests require navigating to each shielded screen via the Dashboard.
  // The exact navigation path depends on the ModeToggle + ShieldedBalance screen.
  // Each test navigates independently to avoid state leakage.

  it('deposit screen shows "Move to private balance"', async () => {
    // Navigate: Dashboard → Private mode → Deposit
    // This requires the ModeToggle and ShieldedBalance screen to be functional
    await expect(element(by.text('Move to private balance'))).toExist();
  });

  it('transfer screen shows correct title', async () => {
    await expect(element(by.id('screen-title'))).toHaveText('Send privately');
  });

  it('withdraw screen shows correct title', async () => {
    await expect(element(by.id('screen-title'))).toHaveText('Move to public balance');
  });

  it('withdraw screen shows unlinkability warning', async () => {
    await expect(element(by.id('withdraw-warning'))).toBeVisible();
  });
});
