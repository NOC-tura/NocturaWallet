//! The JNI surface's logic (spec §3 "JNI surface", "The seed crosses as bytes"; Task 4): one
//! function per bound call, taking what the JVM hands over — the seed as bytes, everything else
//! as strings — and returning one JSON envelope string, so `android.rs` is marshalling only and
//! these functions are tested on the desktop (`tests_bridge.rs`).
//!
//! The envelope: `{"ok": <value>}`, or `{"error": "<E_A0_… code>", "message": "<text>"}` with
//! the code from [`A0Error::code`] and the text from its `Display` — neither carries an input
//! value or a secret (tested). A panic becomes `{"error": "E_A0_INTERNAL", …}`: nothing unwinds
//! into the JVM, and a panic under the state lock poisons it, which wipes the keys.
//!
//! The forms, each with one spelling (anything else is `E_A0_ARG` / `E_A0_ARG_ITEM`):
//! - a handle: the canonical decimal of the `u64` `keys_open` returned (`"0"` is never live);
//! - `depositIndex`, `amount`, `fee`: canonical decimal `u64` (`E_A0_NOT_U64` otherwise);
//! - `rho`, a nullifier: 64 lowercase hex chars, 32 bytes big-endian (the core then refuses a
//!   value `≥ r` with `E_A0_NON_CANONICAL`, never reducing it);
//! - an `authId`: 32 lowercase hex chars (16 bytes), or absent (`None` — the JVM's `null`).
//!
//! What crosses back (INV-NK, INV-NULL): a handle, a deposit `rho`, a commitment, the indices of
//! spent own notes, the dialog's parsed values, an `authId`, and a proof with its public inputs —
//! the one place an own note's nullifier leaves Rust (a withdraw_change proof's input [1]).
//! `parse_unshield` and `authorize_unshield` are bound in Kotlin only, never in the React
//! module (their dialog is M1c's).

use super::auth::AuthId;
use super::state::{A0Error, Core, Handle};
use super::unshield::{self, parse_u64};
use serde_json::{json, Value};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::Path;
use zeroize::Zeroize;

/// The code of a panic caught at the boundary.
pub const INTERNAL: &str = "E_A0_INTERNAL";

/// Runs `f` and wraps its outcome in the envelope; a panic is caught and reported as
/// [`INTERNAL`] with a fixed message (the panic's own message is not passed on).
pub(crate) fn envelope(f: impl FnOnce() -> Result<Value, A0Error>) -> String {
    match catch_unwind(AssertUnwindSafe(f)) {
        Ok(Ok(v)) => json!({ "ok": v }).to_string(),
        Ok(Err(e)) => json!({ "error": e.code(), "message": e.to_string() }).to_string(),
        Err(_) => json!({ "error": INTERNAL, "message": "internal error" }).to_string(),
    }
}

fn handle(s: &str) -> Result<Handle, A0Error> {
    parse_u64(s, "handle")
        .map(Handle::from_raw)
        .map_err(|_| A0Error::Arg { what: "handle" })
}

/// Exactly `2 * N` lowercase hex digits → `N` bytes.
fn lower_hex<const N: usize>(s: &str) -> Option<[u8; N]> {
    let b = s.as_bytes();
    if b.len() != 2 * N || !b.iter().all(|c| matches!(c, b'0'..=b'9' | b'a'..=b'f')) {
        return None;
    }
    let mut out = [0u8; N];
    hex::decode_to_slice(s, &mut out).ok()?;
    Some(out)
}

fn hex_list(items: &[String], what: &'static str) -> Result<Vec<[u8; 32]>, A0Error> {
    items
        .iter()
        .enumerate()
        .map(|(index, s)| lower_hex::<32>(s).ok_or(A0Error::ArgItem { what, index }))
        .collect()
}

fn auth_id(s: Option<&str>) -> Result<Option<AuthId>, A0Error> {
    match s {
        None => Ok(None),
        Some(s) => lower_hex::<16>(s)
            .map(|b| Some(AuthId::from_bytes(b)))
            .ok_or(A0Error::Arg { what: "authId" }),
    }
}

