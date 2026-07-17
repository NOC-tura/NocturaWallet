//! Serialize an arkworks Groth16 proof to the 256-byte layout the deployed Noctura
//! shielded program consumes (from project_shielded_c2_contract):
//!   A(64) + B(128) + C(64), each field element 32-byte BIG-ENDIAN,
//!   pi_a NEGATED, G2 written c1-first (imaginary part first, EIP-197 order).
//! Only pi_a is negated (on-chain check = single pairing product == 1).

use ark_bn254::{Bn254, Fq, Fq2, G1Affine, G2Affine};
use ark_ff::{BigInteger, PrimeField};
use ark_groth16::Proof;
use std::error::Error;

fn fq_be(f: &Fq) -> [u8; 32] {
    let mut out = [0u8; 32];
    let b = f.into_bigint().to_bytes_be(); // big-endian, possibly < 32 bytes
    out[32 - b.len()..].copy_from_slice(&b);
    out
}

fn fq_from_be(b: &[u8]) -> Fq {
    Fq::from_be_bytes_mod_order(b)
}

/// G1 point → 64 bytes `x‖y` (32B BE each). `negate` writes `(x, p-y)`.
pub fn g1_be(p: &G1Affine, negate: bool) -> [u8; 64] {
    let p = if negate { -*p } else { *p };
    let mut out = [0u8; 64];
    out[..32].copy_from_slice(&fq_be(&p.x));
    out[32..].copy_from_slice(&fq_be(&p.y));
    out
}

/// G2 point → 128 bytes, `x.c1‖x.c0‖y.c1‖y.c0` (32B BE each) — c1/imaginary first.
pub fn g2_be_c1first(p: &G2Affine) -> [u8; 128] {
    let mut out = [0u8; 128];
    out[..32].copy_from_slice(&fq_be(&p.x.c1));
    out[32..64].copy_from_slice(&fq_be(&p.x.c0));
    out[64..96].copy_from_slice(&fq_be(&p.y.c1));
    out[96..].copy_from_slice(&fq_be(&p.y.c0));
    out
}

/// arkworks proof → the 256-byte on-chain layout.
pub fn serialize_proof(proof: &Proof<Bn254>) -> [u8; 256] {
    let mut out = [0u8; 256];
    out[..64].copy_from_slice(&g1_be(&proof.a, true)); // pi_a NEGATED
    out[64..192].copy_from_slice(&g2_be_c1first(&proof.b)); // G2 c1-first
    out[192..].copy_from_slice(&g1_be(&proof.c, false)); // pi_c as-is
    out
}

fn g1_from_be(b: &[u8]) -> G1Affine {
    G1Affine::new_unchecked(fq_from_be(&b[..32]), fq_from_be(&b[32..64]))
}

fn g2_from_be_c1first(b: &[u8]) -> G2Affine {
    let x = Fq2::new(fq_from_be(&b[32..64]), fq_from_be(&b[..32])); // (c0, c1)
    let y = Fq2::new(fq_from_be(&b[96..128]), fq_from_be(&b[64..96]));
    G2Affine::new_unchecked(x, y)
}

/// Parse the on-chain layout back into a proof, UN-negating A so it feeds arkworks
/// `Groth16::verify` (which does not expect a negated A). For validation only.
pub fn parse_proof(bytes: &[u8; 256]) -> Result<Proof<Bn254>, Box<dyn Error>> {
    Ok(Proof {
        a: -g1_from_be(&bytes[..64]), // un-negate
        b: g2_from_be_c1first(&bytes[64..192]),
        c: g1_from_be(&bytes[192..]),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use ark_bn254::{G1Projective, G2Projective};
    use ark_ec::{AffineRepr, CurveGroup};
    use ark_ff::Zero;
    use ark_std::{rand::SeedableRng, UniformRand};

    #[test]
    fn fq_be_is_32_bytes_big_endian() {
        assert_eq!(fq_be(&Fq::from(1u8)), {
            let mut e = [0u8; 32];
            e[31] = 1;
            e
        });
    }

    #[test]
    fn g1_be_negate_flips_y_to_p_minus_y() {
        let g = G1Affine::generator();
        let plain = g1_be(&g, false);
        let neg = g1_be(&g, true);
        assert_eq!(&plain[..32], &neg[..32]); // x unchanged
        let y = fq_from_be(&plain[32..]);
        let ny = fq_from_be(&neg[32..]);
        assert!((y + ny).is_zero(), "negated y must be p - y"); // y + (p-y) == 0
    }

    #[test]
    fn g2_c1_first_ordering() {
        let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(1);
        let p = G2Projective::rand(&mut rng).into_affine();
        let b = g2_be_c1first(&p);
        assert_eq!(&b[..32], &fq_be(&p.x.c1)[..]); // first 32B = x.c1
        assert_eq!(&b[32..64], &fq_be(&p.x.c0)[..]); // next = x.c0
    }

    #[test]
    fn serialize_parse_roundtrip_reconstructs_points() {
        let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(7);
        let proof = Proof::<Bn254> {
            a: G1Projective::rand(&mut rng).into_affine(),
            b: G2Projective::rand(&mut rng).into_affine(),
            c: G1Projective::rand(&mut rng).into_affine(),
        };
        let bytes = serialize_proof(&proof);
        assert_eq!(bytes.len(), 256);
        let parsed = parse_proof(&bytes).unwrap();
        // A is negated on the wire then un-negated on parse → original a.
        assert_eq!(parsed.a, proof.a, "A round-trip (with negation)");
        assert_eq!(parsed.b, proof.b, "B round-trip (c1-first)");
        assert_eq!(parsed.c, proof.c, "C round-trip");
    }
}
