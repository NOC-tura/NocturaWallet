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

/// Flatten a circom input value into field elements (row-major for arrays). Handles
/// scalar decimal strings, JSON numbers, and (nested) arrays — the full shape of the
/// wallet's ShieldedProveParams (`string | string[] | string[][] | number[]`).
/// Deposit inputs are all scalars; withdraw/transfer add array signals (merklePath,
/// merklePathIndices, …).
fn json_to_bigints(v: &serde_json::Value, out: &mut Vec<BigInt>) -> Result<(), Box<dyn Error>> {
    match v {
        serde_json::Value::String(s) => {
            out.push(BigInt::parse_bytes(s.as_bytes(), 10).ok_or("param string is not a decimal")?);
        }
        serde_json::Value::Number(n) => {
            out.push(BigInt::parse_bytes(n.to_string().as_bytes(), 10).ok_or("param number is not an integer")?);
        }
        serde_json::Value::Array(a) => {
            for e in a {
                json_to_bigints(e, out)?;
            }
        }
        _ => return Err("param value must be a decimal string, integer, or array thereof".into()),
    }
    Ok(())
}

/// Parse a ShieldedProveParams JSON object into the witness calculator's per-signal
/// `Vec<BigInt>` form.
pub fn parse_params(params_json: &str) -> Result<HashMap<String, Vec<BigInt>>, Box<dyn Error>> {
    let flat: HashMap<String, serde_json::Value> = serde_json::from_str(params_json)?;
    let mut inputs: HashMap<String, Vec<BigInt>> = HashMap::new();
    for (k, v) in flat {
        let mut vals = Vec::new();
        json_to_bigints(&v, &mut vals)?;
        inputs.insert(k, vals);
    }
    Ok(inputs)
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
    let inputs = parse_params(params_json)?;
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

#[cfg(test)]
mod tests {
    use super::parse_params;

    #[test]
    fn parses_scalars_arrays_and_numbers() {
        // Mirrors the withdraw_change ShieldedProveParams shape: scalar decimal
        // strings + array-valued signals (merklePath, merklePathIndices).
        let json = r#"{
            "merkleRoot": "123",
            "merklePath": ["10", "20", "30"],
            "merklePathIndices": ["0", "1", "0"],
            "leafIndex": 5
        }"#;
        let out = parse_params(json).unwrap();
        assert_eq!(out["merkleRoot"], vec![123u64.into()]);
        assert_eq!(out["merklePath"], vec![10u64.into(), 20u64.into(), 30u64.into()]);
        assert_eq!(out["merklePathIndices"], vec![0u64.into(), 1u64.into(), 0u64.into()]);
        assert_eq!(out["leafIndex"], vec![5u64.into()], "JSON number handled");
    }

    #[test]
    fn flattens_nested_arrays_row_major() {
        let out = parse_params(r#"{"x": [["1","2"],["3","4"]]}"#).unwrap();
        assert_eq!(out["x"], vec![1u64.into(), 2u64.into(), 3u64.into(), 4u64.into()]);
    }
}
