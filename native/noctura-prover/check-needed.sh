#!/usr/bin/env bash
# The libc++ gate (spec §12 "The Rust .so", m15; the July lesson: a native library that brought
# its own libc++_shared.so crashed every release build at launch). The Android library's
# DT_NEEDED entries must be a subset of the platform's C libraries — libc.so, libm.so, libdl.so,
# liblog.so — and none may be a C++ runtime (libc++_shared, libc++, libstdc++, libgnustl, …).
#
#   ./check-needed.sh <path/to/arm64 libnoctura_prover.so>
#
# Reads the dynamic section with `readelf -d` (binutils or llvm-readelf; READELF overrides).
# Exit 0 = only allowed entries; 1 = a C++ runtime or another library is NEEDED (printed);
# 2 = usage / not an ELF shared object with a dynamic section / no NEEDED entry read at all (an
# empty read is a failure, never a vacuous pass — every Android .so needs at least libc.so).
set -euo pipefail
so="${1:?usage: $0 <libnoctura_prover.so>}"
readelf_bin="${READELF:-readelf}"
allowed="libc.so libdl.so liblog.so libm.so"
[ -f "$so" ] || { echo "no such library: $so" >&2; exit 2; }
dyn=$("$readelf_bin" -d "$so" 2>/dev/null) || { echo "readelf could not read $so" >&2; exit 2; }
needed=$(echo "$dyn" | sed -n 's/.*(NEEDED).*\[\(.*\)\]$/\1/p' | sort -u)
[ -n "$needed" ] || { echo "no NEEDED entry read from $so — wrong file or readelf failed" >&2; exit 2; }
bad=0
while IFS= read -r lib; do
  if echo "$lib" | grep -qiE 'c\+\+|stdc|gnustl|stlport'; then
    echo "  C++ runtime NEEDED: $lib" >&2
    bad=1
  elif ! echo " $allowed " | grep -qF " $lib "; then
    echo "  not allowed NEEDED: $lib (allowed: $allowed)" >&2
    bad=1
  fi
done <<< "$needed"
if [ "$bad" -ne 0 ]; then
  echo "$so fails the libc++ gate" >&2
  exit 1
fi
echo "NEEDED of $so: $(echo "$needed" | tr '\n' ' ')— no C++ runtime"
