//! Links libnoctura_prover.so (the cdylib) with exports.map, so its dynamic symbol table holds
//! exactly the JNI functions of jni-exports.txt and nothing else (spec §12, §14 "Boundary";
//! checked by check-jni-exports.sh on the built library). Android (the app's library) and Linux
//! (the host `jni-host` build CI and the Kotlin JVM test use) only: both link with an ELF linker
//! that takes `--version-script`. The rlib, the tests and the examples are unaffected —
//! `rustc-cdylib-link-arg` reaches the cdylib's link alone.

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=exports.map");
    let os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if os == "android" || os == "linux" {
        let map = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("exports.map");
        println!(
            "cargo:rustc-cdylib-link-arg=-Wl,--version-script={}",
            map.display()
        );
    }
}
