package com.nocturawallet.prover

import com.facebook.react.bridge.JavaOnlyArray
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.json.JSONObject

/**
 * The M1a checkpoint sequence (spec 2026-11-08 shielded A0 M1 §16 "Checkpoints · M1a"), shared by
 * the phone run (androidTest `M1aCheckpointTest`, against the installed devnet release APK) and
 * its desktop rehearsal (unit test `M1aCheckpointHostTest`, over the `jni-host` library).
 *
 * NOT APP CODE. `src/m1aCheckpoint/java` is a source directory of the `androidTest` and `test`
 * source sets only (android/app/build.gradle); no class here is compiled into any app variant
 * (scripts/m1a-checkpoint/check-release-apk.sh proves it on the built APK).
 *
 * It REPORTS; the desk DECIDES. Every step records its value or its error code, even after an
 * earlier step failed, so one run gives the whole picture. The desk script
 * (scripts/m1a-checkpoint/m1a-checkpoint.mjs) compares the values with its own (computed from
 * the seed by code that shares nothing with the native library) and verifies the proofs with an
 * independent pairing check against the deposit VK it reads from devnet. Nothing in the report
 * is secret: the seed is the repo's public test mnemonic, and the values are those a deposit and
 * an unshield of that seed publish anyway.
 *
 * The calls go through the layer the React methods are one-liners over: [A0Seed] (the seed as a
 * zero-filled ByteArray), [NocturaA0Native] (the JNI), [A0Result] (the envelope), and every
 * prove runs on [A0Prover]'s thread — the thread the app proves on (its stack size included).
 */
internal object M1aCheckpoint {
    const val SCHEMA = "noctura.m1a.checkpoint-report/1"
    const val LOG_TAG = "M1aCheckpoint"
    const val REPORT_KEY = "m1a-report"

    /** The checkpoint's deposit: the repo test seed, depositIndex 0, 1 token (10^9 base units). */
    const val DEPOSIT_INDEX = "0"
    const val DEPOSIT_AMOUNT = "1000000000"

    /** The four pinned A0 files under their published names (Rust re-checks each sha256). */
    val KEY_FILES = listOf("deposit_final.zkey", "deposit.wasm", "withdraw_change_final.zkey", "withdraw_change.wasm")

    /** A prove on the phone: zkey parse + witness + proof; generous, the desk records the time. */
    private const val PROVE_TIMEOUT_S = 600L

    /**
     * Runs the sequence. [keyVectorsJson] / [proveVectorsJson] are the committed offline fixtures
     * (the seed, the withdraw_change witness and its authorization); [keyPath] maps a published
     * key-file name to a readable path; [platform] says where this ran; [isSupported] is the React
     * module's `isSupported()` (null when it cannot be called — the host rehearsal).
     */
    fun run(
        keyVectorsJson: String,
        proveVectorsJson: String,
        keyPath: (String) -> String,
        platform: JSONObject,
        isSupported: Boolean?,
    ): JSONObject {
        val report = JSONObject()
        report.put("schema", SCHEMA)
        report.put("platform", platform)
        report.put("isSupported", isSupported ?: JSONObject.NULL)

        val keys = JSONObject(keyVectorsJson)
        val proves = JSONObject(proveVectorsJson)
        val seedRow = keys.getJSONArray("seeds").getJSONObject(0)
        val deposit = scenario(proves, "deposit")
        val withdraw = scenario(proves, "withdraw_change")
        report.put("seedLabel", seedRow.getString("label"))
        report.put("depositWitness", deposit.getJSONObject("witness"))
        report.put("withdrawScenario", withdraw.getString("label"))

        // keysOpen with the repo's test seed — through A0Seed, as the React method does.
        val seedHex = seedRow.getString("seed")
        val seed = JavaOnlyArray.from((0 until seedHex.length / 2).map { seedHex.substring(2 * it, 2 * it + 2).toInt(16) })
        var kotlinCopy: ByteArray? = null
        val opened = step {
            A0Seed.use(seed) { b ->
                kotlinCopy = b
                NocturaA0Native.keysOpen(b)
            }
        }
        report.put("keysOpen", opened.json)
        report.put("seedCopyZeroFilled", kotlinCopy?.all { it == 0.toByte() } ?: JSONObject.NULL)
        val h = opened.value as? String
        if (h == null) {
            report.put("complete", false)
            return report
        }

        val rho = step { NocturaA0Native.depositRho(h, DEPOSIT_INDEX) }
        report.put("depositRho", rho.json.put("depositIndex", DEPOSIT_INDEX))
        val rhoHex = rho.value as? String ?: ""
        report.put(
            "commitment",
            step { NocturaA0Native.commitment(h, DEPOSIT_AMOUNT, rhoHex) }.json.put("amount", DEPOSIT_AMOUNT),
        )

        // The deposit proof. Its public inputs are compared on the desk, and the proof is
        // verified there against the deposit VK read from chain.
        report.put("depositProof", prove(h, "deposit", deposit.getJSONObject("witness").toString(), null, keyPath, "deposit"))

        // A withdraw_change prove without an authId refuses — with a well-formed witness and the
        // REAL key files, so nothing but the missing approval can be the reason.
        val wWitness = withdraw.getJSONObject("witness").toString()
        report.put("withdrawWithoutAuthId", prove(h, "withdraw_change", wWitness, null, keyPath, "withdraw_change"))

        // Positive control: approved (Kotlin-only authorizeUnshield, as M1c's dialog will), the
        // same call proves; and the approval is then used up.
        val a = withdraw.getJSONObject("authorization")
        val auth = step { NocturaA0Native.authorizeUnshield(h, a.getString("owner"), a.getString("amount"), a.getString("fee")) }
        report.put("authorizeUnshield", JSONObject().put("ok", auth.value is String).put("error", auth.code ?: JSONObject.NULL))
        val authId = auth.value as? String
        if (authId != null) {
            report.put("withdrawWithAuthId", prove(h, "withdraw_change", wWitness, authId, keyPath, "withdraw_change"))
            report.put("withdrawReusedAuthId", prove(h, "withdraw_change", wWitness, authId, keyPath, "withdraw_change"))
        }

        report.put("keysClose", step { NocturaA0Native.keysClose(h) }.json)
        report.put("depositRhoAfterClose", step { NocturaA0Native.depositRho(h, DEPOSIT_INDEX) }.json)
        report.put("complete", true)
        return report
    }

