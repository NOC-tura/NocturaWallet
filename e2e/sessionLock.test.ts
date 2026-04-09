import {by, device, element, expect} from 'detox';
import {waitForDashboard} from './helpers';

describe('Session Lock', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
    // Requires existing wallet — run onboarding E2E first or pre-seed keychain
    await waitForDashboard();
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
