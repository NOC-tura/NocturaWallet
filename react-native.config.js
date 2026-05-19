/**
 * React Native CLI configuration.
 *
 * Asset linking — used by `npx react-native-asset` to copy font files into
 *   - Android: android/app/src/main/assets/fonts/
 *   - iOS:     bundled via Xcode info.plist UIAppFonts
 *
 * Fonts in this project:
 *   - Geist (Sans):  Regular · Medium · SemiBold · Bold
 *   - Geist Mono:    Regular · Medium
 *
 * License: SIL Open Font License v1.1 (see src/assets/fonts/Geist-LICENSE.txt).
 * Source:  npm geist@1.7.0 by Vercel + basement.studio.
 *
 * After editing this file, run:
 *   npx react-native-asset
 * Then rebuild the Android APK to bundle the new fonts.
 */
module.exports = {
  assets: ['./src/assets/fonts/'],
};
