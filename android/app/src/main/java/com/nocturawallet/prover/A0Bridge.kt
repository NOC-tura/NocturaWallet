package com.nocturawallet.prover

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableType
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/**
 * The ABI gate (spec §12, m14): the prover is built for arm64-v8a only, and on any other ABI —
 * emulators included — it is never loaded, so `isSupported()` is false and every A0 call is
 * `E_A0_UNAVAILABLE`. Read off the running process, not off what happens to be packaged: an APK
 * that one day carried a build for another ABI would still be refused. ART reports
 * `java.vm.name` = "Dalvik" and, in a 64-bit ARM process, `os.arch` = "aarch64" (a 32-bit ARM
 * process reports armv7l / armv8l, an emulator x86_64 / i686). A host JVM — the JVM unit tests,
 * which load the `jni-host` build — is not Android and is not gated.
 */
internal object A0Abi {
    const val ARCH = "aarch64"
    const val ART_VM_NAME = "Dalvik"

    fun allows(vmName: String?, osArch: String?): Boolean = vmName != ART_VM_NAME || osArch == ARCH

    fun current(): Boolean = allows(System.getProperty("java.vm.name"), System.getProperty("os.arch"))
}

/**
 * Loads `libnoctura_prover.so` once, lazily — never in a static initializer at app start (an
 * eager dlopen risks a launch crash) — and only where [A0Abi] allows it. Pure Rust (libc / libm /
 * libdl only; native/noctura-prover/check-needed.sh).
 */
internal object NocturaNativeLib {
    @Volatile private var loaded = false

    fun ensureLoaded() = ensureLoaded(A0Abi.current())

    /** The gate comes first, every time: a refused ABI throws even if a load happened before. */
    @Synchronized
    internal fun ensureLoaded(abiAllowed: Boolean) {
        if (!abiAllowed) throw UnsatisfiedLinkError("libnoctura_prover is built for arm64-v8a only")
        if (!loaded) {
            System.loadLibrary("noctura_prover")
            loaded = true
        }
    }
}

/** `isSupported()`: the library loads (ABI gate included) and says so; any failure is false. */
internal object A0Support {
    fun check(load: () -> Unit, native: () -> Boolean): Boolean =
        try {
            load()
            native()
        } catch (e: Throwable) {
            false
        }
}

/** A JS argument that is not in its one form; rejected as `E_A0_ARG` before any native call. */
internal class A0ArgException(what: String) : IllegalArgumentException("argument $what is malformed")

/** The outcome of one native call: Rust's envelope, read. */
internal sealed class A0Result {
    data class Ok(val value: Any?) : A0Result()

    data class Err(val code: String, val message: String) : A0Result()

    companion object {
        /** A panic caught in Rust, a null or unreadable result. */
        const val INTERNAL = "E_A0_INTERNAL"

        /** The library could not be loaded (another ABI, or a broken install). */
        const val UNAVAILABLE = "E_A0_UNAVAILABLE"

        /** A JS argument Kotlin refused (A0ArgException); Rust uses the same code for its own. */
        const val ARG = "E_A0_ARG"

        fun parse(json: String?): A0Result {
            if (json == null) return Err(INTERNAL, "the native call returned no result")
            val o = try {
                JSONObject(json)
            } catch (e: JSONException) {
                return Err(INTERNAL, "the native result is unreadable")
            }
            val code = o.opt("error")
            return when {
                code is String -> Err(code, o.optString("message"))
                o.has("ok") && !o.has("error") -> Ok(o.get("ok"))
                else -> Err(INTERNAL, "the native result is unreadable")
            }
        }
    }
}

internal object A0Seed {
    /**
     * The seed as a ByteArray for exactly the duration of [use], zero-filled when it returns or
     * throws (spec §3 "The seed crosses as bytes"). Every element must be an integer 0..255;
     * anything else throws [A0ArgException] before [use] runs. Stated limit: the ReadableArray
     * React Native built cannot be wiped from here.
     */
    fun <T> use(seed: ReadableArray, use: (ByteArray) -> T): T {
        val bytes = ByteArray(seed.size())
        try {
            for (i in 0 until seed.size()) {
                if (seed.getType(i) != ReadableType.Number) throw A0ArgException("seed")
                val d = seed.getDouble(i)
                if (!(d >= 0.0 && d <= 255.0) || d != Math.floor(d)) throw A0ArgException("seed")
                bytes[i] = d.toInt().toByte()
            }
            return use(bytes)
        } finally {
            bytes.fill(0)
        }
    }
}

