//! ATA derivation, `parseUnshield` and the unshield authorization (spec §3 "ATA derivation",
//! §4 steps 2 and 4, §14 "derive_ata… authorization refusals", INV-AUTH's Rust half), against
//! `tests/fixtures/a0-ata-vectors.json` — written OFFLINE by `scripts/a0-vectors/gen-ata-vectors.mjs`
//! from @solana/web3.js `findProgramAddressSync` / `isOnCurve` (spl-token's own calls; its run
//! with `--spl-token` also compared every ATA with spl-token 0.3.11), @noble/curves and
//! @scure/base, after recomputing the program side's pool / tree / relayer-fee-ATA addresses.
//! Rerun `node scripts/a0-vectors/gen-ata-vectors.mjs --check` to confirm it.
//!
//! Nothing here computes an expected value with the code under test.

use super::ata::{
    check_owner, derive_ata, find_program_address, is_on_curve, ATA_PROGRAM_ID, TOKEN_PROGRAM_ID,
};
use super::auth::{self, Auth, AuthId, AUTH_TTL};
use super::field::MINT;
use super::state::{A0Error, Core, Handle};
use super::unshield::{parse_unshield, DECIMALS, FEE_CEILING, POOL, PROGRAM_ID};
use serde_json::Value;
use std::collections::HashSet;
use std::time::Duration;

const ATA_VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-ata-vectors.json"
));
/// The repo's public test seed (BIP-39 of the "abandon … about" mnemonic, no passphrase) — any
/// seed opens a session; these tests only need a live handle.
const SEED_HEX: &str = "5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4";
/// An arbitrary point on the injected clock.
const T0: Duration = Duration::from_secs(1_000);

fn v() -> Value {
    serde_json::from_str(ATA_VECTORS).unwrap()
}
fn s(v: &Value) -> &str {
    v.as_str().unwrap()
}
fn b32(v: &Value) -> [u8; 32] {
    hex::decode(s(v)).unwrap().try_into().unwrap()
}
fn owners() -> Vec<Value> {
    v()["owners"].as_array().unwrap().clone()
}
fn ok_owners() -> Vec<Value> {
    owners()
        .into_iter()
        .filter(|o| s(&o["verdict"]) == "ok")
        .collect()
}
/// The relayer fee payer: its ATA is the program side's published fee ATA 9643….
fn relayer() -> Value {
    owners()
        .into_iter()
        .find(|o| s(&o["owner"]) == "3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe")
        .unwrap()
}
fn open(core: &Core) -> Handle {
    let mut seed: [u8; 64] = hex::decode(SEED_HEX).unwrap().try_into().unwrap();
    core.keys_open(&mut seed).unwrap()
}
fn take(core: &Core, h: Handle, id: &AuthId, now: Duration) -> Result<Auth, A0Error> {
    core.lock().unwrap().take_auth(h, id, now)
}
fn verdict_error(verdict: &str) -> Option<A0Error> {
    match verdict {
        "ok" => None,
        "offCurve" => Some(A0Error::OwnerOffCurve),
        "nonCanonical" => Some(A0Error::OwnerNonCanonical),
        "smallOrder" => Some(A0Error::OwnerSmallOrder),
        "torsion" => Some(A0Error::OwnerTorsion),
        other => panic!("unknown verdict {other}"),
    }
}

// ---------------------------------------------------------------- pinned constants (R3)

#[test]
fn the_pinned_addresses_decimals_and_ceiling_match_the_fixture() {
    let c = &v()["constants"];
    assert_eq!(TOKEN_PROGRAM_ID, b32(&c["tokenProgramHex"]));
    assert_eq!(ATA_PROGRAM_ID, b32(&c["ataProgramHex"]));
    assert_eq!(POOL, b32(&c["poolHex"]));
    assert_eq!(MINT, b32(&c["mintHex"]));
    assert_eq!(u64::from(DECIMALS), c["decimals"].as_u64().unwrap());
    assert_eq!(FEE_CEILING.to_string(), s(&c["feeCeiling"]));
    assert_eq!(
        s(&c["pool"]),
        "8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT"
    );
    assert_eq!(
        s(&c["mint"]),
        "ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs"
    );
}

