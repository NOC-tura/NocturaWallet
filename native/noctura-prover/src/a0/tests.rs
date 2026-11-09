//! A0 keys and field values against vectors this crate did not produce (spec §3, §14):
//! - `tests/fixtures/a0-key-vectors.json`, written OFFLINE by `scripts/a0-vectors/gen-key-vectors.mjs`
//!   from micro-key-producer/bls.js, poseidon-lite (via the app's `fieldEquations.ts`) and
//!   @noble/hashes — rerun `node scripts/a0-vectors/gen-key-vectors.mjs --check` to confirm it;
//! - the EIP-2333 published cases (copied into that fixture from the ERC text, with its commit);
//! - `src/modules/shielded/a0/__tests__/golden-vectors.json`, the program side's circuit-validated
//!   Poseidon rows (read in place, never copied).
//!
//! Nothing here computes an expected value with the code under test.

use super::eip2333::{self, SPEND_PATH};
use super::field::{
    self, fr_from_be32, fr_to_be32, mint_hash, poseidon, rho_change, Fr, MINT, TAG_ADDR, TAG_CM,
    TAG_NULL, TAG_RHO,
};
use super::keys::Keys;
use super::state::{A0Error, Core, Handle};
use super::wipe_probe;
use ark_ff::{BigInteger, PrimeField, Zero};
use num_bigint::BigUint;
use serde_json::Value;
use zeroize::Zeroizing;

const KEY_VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-key-vectors.json"
));
const GOLDEN: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../src/modules/shielded/a0/__tests__/golden-vectors.json"
));
const VIEW_PATH: [u32; 4] = [12381, 371, 2, 0];

fn vectors() -> Value {
    serde_json::from_str(KEY_VECTORS).unwrap()
}
fn golden() -> Value {
    serde_json::from_str(GOLDEN).unwrap()
}
fn s(v: &Value) -> &str {
    v.as_str().unwrap()
}
fn bytes(v: &Value) -> Vec<u8> {
    hex::decode(s(v)).unwrap()
}
fn b32(v: &Value) -> [u8; 32] {
    bytes(v).try_into().unwrap()
}
fn dec_fr(v: &Value) -> Fr {
    let n: BigUint = s(v).parse().unwrap();
    Fr::from_be_bytes_mod_order(&n.to_bytes_be())
}
fn hex_fr(v: &Value) -> Fr {
    fr_from_be32(&b32(v)).expect("fixture value is canonical")
}
fn decimal(be: &[u8]) -> String {
    BigUint::from_bytes_be(be).to_string()
}
fn seeds() -> Vec<Value> {
    vectors()["seeds"].as_array().unwrap().clone()
}
fn seed64(v: &Value) -> [u8; 64] {
    bytes(&v["seed"]).try_into().unwrap()
}
fn open(core: &Core, v: &Value) -> Handle {
    let mut seed = seed64(v);
    core.keys_open(&mut seed).unwrap()
}

// ---------------------------------------------------------------- EIP-2333

#[test]
fn eip2333_master_and_child_match_the_eips_published_cases() {
    let cases = vectors()["eip2333"]["cases"].as_array().unwrap().clone();
    assert_eq!(cases.len(), 4, "the EIP publishes four cases");
    for c in &cases {
        let master = eip2333::derive_master(&bytes(&c["seed"])).unwrap();
        assert_eq!(
            decimal(&master[..]),
            s(&c["master"]),
            "{} master",
            c["label"]
        );
        let index = u32::try_from(c["childIndex"].as_u64().unwrap()).unwrap();
        let child = eip2333::derive_child(&master, index);
        assert_eq!(decimal(&child[..]), s(&c["child"]), "{} child", c["label"]);
    }
}

#[test]
fn eip2333_case0_intermediate_compressed_lamport_pk_matches_the_eip() {
    let c = &vectors()["eip2333"]["cases"][0];
    let master = eip2333::derive_master(&bytes(&c["seed"])).unwrap();
    let pk = eip2333::parent_sk_to_lamport_pk(&master, 0);
    assert_eq!(hex::encode(&pk[..]), s(&c["compressedLamportPK"]));
}

