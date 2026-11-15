import {readFileSync} from 'fs';
import {join} from 'path';

/**
 * react-native-config reads the env values from BuildConfig and looks for that class under the
 * APPLICATION id unless `build_config_package` names it. A build with APP_ID_SUFFIX (the devnet
 * build, com.nocturawallet.devnet) then found no class, every Config.* read was undefined and the
 * app hung on its splash screen (2026-11-15). This pins the lookup to the namespace.
 */
const GRADLE = readFileSync(join(__dirname, '../../../android/app/build.gradle'), 'utf8');

function namespaceOf(gradle: string): string | undefined {
  return /^\s*namespace\s+"([^"]+)"/m.exec(gradle)?.[1];
}

function buildConfigPackageOf(gradle: string): string | undefined {
  return /resValue\s+"string",\s*"build_config_package",\s*"([^"]+)"/.exec(gradle)?.[1];
}

describe('react-native-config finds BuildConfig in every build variant', () => {
  it('build_config_package is the namespace, where BuildConfig is generated', () => {
    const namespace = namespaceOf(GRADLE);
    expect(namespace).toBe('com.nocturawallet');
    expect(buildConfigPackageOf(GRADLE)).toBe(namespace);
  });

  it('the readers fail on a gradle file without the pin (negative control)', () => {
    const without = GRADLE.replace(/resValue\s+"string",\s*"build_config_package",[^\n]*\n/, '');
    expect(buildConfigPackageOf(without)).toBeUndefined();
    const wrong = GRADLE.replace(
      /("build_config_package",\s*)"[^"]+"/,
      '$1"com.nocturawallet.devnet"',
    );
    expect(buildConfigPackageOf(wrong)).not.toBe(namespaceOf(wrong));
  });
});
