//! `prove` (spec §3 "prove", R4, I11, m4, m-5, m10, §14 "a proof of each circuit verifies…",
//! "pinned-digest refusal", "the allow-list refusals… the signal table… the counts").
//!
//! Expected values come from `tests/fixtures/a0-prove-vectors.json` and `tests/fixtures/a0-vk/`,
//! written OFFLINE by `scripts/a0-vectors/gen-prove-vectors.mjs` (the app's A0 equations /
//! poseidon-lite, @solana/web3.js, the Task 1 key fixture; the program side's public-input order,
//! deployed VKs and LANDED proofs, sha256-pinned; its `--snarkjs` run proved and verified every
//! scenario with snarkjs). Nothing here computes an expected value with the code under test.
//!
//! THE KEY FILES. The A0 `.zkey` / `.wasm` (MBs) are never committed. The tests that need them
//! read `NOCTURA_A0_KEYS_DIR` (a directory holding the four pinned files: locally the program
//! side's `zk/keys/v2/`; in CI the files the workflow downloads by digest). Without it they SKIP,
//! writing `A0-KEYS-SKIPPED <test>` straight to stderr (past libtest's capture, so the skip shows
//! in a passing run); under CI (`CI` set) a missing directory FAILS instead. Every other test
//! runs without them.

use super::auth::{AuthId, AUTH_TTL};
use super::field::{Fr, MINT};
use super::keyfiles::{self, Pin};
use super::prove::{run, Circuit, DEPOSIT_TABLE, WITHDRAW_CHANGE_TABLE};
use super::state::{A0Error, Core, Handle};
use super::unshield::POOL;
use crate::proof_bytes::{parse_proof, serialize_proof};
use crate::witness_wasmi::{probe, WitnessCalculator};
use ark_bn254::{Bn254, Fq, Fq2, G1Affine, G2Affine};
use ark_circom::read_zkey;
use ark_groth16::{Groth16, Proof as ArkProof, VerifyingKey};
use ark_snark::SNARK;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::time::Duration;

const VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-prove-vectors.json"
));
const KEY_VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-key-vectors.json"
));
const DEPOSIT_VK: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-vk/deposit_vk.json"
));
const WITHDRAW_CHANGE_VK: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-vk/withdraw_change_vk.json"
));
/// The repo's public test seed (BIP-39 of "abandon … about", no passphrase) — the fixture's seeds[0].
const SEED_HEX: &str = "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4";
const T0: Duration = Duration::from_secs(1_000);
/// Never read: the refusals under test happen before any key file is opened.
const NO_FILE: &str = "/nonexistent/never-read";

// ------------------------------------------------------------------------------- helpers

fn vectors() -> Value {
    serde_json::from_str(VECTORS).unwrap()
}
fn scenario(i: usize) -> Value {
    vectors()["scenarios"][i].clone()
}
/// [0] deposit; [1] withdraw_change at leaf 5 (change 999590000); [2] withdraw_change, change 0.
fn deposit_sc() -> Value {
    scenario(0)
}
fn withdraw_sc(i: usize) -> Value {
    scenario(i)
}
fn be32(v: &Value) -> [u8; 32] {
    hex::decode(v.as_str().unwrap())
        .unwrap()
        .try_into()
        .unwrap()
}
fn publics(sc: &Value) -> Vec<[u8; 32]> {
    sc["publicInputs"]
        .as_array()
        .unwrap()
        .iter()
        .map(be32)
        .collect()
}
fn open(core: &Core) -> Handle {
    let mut seed: [u8; 64] = hex::decode(SEED_HEX).unwrap().try_into().unwrap();
    core.keys_open(&mut seed).unwrap()
}
fn authorize(core: &Core, h: Handle, sc: &Value, now: Duration) -> AuthId {
    let a = &sc["authorization"];
    core.authorize_unshield_at(
        h,
        a["owner"].as_str().unwrap(),
        a["amount"].as_str().unwrap(),
        a["fee"].as_str().unwrap(),
        now,
    )
    .unwrap()
}
fn wit(sc: &Value) -> String {
    sc["witness"].to_string()
}
/// Everything up to the key files (the lock section), at T0.
fn complete(
    core: &Core,
    h: Handle,
    circuit: &str,
    witness: &str,
    auth: Option<AuthId>,
) -> Result<super::prove::Completed, A0Error> {
    core.complete(h, circuit, witness, auth, T0)
}
fn complete_err(
    core: &Core,
    h: Handle,
    circuit: &str,
    witness: &str,
    auth: Option<AuthId>,
) -> A0Error {
    match complete(core, h, circuit, witness, auth) {
        Ok(_) => panic!("expected a refusal"),
        Err(e) => e,
    }
}
/// A live authorization still there? (taking it with the right id would succeed).
fn auth_is_live(core: &Core) -> bool {
    core.lock().unwrap().peek_auth_expiry_for_test().is_some()
}
fn with_key(sc: &Value, key: &str, value: Value) -> String {
    let mut w = sc["witness"].clone();
    w[key] = value;
    w.to_string()
}
fn without_key(sc: &Value, key: &str) -> String {
    let mut w = sc["witness"].clone();
    w.as_object_mut().unwrap().remove(key);
    w.to_string()
}

/// The key-file directory, or `None` (the test then returns early, loudly).
pub(super) fn keys_dir(test: &str) -> Option<PathBuf> {
    match std::env::var_os("NOCTURA_A0_KEYS_DIR") {
        Some(d) => Some(PathBuf::from(d)),
        None => {
            assert!(
                std::env::var_os("CI").is_none(),
                "{test}: CI must provide NOCTURA_A0_KEYS_DIR (the A0 key files) — refusing to skip"
            );
            // Straight to the process's stderr: libtest captures print!/eprint!, not this.
            let _ = writeln!(
                std::io::stderr(),
                "A0-KEYS-SKIPPED {test}: NOCTURA_A0_KEYS_DIR is not set — this test did NOT run"
            );
            None
        }
    }
}
fn key_path(dir: &Path, pin: &Pin) -> PathBuf {
    dir.join(pin.file)
}
fn paths(dir: &Path, c: Circuit) -> (PathBuf, PathBuf) {
    (key_path(dir, &c.pins().zkey), key_path(dir, &c.pins().wasm))
}

