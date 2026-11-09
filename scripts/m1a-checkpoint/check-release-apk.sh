#!/usr/bin/env bash
# The M1a checkpoint harness is NOT in a release APK (spec §16: "a harness that is not in the
# devnet APK's release variant"). Read off the built APK, never off the build script:
#   - no APK entry the test APK carries: assets/a0/… (the pinned key files), the offline
#     fixtures (assets/a0-*-vectors.json, assets/a0-vk/), and no entry whose size is one of the
#     four pinned key-file lengths;
#   - no checkpoint name in any classes*.dex: M1aCheckpoint, androidx/test/, AndroidJUnitRunner,
#     the report's schema / key / log marker;
#   - none of those in the JS bundle (assets/index.android.bundle);
#   - no <instrumentation> in the manifest.
#
#   check-release-apk.sh <app-release.apk>                    exit 0 = none found
#   check-release-apk.sh --expect-present <androidTest.apk>   the negative control: the same reading
#                                     must FIND each kind (entries, key-file sizes, dex names,
#                                     the instrumentation) in the test APK — a reading that went
#                                     blind to one kind fails here instead of passing a release
# Exit 1 = the check failed (printed); 2 = usage / unreadable APK.
set -euo pipefail

expect_present=0
if [ "${1:-}" = "--expect-present" ]; then
  expect_present=1
  shift
fi
apk="${1:-}"
[ -n "$apk" ] && [ $# -eq 1 ] || { echo "usage: $0 [--expect-present] <apk>" >&2; exit 2; }
entries=$(unzip -Z1 "$apk" 2>/dev/null) || { echo "not a readable APK: $apk" >&2; exit 2; }
[ -n "$entries" ] || { echo "no entries read from $apk" >&2; exit 2; }

found=()
kinds=""
asset_hits=$(grep -E '^assets/(a0/|a0-(key|prove|ata)-vectors\.json$|a0-vk/)' <<<"$entries" || true)
[ -z "$asset_hits" ] || { found+=("entries: $(tr '\n' ' ' <<<"$asset_hits")"); kinds+=" entries"; }

# 662589 deposit_final.zkey, 2528384 deposit.wasm, 4469189 withdraw_change_final.zkey,
# 2988385 withdraw_change.wasm (native/noctura-prover/src/a0/keyfiles.rs)
size_hits=$(unzip -Zl "$apk" | awk '$4 ~ /^(662589|2528384|4469189|2988385)$/ {print $NF}' || true)
[ -z "$size_hits" ] || { found+=("entries of a pinned key-file size: $(tr '\n' ' ' <<<"$size_hits")"); kinds+=" sizes"; }

markers='M1aCheckpoint|androidx/test/|AndroidJUnitRunner|noctura\.m1a\.checkpoint-report|M1A-REPORT|m1a-report'
dexes=$(grep -E '^classes[0-9]*\.dex$' <<<"$entries" || true)
[ -n "$dexes" ] || { echo "no classes*.dex in $apk" >&2; exit 2; }
for dex in $dexes; do
  n=$(unzip -p "$apk" "$dex" | grep -a -o -E "$markers" | sort | uniq -c | tr '\n' ' ' || true)
  [ -z "${n// /}" ] || { found+=("$dex: $n"); kinds+=" dex"; }
done
if grep -qx 'assets/index.android.bundle' <<<"$entries"; then
  n=$(unzip -p "$apk" assets/index.android.bundle | grep -a -o -E "$markers" | sort | uniq -c | tr '\n' ' ' || true)
  [ -z "${n// /}" ] || found+=("assets/index.android.bundle: $n")
fi

sdk="${ANDROID_HOME:-$HOME/Android/Sdk}"
aapt2=$(ls -d "$sdk"/build-tools/*/aapt2 2>/dev/null | sort -V | tail -1 || true)
[ -n "$aapt2" ] || { echo "aapt2 not found under $sdk/build-tools (ANDROID_HOME) — the manifest cannot be read" >&2; exit 2; }
manifest=$("$aapt2" dump xmltree --file AndroidManifest.xml "$apk") || { echo "aapt2 cannot read the manifest of $apk" >&2; exit 2; }
if grep -q 'E: instrumentation' <<<"$manifest"; then
  found+=("AndroidManifest.xml: <instrumentation>")
  kinds+=" manifest"
fi

if [ "$expect_present" = 1 ]; then
  for k in entries sizes dex manifest; do
    case " $kinds " in
      *" $k "*) ;;
      *) echo "NEGATIVE CONTROL FAILED: the reading found no $k in $apk (found:${kinds:- nothing})" >&2; exit 1 ;;
    esac
  done
  echo "control OK: the reading finds the harness in $(basename "$apk"):"
  printf '  %s\n' "${found[@]}"
  exit 0
fi
if [ ${#found[@]} -gt 0 ]; then
  echo "THE CHECKPOINT HARNESS IS IN $apk:" >&2
  printf '  %s\n' "${found[@]}" >&2
  exit 1
fi
echo "release APK clean: no checkpoint class, asset, key file, marker or instrumentation in $(basename "$apk") ($(grep -c . <<<"$entries") entries, $(wc -w <<<"$dexes") dex)"
