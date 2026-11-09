//! `prove(handle, circuit, witnessJson, authId?) -> {proofBytes, publicInputs}` (spec §3
//! "prove", R4, I11, m4, m-5, INV-AUTH).
//!
//! - **Allow-list, not deny-list.** Per circuit, JS may supply exactly the API names below; any
//!   other key — a signal Rust fills (`nk`, `d`, `change_d`, a public input), a typo — refuses,
//!   as does a missing or repeated key. Rust completes everything else from the session's keys
//!   and, for `withdraw_change`, from the authorization record.
//! - **`transfer` is not in M1**: it has no allow-list and is refused.
//! - **The authorization** (Task 2's record): every `prove` call consumes the live record FIRST —
//!   before the circuit name, the witness or the key files are looked at — so the first prove
//!   after an approval uses it up, success or failure. `withdraw_change` needs it (`authId`),
//!   `deposit` refuses one.
//! - **The key files** are read from the paths JS gives, each refused unless its bytes are the
//!   pinned ones (`keyfiles`).
//! - **The witness is never logged** and no error carries a value: refusals name a signal or an
//!   index, never what was in it.
//! - **The lock is held only while the witness is completed** (microseconds); the witness run,
//!   the proof and its self-check run outside it, so a `keysClose` from the UI thread never waits
//!   seconds for a proof. What leaves the lock is a copy of the completed witness, wiped on drop.
//! - **The proof is checked before it is returned**: the witness's public signals must equal the
//!   values Rust put in (in the circuit's order), and the proof must verify against the pinned
//!   zkey's own verifying key. Its randomness `r`, `s` comes from the OS.
//! - **Stated limits of the wiping** (Fable review 1, R1-I5): the [`Completed`] copy of `nk` /
//!   `d_self` lives until the prove returns (seconds) and is wiped on drop; arkworks' internal
//!   copies of the assignment (FFT buffers), the `serde_json` values and `String` keys of the JS
//!   witness, the JNI's copies of the witness string (`android.rs`) and compiler-made stack
//!   temporaries of `nk` / `d_self` are not wiped. INV-NK's "zeroized on keysClose" means the
//!   keys state, not an in-flight prove's working copies.

use super::ata::derive_ata;
use super::auth::{self, Auth, AuthId};
use super::field::{
    be_mod_order, fr_from_be32, fr_to_be32, mint_hash, poseidon, rho_change, Fr, MINT,
};
use super::keyfiles::{self, CircuitPins};
use super::keys::Keys;
use super::state::{A0Error, Core, Handle};
use super::unshield::{parse_u64, POOL};
use crate::proof_bytes::serialize_proof;
use crate::witness_wasmi::WitnessCalculator;
use ark_bn254::Bn254;
use ark_circom::{read_zkey, CircomReduction};
use ark_groth16::Groth16;
use ark_snark::SNARK;
use serde::de::{Deserializer, MapAccess, Visitor};
use std::path::Path;
use std::time::Duration;
use zeroize::{Zeroize, Zeroizing};

/// The Merkle tree depth of the A0 pool (`MerkleTree` account, depth 20).
pub(crate) const DEPTH: usize = 20;

/// The circuits M1 proves.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Circuit {
    Deposit,
    WithdrawChange,
}

/// One input signal of a circuit's main component: its name and how many field elements it has.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Signal {
    pub(crate) name: &'static str,
    pub(crate) len: usize,
}

const fn one(name: &'static str) -> Signal {
    Signal { name, len: 1 }
}

/// A circuit's input signals in the circuit's own order (spec §1), and the JS allow-list.
#[derive(Debug)]
pub(crate) struct Table {
    /// Public inputs, in the order of the on-chain public-input vector.
    pub(crate) public: &'static [Signal],
    /// Private inputs, in declaration order.
    pub(crate) private: &'static [Signal],
    /// JS's keys: (API name, the signal it determines). `depositIndex` determines `rho`.
    pub(crate) js: &'static [(&'static str, &'static str)],
    /// The signals Rust fills from the keys, the authorization and the pinned mint — the other
    /// half of the m-5 partition, which the tests hold against the table and the circuit (at run
    /// time `run` checks every completed signal against the circuit instead).
    #[cfg(test)]
    pub(crate) rust: &'static [&'static str],
}

pub(crate) const DEPOSIT_TABLE: Table = Table {
    public: &[
        one("commitment"),
        one("amount"),
        one("mintHash"),
        one("rho"),
    ],
    private: &[one("nk"), one("d")],
    js: &[("amount", "amount"), ("depositIndex", "rho")],
    #[cfg(test)]
    rust: &["commitment", "mintHash", "nk", "d"],
};

