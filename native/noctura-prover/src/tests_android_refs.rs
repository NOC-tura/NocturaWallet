//! JNI local references (Task 4 review I1): the exported A0 functions of `android.rs`, driven
//! through a fake `JNIEnv` that keeps the books the way a VM does — every local reference a JNI
//! call creates is counted in the current frame until `DeleteLocalRef` or the frame's
//! `PopLocalFrame` frees it.
//!
//! Why a fake and not the JVM: jni 0.21 frees no local reference on drop, and ART on Android
//! 7 / 7.1 (minSdk 24) aborts the process once a native method holds 512. HotSpot has no such
//! limit, and its `-Xcheck:jni` (JDK 17, this repo's) prints no local-capacity warning — measured:
//! the unfixed host library took 5,000 + 5,000 strings under `-Xcheck:jni` silently. So the
//! leak is read here, off the code's own JNI calls: each frame must stay within its capacity —
//! 16 for the native method's own frame (the JNI specification's guarantee without
//! `EnsureLocalCapacity`), the requested one for a pushed frame — and the total within ART N's
//! 512. `A0JniTest` (Kotlin) runs the same arrays through the real JVM for the values.
//!
//! The negative control reads the unfixed pattern (an element plus `get_string`'s two
//! classes, never freed) with the same books and sees it overflow.

use crate::a0::{bridge, CORE};
use crate::android::{
    Java_com_nocturawallet_prover_NocturaA0Native_commitment as commitment,
    Java_com_nocturawallet_prover_NocturaA0Native_matchSpent as match_spent,
    Java_com_nocturawallet_prover_NocturaA0Native_prove as prove,
};
use jni::objects::{JClass, JObject, JObjectArray, JString};
use jni::sys::{
    self, jarray, jboolean, jclass, jint, jobject, jobjectArray, jsize, jstring,
    JNINativeInterface_, JNI_FALSE, JNI_OK, JNI_TRUE,
};
use serde_json::Value;
use std::ffi::{c_char, CStr, CString};
use std::sync::Mutex;

/// The JNI specification's guarantee for a native method's own frame.
const NATIVE_FRAME_CAPACITY: usize = 16;
/// ART's local reference table on Android 7 / 7.1.
const ART_N_TABLE: usize = 512;
const EXTRA: usize = 5000;

const KEY_VECTORS: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/tests/fixtures/a0-key-vectors.json"
));

enum Obj {
    Class,
    Str(String),
    Array(Vec<usize>),
}

struct Frame {
    capacity: usize,
    refs: usize,
}

struct World {
    objects: Vec<Obj>,
    /// A local reference is `index + 1`: `Some((frame, object))` while live.
    refs: Vec<Option<(usize, usize)>>,
    frames: Vec<Frame>,
    live: usize,
    max_live: usize,
    violations: Vec<String>,
}

impl World {
    fn new() -> Self {
        World {
            objects: vec![],
            refs: vec![],
            frames: vec![Frame {
                capacity: NATIVE_FRAME_CAPACITY,
                refs: 0,
            }],
            live: 0,
            max_live: 0,
            violations: vec![],
        }
    }
    fn add(&mut self, o: Obj) -> usize {
        self.objects.push(o);
        self.objects.len() - 1
    }
    fn new_ref(&mut self, obj: usize) -> jobject {
        let f = self.frames.len() - 1;
        self.refs.push(Some((f, obj)));
        self.frames[f].refs += 1;
        self.live += 1;
        self.max_live = self.max_live.max(self.live);
        if self.frames[f].refs == self.frames[f].capacity + 1 {
            self.violations.push(format!(
                "frame {f} holds more than its capacity of {} local references",
                self.frames[f].capacity
            ));
        }
        if self.live == ART_N_TABLE + 1 {
            self.violations.push(format!(
                "more than {ART_N_TABLE} live local references (ART N aborts)"
            ));
        }
        self.refs.len() as jobject
    }
    fn obj(&mut self, r: jobject) -> Option<usize> {
        let got = (r as usize)
            .checked_sub(1)
            .and_then(|i| self.refs.get(i).copied().flatten())
            .map(|(_, o)| o);
        if got.is_none() {
            self.violations
                .push("a dead or unknown reference was used".into());
        }
        got
    }
    fn delete(&mut self, r: jobject) {
        match (r as usize)
            .checked_sub(1)
            .and_then(|i| self.refs.get_mut(i))
        {
            Some(slot @ Some(_)) => {
                let (f, _) = slot.take().unwrap();
                self.frames[f].refs -= 1;
                self.live -= 1;
            }
            _ => self.violations.push("a dead reference was deleted".into()),
        }
    }
    fn pop(&mut self, result: jobject) -> jobject {
        let keep = if result.is_null() {
            None
        } else {
            self.obj(result)
        };
        let top = self.frames.len() - 1;
        if top == 0 {
            self.violations
                .push("PopLocalFrame without a pushed frame".into());
            return std::ptr::null_mut();
        }
        for slot in self.refs.iter_mut() {
            if matches!(slot, Some((f, _)) if *f == top) {
                *slot = None;
                self.live -= 1;
            }
        }
        self.frames.pop();
        keep.map_or(std::ptr::null_mut(), |o| self.new_ref(o))
    }
    fn text(&mut self, r: jobject) -> Option<String> {
        match self.obj(r).map(|o| &self.objects[o]) {
            Some(Obj::Str(t)) => Some(t.clone()),
            _ => None,
        }
    }
}

