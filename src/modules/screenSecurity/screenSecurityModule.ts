import {NativeModules, Platform} from 'react-native';

const NativeScreenSecurity = NativeModules.NocturaScreenSecurity as
  | {enableSecureScreen: () => Promise<void>; disableSecureScreen: () => Promise<void>}
  | undefined;

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  ⚠️  DEVELOPMENT FLAG · SECURITY-CRITICAL — DO NOT SHIP `true` TO PRODUCTION
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  When `DEV_DISABLE_SECURE_SCREEN` is `true`, this module SKIPS the native
 *  FLAG_SECURE call on every sensitive surface. Screenshots and screen
 *  recording will be ALLOWED on:
 *
 *      #3 seed-display · #4 seed-confirm · #5 pin-create · #8 import ·
 *      #9 unlock · #10 unlock-send · #18 zk-proof · #33 backup · #36 change-pin
 *
 *  This is INTENTIONAL for Phase B development testing — the user needs to be
 *  able to take screenshots of in-progress screens to verify migrations.
 *
 *  BEFORE PRODUCTION RELEASE (or before beta hand-off):
 *      Set this flag back to `false`.
 *      Verify by reaching #3 seed-display → attempt screenshot → expect block.
 *
 *  The flag is intentionally NOT environment-controlled (no .env, no
 *  `process.env.NODE_ENV` check) so a misconfigured production build can't
 *  accidentally ship with screen security off. Manual flip required.
 *
 * ════════════════════════════════════════════════════════════════════════════
 */
const DEV_DISABLE_SECURE_SCREEN = true;

export class ScreenSecurityManager {
  async enableSecureScreen(): Promise<void> {
    if (DEV_DISABLE_SECURE_SCREEN) {
      // Dev escape hatch · log so it's visible in Metro logs during development
      if (__DEV__) {
        console.warn(
          '[ScreenSecurityManager] DEV_DISABLE_SECURE_SCREEN is true · FLAG_SECURE NOT applied · ' +
            'screenshots ALLOWED on sensitive surfaces. Flip to false before production.',
        );
      }
      return;
    }
    if (Platform.OS === 'android' && NativeScreenSecurity) {
      await NativeScreenSecurity.enableSecureScreen();
    }
  }

  async disableSecureScreen(): Promise<void> {
    if (DEV_DISABLE_SECURE_SCREEN) {
      return;
    }
    if (Platform.OS === 'android' && NativeScreenSecurity) {
      await NativeScreenSecurity.disableSecureScreen();
    }
  }

  isCaptured(): boolean {
    return false; // Stub until iOS native module integrated
  }
}