#[test]
fn eip2333_refuses_a_seed_shorter_than_256_bits() {
    assert!(eip2333::derive_master(&[7u8; 31]).is_none());
    assert!(eip2333::derive_master(&[7u8; 32]).is_some());
}

#[test]
fn spend_and_view_paths_match_bls_js_for_every_fixture_seed() {
    assert_eq!(SPEND_PATH, [12381, 371, 1, 0]);
    assert_eq!(s(&vectors()["constants"]["spendPath"]), "m/12381/371/1/0");
    for v in seeds() {
        let seed = seed64(&v);
        let sk = eip2333::derive_path(&seed, &SPEND_PATH).unwrap();
        assert_eq!(hex::encode(&sk[..]), s(&v["sk"]), "sk for {}", v["label"]);
        let view = eip2333::derive_path(&seed, &VIEW_PATH).unwrap();
        assert_eq!(
            hex::encode(&view[..]),
            s(&v["viewKey"]),
            "view for {}",
            v["label"]
        );
        assert_ne!(sk[..], view[..]);
    }
}

// ---------------------------------------------------------------- Poseidon and field encoding

#[test]
fn poseidon_matches_the_circuit_validated_golden_rows() {
    let g = golden();
    let v = &g["vectors"];
    let mut rows = 0;
    for r in v["addrField"].as_array().unwrap() {
        let out = poseidon(&[TAG_ADDR, dec_fr(&r["in"]["nk"]), dec_fr(&r["in"]["d"])]);
        assert_eq!(out, dec_fr(&r["out"]), "addrField {}", r["label"]);
        assert_eq!(hex::encode(fr_to_be32(&out)), s(&r["outHexBE32"]));
        rows += 1;
    }
    for r in v["commitment"].as_array().unwrap() {
        let i = &r["in"];
        let out = poseidon(&[
            TAG_CM,
            dec_fr(&i["addrField"]),
            dec_fr(&i["amount"]),
            dec_fr(&i["mintHash"]),
            dec_fr(&i["rho"]),
        ]);
        assert_eq!(out, dec_fr(&r["out"]), "commitment {}", r["label"]);
        rows += 1;
    }
    for r in v["nullifier"].as_array().unwrap() {
        let out = poseidon(&[TAG_NULL, dec_fr(&r["in"]["nk"]), dec_fr(&r["in"]["rho"])]);
        assert_eq!(out, dec_fr(&r["out"]), "nullifier {}", r["label"]);
        rows += 1;
    }
    for r in v["rhoOut"].as_array().unwrap() {
        let j = Fr::from(r["in"]["index"].as_u64().unwrap());
        let out = poseidon(&[TAG_RHO, dec_fr(&r["in"]["nullifierIn0"]), j]);
        assert_eq!(out, dec_fr(&r["out"]), "rhoOut {}", r["label"]);
        rows += 1;
    }
    let pair = &v["merkleNode"][0];
    let leaf = dec_fr(&pair["in"]["left"]);
    let out = poseidon(&[leaf, dec_fr(&pair["in"]["right"])]);
    assert_eq!(out, dec_fr(&pair["out"]), "merkleNode {}", pair["label"]);
    rows += 1;
    // the second row is a fold: the leaf above with Z[i], i = 0..19, Z[0] = 0, Z[i] = P2(Z[i-1], Z[i-1])
    let fold = &v["merkleNode"][1];
    assert_eq!(s(&fold["label"]), "fold_root_depth20_leaf_at_index0");
    let (mut acc, mut z) = (leaf, Fr::zero());
    for _ in 0..20 {
        acc = poseidon(&[acc, z]);
        z = poseidon(&[z, z]);
    }
    assert_eq!(acc, dec_fr(&fold["out"]), "the depth-20 fold");
    rows += 1;
    assert_eq!(v["merkleNode"].as_array().unwrap().len(), 2);
    assert_eq!(rows, 13, "every golden row was compared");
}