#[test]
fn the_program_id_is_pinned_and_the_pool_is_its_pda_with_bump_253() {
    // Final review I1 / the ledger's Task 2 ruling: POOL is tied to PROGRAM_ID in Rust. The
    // expected address and bump are the fixture's (web3.js `findProgramAddressSync`, offline)
    // and the program side's published pool — never this crate's derivation.
    let c = &v()["constants"];
    assert_eq!(
        s(&c["programId"]),
        "FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH"
    );
    assert_eq!(PROGRAM_ID, b32(&c["programIdHex"]));
    assert_eq!(
        bs58::encode(PROGRAM_ID).into_string(),
        "FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH"
    );
    let row = &v()["programAddresses"][0];
    assert_eq!(s(&row["label"]), "pool = PDA([\"pool\", mint], programId)");
    assert_eq!(s(&row["program"]), s(&c["programId"]));
    assert_eq!(s(&row["seedsHex"][0]), "706f6f6c"); // "pool"
    assert_eq!(s(&row["seedsHex"][1]), s(&c["mintHex"]));
    assert_eq!(
        s(&row["address"]),
        "8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT"
    );
    let want = (b32(&row["addressHex"]), 253u8);
    assert_eq!(row["bump"].as_u64(), Some(253));
    assert_eq!(
        find_program_address(&[b"pool", &MINT], &PROGRAM_ID),
        Some(want)
    );
    assert_eq!(POOL, want.0);
    // negative controls: another program, or a program id one bit off, is not the pool
    assert_ne!(
        find_program_address(&[b"pool", &MINT], &ATA_PROGRAM_ID).map(|p| p.0),
        Some(want.0)
    );
    let mut off = PROGRAM_ID;
    off[31] ^= 1;
    assert_ne!(
        find_program_address(&[b"pool", &MINT], &off).map(|p| p.0),
        Some(want.0)
    );
}

// ---------------------------------------------------------------- find_program_address

#[test]
fn find_program_address_matches_web3_for_the_programs_published_accounts() {
    // pool = PDA(["pool", mint]), tree = PDA(["merkle", pool]), vault = ATA(pool, mint)
    let rows = v()["programAddresses"].as_array().unwrap().clone();
    assert_eq!(rows.len(), 3);
    let consts = v()["constants"].clone();
    for r in &rows {
        let seeds: Vec<Vec<u8>> = r["seedsHex"]
            .as_array()
            .unwrap()
            .iter()
            .map(|x| hex::decode(s(x)).unwrap())
            .collect();
        let seed_refs: Vec<&[u8]> = seeds.iter().map(Vec::as_slice).collect();
        let program = if s(&r["program"]) == s(&consts["programId"]) {
            b32(&consts["programIdHex"])
        } else {
            assert_eq!(s(&r["program"]), s(&consts["ataProgram"]));
            ATA_PROGRAM_ID
        };
        let (address, bump) = find_program_address(&seed_refs, &program).unwrap();
        assert_eq!(address, b32(&r["addressHex"]), "{}", r["label"]);
        assert_eq!(
            u64::from(bump),
            r["bump"].as_u64().unwrap(),
            "{}",
            r["label"]
        );
    }
    assert_eq!(
        s(&rows[0]["address"]),
        "8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT"
    );
    assert_eq!(
        s(&rows[1]["address"]),
        "5URdh1uLKXPh28AbcXBK1oWYGpQjVbMSjrKiAkt1q1Gc"
    );
}

#[test]
fn find_program_address_matches_web3_for_every_owner_row_including_refused_owners() {
    let mut bumps = HashSet::new();
    for o in owners() {
        let owner = b32(&o["ownerHex"]);
        let (ata, bump) =
            find_program_address(&[&owner, &TOKEN_PROGRAM_ID, &MINT], &ATA_PROGRAM_ID).unwrap();
        assert_eq!(ata, b32(&o["ataHex"]), "{}", o["label"]);
        assert_eq!(
            u64::from(bump),
            o["bump"].as_u64().unwrap(),
            "{}",
            o["label"]
        );
        bumps.insert(bump);
    }
    // the loop is exercised past its first candidate (an off-by-one in the bump order shows here)
    for want in [255u8, 254, 253] {
        assert!(bumps.contains(&want), "no row with bump {want}");
    }
    assert!(bumps.iter().any(|b| *b < 253));
}