/// `keysOpen(seed) -> handle`. `seed` is wiped before this returns, on every path.
pub fn keys_open(core: &Core, seed: &mut [u8]) -> String {
    let out = envelope(|| {
        core.keys_open(seed)
            .map(|h| Value::String(h.raw().to_string()))
    });
    seed.zeroize();
    out
}

/// `keysClose(handle)`.
pub fn keys_close(core: &Core, h: &str) -> String {
    envelope(|| core.keys_close(handle(h)?).map(|()| Value::Null))
}

/// `depositRho(handle, depositIndex) -> 64 hex`.
pub fn deposit_rho(core: &Core, h: &str, deposit_index: &str) -> String {
    envelope(|| {
        let h = handle(h)?;
        let i = parse_u64(deposit_index, "depositIndex")?;
        core.deposit_rho(h, i).map(|b| json!(hex::encode(b)))
    })
}

/// `matchSpent(handle, chainNullifiers, ownRhos) -> indices into ownRhos` (R12).
pub fn match_spent(
    core: &Core,
    h: &str,
    chain_nullifiers: &[String],
    own_rhos: &[String],
) -> String {
    envelope(|| {
        let h = handle(h)?;
        let chain = hex_list(chain_nullifiers, "chainNullifiers")?;
        let own = hex_list(own_rhos, "ownRhos")?;
        core.match_spent(h, &chain, &own).map(|v| json!(v))
    })
}

/// `commitment(handle, amount, rho) -> 64 hex` (an own note's; `d_self` implicit).
pub fn commitment(core: &Core, h: &str, amount: &str, rho: &str) -> String {
    envelope(|| {
        let h = handle(h)?;
        let amount = parse_u64(amount, "amount")?;
        let rho = lower_hex::<32>(rho).ok_or(A0Error::Arg { what: "rho" })?;
        core.commitment(h, amount, &rho)
            .map(|b| json!(hex::encode(b)))
    })
}

/// `prove(handle, circuit, witnessJson, authId?, zkeyPath, wasmPath) -> {proofBytes,
/// publicInputs}` — 512 hex chars and the circuit's public inputs as 64-hex each, in order.
///
/// A malformed handle or `authId` is refused — and, like every prove (Task 3), it uses the live
/// authorization up first: an approval is good for one attempt, whatever that attempt was.
pub fn prove(
    core: &Core,
    h: &str,
    circuit: &str,
    witness_json: &str,
    auth: Option<&str>,
    zkey_path: &str,
    wasm_path: &str,
) -> String {
    envelope(|| {
        let (h, auth) = match handle(h).and_then(|h| Ok((h, auth_id(auth)?))) {
            Ok(args) => args,
            Err(e) => {
                core.discard_auth()?;
                return Err(e);
            }
        };
        let p = core.prove(
            h,
            circuit,
            witness_json,
            auth,
            Path::new(zkey_path),
            Path::new(wasm_path),
        )?;
        Ok(json!({
            "proofBytes": hex::encode(p.proof_bytes),
            "publicInputs": p.public_inputs.iter().map(hex::encode).collect::<Vec<_>>(),
        }))
    })
}

/// `parseUnshield(owner, amount, fee)` — Kotlin only: the dialog's values, every one computed
/// here; `amount` / `fee` come back as decimal strings (a u64 does not fit a JSON number).
pub fn parse_unshield(owner: &str, amount: &str, fee: &str) -> String {
    envelope(|| {
        unshield::parse_unshield(owner, amount, fee).map(|u| {
            json!({
                "owner": u.owner,
                "ata": u.ata,
                "amount": u.amount.to_string(),
                "fee": u.fee.to_string(),
                "humanAmount": u.human_amount,
                "humanFee": u.human_fee,
                "pool": u.pool,
            })
        })
    })
}

/// `authorizeUnshield(handle, owner, amount, fee) -> authId` (32 lowercase hex) — Kotlin only,
/// on the biometric approval.
pub fn authorize_unshield(core: &Core, h: &str, owner: &str, amount: &str, fee: &str) -> String {
    envelope(|| {
        core.authorize_unshield(handle(h)?, owner, amount, fee)
            .map(|id| json!(hex::encode(id.to_bytes())))
    })
}