#[test]
fn poseidon_equals_light_poseidons_own_hasher_over_the_same_constants() {
    use light_poseidon::{Poseidon, PoseidonHasher};
    let inputs: Vec<Fr> = (1u64..=5).map(|i| Fr::from(i * 0x1234_5678_9abc)).collect();
    let mut h2 = Poseidon::<Fr>::new_circom(2).unwrap();
    assert_eq!(
        poseidon(&[inputs[0], inputs[1]]),
        h2.hash(&inputs[..2]).unwrap()
    );
    let mut h3 = Poseidon::<Fr>::new_circom(3).unwrap();
    assert_eq!(
        poseidon(&[inputs[0], inputs[1], inputs[2]]),
        h3.hash(&inputs[..3]).unwrap()
    );
    let mut h5 = Poseidon::<Fr>::new_circom(5).unwrap();
    assert_eq!(
        poseidon(&[inputs[0], inputs[1], inputs[2], inputs[3], inputs[4]]),
        h5.hash(&inputs[..5]).unwrap()
    );
}

#[test]
fn the_pinned_mint_and_its_hash_match_the_fixture() {
    let c = &vectors()["constants"];
    assert_eq!(
        s(&c["mint"]),
        "ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs"
    );
    assert_eq!(hex::encode(MINT), s(&c["mintBytes"]));
    assert_eq!(hex::encode(fr_to_be32(&mint_hash())), s(&c["mintHash"]));
    // the mint is above r, so the reduction is exercised, not skipped
    assert_ne!(hex::encode(MINT), s(&c["mintHash"]));
    assert_eq!(
        Fr::MODULUS.to_bytes_be(),
        BigUint::parse_bytes(s(&c["fieldModulus"]).as_bytes(), 10)
            .unwrap()
            .to_bytes_be()
    );
}

#[test]
fn field_bytes_are_canonical_big_endian() {
    let r_be: [u8; 32] = Fr::MODULUS.to_bytes_be().try_into().unwrap();
    assert!(fr_from_be32(&r_be).is_none(), "r itself is refused");
    let mut r_minus_1 = r_be;
    r_minus_1[31] -= 1;
    let top = fr_from_be32(&r_minus_1).expect("r - 1 is canonical");
    assert_eq!(fr_to_be32(&top), r_minus_1);
    assert!(fr_from_be32(&[0xff; 32]).is_none());
    let mut one = [0u8; 32];
    one[31] = 1;
    assert_eq!(
        fr_from_be32(&one),
        Some(Fr::from(1u64)),
        "big-endian, not little"
    );
    assert_eq!(fr_to_be32(&Fr::zero()), [0u8; 32]);
}

#[test]
fn be_mod_r_reduces_64_bytes_like_bigint_arithmetic() {
    // negative control on the reduction itself: an all-0xff 512-bit input
    let input = [0xffu8; 64];
    let want = BigUint::from_bytes_be(&input) % BigUint::from_bytes_be(&Fr::MODULUS.to_bytes_be());
    let got: Fr = field::be_mod_order(&input);
    assert_eq!(BigUint::from_bytes_be(&fr_to_be32(&got)), want);
}

// ---------------------------------------------------------------- wallet-only derivations (§3)