// snarkjs verifying-key JSON → arkworks (G2 in the JSON is [c0, c1]).
fn fq(v: &Value) -> Fq {
    Fq::from_str(v.as_str().unwrap()).unwrap()
}
fn g1(v: &Value) -> G1Affine {
    assert_eq!(v[2], "1");
    let p = G1Affine::new_unchecked(fq(&v[0]), fq(&v[1]));
    assert!(p.is_on_curve() && p.is_in_correct_subgroup_assuming_on_curve());
    p
}
fn g2(v: &Value) -> G2Affine {
    assert_eq!(v[2], json!(["1", "0"]));
    let p = G2Affine::new_unchecked(
        Fq2::new(fq(&v[0][0]), fq(&v[0][1])),
        Fq2::new(fq(&v[1][0]), fq(&v[1][1])),
    );
    assert!(p.is_on_curve() && p.is_in_correct_subgroup_assuming_on_curve());
    p
}
fn vk(json: &str) -> VerifyingKey<Bn254> {
    let v: Value = serde_json::from_str(json).unwrap();
    VerifyingKey {
        alpha_g1: g1(&v["vk_alpha_1"]),
        beta_g2: g2(&v["vk_beta_2"]),
        gamma_g2: g2(&v["vk_gamma_2"]),
        delta_g2: g2(&v["vk_delta_2"]),
        gamma_abc_g1: v["IC"].as_array().unwrap().iter().map(g1).collect(),
    }
}
fn vk_of(c: Circuit) -> VerifyingKey<Bn254> {
    vk(match c {
        Circuit::Deposit => DEPOSIT_VK,
        Circuit::WithdrawChange => WITHDRAW_CHANGE_VK,
    })
}
fn frs(publics: &[[u8; 32]]) -> Vec<Fr> {
    publics
        .iter()
        .map(|b| super::field::fr_from_be32(b).unwrap())
        .collect()
}
fn verifies(vk: &VerifyingKey<Bn254>, proof: &ArkProof<Bn254>, publics: &[[u8; 32]]) -> bool {
    let pvk = Groth16::<Bn254>::process_vk(vk).unwrap();
    Groth16::<Bn254>::verify_with_processed_vk(&pvk, &frs(publics), proof).unwrap()
}
fn bytes256(hex_str: &str) -> [u8; 256] {
    hex::decode(hex_str).unwrap().try_into().unwrap()
}

// ---------------------------------------------------- the tables and the allow-lists (m-5)

#[test]
fn each_allow_list_and_its_rust_filled_names_partition_the_circuits_table() {
    for table in [&DEPOSIT_TABLE, &WITHDRAW_CHANGE_TABLE] {
        let signals: Vec<&str> = table.signals().map(|s| s.name).collect();
        let distinct: HashSet<&str> = signals.iter().copied().collect();
        assert_eq!(distinct.len(), signals.len(), "a signal is listed twice");
        let mapped: Vec<&str> = table.js.iter().map(|(_, sig)| *sig).collect();
        let api: HashSet<&str> = table.js.iter().map(|(api, _)| *api).collect();
        assert_eq!(api.len(), table.js.len(), "an API name is listed twice");
        let mut union: Vec<&str> = mapped.iter().chain(table.rust.iter()).copied().collect();
        let n = union.len();
        union.sort_unstable();
        union.dedup();
        assert_eq!(
            union.len(),
            n,
            "a signal is both JS-supplied and Rust-filled"
        );
        let mut want: Vec<&str> = signals.clone();
        want.sort_unstable();
        assert_eq!(union, want, "mapped(JS) ∪ Rust-filled is not the table");
    }
    // The documented allow-lists (spec §3), as API names.
    let api = |t: &super::prove::Table| t.js.iter().map(|(a, _)| *a).collect::<Vec<_>>();
    assert_eq!(api(&DEPOSIT_TABLE), ["amount", "depositIndex"]);
    assert_eq!(
        api(&WITHDRAW_CHANGE_TABLE),
        [
            "merkleRoot",
            "inputAmount",
            "rho",
            "pathElements",
            "pathIndices"
        ]
    );
    assert_eq!(
        DEPOSIT_TABLE.js[1],
        ("depositIndex", "rho"),
        "depositIndex maps to rho"
    );
}

#[test]
fn the_public_order_is_the_program_sides() {
    let v = vectors();
    for (table, c) in [
        (&DEPOSIT_TABLE, "deposit"),
        (&WITHDRAW_CHANGE_TABLE, "withdraw_change"),
    ] {
        let ours: Vec<&str> = table.public.iter().map(|s| s.name).collect();
        let theirs: Vec<&str> = v["publicInputOrder"][c]
            .as_array()
            .unwrap()
            .iter()
            .map(|x| x.as_str().unwrap())
            .collect();
        assert_eq!(ours, theirs, "{c}");
        assert!(table.public.iter().all(|s| s.len == 1));
    }
}

#[test]
fn the_completed_witness_has_exactly_the_tables_signals_in_order() {
    let core = Core::new();
    let h = open(&core);
    let d = complete(&core, h, "deposit", &wit(&deposit_sc()), None).unwrap();
    let want: Vec<&str> = DEPOSIT_TABLE.signals().map(|s| s.name).collect();
    assert_eq!(d.names(), want);
    let sc = withdraw_sc(1);
    let id = authorize(&core, h, &sc, T0);
    let w = complete(&core, h, "withdraw_change", &wit(&sc), Some(id)).unwrap();
    let want: Vec<&str> = WITHDRAW_CHANGE_TABLE.signals().map(|s| s.name).collect();
    assert_eq!(w.names(), want);
}

// ------------------------------------------- the values Rust completes (JS recomputes them)

#[test]
fn the_deposit_public_inputs_are_the_desk_values() {
    let core = Core::new();
    let h = open(&core);
    let sc = deposit_sc();
    let d = complete(&core, h, "deposit", &wit(&sc), None).unwrap();
    assert_eq!(d.publics_be32(), publics(&sc));
    // and the commitment / rho are the public calls' own (what JS stores for the note)
    let rho = core.deposit_rho(h, 0).unwrap();
    assert_eq!(d.publics_be32()[3], rho);
    assert_eq!(
        d.publics_be32()[0],
        core.commitment(h, 1_000_000_000, &rho).unwrap()
    );
}

