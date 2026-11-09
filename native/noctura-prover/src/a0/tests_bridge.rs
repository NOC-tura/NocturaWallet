//! The JNI surface's logic (spec §3 "JNI surface", "The seed crosses as bytes", INV-NK,
//! INV-NULL, INV-AUTH; §14 "Boundary"): `bridge::*` is exactly what `android.rs` calls with the
//! strings and bytes it took from the JVM, so these tests run the bound calls end to end except
//! for the JNI marshalling itself (which the Kotlin JVM test `A0JniTest` exercises on the host
//! build, and the device checkpoint on the phone).
//!
//! Expected values come from the Task 1 / Task 3 fixtures (`a0-key-vectors.json`,
//! `a0-prove-vectors.json`), written OFFLINE by the scripts under `scripts/a0-vectors/`; nothing
//! here computes an expected value with the code under test.

use super::bridge::{self, envelope, INTERNAL};
use super::state::{A0Error, Core};
use super::tests_prove::keys_dir;
use serde_json::{json, Value};
use std::collections::HashSet;

const KEY_VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-key-vectors.json"
));
const PROVE_VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-prove-vectors.json"
));
/// Never read: every prove below that names it is refused before a key file is opened, or is
/// meant to fail AT the key file (the proof that it got past the authorization).
const NO_FILE: &str = "/nonexistent/never-read";

fn kv() -> Value {
    serde_json::from_str(KEY_VECTORS).unwrap()
}
fn pv() -> Value {
    serde_json::from_str(PROVE_VECTORS).unwrap()
}
fn seed0() -> Value {
    kv()["seeds"][0].clone()
}
fn s(v: &Value) -> String {
    v.as_str().unwrap().to_string()
}
fn seed_bytes() -> Vec<u8> {
    hex::decode(s(&seed0()["seed"])).unwrap()
}
fn parse(out: &str) -> Value {
    serde_json::from_str(out).unwrap()
}
fn ok(out: &str) -> Value {
    let v = parse(out);
    assert!(v.get("error").is_none(), "expected ok, got {out}");
    v["ok"].clone()
}
fn code(out: &str) -> String {
    let v = parse(out);
    assert!(v.get("ok").is_none(), "expected an error, got {out}");
    s(&v["error"])
}
fn open(core: &Core) -> String {
    let mut seed = seed_bytes();
    s(&ok(&bridge::keys_open(core, &mut seed)))
}
fn strings(v: &[&str]) -> Vec<String> {
    v.iter().map(|x| x.to_string()).collect()
}
fn scenario(i: usize) -> Value {
    pv()["scenarios"][i].clone()
}
fn authorize(core: &Core, h: &str, sc: &Value) -> String {
    let a = &sc["authorization"];
    s(&ok(&bridge::authorize_unshield(
        core,
        h,
        &s(&a["owner"]),
        &s(&a["amount"]),
        &s(&a["fee"]),
    )))
}
fn prove(core: &Core, h: &str, circuit: &str, w: &str, auth: Option<&str>) -> String {
    bridge::prove(core, h, circuit, w, auth, NO_FILE, NO_FILE)
}

/// Every spelling of a value a bound call could leak it in: hex either case, decimal, base58.
fn spellings(hex_be: &str) -> Vec<String> {
    let bytes = hex::decode(hex_be).unwrap();
    vec![
        hex_be.to_lowercase(),
        hex_be.to_uppercase(),
        num_bigint::BigUint::from_bytes_be(&bytes).to_string(),
        bs58::encode(&bytes).into_string(),
    ]
}
/// The values that must never cross the JNI (INV-NK) and the own nullifiers that may cross it
/// only as a withdraw_change proof's public input [1] (INV-NULL), for the fixture's seeds[0].
fn forbidden() -> Vec<(String, String)> {
    let seed = seed0();
    let mut out = vec![];
    for k in ["seed", "sk", "viewKey", "nk", "ivk", "dSelf", "addrSelf"] {
        for sp in spellings(&s(&seed[k])) {
            out.push((k.to_string(), sp));
        }
    }
    for n in seed["notes"].as_array().unwrap() {
        for k in ["nullifier", "rhoChange"] {
            for sp in spellings(&s(&n[k])) {
                out.push((format!("{k}[{}]", s(&n["depositIndex"])), sp));
            }
        }
    }
    out
}
fn leaks(output: &str) -> Vec<String> {
    forbidden()
        .into_iter()
        .filter(|(_, sp)| output.contains(sp.as_str()))
        .map(|(name, _)| name)
        .collect()
}

