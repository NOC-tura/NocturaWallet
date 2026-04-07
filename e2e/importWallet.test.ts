import {by, device, element, expect} from 'detox';

describe('Import Wallet Flow', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
  });

  it('navigates to import screen from welcome', async () => {
    await expect(element(by.id('import-wallet-button'))).toBeVisible();
    await element(by.id('import-wallet-button')).tap();
    await expect(element(by.text('Import Wallet'))).toBeVisible();
  });
});