#[test]
fn is_on_curve_is_the_chains_test_for_every_owner_row() {
    let mut divergent = 0;
    for o in owners() {
        let bytes = b32(&o["ownerHex"]);
        let chain_on_curve = s(&o["verdict"]) != "offCurve";
        assert_eq!(is_on_curve(&bytes), chain_on_curve, "{}", o["label"]);
        // web3.js decodes strictly (it refuses y >= p); the runtime (dalek) does not
        if o["web3IsOnCurve"].as_bool().unwrap() != chain_on_curve {
            assert_eq!(s(&o["verdict"]), "nonCanonical", "{}", o["label"]);
            divergent += 1;
        }
    }
    assert_eq!(
        divergent, 1,
        "the fixture's non-canonical row is the only divergence"
    );
    // every ATA in the fixture is off the curve, as a PDA must be
    for o in owners() {
        assert!(!is_on_curve(&b32(&o["ataHex"])), "{}", o["label"]);
    }
}

// ---------------------------------------------------------------- the owner (m3) and derive_ata

#[test]
fn derive_ata_equals_spl_tokens_derivation_for_every_accepted_owner() {
    let ok = ok_owners();
    assert!(
        ok.len() >= 5,
        "at least three fixed owners (spec §14), got {}",
        ok.len()
    );
    for o in &ok {
        assert_eq!(
            derive_ata(&b32(&o["ownerHex"])).unwrap(),
            b32(&o["ataHex"]),
            "{}",
            o["label"]
        );
    }
    // the program side's own fact: ATA(3jvhiz…, ERkp…) is the relayer's fee ATA
    assert_eq!(
        s(&relayer()["ata"]),
        "9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9"
    );
}

#[test]
fn every_refused_owner_is_refused_with_its_reason_and_no_ata() {
    let mut seen = HashSet::new();
    for o in owners() {
        let want = verdict_error(s(&o["verdict"]));
        let bytes = b32(&o["ownerHex"]);
        match want {
            None => {
                assert_eq!(check_owner(&bytes), Ok(()), "{}", o["label"]);
            }
            Some(err) => {
                seen.insert(s(&o["verdict"]).to_string());
                assert_eq!(check_owner(&bytes), Err(err), "{}", o["label"]);
                let err = verdict_error(s(&o["verdict"])).unwrap();
                assert_eq!(derive_ata(&bytes), Err(err), "{}", o["label"]);
            }
        }
    }
    assert_eq!(
        seen.len(),
        4,
        "offCurve, nonCanonical, smallOrder, torsion: {seen:?}"
    );
}

#[test]
fn a_pda_owner_is_refused_positive_and_negative_control() {
    // the pool PDA and the relayer's fee ATA: valid addresses, but no key holds them
    for pda in [
        "8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT",
        "9643JXJm5ZZwv8yaTozQ2qMeVw6xHQWhquGsD87knME9",
    ] {
        assert_eq!(
            parse_unshield(pda, "1", "0"),
            Err(A0Error::OwnerOffCurve),
            "{pda}"
        );
    }
    // the System Program's 32 zero bytes are ON the curve for Solana, and still refused
    assert_eq!(
        parse_unshield("11111111111111111111111111111111", "1", "0"),
        Err(A0Error::OwnerSmallOrder)
    );
    // positive control: the relayer fee payer, an ordinary key, is accepted
    assert!(parse_unshield(s(&relayer()["owner"]), "1", "0").is_ok());
}

#[test]
fn owner_strings_that_are_not_32_bytes_of_canonical_base58_are_refused() {
    let bad = v()["badOwnerStrings"].as_array().unwrap().clone();
    assert!(bad.len() >= 10);
    for b in &bad {
        let want = match s(&b["error"]) {
            "base58" => A0Error::OwnerNotBase58,
            "length" => A0Error::OwnerLength {
                got: usize::try_from(b["got"].as_u64().unwrap()).unwrap(),
            },
            other => panic!("unknown error {other}"),
        };
        assert_eq!(
            parse_unshield(s(&b["s"]), "1", "0"),
            Err(want),
            "{}",
            b["label"]
        );
    }
}

