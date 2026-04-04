import {NativeModules, Platform} from 'react-native';

const NativeScreenSecurity = NativeModules.NocturaScreenSecurity as
  | {enableSecureScreen: () => Promise<void>; disableSecureScreen: () => Promise<void>}
  | undefined;

export class ScreenSecurityManager {
  async enableSecureScreen(): Promise<void> {
    if (Platform.OS === 'android' && NativeScreenSecurity) {
      await NativeScreenSecurity.enableSecureScreen();
    }
  }

  async disableSecureScreen(): Promise<void> {
    if (Platform.OS === 'android' && NativeScreenSecurity) {
      await NativeScreenSecurity.disableSecureScreen();
    }
  }

  isCaptured(): boolean {
    return false; // Stub until iOS native module integrated
  }
}
