//! M1 spike core — pure-Rust Groth16 prover for the Noctura shielded circuits.
//! Stage 0 is exercised via examples/deposit_prove.rs (+ examples/zkey_check.rs).

pub use ark_circom;

pub mod a0;
pub mod proof_bytes;
pub mod prover;
pub mod witness_wasmi;

// The JNI symbols: on Android, and on the host with `--features jni-host` (the Kotlin JVM test
// loads that build to call the same symbols the app does).
#[cfg(any(target_os = "android", feature = "jni-host"))]
mod android;

// The HOST jni-host build only (never Android, never the app): wasmer-vm — linked through
// ark-circom, never called (witnesses run in wasmi) — exports `wasmer_vm_probestack`, the
// address of `__rust_probestack`, a symbol current Rust no longer provides on x86_64. The
// JVM's dlopen must resolve that data relocation, so the test library would not load. A bare
// `ret` keeps the symbol defined; nothing in this crate reaches it. aarch64 has no probestack.
#[cfg(all(
    feature = "jni-host",
    target_arch = "x86_64",
    not(target_os = "android")
))]
std::arch::global_asm!(
    ".globl __rust_probestack",
    ".type __rust_probestack, @function",
    "__rust_probestack:",
    "ret"
);