static WORLD: Mutex<Option<World>> = Mutex::new(None);
/// One fake VM at a time (the tests of this file share WORLD and CORE).
static SERIAL: Mutex<()> = Mutex::new(());

fn with<T>(f: impl FnOnce(&mut World) -> T) -> T {
    let mut g = WORLD.lock().unwrap_or_else(|e| e.into_inner());
    f(g.as_mut().expect("no fake VM"))
}

unsafe extern "system" fn find_class(_: *mut sys::JNIEnv, _: *const c_char) -> jclass {
    with(|w| {
        let o = w.add(Obj::Class);
        w.new_ref(o)
    })
}
unsafe extern "system" fn get_object_class(_: *mut sys::JNIEnv, _: jobject) -> jclass {
    find_class(std::ptr::null_mut(), std::ptr::null())
}
unsafe extern "system" fn is_assignable_from(
    _: *mut sys::JNIEnv,
    _: jclass,
    _: jclass,
) -> jboolean {
    JNI_TRUE
}
unsafe extern "system" fn exception_check(_: *mut sys::JNIEnv) -> jboolean {
    JNI_FALSE
}
unsafe extern "system" fn exception_clear(_: *mut sys::JNIEnv) {}
unsafe extern "system" fn get_string_utf_chars(
    _: *mut sys::JNIEnv,
    s: jstring,
    is_copy: *mut jboolean,
) -> *const c_char {
    let Some(text) = with(|w| w.text(s)) else {
        return std::ptr::null();
    };
    if !is_copy.is_null() {
        *is_copy = JNI_TRUE;
    }
    CString::new(text).unwrap_or_default().into_raw()
}
unsafe extern "system" fn release_string_utf_chars(
    _: *mut sys::JNIEnv,
    _: jstring,
    chars: *const c_char,
) {
    drop(CString::from_raw(chars as *mut c_char));
}
unsafe extern "system" fn get_array_length(_: *mut sys::JNIEnv, a: jarray) -> jsize {
    with(|w| match w.obj(a).map(|o| &w.objects[o]) {
        Some(Obj::Array(v)) => v.len() as jsize,
        _ => 0,
    })
}
unsafe extern "system" fn get_object_array_element(
    _: *mut sys::JNIEnv,
    a: jobjectArray,
    i: jsize,
) -> jobject {
    with(|w| {
        let el = match w.obj(a).map(|o| &w.objects[o]) {
            Some(Obj::Array(v)) => v.get(i as usize).copied(),
            _ => None,
        };
        el.map_or(std::ptr::null_mut(), |o| w.new_ref(o))
    })
}
unsafe extern "system" fn new_string_utf(_: *mut sys::JNIEnv, chars: *const c_char) -> jstring {
    let t = CStr::from_ptr(chars).to_string_lossy().into_owned();
    with(|w| {
        let o = w.add(Obj::Str(t));
        w.new_ref(o)
    })
}
unsafe extern "system" fn delete_local_ref(_: *mut sys::JNIEnv, r: jobject) {
    with(|w| w.delete(r))
}
unsafe extern "system" fn push_local_frame(_: *mut sys::JNIEnv, capacity: jint) -> jint {
    with(|w| {
        w.frames.push(Frame {
            capacity: usize::try_from(capacity).unwrap_or(0),
            refs: 0,
        })
    });
    JNI_OK
}
unsafe extern "system" fn pop_local_frame(_: *mut sys::JNIEnv, result: jobject) -> jobject {
    with(|w| w.pop(result))
}

