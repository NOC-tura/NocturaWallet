import {by, device, element, expect} from 'detox';

describe('Transparent Send Flow', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
  });

  it('send screen has recipient and amount inputs', async () => {
    await element(by.text('Send')).tap();
    await expect(element(by.id('recipient-input'))).toBeVisible();
    await expect(element(by.id('amount-input'))).toBeVisible();
  });

  it('review button is present', async () => {
    await expect(element(by.id('review-button'))).toBeVisible();
  });
});