pub(crate) const WITHDRAW_CHANGE_TABLE: Table = Table {
    public: &[
        one("merkleRoot"),
        one("nullifier"),
        one("withdrawAmount"),
        one("recipientField"),
        one("mintHash"),
        one("changeCommitment"),
        one("fee"),
    ],
    private: &[
        one("nk"),
        one("d"),
        one("inputAmount"),
        one("rho"),
        Signal {
            name: "pathElements",
            len: DEPTH,
        },
        Signal {
            name: "pathIndices",
            len: DEPTH,
        },
        one("change_d"),
    ],
    js: &[
        ("merkleRoot", "merkleRoot"),
        ("inputAmount", "inputAmount"),
        ("rho", "rho"),
        ("pathElements", "pathElements"),
        ("pathIndices", "pathIndices"),
    ],
    #[cfg(test)]
    rust: &[
        "nullifier",
        "withdrawAmount",
        "recipientField",
        "mintHash",
        "changeCommitment",
        "fee",
        "nk",
        "d",
        "change_d",
    ],
};

impl Circuit {
    /// `"deposit"` / `"withdraw_change"`; `"transfer"` is M2's (refused); anything else unknown.
    pub(crate) fn parse(name: &str) -> Result<Circuit, A0Error> {
        match name {
            "deposit" => Ok(Circuit::Deposit),
            "withdraw_change" => Ok(Circuit::WithdrawChange),
            "transfer" => Err(A0Error::CircuitNotInM1),
            _ => Err(A0Error::CircuitUnknown),
        }
    }
    pub(crate) fn table(self) -> &'static Table {
        match self {
            Circuit::Deposit => &DEPOSIT_TABLE,
            Circuit::WithdrawChange => &WITHDRAW_CHANGE_TABLE,
        }
    }
    pub(crate) fn pins(self) -> &'static CircuitPins {
        match self {
            Circuit::Deposit => &keyfiles::DEPOSIT,
            Circuit::WithdrawChange => &keyfiles::WITHDRAW_CHANGE,
        }
    }
}

impl Table {
    /// Every input signal, public first, in the circuit's order.
    pub(crate) fn signals(&self) -> impl Iterator<Item = &'static Signal> {
        self.public.iter().chain(self.private.iter())
    }
    fn signal(&self, name: &str) -> Option<&'static Signal> {
        self.signals().find(|s| s.name == name)
    }
}

/// A proof and its public inputs: what `prove` returns. Both are public by construction (the
/// chain sees them).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Proof {
    /// The 256-byte on-chain layout (`proof_bytes::serialize_proof`).
    pub proof_bytes: [u8; 256],
    /// The public inputs in the circuit's order, each 32 bytes big-endian.
    pub public_inputs: Vec<[u8; 32]>,
}

/// The completed witness: every input signal's values, in the table's order. Holds `nk` and
/// `d_self`; wiped on drop — it outlives `keysClose` if one lands mid-prove (R1-I5).
pub(crate) struct Completed {
    circuit: Circuit,
    values: Vec<(&'static str, Vec<Fr>)>,
}

impl Drop for Completed {
    fn drop(&mut self) {
        for (_, v) in &mut self.values {
            v.zeroize();
        }
    }
}

impl Completed {
    /// The public inputs Rust put in, in the circuit's order.
    fn publics(&self) -> Vec<Fr> {
        let table = self.circuit.table();
        self.values[..table.public.len()]
            .iter()
            .flat_map(|(_, v)| v.iter().copied())
            .collect()
    }
    /// Test-only: the signal names, in order.
    #[cfg(test)]
    pub(crate) fn names(&self) -> Vec<&'static str> {
        self.values.iter().map(|(n, _)| *n).collect()
    }
    /// Test-only: the public inputs as 32-byte BE.
    #[cfg(test)]
    pub(crate) fn publics_be32(&self) -> Vec<[u8; 32]> {
        self.publics().iter().map(fr_to_be32).collect()
    }
    /// Test-only: replace one signal's values (a witness the circuit must reject).
    #[cfg(test)]
    pub(crate) fn set_for_test(&mut self, name: &str, values: Vec<Fr>) {
        let slot = self.values.iter_mut().find(|(n, _)| *n == name).unwrap();
        slot.1 = values;
    }
}

// ---- the JS witness: a JSON object, every key once, nothing outside the allow-list ----------