#[test]
fn an_owner_string_longer_than_64_is_refused_before_it_is_decoded() {
    // final review Minor 10 / T2-2: 64 characters are still decoded (64 '1's = 64 zero bytes),
    // 65 are refused unread — so a multi-megabyte string from JS costs nothing.
    assert_eq!(
        parse_unshield(&"1".repeat(64), "1", "0"),
        Err(A0Error::OwnerLength { got: 64 })
    );
    assert_eq!(
        parse_unshield(&"1".repeat(65), "1", "0"),
        Err(A0Error::OwnerTooLong)
    );
    // a valid owner with one more character than the cap allows after it
    let ok = s(&relayer()["owner"]).to_string();
    let padded = format!("{ok}{}", "z".repeat(65 - ok.len()));
    assert_eq!(
        parse_unshield(&padded, "1", "0"),
        Err(A0Error::OwnerTooLong)
    );
    // positive control: the same owner alone is accepted
    assert!(parse_unshield(&ok, "1", "0").is_ok());
    // the record path refuses the same way and records nothing
    let core = Core::new();
    let h = open(&core);
    assert!(matches!(
        core.authorize_unshield_at(h, &"1".repeat(65), "1", "0", T0),
        Err(A0Error::OwnerTooLong)
    ));
    assert!(core.authorize_unshield_at(h, &ok, "1", "0", T0).is_ok());
}

#[test]
fn a_megabyte_owner_string_is_refused_at_once() {
    // valid base58 throughout, so without the cap it would be decoded (quadratic: an ANR)
    let big = "z".repeat(1 << 20);
    let t = std::time::Instant::now();
    assert_eq!(parse_unshield(&big, "1", "0"), Err(A0Error::OwnerTooLong));
    assert!(t.elapsed() < Duration::from_secs(1), "{:?}", t.elapsed());
}

// ---------------------------------------------------------------- parseUnshield (§4 step 2)

#[test]
fn parse_unshield_returns_rusts_own_values_and_the_pinned_pool() {
    let r = relayer();
    let u = parse_unshield(s(&r["owner"]), "1500000000", "10000").unwrap();
    assert_eq!(u.owner, s(&r["owner"]));
    assert_eq!(u.ata, s(&r["ata"]));
    assert_eq!(u.amount, 1_500_000_000);
    assert_eq!(u.fee, 10_000);
    assert_eq!(u.human_amount, "1.5");
    assert_eq!(u.human_fee, "0.00001");
    assert_eq!(u.pool, s(&v()["constants"]["pool"]));
    // every accepted owner round-trips to its own spelling and the fixture's ATA
    for o in ok_owners() {
        let u = parse_unshield(s(&o["owner"]), "1", "0").unwrap();
        assert_eq!(u.owner, s(&o["owner"]));
        assert_eq!(u.ata, s(&o["ata"]), "{}", o["label"]);
    }
}

#[test]
fn human_amounts_match_the_offline_bigint_rendering() {
    let owner = s(&relayer()["owner"]).to_string();
    let rows = v()["amounts"].as_array().unwrap().clone();
    assert!(rows.len() >= 10);
    for r in &rows {
        let units = s(&r["units"]);
        let u = parse_unshield(&owner, units, "0").unwrap();
        assert_eq!(u.human_amount, s(&r["human"]), "amount {units}");
        assert_eq!(u.amount.to_string(), units);
        if units.parse::<u64>().unwrap() <= FEE_CEILING {
            let f = parse_unshield(&owner, "1", units).unwrap();
            assert_eq!(f.human_fee, s(&r["human"]), "fee {units}");
        }
    }
    assert_eq!(parse_unshield(&owner, "1", "0").unwrap().human_fee, "0");
}

#[test]
fn amount_and_fee_are_canonical_decimal_u64_strings() {
    let owner = s(&relayer()["owner"]).to_string();
    for bad in [
        "",
        "+1",
        "-1",
        " 1",
        "1 ",
        "01",
        "00",
        "1e3",
        "0x10",
        "1_000",
        "1.0",
        "١",
        "18446744073709551616",
        "99999999999999999999999",
    ] {
        assert_eq!(
            parse_unshield(&owner, bad, "0"),
            Err(A0Error::NotU64 { what: "amount" }),
            "amount {bad:?}"
        );
        assert_eq!(
            parse_unshield(&owner, "1", bad),
            Err(A0Error::NotU64 { what: "fee" }),
            "fee {bad:?}"
        );
    }
    // positive controls: the u64 edge, and 0 for the fee
    assert_eq!(
        parse_unshield(&owner, "18446744073709551615", "0")
            .unwrap()
            .amount,
        u64::MAX
    );
    assert_eq!(parse_unshield(&owner, "10", "0").unwrap().fee, 0);
}

