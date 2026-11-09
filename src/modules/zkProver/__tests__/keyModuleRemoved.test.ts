/**
 * The old native key module is gone and stays gone (spec 2026-11-08 shielded A0 M1 §12:
 * "NocturaKeyModule / libnoctura_key.so and its CMake / Gradle stanzas — M1a").
 *
 * It was a C++ blst (BLS12-381) bridge whose libnoctura_key.so brought its own NDK
 * libc++_shared.so and crashed every release build at launch (2026-06-30); the shielded spend
 * key now lives in the pure-Rust A0 core (native/noctura-prover). This test reads the app's
 * code trees — the JS sources, the Android project, the iOS project, the Rust crate — and fails
 * on any reference to the module, its library, its package, its JS bridge, blst, or a Gradle
 * externalNativeBuild stanza (the app's one native library is built by
 * native/noctura-prover/build-android.sh, not by Gradle). Markdown (history, plans) is not code
 * and is not read.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const SELF = path.relative(ROOT, __filename);

// This file names what it looks for (its comments, the positive control), so it is the one file
// not read (SELF).
const FORBIDDEN: Array<[string, RegExp]> = [
  ['the module / package / JS bridge', /NocturaKey(Module|Package|Bridge)/],
  ['the library', /noctura_key/],
  ['the Kotlin package', /com\.nocturawallet\.shieldedkey/],
  ['the JS bridge file', /keychain\/nativeBridge/],
  ['blst', /\bblst\b/i],
  ['a Gradle CMake stanza', /externalNativeBuild\s*\{/],
];

const TREES = ['src', 'android', 'ios', 'native/noctura-prover', 'index.js', 'globalBuffer.js', 'package.json'];
const SKIP_DIRS = new Set(['node_modules', 'build', '.gradle', '.cxx', 'Pods', 'target', 'artifacts', 'jniLibs', '.kotlin']);
const CODE = /\.(ts|tsx|js|mjs|cjs|json|kt|kts|java|gradle|properties|rs|toml|map|sh|txt|cpp|cc|c|h|hpp|swift|m|mm|pbxproj|xml|pro)$|^(Podfile|CMakeLists\.txt)$/;

function walk(rel: string, out: string[]): void {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    return;
  }
  const st = fs.statSync(abs);
  if (st.isFile()) {
    if (CODE.test(path.basename(rel)) && rel !== SELF) {
      out.push(rel);
    }
    return;
  }
  for (const name of fs.readdirSync(abs)) {
    if (!SKIP_DIRS.has(name)) {
      walk(path.join(rel, name), out);
    }
  }
}

function findings(text: string): string[] {
  return FORBIDDEN.filter(([, re]) => re.test(text)).map(([what]) => what);
}

const files: string[] = [];
TREES.forEach(t => walk(t, files));

describe('the old native key module (blst, libnoctura_key.so) is removed', () => {
  it('reads the trees it claims to (non-vacuous)', () => {
    expect(files.length).toBeGreaterThan(300);
    for (const known of [
      'android/app/build.gradle',
      'android/app/src/main/java/com/nocturawallet/MainApplication.kt',
      'native/noctura-prover/src/android.rs',
      'src/modules/keychain/keychainModule.ts',
      'src/modules/zkProver/nativeProverBridge.ts',
    ]) {
      expect(files).toContain(known);
    }
  });

  it('flags every kind of reference it looks for (positive control)', () => {
    expect(findings('import com.nocturawallet.shieldedkey.NocturaKeyPackage')).toEqual([
      'the module / package / JS bridge',
      'the Kotlin package',
    ]);
    expect(findings('System.loadLibrary("noctura_key")')).toEqual(['the library']);
    expect(findings("require('./keychain/nativeBridge')")).toEqual(['the JS bridge file']);
    expect(findings('#include "blst.h"')).toEqual(['blst']);
    expect(findings('    externalNativeBuild {')).toEqual(['a Gradle CMake stanza']);
    // Not references: the release-signing variables, the prover's own native bridge.
    expect(findings('System.getenv("NOCTURA_KEY_ALIAS")')).toEqual([]);
    expect(findings("from './nativeProverBridge'")).toEqual([]);
  });

  it('no code file references it', () => {
    const hits = files
      .map(f => ({f, what: findings(fs.readFileSync(path.join(ROOT, f), 'utf8'))}))
      .filter(h => h.what.length > 0);
    expect(hits).toEqual([]);
  });

  it('its files are gone', () => {
    for (const gone of [
      'android/app/src/main/cpp/CMakeLists.txt',
      'android/app/src/main/cpp/noctura_key_jni.cpp',
      'android/app/src/main/java/com/nocturawallet/shieldedkey',
      'src/modules/keychain/nativeBridge.ts',
    ]) {
      expect(fs.existsSync(path.join(ROOT, gone))).toBe(false);
    }
  });
});
