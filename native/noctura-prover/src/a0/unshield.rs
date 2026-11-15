//! `parseUnshield(owner, amount, fee)` (spec §4 step 2, R3, m3, m-3): the values the native
//! confirmation dialog shows, every one of them computed here — JS supplies only the three
//! strings, and nothing it could pass changes the pool, the mint or the decimals.
//!
//! - `owner`: base58 of exactly 32 bytes (a 32-byte value has one spelling; a string longer
//!   than [`OWNER_MAX_LEN`] is refused before it is decoded) and a possible Ed25519 public key (`ata::check_owner`); `ata = ATA(owner, pinned mint)` is derived here.
//! - `amount`, `fee`: decimal u64 strings, digits only, no sign, no leading zero, no spaces;
//!   `amount > 0`; `fee <= FEE_CEILING` (a sanity ceiling pinned here, NOT `pool.max_fee`, which
//!   the pool authority can change — the chain enforces that one); `amount + fee` fits a u64
//!   (`amount + fee <= inputAmount` is checked at `prove`, where `inputAmount` is bound).
//! - Human amounts with the pinned decimals, in integer arithmetic only (cardinal rule 2).

use super::ata::derive_ata;
use super::state::A0Error;

/// The devnet A0 program `FeGSSsJtmA7GnMgnpj33JsiceSk1NyFopff2FtQFsMuH` (spec §1, R3; the
/// Global Constraints' "pinned in Rust"). [`POOL`] is its PDA `["pool", MINT]` with bump 253 —
/// a test derives it with `find_program_address` and compares it with the fixture written
/// offline by web3.js (`tests/fixtures/a0-ata-vectors.json`), so the two pins cannot drift.
/// Nothing in M1a builds a transaction with it; M1b / M1c reuse this one pin.
pub const PROGRAM_ID: [u8; 32] = [
    0xd9, 0x8f, 0x90, 0x43, 0x35, 0xb2, 0x10, 0x24, 0xc2, 0x83, 0x5a, 0x36, 0xec, 0xea, 0xbe, 0x24,
    0x63, 0xf6, 0xd1, 0x3a, 0x7d, 0x26, 0xc2, 0x8f, 0xd5, 0x94, 0xec, 0x42, 0x0e, 0x73, 0xb5, 0x78,
];

/// The devnet A0 pool `8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT` (spec §1, R3) —
/// `PDA(["pool", MINT], PROGRAM_ID)`, bump 253.
pub(crate) const POOL: [u8; 32] = [
    0x6f, 0x45, 0x68, 0x63, 0xaa, 0x9a, 0xfa, 0x9a, 0xfa, 0x96, 0x05, 0x29, 0x1f, 0x51, 0x4e, 0x06,
    0xae, 0x05, 0x8c, 0x2a, 0x72, 0x51, 0xac, 0x0b, 0x42, 0x37, 0x29, 0x3d, 0x1b, 0xfc, 0xef, 0x96,
];

/// The pinned mint's decimals — a fact: the devnet mint account `ERkp…` carries `decimals: 9`
/// (created by the program side's `scripts/a0-devnet-acceptance.mjs` with `createMint(…, 9)`).
pub const DECIMALS: u32 = 9;

/// The relayer-fee sanity ceiling in base units (m-3): 10× the pool's current `max_fee`.
pub const FEE_CEILING: u64 = 1_000_000;

/// What the dialog shows (spec §3 `parseUnshield -> {owner, ata, amount, fee, humanAmount,
/// humanFee, pool}`). Every field is computed in Rust; the addresses are base58 of the bytes
/// Rust holds, not the caller's strings.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Unshield {
    pub owner: String,
    pub ata: String,
    pub amount: u64,
    pub fee: u64,
    pub human_amount: String,
    pub human_fee: String,
    pub pool: String,
}

/// The parsed request as bytes — what an authorization records.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Parsed {
    pub(crate) owner: [u8; 32],
    pub(crate) ata: [u8; 32],
    pub(crate) amount: u64,
    pub(crate) fee: u64,
}

/// A decimal u64 in its one canonical spelling: `0`, or a non-zero digit then digits.
pub(crate) fn parse_u64(s: &str, what: &'static str) -> Result<u64, A0Error> {
    let b = s.as_bytes();
    let canonical =
        !b.is_empty() && b.iter().all(u8::is_ascii_digit) && (b.len() == 1 || b[0] != b'0');
    if !canonical {
        return Err(A0Error::NotU64 { what });
    }
    s.parse::<u64>().map_err(|_| A0Error::NotU64 { what })
}

/// The longest owner string that is decoded at all. A 32-byte value is at most 44 base58
/// characters; the cap leaves room above that so every malformed address of near-valid length
/// still gets its precise reason (a 45-character string is "not base58" or "33 bytes"), while a
/// multi-megabyte string from JS is refused in O(1) instead of stalling the native-modules
/// thread in base58's quadratic decode (an ANR).
pub(crate) const OWNER_MAX_LEN: usize = 64;

fn parse_owner(s: &str) -> Result<[u8; 32], A0Error> {
    if s.len() > OWNER_MAX_LEN {
        return Err(A0Error::OwnerTooLong);
    }
    let bytes = bs58::decode(s)
        .into_vec()
        .map_err(|_| A0Error::OwnerNotBase58)?;
    let owner: [u8; 32] = bytes
        .as_slice()
        .try_into()
        .map_err(|_| A0Error::OwnerLength { got: bytes.len() })?;
    // No re-encode check is needed: a base58 string's leading '1's are exactly its leading zero
    // bytes and the rest is a number without leading zeros, so a 32-byte decode has one spelling.
    Ok(owner)
}

pub(crate) fn parse(owner: &str, amount: &str, fee: &str) -> Result<Parsed, A0Error> {
    let owner = parse_owner(owner)?;
    let ata = derive_ata(&owner)?;
    let amount = parse_u64(amount, "amount")?;
    let fee = parse_u64(fee, "fee")?;
    if amount == 0 {
        return Err(A0Error::AmountZero);
    }
    if fee > FEE_CEILING {
        return Err(A0Error::FeeAboveCeiling);
    }
    if amount.checked_add(fee).is_none() {
        return Err(A0Error::AmountPlusFeeOverflow);
    }
    Ok(Parsed {
        owner,
        ata,
        amount,
        fee,
    })
}

/// Base units → the human amount with [`DECIMALS`]: the whole part, then `.` and the fraction
/// with its trailing zeros removed (no `.` when the fraction is zero). No grouping, no locale.
pub(crate) fn human(units: u64) -> String {
    let scale = 10u64.pow(DECIMALS);
    let (whole, frac) = (units / scale, units % scale);
    if frac == 0 {
        return whole.to_string();
    }
    let digits = format!("{frac:0width$}", width = DECIMALS as usize);
    format!("{whole}.{}", digits.trim_end_matches('0'))
}

impl Parsed {
    pub(crate) fn render(&self) -> Unshield {
        Unshield {
            owner: bs58::encode(self.owner).into_string(),
            ata: bs58::encode(self.ata).into_string(),
            amount: self.amount,
            fee: self.fee,
            human_amount: human(self.amount),
            human_fee: human(self.fee),
            pool: bs58::encode(POOL).into_string(),
        }
    }
}

/// `parseUnshield(owner, amount, fee)` — Kotlin only (spec §3); needs no key handle.
pub fn parse_unshield(owner: &str, amount: &str, fee: &str) -> Result<Unshield, A0Error> {
    parse(owner, amount, fee).map(|p| p.render())
}
