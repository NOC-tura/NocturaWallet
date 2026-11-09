//! Pure-Rust circom2 witness calculator over wasmi. Replaces ark-circom's
//! wasmer-based calculator (which won't link on modern rustc: __rust_probestack)
//! and is the on-device (Android) path. See docs/superpowers/specs/2026-07-17-wasmi-*.
//!
//! Task 1: the pure marshaling helpers (fnv, to_array32/from_array32), ported
//! verbatim from ark-circom. Task 2 adds the wasmi WitnessCalculator on top.

use ark_bn254::Fr;
use ark_ff::PrimeField;
use fnv::FnvHasher;
use num_bigint::{BigInt, BigUint};
use num_traits::{Signed, ToPrimitive, Zero};
use std::collections::HashMap;
use std::error::Error;
use std::hash::Hasher;
use wasmi::{Caller, Engine, Instance, Linker, Memory, MemoryType, Module, Store, TypedFunc};

type Res<T> = Result<T, Box<dyn Error>>;

/// Pure-Rust circom2 witness calculator over wasmi. Drives the downloaded circom
/// `.wasm` through its exported functions (init / setInputSignal / getWitness over
/// shared-RW-memory) — no wasmer, no C. Only circom2 wasm is supported.
///
/// The module's linear memory holds every signal of the last witness (for A0: `nk`, `d`, the
/// note and its path), so it is zero-filled when the calculator is dropped.
pub struct WitnessCalculator {
    store: Store<()>,
    instance: Instance,
    memory: Memory,
    n32: u32,
}

/// What a circom2 wasm reports through `runtime.exceptionHandler` (codes 1–6 in circom's own
/// `witness_calculator.js`: signal not found, too many signals, signal already set, assert
/// failed, out of memory, input array index). It is a trap, never a no-op: a calculator that
/// carried on after a failed `assert` / `===` would return a witness the circuit rejects.
fn exception_trap(code: i32) -> wasmi::Error {
    wasmi::Error::new(format!("circom witness exception {code}"))
}

impl WitnessCalculator {
    pub fn from_file(path: impl AsRef<std::path::Path>) -> Res<Self> {
        Self::from_bytes(&std::fs::read(path)?)
    }

    /// From the wasm's bytes — the A0 path, which hashes the bytes against a pin and must parse
    /// exactly the bytes it hashed (no second read of the file).
    pub fn from_bytes(wasm: &[u8]) -> Res<Self> {
        let engine = Engine::default();
        let module = Module::new(&engine, wasm)?;
        let mut store = Store::new(&engine, ());

        // The deployed v1 circuits import env.memory; the A0 circuits export their own. Define
        // one only when it is imported (2000 pages = 125 MiB of address space otherwise unused).
        let imports_memory = module
            .imports()
            .any(|i| i.module() == "env" && i.name() == "memory");
        let defined = if imports_memory {
            Some(Memory::new(&mut store, MemoryType::new(2000, None))?)
        } else {
            None
        };
        let mut linker = Linker::new(&engine);
        if let Some(memory) = defined {
            linker.define("env", "memory", memory)?;
        }

        // runtime.* host callbacks — no-ops except `error` and `exceptionHandler`, which trap.
        linker.func_wrap(
            "runtime",
            "error",
            |_: Caller<()>,
             _: i32,
             _: i32,
             _: i32,
             _: i32,
             _: i32,
             _: i32|
             -> Result<(), wasmi::Error> {
                Err(wasmi::Error::new(
                    "circom runtime error (constraint failed)",
                ))
            },
        )?;
        linker.func_wrap(
            "runtime",
            "logSetSignal",
            |_: Caller<()>, _: i32, _: i32| {},
        )?;
        linker.func_wrap(
            "runtime",
            "logGetSignal",
            |_: Caller<()>, _: i32, _: i32| {},
        )?;
        linker.func_wrap("runtime", "logFinishComponent", |_: Caller<()>, _: i32| {})?;
        linker.func_wrap("runtime", "logStartComponent", |_: Caller<()>, _: i32| {})?;
        linker.func_wrap("runtime", "log", |_: Caller<()>, _: i32| {})?;
        linker.func_wrap(
            "runtime",
            "exceptionHandler",
            |_: Caller<()>, code: i32| -> Result<(), wasmi::Error> { Err(exception_trap(code)) },
        )?;
        linker.func_wrap("runtime", "showSharedRWMemory", |_: Caller<()>| {})?;
        linker.func_wrap("runtime", "printErrorMessage", |_: Caller<()>| {})?;
        linker.func_wrap("runtime", "writeBufferMessage", |_: Caller<()>| {})?;

        let instance = linker.instantiate_and_start(&mut store, &module)?;
        let memory = match defined {
            Some(m) => m,
            None => instance
                .get_memory(&store, "memory")
                .ok_or("wasm neither imports nor exports a memory")?,
        };

        // Require circom2 (getVersion == 2). circom1 uses a different memory model.
        let version = instance
            .get_typed_func::<(), i32>(&store, "getVersion")
            .map_err(|_| "wasm has no getVersion — circom1 is not supported")?
            .call(&mut store, ())?;
        if version != 2 {
            return Err(format!("unsupported circom wasm version {version} (need 2)").into());
        }

        let n32 = instance
            .get_typed_func::<(), i32>(&store, "getFieldNumLen32")?
            .call(&mut store, ())? as u32;

        Ok(Self {
            store,
            instance,
            memory,
            n32,
        })
    }

