#!/usr/bin/env bash
# Builds libnoctura_prover.so for arm64-v8a — the one ABI it is built for (spec §12) — and
# installs it, ALONE, into android/app/src/main/jniLibs/arm64-v8a/, where Gradle packages it.
#
#   ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 native/noctura-prover/build-android.sh
#   native/noctura-prover/build-android.sh --verify-only     # check an installed tree, no build
#
# Why not `cargo ndk -o <jniLibs> build`: `-o` copies every cdylib of the build, and ark-circom
# declares `crate-type = ["cdylib", "rlib"]`, so it also drops libark_circom-<hash>.so (917 KB,
# needed by nothing) into jniLibs and from there into the APK. This script copies the one file.
#
# Before installing, the built library must pass the libc++ gate (check-needed.sh) and the exact
# export check (check-jni-exports.sh). After installing, jniLibs must hold exactly
# arm64-v8a/libnoctura_prover.so: any other file — a stale libark_circom from an old `-o` build,
# a library for another ABI — fails the script (it never deletes what it did not write; remove
# the file and run it again). NOCTURA_JNILIBS_DIR overrides the destination (CI, the controls).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dest="${NOCTURA_JNILIBS_DIR:-$here/../../android/app/src/main/jniLibs}"
installed="$dest/arm64-v8a/libnoctura_prover.so"

verify_tree() {
  [ -d "$dest" ] || { echo "no jniLibs directory: $dest" >&2; return 1; }
  local found
  found=$(cd "$dest" && find . -mindepth 1 \( -type f -o -type l \) | sort)
  if [ "$found" != "./arm64-v8a/libnoctura_prover.so" ]; then
    echo "jniLibs ($dest) must hold exactly arm64-v8a/libnoctura_prover.so; it holds:" >&2
    echo "${found:-  (nothing)}" | sed 's/^/  /' >&2
    return 1
  fi
  "$here/check-needed.sh" "$installed"
  "$here/check-jni-exports.sh" "$installed"
}

if [ "${1:-}" = "--verify-only" ]; then
  verify_tree
  echo "jniLibs OK: arm64-v8a/libnoctura_prover.so only"
  exit 0
fi
[ $# -eq 0 ] || { echo "usage: $0 [--verify-only]" >&2; exit 2; }
: "${ANDROID_NDK_HOME:?set ANDROID_NDK_HOME to the NDK of android/build.gradle (ndkVersion 27.1.12297006)}"

cd "$here"
cargo ndk -t arm64-v8a build --release --locked
target=$(cargo metadata --format-version 1 --no-deps | sed -n 's/.*"target_directory":"\([^"]*\)".*/\1/p')
built="$target/aarch64-linux-android/release/libnoctura_prover.so"
[ -f "$built" ] || { echo "the build produced no $built" >&2; exit 1; }
"$here/check-needed.sh" "$built"
"$here/check-jni-exports.sh" "$built"

mkdir -p "$dest/arm64-v8a"
cp "$built" "$installed.tmp"
mv -f "$installed.tmp" "$installed"
verify_tree
echo "installed $installed ($(wc -c < "$installed") bytes)"