#[test]
fn amount_zero_fee_ceiling_and_overflow_are_refused_at_their_edges() {
    let owner = s(&relayer()["owner"]).to_string();
    assert_eq!(parse_unshield(&owner, "0", "0"), Err(A0Error::AmountZero));
    assert!(parse_unshield(&owner, "1", "1000000").is_ok());
    assert_eq!(
        parse_unshield(&owner, "1", "1000001"),
        Err(A0Error::FeeAboveCeiling)
    );
    assert_eq!(
        parse_unshield(&owner, "18446744073709551615", "1"),
        Err(A0Error::AmountPlusFeeOverflow)
    );
    assert!(parse_unshield(&owner, "18446744073709551614", "1").is_ok());
    // the owner is checked before the numbers
    assert_eq!(
        parse_unshield("11111111111111111111111111111111", "0", "x"),
        Err(A0Error::OwnerSmallOrder)
    );
}

#[test]
fn refusals_carry_no_input_value() {
    let owner = s(&relayer()["owner"]).to_string();
    let refusals = [
        parse_unshield(&owner, "123456789012", "77777777").unwrap_err(),
        parse_unshield(&owner, "98765x", "0").unwrap_err(),
        parse_unshield("8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT", "1", "0").unwrap_err(),
    ];
    for e in &refusals {
        let text = e.to_string();
        for leak in ["123456789012", "77777777", "98765", "8VMe", &owner[..8]] {
            assert!(!text.contains(leak), "{text:?} contains {leak:?}");
        }
    }
}

// ---------------------------------------------------------------- the authorization (§4 step 4)

#[test]
fn authorize_records_rusts_parsed_values_and_the_first_take_returns_them() {
    let core = Core::new();
    let h = open(&core);
    let r = relayer();
    let id = core
        .authorize_unshield_at(h, s(&r["owner"]), "700000", "50000", T0)
        .unwrap();
    let a = take(&core, h, &id, T0).unwrap();
    assert_eq!(a.owner, b32(&r["ownerHex"]));
    assert_eq!(a.ata, b32(&r["ataHex"]));
    assert_eq!(a.amount, 700_000);
    assert_eq!(a.fee, 50_000);
    assert_eq!(a.pool, b32(&v()["constants"]["poolHex"]));
    assert_eq!(a.mint, b32(&v()["constants"]["mintHex"]));
    assert_eq!(a.handle, h);
    assert_eq!(a.expires_at, T0 + Duration::from_secs(120));
    assert_eq!(AUTH_TTL, Duration::from_secs(120));
}

#[test]
fn authorize_refuses_what_parse_refuses_and_an_unknown_handle_and_records_nothing() {
    let core = Core::new();
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    assert_eq!(
        core.authorize_unshield_at(
            h,
            "8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT",
            "1",
            "0",
            T0
        )
        .unwrap_err(),
        A0Error::OwnerOffCurve
    );
    assert_eq!(
        core.authorize_unshield_at(h, &owner, "0", "0", T0)
            .unwrap_err(),
        A0Error::AmountZero
    );
    assert_eq!(
        core.authorize_unshield_at(h, &owner, "1", "1000001", T0)
            .unwrap_err(),
        A0Error::FeeAboveCeiling
    );
    assert_eq!(
        core.authorize_unshield_at(Handle::from_raw(h.raw() + 1_000_000), &owner, "1", "0", T0)
            .unwrap_err(),
        A0Error::UnknownHandle
    );
    // nothing was recorded by any refusal: a fresh authorization is not "in flight"-blocked
    let id = core.authorize_unshield_at(h, &owner, "1", "0", T0).unwrap();
    assert!(take(&core, h, &id, T0).is_ok());
}