#[test]
fn the_withdraw_change_public_inputs_take_amount_fee_and_destination_from_the_authorization() {
    for i in [1, 2] {
        let core = Core::new();
        let h = open(&core);
        let sc = withdraw_sc(i);
        let id = authorize(&core, h, &sc, T0);
        let w = complete(&core, h, "withdraw_change", &wit(&sc), Some(id)).unwrap();
        assert_eq!(w.publics_be32(), publics(&sc), "{}", sc["label"]);
    }
    // Negative control: another authorized amount gives other public inputs (withdrawAmount and
    // the change commitment) for the same JS witness.
    let core = Core::new();
    let h = open(&core);
    let sc = withdraw_sc(1);
    let a = &sc["authorization"];
    let id = core
        .authorize_unshield_at(h, a["owner"].as_str().unwrap(), "400001", "10000", T0)
        .unwrap();
    let w = complete(&core, h, "withdraw_change", &wit(&sc), Some(id)).unwrap();
    let got = w.publics_be32();
    let want = publics(&sc);
    assert_ne!(got[2], want[2]);
    assert_ne!(got[5], want[5]);
    assert_eq!(got[..2], want[..2]);
}

// ----------------------------------------------------------------- the circuit name

#[test]
fn transfer_is_refused_in_m1_and_unknown_circuits_are_refused() {
    let core = Core::new();
    let h = open(&core);
    let w = wit(&deposit_sc());
    assert_eq!(
        complete_err(&core, h, "transfer", &w, None),
        A0Error::CircuitNotInM1
    );
    for name in ["", "Deposit", "withdraw", "deposit ", "withdraw_change\0"] {
        assert_eq!(
            complete_err(&core, h, name, &w, None),
            A0Error::CircuitUnknown,
            "{name:?}"
        );
    }
    // Through the public prove, the same.
    let p = Path::new(NO_FILE);
    assert_eq!(
        core.prove(h, "transfer", &w, None, p, p).unwrap_err(),
        A0Error::CircuitNotInM1
    );
}

// --------------------------------------------------------------- the allow-list (I11)

#[test]
fn every_rust_filled_name_is_refused_even_with_a_well_formed_value() {
    let core = Core::new();
    let h = open(&core);
    let field = json!("0000000000000000000000000000000000000000000000000000000000000001");
    for (table, circuit, sc) in [
        (&DEPOSIT_TABLE, "deposit", deposit_sc()),
        (&WITHDRAW_CHANGE_TABLE, "withdraw_change", withdraw_sc(1)),
    ] {
        let api: Vec<&str> = table.js.iter().map(|(a, _)| *a).collect();
        let refused: Vec<&str> = table
            .signals()
            .map(|s| s.name)
            .filter(|n| !api.contains(n))
            .collect();
        assert_eq!(
            refused.len(),
            table.rust.len() + usize::from(circuit == "deposit"),
            "deposit also refuses `rho` (JS names it depositIndex)"
        );
        for name in refused {
            let id = (circuit == "withdraw_change").then(|| authorize(&core, h, &sc, T0));
            assert_eq!(
                complete_err(&core, h, circuit, &with_key(&sc, name, field.clone()), id),
                A0Error::WitnessRustFilled {
                    name: table.signals().find(|s| s.name == name).unwrap().name
                },
                "{circuit}.{name}"
            );
        }
    }
}

#[test]
fn unknown_missing_repeated_and_non_object_witnesses_are_refused() {
    let core = Core::new();
    let h = open(&core);
    let sc = deposit_sc();
    for key in [
        "amountt",
        "Amount",
        "",
        "depositindex",
        "secret",
        "ivk",
        "sk",
    ] {
        assert_eq!(
            complete_err(&core, h, "deposit", &with_key(&sc, key, json!("1")), None),
            A0Error::WitnessUnknownKey,
            "{key:?}"
        );
    }
    for key in ["amount", "depositIndex"] {
        assert_eq!(
            complete_err(&core, h, "deposit", &without_key(&sc, key), None),
            A0Error::WitnessMissing { name: key }
        );
    }
    let repeated = r#"{"amount":"1000000000","depositIndex":"0","amount":"1000000000"}"#;
    assert_eq!(
        complete_err(&core, h, "deposit", repeated, None),
        A0Error::WitnessDuplicate { name: "amount" }
    );
    for bad in [
        "",
        "[]",
        "null",
        "\"x\"",
        "{",
        r#"{"amount":"1000000000","depositIndex":"0"} {}"#,
        r#"{"amount":"1000000000","depositIndex":"0"},"#,
    ] {
        assert_eq!(
            complete_err(&core, h, "deposit", bad, None),
            A0Error::WitnessJson,
            "{bad:?}"
        );
    }
    // Positive control: the fixture's witness passes, and so does its key order reversed.
    complete(&core, h, "deposit", &wit(&sc), None).unwrap();
    complete(
        &core,
        h,
        "deposit",
        r#"{"depositIndex":"0","amount":"1000000000"}"#,
        None,
    )
    .unwrap();
}

