//! Pure-Rust circom2 witness calculator over wasmi. Replaces ark-circom's
//! wasmer-based calculator (which won't link on modern rustc: __rust_probestack)
//! and is the on-device (Android) path. See docs/superpowers/specs/2026-07-17-wasmi-*.
//!
//! Task 1: the pure marshaling helpers (fnv, to_array32/from_array32), ported
//! verbatim from ark-circom. Task 2 adds the wasmi WitnessCalculator on top.

use fnv::FnvHasher;
use num_bigint::BigInt;
use num_traits::{ToPrimitive, Zero};
use std::hash::Hasher;

/// Circom signal-name hash → (msb, lsb) u32 pair (FNV-1a 64-bit split).
/// MUST match ark-circom / circom_runtime exactly — the pair feeds setInputSignal.
pub(crate) fn fnv(input: &str) -> (u32, u32) {
    let mut hasher = FnvHasher::default();
    hasher.write(input.as_bytes());
    let h = hasher.finish();
    ((h >> 32) as u32, h as u32)
}

/// BigInt → n32 little-endian 32-bit words (index 0 = most significant), the layout
/// circom's shared-RW-memory expects. Verbatim from ark-circom.
pub(crate) fn to_array32(s: &BigInt, size: usize) -> Vec<u32> {
    let mut res = vec![0u32; size];
    let mut rem = s.clone();
    let radix = BigInt::from(0x1_0000_0000u64);
    let mut c = size;
    while !rem.is_zero() {
        c -= 1;
        res[c] = (&rem % &radix).to_u32().unwrap();
        rem /= &radix;
    }
    res
}

/// n32 words (index 0 = most significant) → BigInt. Verbatim from ark-circom.
pub(crate) fn from_array32(arr: Vec<u32>) -> BigInt {
    let mut res = BigInt::zero();
    let radix = BigInt::from(0x1_0000_0000u64);
    for &val in arr.iter() {
        res = res * &radix + BigInt::from(val);
    }
    res
}

#[cfg(test)]
mod tests {
    use super::*;

    // Reference FNV-1a 64-bit, independent of the `fnv` crate, to catch a wrong hasher.
    fn fnv1a_ref(s: &str) -> u64 {
        let mut h: u64 = 0xcbf2_9ce4_8422_2325;
        for b in s.as_bytes() {
            h ^= *b as u64;
            h = h.wrapping_mul(0x0000_0100_0000_01b3);
        }
        h
    }

    #[test]
    fn fnv_matches_reference_fnv1a() {
        for name in ["a", "b", "main.in", "commitment", ""] {
            let (msb, lsb) = fnv(name);
            let combined = ((msb as u64) << 32) | lsb as u64;
            assert_eq!(combined, fnv1a_ref(name), "fnv mismatch for {name:?}");
        }
    }

    #[test]
    fn array32_roundtrips() {
        for v in [
            BigInt::from(0u64),
            BigInt::from(1u64),
            BigInt::from(0x1234_5678_9abc_def0u64),
            BigInt::parse_bytes(b"8081702745406920529902264228351723735379273324999453834569345340835518474946", 10).unwrap(),
        ] {
            let arr = to_array32(&v, 8);
            assert_eq!(arr.len(), 8);
            assert_eq!(from_array32(arr), v, "array32 round-trip failed for {v}");
        }
    }

    #[test]
    fn to_array32_is_big_endian_word_order() {
        // 0x0000_0002_0000_0001 → most-significant word first.
        let v = BigInt::from(0x0000_0002_0000_0001u64);
        let arr = to_array32(&v, 4);
        assert_eq!(arr, vec![0, 0, 2, 1]);
    }
}