#[test]
fn the_first_take_consumes_the_authorization_success_or_failure() {
    let core = Core::new();
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    // a successful take, then the same id again
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert!(take(&core, h, &id, T0).is_ok());
    assert_eq!(take(&core, h, &id, T0).unwrap_err(), A0Error::AuthAbsent);
    // a take with a wrong id uses up the live one
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    let wrong = AuthId::from_bytes([0x5a; 16]);
    assert_eq!(
        take(&core, h, &wrong, T0).unwrap_err(),
        A0Error::AuthMismatch
    );
    assert_eq!(take(&core, h, &id, T0).unwrap_err(), A0Error::AuthAbsent);
    // an id that differs from the live one in its LAST byte only is another id
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    let mut near = id.to_bytes();
    near[15] ^= 1;
    assert_eq!(
        take(&core, h, &AuthId::from_bytes(near), T0).unwrap_err(),
        A0Error::AuthMismatch
    );
    // an expired take uses it up too
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert_eq!(
        take(&core, h, &id, T0 + AUTH_TTL).unwrap_err(),
        A0Error::AuthExpired
    );
    assert_eq!(take(&core, h, &id, T0).unwrap_err(), A0Error::AuthAbsent);
    // and never authorized at all
    let fresh = Core::new();
    let h2 = open(&fresh);
    assert_eq!(
        take(&fresh, h2, &AuthId::from_bytes([0; 16]), T0).unwrap_err(),
        A0Error::AuthAbsent
    );
}

#[test]
fn the_authorization_is_usable_for_exactly_120_seconds_from_approval() {
    let core = Core::new();
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    let last_ns = T0 + AUTH_TTL - Duration::from_nanos(1);
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert!(
        take(&core, h, &id, last_ns).is_ok(),
        "usable 1 ns before expiry"
    );
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert_eq!(
        take(&core, h, &id, T0 + Duration::from_secs(120)).unwrap_err(),
        A0Error::AuthExpired,
        "refused at approval + 120 s"
    );
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert_eq!(
        take(&core, h, &id, T0 + Duration::from_secs(3600)).unwrap_err(),
        A0Error::AuthExpired
    );
}

#[test]
fn an_approval_time_whose_expiry_overflows_is_a_clock_refusal_not_a_panic() {
    // final review Minor 11 / T2-3: `now + 120 s` is `checked_add` — a refusal, no record, and
    // the state is not poisoned (a panic under the lock would wipe the keys).
    let core = Core::new();
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    assert!(matches!(
        core.authorize_unshield_at(h, &owner, "1", "0", Duration::MAX),
        Err(A0Error::Clock)
    ));
    // the largest approval time that still fits is accepted (edge, positive control) …
    let edge = Duration::MAX - AUTH_TTL;
    let id = core
        .authorize_unshield_at(h, &owner, "1", "0", edge)
        .unwrap();
    assert!(take(&core, h, &id, edge).is_ok());
    // … and the session is alive: nothing was recorded by the refusal, the keys were not wiped
    assert!(core.authorize_unshield_at(h, &owner, "1", "0", T0).is_ok());
    assert!(core.deposit_rho(h, 0).is_ok());
}

#[test]
fn one_authorization_at_a_time() {
    let core = Core::new();
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    let first = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert_eq!(
        core.authorize_unshield_at(h, &owner, "6", "0", T0 + Duration::from_secs(119))
            .unwrap_err(),
        A0Error::AuthInFlight
    );
    // the refused second request did not disturb the first
    let a = take(&core, h, &first, T0).unwrap();
    assert_eq!(a.amount, 5);
    // once taken, a new one may be recorded
    let second = core.authorize_unshield_at(h, &owner, "6", "0", T0).unwrap();
    // once expired, it no longer blocks: it is replaced, and its id is dead
    let third = core
        .authorize_unshield_at(h, &owner, "7", "0", T0 + AUTH_TTL)
        .unwrap();
    assert_eq!(
        take(&core, h, &second, T0 + AUTH_TTL).unwrap_err(),
        A0Error::AuthMismatch
    );
    let fourth = core
        .authorize_unshield_at(h, &owner, "8", "0", T0 + AUTH_TTL)
        .unwrap();
    let a = take(&core, h, &fourth, T0 + AUTH_TTL).unwrap();
    assert_eq!(a.amount, 8);
    assert!(!third.same(&fourth));
}

