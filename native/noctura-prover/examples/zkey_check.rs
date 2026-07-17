//! Stage 0 / Task 0.1 — RUNS today. Proves ark-circom (rev 4d99060) parses the
//! deployed snarkjs-0.7.4 deposit zkey and that the circuit shape matches the
//! wallet (nPublic = 3). This is the biggest desktop feasibility gate.
//!
//! (The full witness→prove→verify flow is in examples/deposit_prove.rs — it COMPILES
//! but is link-blocked by wasmer-2.3.0 ↔ modern-rustc `__rust_probestack`; the fix is
//! a pure-Rust wasm witness calculator (wasmi), which also fits Android. See STATUS.md.)

use std::error::Error;
use std::fs::File;
use std::io::BufReader;

use ark_circom::read_zkey;

fn main() -> Result<(), Box<dyn Error>> {
    let path = "artifacts/deposit_final.zkey";
    let mut reader = BufReader::new(File::open(path)?);
    let (pk, matrices) = read_zkey(&mut reader)?;

    let n_public = matrices.num_instance_variables - 1;
    println!("read_zkey OK: {path}");
    println!("  vk.gamma_abc_g1.len() = {}", pk.vk.gamma_abc_g1.len());
    println!("  num_constraints       = {}", matrices.num_constraints);
    println!("  => nPublic = {n_public} (expect 3)");
    assert_eq!(n_public, 3, "deposit nPublic must be 3");
    println!("PASS: deployed snarkjs-0.7.4 deposit zkey is readable by arkworks, nPublic = 3");
    Ok(())
}
