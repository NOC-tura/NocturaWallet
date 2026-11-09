//! A0 field values over the BN254 scalar field (spec §1.4a of the freeze, §3 of the M1 spec):
//! domain tags, the canonical 32-byte big-endian encoding, `be_mod_r`, the pinned mint and its
//! `mintHash`, the circomlib-compatible Poseidon, and the key-free equations (`rho_change`).
//!
//! Poseidon: the permutation is this crate's own (so its state is a fixed array that is wiped —
//! light-poseidon's `hash` reallocates its state `Vec` every round and frees it unwiped, and
//! Poseidon is a permutation, so a final state left in freed memory inverts to the inputs, `sk`
//! among them). The CONSTANTS are light-poseidon 0.1.2's `parameters::bn254_x5` (round constants
//! and MDS for x^5, 8 full rounds, the circomlib partial-round counts) — the parameter set
//! circomlib's `poseidon.circom` uses. The tests hold the result to the circuit-validated golden
//! rows, to poseidon-lite (the offline fixture) and to light-poseidon's own hasher.

use ark_ff::{BigInteger256, Field, PrimeField, Zero};
use light_poseidon::parameters::bn254_x5::get_poseidon_parameters;
use light_poseidon::PoseidonParameters;
use std::sync::OnceLock;
use zeroize::Zeroize;

pub(crate) use ark_bn254::Fr;

/// Domain tags (A0 freeze §1.4a). 0x01–0x0F are the old scheme, burned.
pub(crate) const TAG_CM: Fr = ark_ff::MontFp!("16");
pub(crate) const TAG_NULL: Fr = ark_ff::MontFp!("17");
pub(crate) const TAG_ADDR: Fr = ark_ff::MontFp!("18");
pub(crate) const TAG_RHO: Fr = ark_ff::MontFp!("19");
pub(crate) const TAG_NK: Fr = ark_ff::MontFp!("20");
pub(crate) const TAG_IVK: Fr = ark_ff::MontFp!("21");

/// The devnet A0 pool's mint `ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs` as its 32 bytes
/// (spec §1, R3). The test compares these bytes with the fixture's own base58 decode.
pub(crate) const MINT: [u8; 32] = [
    0xc7, 0x7f, 0x68, 0xe5, 0xb7, 0x7b, 0xe0, 0xed, 0x9e, 0x3b, 0xcc, 0x15, 0xba, 0xb1, 0xb1, 0xa0,
    0x7d, 0x46, 0x2a, 0xe6, 0xc9, 0x8e, 0x06, 0xb2, 0xc6, 0xf9, 0x07, 0x2b, 0x3f, 0xcc, 0xdc, 0xa8,
];

/// Big-endian bytes reduced modulo the field order — `be_mod_r` (spec §3; the program's
/// `be_mod_f` is the same reduction). Horner over the bytes: no heap, any length.
pub(crate) fn be_mod_order<F: PrimeField>(bytes: &[u8]) -> F {
    let base = F::from(256u64);
    let mut acc = F::zero();
    for &b in bytes {
        acc = acc * base + F::from(u64::from(b));
    }
    acc
}

/// The canonical encoding: 32 bytes big-endian, value < r. `None` for a non-canonical input
/// (never silently reduced — a reduced value would hash to one the circuit never sees).
pub(crate) fn fr_from_be32(bytes: &[u8; 32]) -> Option<Fr> {
    let mut limbs = [0u64; 4];
    for (i, limb) in limbs.iter_mut().enumerate() {
        let start = 32 - 8 * (i + 1);
        let mut word = [0u8; 8];
        word.copy_from_slice(&bytes[start..start + 8]);
        *limb = u64::from_be_bytes(word);
    }
    let v = Fr::from_bigint(BigInteger256::new(limbs));
    limbs.zeroize();
    v
}

/// 32 bytes big-endian of a field element.
pub(crate) fn fr_to_be32(v: &Fr) -> [u8; 32] {
    let mut limbs = v.into_bigint().0;
    let mut out = [0u8; 32];
    for (i, limb) in limbs.iter().enumerate() {
        let start = 32 - 8 * (i + 1);
        out[start..start + 8].copy_from_slice(&limb.to_be_bytes());
    }
    limbs.zeroize();
    out
}

/// `mintHash = be_mod_r(mint)` of the pinned mint.
pub(crate) fn mint_hash() -> Fr {
    be_mod_order(&MINT)
}

/// The largest arity A0 uses (Poseidon5, the commitment) → width 6.
const MAX_WIDTH: usize = 6;

fn parameters(width: usize) -> &'static PoseidonParameters<Fr> {
    static PARAMS: OnceLock<Vec<PoseidonParameters<Fr>>> = OnceLock::new();
    let all = PARAMS.get_or_init(|| {
        (2..=MAX_WIDTH)
            .map(|t| {
                get_poseidon_parameters::<Fr>(t as u8)
                    .expect("light-poseidon carries the circom parameters for widths 2..=13")
            })
            .collect()
    });
    &all[width - 2]
}

#[inline(always)]
fn sbox(x: &mut Fr) {
    let x2 = x.square();
    let x4 = x2.square();
    *x *= x4;
}

/// circomlib's `Poseidon(N)`: state `[0, inputs…]`, output `state[0]`. N in 1..=5.
pub(crate) fn poseidon<const N: usize>(inputs: &[Fr; N]) -> Fr {
    const { assert!(N >= 1 && N < MAX_WIDTH) };
    let width = N + 1;
    let p = parameters(width);
    debug_assert_eq!(p.width, width);
    let mut state = [Fr::zero(); MAX_WIDTH];
    let mut next = [Fr::zero(); MAX_WIDTH];
    state[1..width].copy_from_slice(inputs);
    let half = p.full_rounds / 2;
    let rounds = p.full_rounds + p.partial_rounds;
    for round in 0..rounds {
        for (i, s) in state[..width].iter_mut().enumerate() {
            *s += p.ark[round * width + i];
        }
        if round < half || round >= half + p.partial_rounds {
            state[..width].iter_mut().for_each(sbox);
        } else {
            sbox(&mut state[0]);
        }
        for (i, n) in next[..width].iter_mut().enumerate() {
            *n = Fr::zero();
            for (j, s) in state[..width].iter().enumerate() {
                *n += *s * p.mds[i][j];
            }
        }
        state[..width].copy_from_slice(&next[..width]);
    }
    let out = state[0];
    state.zeroize();
    next.zeroize();
    #[cfg(test)]
    super::wipe_probe::record("poseidon", &super::wipe_probe::bytes_of(&(state, next)));
    out
}

/// `rho_change = Poseidon3(TAG_RHO, nullifier, 0)` — the change note's `rho` (§1, §3; the
/// circuit's `RhoOut` with index 0). Key-free: the nullifier is its only input.
#[cfg_attr(
    not(test),
    expect(
        dead_code,
        reason = "consumed by Task 3's withdraw_change witness completion"
    )
)]
pub(crate) fn rho_change(nullifier: &Fr) -> Fr {
    poseidon(&[TAG_RHO, *nullifier, Fr::zero()])
}
