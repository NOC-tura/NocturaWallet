//! Task 0.4 / validation (A) — THE key desktop de-risk. Parse an ON-CHAIN-ACCEPTED
//! reference proofBytes (from hosted /zk/prove, saved to artifacts/deposit_reference.json)
//! with OUR layout (pi_a negated, G2 c1-first, BE) and verify it against the deployed VK.
//! If it verifies, our serialization layout matches the format the devnet program accepts —
//! independent of the reference being a different random proof than ours.

use std::error::Error;
use std::fs::File;
use std::io::BufReader;
use std::str::FromStr;

use ark_bn254::{Bn254, Fr};
use ark_circom::read_zkey;
use ark_groth16::Groth16;
use ark_snark::SNARK;

fn main() -> Result<(), Box<dyn Error>> {
    // reference proof produced by the hosted prover for our test deposit input
    let reference: serde_json::Value =
        serde_json::from_reader(BufReader::new(File::open("artifacts/deposit_reference.json")?))?;
    let hex_str = reference["proofBytes"].as_str().ok_or("no proofBytes in reference")?;
    let public_dec: Vec<String> = reference["publicInputs"]
        .as_array()
        .ok_or("no publicInputs")?
        .iter()
        .map(|v| v.as_str().unwrap().to_string())
        .collect();
    println!("reference proofBytes: {} hex chars; publicInputs: {public_dec:?}", hex_str.len());

    let raw = hex::decode(hex_str)?;
    if raw.len() != 256 {
        return Err(format!("expected 256 proof bytes, got {}", raw.len()).into());
    }
    let mut bytes = [0u8; 256];
    bytes.copy_from_slice(&raw);

    // parse with OUR on-chain layout
    let proof = noctura_prover::proof_bytes::parse_proof(&bytes)?;

    // VK straight from the deployed zkey
    let (params, _matrices) = read_zkey(&mut BufReader::new(File::open("artifacts/deposit_final.zkey")?))?;
    let pvk = Groth16::<Bn254>::process_vk(&params.vk)?;

    let public_inputs: Vec<Fr> = public_dec
        .iter()
        .map(|s| Fr::from_str(s).map_err(|_| "bad public input"))
        .collect::<Result<_, _>>()?;

    let verified = Groth16::<Bn254>::verify_with_processed_vk(&pvk, &public_inputs, &proof)?;
    assert!(
        verified,
        "on-chain-accepted reference did NOT verify with our layout — the byte layout is wrong",
    );
    println!(
        "PASS: an ON-CHAIN-ACCEPTED reference proof verifies under our layout \
         (pi_a negated, G2 c1-first, BE) — serialize_proof matches the deployed program's format."
    );
    Ok(())
}
