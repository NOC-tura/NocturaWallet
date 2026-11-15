@file:Suppress("DEPRECATION") // BridgeReactContext: the one concrete ReactApplicationContext in RN 0.84

package com.nocturawallet.prover

import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import com.facebook.react.bridge.BridgeReactContext
import java.io.File
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The M1a checkpoint ON THE PHONE (spec §16): instrumentation of the installed devnet RELEASE
 * app (`testBuildType "release"`), so the library that proves is the one that ships — while this
 * class lives in the separate test APK and never in the app (scripts/m1a-checkpoint/
 * check-release-apk.sh).
 *
 * Run by the desk script (`node scripts/m1a-checkpoint/m1a-checkpoint.mjs phone`), which reads
 * the report from `am instrument -r` (status key `m1a-report`; also in logcat under
 * `M1aCheckpoint`) and decides PASS / FAIL. This test fails on what the device itself can see
 * (isSupported, the refusals, a step that errored) AFTER the report is out.
 *
 * The pinned key files come inside this test APK, as assets staged at build time from
 * NOCTURA_A0_KEYS_DIR (the program side's zk/keys/v2/) — no network on the phone, no adb push;
 * Rust re-checks every sha256 before it parses a byte.
 */
class M1aCheckpointTest {
    @Test
    fun m1aCheckpoint() {
        val inst = InstrumentationRegistry.getInstrumentation()
        val testAssets = inst.context.assets
        val target = inst.targetContext

        val dir = File(target.cacheDir, "m1a-checkpoint").apply { deleteRecursively(); mkdirs() }
        for (name in M1aCheckpoint.KEY_FILES) {
            testAssets.open("a0/$name").use { input -> File(dir, name).outputStream().use { input.copyTo(it) } }
        }
        val keyVectors = testAssets.open("a0-key-vectors.json").bufferedReader().use { it.readText() }
        val proveVectors = testAssets.open("a0-prove-vectors.json").bufferedReader().use { it.readText() }

        val platform = JSONObject()
            .put("where", "phone")
            .put("javaVmName", System.getProperty("java.vm.name"))
            .put("osArch", System.getProperty("os.arch"))
            .put("supportedAbis", JSONArray(Build.SUPPORTED_ABIS.toList()))
            .put("sdkInt", Build.VERSION.SDK_INT)
            .put("model", Build.MODEL)
            .put("targetPackage", target.packageName)

        // The React method itself — the call JS makes (isSupported() never touches the context).
        val supported = try {
            NocturaProverModule(BridgeReactContext(target)).isSupported()
        } catch (e: Throwable) {
            platform.put("isSupportedThrew", e.javaClass.name)
            null
        }

        val report = M1aCheckpoint.run(keyVectors, proveVectors, { File(dir, it).path }, platform, supported)
        dir.deleteRecursively()

        inst.sendStatus(STATUS_REPORT, Bundle().apply { putString(M1aCheckpoint.REPORT_KEY, report.toString()) })
        for (line in M1aCheckpoint.chunks(report)) Log.i(M1aCheckpoint.LOG_TAG, line)

        val failures = M1aCheckpoint.deviceFailures(report, expectSupported = true)
        assertTrue("M1a checkpoint, device-side failures: $failures", failures.isEmpty())
    }

    private companion object {
        /** Not one of AndroidJUnitRunner's own status codes (1, 0, -1 … -4). */
        const val STATUS_REPORT = 7
    }
}