#[test]
fn keys_match_the_offline_vectors_for_every_fixture_seed() {
    let all = seeds();
    assert_eq!(all.len(), 5);
    let mut notes = 0;
    for v in &all {
        let mut seed = Zeroizing::new(seed64(v));
        let keys = Keys::derive(&mut seed[..]).unwrap();
        let label = &v["label"];
        assert_eq!(*keys.nk(), hex_fr(&v["nk"]), "nk {label}");
        assert_eq!(*keys.ivk(), hex_fr(&v["ivk"]), "ivk {label}");
        assert_eq!(*keys.d_self(), hex_fr(&v["dSelf"]), "d_self {label}");
        assert_eq!(
            *keys.addr_self(),
            hex_fr(&v["addrSelf"]),
            "addrField(d_self) {label}"
        );
        for n in v["notes"].as_array().unwrap() {
            let i: u64 = s(&n["depositIndex"]).parse().unwrap();
            let rho = keys.deposit_rho(i);
            assert_eq!(fr_to_be32(&rho), b32(&n["rho"]), "rho({i}) {label}");
            let nf = keys.nullifier(&rho);
            assert_eq!(fr_to_be32(&nf), b32(&n["nullifier"]), "nullifier {label}");
            assert_eq!(fr_to_be32(&rho_change(&nf)), b32(&n["rhoChange"]));
            for c in n["commitments"].as_array().unwrap() {
                let amount: u64 = s(&c["amount"]).parse().unwrap();
                let cm = keys.commitment(amount, &rho);
                assert_eq!(
                    fr_to_be32(&cm),
                    b32(&c["commitment"]),
                    "cm {label} {amount}"
                );
            }
            notes += 1;
        }
    }
    assert_eq!(notes, 25, "5 seeds x 5 deposit indices");
}

#[test]
fn keys_derive_wipes_the_seed_and_refuses_a_non_64_byte_seed() {
    let v = &seeds()[0];
    let mut seed = seed64(v);
    let _keys = Keys::derive(&mut seed[..]).unwrap();
    assert_eq!(seed, [0u8; 64], "seed wiped once sk is derived");
    let mut short = [9u8; 63];
    assert!(matches!(
        Keys::derive(&mut short[..]),
        Err(A0Error::SeedLength { got: 63 })
    ));
    assert_eq!(short, [0u8; 63], "a refused seed is wiped too");
}

// ---------------------------------------------------------------- the state and its handle

#[test]
fn core_open_returns_public_values_equal_to_the_vectors() {
    let core = Core::new();
    let v = &seeds()[0];
    let h = open(&core, v);
    let n = &v["notes"][1];
    assert_eq!(core.deposit_rho(h, 1).unwrap(), b32(&n["rho"]));
    let c = &n["commitments"][2];
    let amount: u64 = s(&c["amount"]).parse().unwrap();
    assert_eq!(
        core.commitment(h, amount, &b32(&n["rho"])).unwrap(),
        b32(&c["commitment"])
    );
}

#[test]
fn core_open_wipes_the_callers_seed_even_when_it_refuses_it() {
    let core = Core::new();
    let mut seed = seed64(&seeds()[0]);
    core.keys_open(&mut seed).unwrap();
    assert_eq!(seed, [0u8; 64]);
    let mut long = [3u8; 65];
    assert!(matches!(
        core.keys_open(&mut long),
        Err(A0Error::SeedLength { got: 65 })
    ));
    assert_eq!(long, [0u8; 65]);
}

#[test]
fn handles_are_never_zero_and_never_repeat() {
    let core = Core::new();
    let v = &seeds()[0];
    let mut seen = std::collections::HashSet::new();
    for _ in 0..5 {
        let h = open(&core, v);
        assert_ne!(h.raw(), 0);
        assert!(seen.insert(h.raw()), "handle reused");
    }
}

#[test]
fn close_invalidates_the_handle() {
    let core = Core::new();
    let h = open(&core, &seeds()[0]);
    core.keys_close(h).unwrap();
    assert!(matches!(
        core.deposit_rho(h, 0),
        Err(A0Error::UnknownHandle)
    ));
    assert!(matches!(
        core.commitment(h, 1, &[0u8; 32]),
        Err(A0Error::UnknownHandle)
    ));
    assert!(matches!(
        core.match_spent(h, &[], &[]),
        Err(A0Error::UnknownHandle)
    ));
    assert!(matches!(core.keys_close(h), Err(A0Error::UnknownHandle)));
}

