import {by, device, element, expect} from 'detox';

describe('Deep Link Handling', () => {
  it('pay link opens send screen with pre-filled recipient', async () => {
    await device.launchApp({
      newInstance: true,
      url: 'noctura://pay?to=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU&amount=1.5',
    });
    await expect(element(by.id('recipient-input'))).toBeVisible();
  });
});