#[test]
fn close_and_reopen_invalidate_the_authorization() {
    let owner = s(&relayer()["owner"]).to_string();
    // keysClose
    let core = Core::new();
    let h = open(&core);
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    core.keys_close(h).unwrap();
    assert_eq!(take(&core, h, &id, T0).unwrap_err(), A0Error::UnknownHandle);
    let h2 = open(&core);
    assert_eq!(take(&core, h2, &id, T0).unwrap_err(), A0Error::AuthAbsent);
    // a second keysOpen
    let core = Core::new();
    let h = open(&core);
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    let h2 = open(&core);
    assert_eq!(take(&core, h2, &id, T0).unwrap_err(), A0Error::AuthAbsent);
    assert_eq!(take(&core, h, &id, T0).unwrap_err(), A0Error::UnknownHandle);
    // a REFUSED second keysOpen still ends the session and its authorization
    let core = Core::new();
    let h = open(&core);
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert!(core.keys_open(&mut [9u8; 10]).is_err());
    let h2 = open(&core);
    assert_eq!(take(&core, h2, &id, T0).unwrap_err(), A0Error::AuthAbsent);
    // positive control: without a close or an open, the same sequence succeeds
    let core = Core::new();
    let h = open(&core);
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    assert!(take(&core, h, &id, T0).is_ok());
}

#[test]
fn a_record_under_another_handle_is_refused() {
    // Unreachable through the API (end_session clears the record with its session); planted
    // here so the check behind it is a tested check, not a comment.
    let core = Core::new();
    let h = open(&core);
    let id = AuthId::from_bytes([7; 16]);
    let planted = |handle: Handle| Auth {
        id,
        handle,
        owner: b32(&relayer()["ownerHex"]),
        ata: b32(&relayer()["ataHex"]),
        amount: 5,
        fee: 0,
        pool: POOL,
        mint: MINT,
        expires_at: T0 + AUTH_TTL,
    };
    core.lock()
        .unwrap()
        .plant_auth_for_test(planted(Handle::from_raw(h.raw() ^ 1)));
    assert_eq!(
        take(&core, h, &id, T0).unwrap_err(),
        A0Error::AuthWrongHandle
    );
    assert_eq!(take(&core, h, &id, T0).unwrap_err(), A0Error::AuthAbsent);
    // positive control: the same record under the live handle is accepted
    core.lock().unwrap().plant_auth_for_test(planted(h));
    assert!(take(&core, h, &id, T0).is_ok());
}

#[test]
fn a_poisoned_state_drops_the_authorization() {
    let core = std::sync::Arc::new(Core::new());
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
    let c = core.clone();
    let _ = std::thread::spawn(move || c.poison_for_test()).join();
    assert_eq!(
        core.authorize_unshield_at(h, &owner, "5", "0", T0)
            .unwrap_err(),
        A0Error::StatePoisoned
    );
    // the record went with the keys: the raw inner state behind the poison holds none
    let mut inner = core.lock_ignoring_poison_for_test();
    assert_eq!(inner.peek_auth_expiry_for_test(), None);
    assert_eq!(
        inner.take_auth(h, &id, T0).unwrap_err(),
        A0Error::UnknownHandle
    );
}

#[test]
fn auth_ids_come_from_the_os_rng_not_from_the_data() {
    let core = Core::new();
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    let mut ids = HashSet::new();
    for _ in 0..64 {
        // the same request every time: an id derived from the data would repeat
        let id = core.authorize_unshield_at(h, &owner, "5", "0", T0).unwrap();
        assert!(take(&core, h, &id, T0).is_ok());
        let bytes = id.to_bytes();
        assert_ne!(bytes, [0u8; 16]);
        ids.insert(bytes);
    }
    assert_eq!(ids.len(), 64, "64 equal requests, 64 distinct ids");
    assert_eq!(
        format!("{:?}", AuthId::from_bytes([0xab; 16])),
        "AuthId(..)"
    );
}

#[test]
fn the_real_clock_advances_and_the_public_authorize_uses_it() {
    let a = auth::now().unwrap();
    std::thread::sleep(Duration::from_millis(30));
    let b = auth::now().unwrap();
    assert!(b - a >= Duration::from_millis(30), "{a:?} → {b:?}");
    let core = Core::new();
    let h = open(&core);
    let owner = s(&relayer()["owner"]).to_string();
    let id = core.authorize_unshield(h, &owner, "5", "0").unwrap();
    let after = auth::now().unwrap();
    // recorded at a time between `b` and `after`: still live now, dead 120 s from now
    let probe = core.lock().unwrap().peek_auth_expiry_for_test().unwrap();
    assert!(
        probe >= b + AUTH_TTL && probe <= after + AUTH_TTL,
        "{probe:?}"
    );
    assert!(take(&core, h, &id, after).is_ok());
}