// --------------------------------------------------------------------- the error envelope

/// The name a variant's `Debug` prints, as SCREAMING_SNAKE.
fn snake(e: &A0Error) -> String {
    let dbg = format!("{e:?}");
    let name: String = dbg.chars().take_while(|c| c.is_alphanumeric()).collect();
    let mut out = String::new();
    for (i, c) in name.chars().enumerate() {
        if c.is_uppercase() && i > 0 {
            out.push('_');
        }
        out.push(c.to_ascii_uppercase());
    }
    out
}

#[test]
fn every_error_has_a_distinct_stable_code_named_after_its_variant() {
    let all = [
        A0Error::SeedLength { got: 1 },
        A0Error::UnknownHandle,
        A0Error::NonCanonical {
            what: "rho",
            index: 0,
        },
        A0Error::DuplicateRho { index: 0 },
        A0Error::StatePoisoned,
        A0Error::OwnerNotBase58,
        A0Error::OwnerLength { got: 1 },
        A0Error::OwnerOffCurve,
        A0Error::OwnerNonCanonical,
        A0Error::OwnerSmallOrder,
        A0Error::OwnerTorsion,
        A0Error::NoProgramAddress,
        A0Error::NotU64 { what: "amount" },
        A0Error::AmountZero,
        A0Error::FeeAboveCeiling,
        A0Error::AmountPlusFeeOverflow,
        A0Error::AuthInFlight,
        A0Error::AuthAbsent,
        A0Error::AuthMismatch,
        A0Error::AuthWrongHandle,
        A0Error::AuthExpired,
        A0Error::Rng,
        A0Error::Clock,
        A0Error::CircuitUnknown,
        A0Error::CircuitNotInM1,
        A0Error::AuthUnexpected,
        A0Error::AuthRecordInconsistent,
        A0Error::WitnessJson,
        A0Error::WitnessRustFilled { name: "nk" },
        A0Error::WitnessUnknownKey,
        A0Error::WitnessDuplicate { name: "rho" },
        A0Error::WitnessMissing { name: "rho" },
        A0Error::WitnessValue {
            name: "rho",
            index: 0,
        },
        A0Error::WitnessNotInTree,
        A0Error::WithdrawExceedsInput,
        A0Error::KeyFileRead { file: "f" },
        A0Error::KeyFilePin { file: "f" },
        A0Error::KeyFileFormat { file: "f" },
        A0Error::CircuitShape,
        A0Error::WitnessRejected,
        A0Error::PublicInputMismatch,
        A0Error::ProofFailed,
        A0Error::ProofDoesNotVerify,
        A0Error::Arg { what: "handle" },
        A0Error::ArgItem {
            what: "ownRhos",
            index: 0,
        },
    ];
    assert_eq!(all.len(), 45);
    let mut codes = HashSet::new();
    for e in &all {
        let c = e.code();
        assert_eq!(c, format!("E_A0_{}", snake(e)), "{e:?}");
        assert!(
            c.bytes()
                .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b == b'_'),
            "{c}"
        );
        assert!(codes.insert(c), "{c} is used twice");
    }
    assert!(!codes.contains(INTERNAL));
    assert_eq!(INTERNAL, "E_A0_INTERNAL");
}

#[test]
fn the_envelope_is_ok_or_a_code_and_a_panic_becomes_internal() {
    assert_eq!(parse(&envelope(|| Ok(json!("x")))), json!({"ok": "x"}));
    assert_eq!(parse(&envelope(|| Ok(Value::Null))), json!({"ok": null}));
    assert_eq!(
        parse(&envelope(|| Err(A0Error::AuthAbsent))),
        json!({"error": "E_A0_AUTH_ABSENT", "message": "no live unshield authorization"})
    );
    let out = envelope(|| -> Result<Value, A0Error> { panic!("a secret 1234 in a panic") });
    assert_eq!(
        parse(&out),
        json!({"error": "E_A0_INTERNAL", "message": "internal error"})
    );
    assert!(!out.contains("1234"));
}

// ------------------------------------------------------------- the calls, against the fixture