#[test]
fn witness_values_must_have_their_one_canonical_form() {
    let core = Core::new();
    let h = open(&core);
    let r = "30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001"; // = r
    let d = deposit_sc();
    for (key, v) in [
        ("amount", json!(1_000_000_000u64)),
        ("amount", json!("01")),
        ("amount", json!("+1")),
        ("amount", json!("18446744073709551616")),
        ("amount", json!(" 1")),
        ("depositIndex", json!("-1")),
        ("depositIndex", json!(null)),
    ] {
        assert_eq!(
            complete_err(&core, h, "deposit", &with_key(&d, key, v.clone()), None),
            A0Error::WitnessValue {
                name: if key == "amount" {
                    "amount"
                } else {
                    "depositIndex"
                },
                index: 0
            },
            "{key} = {v}"
        );
    }
    assert_eq!(
        complete_err(
            &core,
            h,
            "deposit",
            &with_key(&d, "amount", json!("0")),
            None
        ),
        A0Error::AmountZero
    );
    let sc = withdraw_sc(1);
    let mut cases: Vec<(String, A0Error)> = Vec::new();
    for v in [
        json!(r),
        json!(r.to_uppercase()),
        json!(&r[1..]),
        json!(format!("0x{}", &r[2..])),
        json!(1),
    ] {
        cases.push((
            with_key(&sc, "merkleRoot", v.clone()),
            A0Error::WitnessValue {
                name: "merkleRoot",
                index: 0,
            },
        ));
        cases.push((
            with_key(&sc, "rho", v),
            A0Error::WitnessValue {
                name: "rho",
                index: 0,
            },
        ));
    }
    let mut pe = sc["witness"]["pathElements"].clone();
    pe[7] = json!(r);
    cases.push((
        with_key(&sc, "pathElements", pe),
        A0Error::WitnessValue {
            name: "pathElements",
            index: 7,
        },
    ));
    let mut short = sc["witness"]["pathElements"].clone();
    short.as_array_mut().unwrap().pop();
    cases.push((
        with_key(&sc, "pathElements", short),
        A0Error::WitnessValue {
            name: "pathElements",
            index: 20,
        },
    ));
    for bad in [json!(2), json!("1"), json!(-1), json!(1.0), json!(true)] {
        let mut pi = sc["witness"]["pathIndices"].clone();
        pi[3] = bad;
        cases.push((
            with_key(&sc, "pathIndices", pi),
            A0Error::WitnessValue {
                name: "pathIndices",
                index: 3,
            },
        ));
    }
    let mut long = sc["witness"]["pathIndices"].clone();
    long.as_array_mut().unwrap().push(json!(0));
    cases.push((
        with_key(&sc, "pathIndices", long),
        A0Error::WitnessValue {
            name: "pathIndices",
            index: 20,
        },
    ));
    cases.push((
        with_key(&sc, "inputAmount", json!("1000000000.0")),
        A0Error::WitnessValue {
            name: "inputAmount",
            index: 0,
        },
    ));
    for (w, want) in cases {
        let id = authorize(&core, h, &sc, T0);
        assert_eq!(
            complete_err(&core, h, "withdraw_change", &w, Some(id)),
            want
        );
    }
}

// ---------------------------------------------------- the authorization (INV-AUTH, §3)

#[test]
fn withdraw_change_needs_a_live_authorization_and_every_prove_consumes_it() {
    let sc = withdraw_sc(1);
    let w = wit(&sc);
    // absent: no authId → refused, and a live record is dropped by that call
    let core = Core::new();
    let h = open(&core);
    assert_eq!(
        complete_err(&core, h, "withdraw_change", &w, None),
        A0Error::AuthAbsent
    );
    let id = authorize(&core, h, &sc, T0);
    assert_eq!(
        complete_err(&core, h, "withdraw_change", &w, None),
        A0Error::AuthAbsent
    );
    assert!(!auth_is_live(&core));
    assert_eq!(
        complete_err(&core, h, "withdraw_change", &w, Some(id)),
        A0Error::AuthAbsent,
        "the authorization went with the first prove"
    );
    // used once: success, then the same id again
    let id = authorize(&core, h, &sc, T0);
    complete(&core, h, "withdraw_change", &w, Some(id)).unwrap();
    assert_eq!(
        complete_err(&core, h, "withdraw_change", &w, Some(id)),
        A0Error::AuthAbsent
    );
    // another id: refused, and the live one is used up
    let id = authorize(&core, h, &sc, T0);
    assert_eq!(
        complete_err(
            &core,
            h,
            "withdraw_change",
            &w,
            Some(AuthId::from_bytes([7; 16]))
        ),
        A0Error::AuthMismatch
    );
    assert_eq!(
        complete_err(&core, h, "withdraw_change", &w, Some(id)),
        A0Error::AuthAbsent
    );
    // expired: usable at approval + 120 s − 1 ns, not at + 120 s
    let id = authorize(&core, h, &sc, T0);
    complete(&core, h, "withdraw_change", &w, Some(id)).unwrap();
    let id = authorize(&core, h, &sc, T0);
    assert_eq!(
        core.complete(h, "withdraw_change", &w, Some(id), T0 + AUTH_TTL)
            .err(),
        Some(A0Error::AuthExpired)
    );
    let id = authorize(&core, h, &sc, T0);
    core.complete(
        h,
        "withdraw_change",
        &w,
        Some(id),
        T0 + AUTH_TTL - Duration::from_nanos(1),
    )
    .unwrap();
    // from a closed handle, and from a replaced one
    let id = authorize(&core, h, &sc, T0);
    core.keys_close(h).unwrap();
    assert_eq!(
        complete_err(&core, h, "withdraw_change", &w, Some(id)),
        A0Error::UnknownHandle
    );
    let h1 = open(&core);
    let id = authorize(&core, h1, &sc, T0);
    let h2 = open(&core);
    assert_eq!(
        complete_err(&core, h1, "withdraw_change", &w, Some(id)),
        A0Error::UnknownHandle
    );
    assert_eq!(
        complete_err(&core, h2, "withdraw_change", &w, Some(id)),
        A0Error::AuthAbsent
    );
}

#[test]
fn a_prove_that_refuses_for_any_reason_still_uses_the_authorization_up() {
    let sc = withdraw_sc(1);
    let core = Core::new();
    let h = open(&core);
    let refusals: Vec<(&str, String)> = vec![
        ("transfer", wit(&sc)),
        ("nope", wit(&sc)),
        ("withdraw_change", "{".to_string()),
        (
            "withdraw_change",
            with_key(&sc, "nk", json!("00".repeat(32))),
        ),
        ("withdraw_change", without_key(&sc, "rho")),
        ("deposit", wit(&deposit_sc())),
    ];
    for (circuit, w) in refusals {
        let id = authorize(&core, h, &sc, T0);
        assert!(complete(&core, h, circuit, &w, Some(id)).is_err());
        assert!(!auth_is_live(&core), "{circuit}");
        assert_eq!(
            complete_err(&core, h, "withdraw_change", &wit(&sc), Some(id)),
            A0Error::AuthAbsent,
            "{circuit}: the record survived a refused prove"
        );
    }
}

#[test]
fn a_deposit_refuses_an_authorization_and_uses_it_up() {
    let core = Core::new();
    let h = open(&core);
    let sc = withdraw_sc(1);
    let id = authorize(&core, h, &sc, T0);
    assert_eq!(
        complete_err(&core, h, "deposit", &wit(&deposit_sc()), Some(id)),
        A0Error::AuthUnexpected
    );
    assert!(!auth_is_live(&core));
    // a deposit without one is fine, and drops a live record (every prove consumes it)
    let id = authorize(&core, h, &sc, T0);
    complete(&core, h, "deposit", &wit(&deposit_sc()), None).unwrap();
    assert_eq!(
        complete_err(&core, h, "withdraw_change", &wit(&sc), Some(id)),
        A0Error::AuthAbsent
    );
}