    /// The number of field elements of the main component's input `name` (its array length, 1
    /// for a scalar), or `None` when the circuit has no such input — circom's
    /// `getInputSignalSize`, which answers by the name's hash (0 when it has none).
    pub fn input_signal_size(&mut self, name: &str) -> Res<Option<usize>> {
        let f: TypedFunc<(i32, i32), i32> = self
            .instance
            .get_typed_func(&self.store, "getInputSignalSize")?;
        let (msb, lsb) = fnv(name);
        // circom answers 0 for a name it does not have (its JS treats < 0 as absent too).
        let size = f.call(&mut self.store, (msb as i32, lsb as i32))?;
        Ok(usize::try_from(size).ok().filter(|n| *n > 0))
    }

    /// The number of input field elements the circuit takes in all — circom's `getInputSize`.
    pub fn input_size(&mut self) -> Res<usize> {
        Ok(usize::try_from(
            self.tf0("getInputSize")?.call(&mut self.store, ())?,
        )?)
    }

    /// The witness for `inputs` (name → values), with no `BigInt` on the way in or out: the
    /// values go to the wasm as 32-bit words cut from the field element's limbs, and come back
    /// as canonical field elements. The returned buffer is wiped on drop; the wasm memory is
    /// wiped when the calculator is dropped. Every input of the circuit must be given, once.
    pub fn calculate_witness_from_fr(
        &mut self,
        inputs: &[(&str, &[Fr])],
    ) -> Res<zeroize::Zeroizing<Vec<Fr>>> {
        if self.n32 != 8 {
            return Err("not a BN254 circuit (field words != 8)".into());
        }
        let init: TypedFunc<i32, ()> = self.instance.get_typed_func(&self.store, "init")?;
        let write: TypedFunc<(i32, i32), ()> = self
            .instance
            .get_typed_func(&self.store, "writeSharedRWMemory")?;
        let read: TypedFunc<i32, i32> = self
            .instance
            .get_typed_func(&self.store, "readSharedRWMemory")?;
        let set_input: TypedFunc<(i32, i32, i32), ()> = self
            .instance
            .get_typed_func(&self.store, "setInputSignal")?;
        let get_witness: TypedFunc<i32, ()> =
            self.instance.get_typed_func(&self.store, "getWitness")?;

        init.call(&mut self.store, 0)?;
        let mut given = 0usize;
        for (name, values) in inputs {
            let (msb, lsb) = fnv(name);
            for (i, value) in values.iter().enumerate() {
                let mut limbs = value.into_bigint().0;
                for j in 0..8 {
                    // least-significant 32-bit word first
                    let word = (limbs[j / 2] >> (32 * (j % 2))) as u32;
                    write.call(&mut self.store, (j as i32, word as i32))?;
                }
                zeroize::Zeroize::zeroize(&mut limbs);
                set_input.call(&mut self.store, (msb as i32, lsb as i32, i as i32))?;
                given += 1;
            }
        }
        if given != self.input_size()? {
            return Err("not every circuit input was given".into());
        }

        let witness_size = self.tf0("getWitnessSize")?.call(&mut self.store, ())? as usize;
        let mut out = zeroize::Zeroizing::new(Vec::with_capacity(witness_size));
        for i in 0..witness_size {
            get_witness.call(&mut self.store, i as i32)?;
            let mut limbs = [0u64; 4];
            for j in 0..8 {
                let word = read.call(&mut self.store, j as i32)? as u32;
                limbs[j / 2] |= u64::from(word) << (32 * (j % 2));
            }
            let v = Fr::from_bigint(ark_ff::BigInteger256::new(limbs));
            zeroize::Zeroize::zeroize(&mut limbs);
            out.push(v.ok_or("witness value is not a canonical field element")?);
        }
        Ok(out)
    }

