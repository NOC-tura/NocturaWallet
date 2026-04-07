import {by, device, element, expect} from 'detox';

describe('Notification Settings', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
  });

  it('has 4 notification toggles', async () => {
    await element(by.text('Settings')).tap();
    await element(by.text('Notification Settings')).tap();
    await expect(element(by.id('toggle-incoming_tx'))).toBeVisible();
    await expect(element(by.id('toggle-staking_reward'))).toBeVisible();
    await expect(element(by.id('toggle-tx_confirmed'))).toBeVisible();
    await expect(element(by.id('toggle-security_alert'))).toBeVisible();
  });

  it('security alert shows recommended hint', async () => {
    await expect(element(by.id('security-hint'))).toBeVisible();
  });
});
