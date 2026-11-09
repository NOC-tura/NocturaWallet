//! Pure-Rust JNI bridge for the Android `NocturaProver` native module. No C++ glue,
//! no libc++_shared → the blst-style libc++ startup conflict does not apply.
//!
//! Two Kotlin classes bind here, and `jni-exports.txt` lists every symbol (the export check
//! compares it with the built library's dynamic symbols):
//! - `com.nocturawallet.prover.NocturaProverModule` — `nativeIsSupported`, and the v1
//!   `nativeProve` (removed with the v1 path in M1b);
//! - `com.nocturawallet.prover.NocturaA0Native` — the A0 surface (spec §3): `keysOpen`,
//!   `keysClose`, `depositRho`, `matchSpent`, `commitment`, `prove`, and the Kotlin-only
//!   `parseUnshield` / `authorizeUnshield`. Each is marshalling only: the logic, the envelope
//!   and the refusals are `a0::bridge`'s, tested on the desktop. Built for the host too with
//!   `--features jni-host`, so the Kotlin JVM test can call these exact symbols.
//!
//! No call panics into the JVM: a JNI failure (a string that cannot be read, a pending
//! exception) is cleared and reported as `E_A0_ARG` in the envelope; a result string that cannot
//! be built returns `null`, which Kotlin reports as `E_A0_INTERNAL`.

use crate::a0::{bridge, A0Error, CORE};
use jni::objects::{JByteArray, JClass, JObjectArray, JString};
use jni::sys::{jboolean, jstring, JNI_TRUE};
use jni::JNIEnv;
use zeroize::Zeroizing;

#[no_mangle]
pub extern "system" fn Java_com_nocturawallet_prover_NocturaProverModule_nativeIsSupported(
    _env: JNIEnv,
    _class: JClass,
) -> jboolean {
    JNI_TRUE
}

/// v1 prove (the NPkc pool's circuits) — unchanged; M1b removes it with the v1 path.
#[no_mangle]
pub extern "system" fn Java_com_nocturawallet_prover_NocturaProverModule_nativeProve<'a>(
    mut env: JNIEnv<'a>,
    _class: JClass<'a>,
    circuit_id: JString<'a>,
    witness_json: JString<'a>,
    zkey_path: JString<'a>,
    wasm_path: JString<'a>,
) -> jstring {
    let result = (|| -> Result<String, Box<dyn std::error::Error>> {
        let cid: String = env.get_string(&circuit_id)?.into();
        let wj: String = env.get_string(&witness_json)?.into();
        let zk: String = env.get_string(&zkey_path)?.into();
        let wp: String = env.get_string(&wasm_path)?.into();
        let out = crate::prover::prove_to_bytes(&cid, &wj, &zk, &wp)?;
        Ok(serde_json::json!({
            "proofBytes": out.proof_bytes_hex,
            "publicInputs": out.public_inputs,
        })
        .to_string())
    })();

    // Always return a JSON string; errors go in an `error` field for Kotlin to reject.
    let json = result.unwrap_or_else(|e| serde_json::json!({ "error": e.to_string() }).to_string());
    env.new_string(json)
        .expect("failed to build result jstring")
        .into_raw()
}

// ------------------------------------------------------------------------- the A0 surface

/// The envelope string as a Java string, or `null` if it cannot be built.
fn out(env: &mut JNIEnv, json: String) -> jstring {
    let _ = env.exception_clear();
    match env.new_string(json) {
        Ok(s) => s.into_raw(),
        Err(_) => {
            let _ = env.exception_clear();
            std::ptr::null_mut()
        }
    }
}

/// The envelope of a JNI failure while reading the arguments.
fn jni_arg() -> String {
    bridge::envelope(|| Err(A0Error::Arg { what: "jni" }))
}

/// The local references a [`string`] read may create inside its own frame: `get_string`'s
/// `java/lang/String` and the object's class (jni 0.21 frees neither).
const STRING_FRAME: i32 = 4;

/// A Java string's value. Local references (review I1): jni 0.21 deletes none on drop, and ART
/// on Android 7 / 7.1 (minSdk 24) aborts the process once a native method holds 512 — so every
/// reference this read creates lives in a local frame popped before it returns, and a call's
/// live references stay bounded whatever the size of its arguments (`tests_android_refs`).
fn string(env: &mut JNIEnv, s: &JString) -> Option<String> {
    env.with_local_frame(STRING_FRAME, |env| -> jni::errors::Result<String> {
        Ok(env.get_string(s)?.into())
    })
    .ok()
}

/// A nullable Java string: `Some(None)` for `null`.
fn opt_string(env: &mut JNIEnv, s: &JString) -> Option<Option<String>> {
    if s.is_null() {
        Some(None)
    } else {
        string(env, s).map(Some)
    }
}

fn strings(env: &mut JNIEnv, arr: &JObjectArray) -> Option<Vec<String>> {
    let n = env.get_array_length(arr).ok()?;
    let mut out = Vec::with_capacity(usize::try_from(n).ok()?);
    for i in 0..n {
        let item = JString::from(env.get_object_array_element(arr, i).ok()?);
        let s = string(env, &item);
        // the element's own local reference, freed before the next one is taken (review I1)
        let _ = env.delete_local_ref(item);
        out.push(s?);
    }
    Some(out)
}

