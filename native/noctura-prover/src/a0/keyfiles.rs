//! The A0 proving-key files, pinned in Rust by sha256 and length (spec §1 "A0 proving keys", R4):
//! JS supplies the paths, and native refuses any file whose bytes are not the published ones —
//! a pin living only in the layer being attacked would not be a control.
//!
//! The digests are the program side's published A0 set (`zkey-manifest.json`, circuitSetVersion
//! `devnet-a0-1`, `docs/zk-contract/ZKEY_ASSETS_A0.generated.ts`): single-party dev keys, devnet
//! only. CI downloads exactly these files by digest (`.github/workflows/native-prover.yml` reads
//! the `file:` / `sha256:` pairs below) — keep each `Pin` on the lines it is written on.
//!
//! A file is read ONCE into memory, its length and digest checked on those bytes, and only those
//! bytes are parsed: there is no second read a swapped file could slip into.

use super::state::A0Error;
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::Path;

/// One pinned file: its published name, its sha256 (lowercase hex) and its length in bytes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Pin {
    pub(crate) file: &'static str,
    pub(crate) sha256: &'static str,
    pub(crate) len: u64,
}

/// A circuit's two files.
#[derive(Clone, Copy, Debug)]
pub(crate) struct CircuitPins {
    pub(crate) zkey: Pin,
    pub(crate) wasm: Pin,
}

#[rustfmt::skip]
pub(crate) const DEPOSIT: CircuitPins = CircuitPins {
    zkey: Pin { file: "deposit_final.zkey", sha256: "fef08f0217a44c8c1629f5f8d670047461205c1fced83d7ea6fe763420e53fe9", len: 662_589 },
    wasm: Pin { file: "deposit.wasm", sha256: "1d69d7f89792a31d4c7780afa52b2f11707a4347f61382e7b294f4848d7dfff1", len: 2_528_384 },
};

#[rustfmt::skip]
pub(crate) const WITHDRAW_CHANGE: CircuitPins = CircuitPins {
    zkey: Pin { file: "withdraw_change_final.zkey", sha256: "ec55bdbbbfedb9823a57e5a3131c457a259fe8a690c087b82ad8b7efd3d756f2", len: 4_469_189 },
    wasm: Pin { file: "withdraw_change.wasm", sha256: "01b0ec1f28dec05e712b2fa0524c7b212409abf330b3380119d8e64d9845e0b9", len: 2_988_385 },
};

/// Reads `path` and returns its bytes only if they are exactly the pinned file: the length is
/// checked before reading (a huge file is never loaded), the read is bounded, and the digest is
/// taken over the bytes that are returned.
pub(crate) fn load(path: &Path, pin: &Pin) -> Result<Vec<u8>, A0Error> {
    let read_err = |_| A0Error::KeyFileRead { file: pin.file };
    let file = std::fs::File::open(path).map_err(read_err)?;
    let len = file.metadata().map_err(read_err)?.len();
    if len != pin.len {
        return Err(A0Error::KeyFilePin { file: pin.file });
    }
    let mut bytes = Vec::with_capacity(
        usize::try_from(pin.len).map_err(|_| A0Error::KeyFilePin { file: pin.file })?,
    );
    file.take(pin.len + 1)
        .read_to_end(&mut bytes)
        .map_err(read_err)?;
    if bytes.len() as u64 != pin.len || hex::encode(Sha256::digest(&bytes)) != pin.sha256 {
        return Err(A0Error::KeyFilePin { file: pin.file });
    }
    Ok(bytes)
}
