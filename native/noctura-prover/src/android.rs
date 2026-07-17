//! Pure-Rust JNI bridge for the Android `NocturaProver` native module. No C++ glue,
//! no libc++_shared → the blst-style libc++ startup conflict does not apply.
//! Symbols match `com.nocturawallet.prover.NocturaProverModule`'s `external fun`s.

use jni::objects::{JClass, JString};
use jni::sys::{jboolean, jstring, JNI_TRUE};
use jni::JNIEnv;

#[no_mangle]
pub extern "system" fn Java_com_nocturawallet_prover_NocturaProverModule_nativeIsSupported(
    _env: JNIEnv,
    _class: JClass,
) -> jboolean {
    JNI_TRUE
}

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
    let json = result.unwrap_or_else(|e| {
        serde_json::json!({ "error": e.to_string() }).to_string()
    });
    env.new_string(json)
        .expect("failed to build result jstring")
        .into_raw()
}
