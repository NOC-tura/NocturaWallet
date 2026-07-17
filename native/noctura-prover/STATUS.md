# noctura-prover — M1 spike status

Desktop-first Groth16 prover over the deployed devnet shielded circuits, using the
exact snarkjs `.zkey` + circom `.wasm` the wallet downloads. Pure-Rust (arkworks).
Plan: `docs/superpowers/plans/2026-07-17-m1-native-prover-spike.md`.

## ✅ STAGE 0 COMPLETE (2026-07-17)

`cargo run --example deposit_prove` runs end-to-end on **stable rust**, pure Rust,
no wasmer/libc++: read_zkey → **wasmi witness (386 elts)** → arkworks Groth16 prove →
**verify against the deployed VK = TRUE** → public inputs cross-checked = `[commitment,
amount, mintHash]` (the deposit circuit's public-signal order, nPublic=3, all matching
the known inputs). The wasmi witness calculator (`src/witness_wasmi.rs`) produces a
constraint-satisfying witness — the on-device Groth16 pipeline is proven for deposit.

## ✅ TASK 0.4 DESKTOP-VALIDATED (2026-07-17)

`serialize_proof` (`src/proof_bytes.rs`) produces the frozen 256-byte on-chain layout
(**pi_a negated, G2 c1-first, big-endian**). Validated three ways:
- `examples/deposit_prove` — serialize→parse→verify round-trip (B).
- `examples/onchain_format_check` — parses an **ON-CHAIN-ACCEPTED** reference proofBytes
  (hosted `/zk/prove`, saved to `artifacts/deposit_reference.json`) with OUR layout and
  verifies it against the deployed VK → **PASS**. This proves the layout matches the
  program's format (the reference is on-chain-accepted), independent of it being a
  different random proof (A).
- Stage 2 (on-device submit) = final confirmation, pending.

**The full desktop de-risk is complete: zkey read → wasmi witness → arkworks prove →
verify → on-chain-format serialize, all validated in pure Rust from the real artifacts.**

## ✅ STAGE 1 BUILT (2026-07-17) — awaiting on-device confirmation

- **Pure-Rust JNI** (`src/android.rs`, `jni` crate) → `libnoctura_prover.so` via cargo-ndk (arm64-v8a).
- **Kotlin `NocturaProver` module + package** registered in `MainApplication` (unlike the disabled blst NocturaKey).
- **libc++ pre-check (readelf):** `libnoctura_prover.so` NEEDs only `libc.so`/`libm.so`/`libdl.so` — **NO `libc++_shared.so` dependency**. (The APK still ships RN's own `libc++_shared.so` for RN's C++ libs; the difference from the blst crash is that our `.so` does NOT bundle/depend on a *conflicting* libc++ — there's just the single canonical RN one.)
- **Devnet release APK built** (`BUILD SUCCESSFUL`, 92 MB) → `~/Downloads/NocturaWallet-native-prover.apk`. Contains `lib/arm64-v8a/libnoctura_prover.so`. Debug screen gated by `NATIVE_PROVER_DEBUG=true` in `.env.devnet`.

**On-device (user):** sideload → **launch = libc++ gate** → Settings → "🔧 Native prover test (dev)" → confirm native prove succeeds + publicInputs match hosted. (Only arm64 devices — the APK's other ABIs lack the prover `.so`.)

**Rebuild:** `cargo ndk -t arm64-v8a -o ../../android/app/src/main/jniLibs build --release` (ANDROID_NDK_HOME set), then `ENVFILE=.env.devnet ANDROID_HOME=~/Android/Sdk ./gradlew assembleRelease` in `android/`.

## ⏳ STAGE 2 APK BUILT (2026-07-17) — awaiting on-device deposit + tx sig

`LOCAL_PROVING=true` baked in (BuildConfig verified) → `proveShielded` routes ALL
shielded proofs through the native prover (no hosted fallback). Devnet release APK
→ `~/Downloads/NocturaWallet-localproving.apk` (prover `.so` bundled). No source
change — the native path was already wired + Stage-1-confirmed.

**On-device (user):** Shield a small amount (transparent test-token acct
`ByLmVNmn…ZFMs` holds 7.1; `Da83c…e31B` has 0.474 SOL) → native prove on-device →
devnet accept → report the tx sig for on-chain verification (deposit ix to NPkc…,
err:null, leaf inserted). That confirms the devnet program accepts the NATIVE
proofBytes → Stage 2 done, localProving effectively ON for deposit.

Global flag → withdraw/transfer also route native (same mechanism, on-device-untested).
Other circuits reuse `witness_wasmi` + `proof_bytes`.

---

## What is proven (Stage 0)

- ✅ **Task 0.1 — zkey compatibility gate (RUNS today).** `cargo run --example zkey_check`
  reads the deployed `deposit_final.zkey` (snarkjs 0.7.4) via `ark-circom` and confirms
  `nPublic = 3`, `num_constraints = 382` — matches the wallet's `EXPECTED_NPUBLIC.deposit`.
  **This was the single biggest desktop feasibility unknown (can arkworks read our
  zkeys?) — answered YES.**
- ✅ **Dep resolution solved.** `ark-circom` must be pinned to rev `4d99060` (the
  arkworks-0.4 era); master is mid-0.5/0.6 migration and internally inconsistent. The
  whole arkworks family is forced to `=0.4.1`/`=0.4.0` to unify (see `Cargo.toml`). This
  archaeology is captured so it need not be redone.
- ✅ **Full prove→verify pipeline COMPILES** (`examples/deposit_prove.rs`): `read_zkey`
  matrices + `WitnessCalculator` + a valid poseidon-generated deposit input +
  `Groth16::<Bn254, CircomReduction>::create_proof_with_reduction_and_matrices` +
  `verify_with_processed_vk`. The code is correct against the real artifacts.

## The blocker (execution of the full flow)

`examples/deposit_prove.rs` **compiles but fails to LINK**: `undefined symbol
__rust_probestack`, referenced by `wasmer-vm 2.3.0` (ark-circom 4d99060's witness
calculator). Modern rustc (1.89/1.90) removed that symbol; older rustc (≤1.76) hits an
`edition2024` transitive-dep wall. This is a **wasmer-2.3.0 ↔ modern-toolchain**
incompatibility, orthogonal to the prover.

## Resolution → wasmi (also the Android path)

The witness calculator is the only thing pulling wasmer. Replace it with a **pure-Rust
wasm executor (`wasmi`)** — or a pure-Rust circom witness calculator — to run the
downloaded `.wasm`. This:
1. unblocks desktop execution (no wasmer → no `__rust_probestack`), and
2. is exactly what Stage 1 (Android) needs anyway — wasmer is C-containing and a libc++
   risk on-device (the whole reason for the pure-Rust backend). So the desktop blocker
   and the Android design decision converge on the same fix.

**Next step:** swap the witness step to wasmi in `deposit_prove.rs`, complete Stage 0
(prove + verify against `pk.vk`), then proceed to Stage 1 (UniFFI + Kotlin module).

## Layout

- `examples/zkey_check.rs` — Task 0.1, runs.
- `examples/deposit_prove.rs` — Tasks 0.2–0.3, compiles, link-blocked (wasmer); wasmi swap pending.
- `artifacts/` — gitignored (downloaded zkey/wasm + generated input; pins in `src/constants/provingAssets.ts`).