#[test]
fn amount_plus_fee_above_the_note_is_refused_and_equal_is_accepted() {
    let core = Core::new();
    let h = open(&core);
    let sc = withdraw_sc(2); // 999_990_000 + 10_000 = 1_000_000_000 = inputAmount: change 0
    assert_eq!(sc["changeAmount"], "0");
    let id = authorize(&core, h, &sc, T0);
    complete(&core, h, "withdraw_change", &wit(&sc), Some(id)).unwrap();
    let owner = sc["authorization"]["owner"].as_str().unwrap();
    for (amount, fee) in [("999990001", "10000"), ("999990000", "10001")] {
        let id = core
            .authorize_unshield_at(h, owner, amount, fee, T0)
            .unwrap();
        assert_eq!(
            complete_err(&core, h, "withdraw_change", &wit(&sc), Some(id)),
            A0Error::WithdrawExceedsInput,
            "{amount} + {fee}"
        );
    }
}

#[test]
fn an_inconsistent_authorization_record_is_refused() {
    let sc = withdraw_sc(1);
    let core = Core::new();
    let h = open(&core);
    // Take a real record out (consumes it), then plant edited copies of it.
    let real = {
        let id = authorize(&core, h, &sc, T0);
        core.lock().unwrap().take_auth(h, &id, T0).unwrap()
    };
    type Edit = fn(&mut super::auth::Auth);
    let edits: [(&str, Edit); 4] = [
        ("pool", |a| a.pool[0] ^= 1),
        ("mint", |a| a.mint[31] ^= 1),
        ("ata", |a| a.ata[5] ^= 1),
        ("owner", |a| a.owner = [0x11; 32]),
    ];
    for (what, edit) in edits {
        let mut planted = real_copy(&real);
        edit(&mut planted);
        let id = planted.id;
        core.lock().unwrap().plant_auth_for_test(planted);
        assert_eq!(
            complete_err(&core, h, "withdraw_change", &wit(&sc), Some(id)),
            A0Error::AuthRecordInconsistent,
            "{what}"
        );
    }
    // Positive control: the unedited copy completes.
    let planted = real_copy(&real);
    let id = planted.id;
    core.lock().unwrap().plant_auth_for_test(planted);
    complete(&core, h, "withdraw_change", &wit(&sc), Some(id)).unwrap();
    assert_eq!(real.pool, POOL);
    assert_eq!(real.mint, MINT);
}

fn real_copy(a: &super::auth::Auth) -> super::auth::Auth {
    super::auth::Auth {
        id: a.id,
        handle: a.handle,
        owner: a.owner,
        ata: a.ata,
        amount: a.amount,
        fee: a.fee,
        pool: a.pool,
        mint: a.mint,
        expires_at: a.expires_at,
    }
}

#[test]
fn a_note_not_in_the_named_tree_is_refused_before_any_key_file() {
    let core = Core::new();
    let h = open(&core);
    let sc = withdraw_sc(1);
    let other = json!("00000000000000000000000000000000000000000000000000000000000003ee");
    let mut pe = sc["witness"]["pathElements"].clone();
    pe[0] = other.clone();
    let mut pi = sc["witness"]["pathIndices"].clone();
    pi[0] = json!(0); // leaf 5 is a right child: index 0 puts it on the wrong side
    let cases = [
        with_key(&sc, "pathElements", pe),
        with_key(&sc, "pathIndices", pi),
        with_key(&sc, "merkleRoot", other),
        with_key(&sc, "inputAmount", json!("999999999")),
        with_key(&sc, "rho", withdraw_sc(2)["witness"]["rho"].clone()),
    ];
    for w in cases {
        let id = authorize(&core, h, &sc, T0);
        let p = Path::new(NO_FILE);
        assert_eq!(
            core.prove_at(h, "withdraw_change", &w, Some(id), p, p, T0)
                .unwrap_err(),
            A0Error::WitnessNotInTree
        );
    }
}

// ------------------------------------------------- no witness value in any refusal (m4)

#[test]
fn no_refusal_carries_a_witness_or_key_value() {
    let kv: Value = serde_json::from_str(KEY_VECTORS).unwrap();
    let seed = &kv["seeds"][0];
    let sc = withdraw_sc(1);
    let mut secrets: Vec<String> = vec![];
    for k in ["nk", "dSelf", "addrSelf", "ivk", "sk"] {
        let h = seed[k].as_str().unwrap().to_string();
        let dec = num_bigint::BigUint::parse_bytes(h.as_bytes(), 16)
            .unwrap()
            .to_string();
        secrets.push(h);
        secrets.push(dec);
    }
    for k in ["merkleRoot", "rho"] {
        secrets.push(sc["witness"][k].as_str().unwrap().to_string());
    }
    secrets.push(
        sc["witness"]["pathElements"][1]
            .as_str()
            .unwrap()
            .to_string(),
    );
    secrets.push("1000000000".into());
    secrets.push("987654321987".into());
    let core = Core::new();
    let h = open(&core);
    let mut errors = vec![];
    let mut run = |circuit: &str, w: String, auth: bool| {
        let id = auth.then(|| authorize(&core, h, &sc, T0));
        errors.push(complete_err(&core, h, circuit, &w, id));
    };
    let r = "30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001";
    run(
        "withdraw_change",
        with_key(&sc, "nk", json!(seed["nk"])),
        true,
    );
    run(
        "withdraw_change",
        with_key(&sc, "d", json!(seed["dSelf"])),
        true,
    );
    run(
        "withdraw_change",
        with_key(&sc, "inputAmount", json!("987654321987x")),
        true,
    );
    run(
        "withdraw_change",
        with_key(&sc, "inputAmount", json!("987654321987")),
        true,
    );
    run("withdraw_change", with_key(&sc, "rho", json!(r)), true);
    run(
        "withdraw_change",
        with_key(&sc, "merkleRoot", json!(seed["addrSelf"])),
        true,
    );
    run("withdraw_change", wit(&sc).replace('}', ",}"), true);
    run(
        "withdraw_change",
        with_key(&sc, seed["nk"].as_str().unwrap(), json!("1")),
        true,
    );
    run("withdraw_change", wit(&sc), false);
    run("transfer", wit(&sc), true);
    run("deposit", wit(&deposit_sc()), true);
    let d = deposit_sc();
    run(
        "deposit",
        with_key(&d, "amount", json!("1000000000 ")),
        false,
    );
    run("deposit", with_key(&d, "rho", json!(seed["nk"])), false);
    assert!(errors.len() >= 13);
    for e in &errors {
        for text in [e.to_string(), format!("{e:?}")] {
            for s in &secrets {
                assert!(!text.contains(s.as_str()), "{text:?} carries {s}");
            }
            assert!(text.len() < 90, "{text:?}");
        }
    }
    // Positive control on the check itself: a message that did carry a value would be caught.
    assert!(format!("rho {}", secrets[10]).contains(secrets[10].as_str()));
}

