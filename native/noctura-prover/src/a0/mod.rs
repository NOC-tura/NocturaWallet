//! A0 shielded keys and field values (spec 2026-11-08 shielded A0 M1 §3): EIP-2333 `sk`, `nk`,
//! `ivk`, `d_self`, `addrField`, `mintHash`, commitments, deposit `rho(i)`, the internal
//! nullifier, `rho_change`, `matchSpent`, and the one `Mutex` state that holds them; the
//! unshield destination's ATA, `parseUnshield` and the single-use unshield authorization; and
//! `prove` — the per-circuit allow-lists, witness completion, the sha256-pinned A0 key files.
//!
//! The public surface is [`state`]'s [`Core`] / [`Handle`] / [`A0Error`]: it takes a seed and
//! returns only values that are public once used (a deposit `rho`, a commitment, the indices of
//! spent own notes). Every secret lives in the crate-private `keys` module. `parse_unshield`
//! and `Core::authorize_unshield` are Kotlin-only (the native dialog's); no key crosses them.

mod ata;
mod auth;
pub mod bridge;
mod eip2333;
mod field;
mod keyfiles;
mod keys;
mod prove;
pub mod state;
mod unshield;

pub use auth::AuthId;
pub use prove::Proof;
pub use state::{A0Error, Core, Handle, CORE};
pub use unshield::{parse_unshield, Unshield, DECIMALS, FEE_CEILING, PROGRAM_ID};

#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_bridge;
#[cfg(test)]
mod tests_prove;
#[cfg(test)]
mod tests_unshield;
#[cfg(test)]
mod wipe_probe;