fn table() -> JNINativeInterface_ {
    // SAFETY: every field is a raw pointer or an Option of a function pointer: all-zero is null /
    // None, which jni reports as JNIEnvMethodNotFound rather than calling.
    let mut t: JNINativeInterface_ = unsafe { std::mem::zeroed() };
    t.FindClass = Some(find_class);
    t.GetObjectClass = Some(get_object_class);
    t.IsAssignableFrom = Some(is_assignable_from);
    t.ExceptionCheck = Some(exception_check);
    t.ExceptionClear = Some(exception_clear);
    t.GetStringUTFChars = Some(get_string_utf_chars);
    t.ReleaseStringUTFChars = Some(release_string_utf_chars);
    t.GetArrayLength = Some(get_array_length);
    t.GetObjectArrayElement = Some(get_object_array_element);
    t.NewStringUTF = Some(new_string_utf);
    t.DeleteLocalRef = Some(delete_local_ref);
    t.PushLocalFrame = Some(push_local_frame);
    t.PopLocalFrame = Some(pop_local_frame);
    t
}

/// A fresh fake VM; `f` gets a JNIEnv on it. Returns `f`'s value and the books afterwards.
fn in_vm<T>(f: impl FnOnce(jni::JNIEnv<'static>) -> T) -> (T, World) {
    *WORLD.lock().unwrap_or_else(|e| e.into_inner()) = Some(World::new());
    let t = Box::leak(Box::new(table()));
    let iface: &'static mut *const JNINativeInterface_ = Box::leak(Box::new(t as *const _));
    let raw: *mut sys::JNIEnv = iface;
    // SAFETY: `raw` points at a function table that lives for the program.
    let env = unsafe { jni::JNIEnv::from_raw(raw) }.unwrap();
    let out = f(env);
    let w = WORLD
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take()
        .unwrap();
    (out, w)
}

/// The JVM's own references to a call's arguments (the native method's frame).
fn arg_str(s: &str) -> jobject {
    with(|w| {
        let o = w.add(Obj::Str(s.to_string()));
        w.new_ref(o)
    })
}
fn arg_array(items: &[String]) -> jobject {
    with(|w| {
        let ids = items.iter().map(|s| w.add(Obj::Str(s.clone()))).collect();
        let a = w.add(Obj::Array(ids));
        w.new_ref(a)
    })
}
fn arg_class() -> jobject {
    with(|w| {
        let o = w.add(Obj::Class);
        w.new_ref(o)
    })
}

fn open_core() -> String {
    let kv: Value = serde_json::from_str(KEY_VECTORS).unwrap();
    let mut seed = hex::decode(kv["seeds"][0]["seed"].as_str().unwrap()).unwrap();
    let out: Value = serde_json::from_str(&bridge::keys_open(&CORE, &mut seed)).unwrap();
    out["ok"].as_str().unwrap().to_string()
}
fn notes() -> Vec<(String, String)> {
    let kv: Value = serde_json::from_str(KEY_VECTORS).unwrap();
    kv["seeds"][0]["notes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|n| {
            (
                n["rho"].as_str().unwrap().to_string(),
                n["nullifier"].as_str().unwrap().to_string(),
            )
        })
        .collect()
}

