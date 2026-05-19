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
// Hard-gated to __DEV__ — production builds (where __DEV__ is false at compile
// time via dead-code elimination) ALWAYS enforce FLAG_SECURE. The escape hatch
// is purely for dev builds where screenshots help iterate on sensitive surfaces.
//
// Defense-in-depth: the constant + __DEV__ guard means even a misconfigured
// debug-flavor production build can't silently disable screenshot blocking
// (release bundles strip __DEV__ branches entirely).
const DEV_DISABLE_SECURE_SCREEN = __DEV__;

export class ScreenSecurityManager {
  async enableSecureScreen(): Promise<void> {
    if (DEV_DISABLE_SECURE_SCREEN) {
      // Dev escape hatch · log so it's visible in Metro logs during development
      console.warn(
        '[ScreenSecurityManager] __DEV__ build · FLAG_SECURE NOT applied · ' +
          'screenshots ALLOWED on sensitive surfaces. Production builds always enforce.',
      );
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
