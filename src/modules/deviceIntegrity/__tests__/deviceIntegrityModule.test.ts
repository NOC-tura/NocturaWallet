import JailMonkey from 'jail-monkey';
import {DeviceIntegrityManager} from '../deviceIntegrityModule';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';

// Type the mock helpers (not part of real JailMonkey API)
const mockJailMonkey = JailMonkey as typeof JailMonkey & {
  __setJailbroken: (v: boolean) => void;
  __reset: () => void;
};

describe('DeviceIntegrityManager', () => {
  let manager: DeviceIntegrityManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJailMonkey.__reset();
    mmkvPublic.remove(MMKV_KEYS.SECURITY_JAILBREAK_DETECTED);
    manager = new DeviceIntegrityManager();
  });

  it('returns false when device is not jailbroken', () => {
    manager.checkDeviceIntegrity();
    expect(manager.isCompromised()).toBe(false);
  });

  it('detects jailbroken device', () => {
    mockJailMonkey.__setJailbroken(true);
    manager.checkDeviceIntegrity();
    expect(manager.isCompromised()).toBe(true);
  });

  it('stores jailbreak flag in MMKV (SECURITY_JAILBREAK_DETECTED)', () => {
    mockJailMonkey.__setJailbroken(true);
    manager.checkDeviceIntegrity();
    expect(mmkvPublic.getString(MMKV_KEYS.SECURITY_JAILBREAK_DETECTED)).toBe('true');
  });

  it('does NOT block — only warns (app continues after check)', () => {
    mockJailMonkey.__setJailbroken(true);
    expect(() => manager.checkDeviceIntegrity()).not.toThrow();
    expect(manager.isCompromised()).toBe(true);
  });

  it('reads from MMKV on subsequent checks without calling JailMonkey again', () => {
    mmkvPublic.set(MMKV_KEYS.SECURITY_JAILBREAK_DETECTED, 'true');
    // Do not call checkDeviceIntegrity — value already in MMKV
    expect(manager.isCompromised()).toBe(true);
    expect(JailMonkey.isJailBroken).not.toHaveBeenCalled();
  });

  it('provides warning message when compromised', () => {
    mockJailMonkey.__setJailbroken(true);
    manager.checkDeviceIntegrity();
    expect(manager.getWarningMessage()).toBe(
      'Your device appears to be compromised. Your wallet keys may be at risk. Biometric authentication has been disabled for security.',
    );
  });

  it('returns null warning when not compromised', () => {
    manager.checkDeviceIntegrity();
    expect(manager.getWarningMessage()).toBeNull();
  });
});
