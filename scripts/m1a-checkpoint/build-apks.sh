#!/usr/bin/env bash
# Builds the three APKs of the M1a checkpoint from ONE commit (spec §16: "each checkpoint also
# builds the production APK of the same commit"), into OUT (default build/m1a-checkpoint/apks):
#   devnet.apk               the devnet release app (ENVFILE=.env.devnet, com.nocturawallet.devnet)
#   devnet-androidTest.apk   the checkpoint: instrumentation of devnet.apk, with the pinned key files
#   production.apk           the production release app (ENVFILE=.env.production, com.nocturawallet)
# then proves the harness is in neither release APK (check-release-apk.sh, with its negative
# control on the test APK) and writes COMMIT and SHA256SUMS next to them.
#
#   ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 \
#   NOCTURA_A0_KEYS_DIR=<program side>/zk/keys/v2 \
#     scripts/m1a-checkpoint/build-apks.sh [OUT]
#
# Needs: android/keystore.properties (release signing), the gitignored .env.devnet and
# .env.production at the repository root, a real node_modules (never a symlink to another
# checkout: Gradle writes into node_modules/*/android/build).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
out="${1:-$root/build/m1a-checkpoint/apks}"
: "${NOCTURA_A0_KEYS_DIR:?set NOCTURA_A0_KEYS_DIR to the directory of the four pinned A0 key files (zk/keys/v2/ of the program-side repo)}"
: "${ANDROID_NDK_HOME:?set ANDROID_NDK_HOME (android/build.gradle ndkVersion 27.1.12297006)}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
for f in .env.devnet .env.production android/keystore.properties; do
  [ -f "$root/$f" ] || { echo "missing $f" >&2; exit 2; }
done
[ ! -L "$root/node_modules" ] || { echo "node_modules is a symlink — use a real copy (Gradle writes into it)" >&2; exit 2; }

commit=$(git -C "$root" rev-parse HEAD)
dirty=$(git -C "$root" status --porcelain --untracked-files=no)
[ -z "$dirty" ] || echo "WARNING: the working tree has uncommitted changes — the APKs are not exactly $commit" >&2

"$root/native/noctura-prover/build-android.sh"

apk_dir="$root/android/app/build/outputs/apk"
mkdir -p "$out"
rm -f "$out"/*.apk
(cd "$root/android" && ENVFILE=.env.devnet ./gradlew assembleRelease assembleReleaseAndroidTest --console=plain)
cp "$apk_dir/release/app-release.apk" "$out/devnet.apk"
cp "$apk_dir/androidTest/release/app-release-androidTest.apk" "$out/devnet-androidTest.apk"
(cd "$root/android" && ENVFILE=.env.production ./gradlew assembleRelease --console=plain)
cp "$apk_dir/release/app-release.apk" "$out/production.apk"

"$here/check-release-apk.sh" "$out/devnet.apk"
"$here/check-release-apk.sh" "$out/production.apk"
# The two controls of that reading: it FINDS each kind in the test APK, and as a release check it
# REFUSES the test APK (a check that always says "clean" fails here).
"$here/check-release-apk.sh" --expect-present "$out/devnet-androidTest.apk"
if "$here/check-release-apk.sh" "$out/devnet-androidTest.apk" >/dev/null 2>&1; then
  echo "CONTROL FAILED: the release reading passes the test APK, which carries the harness" >&2
  exit 1
fi
echo "control OK: the release reading refuses devnet-androidTest.apk"

echo "$commit${dirty:+ (dirty)}" > "$out/COMMIT"
(cd "$out" && sha256sum devnet.apk devnet-androidTest.apk production.apk > SHA256SUMS)
echo "built from $commit into $out:"
cat "$out/SHA256SUMS"