// ------------------------------------------------------------ the pinned key files (R4)

#[test]
fn the_pins_are_where_ci_reads_them() {
    // The workflow greps `file: "…", sha256: "…"` from this source: four pairs, the pinned ones.
    let src = include_str!("keyfiles.rs");
    let pairs: Vec<(String, String)> = src
        .lines()
        .filter_map(|l| {
            let f = l.split("file: \"").nth(1)?.split('"').next()?;
            let s = l.split("sha256: \"").nth(1)?.split('"').next()?;
            Some((f.to_string(), s.to_string()))
        })
        .collect();
    let pins = [
        keyfiles::DEPOSIT.zkey,
        keyfiles::DEPOSIT.wasm,
        keyfiles::WITHDRAW_CHANGE.zkey,
        keyfiles::WITHDRAW_CHANGE.wasm,
    ];
    let want: Vec<(String, String)> = pins
        .iter()
        .map(|p| (p.file.to_string(), p.sha256.to_string()))
        .collect();
    assert_eq!(pairs, want);
    for p in pins {
        assert!(p.sha256.len() == 64 && p.sha256.bytes().all(|b| b.is_ascii_hexdigit()));
        assert_eq!(p.sha256, p.sha256.to_lowercase());
        assert!(p.len > 0);
    }
}

