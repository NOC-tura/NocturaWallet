import {by, device, element, expect} from 'detox';
import {navigateToSettings} from './helpers';

describe('Backup Flow', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
  });

  beforeEach(async () => {
    await navigateToSettings('Backup Settings');
  });

  it('backup settings has cloud toggle', async () => {
    await expect(element(by.id('cloud-toggle'))).toBeVisible();
  });

  it('force backup button is present', async () => {
    await expect(element(by.id('force-backup-button'))).toBeVisible();
  });
});