#[test]
fn keys_open_returns_a_decimal_handle_and_wipes_the_seed_on_every_path() {
    let core = Core::new();
    let mut seed = seed_bytes();
    let h = s(&ok(&bridge::keys_open(&core, &mut seed)));
    assert!(seed.iter().all(|b| *b == 0), "the seed copy was not wiped");
    assert!(!h.is_empty() && h.bytes().all(|b| b.is_ascii_digit()) && !h.starts_with('0'));
    let mut short = seed_bytes()[..63].to_vec();
    assert_eq!(
        code(&bridge::keys_open(&core, &mut short)),
        "E_A0_SEED_LENGTH"
    );
    assert!(
        short.iter().all(|b| *b == 0),
        "a refused seed was not wiped"
    );
    // the refused open ended the session it replaced (m5)
    assert_eq!(
        code(&bridge::deposit_rho(&core, &h, "0")),
        "E_A0_UNKNOWN_HANDLE"
    );
}

#[test]
fn the_bound_calls_return_the_fixtures_public_values() {
    let core = Core::new();
    let h = open(&core);
    let notes = seed0()["notes"].as_array().unwrap().clone();
    let mut rhos = vec![];
    let mut nullifiers = vec![];
    for n in &notes {
        let rho = ok(&bridge::deposit_rho(&core, &h, &s(&n["depositIndex"])));
        assert_eq!(rho, n["rho"], "depositRho({})", n["depositIndex"]);
        for c in n["commitments"].as_array().unwrap() {
            let got = ok(&bridge::commitment(
                &core,
                &h,
                &s(&c["amount"]),
                &s(&n["rho"]),
            ));
            assert_eq!(got, c["commitment"]);
        }
        rhos.push(s(&n["rho"]));
        nullifiers.push(s(&n["nullifier"]));
    }
    assert!(rhos.len() >= 3);
    // matchSpent: the chain spent notes 0 and 2 (and holds a foreign nullifier); indices only
    let chain = vec![
        nullifiers[2].clone(),
        "00".repeat(32),
        nullifiers[0].clone(),
    ];
    assert_eq!(
        ok(&bridge::match_spent(&core, &h, &chain, &rhos)),
        json!([0, 2])
    );
    assert_eq!(ok(&bridge::match_spent(&core, &h, &[], &rhos)), json!([]));
    // keysClose ends the session: every call on the handle is refused afterwards
    assert_eq!(ok(&bridge::keys_close(&core, &h)), Value::Null);
    for out in [
        bridge::deposit_rho(&core, &h, "0"),
        bridge::commitment(&core, &h, "1", &rhos[0]),
        bridge::match_spent(&core, &h, &chain, &rhos),
        bridge::keys_close(&core, &h),
    ] {
        assert_eq!(code(&out), "E_A0_UNKNOWN_HANDLE");
    }
}

#[test]
fn parse_unshield_gives_the_dialog_its_values_as_strings() {
    let sc = scenario(1);
    let a = &sc["authorization"];
    let got = ok(&bridge::parse_unshield(
        &s(&a["owner"]),
        &s(&a["amount"]),
        &s(&a["fee"]),
    ));
    assert_eq!(
        got,
        json!({
            "owner": a["owner"], "ata": a["ata"], "amount": "400000", "fee": "10000",
            "humanAmount": "0.0004", "humanFee": "0.00001",
            "pool": "8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT",
        })
    );
    assert_eq!(
        code(&bridge::parse_unshield(&s(&a["owner"]), "0", "1")),
        "E_A0_AMOUNT_ZERO"
    );
}

