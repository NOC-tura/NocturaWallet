#!/usr/bin/env bash
# The JNI export check (spec §14 "Boundary"): the symbols a built libnoctura_prover.so exports
# must be exactly jni-exports.txt — no missing one, no extra one, and NOTHING that is not on the
# list (not only no extra Java_*: no symbol at all). Works on the arm64 library
# (`./build-android.sh`) and on the host one (`cargo build --release --features jni-host`): both
# are linked with exports.map (build.rs), which leaves exactly the listed Java_* functions in the
# dynamic symbol table.
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
got=$("$nm_bin" -D --defined-only "$so" | awk '{print $NF}' | sort -u || true)
[ -n "$want" ] || { echo "the expected list $list is empty" >&2; exit 2; }
echo "$got" | grep -qE '^Java_' || { echo "no Java_* symbols read from $so — wrong file or nm failed" >&2; exit 2; }
if [ "$want" != "$got" ]; then
  echo "dynamic exports of $so differ from $list:" >&2
  diff <(echo "$want") <(echo "$got") | sed -n 's/^< /  missing: /p; s/^> /  extra:   /p' >&2
  exit 1
fi
echo "exports match $list exactly: $(echo "$got" | wc -l) symbols, nothing else"