/// The object's entries in order, repeats kept (serde_json's `Map` would keep only the last).
struct Entries(Vec<(String, serde_json::Value)>);

struct EntriesVisitor;

impl<'de> Visitor<'de> for EntriesVisitor {
    type Value = Entries;
    fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("a JSON object")
    }
    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Entries, A::Error> {
        let mut out = Vec::new();
        while let Some(entry) = map.next_entry::<String, serde_json::Value>()? {
            out.push(entry);
        }
        Ok(Entries(out))
    }
}

/// The allow-listed values JS gave, by API name.
struct JsWitness {
    entries: Vec<(&'static str, serde_json::Value)>,
}

impl JsWitness {
    fn parse(json: &str, table: &'static Table) -> Result<JsWitness, A0Error> {
        let mut de = serde_json::Deserializer::from_str(json);
        let Entries(raw) = de
            .deserialize_map(EntriesVisitor)
            .map_err(|_| A0Error::WitnessJson)?;
        de.end().map_err(|_| A0Error::WitnessJson)?;
        let mut entries: Vec<(&'static str, serde_json::Value)> = Vec::with_capacity(raw.len());
        for (key, value) in raw {
            let Some(&(api, _)) = table.js.iter().find(|(api, _)| *api == key) else {
                return Err(match table.signal(&key) {
                    Some(s) => A0Error::WitnessRustFilled { name: s.name },
                    None => A0Error::WitnessUnknownKey,
                });
            };
            if entries.iter().any(|(k, _)| *k == api) {
                return Err(A0Error::WitnessDuplicate { name: api });
            }
            entries.push((api, value));
        }
        if let Some(&(missing, _)) = table
            .js
            .iter()
            .find(|(api, _)| !entries.iter().any(|(k, _)| k == api))
        {
            return Err(A0Error::WitnessMissing { name: missing });
        }
        Ok(JsWitness { entries })
    }

    fn get(&self, name: &'static str) -> &serde_json::Value {
        &self
            .entries
            .iter()
            .find(|(k, _)| *k == name)
            .expect("parse() checked every allow-listed key is present")
            .1
    }

    /// A canonical decimal u64 string.
    fn u64(&self, name: &'static str) -> Result<u64, A0Error> {
        match self.get(name) {
            serde_json::Value::String(s) => {
                parse_u64(s, name).map_err(|_| A0Error::WitnessValue { name, index: 0 })
            }
            _ => Err(A0Error::WitnessValue { name, index: 0 }),
        }
    }

    /// A field element: exactly 64 lowercase hex characters, canonical (< r), never reduced.
    fn field_at(v: &serde_json::Value, name: &'static str, index: usize) -> Result<Fr, A0Error> {
        let bad = A0Error::WitnessValue { name, index };
        let serde_json::Value::String(s) = v else {
            return Err(bad);
        };
        if s.len() != 64
            || !s
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(bad);
        }
        let mut bytes = Zeroizing::new([0u8; 32]);
        hex::decode_to_slice(s, &mut bytes[..])
            .map_err(|_| A0Error::WitnessValue { name, index })?;
        fr_from_be32(&bytes).ok_or(A0Error::WitnessValue { name, index })
    }

    fn field(&self, name: &'static str) -> Result<Fr, A0Error> {
        Self::field_at(self.get(name), name, 0)
    }

    fn array(&self, name: &'static str) -> Result<&[serde_json::Value], A0Error> {
        match self.get(name) {
            serde_json::Value::Array(a) if a.len() == DEPTH => Ok(a),
            _ => Err(A0Error::WitnessValue { name, index: DEPTH }),
        }
    }

    fn path_elements(&self) -> Result<Vec<Fr>, A0Error> {
        let name = "pathElements";
        self.array(name)?
            .iter()
            .enumerate()
            .map(|(i, v)| Self::field_at(v, name, i))
            .collect()
    }