#[test]
fn every_argument_has_one_spelling() {
    let core = Core::new();
    let h = open(&core);
    let rho = s(&seed0()["notes"][0]["rho"]);
    for bad in ["", "01", "+1", " 1", "1 ", "x", "18446744073709551616"] {
        assert_eq!(
            code(&bridge::deposit_rho(&core, bad, "0")),
            "E_A0_ARG",
            "handle {bad:?}"
        );
    }
    // a well-formed handle that is not the live one
    assert_eq!(
        code(&bridge::deposit_rho(&core, "0", "0")),
        "E_A0_UNKNOWN_HANDLE"
    );
    for bad in ["", "-1", "01", "+0", "1.0", "18446744073709551616"] {
        assert_eq!(
            code(&bridge::deposit_rho(&core, &h, bad)),
            "E_A0_NOT_U64",
            "{bad:?}"
        );
        assert_eq!(
            code(&bridge::commitment(&core, &h, bad, &rho)),
            "E_A0_NOT_U64",
            "{bad:?}"
        );
    }
    let upper = rho.to_uppercase();
    let prefixed = format!("0x{}", &rho[2..]);
    for bad in [&upper, &prefixed, &rho[1..].to_string(), &format!("{rho}0")] {
        assert_eq!(
            code(&bridge::commitment(&core, &h, "1", bad)),
            "E_A0_ARG",
            "{bad:?}"
        );
    }
    // a hex string ≥ r is well formed but not a field element: refused by the core, not reduced
    let r = "30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001";
    assert_eq!(
        code(&bridge::commitment(&core, &h, "1", r)),
        "E_A0_NON_CANONICAL"
    );
    let out = bridge::match_spent(&core, &h, &strings(&[&rho]), &strings(&[&rho, &upper]));
    assert_eq!(
        parse(&out),
        json!({"error": "E_A0_ARG_ITEM", "message": "argument ownRhos[1] is malformed"})
    );
    assert_eq!(
        code(&bridge::match_spent(
            &core,
            &h,
            &strings(&[&rho, "zz"]),
            &[]
        )),
        "E_A0_ARG_ITEM"
    );
    // positive control: the canonical spellings pass
    ok(&bridge::deposit_rho(&core, &h, "18446744073709551615"));
    ok(&bridge::commitment(&core, &h, "0", &rho));
    // no refusal echoes what it was given
    let nk = s(&seed0()["nk"]);
    for out in [
        bridge::commitment(&core, &h, "1", &format!("{nk}z")),
        bridge::commitment(&core, &h, &nk, &rho),
        bridge::deposit_rho(&core, &nk, "0"),
        bridge::match_spent(&core, &h, &[format!("{nk}0")], &[]),
        prove(&core, &h, "deposit", "{}", Some(&nk)),
    ] {
        assert!(!out.contains(&nk), "{out}");
        assert!(leaks(&out).is_empty(), "{out}");
    }
}

// ---------------------------------------------------------------- INV-NK and INV-NULL

#[test]
fn the_leak_scan_sees_every_spelling_positive_control() {
    let nk = s(&seed0()["nk"]);
    let nf = s(&seed0()["notes"][1]["nullifier"]);
    for sp in spellings(&nk) {
        assert_eq!(
            leaks(&format!("{{\"ok\":\"{sp}\"}}")),
            vec!["nk".to_string()]
        );
    }
    for sp in spellings(&nf) {
        assert_eq!(
            leaks(&format!("[\"{sp}\"]")),
            vec!["nullifier[1]".to_string()]
        );
    }
    assert!(leaks("{\"ok\":\"12\"}").is_empty());
}

