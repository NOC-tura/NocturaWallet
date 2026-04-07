import {by, device, element, expect} from 'detox';

describe('Backup Flow', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
  });

  it('backup settings has cloud toggle', async () => {
    await element(by.text('Settings')).tap();
    await element(by.text('Backup Settings')).tap();
    await expect(element(by.id('cloud-toggle'))).toBeVisible();
  });

  it('force backup button is present', async () => {
    await expect(element(by.id('force-backup-button'))).toBeVisible();
  });
});
