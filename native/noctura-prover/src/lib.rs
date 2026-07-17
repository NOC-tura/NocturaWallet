//! M1 spike core — pure-Rust Groth16 prover for the Noctura shielded circuits.
//! Stage 0 is exercised via examples/deposit_prove.rs (+ examples/zkey_check.rs).

pub use ark_circom;

pub mod proof_bytes;
pub mod witness_wasmi;