    fn tf0(&self, name: &str) -> Res<TypedFunc<(), i32>> {
        Ok(self.instance.get_typed_func(&self.store, name)?)
    }

    /// Compute the full witness assignment for `inputs`, as ark-bn254 field elements.
    pub fn calculate_witness_fr(&mut self, inputs: HashMap<String, Vec<BigInt>>) -> Res<Vec<Fr>> {
        let n32 = self.n32 as usize;
        let init: TypedFunc<i32, ()> = self.instance.get_typed_func(&self.store, "init")?;
        let write: TypedFunc<(i32, i32), ()> = self
            .instance
            .get_typed_func(&self.store, "writeSharedRWMemory")?;
        let read: TypedFunc<i32, i32> = self
            .instance
            .get_typed_func(&self.store, "readSharedRWMemory")?;
        let set_input: TypedFunc<(i32, i32, i32), ()> = self
            .instance
            .get_typed_func(&self.store, "setInputSignal")?;
        let get_witness: TypedFunc<i32, ()> =
            self.instance.get_typed_func(&self.store, "getWitness")?;

        init.call(&mut self.store, 0)?;

        for (name, values) in inputs {
            let (msb, lsb) = fnv(&name);
            for (i, value) in values.iter().enumerate() {
                let arr = to_array32(value, n32);
                for j in 0..n32 {
                    // shared memory expects least-significant word first
                    write.call(&mut self.store, (j as i32, arr[n32 - 1 - j] as i32))?;
                }
                set_input.call(&mut self.store, (msb as i32, lsb as i32, i as i32))?;
            }
        }

        let witness_size = self.tf0("getWitnessSize")?.call(&mut self.store, ())? as usize;
        let mut out = Vec::with_capacity(witness_size);
        for i in 0..witness_size {
            get_witness.call(&mut self.store, i as i32)?;
            let mut arr = vec![0u32; n32];
            for j in 0..n32 {
                arr[n32 - 1 - j] = read.call(&mut self.store, j as i32)? as u32;
            }
            out.push(bigint_to_fr(from_array32(arr)));
        }
        Ok(out)
    }
}

impl Drop for WitnessCalculator {
    /// Zero-fills the wasm's linear memory: it holds every signal of the last witness.
    fn drop(&mut self) {
        let data = self.memory.data_mut(&mut self.store);
        #[cfg(test)]
        let before = data.iter().filter(|b| **b != 0).count();
        data.fill(0);
        #[cfg(test)]
        probe::record(before, data.iter().filter(|b| **b != 0).count());
    }
}

/// Test-only observation of the drop wipe: (non-zero bytes before, non-zero bytes after).
#[cfg(test)]
pub(crate) mod probe {
    use std::cell::Cell;
    thread_local! {
        static LAST: Cell<Option<(usize, usize)>> = const { Cell::new(None) };
    }
    pub(crate) fn record(before: usize, after: usize) {
        LAST.with(|l| l.set(Some((before, after))));
    }
    /// Takes this thread's last record.
    pub(crate) fn take() -> Option<(usize, usize)> {
        LAST.with(|l| l.take())
    }
}

/// BigInt (possibly negative, from circom) → canonical ark-bn254 Fr. Verbatim logic
/// from ark-circom's `calculate_witness_element`.
fn bigint_to_fr(w: BigInt) -> Fr {
    let modulus: BigUint = Fr::MODULUS.into();
    let w = if w.sign() == num_bigint::Sign::Minus {
        modulus - w.abs().to_biguint().unwrap()
    } else {
        w.to_biguint().unwrap()
    };
    Fr::from(w)
}

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
            BigInt::parse_bytes(
                b"8081702745406920529902264228351723735379273324999453834569345340835518474946",
                10,
            )
            .unwrap(),
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
