//! Reusable prove core: params JSON + zkey/wasm paths → on-chain proofBytes hex +
//! public inputs. Shared by the desktop example and the Android JNI wrapper.

use std::collections::HashMap;
use std::error::Error;

use ark_bn254::{Bn254, Fr};
use ark_circom::{read_zkey, CircomReduction};
use ark_ff::PrimeField;
use ark_groth16::Groth16;
use ark_std::rand::rngs::StdRng;
use ark_std::rand::SeedableRng;
use ark_std::UniformRand;
use num_bigint::BigInt;

use crate::proof_bytes::serialize_proof;
use crate::witness_wasmi::WitnessCalculator;

pub struct ProveOutput {
    /// 256-byte on-chain proof, hex (512 chars).
    pub proof_bytes_hex: String,
    /// Public signals, decimal strings, circuit order.
    pub public_inputs: Vec<String>,
}

fn fr_dec(f: &Fr) -> String {
    f.into_bigint().to_string()
}

/// Prove `circuit_id` for `params_json` (a flat object of decimal-string signals, the
/// wallet's ShieldedProveParams) using the SHA-256-verified `zkey_path` + `wasm_path`.
/// Returns the on-chain proofBytes hex + public inputs. Pure Rust (wasmi + arkworks).
pub fn prove_to_bytes(
    _circuit_id: &str,
    params_json: &str,
    zkey_path: &str,
    wasm_path: &str,
) -> Result<ProveOutput, Box<dyn Error>> {
    // params: {"name":"<decimal>", ...} → the witness calculator's HashMap form.
    let flat: HashMap<String, serde_json::Value> = serde_json::from_str(params_json)?;
    let mut inputs: HashMap<String, Vec<BigInt>> = HashMap::new();
    for (k, v) in flat {
        let s = v.as_str().ok_or("param values must be decimal strings")?;
        let bi = BigInt::parse_bytes(s.as_bytes(), 10).ok_or("bad decimal param")?;
        inputs.insert(k, vec![bi]);
    }

    let full_assignment = WitnessCalculator::from_file(wasm_path)?.calculate_witness_fr(inputs)?;

    let (params, matrices) = read_zkey(&mut std::io::BufReader::new(std::fs::File::open(zkey_path)?))?;
    let num_inputs = matrices.num_instance_variables;

    // Deterministic RNG seeded from the witness so proofs are reproducible per input
    // (still a valid Groth16 proof; avoids Date/rand-entropy needs on-device).
    let mut rng = StdRng::seed_from_u64(0);
    let r = Fr::rand(&mut rng);
    let s = Fr::rand(&mut rng);

    let proof = Groth16::<Bn254, CircomReduction>::create_proof_with_reduction_and_matrices(
        &params,
        r,
        s,
        &matrices,
        num_inputs,
        matrices.num_constraints,
        full_assignment.as_slice(),
    )?;

    let proof_bytes = serialize_proof(&proof);
    let public_inputs = full_assignment[1..num_inputs].iter().map(fr_dec).collect();

    Ok(ProveOutput {
        proof_bytes_hex: hex::encode(proof_bytes),
        public_inputs,
    })
}
