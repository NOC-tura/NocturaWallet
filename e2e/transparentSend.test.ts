import {by, device, element, expect} from 'detox';
import {navigateToTab} from './helpers';

describe('Transparent Send Flow', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
  });

  beforeEach(async () => {
    await navigateToTab('Send');
  });

  it('send screen has recipient and amount inputs', async () => {
    await expect(element(by.id('recipient-input'))).toBeVisible();
    await expect(element(by.id('amount-input'))).toBeVisible();
  });

  it('review button is present', async () => {
    await expect(element(by.id('review-button'))).toBeVisible();
  });
});
