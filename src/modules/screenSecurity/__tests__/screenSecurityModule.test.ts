import {ScreenSecurityManager} from '../screenSecurityModule';

describe('ScreenSecurityManager', () => {
  let manager: ScreenSecurityManager;

  beforeEach(() => {
    manager = new ScreenSecurityManager();
  });

  it('enableSecureScreen does not throw', async () => {
    await expect(manager.enableSecureScreen()).resolves.not.toThrow();
  });

  it('disableSecureScreen does not throw', async () => {
    await expect(manager.disableSecureScreen()).resolves.not.toThrow();
  });

  it('isCaptured returns false by default', () => {
    expect(manager.isCaptured()).toBe(false);
  });
});
