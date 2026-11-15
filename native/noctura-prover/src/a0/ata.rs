//! Solana program addresses and the unshield destination's token account (spec §3 "ATA
//! derivation", C1, m3).
//!
//! - `find_program_address`: SHA-256(seeds ‖ [bump] ‖ program id ‖ "ProgramDerivedAddress"),
//!   bump from 255 down to 1 (the Solana runtime's and web3.js's loop; bump 0 is never tried),
//!   the first candidate that is OFF the Ed25519 curve.
//! - "On the curve" is the runtime's own test: `CompressedEdwardsY::decompress().is_some()` with
//!   the curve25519-dalek version the runtime uses (4.1.3).
//! - The unshield owner must be a possible Ed25519 PUBLIC KEY, which is stricter than "on the
//!   curve": the canonical encoding of a point of the prime-order subgroup other than the
//!   identity. A PDA (off curve), a small-order point (the System Program's 32 zero bytes is
//!   one), a point with a torsion component or a non-canonical encoding has no key a person
//!   holds, so tokens sent to its ATA could not be moved by the recipient. Refused (m3).

use super::field::MINT;
use super::state::A0Error;
use curve25519_dalek::edwards::CompressedEdwardsY;
use sha2::{Digest, Sha256};

/// `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` — the classic SPL Token program (the pool's).
pub(crate) const TOKEN_PROGRAM_ID: [u8; 32] = [
    0x06, 0xdd, 0xf6, 0xe1, 0xd7, 0x65, 0xa1, 0x93, 0xd9, 0xcb, 0xe1, 0x46, 0xce, 0xeb, 0x79, 0xac,
    0x1c, 0xb4, 0x85, 0xed, 0x5f, 0x5b, 0x37, 0x91, 0x3a, 0x8c, 0xf5, 0x85, 0x7e, 0xff, 0x00, 0xa9,
];

/// `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` — the Associated Token Account program.
pub(crate) const ATA_PROGRAM_ID: [u8; 32] = [
    0x8c, 0x97, 0x25, 0x8f, 0x4e, 0x24, 0x89, 0xf1, 0xbb, 0x3d, 0x10, 0x29, 0x14, 0x8e, 0x0d, 0x83,
    0x0b, 0x5a, 0x13, 0x99, 0xda, 0xff, 0x10, 0x84, 0x04, 0x8e, 0x7b, 0xd8, 0xdb, 0xe9, 0xf8, 0x59,
];

const PDA_MARKER: &[u8] = b"ProgramDerivedAddress";

/// The Solana runtime's `is_on_curve`: the 32 bytes decompress to an Ed25519 point.
pub(crate) fn is_on_curve(bytes: &[u8; 32]) -> bool {
    CompressedEdwardsY(*bytes).decompress().is_some()
}

/// `Pubkey::find_program_address(seeds, program_id)`: the address and its bump, or `None` if
/// every bump 255..=1 lands on the curve (never observed; probability ~2^-255).
pub(crate) fn find_program_address(
    seeds: &[&[u8]],
    program_id: &[u8; 32],
) -> Option<([u8; 32], u8)> {
    for bump in (1..=u8::MAX).rev() {
        let mut h = Sha256::new();
        for s in seeds {
            h.update(s);
        }
        h.update([bump]);
        h.update(program_id);
        h.update(PDA_MARKER);
        let candidate: [u8; 32] = h.finalize().into();
        if !is_on_curve(&candidate) {
            return Some((candidate, bump));
        }
    }
    None
}

/// Refuses an owner that is not a possible Ed25519 public key (module doc), in this order:
/// off curve, non-canonical encoding, small order, torsion component.
pub(crate) fn check_owner(owner: &[u8; 32]) -> Result<(), A0Error> {
    let compressed = CompressedEdwardsY(*owner);
    let point = compressed.decompress().ok_or(A0Error::OwnerOffCurve)?;
    if point.compress() != compressed {
        return Err(A0Error::OwnerNonCanonical);
    }
    if point.is_small_order() {
        return Err(A0Error::OwnerSmallOrder);
    }
    if !point.is_torsion_free() {
        return Err(A0Error::OwnerTorsion);
    }
    Ok(())
}

/// `ata = ATA(owner, pinned mint)` = `find_program_address([owner, TOKEN_PROGRAM_ID, MINT],
/// ATA_PROGRAM_ID)`, after [`check_owner`].
pub(crate) fn derive_ata(owner: &[u8; 32]) -> Result<[u8; 32], A0Error> {
    check_owner(owner)?;
    find_program_address(&[owner, &TOKEN_PROGRAM_ID, &MINT], &ATA_PROGRAM_ID)
        .map(|(ata, _bump)| ata)
        .ok_or(A0Error::NoProgramAddress)
}