/// `matchSpent` with the own notes plus `extra` fillers in each array; (envelope, books).
fn match_spent_in_vm(h: &str, extra: usize) -> (String, World) {
    let notes = notes();
    let chain: Vec<String> = notes
        .iter()
        .map(|(_, nf)| nf.clone())
        .chain((0..extra).map(|i| format!("{:064x}", i + 1)))
        .collect();
    let own: Vec<String> = notes
        .iter()
        .map(|(rho, _)| rho.clone())
        .chain((0..extra).map(|i| format!("{:064x}", i + 1_000_000)))
        .collect();
    let (text, w) = in_vm(|env| {
        let (c, hs, ca, oa) = (arg_class(), arg_str(h), arg_array(&chain), arg_array(&own));
        // SAFETY: each is a live reference of the fake VM, of the type the symbol takes.
        let out = unsafe {
            match_spent(
                env,
                JClass::from_raw(c),
                JString::from_raw(hs),
                JObjectArray::from_raw(ca),
                JObjectArray::from_raw(oa),
            )
        };
        with(|w| w.text(out)).unwrap_or_default()
    });
    (text, w)
}

#[test]
fn large_arrays_cross_the_jni_with_their_local_references_bounded() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let h = open_core();
    let n = notes().len();
    let expected: Value = serde_json::json!({ "ok": (0..n).collect::<Vec<_>>() });

    let (out, big) = match_spent_in_vm(&h, EXTRA);
    assert_eq!(serde_json::from_str::<Value>(&out).unwrap(), expected);
    assert!(big.violations.is_empty(), "{:?}", big.violations);
    // the native frame at the end: the 4 argument references and the result, nothing else
    assert_eq!(big.live, 5, "references left behind");
    assert!(big.max_live <= NATIVE_FRAME_CAPACITY, "{}", big.max_live);

    // the high-water mark does not grow with the arrays
    let (out, small) = match_spent_in_vm(&h, 1);
    assert_eq!(serde_json::from_str::<Value>(&out).unwrap(), expected);
    assert_eq!(small.max_live, big.max_live);
    bridge::keys_close(&CORE, &h);
}

#[test]
fn every_string_argument_is_read_without_leaving_a_reference() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    // prove: six strings and a null authId; commitment: three. Their outcome is an envelope
    // (here a refusal, no session) — what is counted is what the reads left behind.
    let ((), w) = in_vm(|env| {
        let args: Vec<jobject> = (0..6).map(|_| arg_str("0")).collect();
        let c = arg_class();
        // SAFETY: live references of the fake VM (strings), and a null authId.
        let out = unsafe {
            prove(
                env,
                JClass::from_raw(c),
                JString::from_raw(args[0]),
                JString::from_raw(args[1]),
                JString::from_raw(args[2]),
                JString::from(JObject::null()),
                JString::from_raw(args[4]),
                JString::from_raw(args[5]),
            )
        };
        assert!(with(|w| w.text(out)).unwrap().contains("\"error\""));
    });
    assert!(w.violations.is_empty(), "{:?}", w.violations);
    assert_eq!(w.live, 6 + 1 + 1, "references left behind by prove");
    let ((), w) = in_vm(|env| {
        let (c, a, b, r) = (arg_class(), arg_str("0"), arg_str("1"), arg_str("00"));
        // SAFETY: live references of the fake VM.
        let out = unsafe {
            commitment(
                env,
                JClass::from_raw(c),
                JString::from_raw(a),
                JString::from_raw(b),
                JString::from_raw(r),
            )
        };
        assert!(with(|w| w.text(out)).unwrap().contains("\"error\""));
    });
    assert!(w.violations.is_empty(), "{:?}", w.violations);
    assert_eq!(w.live, 4 + 1, "references left behind by commitment");
}

#[test]
fn the_books_see_the_unfreed_pattern_negative_control() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let items: Vec<String> = (0..200).map(|i| format!("{i}")).collect();
    let (read, w) = in_vm(|mut env| {
        let a = arg_array(&items);
        // SAFETY: a live array reference of the fake VM.
        let arr = unsafe { JObjectArray::from_raw(a) };
        // what android.rs did before the fix: the element and get_string's two classes stay live
        let mut read = 0;
        for i in 0..items.len() as i32 {
            let el = JString::from(env.get_object_array_element(&arr, i).unwrap());
            let _s: String = env.get_string(&el).unwrap().into();
            read += 1;
        }
        read
    });
    assert_eq!(read, 200);
    assert_eq!(w.live, 1 + 3 * 200);
    assert!(
        w.violations.iter().any(|v| v.contains("capacity of 16")),
        "{:?}",
        w.violations
    );
    assert!(
        w.violations.iter().any(|v| v.contains("ART N")),
        "{:?}",
        w.violations
    );
}
