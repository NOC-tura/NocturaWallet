import JailMonkey from 'jail-monkey';
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';

export class DeviceIntegrityManager {
  checkDeviceIntegrity(): void {
    try {
      const jailbroken = JailMonkey.isJailBroken();
      if (jailbroken) {
        mmkvPublic.set(MMKV_KEYS.SECURITY_JAILBREAK_DETECTED, 'true');
      }
    } catch {
      // jail-monkey not available — fail open
    }
  }

  isCompromised(): boolean {
    return mmkvPublic.getString(MMKV_KEYS.SECURITY_JAILBREAK_DETECTED) === 'true';
  }

  getWarningMessage(): string | null {
    if (!this.isCompromised()) return null;
    return 'Your device appears to be compromised. Your wallet keys may be at risk. Biometric authentication has been disabled for security.';
  }
}
