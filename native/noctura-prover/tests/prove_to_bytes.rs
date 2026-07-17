//! Integration test for the reusable prove core (cwd = crate root → artifacts/ resolves).

use noctura_prover::prover::prove_to_bytes;

#[test]
fn deposit_prove_to_bytes_matches_public_inputs() {
    let params = std::fs::read_to_string("artifacts/deposit_input.json").unwrap();
    let out = prove_to_bytes(
        "deposit",
        &params,
        "artifacts/deposit_final.zkey",
        "artifacts/deposit.wasm",
    )
    .unwrap();

    assert_eq!(out.proof_bytes_hex.len(), 512, "256 bytes hex");
    assert_eq!(out.public_inputs.len(), 3, "deposit nPublic");
    // commitment (public signal 0) for the fixed test input
    assert_eq!(
        out.public_inputs[0],
        "8081702745406920529902264228351723735379273324999453834569345340835518474946",
    );
}
