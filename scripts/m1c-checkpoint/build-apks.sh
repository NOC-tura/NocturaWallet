#!/usr/bin/env bash
# Builds the two APKs of the M1c checkpoint from ONE commit (spec §16: "each checkpoint also
# builds the production APK of the same commit"), into OUT (default build/m1c-checkpoint/apks):
#   devnet.apk               the devnet release app (ENVFILE=.env.devnet, com.nocturawallet.devnet)
#   devnet-androidTest.apk   (only with NOCTURA_A0_KEYS_DIR set) the instrumentation APK of devnet.apk —
#                            Task 6's A0ConfirmWindowTest, run by `phone --instrument` (M1c.N2); M1a's
#                            build rule: it stages the four pinned A0 key files, so it needs their dir
#   production.apk           the production release app (ENVFILE=.env.production, com.nocturawallet)
# then reads both APKs' BuildConfig off the built files (m1c-checkpoint.mjs check-apks: the
# readout gate is open in devnet.apk and closed in production.apk, with its negative control; the
# devnet API_BASE ends in exactly one /v1 — the relayer URLs append bare paths to it) and writes
# COMMIT, SHA256SUMS and CONFIG.json next to them. (M1b's script, adapted; extended by M1c Task 9.)
#
#   ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006 [NOCTURA_A0_KEYS_DIR=<program side>/zk/keys/v2] \
#     scripts/m1c-checkpoint/build-apks.sh [OUT]
#
# Needs: android/keystore.properties (release signing), the gitignored .env.devnet (NETWORK=devnet,
# FEATURES_SHIELDED=true, LOCAL_PROVING=true, APP_ID_SUFFIX=.devnet — README "Before you start")
# and .env.production at the repository root, a real node_modules (never a symlink: Gradle writes
# into node_modules/*/android/build). CARGO_TARGET_DIR may point at an existing target.
# DEVNET_ENVFILE (optional, an ABSOLUTE path) builds the devnet APK from another env file than the
# repository's .env.devnet (e.g. a temporary copy) — the same checks apply to it; the production
# APK is always built from .env.production.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
out="${1:-$root/build/m1c-checkpoint/apks}"
: "${ANDROID_NDK_HOME:?set ANDROID_NDK_HOME (android/build.gradle ndkVersion 27.1.12297006)}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
devnet_env="${DEVNET_ENVFILE:-$root/.env.devnet}"
case "$devnet_env" in /*) ;; *) echo "DEVNET_ENVFILE must be an absolute path" >&2; exit 2 ;; esac
[ -f "$devnet_env" ] || { echo "missing $devnet_env" >&2; exit 2; }
for f in .env.production android/keystore.properties; do
  [ -f "$root/$f" ] || { echo "missing $f" >&2; exit 2; }
done
[ ! -L "$root/node_modules" ] || { echo "node_modules is a symlink — use a real copy (Gradle writes into it)" >&2; exit 2; }
# The devnet build must be the shielded DEVNET build (Task 6: a shielded build on any other
# network refuses to start); checked here before 30 minutes of Gradle, and again on the APK.
grep -qx 'NETWORK=devnet' "$devnet_env" || { echo "$devnet_env must set NETWORK=devnet (README \"Before you start\")" >&2; exit 2; }
grep -qx 'FEATURES_SHIELDED=true' "$devnet_env" || { echo "$devnet_env must set FEATURES_SHIELDED=true" >&2; exit 2; }
# The relayer URLs are ${API_BASE}/relayer/{quote,submit} (spec §6.0): the base must be https and end in /v1.
grep -Eq '^API_BASE=https://[^/]+/(.*/)?v1$' "$devnet_env" || { echo "$devnet_env must set API_BASE=https://…/v1 (README \"Before you start\")" >&2; exit 2; }
if grep -q '^FEATURES_SHIELDED=true' "$root/.env.production"; then
  echo ".env.production must not set FEATURES_SHIELDED=true" >&2
  exit 2
fi

commit=$(git -C "$root" rev-parse HEAD)
dirty=$(git -C "$root" status --porcelain --untracked-files=no)
[ -z "$dirty" ] || echo "WARNING: the working tree has uncommitted changes — the APKs are not exactly $commit" >&2

"$root/native/noctura-prover/build-android.sh"

gradle=(./gradlew --console=plain --max-workers=3 -Pkotlin.compiler.execution.strategy=in-process)
apk="$root/android/app/build/outputs/apk/release/app-release.apk"
mkdir -p "$out"
rm -f "$out"/*.apk "$out/CONFIG.json"
tasks=(assembleRelease)
if [ -n "${NOCTURA_A0_KEYS_DIR:-}" ]; then
  tasks+=(assembleReleaseAndroidTest)
else
  echo "NOTE: NOCTURA_A0_KEYS_DIR is not set — no devnet-androidTest.apk; M1c.N2 (the confirmation window on the phone) cannot run" >&2
fi
(cd "$root/android" && ENVFILE="$devnet_env" "${gradle[@]}" "${tasks[@]}")
cp "$apk" "$out/devnet.apk"
test_apk="$root/android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk"
if [ -n "${NOCTURA_A0_KEYS_DIR:-}" ]; then
  cp "$test_apk" "$out/devnet-androidTest.apk"
  # the harness stays out of the release APK (M1a's reading, with its control on the test APK)
  "$here/../m1a-checkpoint/check-release-apk.sh" "$out/devnet.apk"
  "$here/../m1a-checkpoint/check-release-apk.sh" --expect-present "$out/devnet-androidTest.apk"
fi
(cd "$root/android" && ENVFILE=.env.production "${gradle[@]}" assembleRelease)
cp "$apk" "$out/production.apk"
"$here/../m1a-checkpoint/check-release-apk.sh" "$out/production.apk"

echo "$commit${dirty:+ (dirty)}" > "$out/COMMIT"
(cd "$out" && sha256sum -- *.apk > SHA256SUMS)
node "$here/m1c-checkpoint.mjs" check-apks --apks "$out"
echo "built from $commit into $out:"
cat "$out/SHA256SUMS"