#[test]
fn inv_nk_and_inv_null_no_bound_call_outputs_a_secret_or_an_own_nullifier() {
    let core = Core::new();
    let mut outputs: Vec<(String, String)> = vec![];
    let mut seed = seed_bytes();
    let open_out = bridge::keys_open(&core, &mut seed);
    let h = s(&ok(&open_out));
    outputs.push(("keysOpen".into(), open_out));
    let notes = seed0()["notes"].as_array().unwrap().clone();
    let rhos: Vec<String> = notes.iter().map(|n| s(&n["rho"])).collect();
    let nfs: Vec<String> = notes.iter().map(|n| s(&n["nullifier"])).collect();
    for n in &notes {
        outputs.push((
            "depositRho".into(),
            bridge::deposit_rho(&core, &h, &s(&n["depositIndex"])),
        ));
        for c in n["commitments"].as_array().unwrap() {
            outputs.push((
                "commitment".into(),
                bridge::commitment(&core, &h, &s(&c["amount"]), &s(&n["rho"])),
            ));
        }
    }
    // matchSpent over every subset of the own nullifiers, and with the rhos as "nullifiers"
    for mask in 0..(1u32 << nfs.len()) {
        let chain: Vec<String> = (0..nfs.len())
            .filter(|i| mask & (1 << i) != 0)
            .map(|i| nfs[i].clone())
            .collect();
        outputs.push((
            "matchSpent".into(),
            bridge::match_spent(&core, &h, &chain, &rhos),
        ));
    }
    outputs.push((
        "matchSpent".into(),
        bridge::match_spent(&core, &h, &rhos, &rhos),
    ));
    let dup = vec![rhos[0].clone(), rhos[0].clone()];
    outputs.push((
        "matchSpent".into(),
        bridge::match_spent(&core, &h, &nfs, &dup),
    ));
    // parseUnshield / authorizeUnshield / prove: their outputs and their refusals
    let sc = scenario(1);
    let a = &sc["authorization"];
    outputs.push((
        "parseUnshield".into(),
        bridge::parse_unshield(&s(&a["owner"]), &s(&a["amount"]), &s(&a["fee"])),
    ));
    let id = authorize(&core, &h, &sc);
    outputs.push((
        "authorizeUnshield".into(),
        bridge::authorize_unshield(&core, &h, &s(&a["owner"]), "1", "1"),
    ));
    let w = sc["witness"].to_string();
    for (circuit, auth) in [
        ("withdraw_change", Some(id.as_str())),
        ("withdraw_change", None),
        ("deposit", None),
        ("transfer", None),
    ] {
        let wit = if circuit == "deposit" {
            scenario(0)["witness"].to_string()
        } else {
            w.clone()
        };
        outputs.push(("prove".into(), prove(&core, &h, circuit, &wit, auth)));
    }
    outputs.push(("keysClose".into(), bridge::keys_close(&core, &h)));
    assert!(outputs.len() > 20);
    for (call, out) in &outputs {
        assert!(
            leaks(out).is_empty(),
            "{call} → {out} leaks {:?}",
            leaks(out)
        );
    }
    // Positive control: the same scan over the values the core holds would have fired —
    // matchSpent's own computation is exactly these nullifiers.
    assert!(!leaks(&json!(nfs).to_string()).is_empty());
}

// ------------------------------------------------------------------------------ INV-AUTH

#[test]
fn inv_auth_a_withdraw_change_prove_needs_the_approved_authorization() {
    let sc = scenario(1);
    let a = &sc["authorization"];
    let w = sc["witness"].to_string();
    let core = Core::new();
    let h = open(&core);
    let live = |core: &Core| core.lock().unwrap().peek_auth_expiry_for_test().is_some();

    // none at all
    assert_eq!(
        code(&prove(&core, &h, "withdraw_change", &w, None)),
        "E_A0_AUTH_ABSENT"
    );
    // a valid approval gets past the authorization: the refusal is the (absent) key file
    let id = authorize(&core, &h, &sc);
    assert_eq!(id.len(), 32);
    assert_eq!(
        code(&prove(&core, &h, "withdraw_change", &w, Some(&id))),
        "E_A0_KEY_FILE_READ"
    );
    // ... once: the same id again
    assert_eq!(
        code(&prove(&core, &h, "withdraw_change", &w, Some(&id))),
        "E_A0_AUTH_ABSENT"
    );
    // a prove without the id drops a live approval
    let id = authorize(&core, &h, &sc);
    assert_eq!(
        code(&prove(&core, &h, "withdraw_change", &w, None)),
        "E_A0_AUTH_ABSENT"
    );
    assert!(!live(&core));
    assert_eq!(
        code(&prove(&core, &h, "withdraw_change", &w, Some(&id))),
        "E_A0_AUTH_ABSENT"
    );
    // a malformed authId or handle is refused — and still uses the live approval up
    let upper = "AB".repeat(16);
    let short = "ab".repeat(15);
    for bad in ["", upper.as_str(), short.as_str(), "zz"] {
        let id = authorize(&core, &h, &sc);
        assert_eq!(
            code(&prove(&core, &h, "withdraw_change", &w, Some(bad))),
            "E_A0_ARG",
            "{bad:?}"
        );
        assert!(!live(&core), "{bad:?} left the approval live");
        assert_eq!(
            code(&prove(&core, &h, "withdraw_change", &w, Some(&id))),
            "E_A0_AUTH_ABSENT"
        );
    }
    let id = authorize(&core, &h, &sc);
    assert_eq!(
        code(&prove(&core, "01", "withdraw_change", &w, Some(&id))),
        "E_A0_ARG"
    );
    assert!(!live(&core));
    // another id: refused, and the live approval is used up
    let id = authorize(&core, &h, &sc);
    let first = if id.starts_with('0') { '1' } else { '0' };
    let other = format!("{first}{}", &id[1..]);
    assert_eq!(
        code(&prove(&core, &h, "withdraw_change", &w, Some(&other))),
        "E_A0_AUTH_MISMATCH"
    );
    assert_eq!(
        code(&prove(&core, &h, "withdraw_change", &w, Some(&id))),
        "E_A0_AUTH_ABSENT"
    );
    // one in flight
    let id = authorize(&core, &h, &sc);
    assert_eq!(
        code(&bridge::authorize_unshield(
            &core,
            &h,
            &s(&a["owner"]),
            "1",
            "1"
        )),
        "E_A0_AUTH_IN_FLIGHT"
    );
    // the destination, amount and fee are not the caller's to give
    for k in ["withdrawAmount", "fee", "recipientField", "nullifier"] {
        let mut wv = sc["witness"].clone();
        wv[k] = json!("1");
        assert_eq!(
            code(&prove(
                &core,
                &h,
                "withdraw_change",
                &wv.to_string(),
                Some(&id)
            )),
            "E_A0_WITNESS_RUST_FILLED",
            "{k}"
        );
    }
    // an approval does not survive its session: closed, then reopened
    let id = authorize(&core, &h, &sc);
    ok(&bridge::keys_close(&core, &h));
    let h2 = open(&core);
    assert_eq!(
        code(&prove(&core, &h2, "withdraw_change", &w, Some(&id))),
        "E_A0_AUTH_ABSENT"
    );
    let id = authorize(&core, &h2, &sc);
    let h3 = open(&core);
    assert_eq!(
        code(&prove(&core, &h3, "withdraw_change", &w, Some(&id))),
        "E_A0_AUTH_ABSENT"
    );
    // authorizeUnshield needs the live handle
    assert_eq!(
        code(&bridge::authorize_unshield(
            &core,
            &h2,
            &s(&a["owner"]),
            "1",
            "1"
        )),
        "E_A0_UNKNOWN_HANDLE"
    );
}