    /// Each index a JSON integer 0 or 1.
    fn path_indices(&self) -> Result<Vec<bool>, A0Error> {
        let name = "pathIndices";
        self.array(name)?
            .iter()
            .enumerate()
            .map(|(i, v)| match v.as_u64() {
                Some(0) if v.is_u64() => Ok(false),
                Some(1) if v.is_u64() => Ok(true),
                _ => Err(A0Error::WitnessValue { name, index: i }),
            })
            .collect()
    }
}

// ---- witness completion ------------------------------------------------------------------

fn complete_deposit(keys: &Keys, js: &JsWitness) -> Result<Completed, A0Error> {
    let amount = js.u64("amount")?;
    let index = js.u64("depositIndex")?;
    if amount == 0 {
        return Err(A0Error::AmountZero);
    }
    let rho = keys.deposit_rho(index);
    let commitment = keys.commitment(amount, &rho);
    Ok(Completed {
        circuit: Circuit::Deposit,
        values: vec![
            ("commitment", vec![commitment]),
            ("amount", vec![Fr::from(amount)]),
            ("mintHash", vec![mint_hash()]),
            ("rho", vec![rho]),
            ("nk", vec![*keys.nk()]),
            ("d", vec![*keys.d_self()]),
        ],
    })
}

/// The root the path folds the leaf to: the circuit's `MerkleFold` (untagged Poseidon2; index 0
/// = the running value on the left).
fn fold(leaf: Fr, elements: &[Fr], indices: &[bool]) -> Fr {
    elements.iter().zip(indices).fold(leaf, |cur, (e, right)| {
        if *right {
            poseidon(&[*e, cur])
        } else {
            poseidon(&[cur, *e])
        }
    })
}

fn complete_withdraw_change(
    keys: &Keys,
    auth: &Auth,
    js: &JsWitness,
) -> Result<Completed, A0Error> {
    // The record is Rust's own (Task 2); it is re-checked against the pins it was made under.
    if auth.pool != POOL || auth.mint != MINT || derive_ata(&auth.owner) != Ok(auth.ata) {
        return Err(A0Error::AuthRecordInconsistent);
    }
    let merkle_root = js.field("merkleRoot")?;
    let input_amount = js.u64("inputAmount")?;
    let rho = js.field("rho")?;
    let path_elements = js.path_elements()?;
    let path_indices = js.path_indices()?;
    let spent = auth
        .amount
        .checked_add(auth.fee)
        .filter(|s| *s <= input_amount)
        .ok_or(A0Error::WithdrawExceedsInput)?;
    // The note must be in the tree JS named: checked here so a wrong path is a clear refusal
    // before any key file is read (the circuit checks it again).
    let leaf = keys.commitment(input_amount, &rho);
    if fold(leaf, &path_elements, &path_indices) != merkle_root {
        return Err(A0Error::WitnessNotInTree);
    }
    let nullifier = keys.nullifier(&rho);
    let change_rho = rho_change(&nullifier);
    let change_commitment = keys.commitment(input_amount - spent, &change_rho);
    Ok(Completed {
        circuit: Circuit::WithdrawChange,
        values: vec![
            ("merkleRoot", vec![merkle_root]),
            ("nullifier", vec![nullifier]),
            ("withdrawAmount", vec![Fr::from(auth.amount)]),
            ("recipientField", vec![be_mod_order::<Fr>(&auth.ata)]),
            ("mintHash", vec![mint_hash()]),
            ("changeCommitment", vec![change_commitment]),
            ("fee", vec![Fr::from(auth.fee)]),
            ("nk", vec![*keys.nk()]),
            ("d", vec![*keys.d_self()]),
            ("inputAmount", vec![Fr::from(input_amount)]),
            ("rho", vec![rho]),
            ("pathElements", path_elements),
            (
                "pathIndices",
                path_indices
                    .iter()
                    .map(|b| Fr::from(u64::from(*b)))
                    .collect(),
            ),
            ("change_d", vec![*keys.d_self()]),
        ],
    })
}

// ---- proving -----------------------------------------------------------------------------

/// A field element from 64 bytes of the OS random source (bias below 2^-250).
fn random_fr() -> Result<Fr, A0Error> {
    let mut b = Zeroizing::new([0u8; 64]);
    getrandom::getrandom(&mut b[..]).map_err(|_| A0Error::Rng)?;
    Ok(be_mod_order(&b[..]))
}

/// The witness run, the proof and its checks — outside the lock, on the pinned files' bytes.
pub(crate) fn run(completed: &Completed, zkey: &[u8], wasm: &[u8]) -> Result<Proof, A0Error> {
    let circuit = completed.circuit;
    let pins = circuit.pins();
    let table = circuit.table();
    let (params, matrices) =
        read_zkey(&mut std::io::Cursor::new(zkey)).map_err(|_| A0Error::KeyFileFormat {
            file: pins.zkey.file,
        })?;
    let n_public: usize = table.public.iter().map(|s| s.len).sum();
    if matrices.num_instance_variables != n_public + 1 {
        return Err(A0Error::CircuitShape);
    }

    let mut wc = WitnessCalculator::from_bytes(wasm).map_err(|_| A0Error::KeyFileFormat {
        file: pins.wasm.file,
    })?;
    for (name, values) in &completed.values {
        if wc
            .input_signal_size(name)
            .map_err(|_| A0Error::CircuitShape)?
            != Some(values.len())
        {
            return Err(A0Error::CircuitShape);
        }
    }
    let inputs: Vec<(&str, &[Fr])> = completed
        .values
        .iter()
        .map(|(n, v)| (*n, v.as_slice()))
        .collect();
    let witness = wc
        .calculate_witness_from_fr(&inputs)
        .map_err(|_| A0Error::WitnessRejected)?;
    drop(wc); // wipes the wasm memory
              // One value per wire: the zkey's A query has one point per wire (nVars). Not
              // `num_instance_variables + num_witness_variables`: ark-circom's `read_zkey` sets the latter
              // to nVars − nPublic, one more than the private wires (deposit: 5 + 641 = 646, nVars 645).
    if witness.len() != params.a_query.len() {
        return Err(A0Error::CircuitShape);
    }
    let publics = completed.publics();
    if witness[1..=n_public] != publics[..] {
        return Err(A0Error::PublicInputMismatch);
    }

    let mut r = random_fr()?;
    let mut s = random_fr()?;
    let proof = Groth16::<Bn254, CircomReduction>::create_proof_with_reduction_and_matrices(
        &params,
        r,
        s,
        &matrices,
        matrices.num_instance_variables,
        matrices.num_constraints,
        witness.as_slice(),
    );
    r.zeroize();
    s.zeroize();
    let proof = proof.map_err(|_| A0Error::ProofFailed)?;
    let pvk = Groth16::<Bn254>::process_vk(&params.vk).map_err(|_| A0Error::ProofFailed)?;
    if !Groth16::<Bn254>::verify_with_processed_vk(&pvk, &publics, &proof).unwrap_or(false) {
        return Err(A0Error::ProofDoesNotVerify);
    }
    Ok(Proof {
        proof_bytes: serialize_proof(&proof),
        public_inputs: publics.iter().map(fr_to_be32).collect(),
    })
}

impl Core {
    /// `prove(handle, circuit, witnessJson, authId?)` with the key files at `zkey_path` /
    /// `wasm_path` (spec §3). See the module documentation for the rules.
    pub fn prove(
        &self,
        handle: Handle,
        circuit: &str,
        witness_json: &str,
        auth_id: Option<AuthId>,
        zkey_path: &Path,
        wasm_path: &Path,
    ) -> Result<Proof, A0Error> {
        let now = auth::now()?;
        self.prove_at(
            handle,
            circuit,
            witness_json,
            auth_id,
            zkey_path,
            wasm_path,
            now,
        )
    }