    /** The checks the device itself can make; the desk makes the rest. Empty = none failed. */
    fun deviceFailures(report: JSONObject, expectSupported: Boolean): List<String> {
        val out = mutableListOf<String>()
        if (expectSupported && report.opt("isSupported") != true) out += "isSupported() is not true"
        if (!report.optBoolean("complete")) out += "the sequence did not complete (keysOpen failed?)"
        if (report.opt("seedCopyZeroFilled") != true) out += "Kotlin's seed copy was not zero-filled"
        for (k in listOf("depositRho", "commitment", "depositProof", "withdrawWithAuthId")) {
            if (report.optJSONObject(k)?.has("ok") != true) out += "$k did not succeed: ${report.optJSONObject(k)}"
        }
        if (codeOf(report, "withdrawWithoutAuthId") != "E_A0_AUTH_ABSENT") out += "withdraw_change without authId: ${report.opt("withdrawWithoutAuthId")}"
        if (codeOf(report, "withdrawReusedAuthId") != "E_A0_AUTH_ABSENT") out += "a used authId was accepted again: ${report.opt("withdrawReusedAuthId")}"
        if (codeOf(report, "depositRhoAfterClose") != "E_A0_UNKNOWN_HANDLE") out += "the handle outlived keysClose"
        return out
    }

    /** The report as lines of at most [max] chars (logcat truncates a line near 4 KB). */
    fun chunks(report: JSONObject, max: Int = 3000): List<String> {
        val s = report.toString()
        val n = (s.length + max - 1) / max
        return (0 until n).map { i -> "M1A-REPORT ${i + 1}/$n ${s.substring(i * max, minOf(s.length, (i + 1) * max))}" }
    }

    private fun codeOf(report: JSONObject, key: String): String? =
        report.optJSONObject(key)?.let { if (it.has("error")) it.getString("error") else null }

    private fun scenario(proves: JSONObject, circuit: String): JSONObject {
        val all = proves.getJSONArray("scenarios")
        for (i in 0 until all.length()) {
            val s = all.getJSONObject(i)
            if (s.getString("circuit") == circuit) return s
        }
        throw IllegalStateException("no $circuit scenario in the prove fixture")
    }

    private class Step(val value: Any?, val code: String?, val message: String?) {
        val json: JSONObject
            get() = if (code == null) JSONObject().put("ok", value ?: JSONObject.NULL) else JSONObject().put("error", code).put("message", message)
    }

    private fun step(call: () -> String?): Step =
        try {
            NocturaNativeLib.ensureLoaded()
            when (val r = A0Result.parse(call())) {
                is A0Result.Ok -> Step(r.value, null, null)
                is A0Result.Err -> Step(null, r.code, r.message)
            }
        } catch (e: UnsatisfiedLinkError) {
            Step(null, A0Result.UNAVAILABLE, "the native library is unavailable")
        }

    /** One prove on the app's proving thread; the result with the thread's name and the time. */
    private fun prove(h: String, circuit: String, witness: String, authId: String?, keyPath: (String) -> String, files: String): JSONObject {
        val done = CountDownLatch(1)
        var result: Step? = null
        var thread = ""
        val t0 = System.nanoTime()
        A0Prover.submit {
            thread = Thread.currentThread().name
            result = try {
                step { NocturaA0Native.prove(h, circuit, witness, authId, keyPath("${files}_final.zkey"), keyPath("$files.wasm")) }
            } catch (e: Throwable) {
                Step(null, A0Result.INTERNAL, e.javaClass.simpleName)
            }
            done.countDown()
        }
        val finished = done.await(PROVE_TIMEOUT_S, TimeUnit.SECONDS)
        val ms = (System.nanoTime() - t0) / 1_000_000
        val r = result
        val out = when {
            !finished || r == null -> JSONObject().put("error", "TIMEOUT").put("message", "no result in $PROVE_TIMEOUT_S s")
            r.code != null -> r.json
            else -> {
                val v = r.value as JSONObject
                JSONObject().put("ok", true).put("proofBytes", v.getString("proofBytes")).put("publicInputs", v.getJSONArray("publicInputs"))
            }
        }
        return out.put("circuit", circuit).put("thread", thread).put("ms", ms).put("withAuthId", authId != null)
    }
}