#[test]
fn a_second_open_replaces_the_first() {
    let core = Core::new();
    let a = seeds()[0].clone();
    let b = seeds()[1].clone();
    let ha = open(&core, &a);
    let hb = open(&core, &b);
    assert!(matches!(
        core.deposit_rho(ha, 0),
        Err(A0Error::UnknownHandle)
    ));
    assert_eq!(core.deposit_rho(hb, 0).unwrap(), b32(&b["notes"][0]["rho"]));
    // closing with the stale handle neither succeeds nor closes the live session
    assert!(matches!(core.keys_close(ha), Err(A0Error::UnknownHandle)));
    assert!(core.deposit_rho(hb, 0).is_ok());
}

#[test]
fn a_refused_open_still_ends_the_previous_session() {
    let core = Core::new();
    let h = open(&core, &seeds()[0]);
    let mut bad = [1u8; 10];
    assert!(core.keys_open(&mut bad).is_err());
    assert!(matches!(
        core.deposit_rho(h, 0),
        Err(A0Error::UnknownHandle)
    ));
}

#[test]
fn a_handle_from_another_core_is_unknown() {
    let one = Core::new();
    let two = Core::new();
    let h = open(&one, &seeds()[0]);
    let h2 = open(&two, &seeds()[0]);
    assert_ne!(h, h2);
    assert!(matches!(two.deposit_rho(h, 0), Err(A0Error::UnknownHandle)));
    assert!(matches!(
        one.deposit_rho(h2, 0),
        Err(A0Error::UnknownHandle)
    ));
    assert!(matches!(
        Core::new().deposit_rho(Handle::from_raw(0), 0),
        Err(A0Error::UnknownHandle)
    ));
}

#[test]
fn commitment_refuses_a_non_canonical_rho() {
    let core = Core::new();
    let h = open(&core, &seeds()[0]);
    let r_be: [u8; 32] = Fr::MODULUS.to_bytes_be().try_into().unwrap();
    assert!(matches!(
        core.commitment(h, 1, &r_be),
        Err(A0Error::NonCanonical { what: "rho", .. })
    ));
}

// ---------------------------------------------------------------- matchSpent (R12)

fn nf(v: &Value, k: usize) -> [u8; 32] {
    b32(&v["notes"][k]["nullifier"])
}
fn rho(v: &Value, k: usize) -> [u8; 32] {
    b32(&v["notes"][k]["rho"])
}

#[test]
fn match_spent_returns_ascending_own_indices_whose_nullifier_is_on_chain() {
    let core = Core::new();
    let me = seeds()[0].clone();
    let other = seeds()[1].clone();
    let h = open(&core, &me);
    let own = [rho(&me, 0), rho(&me, 1), rho(&me, 2), rho(&me, 3)];
    // chain order differs from own order, carries another seed's nullifier and a duplicate
    let chain = [nf(&me, 3), nf(&other, 0), nf(&me, 0), nf(&me, 3)];
    assert_eq!(core.match_spent(h, &chain, &own).unwrap(), vec![0, 3]);
}

#[test]
fn match_spent_negative_controls() {
    let core = Core::new();
    let me = seeds()[0].clone();
    let other = seeds()[1].clone();
    let h = open(&core, &me);
    let own = [rho(&me, 0), rho(&me, 1)];
    assert!(core.match_spent(h, &[], &own).unwrap().is_empty());
    assert!(core.match_spent(h, &[nf(&me, 0)], &[]).unwrap().is_empty());
    // another seed's notes with the same rho values: their nullifiers are not ours
    assert!(core
        .match_spent(h, &[nf(&other, 0), nf(&other, 1)], &own)
        .unwrap()
        .is_empty());
    // a rho itself on the chain list does not match (it is the nullifier that counts)
    assert!(core.match_spent(h, &own, &own).unwrap().is_empty());
}

