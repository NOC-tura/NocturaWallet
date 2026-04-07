import {by, device, element, expect} from 'detox';

describe('Shielded Flow', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
  });

  // Navigation prerequisite: must first navigate to Dashboard, switch to Private
  // mode via ModeToggle, then enter each shielded screen (Deposit / Transfer /
  // Withdraw) before the assertions below will pass.

  it('deposit screen shows correct title', async () => {
    await expect(element(by.id('screen-title'))).toHaveText('Move to private balance');
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
