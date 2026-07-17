//! Stage 0 (Tasks 0.1–0.3) — read the deployed deposit zkey, compute the witness
//! from the real deposit.wasm for a valid input, prove (arkworks Groth16 + circom
//! reduction), and verify against the zkey's VK. Pure Rust from the exact artifacts
//! the wallet downloads. No .r1cs / no vk.json needed.

use std::collections::HashMap;
use std::error::Error;
use std::fs::File;
use std::io::BufReader;

use ark_bn254::{Bn254, Fr};
use ark_circom::{read_zkey, CircomReduction};
use ark_ff::PrimeField;
use ark_groth16::Groth16;
use ark_snark::SNARK;
use ark_std::rand::thread_rng;
use ark_std::UniformRand;
use noctura_prover::witness_wasmi::WitnessCalculator;
use num_bigint::BigInt;

/// ark-bn254 Fr → canonical decimal string, to compare against known input values.
fn fr_dec(f: &Fr) -> String {
    f.into_bigint().to_string()
}

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

    let mut wtns = WitnessCalculator::from_file("artifacts/deposit.wasm")?;
    let full_assignment = wtns.calculate_witness_fr(inputs)?;
    println!("witness computed: {} elements (via wasmi, pure Rust)", full_assignment.len());

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
    assert!(verified, "proof MUST verify against the deployed VK");

    // ---- cross-check the wasmi witness against known input values ----
    // A satisfying witness (verify=true) is already strong; additionally assert the
    // public signals are exactly our known inputs (so the witness isn't a valid proof
    // of some OTHER statement). Every public input must be one of our input values,
    // and the commitment must appear among them.
    let pub_dec: Vec<String> = public_inputs.iter().map(fr_dec).collect();
    println!("public inputs (nPublic={n_public}): {pub_dec:?}");
    let known: std::collections::HashSet<&String> = input_json.values().collect();
    for p in &pub_dec {
        assert!(known.contains(p), "public input {p} is not one of the known deposit inputs");
    }
    assert!(
        pub_dec.contains(&input_json["commitment"]),
        "the deposit commitment must be a public input",
    );
    println!("PASS: deposit proof VERIFIES against the deployed VK (witness via wasmi); public inputs cross-checked");

    // ---- serialize to the 256-byte on-chain layout + round-trip verify (validation B) ----
    let proof_bytes = noctura_prover::proof_bytes::serialize_proof(&proof);
    assert_eq!(proof_bytes.len(), 256);
    println!("proofBytes (256B, on-chain layout): {}", hex::encode(proof_bytes));
    let parsed = noctura_prover::proof_bytes::parse_proof(&proof_bytes)?;
    let rt = Groth16::<Bn254>::verify_with_processed_vk(&pvk, public_inputs, &parsed)?;
    assert!(rt, "round-trip: serialized -> parsed proof must still verify");
    println!("PASS: proofBytes round-trips + verifies (on-chain layout: pi_a negated, G2 c1-first, BE)");
    Ok(())
}