internal object A0Args {
    /** A ReadableArray of strings; anything else throws [A0ArgException] naming the index. */
    fun strings(arr: ReadableArray, what: String): Array<String> =
        Array(arr.size()) { i ->
            if (arr.getType(i) != ReadableType.String) throw A0ArgException("$what[$i]")
            arr.getString(i) ?: throw A0ArgException("$what[$i]")
        }
}

/** The one thread proofs run on (seconds each): never the JS thread, never the UI thread. */
internal object A0Prover {
    const val THREAD_NAME = "noctura-a0-prove"

    /**
     * The proving thread's stack, explicit: 8 MiB (Fable review 1, minor). The whole prove —
     * the witness in wasmi, then arkworks' Groth16 — runs on this thread through the JNI, and a
     * new Java thread's default stack is about 1 MiB on ART and on the desktop JVM; an overflow
     * in native code is a SIGSEGV that kills the app, not a catchable error. (The stack size is
     * a request by contract; ART and HotSpot honour it — `A0ResultTest` reads it off the thread.)
     */
    const val STACK_SIZE_BYTES: Long = 8L * 1024 * 1024

    private val executor: ExecutorService = Executors.newSingleThreadExecutor { r ->
        Thread(null, r, THREAD_NAME, STACK_SIZE_BYTES).apply { isDaemon = true }
    }

    fun submit(task: () -> Unit) {
        executor.execute(task)
    }
}

/** Settles a JS promise from a native call: resolve the `ok` value, or reject with the stable code. */
internal object A0Promise {
    fun settle(promise: Promise, call: () -> String?) {
        val result = try {
            NocturaNativeLib.ensureLoaded()
            A0Result.parse(call())
        } catch (e: A0ArgException) {
            A0Result.Err(A0Result.ARG, e.message ?: "argument is malformed")
        } catch (e: UnsatisfiedLinkError) {
            A0Result.Err(A0Result.UNAVAILABLE, "the native library is unavailable")
        } catch (e: Throwable) {
            // No message passed on: nothing an exception here carries is meant for JS.
            A0Result.Err(A0Result.INTERNAL, "internal error")
        }
        when (result) {
            is A0Result.Ok -> promise.resolve(toReact(result.value))
            is A0Result.Err -> promise.reject(result.code, result.message)
        }
    }

    /** JSON → the React Native bridge's types (strings, ints, arrays, maps, null). */
    private fun toReact(v: Any?): Any? = when (v) {
        null, JSONObject.NULL -> null
        is String, is Boolean -> v
        is Int -> v
        is Number -> v.toDouble()
        is JSONArray -> Arguments.createArray().also { a ->
            for (i in 0 until v.length()) {
                when (val x = toReact(v.get(i))) {
                    null -> a.pushNull()
                    is String -> a.pushString(x)
                    is Int -> a.pushInt(x)
                    is Double -> a.pushDouble(x)
                    is Boolean -> a.pushBoolean(x)
                    is com.facebook.react.bridge.WritableArray -> a.pushArray(x)
                    is com.facebook.react.bridge.WritableMap -> a.pushMap(x)
                }
            }
        }
        is JSONObject -> Arguments.createMap().also { m ->
            for (k in v.keys()) {
                when (val x = toReact(v.get(k))) {
                    null -> m.putNull(k)
                    is String -> m.putString(k, x)
                    is Int -> m.putInt(k, x)
                    is Double -> m.putDouble(k, x)
                    is Boolean -> m.putBoolean(k, x)
                    is com.facebook.react.bridge.WritableArray -> m.putArray(k, x)
                    is com.facebook.react.bridge.WritableMap -> m.putMap(k, x)
                }
            }
        }
        else -> null
    }
}