#[test]
fn a_key_file_that_is_not_the_pinned_bytes_is_refused() {
    let dir = std::env::temp_dir().join(format!("a0-pin-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let pin = keyfiles::DEPOSIT.zkey;
    let short = dir.join("short");
    std::fs::write(&short, b"not a zkey").unwrap();
    let same_len = dir.join("same_len");
    std::fs::write(&same_len, vec![0u8; pin.len as usize]).unwrap();
    assert_eq!(
        keyfiles::load(&short, &pin),
        Err(A0Error::KeyFilePin { file: pin.file })
    );
    assert_eq!(
        keyfiles::load(&same_len, &pin),
        Err(A0Error::KeyFilePin { file: pin.file })
    );
    assert_eq!(
        keyfiles::load(&dir.join("absent"), &pin),
        Err(A0Error::KeyFileRead { file: pin.file })
    );
    // Through prove: a valid deposit witness, bad files → refused at the zkey.
    let core = Core::new();
    let h = open(&core);
    assert_eq!(
        core.prove(h, "deposit", &wit(&deposit_sc()), None, &same_len, &short)
            .unwrap_err(),
        A0Error::KeyFilePin { file: pin.file }
    );
    std::fs::remove_dir_all(&dir).unwrap();
}

// --------------------------------------------- the on-chain layout against landed proofs (m10)

#[test]
fn landed_withdraw_change_proofs_verify_under_our_layout_against_the_deployed_vk() {
    let v = vectors();
    let vk = vk_of(Circuit::WithdrawChange);
    let landed = v["landed"].as_array().unwrap();
    assert_eq!(landed.len(), 2);
    for l in landed {
        let bytes = bytes256(l["proofBytes"].as_str().unwrap());
        let publics = publics(l);
        let proof = parse_proof(&bytes).unwrap();
        assert!(verifies(&vk, &proof, &publics), "{}", l["label"]);
        assert_eq!(
            serialize_proof(&proof),
            bytes,
            "serialize(parse(x)) = x on landed bytes"
        );
        // Negative controls: each part of the layout is load-bearing.
        let a_not_negated = ArkProof {
            a: -proof.a,
            ..proof.clone()
        };
        assert!(
            !verifies(&vk, &a_not_negated, &publics),
            "A must be un-negated"
        );
        let b_c0_first = ArkProof {
            b: G2Affine::new_unchecked(
                Fq2::new(proof.b.x.c1, proof.b.x.c0),
                Fq2::new(proof.b.y.c1, proof.b.y.c0),
            ),
            ..proof.clone()
        };
        assert!(!verifies(&vk, &b_c0_first, &publics), "G2 is c1-first");
        let mut other = publics.clone();
        other[2][31] ^= 1; // withdrawAmount
        assert!(!verifies(&vk, &proof, &other), "the statement is bound");
        assert!(
            !verifies(&vk_of(Circuit::Deposit), &proof, &publics[..4]),
            "another circuit's VK"
        );
    }
}

#[test]
fn the_vk_fixtures_are_the_pinned_deployed_files() {
    let v = vectors();
    for (c, json, name) in [
        (Circuit::Deposit, DEPOSIT_VK, "deposit"),
        (
            Circuit::WithdrawChange,
            WITHDRAW_CHANGE_VK,
            "withdraw_change",
        ),
    ] {
        assert_eq!(
            hex::encode(Sha256::digest(json.as_bytes())),
            v["vkSha256"][name].as_str().unwrap()
        );
        assert_eq!(vk_of(c).gamma_abc_g1.len(), c.table().public.len() + 1);
    }
    assert_eq!(
        v["vkSha256"]["deposit"],
        "f6f8ae49b8f032be799ee025f3e48faa34df7aa3685bee54339f538e6f9f2091"
    );
    assert_eq!(
        v["vkSha256"]["withdraw_change"],
        "43dafca79a0523fcffb4a9719f67b4a260cbce2047b9a00c9abff0223134e5cd"
    );
}

// ----------------------------------------------------------- with the key files (keyed)

#[test]
fn keyed_the_signal_tables_are_the_circuits_inputs_and_their_counts() {
    let Some(dir) = keys_dir("keyed_the_signal_tables_are_the_circuits_inputs_and_their_counts")
    else {
        return;
    };
    for c in [Circuit::Deposit, Circuit::WithdrawChange] {
        let (zkey, wasm) = paths(&dir, c);
        let zkey = keyfiles::load(&zkey, &c.pins().zkey).unwrap();
        let wasm = keyfiles::load(&wasm, &c.pins().wasm).unwrap();
        let table = c.table();
        let mut wc = WitnessCalculator::from_bytes(&wasm).unwrap();
        for s in table.signals() {
            assert_eq!(
                wc.input_signal_size(s.name).unwrap(),
                Some(s.len),
                "{c:?}.{}",
                s.name
            );
        }
        // Negative controls: the probe answers None for names the circuit does not have.
        for n in ["nk_", "commitmentx", "in_d", "depositIndex", "changeAmount"] {
            assert_eq!(wc.input_signal_size(n).unwrap(), None, "{n}");
        }
        let total: usize = table.signals().map(|s| s.len).sum();
        let n_inputs = wc.input_size().unwrap();
        assert_eq!(total, n_inputs, "{c:?}: the table is every input");
        let (_, matrices) = read_zkey(&mut std::io::Cursor::new(&zkey)).unwrap();
        let n_public = matrices.num_instance_variables - 1;
        let pub_len: usize = table.public.iter().map(|s| s.len).sum();
        let priv_len: usize = table.private.iter().map(|s| s.len).sum();
        assert_eq!(pub_len, n_public, "{c:?}: nPubInputs (the zkey's)");
        assert_eq!(priv_len, n_inputs - n_public, "{c:?}: nPrivInputs");
        let expect = match c {
            Circuit::Deposit => (4, 2),
            Circuit::WithdrawChange => (7, 45),
        };
        assert_eq!(
            (n_public, n_inputs - n_public),
            expect,
            "the r1cs header's counts"
        );
    }
}

#[test]
fn keyed_a_deposit_proof_verifies_against_the_deployed_vk_with_the_desk_values() {
    let Some(dir) =
        keys_dir("keyed_a_deposit_proof_verifies_against_the_deployed_vk_with_the_desk_values")
    else {
        return;
    };
    let core = Core::new();
    let h = open(&core);
    let sc = deposit_sc();
    let (zkey, wasm) = paths(&dir, Circuit::Deposit);
    let out = core
        .prove(h, "deposit", &wit(&sc), None, &zkey, &wasm)
        .unwrap();
    assert_eq!(out.public_inputs, publics(&sc));
    let proof = parse_proof(&out.proof_bytes).unwrap();
    assert!(verifies(
        &vk_of(Circuit::Deposit),
        &proof,
        &out.public_inputs
    ));
    // Negative control: one byte of C changed does not verify.
    let mut bad = out.proof_bytes;
    bad[255] ^= 1;
    let bad = parse_proof(&bad).unwrap();
    assert!(!(bad.c.is_on_curve() && verifies(&vk_of(Circuit::Deposit), &bad, &out.public_inputs)));
}

#[test]
fn keyed_withdraw_change_proofs_verify_against_the_deployed_vk() {
    let Some(dir) = keys_dir("keyed_withdraw_change_proofs_verify_against_the_deployed_vk") else {
        return;
    };
    let (zkey, wasm) = paths(&dir, Circuit::WithdrawChange);
    for i in [1, 2] {
        let sc = withdraw_sc(i);
        let core = Core::new();
        let h = open(&core);
        let id = authorize(&core, h, &sc, T0);
        let out = core
            .prove_at(h, "withdraw_change", &wit(&sc), Some(id), &zkey, &wasm, T0)
            .unwrap();
        assert_eq!(out.public_inputs, publics(&sc), "{}", sc["label"]);
        let proof = parse_proof(&out.proof_bytes).unwrap();
        assert!(verifies(
            &vk_of(Circuit::WithdrawChange),
            &proof,
            &out.public_inputs
        ));
        // The proof used the authorization up.
        assert_eq!(
            core.prove_at(h, "withdraw_change", &wit(&sc), Some(id), &zkey, &wasm, T0)
                .unwrap_err(),
            A0Error::AuthAbsent
        );
    }
}

#[test]
fn keyed_the_vk_fixtures_are_the_pinned_zkeys_own_verifying_keys() {
    let Some(dir) = keys_dir("keyed_the_vk_fixtures_are_the_pinned_zkeys_own_verifying_keys")
    else {
        return;
    };
    for c in [Circuit::Deposit, Circuit::WithdrawChange] {
        let zkey = keyfiles::load(&paths(&dir, c).0, &c.pins().zkey).unwrap();
        let (params, _) = read_zkey(&mut std::io::Cursor::new(&zkey)).unwrap();
        assert_eq!(params.vk, vk_of(c), "{c:?}");
    }
    assert_ne!(vk_of(Circuit::Deposit), vk_of(Circuit::WithdrawChange));
}

#[test]
fn keyed_a_one_byte_changed_or_swapped_key_file_is_refused() {
    let Some(dir) = keys_dir("keyed_a_one_byte_changed_or_swapped_key_file_is_refused") else {
        return;
    };
    let tmp = std::env::temp_dir().join(format!("a0-flip-{}", std::process::id()));
    std::fs::create_dir_all(&tmp).unwrap();
    let core = Core::new();
    let h = open(&core);
    let w = wit(&deposit_sc());
    let (zkey, wasm) = paths(&dir, Circuit::Deposit);
    for (pin, src, offset) in [
        (keyfiles::DEPOSIT.zkey, &zkey, 1000usize),
        (keyfiles::DEPOSIT.wasm, &wasm, 2_000_000),
    ] {
        let mut bytes = std::fs::read(src).unwrap();
        assert!(keyfiles::load(src, &pin).is_ok(), "positive control");
        bytes[offset] ^= 0x01;
        let flipped = tmp.join(pin.file);
        std::fs::write(&flipped, &bytes).unwrap();
        assert_eq!(
            keyfiles::load(&flipped, &pin),
            Err(A0Error::KeyFilePin { file: pin.file })
        );
        let (z, wa) = if pin.file.ends_with(".zkey") {
            (flipped.as_path(), wasm.as_path())
        } else {
            (zkey.as_path(), flipped.as_path())
        };
        assert_eq!(
            core.prove(h, "deposit", &w, None, z, wa).unwrap_err(),
            A0Error::KeyFilePin { file: pin.file }
        );
    }
    // The other circuit's (pinned, genuine) files are refused for this circuit.
    let (wz, ww) = paths(&dir, Circuit::WithdrawChange);
    assert_eq!(
        core.prove(h, "deposit", &w, None, &wz, &wasm).unwrap_err(),
        A0Error::KeyFilePin {
            file: keyfiles::DEPOSIT.zkey.file
        }
    );
    assert_eq!(
        core.prove(h, "deposit", &w, None, &zkey, &ww).unwrap_err(),
        A0Error::KeyFilePin {
            file: keyfiles::DEPOSIT.wasm.file
        }
    );
    std::fs::remove_dir_all(&tmp).unwrap();
}

#[test]
fn keyed_two_proofs_of_one_witness_differ_and_both_verify() {
    let Some(dir) = keys_dir("keyed_two_proofs_of_one_witness_differ_and_both_verify") else {
        return;
    };
    let core = Core::new();
    let h = open(&core);
    let (zkey, wasm) = paths(&dir, Circuit::Deposit);
    let w = wit(&deposit_sc());
    let a = core.prove(h, "deposit", &w, None, &zkey, &wasm).unwrap();
    let b = core.prove(h, "deposit", &w, None, &zkey, &wasm).unwrap();
    assert_eq!(a.public_inputs, b.public_inputs);
    assert_ne!(
        a.proof_bytes, b.proof_bytes,
        "r, s must be fresh randomness"
    );
    for p in [&a, &b] {
        let proof = parse_proof(&p.proof_bytes).unwrap();
        assert!(verifies(&vk_of(Circuit::Deposit), &proof, &p.public_inputs));
    }
}

/// `r` and `s` are two independent draws (Fable review 1, minor: a prover with `s = r` must go
/// red — the test above does not see it: both proofs still differ and verify). For one witness,
/// Groth16 gives A = A₀ + r·δ₁ and B = B₀ + s·δ₂, so for two proofs a, b:
/// A_a − A_b = (r_a − r_b)·δ₁ and B_a − B_b = (s_a − s_b)·δ₂. If `s` were `r` (or `r` plus a
/// constant), e(A_a − A_b, δ₂) = e(δ₁, B_a − B_b); with independent draws the two differ except
/// with probability ≈ 2^-254. Controls on the detector itself: one real proof shifted by t·δ₁ /
/// t·δ₂ (= that witness proved with r + t, s + t) is flagged against the unshifted one; shifted by
/// t·δ₁ / u·δ₂ (t ≠ u) it is not.
#[test]
fn keyed_r_and_s_are_independent_draws() {
    use ark_ec::pairing::Pairing;
    use ark_ec::{AffineRepr, CurveGroup};
    let Some(dir) = keys_dir("keyed_r_and_s_are_independent_draws") else {
        return;
    };
    let core = Core::new();
    let h = open(&core);
    let (zkey_path, wasm_path) = paths(&dir, Circuit::Deposit);
    let zkey = keyfiles::load(&zkey_path, &keyfiles::DEPOSIT.zkey).unwrap();
    let (params, _) = read_zkey(&mut std::io::Cursor::new(&zkey[..])).unwrap();
    let delta1 = params.delta_g1;
    let delta2 = vk_of(Circuit::Deposit).delta_g2;
    assert_eq!(
        params.vk.delta_g2, delta2,
        "the zkey's δ₂ is the deployed one"
    );
    let w = wit(&deposit_sc());
    let mut proofs = (0..2).map(|_| {
        let p = core
            .prove(h, "deposit", &w, None, &zkey_path, &wasm_path)
            .unwrap();
        parse_proof(&p.proof_bytes).unwrap()
    });
    let (a, b) = (proofs.next().unwrap(), proofs.next().unwrap());
    // True when the two proofs' r-difference equals their s-difference.
    let r_s_tied = |x: (G1Affine, G2Affine), y: (G1Affine, G2Affine)| {
        let da = (x.0.into_group() - y.0.into_group()).into_affine();
        let db = (x.1.into_group() - y.1.into_group()).into_affine();
        Bn254::pairing(da, delta2) == Bn254::pairing(delta1, db)
    };
    assert_ne!(a.a, b.a, "r is fresh per proof");
    assert_ne!(a.b, b.b, "s is fresh per proof");
    assert!(
        !r_s_tied((a.a, a.b), (b.a, b.b)),
        "s must be drawn independently of r"
    );
    // The detector's controls, on a real proof.
    let shifted = |t: u64, u: u64| {
        (
            (a.a.into_group() + delta1 * Fr::from(t)).into_affine(),
            (a.b.into_group() + delta2 * Fr::from(u)).into_affine(),
        )
    };
    assert!(
        r_s_tied(shifted(7, 7), (a.a, a.b)),
        "positive control: equal shifts of r and s are flagged"
    );
    assert!(
        !r_s_tied(shifted(7, 8), (a.a, a.b)),
        "negative control: different shifts are not"
    );
}

#[test]
fn keyed_the_circuit_rejects_a_tampered_witness_and_the_wasm_memory_is_wiped() {
    let Some(dir) =
        keys_dir("keyed_the_circuit_rejects_a_tampered_witness_and_the_wasm_memory_is_wiped")
    else {
        return;
    };
    let core = Core::new();
    let h = open(&core);
    let (zkey, wasm) = paths(&dir, Circuit::Deposit);
    let zkey = keyfiles::load(&zkey, &keyfiles::DEPOSIT.zkey).unwrap();
    let wasm = keyfiles::load(&wasm, &keyfiles::DEPOSIT.wasm).unwrap();
    // Positive control: the completed witness proves, and the wasm memory was wiped after it.
    probe::take();
    let good = complete(&core, h, "deposit", &wit(&deposit_sc()), None).unwrap();
    run(&good, &zkey, &wasm).unwrap();
    let (before, after) = probe::take().expect("the calculator was dropped");
    assert!(before > 0, "the memory held the witness");
    assert_eq!(after, 0, "the memory is zero after the drop");
    // A witness the circuit rejects: a commitment that is not the note's.
    for (name, value) in [
        ("commitment", Fr::from(12345u64)),
        ("d", Fr::from(7u64)),
        ("nk", Fr::from(7u64)),
    ] {
        let mut bad = complete(&core, h, "deposit", &wit(&deposit_sc()), None).unwrap();
        bad.set_for_test(name, vec![value]);
        assert_eq!(
            run(&bad, &zkey, &wasm).unwrap_err(),
            A0Error::WitnessRejected,
            "{name}"
        );
        let (_, after) = probe::take().expect("dropped on the error path too");
        assert_eq!(after, 0);
    }
}
