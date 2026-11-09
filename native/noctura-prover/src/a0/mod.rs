//! A0 shielded keys and field values (spec 2026-11-08 shielded A0 M1 §3): EIP-2333 `sk`, `nk`,
//! `ivk`, `d_self`, `addrField`, `mintHash`, commitments, deposit `rho(i)`, the internal
//! nullifier, `rho_change`, `matchSpent`, and the one `Mutex` state that holds them.
//!
//! The public surface is [`state`]'s [`Core`] / [`Handle`] / [`A0Error`]: it takes a seed and
//! returns only values that are public once used (a deposit `rho`, a commitment, the indices of
//! spent own notes). Every secret lives in the crate-private `keys` module.

mod eip2333;
mod field;
mod keys;
pub mod state;

pub use state::{A0Error, Core, Handle, CORE};

#[cfg(test)]
mod tests;
#[cfg(test)]
mod wipe_probe;