#[test]
fn match_spent_refuses_duplicate_own_rhos_and_non_canonical_values() {
    let core = Core::new();
    let me = seeds()[0].clone();
    let h = open(&core, &me);
    assert!(matches!(
        core.match_spent(h, &[], &[rho(&me, 0), rho(&me, 1), rho(&me, 0)]),
        Err(A0Error::DuplicateRho { index: 2 })
    ));
    let r_be: [u8; 32] = Fr::MODULUS.to_bytes_be().try_into().unwrap();
    assert!(matches!(
        core.match_spent(h, &[nf(&me, 0), r_be], &[rho(&me, 0)]),
        Err(A0Error::NonCanonical {
            what: "chainNullifier",
            index: 1
        })
    ));
    assert!(matches!(
        core.match_spent(h, &[], &[rho(&me, 0), r_be]),
        Err(A0Error::NonCanonical {
            what: "ownRho",
            index: 1
        })
    ));
}

// ---------------------------------------------------------------- zeroization (INV-NK)
// The probe copies a value's bytes at the moment its wipe has run (inside Drop, before the memory is
// freed) — a real read, not a promise. A mutant that skips the wipe leaves non-zero bytes here.

fn probe_all_zero(label: &str) -> usize {
    let seen = wipe_probe::take(label);
    for bytes in &seen {
        assert!(
            bytes.iter().all(|b| *b == 0),
            "{label} not wiped: {bytes:?}"
        );
        assert!(!bytes.is_empty());
    }
    seen.len()
}

#[test]
fn keys_are_wiped_on_close() {
    let core = Core::new();
    let h = open(&core, &seeds()[0]);
    wipe_probe::take("keys");
    core.keys_close(h).unwrap();
    assert_eq!(
        probe_all_zero("keys"),
        1,
        "exactly the closed keys were dropped"
    );
}

#[test]
fn keys_are_wiped_on_replacement() {
    let core = Core::new();
    open(&core, &seeds()[0]);
    wipe_probe::take("keys");
    open(&core, &seeds()[1]);
    assert_eq!(probe_all_zero("keys"), 1, "the replaced keys were dropped");
}

#[test]
fn keys_are_wiped_when_the_state_is_dropped() {
    let core = Core::new();
    open(&core, &seeds()[0]);
    wipe_probe::take("keys");
    drop(core);
    assert_eq!(probe_all_zero("keys"), 1);
}

#[test]
fn keys_are_wiped_when_the_state_is_poisoned() {
    let core = std::sync::Arc::new(Core::new());
    let h = open(&core, &seeds()[0]);
    wipe_probe::take("keys");
    let c = core.clone();
    let _ = std::thread::spawn(move || c.poison_for_test()).join();
    assert!(matches!(
        core.deposit_rho(h, 0),
        Err(A0Error::StatePoisoned)
    ));
    assert_eq!(probe_all_zero("keys"), 1, "poison wipes the keys");
    let mut seed = seed64(&seeds()[0]);
    assert!(matches!(
        core.keys_open(&mut seed),
        Err(A0Error::StatePoisoned)
    ));
    assert_eq!(seed, [0u8; 64], "a refused seed is wiped");
}

#[test]
fn the_probe_sees_live_bytes_positive_control() {
    // Without this, an all-zero probe could mean the probe reads the wrong memory.
    let mut seed = seed64(&seeds()[0]);
    let keys = Keys::derive(&mut seed[..]).unwrap();
    let live = keys.probe_bytes_for_test();
    assert!(
        live.iter().any(|b| *b != 0),
        "live keys are visible to the probe"
    );
    wipe_probe::take("keys");
    drop(keys);
    assert_eq!(probe_all_zero("keys"), 1);
}

#[test]
fn poseidon_wipes_its_state() {
    wipe_probe::take("poseidon");
    let _ = poseidon(&[Fr::from(1u64), Fr::from(2u64), Fr::from(3u64)]);
    assert_eq!(probe_all_zero("poseidon"), 1);
}