/// Runs `f` on the arguments `read` took from the JVM, or reports the JNI failure.
fn call<T>(
    env: &mut JNIEnv,
    read: impl FnOnce(&mut JNIEnv) -> Option<T>,
    f: impl FnOnce(T) -> String,
) -> jstring {
    let json = match read(env) {
        Some(args) => f(args),
        None => jni_arg(),
    };
    out(env, json)
}

/// `keysOpen(seed: ByteArray): String?` — the seed is copied once, into a buffer that is wiped
/// when this returns (`bridge::keys_open` wipes it first); Kotlin wipes its own array.
#[no_mangle]
pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_keysOpen<'a>(
    mut env: JNIEnv<'a>,
    _class: JClass<'a>,
    seed: JByteArray<'a>,
) -> jstring {
    call(
        &mut env,
        |env| env.convert_byte_array(&seed).ok().map(Zeroizing::new),
        |mut seed| bridge::keys_open(&CORE, &mut seed),
    )
}

#[no_mangle]
pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_keysClose<'a>(
    mut env: JNIEnv<'a>,
    _class: JClass<'a>,
    handle: JString<'a>,
) -> jstring {
    call(
        &mut env,
        |env| string(env, &handle),
        |h| bridge::keys_close(&CORE, &h),
    )
}

#[no_mangle]
pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_depositRho<'a>(
    mut env: JNIEnv<'a>,
    _class: JClass<'a>,
    handle: JString<'a>,
    deposit_index: JString<'a>,
) -> jstring {
    call(
        &mut env,
        |env| Some((string(env, &handle)?, string(env, &deposit_index)?)),
        |(h, i)| bridge::deposit_rho(&CORE, &h, &i),
    )
}

#[no_mangle]
pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_matchSpent<'a>(
    mut env: JNIEnv<'a>,
    _class: JClass<'a>,
    handle: JString<'a>,
    chain_nullifiers: JObjectArray<'a>,
    own_rhos: JObjectArray<'a>,
) -> jstring {
    call(
        &mut env,
        |env| {
            Some((
                string(env, &handle)?,
                strings(env, &chain_nullifiers)?,
                strings(env, &own_rhos)?,
            ))
        },
        |(h, chain, own)| bridge::match_spent(&CORE, &h, &chain, &own),
    )
}

#[no_mangle]
pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_commitment<'a>(
    mut env: JNIEnv<'a>,
    _class: JClass<'a>,
    handle: JString<'a>,
    amount: JString<'a>,
    rho: JString<'a>,
) -> jstring {
    call(
        &mut env,
        |env| {
            Some((
                string(env, &handle)?,
                string(env, &amount)?,
                string(env, &rho)?,
            ))
        },
        |(h, a, r)| bridge::commitment(&CORE, &h, &a, &r),
    )
}

/// `prove(...)` — called on Kotlin's proving thread; takes the state lock only to complete the
/// witness, so `keysClose` / `authorizeUnshield` never wait for a proof.
#[no_mangle]
pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_prove<'a>(
    mut env: JNIEnv<'a>,
    _class: JClass<'a>,
    handle: JString<'a>,
    circuit: JString<'a>,
    witness_json: JString<'a>,
    auth_id: JString<'a>,
    zkey_path: JString<'a>,
    wasm_path: JString<'a>,
) -> jstring {
    // The witness carries private note data (m4): its Java-side copy is the caller's; this copy
    // is a Zeroizing buffer.
    call(
        &mut env,
        |env| {
            Some((
                string(env, &handle)?,
                string(env, &circuit)?,
                Zeroizing::new(string(env, &witness_json)?),
                opt_string(env, &auth_id)?,
                string(env, &zkey_path)?,
                string(env, &wasm_path)?,
            ))
        },
        |(h, c, w, a, z, wp)| bridge::prove(&CORE, &h, &c, &w, a.as_deref(), &z, &wp),
    )
}

/// Kotlin only (the M1c dialog) — never bound in the React module.
#[no_mangle]
pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_parseUnshield<'a>(
    mut env: JNIEnv<'a>,
    _class: JClass<'a>,
    owner: JString<'a>,
    amount: JString<'a>,
    fee: JString<'a>,
) -> jstring {
    call(
        &mut env,
        |env| {
            Some((
                string(env, &owner)?,
                string(env, &amount)?,
                string(env, &fee)?,
            ))
        },
        |(o, a, f)| bridge::parse_unshield(&o, &a, &f),
    )
}

/// Kotlin only (the M1c dialog, on the biometric approval) — never bound in the React module.
#[no_mangle]
pub extern "system" fn Java_com_nocturawallet_prover_NocturaA0Native_authorizeUnshield<'a>(
    mut env: JNIEnv<'a>,
    _class: JClass<'a>,
    handle: JString<'a>,
    owner: JString<'a>,
    amount: JString<'a>,
    fee: JString<'a>,
) -> jstring {
    call(
        &mut env,
        |env| {
            Some((
                string(env, &handle)?,
                string(env, &owner)?,
                string(env, &amount)?,
                string(env, &fee)?,
            ))
        },
        |(h, o, a, f)| bridge::authorize_unshield(&CORE, &h, &o, &a, &f),
    )
}
