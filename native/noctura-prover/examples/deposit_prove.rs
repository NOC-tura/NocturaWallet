//! Stage 0 (Tasks 0.1–0.3) — read the deployed deposit zkey, compute the witness
//! from the real deposit.wasm for a valid input, prove (arkworks Groth16 + circom
//! reduction), and verify against the zkey's VK. Pure Rust from the exact artifacts
//! the wallet downloads. No .r1cs / no vk.json needed.

use std::collections::HashMap;
use std::error::Error;
use std::fs::File;
use std::io::BufReader;

use ark_bn254::{Bn254, Fr};
use ark_circom::{read_zkey, CircomReduction, WitnessCalculator};
use ark_groth16::Groth16;
use ark_snark::SNARK;
use ark_std::rand::thread_rng;
use ark_std::UniformRand;
use num_bigint::BigInt;

fn main() -> Result<(), Box<dyn Error>> {
    // ---- read the proving key + constraint matrices from the snarkjs zkey ----
    let mut zkey_reader = BufReader::new(File::open("artifacts/deposit_final.zkey")?);
    let (params, matrices) = read_zkey(&mut zkey_reader)?;
    let n_public = matrices.num_instance_variables - 1;
    println!("read_zkey OK — nPublic = {n_public}, constraints = {}", matrices.num_constraints);
    assert_eq!(n_public, 3, "deposit nPublic must be 3");

    // ---- witness from the circom .wasm for a valid deposit input ----
    let input_json: HashMap<String, String> =
        serde_json::from_reader(BufReader::new(File::open("artifacts/deposit_input.json")?))?;
    let mut inputs: HashMap<String, Vec<BigInt>> = HashMap::new();
    for (k, v) in &input_json {
        let bi = BigInt::parse_bytes(v.as_bytes(), 10).ok_or("bad decimal input")?;
        inputs.insert(k.clone(), vec![bi]);
    }
    println!("inputs: {:?}", input_json.keys().collect::<Vec<_>>());

    let mut wtns = WitnessCalculator::new("artifacts/deposit.wasm")?;
    let full_assignment = wtns.calculate_witness_element::<Bn254, _>(inputs, false)?;
    println!("witness computed: {} elements (via wasmer)", full_assignment.len());

    // ---- prove (Groth16 + circom reduction, using the zkey matrices) ----
    let mut rng = thread_rng();
    let r = Fr::rand(&mut rng);
    let s = Fr::rand(&mut rng);
    let num_inputs = matrices.num_instance_variables;
    let num_constraints = matrices.num_constraints;

    let proof = Groth16::<Bn254, CircomReduction>::create_proof_with_reduction_and_matrices(
        &params,
        r,
        s,
        &matrices,
        num_inputs,
        num_constraints,
        full_assignment.as_slice(),
    )?;
    println!("proof generated (A/B/C points)");

    // ---- verify against the zkey's VK (== the deployed VK) ----
    let pvk = Groth16::<Bn254>::process_vk(&params.vk)?;
    let public_inputs = &full_assignment[1..num_inputs];
    let verified = Groth16::<Bn254>::verify_with_processed_vk(&pvk, public_inputs, &proof)?;
    println!("public inputs (nPublic={}): {:?}", n_public, public_inputs);
    assert!(verified, "proof MUST verify against the deployed VK");
    println!("PASS: on-device-equivalent deposit proof VERIFIES against the deployed VK");
    Ok(())
}