    /// [`Core::prove`] at an injected time (tests; `now` is on the `auth::now` clock).
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn prove_at(
        &self,
        handle: Handle,
        circuit: &str,
        witness_json: &str,
        auth_id: Option<AuthId>,
        zkey_path: &Path,
        wasm_path: &Path,
        now: Duration,
    ) -> Result<Proof, A0Error> {
        let completed = self.complete(handle, circuit, witness_json, auth_id, now)?;
        let pins = completed.circuit.pins();
        let zkey = keyfiles::load(zkey_path, &pins.zkey)?;
        let wasm = keyfiles::load(wasm_path, &pins.wasm)?;
        run(&completed, &zkey, &wasm)
    }

    /// Everything `prove` does under the lock: consume the live authorization FIRST, then check
    /// the handle, the circuit and the JS witness, and complete it.
    pub(crate) fn complete(
        &self,
        handle: Handle,
        circuit: &str,
        witness_json: &str,
        auth_id: Option<AuthId>,
        now: Duration,
    ) -> Result<Completed, A0Error> {
        let mut inner = self.lock()?;
        let auth = match auth_id {
            Some(id) => Some(inner.take_auth(handle, &id, now)),
            None => {
                inner.discard_auth();
                None
            }
        };
        let keys = inner.keys_for(handle)?;
        let circuit = Circuit::parse(circuit)?;
        let js = JsWitness::parse(witness_json, circuit.table())?;
        match circuit {
            Circuit::Deposit => match auth {
                Some(_) => Err(A0Error::AuthUnexpected),
                None => complete_deposit(keys, &js),
            },
            Circuit::WithdrawChange => {
                let auth = auth.ok_or(A0Error::AuthAbsent)??;
                complete_withdraw_change(keys, &auth, &js)
            }
        }
    }
}
