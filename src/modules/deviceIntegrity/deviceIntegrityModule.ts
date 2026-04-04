import JailMonkey from 'jail-monkey';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';

export class DeviceIntegrityManager {
  checkDeviceIntegrity(): void {
    try {
      const jailbroken = JailMonkey.isJailBroken();
      if (jailbroken) {
        mmkvPublic.set(MMKV_KEYS.SECURITY_JAILBREAK_DETECTED, 'true');
      } else {
        // Clear flag if device is no longer jailbroken (e.g., un-rooted after dev work)
        mmkvPublic.remove(MMKV_KEYS.SECURITY_JAILBREAK_DETECTED);
      }
    } catch {
      // jail-monkey not available — fail open, don't change flag
    }
  }

  isCompromised(): boolean {
    return mmkvPublic.getString(MMKV_KEYS.SECURITY_JAILBREAK_DETECTED) === 'true';
  }

  getWarningMessage(): string | null {
    if (!this.isCompromised()) return null;
    return 'Your device may be compromised. Your wallet keys may be at risk.';
  }
}
