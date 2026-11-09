#!/usr/bin/env bash
# The JNI export check (spec §14 "Boundary"): the Java_* symbols a built libnoctura_prover.so
# exports must be exactly jni-exports.txt — no missing one, no extra one. Works on the arm64
# library (`cargo ndk -t arm64-v8a build --release`) and on the host one (`cargo build --release
# --features jni-host`): the same #[no_mangle] functions are exported by both.
#
#   ./check-jni-exports.sh <path/to/libnoctura_prover.so> [expected-list]
#
# Reads the dynamic symbol table with `nm -D --defined-only` (binutils or llvm-nm; both read a
# foreign-architecture ELF). Exit 0 = exact match; 1 = a difference (printed); 2 = usage / no
# symbols read at all (an empty read is a failure, never a vacuous pass).
set -euo pipefail
so="${1:?usage: $0 <libnoctura_prover.so> [expected-list]}"
list="${2:-$(dirname "$0")/jni-exports.txt}"
nm_bin="${NM:-nm}"
[ -f "$so" ] || { echo "no such library: $so" >&2; exit 2; }
want=$(grep -vE '^\s*(#|$)' "$list" | sort -u)
got=$("$nm_bin" -D --defined-only "$so" | awk '{print $NF}' | grep -E '^Java_' | sort -u || true)
[ -n "$want" ] || { echo "the expected list $list is empty" >&2; exit 2; }
[ -n "$got" ] || { echo "no Java_* symbols read from $so — wrong file or nm failed" >&2; exit 2; }
if [ "$want" != "$got" ]; then
  echo "JNI exports of $so differ from $list:" >&2
  diff <(echo "$want") <(echo "$got") | sed -n 's/^< /  missing: /p; s/^> /  extra:   /p' >&2
  exit 1
fi
echo "JNI exports match $list: $(echo "$got" | wc -l) symbols"
