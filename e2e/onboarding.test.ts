import {by, device, element, expect} from 'detox';

describe('Onboarding Flow', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
  });

  it('shows Welcome screen with create and import buttons', async () => {
    await expect(element(by.id('create-wallet-button'))).toBeVisible();
    await expect(element(by.id('import-wallet-button'))).toBeVisible();
  });

  it('navigates to security intro after create', async () => {
    await element(by.id('create-wallet-button')).tap();
    await expect(element(by.id('security-ack-checkbox'))).toBeVisible();
    await expect(element(by.id('continue-button'))).toBeVisible();
  });

  it('continue is enabled after acknowledging security', async () => {
    await element(by.id('security-ack-checkbox')).tap();
    await element(by.id('continue-button')).tap();
    // Should navigate to seed phrase or next step
  });
});
