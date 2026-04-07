import {by, device, element, expect} from 'detox';

describe('Staking Flow', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
  });

  it('staking screen renders', async () => {
    await element(by.text('Stake')).tap();
    await expect(element(by.id('staking-screen'))).toBeVisible();
  });
});