#[test]
fn keyed_bridge_withdraw_change_carries_the_approved_values_and_is_the_one_nullifier_exit() {
    let Some(dir) = keys_dir(
        "keyed_bridge_withdraw_change_carries_the_approved_values_and_is_the_one_nullifier_exit",
    ) else {
        return;
    };
    let zkey = dir.join("withdraw_change_final.zkey");
    let wasm = dir.join("withdraw_change.wasm");
    let (zkey, wasm) = (zkey.to_str().unwrap(), wasm.to_str().unwrap());
    let sc = scenario(1);
    let core = Core::new();
    let h = open(&core);
    let id = authorize(&core, &h, &sc);
    let w = sc["witness"].to_string();
    let out = bridge::prove(&core, &h, "withdraw_change", &w, Some(&id), zkey, wasm);
    let got = ok(&out);
    // the public inputs are the desk values: [1] the note's nullifier, [2] the approved amount,
    // [3] be_mod_r(the approved owner's ATA), [6] the approved fee
    assert_eq!(got["publicInputs"], sc["publicInputs"]);
    assert_eq!(got["proofBytes"].as_str().unwrap().len(), 512);
    let nf = s(&seed0()["notes"][1]["nullifier"]);
    assert_eq!(got["publicInputs"][1], json!(nf));
    // INV-NULL: the nullifier is in this output — and only as public input [1]
    assert_eq!(leaks(&out), vec!["nullifier[1]".to_string()]);
    assert_eq!(out.matches(nf.as_str()).count(), 1);
    let mut rest = got.clone();
    rest["publicInputs"][1] = json!("");
    assert!(leaks(&rest.to_string()).is_empty());
    // the approval was used up by the proof
    assert_eq!(
        code(&bridge::prove(
            &core,
            &h,
            "withdraw_change",
            &w,
            Some(&id),
            zkey,
            wasm
        )),
        "E_A0_AUTH_ABSENT"
    );
    // a deposit proof through the bridge carries no own nullifier either
    let dz = dir.join("deposit_final.zkey");
    let dw = dir.join("deposit.wasm");
    let d = scenario(0);
    let out = bridge::prove(
        &core,
        &h,
        "deposit",
        &d["witness"].to_string(),
        None,
        dz.to_str().unwrap(),
        dw.to_str().unwrap(),
    );
    assert_eq!(ok(&out)["publicInputs"], d["publicInputs"]);
    assert!(leaks(&out).is_empty(), "{:?}", leaks(&out));
}
