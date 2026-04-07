import {by, device, element, expect} from 'detox';

describe('Session Lock', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
  });

  it('shows unlock screen after background/foreground', async () => {
    await device.sendToHome();
    await device.launchApp({newInstance: false});
    await expect(element(by.id('unlock-screen'))).toBeVisible();
  });

  it('unlock screen has PIN pad', async () => {
    await expect(element(by.id('pin-pad'))).toBeVisible();
  });
});
